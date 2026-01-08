-- =====================================================
-- Migration SOTA 2026: Soft-Delete pour les propriétés
-- Date: 2026-01-08
-- Description: 
--   - Ajoute les colonnes pour le soft-delete
--   - Crée un trigger de notification avant suppression
--   - Protège contre la suppression accidentelle
-- =====================================================

-- =====================================================
-- 1. Ajouter les colonnes de soft-delete
-- =====================================================
ALTER TABLE properties 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Index pour filtrer les propriétés non supprimées
CREATE INDEX IF NOT EXISTS idx_properties_deleted_at ON properties(deleted_at) WHERE deleted_at IS NULL;

-- Ajouter 'deleted' comme état valide
DO $$
BEGIN
  -- Vérifier si la contrainte existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_etat_check'
  ) THEN
    ALTER TABLE properties DROP CONSTRAINT properties_etat_check;
  END IF;
  
  -- Recréer avec 'deleted'
  ALTER TABLE properties ADD CONSTRAINT properties_etat_check 
    CHECK (etat IN ('draft', 'pending', 'published', 'rejected', 'deleted', 'archived'));
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Contrainte etat non modifiée: %', SQLERRM;
END $$;

-- =====================================================
-- 2. Trigger de notification AVANT suppression hard
-- =====================================================
CREATE OR REPLACE FUNCTION notify_tenants_before_property_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_address TEXT;
BEGIN
  -- Récupérer l'adresse
  v_address := COALESCE(OLD.adresse_complete, 'Logement');

  -- Notifier tous les locataires des baux de cette propriété
  FOR v_tenant IN
    SELECT DISTINCT ls.profile_id
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    WHERE l.property_id = OLD.id
      AND ls.role IN ('locataire_principal', 'colocataire')
      AND ls.profile_id IS NOT NULL
  LOOP
    -- Vérifier que la fonction create_notification existe
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_notification') THEN
      PERFORM create_notification(
        v_tenant.profile_id,
        'alert',
        'Logement supprimé',
        format('Le logement "%s" a été supprimé. Vos documents restent accessibles.', v_address),
        '/tenant/documents',
        OLD.id,
        'property'
      );
    ELSE
      -- Fallback: insertion directe
      INSERT INTO notifications (recipient_id, type, title, message, link, related_id, related_type)
      VALUES (
        v_tenant.profile_id,
        'alert',
        'Logement supprimé',
        format('Le logement "%s" a été supprimé. Vos documents restent accessibles.', v_address),
        '/tenant/documents',
        OLD.id,
        'property'
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_tenants_before_property_delete ON properties;
CREATE TRIGGER trigger_notify_tenants_before_property_delete
  BEFORE DELETE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenants_before_property_delete();

-- =====================================================
-- 3. Trigger pour empêcher la suppression si bail actif
-- =====================================================
CREATE OR REPLACE FUNCTION prevent_property_delete_with_active_lease()
RETURNS TRIGGER AS $$
DECLARE
  v_active_lease RECORD;
  v_tenant_name TEXT;
BEGIN
  -- Vérifier s'il y a un bail actif
  SELECT l.id, l.statut, 
         COALESCE(p.prenom || ' ' || p.nom, p.email, 'Locataire') as tenant_name
  INTO v_active_lease
  FROM leases l
  LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
  LEFT JOIN profiles p ON p.id = ls.profile_id
  WHERE l.property_id = OLD.id
    AND l.statut IN ('active', 'pending_signature', 'partially_signed', 'fully_signed')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Impossible de supprimer : bail % avec %. Terminez d''abord le bail.', 
      v_active_lease.statut, 
      v_active_lease.tenant_name
    USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_prevent_property_delete_with_active_lease ON properties;
CREATE TRIGGER trigger_prevent_property_delete_with_active_lease
  BEFORE DELETE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION prevent_property_delete_with_active_lease();

-- =====================================================
-- 4. Vue pour les propriétés actives (non supprimées)
-- =====================================================
CREATE OR REPLACE VIEW active_properties AS
SELECT *
FROM properties
WHERE deleted_at IS NULL
  AND (etat IS NULL OR etat != 'deleted');

-- =====================================================
-- 5. Fonction RPC pour restaurer une propriété
-- =====================================================
CREATE OR REPLACE FUNCTION restore_property(p_property_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_owner_id UUID;
  v_caller_profile_id UUID;
BEGIN
  -- Récupérer le profil de l'appelant
  SELECT id INTO v_caller_profile_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_caller_profile_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  -- Récupérer le propriétaire
  SELECT owner_id INTO v_owner_id
  FROM properties
  WHERE id = p_property_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Propriété non trouvée';
  END IF;

  -- Vérifier les permissions
  IF v_owner_id != v_caller_profile_id THEN
    -- Vérifier si admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_caller_profile_id AND role = 'admin') THEN
      RAISE EXCEPTION 'Accès non autorisé';
    END IF;
  END IF;

  -- Restaurer la propriété
  UPDATE properties
  SET deleted_at = NULL,
      deleted_by = NULL,
      etat = 'draft'
  WHERE id = p_property_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Logs de la migration
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== Migration SOTA 2026: Soft-Delete Propriétés ===';
  RAISE NOTICE '✅ Colonnes deleted_at et deleted_by ajoutées';
  RAISE NOTICE '✅ Trigger notification locataires avant suppression';
  RAISE NOTICE '✅ Trigger blocage suppression si bail actif';
  RAISE NOTICE '✅ Vue active_properties créée';
  RAISE NOTICE '✅ Fonction restore_property créée';
  RAISE NOTICE '=== Protection complète des données activée ===';
END $$;

