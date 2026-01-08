-- =====================================================
-- Migration SOTA 2026: Triggers de notifications pour LOCATAIRES
-- Date: 2026-01-08
-- Description: Génère des notifications automatiques pour les locataires
--              lorsque le propriétaire effectue des modifications
-- =====================================================

-- =====================================================
-- TRIGGER 1: Notification quand le loyer est modifié
-- =====================================================
CREATE OR REPLACE FUNCTION notify_tenant_lease_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
  v_change_description TEXT;
BEGIN
  -- Récupérer l'adresse du logement
  SELECT COALESCE(adresse_complete, 'Logement')
  INTO v_property_address
  FROM properties
  WHERE id = NEW.property_id;

  -- Construire la description des changements
  v_change_description := '';
  
  -- Changement de loyer
  IF OLD.loyer IS DISTINCT FROM NEW.loyer THEN
    v_change_description := format('Loyer: %s€ → %s€', OLD.loyer, NEW.loyer);
  END IF;
  
  -- Changement de charges
  IF OLD.charges_forfaitaires IS DISTINCT FROM NEW.charges_forfaitaires THEN
    IF v_change_description != '' THEN
      v_change_description := v_change_description || ', ';
    END IF;
    v_change_description := v_change_description || format('Charges: %s€ → %s€', COALESCE(OLD.charges_forfaitaires, 0), COALESCE(NEW.charges_forfaitaires, 0));
  END IF;
  
  -- Changement de dépôt
  IF OLD.depot_de_garantie IS DISTINCT FROM NEW.depot_de_garantie THEN
    IF v_change_description != '' THEN
      v_change_description := v_change_description || ', ';
    END IF;
    v_change_description := v_change_description || format('Dépôt: %s€ → %s€', COALESCE(OLD.depot_de_garantie, 0), COALESCE(NEW.depot_de_garantie, 0));
  END IF;

  -- Si des changements financiers ont été détectés
  IF v_change_description != '' THEN
    -- Notifier tous les locataires du bail
    FOR v_tenant IN
      SELECT DISTINCT ls.profile_id
      FROM lease_signers ls
      WHERE ls.lease_id = NEW.id
        AND ls.role IN ('locataire_principal', 'colocataire')
        AND ls.profile_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        v_tenant.profile_id,
        'alert',
        'Modification de votre bail',
        format('%s - %s', v_property_address, v_change_description),
        '/tenant/lease',
        NEW.id,
        'lease'
      );
    END LOOP;
  END IF;
  
  -- Changement de statut vers "active"
  IF OLD.statut != 'active' AND NEW.statut = 'active' THEN
    FOR v_tenant IN
      SELECT DISTINCT ls.profile_id
      FROM lease_signers ls
      WHERE ls.lease_id = NEW.id
        AND ls.role IN ('locataire_principal', 'colocataire')
        AND ls.profile_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        v_tenant.profile_id,
        'lease_signed',
        'Votre bail est actif ! 🎉',
        format('Bienvenue dans votre nouveau logement: %s', v_property_address),
        '/tenant/dashboard',
        NEW.id,
        'lease'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_tenant_lease_updated ON leases;
CREATE TRIGGER trigger_notify_tenant_lease_updated
  AFTER UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenant_lease_updated();

