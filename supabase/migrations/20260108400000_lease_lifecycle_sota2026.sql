-- ============================================
-- MIGRATION SOTA 2026: Cycle de vie complet des baux
-- ============================================
-- Cette migration implémente:
-- 1. Protection contre la suppression des baux actifs/terminés
-- 2. Archivage automatique des baux terminés après 5 ans
-- 3. Nettoyage des documents orphelins
-- 4. Notifications aux locataires lors des modifications
-- ============================================

-- ============================================
-- 1. Colonne archived_at pour les baux
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE leases ADD COLUMN archived_at TIMESTAMPTZ;
    COMMENT ON COLUMN leases.archived_at IS 'Date d''archivage automatique (après 5 ans)';
  END IF;
END $$;

-- ============================================
-- 2. Contrainte CHECK sur statut des baux
-- ============================================
DO $$
BEGIN
  ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;
  ALTER TABLE leases ADD CONSTRAINT leases_statut_check
    CHECK (statut IN (
      'draft', 
      'pending_signature', 
      'partially_signed',
      'fully_signed', 
      'active', 
      'terminated', 
      'archived',
      'cancelled'
    ));
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Contrainte statut existe déjà';
END $$;

-- ============================================
-- 3. Trigger: Bloquer suppression baux protégés
-- ============================================
CREATE OR REPLACE FUNCTION block_protected_lease_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Les baux actifs, terminés ou archivés ne peuvent pas être supprimés
  IF OLD.statut IN ('active', 'terminated', 'archived', 'fully_signed') THEN
    RAISE EXCEPTION 'Impossible de supprimer un bail avec statut: %. Raison légale: conservation obligatoire.', OLD.statut
      USING HINT = 'Utilisez le statut "cancelled" pour annuler un bail en cours de signature.';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_protected_lease_delete ON leases;
CREATE TRIGGER trg_block_protected_lease_delete
  BEFORE DELETE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION block_protected_lease_delete();

-- ============================================
-- 4. Trigger: Notifier locataires lors de modifications importantes
-- ============================================
CREATE OR REPLACE FUNCTION notify_tenant_lease_changes()
RETURNS TRIGGER AS $$
DECLARE
  tenant_profile_id UUID;
  change_type TEXT;
  message_text TEXT;
