-- =====================================================
-- Migration: Fix Owner Subscription Defaults & Data Repair
--
-- Problemes corriges:
-- 1. create_owner_subscription() assigne "starter" au lieu de "gratuit"
-- 2. plan_slug non defini explicitement dans le trigger
-- 3. Periode d'essai incorrecte pour le plan gratuit
-- 4. properties_count desynchronise pour les comptes existants
-- 5. Owners orphelins sans subscription
--
-- Flux corrige:
-- - Nouveau owner → subscription "gratuit" (status=active, pas de trial)
-- - L'utilisateur choisit son forfait ensuite via /signup/plan
-- - Si forfait payant → Stripe Checkout met a jour la subscription
-- - Si gratuit → POST /api/subscriptions/select-plan confirme le choix
-- =====================================================

-- =====================================================
-- 1. Corriger le trigger create_owner_subscription()
--    Plan par defaut = gratuit, plan_slug defini, pas de trial
-- =====================================================

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
  v_prop_count INTEGER;
  v_lease_count INTEGER;
BEGIN
  -- Seulement pour les proprietaires
  IF NEW.role = 'owner' THEN
    -- Recuperer l'ID du plan gratuit
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = 'gratuit'
    LIMIT 1;

    -- Compter les proprietes existantes (cas rare mais possible via admin)
    SELECT COUNT(*) INTO v_prop_count
    FROM properties
    WHERE owner_id = NEW.id
      AND deleted_at IS NULL;

    -- Compter les baux actifs
    SELECT COUNT(*) INTO v_lease_count
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    WHERE p.owner_id = NEW.id
      AND p.deleted_at IS NULL
      AND l.statut IN ('active', 'pending_signature');

    -- Creer l'abonnement gratuit si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id,
        plan_id,
        plan_slug,
        status,
        billing_cycle,
        current_period_start,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'gratuit',         -- Plan gratuit par defaut
        'active',          -- Actif immediatement (pas de trial pour le gratuit)
        'monthly',
        NOW(),
        COALESCE(v_prop_count, 0),
        COALESCE(v_lease_count, 0)
      )
      ON CONFLICT (owner_id) DO NOTHING;

      RAISE NOTICE 'Abonnement Gratuit cree pour le proprietaire %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreer le trigger
DROP TRIGGER IF EXISTS trg_create_owner_subscription ON profiles;
CREATE TRIGGER trg_create_owner_subscription
  AFTER INSERT OR UPDATE OF role ON profiles
  WHEN (NEW.role = 'owner')
  FOR EACH ROW
  EXECUTE FUNCTION create_owner_subscription();

COMMENT ON FUNCTION create_owner_subscription() IS
  'Cree automatiquement un abonnement Gratuit pour les nouveaux proprietaires. Le forfait reel sera choisi ensuite via /signup/plan.';

-- =====================================================
-- 2. Recalculer properties_count pour TOUS les comptes
-- =====================================================

UPDATE subscriptions s
SET
  properties_count = COALESCE(pc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(p.id) AS cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  GROUP BY s2.owner_id
) pc
WHERE s.owner_id = pc.owner_id;

-- =====================================================
-- 3. Recalculer leases_count pour TOUS les comptes
-- =====================================================

UPDATE subscriptions s
SET
  leases_count = COALESCE(lc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(l.id) AS cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  LEFT JOIN leases l ON l.property_id = p.id AND l.statut IN ('active', 'pending_signature')
  GROUP BY s2.owner_id
) lc
WHERE s.owner_id = lc.owner_id;

-- =====================================================
-- 4. Synchroniser plan_slug NULL depuis plan_id
-- =====================================================

UPDATE subscriptions s
SET
  plan_slug = sp.slug,
  updated_at = NOW()
FROM subscription_plans sp
WHERE sp.id = s.plan_id
  AND (s.plan_slug IS NULL OR s.plan_slug = '');

-- =====================================================
-- 5. Creer subscriptions manquantes pour owners orphelins
--    (plan gratuit, status active)
-- =====================================================

DO $$
DECLARE
  v_gratuit_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_gratuit_id FROM subscription_plans WHERE slug = 'gratuit' LIMIT 1;

  IF v_gratuit_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      owner_id, plan_id, plan_slug, status, billing_cycle,
      current_period_start, properties_count, leases_count
    )
    SELECT
      p.id,
      v_gratuit_id,
      'gratuit',
      'active',
      'monthly',
      NOW(),
      COALESCE((SELECT COUNT(*) FROM properties pr WHERE pr.owner_id = p.id AND pr.deleted_at IS NULL), 0),
      0
    FROM profiles p
    WHERE p.role = 'owner'
      AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.owner_id = p.id)
    ON CONFLICT (owner_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) Gratuit cree(s) pour proprietaires orphelins', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON FUNCTION create_owner_subscription() IS
  'Cree un abonnement Gratuit (plan_slug=gratuit, status=active) pour chaque nouveau proprietaire. Les compteurs sont initialises a partir de l''etat reel de la base.';