-- =====================================================
-- TRIGGER 2: Notification quand une quittance est générée
-- =====================================================
CREATE OR REPLACE FUNCTION notify_tenant_invoice_created()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
BEGIN
  -- Seulement pour les factures envoyées (pas les brouillons)
  IF NEW.statut NOT IN ('sent', 'draft') THEN
    RETURN NEW;
  END IF;

  -- Récupérer l'adresse via le bail
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = NEW.lease_id;

  -- Notifier tous les locataires du bail
  FOR v_tenant IN
    SELECT DISTINCT ls.profile_id
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire')
      AND ls.profile_id IS NOT NULL
  LOOP
    PERFORM create_notification(
      v_tenant.profile_id,
      'payment_reminder',
      format('Loyer %s à payer', NEW.periode),
      format('%s€ pour %s', NEW.montant_total, v_property_address),
      '/tenant/payments',
      NEW.id,
      'invoice'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_tenant_invoice_created ON invoices;
CREATE TRIGGER trigger_notify_tenant_invoice_created
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenant_invoice_created();

-- =====================================================
-- TRIGGER 3: Notification quand un document est uploadé
-- =====================================================
CREATE OR REPLACE FUNCTION notify_tenant_document_uploaded()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_doc_type_label TEXT;
  v_property_address TEXT;
BEGIN
  -- Labels lisibles pour les types de documents
  CASE NEW.type
    WHEN 'quittance' THEN v_doc_type_label := 'Quittance de loyer';
    WHEN 'bail' THEN v_doc_type_label := 'Contrat de bail';
    WHEN 'EDL_entree' THEN v_doc_type_label := 'État des lieux d''entrée';
    WHEN 'EDL_sortie' THEN v_doc_type_label := 'État des lieux de sortie';
    WHEN 'attestation_assurance' THEN v_doc_type_label := 'Attestation d''assurance';
    WHEN 'reglement_interieur' THEN v_doc_type_label := 'Règlement intérieur';
    ELSE v_doc_type_label := 'Document';
  END CASE;

  -- Récupérer l'adresse du logement
  IF NEW.property_id IS NOT NULL THEN
    SELECT COALESCE(adresse_complete, 'Logement')
    INTO v_property_address
    FROM properties
    WHERE id = NEW.property_id;
  ELSE
    v_property_address := 'Votre logement';
  END IF;

  -- Si le document est lié à un locataire spécifique
  IF NEW.tenant_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.tenant_id,
      'document_uploaded',
      format('Nouveau %s disponible', v_doc_type_label),
      format('Un document a été ajouté pour %s', v_property_address),
      '/tenant/documents',
      NEW.id,
      'document'
    );
  -- Sinon, notifier tous les locataires du bail
  ELSIF NEW.lease_id IS NOT NULL THEN
    FOR v_tenant_id IN
      SELECT DISTINCT ls.profile_id
      FROM lease_signers ls
      WHERE ls.lease_id = NEW.lease_id
        AND ls.role IN ('locataire_principal', 'colocataire')
        AND ls.profile_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        v_tenant_id,
        'document_uploaded',
        format('Nouveau %s disponible', v_doc_type_label),
        format('Un document a été ajouté pour %s', v_property_address),
        '/tenant/documents',
        NEW.id,
        'document'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_tenant_document_uploaded ON documents;
CREATE TRIGGER trigger_notify_tenant_document_uploaded
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenant_document_uploaded();

-- =====================================================
-- TRIGGER 4: Notification quand le propriétaire signe
-- =====================================================
CREATE OR REPLACE FUNCTION notify_tenant_owner_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
  v_signer_role TEXT;
BEGIN
  -- Seulement si la signature vient d'être complétée
  IF OLD.signature_status != 'signed' AND NEW.signature_status = 'signed' THEN
    -- Récupérer le rôle du signataire
    v_signer_role := NEW.role;
    
    -- Seulement si c'est le propriétaire qui vient de signer
    IF v_signer_role = 'proprietaire' THEN
      -- Récupérer l'adresse du logement
      SELECT COALESCE(p.adresse_complete, 'Logement')
      INTO v_property_address
      FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = NEW.lease_id;

      -- Notifier tous les locataires du bail
      FOR v_tenant IN
        SELECT DISTINCT ls.profile_id
        FROM lease_signers ls
        WHERE ls.lease_id = NEW.lease_id
          AND ls.role IN ('locataire_principal', 'colocataire')
          AND ls.profile_id IS NOT NULL
          AND ls.profile_id != NEW.profile_id -- Ne pas notifier le signataire lui-même
      LOOP
        PERFORM create_notification(
          v_tenant.profile_id,
          'document_signed',
          'Le propriétaire a signé le bail ! ✍️',
          format('Votre bail pour %s a été signé par le propriétaire', v_property_address),
          '/tenant/lease',
          NEW.lease_id,
          'lease'
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_tenant_owner_signed ON lease_signers;
CREATE TRIGGER trigger_notify_tenant_owner_signed
  AFTER UPDATE ON lease_signers
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenant_owner_signed();

-- =====================================================
-- TRIGGER 5: Notification quand un EDL est planifié
-- =====================================================
CREATE OR REPLACE FUNCTION notify_tenant_edl_scheduled()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
  v_edl_type_label TEXT;
BEGIN
  -- Seulement pour les nouveaux EDLs ou changement de date
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at) THEN
    -- Label du type d'EDL
    v_edl_type_label := CASE NEW.type
      WHEN 'entree' THEN 'État des lieux d''entrée'
      WHEN 'sortie' THEN 'État des lieux de sortie'
      ELSE 'État des lieux'
    END;

    -- Récupérer l'adresse du logement
    SELECT COALESCE(adresse_complete, 'Logement')
    INTO v_property_address
    FROM properties
    WHERE id = NEW.property_id;

    -- Notifier tous les signataires de l'EDL
    FOR v_tenant IN
      SELECT DISTINCT es.signer_profile_id
      FROM edl_signatures es
      WHERE es.edl_id = NEW.id
        AND es.signer_profile_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        v_tenant.signer_profile_id,
        'reminder',
        format('%s planifié', v_edl_type_label),
        format('%s - %s le %s', 
          v_property_address,
          v_edl_type_label,
          to_char(NEW.scheduled_at, 'DD/MM/YYYY à HH24:MI')
        ),
        '/tenant/documents',
        NEW.id,
        'edl'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_tenant_edl_scheduled ON edls;
