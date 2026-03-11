-- =====================================================
-- Migration: Synchroniser plan_slug depuis plan_id
--
-- Problème: Certaines subscriptions ont plan_slug NULL
-- car la colonne a été ajoutée après la création de la subscription.
-- Cela cause un fallback vers le plan "gratuit" côté frontend,
-- bloquant les utilisateurs sur les forfaits payants (starter, etc.)
--
-- Fix:
-- 1. Synchroniser plan_slug depuis plan_id pour toutes les rows NULL
-- 2. Créer un trigger pour auto-sync à chaque changement de plan_id
-- =====================================================

-- 1. Synchroniser les plan_slug manquants
UPDATE subscriptions s
SET plan_slug = sp.slug, updated_at = NOW()
FROM subscription_plans sp
WHERE sp.id = s.plan_id
  AND s.plan_slug IS NULL;

-- 2. Trigger auto-sync plan_slug quand plan_id change
CREATE OR REPLACE FUNCTION sync_subscription_plan_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Si plan_id change ou plan_slug est NULL, synchroniser depuis subscription_plans
  IF NEW.plan_id IS NOT NULL AND (
    NEW.plan_slug IS NULL
    OR TG_OP = 'INSERT'
    OR OLD.plan_id IS DISTINCT FROM NEW.plan_id
  ) THEN
    SELECT slug INTO NEW.plan_slug
    FROM subscription_plans
    WHERE id = NEW.plan_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_subscription_plan_slug ON subscriptions;
CREATE TRIGGER trg_sync_subscription_plan_slug
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_subscription_plan_slug();

COMMENT ON FUNCTION sync_subscription_plan_slug() IS
  'Auto-synchronise plan_slug depuis plan_id pour éviter les fallbacks vers gratuit.';
