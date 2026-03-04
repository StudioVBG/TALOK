-- ============================================
-- Migration : Synchroniser payment_schedules.collection_day avec leases.jour_paiement
-- Date : 2026-03-04
-- Description : Quand leases.jour_paiement est mis à jour, propager la valeur
--   vers payment_schedules.collection_day pour les prélèvements SEPA.
-- ============================================

-- Trigger function : propager jour_paiement vers payment_schedules
CREATE OR REPLACE FUNCTION sync_lease_jour_paiement_to_schedules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Seulement si jour_paiement a changé
  IF NEW.jour_paiement IS DISTINCT FROM OLD.jour_paiement THEN
    UPDATE payment_schedules
    SET collection_day = COALESCE(NEW.jour_paiement, 5)
    WHERE lease_id = NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trg_sync_jour_paiement ON leases;
CREATE TRIGGER trg_sync_jour_paiement
  AFTER UPDATE OF jour_paiement ON leases
  FOR EACH ROW
  EXECUTE FUNCTION sync_lease_jour_paiement_to_schedules();

COMMENT ON FUNCTION sync_lease_jour_paiement_to_schedules IS 'Propage leases.jour_paiement vers payment_schedules.collection_day';