CREATE TRIGGER trigger_notify_tenant_edl_scheduled
  AFTER INSERT OR UPDATE ON edls
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenant_edl_scheduled();

-- =====================================================
-- TRIGGER 6: Notification quand une signature est demandée
-- =====================================================
CREATE OR REPLACE FUNCTION notify_tenant_signature_requested()
RETURNS TRIGGER AS $$
DECLARE
  v_property_address TEXT;
  v_lease_type TEXT;
BEGIN
  -- Seulement pour les nouvelles entrées avec statut pending
  IF NEW.signature_status = 'pending' AND NEW.role IN ('locataire_principal', 'colocataire') THEN
    -- Récupérer les infos du bail
    SELECT 
      COALESCE(p.adresse_complete, 'Logement'),
      l.type_bail
    INTO v_property_address, v_lease_type
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    WHERE l.id = NEW.lease_id;

    -- Notifier le locataire
    IF NEW.profile_id IS NOT NULL THEN
      PERFORM create_notification(
        NEW.profile_id,
        'lease_pending_signature',
        'Signature de bail requise ✍️',
        format('Votre bail %s pour %s est prêt à être signé', 
          COALESCE(v_lease_type, 'location'),
          v_property_address
        ),
        '/tenant/onboarding/sign',
        NEW.lease_id,
        'lease'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_tenant_signature_requested ON lease_signers;
CREATE TRIGGER trigger_notify_tenant_signature_requested
  AFTER INSERT ON lease_signers
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenant_signature_requested();

-- =====================================================
-- TRIGGER 7: Notification quand un ticket est mis à jour
-- =====================================================
CREATE OR REPLACE FUNCTION notify_tenant_ticket_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_status_label TEXT;
BEGIN
  -- Seulement si le statut change
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    -- Label du statut
    v_status_label := CASE NEW.statut
      WHEN 'in_progress' THEN 'est en cours de traitement'
      WHEN 'resolved' THEN 'a été résolu ✅'
      WHEN 'closed' THEN 'a été clôturé'
      ELSE format('a changé de statut: %s', NEW.statut)
    END;

    -- Notifier le créateur du ticket
    IF NEW.created_by_profile_id IS NOT NULL THEN
      PERFORM create_notification(
        NEW.created_by_profile_id,
        CASE NEW.statut
          WHEN 'resolved' THEN 'ticket_resolved'
          ELSE 'ticket_update'
        END,
        format('Ticket "%s" %s', LEFT(NEW.titre, 30), v_status_label),
        format('Votre demande concernant "%s" %s', NEW.titre, v_status_label),
        format('/tenant/requests/%s', NEW.id),
        NEW.id,
        'ticket'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_tenant_ticket_updated ON tickets;
CREATE TRIGGER trigger_notify_tenant_ticket_updated
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenant_ticket_updated();

-- =====================================================
-- INDEX pour optimiser les requêtes de notifications
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_lease_signers_profile_role 
  ON lease_signers(profile_id, role) 
  WHERE role IN ('locataire_principal', 'colocataire');

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_type 
  ON notifications(recipient_id, type);

-- =====================================================
-- Logs de la migration
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== Migration SOTA 2026: Triggers notifications locataires ===';
  RAISE NOTICE '✅ Trigger 1: notify_tenant_lease_updated (loyer, charges, statut)';
  RAISE NOTICE '✅ Trigger 2: notify_tenant_invoice_created (nouvelles factures)';
  RAISE NOTICE '✅ Trigger 3: notify_tenant_document_uploaded (documents)';
  RAISE NOTICE '✅ Trigger 4: notify_tenant_owner_signed (signature propriétaire)';
  RAISE NOTICE '✅ Trigger 5: notify_tenant_edl_scheduled (EDL planifiés)';
  RAISE NOTICE '✅ Trigger 6: notify_tenant_signature_requested (demande signature)';
  RAISE NOTICE '✅ Trigger 7: notify_tenant_ticket_updated (tickets)';
  RAISE NOTICE '✅ Index optimisés créés';
  RAISE NOTICE '=== Synchronisation bidirectionnelle propriétaire ↔ locataire ACTIVÉE ===';
END $$;

