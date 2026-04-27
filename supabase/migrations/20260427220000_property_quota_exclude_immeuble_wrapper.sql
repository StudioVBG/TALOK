-- ============================================================================
-- Migration : Exclure les wrappers `type='immeuble'` du quota properties
--
-- Bug audité (rapport 2026-04-27, §8 #2 et #5) :
--   Le trigger `enforce_property_limit()` et le compteur cache
--   `subscriptions.properties_count` comptaient TOUTES les rows de `properties`
--   pour un owner, y compris :
--     - le wrapper technique `type='immeuble'` (1 row par immeuble configuré)
--     - les lots eux-mêmes (qui doivent compter, eux)
--   Conséquence : un propriétaire au plan `gratuit` (max=1) qui a configuré
--   un seul immeuble se retrouvait avec un quota saturé alors qu'il n'a en
--   pratique aucun bien facturable hors immeuble.
--
-- Spec (talok-buildings §3 — Quota forfait) :
--     buildings                 → ne consomme pas de slot
--     properties type=immeuble  → ne consomme pas de slot (wrapper technique)
--     properties (lots)         → consomme 1 slot chacun
--     properties (unitaires)    → consomme 1 slot chacun
--
-- Cette migration :
--   1. Réécrit `enforce_property_limit()` pour exclure les wrappers
--   2. Réécrit `update_subscription_properties_count()` pour la même règle
--   3. Recalcule `properties_count` pour TOUS les comptes
--   4. Émet un NOTICE listant les owners qui étaient en quota gonflé,
--      pour audit après déploiement
-- ============================================================================

-- ============================================================================
-- 1. enforce_property_limit() — exclut le wrapper du COUNT
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
  v_extra_property_price INTEGER;
BEGIN
  -- Le wrapper d'immeuble n'occupe pas de slot — il est créé puis ses lots
  -- sont comptés individuellement via leur propre INSERT.
  IF NEW.type = 'immeuble' THEN
    RETURN NEW;
  END IF;

  -- Compter les biens réels (lots + unitaires) hors wrappers et soft-deleted.
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL
    AND type <> 'immeuble';

  -- Récupérer la limite du plan et le prix des biens supplémentaires
  SELECT
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit'),
    COALESCE(sp.extra_property_price, 0)
  INTO max_allowed, plan_slug, v_extra_property_price
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Pas de subscription = plan gratuit (1 bien)
  IF max_allowed IS NULL THEN
    max_allowed := 1;
    v_extra_property_price := 0;
  END IF;

  -- Forfait avec biens suppl. payants : autoriser au-delà du quota inclus
  IF v_extra_property_price > 0 THEN
    RETURN NEW;
  END IF;

  -- Plan illimité : -1 = OK
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION
      'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.',
      max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enforce_property_limit() IS
  'Vérifie la limite de biens. Exclut les wrappers type=immeuble (qui ne consomment pas de slot, voir talok-buildings §3). Autorise les biens supplémentaires payants si extra_property_price > 0.';

-- ============================================================================
-- 2. update_subscription_properties_count() — même règle d'exclusion
-- ============================================================================
CREATE OR REPLACE FUNCTION update_subscription_properties_count()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_owner_id := OLD.owner_id;
  ELSE
    v_owner_id := NEW.owner_id;
  END IF;

  UPDATE subscriptions
  SET properties_count = (
    SELECT COUNT(*)
    FROM properties
    WHERE owner_id = v_owner_id
      AND deleted_at IS NULL
      AND type <> 'immeuble'
  ),
  updated_at = NOW()
  WHERE owner_id = v_owner_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_subscription_properties_count() IS
  'Recompte properties_count en excluant les wrappers type=immeuble (cohérent avec enforce_property_limit). Self-healing : recalcule à partir de l''état réel sur INSERT/UPDATE/DELETE.';

-- ============================================================================
-- 3. Audit pré-recalcul : combien d'owners étaient surcomptés ?
-- ============================================================================
DO $$
DECLARE
  v_inflated_count INTEGER;
  v_blocked_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_inflated_count
  FROM subscriptions s
  WHERE s.properties_count IS DISTINCT FROM (
    SELECT COUNT(*)
    FROM properties p
    WHERE p.owner_id = s.owner_id
      AND p.deleted_at IS NULL
      AND p.type <> 'immeuble'
  );

  -- Owners qui étaient potentiellement bloqués à tort (compteur gonflé
  -- par un wrapper, et plan sans extra_property_price).
  SELECT COUNT(DISTINCT s.owner_id) INTO v_blocked_count
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE COALESCE(sp.extra_property_price, 0) = 0
    AND COALESCE(sp.max_properties, 1) <> -1
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.owner_id = s.owner_id
        AND p.type = 'immeuble'
        AND p.deleted_at IS NULL
    )
    AND (
      SELECT COUNT(*) FROM properties p
      WHERE p.owner_id = s.owner_id
        AND p.deleted_at IS NULL
    ) >= COALESCE(sp.max_properties, 1)
    AND (
      SELECT COUNT(*) FROM properties p
      WHERE p.owner_id = s.owner_id
        AND p.deleted_at IS NULL
        AND p.type <> 'immeuble'
    ) < COALESCE(sp.max_properties, 1);

  RAISE NOTICE '[property_quota_audit] % subscription(s) avec properties_count erroné, dont % owner(s) potentiellement bloqué(s) à tort par un wrapper immeuble.',
    v_inflated_count, v_blocked_count;
END $$;

-- ============================================================================
-- 4. Recalcul self-healing pour TOUS les comptes
-- ============================================================================
UPDATE subscriptions s
SET
  properties_count = COALESCE(pc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(p.id) AS cnt
  FROM subscriptions s2
  LEFT JOIN properties p
    ON p.owner_id = s2.owner_id
   AND p.deleted_at IS NULL
   AND p.type <> 'immeuble'
  GROUP BY s2.owner_id
) pc
WHERE s.owner_id = pc.owner_id
  AND s.properties_count IS DISTINCT FROM COALESCE(pc.cnt, 0);

-- ============================================================================
-- 5. Audit post-recalcul : confirmation que tous les compteurs sont alignés
-- ============================================================================
DO $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM subscriptions s
  WHERE s.properties_count IS DISTINCT FROM (
    SELECT COUNT(*)
    FROM properties p
    WHERE p.owner_id = s.owner_id
      AND p.deleted_at IS NULL
      AND p.type <> 'immeuble'
  );

  IF v_remaining > 0 THEN
    RAISE WARNING '[property_quota_audit] % subscription(s) ont encore un compteur incohérent après recalcul. Inspectez manuellement.', v_remaining;
  ELSE
    RAISE NOTICE '[property_quota_audit] Tous les compteurs properties_count sont alignés.';
  END IF;
END $$;