BEGIN
  -- Ne notifier que pour les changements importants
  IF TG_OP = 'UPDATE' THEN
    -- Changement de statut
    IF OLD.statut IS DISTINCT FROM NEW.statut THEN
      change_type := 'status_change';
      
      CASE NEW.statut
        WHEN 'active' THEN
          message_text := 'Votre bail est maintenant actif. Bienvenue dans votre nouveau logement !';
        WHEN 'terminated' THEN
          message_text := 'Votre bail a été officiellement terminé. Merci d''avoir été notre locataire.';
        WHEN 'cancelled' THEN
          message_text := 'Le bail a été annulé par le propriétaire.';
        ELSE
          message_text := 'Le statut de votre bail a été mis à jour: ' || NEW.statut;
      END CASE;
      
      -- Envoyer notification à tous les locataires du bail
      FOR tenant_profile_id IN 
        SELECT profile_id FROM lease_signers 
        WHERE lease_id = NEW.id 
          AND role IN ('locataire_principal', 'colocataire')
      LOOP
        INSERT INTO notifications (
          recipient_id,
          type,
          title,
          message,
          link,
          related_id,
          related_type
        ) VALUES (
          tenant_profile_id,
          CASE 
            WHEN NEW.statut = 'active' THEN 'success'
            WHEN NEW.statut IN ('terminated', 'cancelled') THEN 'alert'
            ELSE 'info'
          END,
          'Mise à jour du bail',
          message_text,
          '/tenant/leases/' || NEW.id,
          NEW.id,
          'lease'
        );
      END LOOP;
    END IF;
    
    -- Changement de loyer (important pour les locataires)
    IF OLD.loyer IS DISTINCT FROM NEW.loyer AND NEW.statut = 'active' THEN
      FOR tenant_profile_id IN 
        SELECT profile_id FROM lease_signers 
        WHERE lease_id = NEW.id 
          AND role IN ('locataire_principal', 'colocataire')
      LOOP
        INSERT INTO notifications (
          recipient_id,
          type,
          title,
          message,
          link,
          related_id,
          related_type
        ) VALUES (
          tenant_profile_id,
          'info',
          'Révision du loyer',
          'Le loyer a été révisé de ' || OLD.loyer || '€ à ' || NEW.loyer || '€.',
          '/tenant/leases/' || NEW.id,
          NEW.id,
          'lease'
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_tenant_lease_changes ON leases;
CREATE TRIGGER trg_notify_tenant_lease_changes
  AFTER UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenant_lease_changes();

-- ============================================
-- 5. Fonction: Archivage automatique des baux terminés (> 5 ans)
-- ============================================
CREATE OR REPLACE FUNCTION archive_old_terminated_leases()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER := 0;
BEGIN
  -- Archiver les baux terminés depuis plus de 5 ans
  UPDATE leases
  SET 
    statut = 'archived',
    archived_at = NOW()
  WHERE 
    statut = 'terminated'
    AND date_fin IS NOT NULL
    AND date_fin < NOW() - INTERVAL '5 years'
    AND archived_at IS NULL;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  IF archived_count > 0 THEN
    RAISE NOTICE '% baux archivés automatiquement', archived_count;
  END IF;
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Fonction: Nettoyage des documents orphelins
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_orphan_documents()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Supprimer les documents dont le bail n'existe plus
  -- (ne devrait pas arriver avec les cascades, mais au cas où)
  DELETE FROM documents
  WHERE lease_id IS NOT NULL
    AND lease_id NOT IN (SELECT id FROM leases);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Supprimer aussi les documents liés à des propriétés supprimées définitivement
  DELETE FROM documents
  WHERE property_id IS NOT NULL
    AND property_id NOT IN (SELECT id FROM properties);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT + deleted_count;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE '% documents orphelins supprimés', deleted_count;
  END IF;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Vue: Baux avec tous les éléments liés (pour l'UI)
-- ============================================
CREATE OR REPLACE VIEW lease_details_view AS
SELECT 
  l.id,
  l.type_bail,
  l.loyer,
  l.charges_forfaitaires,
  l.depot_de_garantie,
  l.date_debut,
  l.date_fin,
  l.statut,
  l.created_at,
  l.archived_at,
  p.id AS property_id,
  p.adresse_complete AS property_address,
  p.owner_id,
  p.etat AS property_status,
  p.deleted_at AS property_deleted_at,
  -- Compter les éléments liés
  (SELECT COUNT(*) FROM lease_signers WHERE lease_id = l.id) AS signer_count,
  (SELECT COUNT(*) FROM documents WHERE lease_id = l.id) AS document_count,
  (SELECT COUNT(*) FROM invoices WHERE lease_id = l.id) AS invoice_count,
  (SELECT COUNT(*) FROM edl WHERE lease_id = l.id) AS edl_count,
  -- Locataire principal
  (
    SELECT json_build_object(
      'id', pr.id,
      'prenom', pr.prenom,
      'nom', pr.nom,
      'email', pr.email
    )
    FROM lease_signers ls
    JOIN profiles pr ON ls.profile_id = pr.id
    WHERE ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LIMIT 1
  ) AS main_tenant
FROM leases l
LEFT JOIN properties p ON l.property_id = p.id
WHERE l.statut != 'archived'; -- Exclure les archivés par défaut

-- ============================================
-- 8. Logs de la migration
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '=== Migration SOTA 2026 - Cycle de vie des baux ===';
  RAISE NOTICE '✅ Colonne archived_at ajoutée';
  RAISE NOTICE '✅ Contrainte CHECK sur statut mise à jour';
  RAISE NOTICE '✅ Trigger de protection contre suppression créé';
  RAISE NOTICE '✅ Trigger de notification locataires créé';
  RAISE NOTICE '✅ Fonction d''archivage automatique créée';
  RAISE NOTICE '✅ Fonction de nettoyage orphelins créée';
  RAISE NOTICE '✅ Vue lease_details_view créée';
END $$;

