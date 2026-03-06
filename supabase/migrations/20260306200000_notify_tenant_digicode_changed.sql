-- =====================================================
-- Migration: Trigger notification changement digicode
-- Date: 2026-03-06
-- Description: Notifie les locataires actifs quand le
--              propriétaire modifie le digicode du bien
-- =====================================================

CREATE OR REPLACE FUNCTION notify_tenant_digicode_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
BEGIN
  -- Seulement si le digicode a changé ET n'est pas null
  IF OLD.digicode IS DISTINCT FROM NEW.digicode AND NEW.digicode IS NOT NULL THEN
    v_property_address := COALESCE(NEW.adresse_complete, 'Votre logement');

    -- Notifier tous les locataires ayant un bail actif sur cette propriété
    FOR v_tenant IN
      SELECT DISTINCT ls.profile_id
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = NEW.id
        AND l.statut = 'active'
        AND ls.role IN ('locataire_principal', 'colocataire')
        AND ls.profile_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        v_tenant.profile_id,
        'alert',
        'Code d''accès modifié',
        format('Le digicode de %s a été mis à jour. Consultez votre espace locataire.', v_property_address),
        '/tenant/lease',
        NEW.id,
        'property'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_tenant_digicode_changed ON properties;
CREATE TRIGGER trigger_notify_tenant_digicode_changed
  AFTER UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenant_digicode_changed();

-- =====================================================
-- Logs de la migration
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== Migration: Trigger notification changement digicode ===';
  RAISE NOTICE 'Trigger 8: notify_tenant_digicode_changed (digicode modifié)';
  RAISE NOTICE 'Notifie les locataires actifs quand le digicode est modifié';
END $$;
