-- =====================================================
-- Migration: Allow extra properties for paid plans
--
-- Problème: Le trigger enforce_property_limit() bloque la
-- création de biens au-delà de max_properties, même pour
-- les forfaits payants (Starter, Confort, Pro) qui permettent
-- d'ajouter des biens supplémentaires moyennant un surcoût.
--
-- Fix:
-- - Ajouter la colonne extra_property_price à subscription_plans
-- - Mettre à jour enforce_property_limit() pour ne pas bloquer
--   quand extra_property_price > 0 (biens supplémentaires autorisés)
-- =====================================================

-- 1. Ajouter la colonne extra_property_price si elle n'existe pas
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS extra_property_price INTEGER DEFAULT 0;

COMMENT ON COLUMN subscription_plans.extra_property_price IS
  'Prix en centimes par bien supplémentaire au-delà du quota inclus. 0 = pas de bien suppl. autorisé.';

-- 2. Peupler la colonne pour les plans existants
UPDATE subscription_plans SET extra_property_price = 0   WHERE slug = 'gratuit';
UPDATE subscription_plans SET extra_property_price = 300 WHERE slug = 'starter';    -- 3€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 250 WHERE slug = 'confort';    -- 2,50€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 200 WHERE slug = 'pro';        -- 2€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 0   WHERE slug LIKE 'enterprise%';

-- 3. Mettre à jour enforce_property_limit() pour autoriser les biens
--    supplémentaires sur les forfaits qui le permettent
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
  v_extra_property_price INTEGER;
BEGIN
  -- Compter les propriétés actives (non soft-deleted) avec un vrai COUNT
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL;

  -- Récupérer la limite du plan et le prix des biens supplémentaires
  SELECT
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit'),
    COALESCE(sp.extra_property_price, 0)
  INTO max_allowed, plan_slug, v_extra_property_price
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
    v_extra_property_price := 0;
  END IF;

  -- Si le forfait autorise des biens supplémentaires payants, ne pas bloquer
  IF v_extra_property_price > 0 THEN
    RETURN NEW;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enforce_property_limit() IS
  'Vérifie la limite de biens. Autorise les biens supplémentaires payants pour les forfaits avec extra_property_price > 0.';
