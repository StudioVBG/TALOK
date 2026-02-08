-- Politique admin : les admins peuvent voir tous les profils
-- Utilise is_admin() qui est SECURITY DEFINER et donc bypass RLS
CREATE POLICY "profiles_admin_read" ON profiles 
FOR SELECT TO authenticated 
USING (public.is_admin());

-- Politique propriétaire : peut voir les profils de ses locataires
-- Évite la récursion en utilisant get_my_profile_id()
CREATE POLICY "profiles_owner_read_tenants" ON profiles 
FOR SELECT TO authenticated 
USING (
  -- Je suis propriétaire et ce profil est un locataire d'un de mes baux
  EXISTS (
    SELECT 1 
    FROM lease_signers ls
    INNER JOIN leases l ON l.id = ls.lease_id
    INNER JOIN properties p ON p.id = l.property_id
    WHERE ls.profile_id = profiles.id
    AND p.owner_id = public.get_my_profile_id()
  )
);

-- 8. VÉRIFIER QUE LES FONCTIONS EXISTANTES SONT BIEN SECURITY DEFINER
-- user_profile_id et user_role sont utilisées ailleurs, on les garde compatibles
CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_my_profile_id();
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_my_role();
$$;

-- Versions avec paramètre (pour usage admin)
CREATE OR REPLACE FUNCTION public.user_profile_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(role, 'anonymous') FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- 9. ACCORDER LES PERMISSIONS SUR LES FONCTIONS
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role(UUID) TO authenticated;

-- 10. TEST : Vérifier qu'il n'y a pas de récursion
-- Cette requête ne devrait pas échouer
DO $$
BEGIN
  RAISE NOTICE 'Test des politiques RLS sur profiles...';
  -- Le test réel se fait en appelant les fonctions
  PERFORM public.is_admin();
  PERFORM public.get_my_role();
  PERFORM public.get_my_profile_id();
  RAISE NOTICE 'OK - Pas de récursion détectée';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERREUR: %', SQLERRM;
END $$;

COMMENT ON FUNCTION public.is_admin() IS 'Vérifie si l''utilisateur actuel est admin (SECURITY DEFINER, pas de récursion RLS)';
COMMENT ON FUNCTION public.get_my_role() IS 'Retourne le rôle de l''utilisateur actuel (SECURITY DEFINER, pas de récursion RLS)';
COMMENT ON FUNCTION public.get_my_profile_id() IS 'Retourne le profile_id de l''utilisateur actuel (SECURITY DEFINER, pas de récursion RLS)';



-- ========== 20260108000000_normalize_signer_roles.sql ==========
-- ============================================
-- MIGRATION SSOT 2026: Normalisation des rôles de signataires
-- ============================================
-- Cette migration normalise tous les rôles de signataires vers les valeurs standard:
-- - proprietaire (anciennement: owner, bailleur, Proprietaire, etc.)
-- - locataire_principal (anciennement: locataire, tenant, principal, Locataire, etc.)
-- - colocataire (anciennement: co_locataire, cotenant, etc.)
-- - garant (anciennement: caution, guarantor, etc.)
-- ============================================

-- 1. Normaliser les rôles de propriétaires
UPDATE lease_signers
SET role = 'proprietaire'
WHERE LOWER(TRIM(role)) IN ('owner', 'bailleur', 'proprietaire');

-- 2. Normaliser les rôles de locataires principaux
UPDATE lease_signers
SET role = 'locataire_principal'
WHERE LOWER(TRIM(role)) IN ('locataire', 'tenant', 'principal', 'locataire_principal');

-- 3. Normaliser les rôles de colocataires
UPDATE lease_signers
SET role = 'colocataire'
WHERE LOWER(TRIM(role)) IN ('co_locataire', 'cotenant', 'colocataire');

-- 4. Normaliser les rôles de garants
UPDATE lease_signers
SET role = 'garant'
WHERE LOWER(TRIM(role)) IN ('caution', 'guarantor', 'garant');

-- ============================================
-- Ajouter une contrainte CHECK pour valider les rôles futurs
-- ============================================
DO $$
BEGIN
  -- Supprimer l'ancienne contrainte si elle existe
  ALTER TABLE lease_signers DROP CONSTRAINT IF EXISTS lease_signers_role_check;
  
  -- Ajouter la nouvelle contrainte
  ALTER TABLE lease_signers ADD CONSTRAINT lease_signers_role_check 
  CHECK (role IN ('proprietaire', 'locataire_principal', 'colocataire', 'garant'));
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Contrainte lease_signers_role_check existe déjà';
END $$;

-- ============================================
-- Logs de la migration
-- ============================================
DO $$
DECLARE
  owner_count INTEGER;
  tenant_count INTEGER;
  cotenant_count INTEGER;
  garant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO owner_count FROM lease_signers WHERE role = 'proprietaire';
  SELECT COUNT(*) INTO tenant_count FROM lease_signers WHERE role = 'locataire_principal';
  SELECT COUNT(*) INTO cotenant_count FROM lease_signers WHERE role = 'colocataire';
  SELECT COUNT(*) INTO garant_count FROM lease_signers WHERE role = 'garant';
  
  RAISE NOTICE '=== Migration SSOT 2026 terminée ===';
  RAISE NOTICE 'Signataires propriétaires: %', owner_count;
  RAISE NOTICE 'Signataires locataires principaux: %', tenant_count;
  RAISE NOTICE 'Signataires colocataires: %', cotenant_count;
  RAISE NOTICE 'Signataires garants: %', garant_count;
END $$;



-- ========== 20260108100000_fix_depot_garantie_auto.sql ==========
-- ============================================
-- MIGRATION: Correction automatique des dépôts de garantie
-- ============================================
-- Cette migration recalcule les dépôts de garantie pour tous les baux
-- où le dépôt dépasse le maximum légal.
--
-- Règles légales:
-- - Bail nu: max 1 mois de loyer
-- - Bail meublé/colocation: max 2 mois de loyer
-- - Bail mobilité: 0€ (interdit)
-- ============================================

-- 1. Corriger les baux nus avec dépôt > 1 mois
UPDATE leases
SET depot_de_garantie = loyer
WHERE type_bail = 'nu'
  AND depot_de_garantie > loyer
  AND loyer > 0;

-- 2. Corriger les baux meublés avec dépôt > 2 mois
UPDATE leases
SET depot_de_garantie = loyer * 2
WHERE type_bail IN ('meuble', 'colocation', 'saisonnier')
  AND depot_de_garantie > (loyer * 2)
  AND loyer > 0;

-- 3. Corriger les baux mobilité avec dépôt > 0
UPDATE leases
SET depot_de_garantie = 0
WHERE type_bail = 'mobilite'
  AND depot_de_garantie > 0;

-- 4. Log du résultat
DO $$
DECLARE
  total_fixed INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_fixed FROM leases;
  RAISE NOTICE 'Migration terminée. Baux vérifiés: %', total_fixed;
END $$;

-- 5. Vérification finale: aucun dépôt ne doit dépasser le max légal
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM leases
  WHERE 
    (type_bail = 'nu' AND depot_de_garantie > loyer AND loyer > 0)
    OR (type_bail IN ('meuble', 'colocation', 'saisonnier') AND depot_de_garantie > loyer * 2 AND loyer > 0)
    OR (type_bail = 'mobilite' AND depot_de_garantie > 0);
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'ATTENTION: % baux ont encore un dépôt invalide', invalid_count;
  ELSE
    RAISE NOTICE '✅ Tous les dépôts sont conformes au maximum légal';
  END IF;
END $$;



-- ========== 20260108200000_tenant_notification_triggers.sql ==========
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



-- ========== 20260108300000_property_soft_delete.sql ==========
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



-- ========== 20260108400000_lease_lifecycle_sota2026.sql ==========
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



-- ========== 20260108500000_orphan_cleanup_sota2026.sql ==========
-- ============================================
-- MIGRATION SOTA 2026: Nettoyage données orphelines
-- et cascade complète pour suppression de baux
-- ============================================
-- Cette migration:
-- 1. Nettoie toutes les données orphelines existantes
-- 2. Ajoute des triggers pour cascade complète
-- 3. Corrige les incohérences dans la BDD
-- ============================================

-- ============================================
-- PARTIE 1: NETTOYAGE DES DONNÉES ORPHELINES
-- ============================================

-- 1.1 Supprimer les lease_signers orphelins (bail supprimé)
DELETE FROM lease_signers
WHERE lease_id NOT IN (SELECT id FROM leases);

-- 1.2 Supprimer les invoices orphelines (bail supprimé)
DELETE FROM invoices
WHERE lease_id NOT IN (SELECT id FROM leases);

-- 1.3 Supprimer les documents avec lease_id invalide
DELETE FROM documents
WHERE lease_id IS NOT NULL 
  AND lease_id NOT IN (SELECT id FROM leases);

-- 1.4 Supprimer les documents avec property_id invalide
DELETE FROM documents
WHERE property_id IS NOT NULL 
  AND property_id NOT IN (SELECT id FROM properties);

-- 1.5 Supprimer les documents avec tenant_id invalide
DELETE FROM documents
WHERE tenant_id IS NOT NULL 
  AND tenant_id NOT IN (SELECT id FROM profiles);

-- 1.6 Supprimer les roommates orphelins
DELETE FROM roommates
WHERE lease_id NOT IN (SELECT id FROM leases);

-- 1.7 Supprimer les EDL orphelins
DELETE FROM edl
WHERE lease_id NOT IN (SELECT id FROM leases);

-- 1.8 Supprimer les tickets avec lease_id invalide
UPDATE tickets
SET lease_id = NULL
WHERE lease_id IS NOT NULL 
  AND lease_id NOT IN (SELECT id FROM leases);

-- 1.9 Supprimer les deposit_movements orphelins
DELETE FROM deposit_movements
WHERE lease_id NOT IN (SELECT id FROM leases);

-- 1.10 Supprimer les rent_calls orphelins
DELETE FROM rent_calls
WHERE lease_id NOT IN (SELECT id FROM leases);

-- 1.11 Supprimer les charge_regularizations orphelines
DELETE FROM charge_regularizations
WHERE lease_id NOT IN (SELECT id FROM leases);

-- 1.12 Supprimer les lease_events orphelins
DELETE FROM lease_events
WHERE lease_id NOT IN (SELECT id FROM leases);

-- 1.13 Supprimer les insurance_policies orphelines
DELETE FROM insurance_policies
WHERE lease_id NOT IN (SELECT id FROM leases);

-- 1.14 Supprimer les otp_codes orphelins
DELETE FROM otp_codes
WHERE lease_id IS NOT NULL 
  AND lease_id NOT IN (SELECT id FROM leases);

-- 1.15 Supprimer les notifications liées à des baux supprimés
DELETE FROM notifications
WHERE related_type = 'lease'
  AND related_id IS NOT NULL
  AND related_id::UUID NOT IN (SELECT id FROM leases);

-- ============================================
-- PARTIE 2: TRIGGER CASCADE COMPLÈTE
-- ============================================

-- 2.1 Fonction pour supprimer TOUS les documents liés à un bail
-- (même ceux liés via tenant_id ou property_id mais concernant ce bail)
CREATE OR REPLACE FUNCTION cascade_delete_lease_documents()
RETURNS TRIGGER AS $$
DECLARE
  v_property_id UUID;
  v_tenant_ids UUID[];
  v_deleted_count INTEGER := 0;
BEGIN
  -- Récupérer le property_id du bail
  v_property_id := OLD.property_id;
  
  -- Récupérer tous les tenant_ids des signataires du bail
  SELECT ARRAY_AGG(DISTINCT profile_id) INTO v_tenant_ids
  FROM lease_signers
  WHERE lease_id = OLD.id
    AND role IN ('locataire_principal', 'colocataire');

  -- Supprimer les documents directement liés au bail
  DELETE FROM documents WHERE lease_id = OLD.id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Supprimer les documents de type bail pour cette propriété créés pendant la période du bail
  DELETE FROM documents 
  WHERE property_id = v_property_id
    AND type IN ('bail', 'EDL_entree', 'EDL_sortie', 'quittance')
    AND created_at >= OLD.date_debut
    AND (OLD.date_fin IS NULL OR created_at <= OLD.date_fin + INTERVAL '1 month')
    AND lease_id IS NULL; -- Documents pas déjà liés à un bail spécifique
  
  GET DIAGNOSTICS v_deleted_count = v_deleted_count + ROW_COUNT;
  
  -- Log pour audit
  RAISE NOTICE 'Cascade delete pour bail %: % documents supprimés', OLD.id, v_deleted_count;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2.2 Trigger BEFORE DELETE pour nettoyer les documents
DROP TRIGGER IF EXISTS trg_cascade_delete_lease_documents ON leases;
CREATE TRIGGER trg_cascade_delete_lease_documents
  BEFORE DELETE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION cascade_delete_lease_documents();

-- 2.3 Fonction pour nettoyer les EDL et leurs éléments
CREATE OR REPLACE FUNCTION cascade_delete_lease_edl()
RETURNS TRIGGER AS $$
DECLARE
  v_edl_ids UUID[];
BEGIN
  -- Récupérer tous les EDL du bail
  SELECT ARRAY_AGG(id) INTO v_edl_ids
  FROM edl
  WHERE lease_id = OLD.id;
  
  IF v_edl_ids IS NOT NULL AND array_length(v_edl_ids, 1) > 0 THEN
    -- Supprimer les items d'EDL
    DELETE FROM edl_items WHERE edl_id = ANY(v_edl_ids);
    
    -- Supprimer les médias d'EDL
    DELETE FROM edl_media WHERE edl_id = ANY(v_edl_ids);
    
    -- Supprimer les signatures d'EDL
    DELETE FROM edl_signatures WHERE edl_id = ANY(v_edl_ids);
    
    -- Supprimer les EDL eux-mêmes
    DELETE FROM edl WHERE id = ANY(v_edl_ids);
    
    RAISE NOTICE 'Cascade delete EDL pour bail %: % EDL supprimés', OLD.id, array_length(v_edl_ids, 1);
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2.4 Trigger BEFORE DELETE pour nettoyer les EDL
DROP TRIGGER IF EXISTS trg_cascade_delete_lease_edl ON leases;
CREATE TRIGGER trg_cascade_delete_lease_edl
  BEFORE DELETE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION cascade_delete_lease_edl();

-- 2.5 Fonction pour nettoyer les paiements liés aux factures du bail
CREATE OR REPLACE FUNCTION cascade_delete_lease_payments()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_ids UUID[];
BEGIN
  -- Récupérer tous les invoice_ids du bail
  SELECT ARRAY_AGG(id) INTO v_invoice_ids
  FROM invoices
  WHERE lease_id = OLD.id;
  
  IF v_invoice_ids IS NOT NULL AND array_length(v_invoice_ids, 1) > 0 THEN
    -- Supprimer les paiements liés
    DELETE FROM payments WHERE invoice_id = ANY(v_invoice_ids);
    
    RAISE NOTICE 'Cascade delete payments pour bail %: factures concernées %', OLD.id, array_length(v_invoice_ids, 1);
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2.6 Trigger BEFORE DELETE pour nettoyer les paiements
DROP TRIGGER IF EXISTS trg_cascade_delete_lease_payments ON leases;
CREATE TRIGGER trg_cascade_delete_lease_payments
  BEFORE DELETE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION cascade_delete_lease_payments();

-- ============================================
-- PARTIE 3: CORRECTION DES INCOHÉRENCES
-- ============================================

-- 3.1 Corriger les baux sans signataires (ajouter un warning)
DO $$
DECLARE
  v_orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphan_count
  FROM leases l
  WHERE NOT EXISTS (
    SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id
  )
  AND l.statut NOT IN ('draft', 'cancelled', 'archived');
  
  IF v_orphan_count > 0 THEN
    RAISE WARNING '⚠️ % baux sans signataires détectés (hors brouillons)', v_orphan_count;
  END IF;
END $$;

-- 3.2 Corriger les factures avec montants incohérents
UPDATE invoices
SET montant_total = montant_loyer + montant_charges
WHERE montant_total != montant_loyer + montant_charges;

-- 3.3 Corriger les baux avec dépôt de garantie supérieur au légal
UPDATE leases
SET depot_de_garantie = CASE
  WHEN type_bail = 'nu' THEN loyer
  WHEN type_bail IN ('meuble', 'colocation', 'saisonnier') THEN loyer * 2
  WHEN type_bail = 'mobilite' THEN 0
  ELSE loyer
END
WHERE depot_de_garantie > CASE
  WHEN type_bail = 'nu' THEN loyer
  WHEN type_bail IN ('meuble', 'colocation', 'saisonnier') THEN loyer * 2
  WHEN type_bail = 'mobilite' THEN 0
  ELSE loyer
END;

-- 3.4 Corriger les signataires avec rôles non standardisés
UPDATE lease_signers
SET role = 'proprietaire'
WHERE LOWER(TRIM(role)) IN ('owner', 'bailleur')
  AND role != 'proprietaire';

UPDATE lease_signers
SET role = 'locataire_principal'
WHERE LOWER(TRIM(role)) IN ('locataire', 'tenant', 'principal')
  AND role != 'locataire_principal';

UPDATE lease_signers
SET role = 'colocataire'
WHERE LOWER(TRIM(role)) IN ('co_locataire', 'cotenant')
  AND role != 'colocataire';

UPDATE lease_signers
SET role = 'garant'
WHERE LOWER(TRIM(role)) IN ('caution', 'guarantor')
  AND role != 'garant';

-- 3.5 Mettre à jour les statuts de baux incohérents
-- Baux "pending_signature" où tous ont signé → fully_signed
UPDATE leases l
SET statut = 'fully_signed'
WHERE l.statut = 'pending_signature'
  AND NOT EXISTS (
    SELECT 1 FROM lease_signers ls
    WHERE ls.lease_id = l.id
      AND ls.signature_status != 'signed'
  )
  AND EXISTS (
    SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id
  );

-- ============================================
-- PARTIE 4: VUES POUR MONITORING
-- ============================================

-- 4.1 Vue des données orphelines (pour monitoring continu)
CREATE OR REPLACE VIEW orphan_data_monitor AS
SELECT 
  'documents_without_lease' AS type,
  COUNT(*) AS count,
  'Documents avec lease_id invalide' AS description
FROM documents
WHERE lease_id IS NOT NULL 
  AND lease_id NOT IN (SELECT id FROM leases)

UNION ALL

SELECT 
  'documents_without_property',
  COUNT(*),
  'Documents avec property_id invalide'
FROM documents
WHERE property_id IS NOT NULL 
  AND property_id NOT IN (SELECT id FROM properties)

UNION ALL

SELECT 
  'leases_without_signers',
  COUNT(*),
  'Baux actifs sans signataires'
FROM leases
WHERE statut NOT IN ('draft', 'cancelled', 'archived')
  AND id NOT IN (SELECT DISTINCT lease_id FROM lease_signers)

UNION ALL

SELECT 
  'invoices_orphaned',
  COUNT(*),
  'Factures avec bail supprimé'
FROM invoices
WHERE lease_id NOT IN (SELECT id FROM leases)

UNION ALL

SELECT 
  'deposit_inconsistent',
  COUNT(*),
  'Baux avec dépôt > maximum légal'
FROM leases
WHERE depot_de_garantie > CASE
  WHEN type_bail = 'nu' THEN loyer
  WHEN type_bail IN ('meuble', 'colocation', 'saisonnier') THEN loyer * 2
  WHEN type_bail = 'mobilite' THEN 0
  ELSE loyer
END;

-- ============================================
-- PARTIE 5: FONCTION DE NETTOYAGE PÉRIODIQUE
-- ============================================

-- Fonction à appeler périodiquement (via cron ou manuellement)
CREATE OR REPLACE FUNCTION run_orphan_cleanup()
RETURNS TABLE(
  cleanup_type TEXT,
  records_deleted INTEGER
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Documents orphelins
  DELETE FROM documents
  WHERE lease_id IS NOT NULL 
    AND lease_id NOT IN (SELECT id FROM leases);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  cleanup_type := 'documents_lease';
  records_deleted := v_count;
  RETURN NEXT;

  -- Documents sans propriété
  DELETE FROM documents
  WHERE property_id IS NOT NULL 
    AND property_id NOT IN (SELECT id FROM properties);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  cleanup_type := 'documents_property';
  records_deleted := v_count;
  RETURN NEXT;

  -- Notifications obsolètes (> 90 jours, lues)
  DELETE FROM notifications
  WHERE is_read = true
    AND created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  cleanup_type := 'notifications_old';
  records_deleted := v_count;
  RETURN NEXT;

  -- OTP codes expirés
  DELETE FROM otp_codes
  WHERE expires_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  cleanup_type := 'otp_expired';
  records_deleted := v_count;
  RETURN NEXT;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PARTIE 6: FONCTIONS RPC POUR L'API
-- ============================================

-- 6.1 Compter les documents orphelins (lease_id invalide)
CREATE OR REPLACE FUNCTION count_orphan_documents_lease()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM documents d
    WHERE d.lease_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.2 Compter les documents orphelins (property_id invalide)
CREATE OR REPLACE FUNCTION count_orphan_documents_property()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM documents d
    WHERE d.property_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.3 Compter les factures orphelines
CREATE OR REPLACE FUNCTION count_orphan_invoices()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM invoices i
    WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.4 Compter les signataires orphelins
CREATE OR REPLACE FUNCTION count_orphan_signers()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM lease_signers ls
    WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.5 Compter les baux sans signataires
CREATE OR REPLACE FUNCTION count_leases_without_signers()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM leases l
    WHERE l.statut NOT IN ('draft', 'cancelled', 'archived')
      AND NOT EXISTS (SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.6 Compter les dépôts incohérents
CREATE OR REPLACE FUNCTION count_inconsistent_deposits()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM leases
    WHERE depot_de_garantie > CASE
      WHEN type_bail = 'nu' THEN loyer
      WHEN type_bail IN ('meuble', 'colocation', 'saisonnier') THEN loyer * 2
      WHEN type_bail = 'mobilite' THEN 0
      ELSE loyer
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.7 Corriger les dépôts incohérents
CREATE OR REPLACE FUNCTION fix_inconsistent_deposits()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE leases
  SET depot_de_garantie = CASE
    WHEN type_bail = 'nu' THEN loyer
    WHEN type_bail IN ('meuble', 'colocation', 'saisonnier') THEN loyer * 2
    WHEN type_bail = 'mobilite' THEN 0
    ELSE loyer
  END
  WHERE depot_de_garantie > CASE
    WHEN type_bail = 'nu' THEN loyer
    WHEN type_bail IN ('meuble', 'colocation', 'saisonnier') THEN loyer * 2
    WHEN type_bail = 'mobilite' THEN 0
    ELSE loyer
  END;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- LOGS DE MIGRATION
-- ============================================
DO $$
DECLARE
  v_doc_orphans INTEGER;
  v_invoice_orphans INTEGER;
  v_signer_orphans INTEGER;
BEGIN
  -- Compter ce qui a été nettoyé
  SELECT COUNT(*) INTO v_doc_orphans FROM documents WHERE lease_id NOT IN (SELECT id FROM leases WHERE TRUE);
  SELECT COUNT(*) INTO v_invoice_orphans FROM invoices WHERE lease_id NOT IN (SELECT id FROM leases WHERE TRUE);
  SELECT COUNT(*) INTO v_signer_orphans FROM lease_signers WHERE lease_id NOT IN (SELECT id FROM leases WHERE TRUE);

  RAISE NOTICE '=== Migration SOTA 2026 - Nettoyage orphelins ===';
  RAISE NOTICE '✅ Triggers cascade créés pour suppression baux';
  RAISE NOTICE '✅ Vue monitoring orphan_data_monitor créée';
  RAISE NOTICE '✅ Fonction run_orphan_cleanup() disponible';
  RAISE NOTICE '✅ Corrections incohérences appliquées';
END $$;



-- ========== 20260108600000_security_enhancements.sql ==========
-- ============================================
-- MIGRATION: Améliorations de sécurité SOTA 2026
-- ============================================
-- 
-- Cette migration ajoute:
-- 1. Colonnes pour IBAN chiffré dans owner_profiles
-- 2. Table audit_log améliorée avec niveaux de risque
-- 3. Contraintes 2FA pour les rôles sensibles
-- 4. Index pour les recherches sécurisées
--
-- Date: 2026-01-08
-- Auteur: Security Enhancement
-- ============================================

-- ============================================
-- 1. IBAN CHIFFRÉ POUR PROPRIÉTAIRES
-- ============================================

-- Ajouter colonnes pour IBAN chiffré
ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS iban_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS iban_hash TEXT,
  ADD COLUMN IF NOT EXISTS iban_last4 TEXT;

-- Index pour recherche par hash (sans déchiffrement)
CREATE INDEX IF NOT EXISTS idx_owner_profiles_iban_hash 
  ON owner_profiles(iban_hash);

-- Commentaires de documentation
COMMENT ON COLUMN owner_profiles.iban_encrypted IS 'IBAN chiffré avec AES-256-GCM (format: iv:tag:ciphertext)';
COMMENT ON COLUMN owner_profiles.iban_hash IS 'Hash SHA-256 de l''IBAN normalisé pour recherche';
COMMENT ON COLUMN owner_profiles.iban_last4 IS '4 derniers caractères de l''IBAN pour affichage';

-- ============================================
-- 2. TABLE AUDIT_LOG AMÉLIORÉE
-- ============================================

-- Créer ou recréer la table audit_log avec tous les champs
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  profile_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  ip_address INET,
  user_agent TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  metadata JSONB DEFAULT '{}'::jsonb,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_risk_level ON audit_log(risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Index composite pour recherches combinées
CREATE INDEX IF NOT EXISTS idx_audit_log_user_action 
  ON audit_log(user_id, action, created_at DESC);

-- Partitionnement mensuel recommandé pour les logs volumineux
-- (À activer en production si volume > 1M lignes/mois)

-- Commentaires
COMMENT ON TABLE audit_log IS 'Journal d''audit pour traçabilité des accès aux données sensibles (RGPD Art. 30)';
COMMENT ON COLUMN audit_log.risk_level IS 'Niveau de risque: low, medium, high, critical';
COMMENT ON COLUMN audit_log.metadata IS 'Données contextuelles additionnelles (JSON)';

-- ============================================
-- 3. COLONNES 2FA AMÉLIORÉES
-- ============================================

-- S'assurer que les colonnes 2FA existent
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[],
  ADD COLUMN IF NOT EXISTS last_2fa_verified_at TIMESTAMPTZ;

-- Index pour requêtes 2FA
CREATE INDEX IF NOT EXISTS idx_profiles_2fa_required 
  ON profiles(two_factor_required) WHERE two_factor_required = true;

-- Commentaires
COMMENT ON COLUMN profiles.two_factor_required IS 'Si true, l''utilisateur DOIT activer le 2FA';
COMMENT ON COLUMN profiles.two_factor_backup_codes IS 'Codes de secours chiffrés pour récupération 2FA';
COMMENT ON COLUMN profiles.last_2fa_verified_at IS 'Dernière vérification 2FA réussie';

-- ============================================
-- 4. FONCTION: FORCER 2FA POUR ADMINS
-- ============================================

-- Trigger pour forcer 2FA sur les admins
CREATE OR REPLACE FUNCTION enforce_2fa_for_sensitive_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Les admins doivent avoir 2FA requis
  IF NEW.role = 'admin' THEN
    NEW.two_factor_required := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger si non existant
DROP TRIGGER IF EXISTS trigger_enforce_2fa_sensitive_roles ON profiles;
CREATE TRIGGER trigger_enforce_2fa_sensitive_roles
  BEFORE INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_2fa_for_sensitive_roles();

-- ============================================
-- 5. FONCTION: FORCER 2FA POUR GROS COMPTES
-- ============================================

-- Fonction pour vérifier et activer 2FA requis pour les gros propriétaires
CREATE OR REPLACE FUNCTION check_2fa_requirement_for_property_count()
RETURNS TRIGGER AS $$
DECLARE
  property_count INTEGER;
  owner_profile_id UUID;
BEGIN
  -- Récupérer le profile_id du propriétaire
  owner_profile_id := NEW.owner_id;
  
  -- Compter les biens de ce propriétaire
  SELECT COUNT(*) INTO property_count
  FROM properties
  WHERE owner_id = owner_profile_id
    AND deleted_at IS NULL;
  
  -- Si plus de 5 biens, forcer le 2FA
  IF property_count >= 5 THEN
    UPDATE profiles
    SET two_factor_required = true
    WHERE id = owner_profile_id
      AND two_factor_required = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur ajout de propriété
DROP TRIGGER IF EXISTS trigger_check_2fa_on_property_add ON properties;
CREATE TRIGGER trigger_check_2fa_on_property_add
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION check_2fa_requirement_for_property_count();

-- ============================================
-- 6. RLS POUR AUDIT_LOG
-- ============================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire les logs d'audit
CREATE POLICY "Admins can view all audit logs"
  ON audit_log FOR SELECT
  USING (public.user_role() = 'admin');

-- Les utilisateurs peuvent voir leurs propres logs
CREATE POLICY "Users can view own audit logs"
  ON audit_log FOR SELECT
  USING (user_id = auth.uid());

-- Seul le système peut insérer (via service role)
CREATE POLICY "System can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (true); -- Le service role bypasse RLS

-- ============================================
-- 7. TABLE POUR SESSIONS 2FA
-- ============================================

CREATE TABLE IF NOT EXISTS two_factor_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_2fa_sessions_user_id 
  ON two_factor_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_2fa_sessions_expires_at 
  ON two_factor_sessions(expires_at);

-- Nettoyage automatique des sessions expirées
CREATE OR REPLACE FUNCTION cleanup_expired_2fa_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM two_factor_sessions
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. MIGRATION DES IBAN EXISTANTS
-- ============================================

-- Note: Cette étape doit être exécutée via un script applicatif
-- pour chiffrer les IBAN existants. Voir: scripts/migrate-iban-encryption.ts

-- Marquer les IBAN non migrés
-- UPDATE owner_profiles 
-- SET iban_encrypted = NULL, iban_hash = NULL, iban_last4 = NULL
-- WHERE iban IS NOT NULL AND iban_encrypted IS NULL;

-- ============================================
-- 9. CONTRAINTES SUPPLÉMENTAIRES
-- ============================================

-- Empêcher la désactivation du 2FA pour les comptes qui le requièrent
CREATE OR REPLACE FUNCTION prevent_2fa_disable_if_required()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.two_factor_required = true AND NEW.two_factor_enabled = false AND OLD.two_factor_enabled = true THEN
    RAISE EXCEPTION 'Impossible de désactiver le 2FA car il est requis pour ce compte';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_2fa_disable ON profiles;
CREATE TRIGGER trigger_prevent_2fa_disable
  BEFORE UPDATE OF two_factor_enabled ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_2fa_disable_if_required();

-- ============================================
-- 10. VUE POUR MONITORING SÉCURITÉ
-- ============================================

CREATE OR REPLACE VIEW security_dashboard AS
SELECT 
  COUNT(*) FILTER (WHERE risk_level = 'critical' AND created_at > NOW() - INTERVAL '24 hours') as critical_events_24h,
  COUNT(*) FILTER (WHERE risk_level = 'high' AND created_at > NOW() - INTERVAL '24 hours') as high_events_24h,
  COUNT(*) FILTER (WHERE action = 'failed_login' AND created_at > NOW() - INTERVAL '1 hour') as failed_logins_1h,
  COUNT(*) FILTER (WHERE entity_type = 'iban' AND action = 'decrypt' AND created_at > NOW() - INTERVAL '24 hours') as iban_decrypts_24h,
  COUNT(DISTINCT user_id) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as active_users_24h
FROM audit_log;

COMMENT ON VIEW security_dashboard IS 'Vue récapitulative pour le monitoring de sécurité';

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================

-- Log de fin
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260108600000_security_enhancements terminée avec succès';
END $$;



-- ========== 20260109000000_fix_property_deleted_at.sql ==========
-- ============================================
-- MIGRATION: Fix deleted_at column for properties
-- ============================================
-- 
-- Cette migration s'assure que la colonne deleted_at existe
-- dans la table properties (requise par le trigger de sécurité)
--
-- Date: 2026-01-09
-- ============================================

-- Ajouter la colonne deleted_at si elle n'existe pas
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Créer l'index pour les requêtes filtrées
CREATE INDEX IF NOT EXISTS idx_properties_deleted_at 
  ON properties(deleted_at) WHERE deleted_at IS NULL;

-- Index pour le soft delete
CREATE INDEX IF NOT EXISTS idx_properties_active 
  ON properties(owner_id, deleted_at) WHERE deleted_at IS NULL;

-- Commentaires
COMMENT ON COLUMN properties.deleted_at IS 'Date de suppression soft (NULL = actif)';
COMMENT ON COLUMN properties.deleted_by IS 'Profile qui a supprimé le bien';

-- ============================================
-- FIN
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20260109000000_fix_property_deleted_at terminée';
END $$;



-- ========== 20260109100000_signature_tracking_enhanced.sql ==========
-- Migration: Amélioration du tracking des signatures
-- Date: 2026-01-09
-- Description: Vue agrégée et fonctions pour le suivi des signatures mensuelles
-- Compatible avec subscription_usage existante

BEGIN;

-- ============================================
-- VUE AGRÉGÉE: Signatures par mois et subscription
-- ============================================

CREATE OR REPLACE VIEW signature_usage_monthly AS
SELECT
  su.subscription_id,
  su.period_month,
  COALESCE(SUM(su.quantity), 0)::INTEGER as signatures_used,
  COUNT(*)::INTEGER as signature_events,
  MAX(su.created_at) as last_signature_at
FROM subscription_usage su
WHERE su.usage_type = 'signature'
GROUP BY su.subscription_id, su.period_month;

-- ============================================
-- FONCTION: Obtenir usage signatures du mois courant
-- ============================================

CREATE OR REPLACE FUNCTION get_signature_usage(p_subscription_id UUID)
RETURNS TABLE (
  signatures_used INTEGER,
  signatures_limit INTEGER,
  signatures_remaining INTEGER,
  usage_percentage INTEGER,
  period_month TEXT,
  last_signature_at TIMESTAMPTZ
) AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
  v_last_at TIMESTAMPTZ;
BEGIN
  -- Récupérer l'usage du mois courant
  SELECT
    COALESCE(SUM(quantity), 0)::INTEGER,
    MAX(created_at)
  INTO v_used, v_last_at
  FROM subscription_usage
  WHERE subscription_id = p_subscription_id
    AND usage_type = 'signature'
    AND period_month = v_current_month;

  -- Récupérer la limite du plan
  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  -- Si pas de limite trouvée, utiliser 0
  v_limit := COALESCE(v_limit, 0);
  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    v_used,
    v_limit,
    CASE WHEN v_limit = -1 THEN 999999 ELSE GREATEST(0, v_limit - v_used) END,
    CASE
      WHEN v_limit = -1 THEN 0
      WHEN v_limit = 0 THEN 100
      ELSE LEAST(100, (v_used * 100) / NULLIF(v_limit, 0))
    END::INTEGER,
    v_current_month,
    v_last_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- FONCTION: Incrémenter l'usage des signatures
-- ============================================

CREATE OR REPLACE FUNCTION increment_signature_usage(
  p_subscription_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Vérifier la limite avant d'incrémenter
  SELECT
    COALESCE(SUM(quantity), 0)::INTEGER
  INTO v_used
  FROM subscription_usage
  WHERE subscription_id = p_subscription_id
    AND usage_type = 'signature'
    AND period_month = v_current_month;

  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  -- Si limite atteinte et pas illimité, retourner false
  IF v_limit != -1 AND (COALESCE(v_used, 0) + p_quantity) > v_limit THEN
    RETURN false;
  END IF;

  -- Insérer l'usage
  INSERT INTO subscription_usage (
    subscription_id,
    usage_type,
    quantity,
    period_month,
    metadata
  ) VALUES (
    p_subscription_id,
    'signature',
    p_quantity,
    v_current_month,
    p_metadata
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FONCTION: Vérifier si une signature est possible
-- ============================================

CREATE OR REPLACE FUNCTION can_use_signature(p_subscription_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Récupérer l'usage actuel
  SELECT COALESCE(SUM(quantity), 0)::INTEGER
  INTO v_used
  FROM subscription_usage
  WHERE subscription_id = p_subscription_id
    AND usage_type = 'signature'
    AND period_month = v_current_month;

  -- Récupérer la limite
  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  -- -1 = illimité
  IF v_limit = -1 THEN
    RETURN true;
  END IF;

  RETURN v_used < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- FONCTION: Obtenir usage par owner_id (plus pratique)
-- ============================================

CREATE OR REPLACE FUNCTION get_signature_usage_by_owner(p_owner_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  signatures_used INTEGER,
  signatures_limit INTEGER,
  signatures_remaining INTEGER,
  usage_percentage INTEGER,
  period_month TEXT,
  last_signature_at TIMESTAMPTZ,
  can_sign BOOLEAN
) AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  -- Trouver la subscription de ce owner
  SELECT id INTO v_sub_id
  FROM subscriptions
  WHERE owner_id = p_owner_id
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    -- Pas de subscription, retourner des valeurs par défaut (plan gratuit)
    RETURN QUERY SELECT
      NULL::UUID,
      0::INTEGER,
      0::INTEGER,  -- Plan gratuit = 0 signatures incluses
      0::INTEGER,
      0::INTEGER,
      TO_CHAR(NOW(), 'YYYY-MM'),
      NULL::TIMESTAMPTZ,
      false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_sub_id,
    su.signatures_used,
    su.signatures_limit,
    su.signatures_remaining,
    su.usage_percentage,
    su.period_month,
    su.last_signature_at,
    (su.signatures_limit = -1 OR su.signatures_used < su.signatures_limit)
  FROM get_signature_usage(v_sub_id) su;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- INDEX pour performances
-- ============================================

CREATE INDEX IF NOT EXISTS idx_subscription_usage_signatures
  ON subscription_usage(subscription_id, period_month)
  WHERE usage_type = 'signature';

-- ============================================
-- MISE À JOUR subscription_plans: ajouter signatures_monthly_quota si manquant
-- ============================================

-- Mettre à jour les plans pour avoir signatures_monthly_quota dans features
UPDATE subscription_plans
SET features = features || jsonb_build_object('signatures_monthly_quota',
  CASE slug
    WHEN 'gratuit' THEN 0
    WHEN 'starter' THEN 0
    WHEN 'confort' THEN 2
    WHEN 'pro' THEN 10
    WHEN 'enterprise_s' THEN 25
    WHEN 'enterprise_m' THEN 40
    WHEN 'enterprise_l' THEN 60
    WHEN 'enterprise_xl' THEN -1
    WHEN 'enterprise' THEN -1
    ELSE 0
  END
)
WHERE NOT (features ? 'signatures_monthly_quota');

COMMIT;


-- ========== 20260110000000_admin_dashboard_sota2026.sql ==========
-- ============================================================================
-- ADMIN DASHBOARD SOTA 2026 - Migration complète
-- Modération IA-First, Comptabilité avancée, Suivi forfaits intelligent
-- ============================================================================

-- ============================================================================
-- 1. TABLE: moderation_rules - Règles de modération IA-First
-- ============================================================================
CREATE TABLE IF NOT EXISTS moderation_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    flow_type VARCHAR(50) NOT NULL CHECK (flow_type IN ('profile', 'message', 'document', 'listing', 'payment', 'review')),

    -- Configuration IA
    ai_enabled BOOLEAN DEFAULT true,
    ai_model VARCHAR(100) DEFAULT 'gpt-4-turbo',
    ai_threshold DECIMAL(3,2) DEFAULT 0.75 CHECK (ai_threshold BETWEEN 0 AND 1),

    -- Règles JSON
    rule_config JSONB NOT NULL DEFAULT '{}',
    -- Exemple: {"keywords": ["spam", "arnaque"], "patterns": ["\\b\\d{10}\\b"], "severity": "high"}

    -- Actions automatiques
    auto_action VARCHAR(50) DEFAULT 'flag' CHECK (auto_action IN ('flag', 'quarantine', 'reject', 'escalate', 'notify')),
    escalation_delay_hours INTEGER DEFAULT 24,
    notify_admin BOOLEAN DEFAULT true,

    -- Métriques
    total_triggered INTEGER DEFAULT 0,
    total_false_positives INTEGER DEFAULT 0,
    accuracy_rate DECIMAL(5,2) DEFAULT 100.00,

    -- Statut
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_moderation_rules_flow_type ON moderation_rules(flow_type);
CREATE INDEX IF NOT EXISTS idx_moderation_rules_active ON moderation_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_moderation_rules_priority ON moderation_rules(priority DESC);

-- ============================================================================
-- 2. TABLE: moderation_queue - File d'attente de modération IA
-- ============================================================================
CREATE TABLE IF NOT EXISTS moderation_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Entité concernée
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('profile', 'property', 'lease', 'message', 'document', 'review', 'payment')),
    entity_id UUID NOT NULL,

    -- Règle déclenchée
    rule_id UUID REFERENCES moderation_rules(id) ON DELETE SET NULL,

    -- Scoring IA
    ai_score DECIMAL(5,4) CHECK (ai_score BETWEEN 0 AND 1),
    ai_reasoning TEXT,
    ai_suggested_action VARCHAR(50),

    -- Contenu détecté
    flagged_content TEXT,
    matched_patterns JSONB DEFAULT '[]',

    -- Workflow
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'escalated', 'auto_resolved')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

    -- Modérateur
    assigned_to UUID REFERENCES auth.users(id),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Actions prises
    action_taken VARCHAR(50),
    action_metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_priority ON moderation_queue(priority);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_entity ON moderation_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_assigned ON moderation_queue(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_moderation_queue_created ON moderation_queue(created_at DESC);

-- ============================================================================
-- 3. TABLE: admin_revenue_metrics - Métriques revenus réelles (pas simulées!)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_revenue_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    period_date DATE NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),

    -- Loyers
    total_rent_expected DECIMAL(12,2) DEFAULT 0,
    total_rent_collected DECIMAL(12,2) DEFAULT 0,
    rent_collection_rate DECIMAL(5,2) DEFAULT 0,

    -- Charges
    total_charges_expected DECIMAL(12,2) DEFAULT 0,
    total_charges_collected DECIMAL(12,2) DEFAULT 0,

    -- Impayés
    total_unpaid DECIMAL(12,2) DEFAULT 0,
    unpaid_count INTEGER DEFAULT 0,
    avg_days_late DECIMAL(5,2) DEFAULT 0,

    -- Abonnements plateforme
    subscription_revenue DECIMAL(12,2) DEFAULT 0,
    subscription_count INTEGER DEFAULT 0,
    churn_rate DECIMAL(5,2) DEFAULT 0,

    -- Commissions
    commission_revenue DECIMAL(12,2) DEFAULT 0,

    -- Métriques occupation
    total_properties INTEGER DEFAULT 0,
    occupied_properties INTEGER DEFAULT 0,
    occupancy_rate DECIMAL(5,2) DEFAULT 0,

    -- Timestamps
    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(period_date, period_type)
);

-- Index pour requêtes temporelles
CREATE INDEX IF NOT EXISTS idx_revenue_metrics_date ON admin_revenue_metrics(period_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_metrics_period ON admin_revenue_metrics(period_type, period_date DESC);

-- ============================================================================
-- 4. TABLE: subscription_usage_metrics - Suivi utilisation forfaits
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_usage_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    plan_id VARCHAR(50) NOT NULL,

    -- Période
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Utilisation
    properties_count INTEGER DEFAULT 0,
    properties_limit INTEGER DEFAULT 0,
    tenants_count INTEGER DEFAULT 0,
    tenants_limit INTEGER DEFAULT 0,
    documents_count INTEGER DEFAULT 0,
    documents_limit INTEGER DEFAULT 0,
    api_calls_count INTEGER DEFAULT 0,
    api_calls_limit INTEGER DEFAULT 0,
    storage_used_mb DECIMAL(10,2) DEFAULT 0,
    storage_limit_mb DECIMAL(10,2) DEFAULT 0,

    -- Alertes
    is_near_limit BOOLEAN DEFAULT false,
    limit_warnings JSONB DEFAULT '[]',

    -- Recommandations IA
    ai_upgrade_suggestion VARCHAR(50),
    ai_suggestion_reason TEXT,
    ai_potential_savings DECIMAL(10,2),

    -- Timestamps
    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(owner_id, period_start, period_end)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_usage_metrics_owner ON subscription_usage_metrics(owner_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_period ON subscription_usage_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_near_limit ON subscription_usage_metrics(is_near_limit) WHERE is_near_limit = true;

-- ============================================================================
-- 5. TABLE: admin_accounting_entries - Écritures comptables détaillées
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_accounting_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Compte
    account_code VARCHAR(20) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),

    -- Écriture
    entry_date DATE NOT NULL,
    entry_type VARCHAR(50) NOT NULL,
    reference VARCHAR(100),
    description TEXT,

    -- Montants
    debit DECIMAL(12,2) DEFAULT 0,
    credit DECIMAL(12,2) DEFAULT 0,
    balance DECIMAL(12,2) DEFAULT 0,

    -- Relations
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,

    -- Statut
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID REFERENCES auth.users(id),

    -- FEC (Format Échange Comptable)
    fec_journal_code VARCHAR(10),
    fec_piece_ref VARCHAR(50),
    fec_piece_date DATE,
    fec_echeance DATE,
    fec_lettrage VARCHAR(10),
    fec_date_lettrage DATE,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour grand livre et requêtes
CREATE INDEX IF NOT EXISTS idx_accounting_entries_date ON admin_accounting_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_account ON admin_accounting_entries(account_code);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_property ON admin_accounting_entries(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_entries_reconciled ON admin_accounting_entries(is_reconciled) WHERE is_reconciled = false;

-- ============================================================================
-- 6. FONCTION RPC: admin_dashboard_stats_v2 - Stats dashboard avec vraies données
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_dashboard_stats_v2()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    current_month_start DATE := date_trunc('month', CURRENT_DATE);
    previous_month_start DATE := date_trunc('month', CURRENT_DATE - INTERVAL '1 month');
BEGIN
    SELECT json_build_object(
        -- Utilisateurs
        'totalUsers', (SELECT COUNT(*) FROM profiles),
        'usersByRole', (
            SELECT json_build_object(
                'admin', COUNT(*) FILTER (WHERE role = 'admin'),
                'owner', COUNT(*) FILTER (WHERE role = 'owner'),
                'tenant', COUNT(*) FILTER (WHERE role = 'tenant'),
                'provider', COUNT(*) FILTER (WHERE role = 'provider')
            ) FROM profiles
        ),
        'newUsersThisMonth', (SELECT COUNT(*) FROM profiles WHERE created_at >= current_month_start),
        'newUsersPrevMonth', (SELECT COUNT(*) FROM profiles WHERE created_at >= previous_month_start AND created_at < current_month_start),

        -- Propriétés
        'totalProperties', (SELECT COUNT(*) FROM properties WHERE deleted_at IS NULL),
        'propertiesByStatus', (
            SELECT json_build_object(
                'active', COUNT(*) FILTER (WHERE status = 'active'),
                'rented', COUNT(*) FILTER (WHERE status = 'rented'),
                'draft', COUNT(*) FILTER (WHERE status = 'draft'),
                'archived', COUNT(*) FILTER (WHERE status = 'archived')
            ) FROM properties WHERE deleted_at IS NULL
        ),

        -- Baux
        'totalLeases', (SELECT COUNT(*) FROM leases),
        'activeLeases', (SELECT COUNT(*) FROM leases WHERE status = 'active'),
        'leasesByStatus', (
            SELECT json_build_object(
                'active', COUNT(*) FILTER (WHERE status = 'active'),
                'pending_signature', COUNT(*) FILTER (WHERE status = 'pending_signature'),
                'draft', COUNT(*) FILTER (WHERE status = 'draft'),
                'terminated', COUNT(*) FILTER (WHERE status IN ('terminated', 'expired'))
            ) FROM leases
        ),

        -- Factures
        'totalInvoices', (SELECT COUNT(*) FROM invoices),
        'unpaidInvoices', (SELECT COUNT(*) FROM invoices WHERE status IN ('sent', 'late', 'unpaid')),
        'invoicesByStatus', (
            SELECT json_build_object(
                'paid', COUNT(*) FILTER (WHERE status = 'paid'),
                'sent', COUNT(*) FILTER (WHERE status = 'sent'),
                'late', COUNT(*) FILTER (WHERE status = 'late'),
                'draft', COUNT(*) FILTER (WHERE status = 'draft')
            ) FROM invoices
        ),

        -- Tickets
        'totalTickets', (SELECT COUNT(*) FROM tickets),
        'openTickets', (SELECT COUNT(*) FROM tickets WHERE status IN ('open', 'in_progress')),
        'ticketsByStatus', (
            SELECT json_build_object(
                'open', COUNT(*) FILTER (WHERE status = 'open'),
                'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
                'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
                'closed', COUNT(*) FILTER (WHERE status = 'closed')
            ) FROM tickets
        ),

        -- Revenus mensuels (12 derniers mois - VRAIES DONNÉES)
        'monthlyRevenue', (
            SELECT COALESCE(json_agg(row_to_json(m) ORDER BY m.month_date), '[]'::json)
            FROM (
                SELECT
                    to_char(date_trunc('month', due_date), 'Mon') as month,
                    date_trunc('month', due_date) as month_date,
                    SUM(amount) as attendu,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as encaisse
                FROM invoices
                WHERE due_date >= CURRENT_DATE - INTERVAL '12 months'
                GROUP BY date_trunc('month', due_date)
                ORDER BY date_trunc('month', due_date)
            ) m
        ),

        -- Tendances (évolution sur 7 derniers jours)
        'trends', json_build_object(
            'users', (
                SELECT json_agg(COALESCE(c, 0) ORDER BY d)
                FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') d
                LEFT JOIN (
                    SELECT DATE(created_at) as date, COUNT(*) as c
                    FROM profiles
                    WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
                    GROUP BY DATE(created_at)
                ) p ON p.date = d
            ),
            'properties', (
                SELECT json_agg(COALESCE(c, 0) ORDER BY d)
                FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') d
                LEFT JOIN (
                    SELECT DATE(created_at) as date, COUNT(*) as c
                    FROM properties
                    WHERE created_at >= CURRENT_DATE - INTERVAL '6 days' AND deleted_at IS NULL
                    GROUP BY DATE(created_at)
                ) p ON p.date = d
            ),
            'leases', (
                SELECT json_agg(COALESCE(c, 0) ORDER BY d)
                FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') d
                LEFT JOIN (
                    SELECT DATE(created_at) as date, COUNT(*) as c
                    FROM leases
                    WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
                    GROUP BY DATE(created_at)
                ) p ON p.date = d
            )
        ),

        -- Taux de performance
        'occupancyRate', (
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE status = 'rented')::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 1
            )
            FROM properties WHERE deleted_at IS NULL AND status IN ('active', 'rented')
        ),
        'collectionRate', (
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE status = 'paid')::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 1
            )
            FROM invoices
            WHERE due_date >= CURRENT_DATE - INTERVAL '3 months'
        ),

        -- Documents et contenu
        'totalDocuments', (SELECT COUNT(*) FROM documents),
        'totalBlogPosts', (SELECT COUNT(*) FROM blog_posts),
        'publishedBlogPosts', (SELECT COUNT(*) FROM blog_posts WHERE is_published = true),

        -- Modération
        'moderationPending', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending'),
        'moderationCritical', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending' AND priority = 'critical'),

        -- Abonnements
        'subscriptionStats', (
            SELECT json_build_object(
                'total', COUNT(*),
                'active', COUNT(*) FILTER (WHERE status = 'active'),
                'trial', COUNT(*) FILTER (WHERE status = 'trialing'),
                'churned', COUNT(*) FILTER (WHERE status = 'canceled')
            ) FROM subscriptions
        ),

        -- Activité récente (vraies données)
        'recentActivity', (
            SELECT COALESCE(json_agg(activity ORDER BY activity.date DESC), '[]'::json)
            FROM (
                SELECT 'user' as type,
                       CONCAT('Nouvel utilisateur: ', prenom, ' ', nom) as description,
                       created_at as date
                FROM profiles
                ORDER BY created_at DESC
                LIMIT 3

                UNION ALL

                SELECT 'property' as type,
                       CONCAT('Nouveau bien: ', COALESCE(adresse_complete, 'Adresse non définie')) as description,
                       created_at as date
                FROM properties
                WHERE deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT 3

                UNION ALL

                SELECT 'lease' as type,
                       'Nouveau bail créé' as description,
                       created_at as date
                FROM leases
                ORDER BY created_at DESC
                LIMIT 2

                LIMIT 8
            ) activity
        )

    ) INTO result;

    RETURN result;
END;
$$;

-- ============================================================================
-- 7. FONCTION RPC: get_moderation_stats - Stats de modération
-- ============================================================================
CREATE OR REPLACE FUNCTION get_moderation_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN json_build_object(
        'pending', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending'),
        'reviewing', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'reviewing'),
        'approved', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'approved' AND created_at >= CURRENT_DATE - INTERVAL '30 days'),
        'rejected', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'rejected' AND created_at >= CURRENT_DATE - INTERVAL '30 days'),
        'escalated', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'escalated'),
        'byPriority', json_build_object(
            'critical', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending' AND priority = 'critical'),
            'high', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending' AND priority = 'high'),
            'medium', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending' AND priority = 'medium'),
            'low', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending' AND priority = 'low')
        ),
        'byType', (
            SELECT json_object_agg(entity_type, cnt)
            FROM (
                SELECT entity_type, COUNT(*) as cnt
                FROM moderation_queue
                WHERE status = 'pending'
                GROUP BY entity_type
            ) t
        ),
        'rulesActive', (SELECT COUNT(*) FROM moderation_rules WHERE is_active = true),
        'avgResolutionHours', (
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600), 1)
            FROM moderation_queue
            WHERE reviewed_at IS NOT NULL AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        )
    );
END;
$$;

-- ============================================================================
-- 8. FONCTION RPC: get_accounting_summary - Résumé comptable
-- ============================================================================
CREATE OR REPLACE FUNCTION get_accounting_summary(
    p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '1 year'),
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN json_build_object(
        'period', json_build_object('start', p_start_date, 'end', p_end_date),

        -- Totaux
        'totals', (
            SELECT json_build_object(
                'revenue', COALESCE(SUM(CASE WHEN account_type = 'revenue' THEN credit - debit END), 0),
                'expenses', COALESCE(SUM(CASE WHEN account_type = 'expense' THEN debit - credit END), 0),
                'assets', COALESCE(SUM(CASE WHEN account_type = 'asset' THEN balance END), 0),
                'liabilities', COALESCE(SUM(CASE WHEN account_type = 'liability' THEN balance END), 0)
            )
            FROM admin_accounting_entries
            WHERE entry_date BETWEEN p_start_date AND p_end_date
        ),

        -- Par mois
        'byMonth', (
            SELECT COALESCE(json_agg(row_to_json(m) ORDER BY m.month), '[]'::json)
            FROM (
                SELECT
                    to_char(entry_date, 'YYYY-MM') as month,
                    SUM(CASE WHEN account_type = 'revenue' THEN credit - debit ELSE 0 END) as revenue,
                    SUM(CASE WHEN account_type = 'expense' THEN debit - credit ELSE 0 END) as expenses
                FROM admin_accounting_entries
                WHERE entry_date BETWEEN p_start_date AND p_end_date
                GROUP BY to_char(entry_date, 'YYYY-MM')
            ) m
        ),

        -- Non rapprochées
        'unreconciled', (
            SELECT json_build_object(
                'count', COUNT(*),
                'totalDebit', COALESCE(SUM(debit), 0),
                'totalCredit', COALESCE(SUM(credit), 0)
            )
            FROM admin_accounting_entries
            WHERE is_reconciled = false
        ),

        -- Top 10 comptes par volume
        'topAccounts', (
            SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json)
            FROM (
                SELECT
                    account_code,
                    account_name,
                    SUM(debit) as total_debit,
                    SUM(credit) as total_credit,
                    COUNT(*) as entries_count
                FROM admin_accounting_entries
                WHERE entry_date BETWEEN p_start_date AND p_end_date
                GROUP BY account_code, account_name
                ORDER BY SUM(debit) + SUM(credit) DESC
                LIMIT 10
            ) a
        )
    );
END;
$$;

-- ============================================================================
-- 9. TRIGGER: Mise à jour automatique updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer aux nouvelles tables
DROP TRIGGER IF EXISTS set_updated_at_moderation_rules ON moderation_rules;
CREATE TRIGGER set_updated_at_moderation_rules
    BEFORE UPDATE ON moderation_rules
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_moderation_queue ON moderation_queue;
CREATE TRIGGER set_updated_at_moderation_queue
    BEFORE UPDATE ON moderation_queue
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- 10. RLS Policies
-- ============================================================================

-- Moderation Rules - Admin only
ALTER TABLE moderation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage moderation rules" ON moderation_rules;
CREATE POLICY "Admin can manage moderation rules" ON moderation_rules
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Moderation Queue - Admin only
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage moderation queue" ON moderation_queue;
CREATE POLICY "Admin can manage moderation queue" ON moderation_queue
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Revenue Metrics - Admin only
ALTER TABLE admin_revenue_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view revenue metrics" ON admin_revenue_metrics;
CREATE POLICY "Admin can view revenue metrics" ON admin_revenue_metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Accounting Entries - Admin only
ALTER TABLE admin_accounting_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage accounting entries" ON admin_accounting_entries;
CREATE POLICY "Admin can manage accounting entries" ON admin_accounting_entries
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Subscription Usage - Admin and Owner
ALTER TABLE subscription_usage_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view all usage metrics" ON subscription_usage_metrics;
CREATE POLICY "Admin can view all usage metrics" ON subscription_usage_metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Owner can view own usage metrics" ON subscription_usage_metrics;
CREATE POLICY "Owner can view own usage metrics" ON subscription_usage_metrics
    FOR SELECT
    USING (
        owner_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- 11. Données initiales pour les règles de modération
-- ============================================================================
INSERT INTO moderation_rules (name, description, flow_type, ai_enabled, ai_threshold, rule_config, auto_action, priority)
VALUES
    (
        'Détection spam profils',
        'Détecte les profils suspects avec liens ou contenu spam',
        'profile',
        true,
        0.80,
        '{"keywords": ["http://", "https://", "gagnez", "gratuit", "cliquez"], "maxLinks": 2, "minNameLength": 2}',
        'quarantine',
        90
    ),
    (
        'Vérification documents',
        'Analyse automatique des documents d''identité',
        'document',
        true,
        0.85,
        '{"requiredFields": ["nom", "prenom", "date_naissance"], "checkExpiry": true, "ocrEnabled": true}',
        'flag',
        85
    ),
    (
        'Modération annonces',
        'Vérifie la conformité des annonces immobilières',
        'listing',
        true,
        0.75,
        '{"bannedWords": ["arnaque", "urgent cash"], "requirePhotos": true, "minDescription": 50}',
        'flag',
        80
    ),
    (
        'Détection fraude paiement',
        'Surveille les patterns de paiement suspects',
        'payment',
        true,
        0.90,
        '{"maxAmountAlert": 50000, "frequencyCheck": true, "geoCheck": true}',
        'escalate',
        95
    )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- GRANT permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON moderation_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON moderation_queue TO authenticated;
GRANT SELECT ON admin_revenue_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_accounting_entries TO authenticated;
GRANT SELECT ON subscription_usage_metrics TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE moderation_rules IS 'Règles de modération IA-First pour le dashboard admin SOTA 2026';
COMMENT ON TABLE moderation_queue IS 'File d''attente de modération avec scoring IA';
COMMENT ON TABLE admin_revenue_metrics IS 'Métriques revenus calculées (vraies données, pas simulées)';
COMMENT ON TABLE subscription_usage_metrics IS 'Suivi utilisation des forfaits par propriétaire';
COMMENT ON TABLE admin_accounting_entries IS 'Écritures comptables détaillées format FEC';


-- ========== 20260110000001_accounting_tables.sql ==========
-- ============================================================================
-- MIGRATION: Tables Comptabilité Complètes
-- Date: 2026-01-10
-- Description: Ajoute les tables nécessaires pour une comptabilité complète
-- ============================================================================

-- ============================================================================
-- 1. TABLE: accounting_journals (Journaux comptables)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(4) NOT NULL UNIQUE,
  libelle VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les journaux par défaut
INSERT INTO public.accounting_journals (code, libelle, description) VALUES
  ('VE', 'Ventes', 'Facturation des honoraires de gestion'),
  ('AC', 'Achats', 'Factures fournisseurs et prestataires'),
  ('BQ', 'Banque Agence', 'Mouvements du compte courant agence'),
  ('BM', 'Banque Mandant', 'Mouvements du compte mandant'),
  ('OD', 'Opérations Diverses', 'Régularisations et écritures diverses'),
  ('AN', 'À Nouveau', 'Report à nouveau des soldes')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. TABLE: accounting_accounts (Plan comptable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(10) NOT NULL UNIQUE,
  libelle VARCHAR(255) NOT NULL,
  classe INTEGER NOT NULL CHECK (classe BETWEEN 1 AND 9),
  sens VARCHAR(10) CHECK (sens IN ('debit', 'credit', 'mixte')),
  is_active BOOLEAN DEFAULT true,
  parent_numero VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les comptes principaux
INSERT INTO public.accounting_accounts (numero, libelle, classe, sens) VALUES
  -- Classe 4 - Tiers
  ('401000', 'Fournisseurs', 4, 'credit'),
  ('411000', 'Clients', 4, 'debit'),
  ('421000', 'Personnel - Rémunérations dues', 4, 'credit'),
  ('445710', 'TVA collectée', 4, 'credit'),
  ('445660', 'TVA déductible sur ABS', 4, 'debit'),
  ('467000', 'Autres comptes débiteurs ou créditeurs', 4, 'mixte'),
  ('467100', 'Propriétaires - Comptes mandants', 4, 'credit'),
  ('467200', 'Locataires - Comptes mandants', 4, 'debit'),
  ('467300', 'Dépôts de garantie reçus', 4, 'credit'),
  -- Classe 5 - Financiers
  ('512000', 'Banque compte courant', 5, 'debit'),
  ('545000', 'Banque compte mandant', 5, 'debit'),
  ('530000', 'Caisse', 5, 'debit'),
  -- Classe 6 - Charges
  ('606100', 'Fournitures non stockables', 6, 'debit'),
  ('613500', 'Locations mobilières (SaaS)', 6, 'debit'),
  ('616000', 'Primes d''assurance', 6, 'debit'),
  ('622600', 'Honoraires comptables', 6, 'debit'),
  ('626000', 'Frais postaux et télécommunications', 6, 'debit'),
  ('627100', 'Frais bancaires', 6, 'debit'),
  -- Classe 7 - Produits
  ('706000', 'Prestations de services', 7, 'credit'),
  ('706100', 'Honoraires de gestion locative', 7, 'credit'),
  ('706200', 'Honoraires de mise en location', 7, 'credit'),
  ('706300', 'Honoraires d''état des lieux', 7, 'credit')
ON CONFLICT (numero) DO NOTHING;

-- ============================================================================
-- 3. TABLE: accounting_entries (Écritures comptables)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  journal_code VARCHAR(4) NOT NULL REFERENCES public.accounting_journals(code),
  ecriture_num VARCHAR(30) NOT NULL,
  ecriture_date DATE NOT NULL,

  -- Compte
  compte_num VARCHAR(10) NOT NULL,
  compte_lib VARCHAR(255) NOT NULL,
  compte_aux_num VARCHAR(20),
  compte_aux_lib VARCHAR(255),

  -- Pièce
  piece_ref VARCHAR(50) NOT NULL,
  piece_date DATE NOT NULL,

  -- Montants
  ecriture_lib VARCHAR(255) NOT NULL,
  debit DECIMAL(15, 2) NOT NULL DEFAULT 0,
  credit DECIMAL(15, 2) NOT NULL DEFAULT 0,

  -- Lettrage
  ecriture_let VARCHAR(10),
  date_let DATE,

  -- Validation
  valid_date DATE,

  -- Devise
  montant_devise DECIMAL(15, 2) DEFAULT 0,
  idevise VARCHAR(3) DEFAULT 'EUR',

  -- Métadonnées
  owner_id UUID REFERENCES public.profiles(id),
  property_id UUID REFERENCES public.properties(id),
  invoice_id UUID REFERENCES public.invoices(id),
  payment_id UUID REFERENCES public.payments(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Contraintes
  CONSTRAINT check_debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)
  )
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_accounting_entries_journal ON public.accounting_entries(journal_code);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_date ON public.accounting_entries(ecriture_date);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_compte ON public.accounting_entries(compte_num);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_piece ON public.accounting_entries(piece_ref);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_owner ON public.accounting_entries(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_invoice ON public.accounting_entries(invoice_id);

-- ============================================================================
-- 4. TABLE: mandant_accounts (Comptes mandants individuels)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.mandant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  account_number VARCHAR(20) NOT NULL UNIQUE,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('proprietaire', 'locataire')),

  -- Liens
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  property_id UUID REFERENCES public.properties(id),

  -- Soldes
  solde_debit DECIMAL(15, 2) DEFAULT 0,
  solde_credit DECIMAL(15, 2) DEFAULT 0,
  solde_net DECIMAL(15, 2) GENERATED ALWAYS AS (solde_credit - solde_debit) STORED,

  -- Dates
  last_movement_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT unique_mandant_profile_property UNIQUE (profile_id, property_id, account_type)
);

CREATE INDEX IF NOT EXISTS idx_mandant_accounts_profile ON public.mandant_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_mandant_accounts_type ON public.mandant_accounts(account_type);

-- ============================================================================
-- 5. TABLE: charge_regularisations (Régularisation des charges)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.charge_regularisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  lease_id UUID NOT NULL REFERENCES public.leases(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id),

  -- Période
  annee INTEGER NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,

  -- Montants
  provisions_versees DECIMAL(15, 2) NOT NULL DEFAULT 0,
  charges_reelles DECIMAL(15, 2) NOT NULL DEFAULT 0,
  solde DECIMAL(15, 2) GENERATED ALWAYS AS (charges_reelles - provisions_versees) STORED,

  -- Détail charges
  detail_charges JSONB DEFAULT '[]',

  -- Statut
  statut VARCHAR(20) DEFAULT 'draft' CHECK (statut IN ('draft', 'sent', 'paid', 'disputed', 'cancelled')),

  -- Dates
  date_emission DATE,
  date_echeance DATE,
  date_paiement DATE,

  -- Ajustement
  nouvelle_provision DECIMAL(15, 2),
  date_effet_nouvelle_provision DATE,

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_regularisation_lease_annee UNIQUE (lease_id, annee)
);

CREATE INDEX IF NOT EXISTS idx_charge_regularisations_lease ON public.charge_regularisations(lease_id);
CREATE INDEX IF NOT EXISTS idx_charge_regularisations_annee ON public.charge_regularisations(annee);

-- ============================================================================
-- 6. TABLE: deposit_operations (Opérations sur dépôts de garantie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.deposit_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  lease_id UUID NOT NULL REFERENCES public.leases(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id),
  owner_id UUID NOT NULL REFERENCES public.profiles(id),

  -- Type d'opération
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('reception', 'restitution', 'retenue', 'complement')),

  -- Montants
  montant DECIMAL(15, 2) NOT NULL,

  -- Pour les retenues
  motif_retenue TEXT,
  detail_retenues JSONB DEFAULT '[]',

  -- Références
  payment_id UUID REFERENCES public.payments(id),
  edl_sortie_id UUID,

  -- Dates
  date_operation DATE NOT NULL,
  date_limite_restitution DATE,

  -- Statut
  statut VARCHAR(20) DEFAULT 'pending' CHECK (statut IN ('pending', 'completed', 'disputed', 'cancelled')),

  -- Documents
  documents JSONB DEFAULT '[]',

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_deposit_operations_lease ON public.deposit_operations(lease_id);
CREATE INDEX IF NOT EXISTS idx_deposit_operations_tenant ON public.deposit_operations(tenant_id);

-- ============================================================================
-- 7. TABLE: bank_reconciliations (Rapprochements bancaires)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Période
  periode VARCHAR(7) NOT NULL, -- YYYY-MM
  date_reconciliation DATE NOT NULL,

  -- Compte
  compte_type VARCHAR(20) NOT NULL CHECK (compte_type IN ('agence', 'mandant')),

  -- Soldes
  solde_banque DECIMAL(15, 2) NOT NULL,
  solde_comptable DECIMAL(15, 2) NOT NULL,
  ecart DECIMAL(15, 2) GENERATED ALWAYS AS (solde_banque - solde_comptable) STORED,

  -- Détail
  operations_non_pointees JSONB DEFAULT '[]',

  -- Statut
  statut VARCHAR(20) DEFAULT 'draft' CHECK (statut IN ('draft', 'validated', 'locked')),
  is_balanced BOOLEAN GENERATED ALWAYS AS (ABS(solde_banque - solde_comptable) < 0.01) STORED,

  -- Validation
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_reconciliation_periode_compte UNIQUE (periode, compte_type)
);

-- ============================================================================
-- 8. FONCTION: Enregistrer une écriture comptable
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_accounting_entry(
  p_journal_code VARCHAR(4),
  p_compte_num VARCHAR(10),
  p_compte_lib VARCHAR(255),
  p_piece_ref VARCHAR(50),
  p_ecriture_lib VARCHAR(255),
  p_debit DECIMAL(15, 2),
  p_credit DECIMAL(15, 2),
  p_owner_id UUID DEFAULT NULL,
  p_property_id UUID DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_payment_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_entry_id UUID;
  v_ecriture_num VARCHAR(30);
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Générer le numéro d'écriture
  v_ecriture_num := p_journal_code || '-' || TO_CHAR(v_today, 'YYYY') || '-' ||
    LPAD(COALESCE(
      (SELECT COUNT(*) + 1 FROM public.accounting_entries
       WHERE journal_code = p_journal_code
       AND EXTRACT(YEAR FROM ecriture_date) = EXTRACT(YEAR FROM v_today))::TEXT,
      '1'
    ), 6, '0');

  -- Insérer l'écriture
  INSERT INTO public.accounting_entries (
    journal_code, ecriture_num, ecriture_date,
    compte_num, compte_lib,
    piece_ref, piece_date,
    ecriture_lib, debit, credit,
    owner_id, property_id, invoice_id, payment_id
  ) VALUES (
    p_journal_code, v_ecriture_num, v_today,
    p_compte_num, p_compte_lib,
    p_piece_ref, v_today,
    p_ecriture_lib, p_debit, p_credit,
    p_owner_id, p_property_id, p_invoice_id, p_payment_id
  ) RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. FONCTION: Mettre à jour le solde mandant
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_mandant_balance(
  p_profile_id UUID,
  p_property_id UUID,
  p_account_type VARCHAR(20),
  p_debit DECIMAL(15, 2) DEFAULT 0,
  p_credit DECIMAL(15, 2) DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_account_number VARCHAR(20);
BEGIN
  -- Générer le numéro de compte
  v_account_number := CASE p_account_type
    WHEN 'proprietaire' THEN '4671' || UPPER(SUBSTRING(p_profile_id::TEXT, 1, 5))
    WHEN 'locataire' THEN '4672' || UPPER(SUBSTRING(p_profile_id::TEXT, 1, 5))
  END;

  -- Upsert le compte mandant
  INSERT INTO public.mandant_accounts (
    account_number, account_type, profile_id, property_id,
    solde_debit, solde_credit, last_movement_at
  ) VALUES (
    v_account_number, p_account_type, p_profile_id, p_property_id,
    p_debit, p_credit, NOW()
  )
  ON CONFLICT (profile_id, property_id, account_type) DO UPDATE SET
    solde_debit = public.mandant_accounts.solde_debit + p_debit,
    solde_credit = public.mandant_accounts.solde_credit + p_credit,
    last_movement_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_account_id;

  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. RLS Policies
-- ============================================================================

-- accounting_entries
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all entries" ON public.accounting_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Owners can view their entries" ON public.accounting_entries
  FOR SELECT TO authenticated
  USING (
    owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert entries" ON public.accounting_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- mandant_accounts
ALTER TABLE public.mandant_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all mandant accounts" ON public.mandant_accounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view their own mandant account" ON public.mandant_accounts
  FOR SELECT TO authenticated
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- charge_regularisations
ALTER TABLE public.charge_regularisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage regularisations" ON public.charge_regularisations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Tenants can view their regularisations" ON public.charge_regularisations
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- deposit_operations
ALTER TABLE public.deposit_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage deposits" ON public.deposit_operations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Owners can view their deposit operations" ON public.deposit_operations
  FOR SELECT TO authenticated
  USING (
    owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenants can view their deposit operations" ON public.deposit_operations
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- bank_reconciliations
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only for reconciliations" ON public.bank_reconciliations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 11. Triggers pour mise à jour automatique
-- ============================================================================

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mandant_accounts_updated_at
  BEFORE UPDATE ON public.mandant_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_charge_regularisations_updated_at
  BEFORE UPDATE ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deposit_operations_updated_at
  BEFORE UPDATE ON public.deposit_operations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_reconciliations_updated_at
  BEFORE UPDATE ON public.bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================


-- ========== 20260110000001_passkeys_and_2fa_sota.sql ==========
-- Migration: Passkeys (WebAuthn) et 2FA SOTA 2026
-- Date: 2026-01-10
-- Description: Ajoute le support des Passkeys et améliore le système 2FA

-- =============================================================================
-- TABLE: passkey_credentials
-- Stocke les credentials WebAuthn des utilisateurs
-- =============================================================================
CREATE TABLE IF NOT EXISTS passkey_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL CHECK (device_type IN ('singleDevice', 'multiDevice')),
  backed_up BOOLEAN NOT NULL DEFAULT false,
  transports TEXT[] DEFAULT '{}',
  friendly_name TEXT DEFAULT 'Ma passkey',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour lookup rapide par user_id et credential_id
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_id ON passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_credential_id ON passkey_credentials(credential_id);

-- =============================================================================
-- TABLE: passkey_challenges
-- Stocke les challenges WebAuthn temporaires
-- =============================================================================
CREATE TABLE IF NOT EXISTS passkey_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour nettoyage des challenges expirés
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_expires_at ON passkey_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_user_type ON passkey_challenges(user_id, type);

-- =============================================================================
-- TABLE: user_2fa
-- Configuration 2FA améliorée avec recovery codes
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_2fa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  totp_secret TEXT,
  recovery_codes JSONB DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT false,
  pending_activation BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour lookup rapide
CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON user_2fa(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_enabled ON user_2fa(enabled) WHERE enabled = true;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkey_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;

-- Policies pour passkey_credentials
CREATE POLICY "Users can view their own passkeys"
  ON passkey_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own passkeys"
  ON passkey_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own passkeys"
  ON passkey_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own passkeys"
  ON passkey_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Policy service-role pour passkey_challenges (géré côté serveur)
CREATE POLICY "Service role full access to challenges"
  ON passkey_challenges FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policies pour user_2fa
CREATE POLICY "Users can view their own 2FA config"
  ON user_2fa FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own 2FA config"
  ON user_2fa FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own 2FA config"
  ON user_2fa FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger pour updated_at sur passkey_credentials
CREATE OR REPLACE FUNCTION update_passkey_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_passkey_credentials_updated_at ON passkey_credentials;
CREATE TRIGGER trigger_passkey_credentials_updated_at
  BEFORE UPDATE ON passkey_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_passkey_credentials_updated_at();

-- Trigger pour updated_at sur user_2fa
CREATE OR REPLACE FUNCTION update_user_2fa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_2fa_updated_at ON user_2fa;
CREATE TRIGGER trigger_user_2fa_updated_at
  BEFORE UPDATE ON user_2fa
  FOR EACH ROW
  EXECUTE FUNCTION update_user_2fa_updated_at();

-- =============================================================================
-- CLEANUP FUNCTION
-- Nettoie les challenges expirés (à appeler via cron)
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_passkey_challenges()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM passkey_challenges
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE passkey_credentials IS 'Stocke les credentials WebAuthn (Passkeys) des utilisateurs - SOTA 2026';
COMMENT ON TABLE passkey_challenges IS 'Stocke les challenges WebAuthn temporaires pour registration/authentication';
COMMENT ON TABLE user_2fa IS 'Configuration 2FA TOTP avec recovery codes - SOTA 2026';

COMMENT ON COLUMN passkey_credentials.device_type IS 'singleDevice = clé physique, multiDevice = passkey synchronisée (iCloud, Google)';
COMMENT ON COLUMN passkey_credentials.backed_up IS 'true si la passkey est synchronisée dans le cloud';
COMMENT ON COLUMN user_2fa.recovery_codes IS 'Array JSON de {code, used, used_at}';


-- ========== 20260110100000_fix_accounting_schema_gaps.sql ==========
-- ============================================================================
-- MIGRATION: Correction des écarts entre services et schéma DB
-- Date: 2026-01-10
-- Description: Aligne le schéma avec les attentes des services comptables
-- ============================================================================

-- ============================================================================
-- 1. TABLE charges - Ajouter colonnes manquantes
-- ============================================================================

-- Ajouter libelle si non existant
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS libelle TEXT;

-- Ajouter quote_part (pourcentage récupérable sur le locataire)
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS quote_part DECIMAL(5, 2) DEFAULT 100.00
  CHECK (quote_part >= 0 AND quote_part <= 100);

-- Ajouter date_debut pour prorata
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS date_debut DATE;

-- Ajouter date_fin pour prorata
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS date_fin DATE;

-- Commenter les colonnes
COMMENT ON COLUMN public.charges.libelle IS 'Libellé descriptif de la charge (ex: "Eau froide et chaude")';
COMMENT ON COLUMN public.charges.quote_part IS 'Pourcentage récupérable sur le locataire (0-100)';
COMMENT ON COLUMN public.charges.date_debut IS 'Date de début d''application de la charge';
COMMENT ON COLUMN public.charges.date_fin IS 'Date de fin d''application de la charge (null = en cours)';

-- ============================================================================
-- 2. TABLE leases - Ajouter tenant_id direct
-- ============================================================================

-- Ajouter tenant_id direct pour simplifier les requêtes
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON public.leases(tenant_id);

-- Commenter la colonne
COMMENT ON COLUMN public.leases.tenant_id IS 'ID du locataire principal (dénormalisé depuis lease_signers)';

-- ============================================================================
-- 3. Backfill tenant_id depuis lease_signers
-- ============================================================================

-- Peupler tenant_id depuis lease_signers (locataire_principal seulement)
UPDATE public.leases l
SET tenant_id = (
  SELECT ls.profile_id
  FROM public.lease_signers ls
  WHERE ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'locataire')
  ORDER BY ls.created_at ASC
  LIMIT 1
)
WHERE l.tenant_id IS NULL;

-- ============================================================================
-- 4. TABLE charge_regularisations - Corriger noms colonnes
-- ============================================================================

-- La table existe déjà avec des noms français, ajouter des alias anglais
-- pour compatibilité avec le service

-- Ajouter colonnes avec noms anglais si pas existants
DO $$
BEGIN
  -- Vérifier si les colonnes anglaises existent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'year'
  ) THEN
    -- Renommer ou ajouter les colonnes
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS year INTEGER;

    -- Copier les données
    UPDATE public.charge_regularisations SET year = annee WHERE year IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'period_start'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS period_start DATE;
    UPDATE public.charge_regularisations SET period_start = date_debut WHERE period_start IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'period_end'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS period_end DATE;
    UPDATE public.charge_regularisations SET period_end = date_fin WHERE period_end IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'provisions_received'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS provisions_received DECIMAL(15, 2) DEFAULT 0;
    UPDATE public.charge_regularisations SET provisions_received = provisions_versees WHERE provisions_received IS NULL OR provisions_received = 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'actual_charges'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS actual_charges DECIMAL(15, 2) DEFAULT 0;
    UPDATE public.charge_regularisations SET actual_charges = charges_reelles WHERE actual_charges IS NULL OR actual_charges = 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'balance'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS balance DECIMAL(15, 2) DEFAULT 0;
    UPDATE public.charge_regularisations SET balance = solde WHERE balance IS NULL OR balance = 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
    UPDATE public.charge_regularisations SET status = statut WHERE status IS NULL OR status = 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'details'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';
    UPDATE public.charge_regularisations SET details = detail_charges WHERE details = '{}' OR details IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'applied_at'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'credit_note_id'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS credit_note_id UUID REFERENCES public.invoices(id);
  END IF;
END $$;

-- Ajouter property_id si manquant
ALTER TABLE public.charge_regularisations
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id);

-- Backfill property_id depuis leases
UPDATE public.charge_regularisations cr
SET property_id = (
  SELECT COALESCE(l.property_id, u.property_id)
  FROM public.leases l
  LEFT JOIN public.units u ON l.unit_id = u.id
  WHERE l.id = cr.lease_id
)
WHERE cr.property_id IS NULL;

-- ============================================================================
-- 5. TABLE invoices - Ajouter champ type et metadata
-- ============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS type VARCHAR(30) DEFAULT 'loyer';

-- Commenter
COMMENT ON COLUMN public.invoices.metadata IS 'Métadonnées additionnelles (type régularisation, etc.)';
COMMENT ON COLUMN public.invoices.type IS 'Type de facture: loyer, regularisation_charges, avoir_regularisation, depot_garantie';

-- ============================================================================
-- 6. TRIGGER: Synchroniser tenant_id depuis lease_signers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_lease_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand un signataire locataire est ajouté, mettre à jour tenant_id du bail
  IF NEW.role IN ('locataire_principal', 'locataire') THEN
    UPDATE public.leases
    SET tenant_id = NEW.profile_id
    WHERE id = NEW.lease_id
      AND tenant_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS trigger_sync_lease_tenant_id ON public.lease_signers;

-- Créer le trigger
CREATE TRIGGER trigger_sync_lease_tenant_id
  AFTER INSERT ON public.lease_signers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lease_tenant_id();

-- ============================================================================
-- 7. TRIGGER: Écritures comptables automatiques sur paiement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_record_payment_entries()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice RECORD;
  v_lease RECORD;
  v_owner_id UUID;
  v_tenant_id UUID;
  v_property_id UUID;
  v_code_postal TEXT;
  v_taux_tva DECIMAL;
  v_honoraires_ht DECIMAL;
  v_tva_montant DECIMAL;
  v_honoraires_ttc DECIMAL;
  v_net_proprietaire DECIMAL;
BEGIN
  -- Ne traiter que les paiements confirmés
  IF NEW.statut != 'succeeded' THEN
    RETURN NEW;
  END IF;

  -- Récupérer les infos de la facture
  SELECT * INTO v_invoice FROM public.invoices WHERE id = NEW.invoice_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Récupérer le bail
  SELECT
    l.*,
    COALESCE(p.id, (SELECT property_id FROM units WHERE id = l.unit_id)) as prop_id,
    COALESCE(p.code_postal, '75000') as code_postal,
    p.owner_id as owner_id
  INTO v_lease
  FROM public.leases l
  LEFT JOIN public.properties p ON l.property_id = p.id
  LEFT JOIN public.units u ON l.unit_id = u.id
  LEFT JOIN public.properties p2 ON u.property_id = p2.id
  WHERE l.id = v_invoice.lease_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_owner_id := v_invoice.owner_id;
  v_tenant_id := v_invoice.tenant_id;
  v_property_id := v_lease.prop_id;
  v_code_postal := v_lease.code_postal;

  -- Calculer TVA selon code postal
  v_taux_tva := CASE
    WHEN v_code_postal LIKE '97%' THEN
      CASE
        WHEN v_code_postal LIKE '973%' OR v_code_postal LIKE '976%' THEN 0.00
        ELSE 0.085
      END
    ELSE 0.20
  END;

  -- Calculer honoraires (7% HT du loyer)
  v_honoraires_ht := ROUND((v_invoice.montant_loyer * 0.07)::NUMERIC, 2);
  v_tva_montant := ROUND((v_honoraires_ht * v_taux_tva)::NUMERIC, 2);
  v_honoraires_ttc := v_honoraires_ht + v_tva_montant;
  v_net_proprietaire := v_invoice.montant_loyer - v_honoraires_ttc;

  -- 1. Écriture: Encaissement locataire → Banque mandant
  PERFORM public.record_accounting_entry(
    'BM', '545000', 'Banque compte mandant',
    COALESCE(NEW.provider_ref, 'PAY-' || NEW.id::TEXT),
    'Encaissement loyer ' || v_invoice.periode,
    NEW.montant, 0,
    v_owner_id, v_property_id, v_invoice.id, NEW.id
  );

  -- 2. Écriture: Crédit compte locataire
  PERFORM public.record_accounting_entry(
    'BM', '467200', 'Locataires - Comptes mandants',
    COALESCE(NEW.provider_ref, 'PAY-' || NEW.id::TEXT),
    'Paiement locataire ' || v_invoice.periode,
    0, NEW.montant,
    v_owner_id, v_property_id, v_invoice.id, NEW.id
  );

  -- 3. Écriture: Honoraires de gestion HT
  PERFORM public.record_accounting_entry(
    'VE', '706100', 'Honoraires de gestion locative',
    'HON-' || v_invoice.periode,
    'Honoraires gestion ' || v_invoice.periode,
    0, v_honoraires_ht,
    v_owner_id, v_property_id, v_invoice.id, NEW.id
  );

  -- 4. Écriture: TVA collectée
  IF v_tva_montant > 0 THEN
    PERFORM public.record_accounting_entry(
      'VE', '445710', 'TVA collectée',
      'HON-' || v_invoice.periode,
      'TVA sur honoraires ' || v_invoice.periode,
      0, v_tva_montant,
      v_owner_id, v_property_id, v_invoice.id, NEW.id
    );
  END IF;

  -- 5. Écriture: Crédit compte propriétaire (net)
  PERFORM public.record_accounting_entry(
    'BM', '467100', 'Propriétaires - Comptes mandants',
    'CRG-' || v_invoice.periode,
    'Net propriétaire ' || v_invoice.periode,
    0, v_net_proprietaire,
    v_owner_id, v_property_id, v_invoice.id, NEW.id
  );

  -- 6. Mettre à jour le solde mandant propriétaire
  PERFORM public.update_mandant_balance(
    v_owner_id, v_property_id, 'proprietaire',
    0, v_net_proprietaire
  );

  -- 7. Mettre à jour le solde mandant locataire
  PERFORM public.update_mandant_balance(
    v_tenant_id, v_property_id, 'locataire',
    0, NEW.montant
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS trigger_auto_payment_entries ON public.payments;

-- Créer le trigger
CREATE TRIGGER trigger_auto_payment_entries
  AFTER INSERT OR UPDATE OF statut ON public.payments
  FOR EACH ROW
  WHEN (NEW.statut = 'succeeded')
  EXECUTE FUNCTION public.auto_record_payment_entries();

-- ============================================================================
-- 8. Contraintes et validations
-- ============================================================================

-- Contrainte pour status charge_regularisations
DO $$
BEGIN
  ALTER TABLE public.charge_regularisations
    DROP CONSTRAINT IF EXISTS charge_regularisations_status_check;

  ALTER TABLE public.charge_regularisations
    ADD CONSTRAINT charge_regularisations_status_check
    CHECK (status IS NULL OR status IN ('draft', 'sent', 'applied', 'paid', 'disputed', 'cancelled'));
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignorer si contrainte existe déjà
END $$;

-- ============================================================================
-- 9. Index supplémentaires pour performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_charges_quote_part ON public.charges(quote_part);
CREATE INDEX IF NOT EXISTS idx_charges_date_debut ON public.charges(date_debut);
CREATE INDEX IF NOT EXISTS idx_charge_regularisations_year ON public.charge_regularisations(year);
CREATE INDEX IF NOT EXISTS idx_charge_regularisations_status ON public.charge_regularisations(status);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(type);

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================


-- ========== 20260110100001_init_historical_accounting_data.sql ==========
-- ============================================================================
-- MIGRATION: Initialisation des données comptables historiques
-- Date: 2026-01-10
-- Description: Initialise deposit_operations et accounting_entries pour les
--              baux et paiements existants
-- ============================================================================

-- ============================================================================
-- 1. Initialiser deposit_operations pour les baux avec dépôt de garantie
-- ============================================================================

INSERT INTO public.deposit_operations (
  lease_id,
  property_id,
  tenant_id,
  owner_id,
  operation_type,
  montant,
  date_operation,
  statut,
  notes
)
SELECT
  l.id as lease_id,
  COALESCE(l.property_id, u.property_id) as property_id,
  l.tenant_id,
  p.owner_id,
  'reception' as operation_type,
  l.depot_de_garantie as montant,
  l.date_debut as date_operation,
  'completed' as statut,
  'Migration automatique - Dépôt de garantie initial' as notes
FROM public.leases l
LEFT JOIN public.units u ON l.unit_id = u.id
LEFT JOIN public.properties p ON COALESCE(l.property_id, u.property_id) = p.id
WHERE l.depot_de_garantie > 0
  AND l.tenant_id IS NOT NULL
  AND l.statut IN ('active', 'terminated')
  AND NOT EXISTS (
    SELECT 1 FROM public.deposit_operations dep
    WHERE dep.lease_id = l.id AND dep.operation_type = 'reception'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. Créer les écritures comptables pour les paiements existants
-- ============================================================================

-- Fonction temporaire pour migrer les paiements
CREATE OR REPLACE FUNCTION public.migrate_historical_payments()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_payment RECORD;
  v_invoice RECORD;
  v_lease RECORD;
  v_property_id UUID;
  v_owner_id UUID;
  v_code_postal TEXT;
  v_taux_tva DECIMAL;
  v_honoraires_ht DECIMAL;
  v_tva_montant DECIMAL;
  v_net_proprietaire DECIMAL;
BEGIN
  -- Parcourir tous les paiements succeeded sans écritures comptables
  FOR v_payment IN
    SELECT pay.*
    FROM public.payments pay
    WHERE pay.statut = 'succeeded'
      AND NOT EXISTS (
        SELECT 1 FROM public.accounting_entries ae
        WHERE ae.payment_id = pay.id
      )
  LOOP
    BEGIN
      -- Récupérer la facture
      SELECT * INTO v_invoice FROM public.invoices WHERE id = v_payment.invoice_id;
      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      -- Récupérer le bail et propriété
      SELECT
        l.*,
        COALESCE(l.property_id, u.property_id) as prop_id,
        COALESCE(p.code_postal, '75000') as code_postal,
        p.owner_id
      INTO v_lease
      FROM public.leases l
      LEFT JOIN public.units u ON l.unit_id = u.id
      LEFT JOIN public.properties p ON COALESCE(l.property_id, u.property_id) = p.id
      WHERE l.id = v_invoice.lease_id;

      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      v_property_id := v_lease.prop_id;
      v_owner_id := v_invoice.owner_id;
      v_code_postal := v_lease.code_postal;

      -- Calculer TVA selon code postal
      v_taux_tva := CASE
        WHEN v_code_postal LIKE '97%' THEN
          CASE
            WHEN v_code_postal LIKE '973%' OR v_code_postal LIKE '976%' THEN 0.00
            ELSE 0.085
          END
        ELSE 0.20
      END;

      -- Calculer honoraires
      v_honoraires_ht := ROUND((v_invoice.montant_loyer * 0.07)::NUMERIC, 2);
      v_tva_montant := ROUND((v_honoraires_ht * v_taux_tva)::NUMERIC, 2);
      v_net_proprietaire := v_invoice.montant_loyer - v_honoraires_ht - v_tva_montant;

      -- Créer les écritures comptables
      -- 1. Encaissement banque mandant
      PERFORM public.record_accounting_entry(
        'BM', '545000', 'Banque compte mandant',
        'MIG-' || v_payment.id::TEXT,
        'Migration - Encaissement ' || v_invoice.periode,
        v_payment.montant, 0,
        v_owner_id, v_property_id, v_invoice.id, v_payment.id
      );

      -- 2. Crédit compte locataire
      PERFORM public.record_accounting_entry(
        'BM', '467200', 'Locataires - Comptes mandants',
        'MIG-' || v_payment.id::TEXT,
        'Migration - Paiement ' || v_invoice.periode,
        0, v_payment.montant,
        v_owner_id, v_property_id, v_invoice.id, v_payment.id
      );

      -- 3. Honoraires HT
      PERFORM public.record_accounting_entry(
        'VE', '706100', 'Honoraires de gestion locative',
        'MIG-HON-' || v_invoice.periode,
        'Migration - Honoraires ' || v_invoice.periode,
        0, v_honoraires_ht,
        v_owner_id, v_property_id, v_invoice.id, v_payment.id
      );

      -- 4. TVA si applicable
      IF v_tva_montant > 0 THEN
        PERFORM public.record_accounting_entry(
          'VE', '445710', 'TVA collectée',
          'MIG-HON-' || v_invoice.periode,
          'Migration - TVA honoraires ' || v_invoice.periode,
          0, v_tva_montant,
          v_owner_id, v_property_id, v_invoice.id, v_payment.id
        );
      END IF;

      -- 5. Net propriétaire
      PERFORM public.record_accounting_entry(
        'BM', '467100', 'Propriétaires - Comptes mandants',
        'MIG-CRG-' || v_invoice.periode,
        'Migration - Net propriétaire ' || v_invoice.periode,
        0, v_net_proprietaire,
        v_owner_id, v_property_id, v_invoice.id, v_payment.id
      );

      -- Mettre à jour les soldes mandants
      PERFORM public.update_mandant_balance(
        v_owner_id, v_property_id, 'proprietaire',
        0, v_net_proprietaire
      );

      IF v_invoice.tenant_id IS NOT NULL THEN
        PERFORM public.update_mandant_balance(
          v_invoice.tenant_id, v_property_id, 'locataire',
          0, v_payment.montant
        );
      END IF;

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Log et continuer en cas d'erreur
      RAISE NOTICE 'Erreur migration paiement %: %', v_payment.id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Exécuter la migration des paiements
DO $$
DECLARE
  v_migrated INTEGER;
BEGIN
  SELECT public.migrate_historical_payments() INTO v_migrated;
  RAISE NOTICE 'Paiements migrés: %', v_migrated;
END $$;

-- Supprimer la fonction temporaire
DROP FUNCTION IF EXISTS public.migrate_historical_payments();

-- ============================================================================
-- 3. Créer les écritures pour les dépôts de garantie
-- ============================================================================

-- Fonction temporaire pour migrer les dépôts
CREATE OR REPLACE FUNCTION public.migrate_historical_deposits()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_deposit RECORD;
BEGIN
  FOR v_deposit IN
    SELECT dep.*
    FROM public.deposit_operations dep
    WHERE dep.operation_type = 'reception'
      AND dep.statut = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM public.accounting_entries ae
        WHERE ae.piece_ref LIKE 'DEP-' || dep.id::TEXT || '%'
      )
  LOOP
    BEGIN
      -- 1. Encaissement banque mandant
      PERFORM public.record_accounting_entry(
        'BM', '545000', 'Banque compte mandant',
        'DEP-' || v_deposit.id::TEXT,
        'Dépôt de garantie - Encaissement',
        v_deposit.montant, 0,
        v_deposit.owner_id, v_deposit.property_id, NULL, NULL
      );

      -- 2. Crédit compte dépôts de garantie
      PERFORM public.record_accounting_entry(
        'BM', '467300', 'Dépôts de garantie reçus',
        'DEP-' || v_deposit.id::TEXT,
        'Dépôt de garantie - Réception',
        0, v_deposit.montant,
        v_deposit.owner_id, v_deposit.property_id, NULL, NULL
      );

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erreur migration dépôt %: %', v_deposit.id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Exécuter la migration des dépôts
DO $$
DECLARE
  v_migrated INTEGER;
BEGIN
  SELECT public.migrate_historical_deposits() INTO v_migrated;
  RAISE NOTICE 'Dépôts migrés: %', v_migrated;
END $$;

-- Supprimer la fonction temporaire
DROP FUNCTION IF EXISTS public.migrate_historical_deposits();

-- ============================================================================
-- 4. Trigger pour nouveaux dépôts de garantie
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_record_deposit_entries()
RETURNS TRIGGER AS $$
BEGIN
  -- Ne traiter que les opérations complétées
  IF NEW.statut != 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.operation_type = 'reception' THEN
    -- Encaissement
    PERFORM public.record_accounting_entry(
      'BM', '545000', 'Banque compte mandant',
      'DEP-' || NEW.id::TEXT,
      'Dépôt de garantie - Encaissement',
      NEW.montant, 0,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );
    PERFORM public.record_accounting_entry(
      'BM', '467300', 'Dépôts de garantie reçus',
      'DEP-' || NEW.id::TEXT,
      'Dépôt de garantie - Réception',
      0, NEW.montant,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );

  ELSIF NEW.operation_type = 'restitution' THEN
    -- Restitution
    PERFORM public.record_accounting_entry(
      'BM', '467300', 'Dépôts de garantie reçus',
      'DEP-REST-' || NEW.id::TEXT,
      'Dépôt de garantie - Restitution',
      NEW.montant, 0,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );
    PERFORM public.record_accounting_entry(
      'BM', '545000', 'Banque compte mandant',
      'DEP-REST-' || NEW.id::TEXT,
      'Dépôt de garantie - Virement restitution',
      0, NEW.montant,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );

  ELSIF NEW.operation_type = 'retenue' THEN
    -- Retenue (transfert vers produits)
    PERFORM public.record_accounting_entry(
      'BM', '467300', 'Dépôts de garantie reçus',
      'DEP-RET-' || NEW.id::TEXT,
      'Dépôt de garantie - Retenue: ' || COALESCE(NEW.motif_retenue, 'Dégradations'),
      NEW.montant, 0,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );
    PERFORM public.record_accounting_entry(
      'OD', '467100', 'Propriétaires - Comptes mandants',
      'DEP-RET-' || NEW.id::TEXT,
      'Indemnisation propriétaire - Retenue dépôt',
      0, NEW.montant,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS trigger_auto_deposit_entries ON public.deposit_operations;

-- Créer le trigger
CREATE TRIGGER trigger_auto_deposit_entries
  AFTER INSERT OR UPDATE OF statut ON public.deposit_operations
  FOR EACH ROW
  WHEN (NEW.statut = 'completed')
  EXECUTE FUNCTION public.auto_record_deposit_entries();

-- ============================================================================
-- 5. Vérification de la migration
-- ============================================================================

DO $$
DECLARE
  v_deposits_count INTEGER;
  v_entries_count INTEGER;
  v_mandant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_deposits_count FROM public.deposit_operations;
  SELECT COUNT(*) INTO v_entries_count FROM public.accounting_entries;
  SELECT COUNT(*) INTO v_mandant_count FROM public.mandant_accounts;

  RAISE NOTICE '=== Résumé Migration Comptabilité ===';
  RAISE NOTICE 'Opérations sur dépôts: %', v_deposits_count;
  RAISE NOTICE 'Écritures comptables: %', v_entries_count;
  RAISE NOTICE 'Comptes mandants: %', v_mandant_count;
END $$;

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================


-- ========== 20260110500000_subscription_limits_enforcement.sql ==========
-- =====================================================
-- Migration: Subscription Limits Enforcement
-- SOTA 2026: Backend enforcement des limites de forfait
-- =====================================================

-- =====================================================
-- 1. Fonction de vérification des limites de propriétés
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
BEGIN
  -- Récupérer le compteur actuel et la limite du plan
  SELECT
    s.properties_count,
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO current_count, max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1; -- Plan gratuit = 1 bien
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur INSERT properties
DROP TRIGGER IF EXISTS check_property_limit_before_insert ON properties;
CREATE TRIGGER check_property_limit_before_insert
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION enforce_property_limit();

-- =====================================================
-- 2. Fonction de vérification des limites de baux
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_lease_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
  property_owner_id UUID;
BEGIN
  -- Récupérer l'owner_id depuis la propriété
  SELECT owner_id INTO property_owner_id
  FROM properties
  WHERE id = NEW.property_id;

  IF property_owner_id IS NULL THEN
    RAISE EXCEPTION 'Propriété non trouvée';
  END IF;

  -- Récupérer le compteur actuel et la limite du plan
  SELECT
    s.leases_count,
    COALESCE(sp.max_leases, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO current_count, max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = property_owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1; -- Plan gratuit = 1 bail
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bail(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour créer plus de baux.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur INSERT leases
DROP TRIGGER IF EXISTS check_lease_limit_before_insert ON leases;
CREATE TRIGGER check_lease_limit_before_insert
  BEFORE INSERT ON leases
  FOR EACH ROW
  EXECUTE FUNCTION enforce_lease_limit();

-- =====================================================
-- 3. Fonction de vérification des limites d'utilisateurs
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_user_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
BEGIN
  -- Compter les utilisateurs actuels pour cet owner
  SELECT COUNT(*) INTO current_count
  FROM team_members
  WHERE owner_id = NEW.owner_id AND status = 'active';

  -- Récupérer la limite du plan
  SELECT
    COALESCE(sp.max_users, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1; -- Plan gratuit = 1 utilisateur (le propriétaire)
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % utilisateur(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour inviter plus de collaborateurs.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur INSERT team_members (si la table existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
    DROP TRIGGER IF EXISTS check_user_limit_before_insert ON team_members;
    CREATE TRIGGER check_user_limit_before_insert
      BEFORE INSERT ON team_members
      FOR EACH ROW
      EXECUTE FUNCTION enforce_user_limit();
  END IF;
END $$;

-- =====================================================
-- 4. Fonction de vérification du quota de signatures
-- =====================================================
CREATE OR REPLACE FUNCTION check_signature_quota(p_owner_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  monthly_quota INTEGER;
  used_this_month INTEGER;
  plan_slug TEXT;
  current_month TEXT;
BEGIN
  current_month := to_char(NOW(), 'YYYY-MM');

  -- Récupérer le quota du plan
  SELECT
    COALESCE(sp.signatures_monthly_quota, 0),
    COALESCE(s.plan_slug, 'gratuit')
  INTO monthly_quota, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = p_owner_id;

  -- Compter les signatures utilisées ce mois
  SELECT COUNT(*) INTO used_this_month
  FROM signature_requests sr
  JOIN leases l ON sr.lease_id = l.id
  JOIN properties p ON l.property_id = p.id
  WHERE p.owner_id = p_owner_id
    AND to_char(sr.created_at, 'YYYY-MM') = current_month
    AND sr.status != 'cancelled';

  -- Si quota illimité (-1), toujours OK
  IF monthly_quota = -1 THEN
    result := jsonb_build_object(
      'can_sign', true,
      'quota', -1,
      'used', used_this_month,
      'remaining', -1,
      'plan', plan_slug
    );
  ELSE
    result := jsonb_build_object(
      'can_sign', used_this_month < monthly_quota,
      'quota', monthly_quota,
      'used', used_this_month,
      'remaining', GREATEST(0, monthly_quota - used_this_month),
      'plan', plan_slug
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. Fonction de vérification d'accès à une feature
-- =====================================================
CREATE OR REPLACE FUNCTION has_subscription_feature(p_owner_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  plan_slug TEXT;
  feature_value BOOLEAN;
BEGIN
  -- Récupérer le plan de l'utilisateur
  SELECT COALESCE(s.plan_slug, 'gratuit')
  INTO plan_slug
  FROM subscriptions s
  WHERE s.owner_id = p_owner_id;

  -- Vérifier si la feature est disponible selon le plan
  -- Cette logique est simplifiée, la vraie vérification devrait
  -- consulter la table subscription_plans pour les features
  SELECT
    CASE
      WHEN sp.features ? p_feature THEN (sp.features->>p_feature)::boolean
      ELSE false
    END
  INTO feature_value
  FROM subscription_plans sp
  WHERE sp.slug = COALESCE(plan_slug, 'gratuit');

  RETURN COALESCE(feature_value, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. Index pour optimiser les requêtes de vérification
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_owner_id ON subscriptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_slug ON subscriptions(plan_slug);

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON FUNCTION enforce_property_limit() IS 'Vérifie et bloque l''ajout de biens au-delà de la limite du forfait';
COMMENT ON FUNCTION enforce_lease_limit() IS 'Vérifie et bloque la création de baux au-delà de la limite du forfait';
COMMENT ON FUNCTION check_signature_quota(UUID) IS 'Retourne le quota de signatures et l''utilisation actuelle';
COMMENT ON FUNCTION has_subscription_feature(UUID, TEXT) IS 'Vérifie si un owner a accès à une feature selon son forfait';


-- ========== 20260111000000_tax_verification_logs.sql ==========
-- Migration: Table de logs pour la vérification d'avis d'imposition
-- Date: 2026-01-11
-- Description: Crée la table pour stocker l'historique des vérifications d'avis d'imposition

-- ============================================================================
-- TABLE: tax_verification_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Utilisateur qui a effectué la vérification
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Références optionnelles au locataire/candidature
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,

  -- Données hachées pour confidentialité (SHA-256)
  numero_fiscal_hash TEXT NOT NULL,
  reference_avis_hash TEXT NOT NULL,

  -- Résultat de la vérification
  status TEXT NOT NULL CHECK (status IN (
    'conforme',
    'non_conforme',
    'situation_partielle',
    'introuvable',
    'erreur'
  )),

  -- Mode de vérification utilisé
  verification_mode TEXT NOT NULL DEFAULT 'api_particulier' CHECK (verification_mode IN (
    'web_scraping',
    'api_particulier',
    '2d_doc'
  )),

  -- Informations d'audit
  ip_address INET,
  user_agent TEXT,

  -- Horodatage
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index pour les requêtes par utilisateur
CREATE INDEX idx_tax_verification_logs_user_id
  ON tax_verification_logs(user_id);

-- Index pour les requêtes par locataire
CREATE INDEX idx_tax_verification_logs_tenant_id
  ON tax_verification_logs(tenant_id)
  WHERE tenant_id IS NOT NULL;

-- Index pour les requêtes par candidature
CREATE INDEX idx_tax_verification_logs_application_id
  ON tax_verification_logs(application_id)
  WHERE application_id IS NOT NULL;

-- Index pour les statistiques par statut
CREATE INDEX idx_tax_verification_logs_status
  ON tax_verification_logs(status);

-- Index pour les requêtes temporelles
CREATE INDEX idx_tax_verification_logs_created_at
  ON tax_verification_logs(created_at DESC);

-- Index composite pour détecter les vérifications répétées
CREATE INDEX idx_tax_verification_logs_dedup
  ON tax_verification_logs(numero_fiscal_hash, reference_avis_hash, created_at DESC);

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

ALTER TABLE tax_verification_logs ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs ne voient que leurs propres vérifications
CREATE POLICY "Users can view their own verification logs"
  ON tax_verification_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent créer leurs propres logs
CREATE POLICY "Users can create their own verification logs"
  ON tax_verification_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Politique : Les admins peuvent tout voir
CREATE POLICY "Admins can view all verification logs"
  ON tax_verification_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tax_verification_logs IS
  'Historique des vérifications d''avis d''imposition français via API Particulier';

COMMENT ON COLUMN tax_verification_logs.numero_fiscal_hash IS
  'Hash SHA-256 du numéro fiscal (13 chiffres) pour confidentialité';

COMMENT ON COLUMN tax_verification_logs.reference_avis_hash IS
  'Hash SHA-256 de la référence d''avis (13 caractères) pour confidentialité';

COMMENT ON COLUMN tax_verification_logs.status IS
  'Résultat: conforme, non_conforme, situation_partielle, introuvable, erreur';

COMMENT ON COLUMN tax_verification_logs.verification_mode IS
  'Mode utilisé: api_particulier (recommandé), web_scraping, 2d_doc';


-- ========== 20260111000000_visit_scheduling_sota2026.sql ==========
-- ============================================
-- Migration: Visit Scheduling System SOTA 2026
-- Description: Complete visit scheduling for property visits
-- Tables: owner_availability_patterns, availability_exceptions, visit_slots, visit_bookings, calendar_connections
-- ============================================

-- ============================================
-- 1. OWNER AVAILABILITY PATTERNS
-- Patterns de disponibilité récurrents du propriétaire
-- ============================================

CREATE TABLE IF NOT EXISTS owner_availability_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE, -- NULL = toutes propriétés

  -- Pattern de récurrence
  recurrence_type TEXT NOT NULL DEFAULT 'weekly'
    CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'custom')),
  day_of_week INTEGER[] DEFAULT '{6}'::INTEGER[], -- 0=Dimanche, 1=Lundi... 6=Samedi

  -- Plage horaire
  start_time TIME NOT NULL DEFAULT '10:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_duration_minutes >= 15 AND slot_duration_minutes <= 180),
  buffer_minutes INTEGER NOT NULL DEFAULT 15 CHECK (buffer_minutes >= 0 AND buffer_minutes <= 60),

  -- Période de validité
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- Configuration
  max_bookings_per_slot INTEGER NOT NULL DEFAULT 1, -- Pour visites groupées
  auto_confirm BOOLEAN NOT NULL DEFAULT false, -- Confirmation automatique

  -- Métadonnées
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT valid_time_range CHECK (start_time < end_time),
  CONSTRAINT valid_date_range CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- Indexes
CREATE INDEX idx_availability_patterns_owner ON owner_availability_patterns(owner_id);
CREATE INDEX idx_availability_patterns_property ON owner_availability_patterns(property_id);
CREATE INDEX idx_availability_patterns_active ON owner_availability_patterns(is_active) WHERE is_active = true;
CREATE INDEX idx_availability_patterns_valid ON owner_availability_patterns(valid_from, valid_until);

-- ============================================
-- 2. AVAILABILITY EXCEPTIONS
-- Exceptions aux patterns (vacances, indisponibilités ponctuelles)
-- ============================================

CREATE TABLE IF NOT EXISTS availability_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id UUID REFERENCES owner_availability_patterns(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  -- Exception
  exception_date DATE NOT NULL,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('unavailable', 'modified')),

  -- Si modifié, nouvelles heures (optionnel)
  modified_start_time TIME,
  modified_end_time TIME,

  -- Métadonnées
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT modified_times_check CHECK (
    exception_type = 'unavailable' OR
    (modified_start_time IS NOT NULL AND modified_end_time IS NOT NULL AND modified_start_time < modified_end_time)
  )
);

-- Indexes
CREATE INDEX idx_availability_exceptions_owner ON availability_exceptions(owner_id);
CREATE INDEX idx_availability_exceptions_pattern ON availability_exceptions(pattern_id);
CREATE INDEX idx_availability_exceptions_date ON availability_exceptions(exception_date);
CREATE UNIQUE INDEX idx_availability_exceptions_unique ON availability_exceptions(owner_id, property_id, exception_date)
  WHERE property_id IS NOT NULL;

-- ============================================
-- 3. VISIT SLOTS
-- Créneaux de visite matérialisés (générés à partir des patterns)
-- ============================================

CREATE TABLE IF NOT EXISTS visit_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES owner_availability_patterns(id) ON DELETE SET NULL,

  -- Créneau
  slot_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,

  -- Statut
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'booked', 'blocked', 'cancelled', 'completed')),

  -- Capacité (pour visites groupées)
  max_visitors INTEGER NOT NULL DEFAULT 1,
  current_visitors INTEGER NOT NULL DEFAULT 0,

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT valid_slot_times CHECK (start_time < end_time),
  CONSTRAINT valid_visitor_count CHECK (current_visitors >= 0 AND current_visitors <= max_visitors)
);

-- Indexes pour performance
CREATE INDEX idx_visit_slots_property ON visit_slots(property_id);
CREATE INDEX idx_visit_slots_owner ON visit_slots(owner_id);
CREATE INDEX idx_visit_slots_date ON visit_slots(slot_date);
CREATE INDEX idx_visit_slots_status ON visit_slots(status);
CREATE INDEX idx_visit_slots_available ON visit_slots(property_id, slot_date, status) WHERE status = 'available';
CREATE UNIQUE INDEX idx_visit_slots_unique ON visit_slots(property_id, start_time);

-- ============================================
-- 4. VISIT BOOKINGS
-- Réservations de visites par les locataires
-- ============================================

CREATE TABLE IF NOT EXISTS visit_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id UUID NOT NULL REFERENCES visit_slots(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Statut de la visite
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',      -- En attente de confirmation
      'confirmed',    -- Confirmée par le propriétaire
      'cancelled',    -- Annulée
      'completed',    -- Visite effectuée
      'no_show'       -- Le locataire ne s'est pas présenté
    )),

  -- Informations complémentaires
  tenant_message TEXT,
  owner_notes TEXT,

  -- Contact du locataire pour la visite
  contact_phone TEXT,
  contact_email TEXT,

  -- Nombre de personnes
  party_size INTEGER NOT NULL DEFAULT 1 CHECK (party_size >= 1 AND party_size <= 5),

  -- Rappels
  reminder_sent_at TIMESTAMPTZ,
  reminder_24h_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_1h_sent BOOLEAN NOT NULL DEFAULT false,

  -- Calendrier externe
  external_calendar_event_id TEXT,
  external_calendar_provider TEXT CHECK (external_calendar_provider IS NULL OR external_calendar_provider IN ('google', 'outlook', 'apple', 'caldav')),

  -- Feedback après visite (optionnel)
  feedback_rating INTEGER CHECK (feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5)),
  feedback_comment TEXT,

  -- Métadonnées
  booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_visit_bookings_slot ON visit_bookings(slot_id);
CREATE INDEX idx_visit_bookings_property ON visit_bookings(property_id);
CREATE INDEX idx_visit_bookings_tenant ON visit_bookings(tenant_id);
CREATE INDEX idx_visit_bookings_status ON visit_bookings(status);
CREATE INDEX idx_visit_bookings_pending ON visit_bookings(status, booked_at) WHERE status = 'pending';
CREATE INDEX idx_visit_bookings_upcoming ON visit_bookings(status) WHERE status IN ('pending', 'confirmed');

-- Un locataire ne peut avoir qu'une réservation active par bien
CREATE UNIQUE INDEX idx_visit_bookings_tenant_property_active
  ON visit_bookings(tenant_id, property_id)
  WHERE status IN ('pending', 'confirmed');

-- ============================================
-- 5. CALENDAR CONNECTIONS
-- Connexions aux calendriers externes
-- ============================================

CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'apple', 'caldav')),

  -- OAuth tokens (stockés encryptés via extension pgcrypto)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Calendar info
  calendar_id TEXT NOT NULL,
  calendar_name TEXT,
  calendar_color TEXT, -- Couleur du calendrier (hex)

  -- Sync settings
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_direction TEXT NOT NULL DEFAULT 'both'
    CHECK (sync_direction IN ('to_external', 'from_external', 'both')),
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, provider, calendar_id)
);

-- Indexes
CREATE INDEX idx_calendar_connections_user ON calendar_connections(user_id);
CREATE INDEX idx_calendar_connections_provider ON calendar_connections(provider);
CREATE INDEX idx_calendar_connections_sync ON calendar_connections(sync_enabled, last_sync_at) WHERE sync_enabled = true;

-- ============================================
-- 6. FUNCTION: generate_visit_slots
-- Génère les créneaux à partir des patterns pour une propriété
-- ============================================

CREATE OR REPLACE FUNCTION generate_visit_slots(
  p_property_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS INTEGER AS $$
DECLARE
  v_pattern RECORD;
  v_date DATE;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_count INTEGER := 0;
  v_day_of_week INTEGER;
BEGIN
  -- Parcourir tous les patterns actifs pour cette propriété
  FOR v_pattern IN
    SELECT * FROM owner_availability_patterns
    WHERE (property_id = p_property_id OR property_id IS NULL)
      AND is_active = true
      AND valid_from <= p_end_date
      AND (valid_until IS NULL OR valid_until >= p_start_date)
      AND EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = p_property_id
        AND p.owner_id = owner_availability_patterns.owner_id
      )
  LOOP
    v_date := GREATEST(p_start_date, v_pattern.valid_from);

    -- Boucle sur chaque jour de la période
    WHILE v_date <= LEAST(p_end_date, COALESCE(v_pattern.valid_until, p_end_date)) LOOP
      v_day_of_week := EXTRACT(DOW FROM v_date)::INTEGER;

      -- Vérifier si le jour correspond au pattern
      IF v_pattern.day_of_week IS NULL
         OR v_day_of_week = ANY(v_pattern.day_of_week) THEN

        -- Vérifier les exceptions (indisponibilité)
        IF NOT EXISTS (
          SELECT 1 FROM availability_exceptions
          WHERE (pattern_id = v_pattern.id OR (owner_id = v_pattern.owner_id AND (property_id = p_property_id OR property_id IS NULL)))
            AND exception_date = v_date
            AND exception_type = 'unavailable'
        ) THEN
          -- Générer les créneaux pour cette journée
          v_slot_start := v_date + v_pattern.start_time;

          WHILE (v_slot_start::TIME) < v_pattern.end_time LOOP
            v_slot_end := v_slot_start + (v_pattern.slot_duration_minutes || ' minutes')::INTERVAL;

            -- Ne pas dépasser l'heure de fin
            IF (v_slot_end::TIME) <= v_pattern.end_time THEN
              INSERT INTO visit_slots (
                property_id,
                owner_id,
                pattern_id,
                slot_date,
                start_time,
                end_time,
                max_visitors
              )
              VALUES (
                p_property_id,
                v_pattern.owner_id,
                v_pattern.id,
                v_date,
                v_slot_start,
                v_slot_end,
                v_pattern.max_bookings_per_slot
              )
              ON CONFLICT (property_id, start_time) DO NOTHING;

              v_count := v_count + 1;
            END IF;

            -- Prochain créneau = fin du créneau actuel + buffer
            v_slot_start := v_slot_end + (v_pattern.buffer_minutes || ' minutes')::INTERVAL;
          END LOOP;
        END IF;
      END IF;

      v_date := v_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. FUNCTION: cleanup_old_visit_slots
-- Nettoie les créneaux passés non réservés
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_visit_slots() RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM visit_slots
  WHERE slot_date < CURRENT_DATE - INTERVAL '7 days'
    AND status = 'available';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. FUNCTION: book_visit_slot
-- Réserve un créneau de visite (avec vérification atomique)
-- ============================================

CREATE OR REPLACE FUNCTION book_visit_slot(
  p_slot_id UUID,
  p_tenant_id UUID,
  p_message TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_party_size INTEGER DEFAULT 1
) RETURNS UUID AS $$
DECLARE
  v_slot visit_slots%ROWTYPE;
  v_booking_id UUID;
  v_pattern_auto_confirm BOOLEAN;
BEGIN
  -- Verrouiller le créneau pour éviter les doubles réservations
  SELECT * INTO v_slot
  FROM visit_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF v_slot IS NULL THEN
    RAISE EXCEPTION 'Créneau non trouvé';
  END IF;

  IF v_slot.status != 'available' THEN
    RAISE EXCEPTION 'Ce créneau n''est plus disponible';
  END IF;

  IF v_slot.current_visitors + p_party_size > v_slot.max_visitors THEN
    RAISE EXCEPTION 'Capacité maximale dépassée';
  END IF;

  -- Vérifier si le locataire n'a pas déjà une réservation active sur ce bien
  IF EXISTS (
    SELECT 1 FROM visit_bookings
    WHERE tenant_id = p_tenant_id
      AND property_id = v_slot.property_id
      AND status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'Vous avez déjà une réservation en cours pour ce bien';
  END IF;

  -- Récupérer le paramètre auto_confirm du pattern
  SELECT auto_confirm INTO v_pattern_auto_confirm
  FROM owner_availability_patterns
  WHERE id = v_slot.pattern_id;

  -- Créer la réservation
  INSERT INTO visit_bookings (
    slot_id,
    property_id,
    tenant_id,
    status,
    tenant_message,
    contact_phone,
    contact_email,
    party_size,
    confirmed_at
  ) VALUES (
    p_slot_id,
    v_slot.property_id,
    p_tenant_id,
    CASE WHEN COALESCE(v_pattern_auto_confirm, false) THEN 'confirmed' ELSE 'pending' END,
    p_message,
    p_contact_phone,
    p_contact_email,
    p_party_size,
    CASE WHEN COALESCE(v_pattern_auto_confirm, false) THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_booking_id;

  -- Mettre à jour le créneau
  UPDATE visit_slots
  SET
    current_visitors = current_visitors + p_party_size,
    status = CASE
      WHEN current_visitors + p_party_size >= max_visitors THEN 'booked'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = p_slot_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. FUNCTION: cancel_visit_booking
-- Annule une réservation et libère le créneau
-- ============================================

CREATE OR REPLACE FUNCTION cancel_visit_booking(
  p_booking_id UUID,
  p_cancelled_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_booking visit_bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking
  FROM visit_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Réservation non trouvée';
  END IF;

  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Cette réservation ne peut plus être annulée';
  END IF;

  -- Mettre à jour la réservation
  UPDATE visit_bookings
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = p_cancelled_by,
    cancellation_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_booking_id;

  -- Libérer le créneau
  UPDATE visit_slots
  SET
    current_visitors = GREATEST(0, current_visitors - v_booking.party_size),
    status = 'available',
    updated_at = NOW()
  WHERE id = v_booking.slot_id
    AND status = 'booked';

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. TRIGGERS
-- ============================================

-- Trigger updated_at pour toutes les tables
CREATE TRIGGER update_owner_availability_patterns_updated_at
  BEFORE UPDATE ON owner_availability_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visit_slots_updated_at
  BEFORE UPDATE ON visit_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visit_bookings_updated_at
  BEFORE UPDATE ON visit_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE owner_availability_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

-- Policies pour owner_availability_patterns
CREATE POLICY "Owners can manage their availability patterns"
  ON owner_availability_patterns
  FOR ALL
  USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all availability patterns"
  ON owner_availability_patterns
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Policies pour availability_exceptions
CREATE POLICY "Owners can manage their exceptions"
  ON availability_exceptions
  FOR ALL
  USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Policies pour visit_slots
CREATE POLICY "Owners can manage their visit slots"
  ON visit_slots
  FOR ALL
  USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenants can view available slots"
  ON visit_slots
  FOR SELECT
  USING (
    status = 'available' AND slot_date >= CURRENT_DATE
  );

-- Policies pour visit_bookings
CREATE POLICY "Owners can view and manage bookings for their properties"
  ON visit_bookings
  FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties
      WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Tenants can view and manage their own bookings"
  ON visit_bookings
  FOR ALL
  USING (
    tenant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all bookings"
  ON visit_bookings
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Policies pour calendar_connections
CREATE POLICY "Users can manage their calendar connections"
  ON calendar_connections
  FOR ALL
  USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- 12. COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE owner_availability_patterns IS 'Patterns de disponibilité récurrents des propriétaires pour les visites';
COMMENT ON TABLE availability_exceptions IS 'Exceptions aux patterns (vacances, indisponibilités ponctuelles)';
COMMENT ON TABLE visit_slots IS 'Créneaux de visite matérialisés générés à partir des patterns';
COMMENT ON TABLE visit_bookings IS 'Réservations de visites par les locataires potentiels';
COMMENT ON TABLE calendar_connections IS 'Connexions OAuth aux calendriers externes (Google, Outlook, etc.)';

COMMENT ON FUNCTION generate_visit_slots(UUID, DATE, DATE) IS 'Génère les créneaux de visite pour une propriété sur une période donnée';
COMMENT ON FUNCTION book_visit_slot(UUID, UUID, TEXT, TEXT, TEXT, INTEGER) IS 'Réserve un créneau de visite de manière atomique';
COMMENT ON FUNCTION cancel_visit_booking(UUID, UUID, TEXT) IS 'Annule une réservation et libère le créneau';


-- ========== 20260114000000_first_login_and_onboarding_tracking.sql ==========
-- Migration : Ajout du suivi de première connexion et complétion d'onboarding
-- Date: 2026-01-14

-- ============================================
-- 1. AJOUT DES COLONNES DE SUIVI À PROFILES
-- ============================================

-- Ajouter les colonnes de suivi de première connexion
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS welcome_seen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tour_completed_at TIMESTAMPTZ;

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_profiles_first_login_at ON profiles(first_login_at);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed_at ON profiles(onboarding_completed_at);

-- ============================================
-- 2. TABLE D'ANALYTICS D'ONBOARDING
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor')),

  -- Métriques de temps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_duration_seconds INTEGER,

  -- Métriques par étape
  steps_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{ step: "profile", started_at, completed_at, duration_seconds, skipped: false, attempts: 1 }]

  -- Métriques de comportement
  total_steps INTEGER NOT NULL DEFAULT 0,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  skipped_steps INTEGER NOT NULL DEFAULT 0,
  dropped_at_step TEXT,

  -- Source et contexte
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device_type TEXT,
  browser TEXT,

  -- Métadonnées
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_user_id ON onboarding_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_profile_id ON onboarding_analytics(profile_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_role ON onboarding_analytics(role);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_completed_at ON onboarding_analytics(completed_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_dropped_at_step ON onboarding_analytics(dropped_at_step) WHERE dropped_at_step IS NOT NULL;

-- Trigger updated_at
CREATE TRIGGER update_onboarding_analytics_updated_at
  BEFORE UPDATE ON onboarding_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE onboarding_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics"
  ON onboarding_analytics FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own analytics"
  ON onboarding_analytics FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own analytics"
  ON onboarding_analytics FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- 3. TABLE DE RAPPELS D'ONBOARDING
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor')),

  -- Type de rappel
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '72h', '7d', '14d', '30d')),

  -- Statut
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Canal
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'push', 'sms')),

  -- Contenu
  email_sent_to TEXT,
  subject TEXT,

  -- État
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'cancelled', 'failed')),
  error_message TEXT,

  -- Métadonnées
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Éviter les doublons
  UNIQUE(user_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_reminders_user_id ON onboarding_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_reminders_scheduled_at ON onboarding_reminders(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_reminders_status ON onboarding_reminders(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_reminders_pending ON onboarding_reminders(scheduled_at)
  WHERE status = 'pending';

-- Trigger updated_at
CREATE TRIGGER update_onboarding_reminders_updated_at
  BEFORE UPDATE ON onboarding_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE onboarding_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
  ON onboarding_reminders FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- 4. TABLE FEATURES DÉCOUVERTES
-- ============================================

CREATE TABLE IF NOT EXISTS user_feature_discoveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Feature découverte
  feature_key TEXT NOT NULL,
  -- Exemples: 'dashboard', 'properties', 'leases', 'payments', 'tickets', 'messages'

  -- Timestamps
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tooltip_dismissed_at TIMESTAMPTZ,
  tour_step_completed_at TIMESTAMPTZ,

  -- Métadonnées
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Éviter les doublons
  UNIQUE(user_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_user_feature_discoveries_user_id ON user_feature_discoveries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_discoveries_feature_key ON user_feature_discoveries(feature_key);

-- RLS
ALTER TABLE user_feature_discoveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own discoveries"
  ON user_feature_discoveries FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- 5. FONCTION DE MISE À JOUR DU PREMIER LOGIN
-- ============================================

CREATE OR REPLACE FUNCTION handle_first_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Si c'est la première connexion (first_login_at est NULL)
  IF OLD.first_login_at IS NULL AND NEW.last_login_at IS NOT NULL THEN
    NEW.first_login_at := NEW.last_login_at;
    NEW.login_count := 1;
  ELSIF NEW.last_login_at IS NOT NULL AND NEW.last_login_at != OLD.last_login_at THEN
    NEW.login_count := COALESCE(OLD.login_count, 0) + 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour gérer le premier login
DROP TRIGGER IF EXISTS trigger_handle_first_login ON profiles;
CREATE TRIGGER trigger_handle_first_login
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_first_login();

-- ============================================
-- 6. FONCTION RPC POUR ENREGISTRER UN LOGIN
-- ============================================

CREATE OR REPLACE FUNCTION record_user_login(p_profile_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_is_first_login BOOLEAN;
  v_profile RECORD;
BEGIN
  -- Récupérer le profil actuel
  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Vérifier si c'est le premier login
  v_is_first_login := v_profile.first_login_at IS NULL;

  -- Mettre à jour le profil
  UPDATE profiles
  SET
    last_login_at = NOW(),
    first_login_at = COALESCE(first_login_at, NOW()),
    login_count = COALESCE(login_count, 0) + 1
  WHERE id = p_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'is_first_login', v_is_first_login,
    'login_count', COALESCE(v_profile.login_count, 0) + 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. FONCTION RPC POUR STATS D'ONBOARDING (ADMIN)
-- ============================================

CREATE OR REPLACE FUNCTION get_onboarding_stats(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_started', (SELECT COUNT(*) FROM onboarding_analytics WHERE started_at > NOW() - (p_days || ' days')::INTERVAL),
    'total_completed', (SELECT COUNT(*) FROM onboarding_analytics WHERE completed_at IS NOT NULL AND started_at > NOW() - (p_days || ' days')::INTERVAL),
    'completion_rate', (
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100,
        2
      )
      FROM onboarding_analytics
      WHERE started_at > NOW() - (p_days || ' days')::INTERVAL
    ),
    'avg_completion_time_seconds', (
      SELECT ROUND(AVG(total_duration_seconds))
      FROM onboarding_analytics
      WHERE completed_at IS NOT NULL
      AND started_at > NOW() - (p_days || ' days')::INTERVAL
    ),
    'dropout_by_step', (
      SELECT jsonb_object_agg(dropped_at_step, count)
      FROM (
        SELECT dropped_at_step, COUNT(*) as count
        FROM onboarding_analytics
        WHERE dropped_at_step IS NOT NULL
        AND started_at > NOW() - (p_days || ' days')::INTERVAL
        GROUP BY dropped_at_step
        ORDER BY count DESC
      ) sub
    ),
    'by_role', (
      SELECT jsonb_object_agg(role, stats)
      FROM (
        SELECT
          role,
          jsonb_build_object(
            'started', COUNT(*),
            'completed', COUNT(*) FILTER (WHERE completed_at IS NOT NULL),
            'rate', ROUND(
              (COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100,
              2
            )
          ) as stats
        FROM onboarding_analytics
        WHERE started_at > NOW() - (p_days || ' days')::INTERVAL
        GROUP BY role
      ) sub
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. AJOUTER LES COLONNES OWNER/TENANT/PROVIDER PROFILES
-- ============================================

-- Owner profiles
ALTER TABLE owner_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Tenant profiles
ALTER TABLE tenant_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Provider profiles
ALTER TABLE provider_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Note: guarantor_profiles a déjà ces colonnes

-- ============================================
-- 9. TEMPLATES DE NOTIFICATION ONBOARDING
-- ============================================

INSERT INTO notification_templates (code, name, description, category, channels, priority, in_app_title, in_app_message, in_app_icon, email_subject, variables, is_active)
VALUES
  (
    'onboarding_welcome',
    'Bienvenue',
    'Notification de bienvenue lors de la première connexion',
    'onboarding',
    ARRAY['in_app', 'email']::text[],
    'normal',
    'Bienvenue sur Talok !',
    'Nous sommes ravis de vous accueillir. Complétez votre profil pour commencer.',
    'wave',
    'Bienvenue sur Talok !',
    ARRAY['user_name', 'role']::text[],
    true
  ),
  (
    'onboarding_step_completed',
    'Étape complétée',
    'Notification quand une étape d''onboarding est complétée',
    'onboarding',
    ARRAY['in_app']::text[],
    'low',
    'Bravo !',
    'Vous avez complété l''étape {{step_name}}. Continuez !',
    'check_circle',
    NULL,
    ARRAY['step_name', 'progress_percent']::text[],
    true
  ),
  (
    'onboarding_almost_done',
    'Presque terminé',
    'Notification quand l''onboarding est à 80%+',
    'onboarding',
    ARRAY['in_app', 'push']::text[],
    'normal',
    'Vous y êtes presque !',
    'Plus que {{remaining_steps}} étape(s) pour finaliser votre profil.',
    'rocket',
    NULL,
    ARRAY['remaining_steps', 'progress_percent']::text[],
    true
  ),
  (
    'onboarding_completed',
    'Onboarding terminé',
    'Notification quand l''onboarding est 100% complété',
    'onboarding',
    ARRAY['in_app', 'email', 'push']::text[],
    'normal',
    'Profil complété !',
    'Félicitations ! Votre espace est maintenant entièrement configuré.',
    'trophy',
    'Votre profil Talok est complet !',
    ARRAY['user_name', 'role']::text[],
    true
  ),
  (
    'onboarding_reminder_24h',
    'Rappel 24h',
    'Rappel après 24h d''onboarding incomplet',
    'onboarding',
    ARRAY['email']::text[],
    'normal',
    'N''oubliez pas de finaliser votre profil',
    'Vous êtes à {{progress_percent}}% de compléter votre profil.',
    'bell',
    'Finalisez votre inscription sur Talok',
    ARRAY['user_name', 'progress_percent', 'next_step']::text[],
    true
  ),
  (
    'onboarding_reminder_72h',
    'Rappel 72h',
    'Rappel après 72h d''onboarding incomplet',
    'onboarding',
    ARRAY['email', 'push']::text[],
    'normal',
    'Votre profil vous attend',
    'Reprenez là où vous en étiez et finalisez votre inscription.',
    'clock',
    'Votre compte Talok n''est pas encore complet',
    ARRAY['user_name', 'progress_percent', 'next_step']::text[],
    true
  ),
  (
    'onboarding_reminder_7d',
    'Rappel 7 jours',
    'Rappel après 7 jours d''onboarding incomplet',
    'onboarding',
    ARRAY['email']::text[],
    'low',
    'On vous attend !',
    'Votre espace Talok est presque prêt. Finalisez votre inscription.',
    'hourglass',
    'Nous vous attendons sur Talok',
    ARRAY['user_name', 'progress_percent']::text[],
    true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  channels = EXCLUDED.channels,
  priority = EXCLUDED.priority,
  in_app_title = EXCLUDED.in_app_title,
  in_app_message = EXCLUDED.in_app_message,
  in_app_icon = EXCLUDED.in_app_icon,
  email_subject = EXCLUDED.email_subject,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active;

COMMENT ON TABLE onboarding_analytics IS 'Analytics détaillées du parcours d''onboarding des utilisateurs';
COMMENT ON TABLE onboarding_reminders IS 'Rappels programmés pour les utilisateurs n''ayant pas terminé l''onboarding';
COMMENT ON TABLE user_feature_discoveries IS 'Suivi des fonctionnalités découvertes par l''utilisateur (pour tooltips et tours)';
COMMENT ON COLUMN profiles.first_login_at IS 'Date/heure de la première connexion de l''utilisateur';
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Date/heure de complétion de l''onboarding';
COMMENT ON COLUMN profiles.login_count IS 'Nombre total de connexions';
COMMENT ON COLUMN profiles.welcome_seen_at IS 'Date/heure où le modal de bienvenue a été vu';
COMMENT ON COLUMN profiles.tour_completed_at IS 'Date/heure où le tour guidé a été complété';


-- ========== 20260115000000_create_edl_meter_readings.sql ==========
-- Migration: Créer la table edl_meter_readings
-- Date: 2026-01-15
-- Raison: La table était référencée dans le code mais n'existait pas dans les migrations

-- 1. Créer la table edl_meter_readings si elle n'existe pas
CREATE TABLE IF NOT EXISTS edl_meter_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edl_id UUID NOT NULL REFERENCES edl(id) ON DELETE CASCADE,
  meter_id UUID REFERENCES meters(id) ON DELETE SET NULL,

  -- Valeur du relevé
  reading_value NUMERIC(12, 2),
  reading_unit TEXT DEFAULT 'kWh',

  -- Photo preuve
  photo_path TEXT,
  photo_taken_at TIMESTAMPTZ,

  -- Résultat OCR
  ocr_value NUMERIC(12, 2),
  ocr_confidence INTEGER DEFAULT 0 CHECK (ocr_confidence >= 0 AND ocr_confidence <= 100),
  ocr_provider TEXT,
  ocr_raw_text TEXT,

  -- Validation humaine
  is_validated BOOLEAN DEFAULT false,
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  validation_comment TEXT,

  -- Qui a effectué le relevé
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_by_role TEXT DEFAULT 'owner' CHECK (recorded_by_role IN ('owner', 'tenant')),

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index pour performance
CREATE INDEX IF NOT EXISTS idx_edl_meter_readings_edl_id ON edl_meter_readings(edl_id);
CREATE INDEX IF NOT EXISTS idx_edl_meter_readings_meter_id ON edl_meter_readings(meter_id);

-- 3. Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_edl_meter_readings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_edl_meter_readings_updated_at ON edl_meter_readings;
CREATE TRIGGER trigger_edl_meter_readings_updated_at
  BEFORE UPDATE ON edl_meter_readings
  FOR EACH ROW
  EXECUTE FUNCTION update_edl_meter_readings_updated_at();

-- 4. RLS Policies
ALTER TABLE edl_meter_readings ENABLE ROW LEVEL SECURITY;

-- Policy: Les admins voient tout
DROP POLICY IF EXISTS "edl_meter_readings_admin_all" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_admin_all" ON edl_meter_readings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Les propriétaires voient les relevés de leurs biens
DROP POLICY IF EXISTS "edl_meter_readings_owner_select" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_select" ON edl_meter_readings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN profiles ON profiles.id = properties.owner_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Policy: Les propriétaires peuvent créer/modifier les relevés
DROP POLICY IF EXISTS "edl_meter_readings_owner_insert" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_insert" ON edl_meter_readings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN profiles ON profiles.id = properties.owner_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "edl_meter_readings_owner_update" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_update" ON edl_meter_readings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN profiles ON profiles.id = properties.owner_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "edl_meter_readings_owner_delete" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_delete" ON edl_meter_readings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN profiles ON profiles.id = properties.owner_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Policy: Les locataires voient leurs propres relevés
DROP POLICY IF EXISTS "edl_meter_readings_tenant_select" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_tenant_select" ON edl_meter_readings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN lease_signers ON lease_signers.lease_id = leases.id
      JOIN profiles ON profiles.id = lease_signers.profile_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Policy: Les locataires peuvent créer des relevés sur leurs EDL
DROP POLICY IF EXISTS "edl_meter_readings_tenant_insert" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_tenant_insert" ON edl_meter_readings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN lease_signers ON lease_signers.lease_id = leases.id
      JOIN profiles ON profiles.id = lease_signers.profile_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- 5. Commentaires
COMMENT ON TABLE edl_meter_readings IS 'Relevés de compteurs associés aux états des lieux (EDL)';
COMMENT ON COLUMN edl_meter_readings.meter_id IS 'Référence vers le compteur (peut être null si compteur créé dynamiquement)';
COMMENT ON COLUMN edl_meter_readings.reading_value IS 'Valeur finale du relevé (manuelle ou OCR validée)';
COMMENT ON COLUMN edl_meter_readings.ocr_confidence IS 'Confiance OCR de 0 à 100';
COMMENT ON COLUMN edl_meter_readings.is_validated IS 'True si le relevé a été validé manuellement';


-- ========== 20260115000000_multi_entity_architecture.sql ==========
-- Migration: Architecture Multi-Entités pour gestion multi-SCI/sociétés
-- SOTA 2026 - Support complet des structures juridiques françaises
-- Permet à un propriétaire de gérer plusieurs sociétés (SCI, SARL, etc.)

BEGIN;

-- ============================================
-- TABLE: legal_entities (Entités juridiques)
-- ============================================
-- Représente les structures juridiques: SCI, SARL, SAS, etc.
-- Un owner_profile peut avoir plusieurs legal_entities

CREATE TABLE IF NOT EXISTS legal_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_profile_id UUID NOT NULL REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,

  -- Type d'entité juridique
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'particulier',            -- Détention directe (personne physique)
    'sci_ir',                 -- SCI à l'Impôt sur le Revenu
    'sci_is',                 -- SCI à l'Impôt sur les Sociétés
    'sci_construction_vente', -- SCCV (promotion)
    'sarl',                   -- SARL classique
    'sarl_famille',           -- SARL de famille (option IR possible)
    'eurl',                   -- EURL
    'sas',                    -- SAS
    'sasu',                   -- SASU
    'sa',                     -- SA
    'snc',                    -- Société en Nom Collectif
    'indivision',             -- Indivision (héritage, achat commun)
    'demembrement_usufruit',  -- Usufruit seul
    'demembrement_nue_propriete', -- Nue-propriété seule
    'holding'                 -- Société holding
  )),

  -- Identité de l'entité
  nom TEXT NOT NULL,                          -- Raison sociale ou "Patrimoine personnel"
  nom_commercial TEXT,                        -- Nom d'usage/enseigne

  -- Immatriculation (pour sociétés)
  siren TEXT CHECK (siren IS NULL OR LENGTH(siren) = 9),
  siret TEXT CHECK (siret IS NULL OR LENGTH(siret) = 14),
  rcs_ville TEXT,                             -- Ville du RCS
  rcs_numero TEXT,                            -- Numéro RCS complet
  numero_tva TEXT,                            -- Numéro TVA intracommunautaire
  code_ape TEXT,                              -- Code APE/NAF

  -- Adresse du siège social
  adresse_siege TEXT,
  complement_adresse TEXT,
  code_postal_siege TEXT,
  ville_siege TEXT,
  pays_siege TEXT DEFAULT 'France',

  -- Forme juridique détaillée
  forme_juridique TEXT,                       -- "SCI", "SARL", etc.
  capital_social DECIMAL(12,2),               -- Capital en euros
  capital_variable BOOLEAN DEFAULT false,     -- Capital variable ?
  capital_min DECIMAL(12,2),                  -- Si variable: minimum
  capital_max DECIMAL(12,2),                  -- Si variable: maximum

  -- Parts sociales
  nombre_parts INTEGER,                       -- Nombre total de parts
  valeur_nominale_part DECIMAL(10,2),         -- Valeur nominale d'une part

  -- Fiscalité
  regime_fiscal TEXT CHECK (regime_fiscal IN ('ir', 'is', 'ir_option_is', 'is_option_ir')) DEFAULT 'ir',
  date_option_fiscale DATE,                   -- Date de l'option IS/IR
  tva_assujetti BOOLEAN DEFAULT false,
  tva_regime TEXT CHECK (tva_regime IS NULL OR tva_regime IN (
    'franchise',              -- Franchise en base (pas de TVA)
    'reel_simplifie',         -- Réel simplifié
    'reel_normal',            -- Réel normal
    'mini_reel'               -- Mini-réel
  )),
  tva_taux_defaut DECIMAL(5,2) DEFAULT 20.00,

  -- Exercice comptable
  date_creation DATE,                         -- Date de création/immatriculation
  date_cloture_exercice TEXT,                 -- Format "MM-DD" (ex: "12-31")
  duree_exercice_mois INTEGER DEFAULT 12,
  premier_exercice_debut DATE,
  premier_exercice_fin DATE,

  -- Coordonnées bancaires
  iban TEXT,
  bic TEXT,
  banque_nom TEXT,
  titulaire_compte TEXT,                      -- Nom sur le compte

  -- Gérance/Direction
  type_gerance TEXT CHECK (type_gerance IS NULL OR type_gerance IN (
    'gerant_unique',
    'co_gerance',
    'gerance_collegiale',
    'president',
    'directeur_general',
    'conseil_administration'
  )),

  -- Statut
  is_active BOOLEAN DEFAULT true,
  date_radiation DATE,                        -- Si société radiée
  motif_radiation TEXT,

  -- Métadonnées
  couleur TEXT,                               -- Couleur pour l'UI (hex)
  icone TEXT,                                 -- Icône pour l'UI
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour legal_entities
CREATE INDEX idx_legal_entities_owner ON legal_entities(owner_profile_id);
CREATE INDEX idx_legal_entities_type ON legal_entities(entity_type);
CREATE INDEX idx_legal_entities_siren ON legal_entities(siren) WHERE siren IS NOT NULL;
CREATE INDEX idx_legal_entities_siret ON legal_entities(siret) WHERE siret IS NOT NULL;
CREATE INDEX idx_legal_entities_active ON legal_entities(is_active);
CREATE INDEX idx_legal_entities_regime ON legal_entities(regime_fiscal);

-- ============================================
-- TABLE: entity_associates (Associés des entités)
-- ============================================
-- Gère les associés/actionnaires des sociétés

CREATE TABLE IF NOT EXISTS entity_associates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,

  -- L'associé peut être une personne ou une autre entité (holding)
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  parent_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,

  -- Identité (si associé externe non enregistré)
  civilite TEXT CHECK (civilite IS NULL OR civilite IN ('M', 'Mme', 'Société')),
  nom TEXT,
  prenom TEXT,
  date_naissance DATE,
  lieu_naissance TEXT,
  nationalite TEXT DEFAULT 'Française',
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,

  -- Pour les personnes morales associées
  denomination_sociale TEXT,
  forme_juridique_associe TEXT,
  siren_associe TEXT,
  representant_legal TEXT,

  -- Participation
  nombre_parts INTEGER NOT NULL DEFAULT 0,
  pourcentage_capital DECIMAL(6,3),           -- Précision 0.001%
  pourcentage_droits_vote DECIMAL(6,3),       -- Peut différer du capital
  valeur_parts DECIMAL(12,2),                 -- Valeur totale des parts

  -- Apports
  apport_initial DECIMAL(12,2),
  type_apport TEXT CHECK (type_apport IS NULL OR type_apport IN (
    'numeraire',              -- Apport en argent
    'nature_immobilier',      -- Apport d'immeuble
    'nature_mobilier',        -- Apport de biens mobiliers
    'industrie'               -- Apport en industrie (travail)
  )),
  date_apport DATE,

  -- Type de détention
  type_detention TEXT DEFAULT 'pleine_propriete' CHECK (type_detention IN (
    'pleine_propriete',
    'nue_propriete',
    'usufruit',
    'indivision'
  )),

  -- Rôles
  is_gerant BOOLEAN DEFAULT false,
  is_president BOOLEAN DEFAULT false,
  is_directeur_general BOOLEAN DEFAULT false,
  is_associe_fondateur BOOLEAN DEFAULT false,
  role_autre TEXT,

  -- Dates mandat gérance
  date_debut_mandat DATE,
  date_fin_mandat DATE,
  duree_mandat_annees INTEGER,

  -- Pouvoirs
  pouvoirs TEXT,                              -- Description des pouvoirs
  limitations_pouvoirs TEXT,
  signature_autorisee BOOLEAN DEFAULT false,
  plafond_engagement DECIMAL(12,2),           -- Montant max engagement sans AG

  -- Statut
  is_current BOOLEAN DEFAULT true,            -- Associé actuel ?
  date_entree DATE,
  date_sortie DATE,
  motif_sortie TEXT,

  -- Documents
  piece_identite_document_id UUID,
  justificatif_domicile_document_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT check_associate_identity CHECK (
    profile_id IS NOT NULL OR
    parent_entity_id IS NOT NULL OR
    (nom IS NOT NULL AND prenom IS NOT NULL) OR
    denomination_sociale IS NOT NULL
  )
);

-- Index pour entity_associates
CREATE INDEX idx_entity_associates_entity ON entity_associates(legal_entity_id);
CREATE INDEX idx_entity_associates_profile ON entity_associates(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_entity_associates_parent ON entity_associates(parent_entity_id) WHERE parent_entity_id IS NOT NULL;
CREATE INDEX idx_entity_associates_gerant ON entity_associates(legal_entity_id) WHERE is_gerant = true;
CREATE INDEX idx_entity_associates_current ON entity_associates(legal_entity_id) WHERE is_current = true;

-- ============================================
-- TABLE: property_ownership (Détention des biens)
-- ============================================
-- Permet la multi-détention, l'indivision et le démembrement

CREATE TABLE IF NOT EXISTS property_ownership (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Détenteur (entité juridique ou personne directe)
  legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Quote-part (pour indivision)
  quote_part_numerateur INTEGER NOT NULL DEFAULT 1,
  quote_part_denominateur INTEGER NOT NULL DEFAULT 1,
  pourcentage_detention DECIMAL(6,3) GENERATED ALWAYS AS (
    (quote_part_numerateur::DECIMAL / quote_part_denominateur::DECIMAL) * 100
  ) STORED,

  -- Type de détention
  detention_type TEXT NOT NULL DEFAULT 'pleine_propriete' CHECK (detention_type IN (
    'pleine_propriete',       -- Propriété pleine et entière
    'nue_propriete',          -- Nue-propriété (sans usufruit)
    'usufruit',               -- Usufruit (droit de jouissance)
    'usufruit_temporaire',    -- Usufruit à durée limitée
    'indivision'              -- Part d'indivision
  )),

  -- Pour usufruit temporaire
  usufruit_duree_annees INTEGER,
  usufruit_date_fin DATE,

  -- Acquisition
  date_acquisition DATE,
  mode_acquisition TEXT CHECK (mode_acquisition IS NULL OR mode_acquisition IN (
    'achat',
    'apport',                 -- Apport à société
    'donation',
    'succession',
    'echange',
    'construction',
    'licitation'              -- Sortie d'indivision
  )),
  prix_acquisition DECIMAL(12,2),
  frais_acquisition DECIMAL(12,2),            -- Frais de notaire, etc.

  -- Notaire
  notaire_nom TEXT,
  notaire_ville TEXT,
  reference_acte TEXT,
  date_acte DATE,

  -- Financement
  finance_par_emprunt BOOLEAN DEFAULT false,
  montant_emprunt DECIMAL(12,2),
  banque_emprunt TEXT,

  -- Sortie
  date_cession DATE,
  mode_cession TEXT CHECK (mode_cession IS NULL OR mode_cession IN (
    'vente',
    'donation',
    'apport_societe',
    'succession',
    'echange',
    'expropriation'
  )),
  prix_cession DECIMAL(12,2),

  -- Statut
  is_current BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un bien doit avoir soit une entité soit un profil comme détenteur
  CONSTRAINT check_ownership_holder CHECK (
    (legal_entity_id IS NOT NULL AND profile_id IS NULL) OR
    (legal_entity_id IS NULL AND profile_id IS NOT NULL)
  )
);

-- Index pour property_ownership
CREATE INDEX idx_property_ownership_property ON property_ownership(property_id);
CREATE INDEX idx_property_ownership_entity ON property_ownership(legal_entity_id) WHERE legal_entity_id IS NOT NULL;
CREATE INDEX idx_property_ownership_profile ON property_ownership(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_property_ownership_current ON property_ownership(property_id) WHERE is_current = true;
CREATE INDEX idx_property_ownership_type ON property_ownership(detention_type);

-- ============================================
-- MODIFICATIONS: Table properties
-- ============================================
-- Ajout du lien vers l'entité juridique

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS detention_mode TEXT DEFAULT 'direct' CHECK (detention_mode IN (
    'direct',                 -- Détention directe (via owner_id)
    'societe',                -- Via une société (legal_entity_id)
    'indivision',             -- Multi-détenteurs
    'demembrement'            -- Démembrement NP/usufruit
  ));

CREATE INDEX IF NOT EXISTS idx_properties_legal_entity ON properties(legal_entity_id) WHERE legal_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_detention_mode ON properties(detention_mode);

-- ============================================
-- MODIFICATIONS: Table leases
-- ============================================
-- Le bailleur peut être une entité juridique

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS signatory_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bailleur_nom TEXT,
  ADD COLUMN IF NOT EXISTS bailleur_adresse TEXT,
  ADD COLUMN IF NOT EXISTS bailleur_siret TEXT;

CREATE INDEX IF NOT EXISTS idx_leases_signatory_entity ON leases(signatory_entity_id) WHERE signatory_entity_id IS NOT NULL;

-- ============================================
-- MODIFICATIONS: Table invoices
-- ============================================
-- La facture est émise par l'entité juridique

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS issuer_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issuer_nom TEXT,
  ADD COLUMN IF NOT EXISTS issuer_adresse TEXT,
  ADD COLUMN IF NOT EXISTS issuer_siret TEXT,
  ADD COLUMN IF NOT EXISTS issuer_tva TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_issuer_entity ON invoices(issuer_entity_id) WHERE issuer_entity_id IS NOT NULL;

-- ============================================
-- FONCTION: Créer une entité "particulier" par défaut
-- ============================================
-- Crée automatiquement une entité "particulier" pour les propriétaires existants

CREATE OR REPLACE FUNCTION create_default_particulier_entity()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer une entité "particulier" par défaut pour le nouveau propriétaire
  INSERT INTO legal_entities (
    owner_profile_id,
    entity_type,
    nom,
    regime_fiscal,
    is_active
  )
  SELECT
    NEW.profile_id,
    'particulier',
    COALESCE(
      (SELECT CONCAT(prenom, ' ', nom) FROM profiles WHERE id = NEW.profile_id),
      'Patrimoine personnel'
    ),
    'ir',
    true
  WHERE NEW.type = 'particulier';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer l'entité par défaut
DROP TRIGGER IF EXISTS trigger_create_default_entity ON owner_profiles;
CREATE TRIGGER trigger_create_default_entity
  AFTER INSERT ON owner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_particulier_entity();

-- ============================================
-- FONCTION: Calculer le pourcentage de détention
-- ============================================

CREATE OR REPLACE FUNCTION calculate_ownership_percentage(
  p_property_id UUID
) RETURNS TABLE (
  holder_type TEXT,
  holder_id UUID,
  holder_name TEXT,
  detention_type TEXT,
  percentage DECIMAL(6,3)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN po.legal_entity_id IS NOT NULL THEN 'entity'
      ELSE 'profile'
    END AS holder_type,
    COALESCE(po.legal_entity_id, po.profile_id) AS holder_id,
    COALESCE(le.nom, CONCAT(p.prenom, ' ', p.nom)) AS holder_name,
    po.detention_type,
    po.pourcentage_detention AS percentage
  FROM property_ownership po
  LEFT JOIN legal_entities le ON po.legal_entity_id = le.id
  LEFT JOIN profiles p ON po.profile_id = p.id
  WHERE po.property_id = p_property_id
    AND po.is_current = true
  ORDER BY po.pourcentage_detention DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FONCTION: Obtenir les stats par entité
-- ============================================

CREATE OR REPLACE FUNCTION get_entity_stats(
  p_owner_profile_id UUID
) RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  regime_fiscal TEXT,
  properties_count BIGINT,
  total_value DECIMAL(14,2),
  monthly_rent DECIMAL(12,2),
  active_leases BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    le.id AS entity_id,
    le.nom AS entity_name,
    le.entity_type,
    le.regime_fiscal,
    COUNT(DISTINCT p.id) AS properties_count,
    COALESCE(SUM(
      CASE WHEN po.is_current THEN po.prix_acquisition ELSE 0 END
    ), 0) AS total_value,
    COALESCE(SUM(p.loyer_hc), 0) AS monthly_rent,
    COUNT(DISTINCT CASE WHEN l.statut = 'active' THEN l.id END) AS active_leases
  FROM legal_entities le
  LEFT JOIN property_ownership po ON po.legal_entity_id = le.id AND po.is_current = true
  LEFT JOIN properties p ON po.property_id = p.id
  LEFT JOIN leases l ON l.property_id = p.id
  WHERE le.owner_profile_id = p_owner_profile_id
    AND le.is_active = true
  GROUP BY le.id, le.nom, le.entity_type, le.regime_fiscal
  ORDER BY properties_count DESC, le.nom;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Activer RLS
ALTER TABLE legal_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_associates ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_ownership ENABLE ROW LEVEL SECURITY;

-- Policies pour legal_entities
CREATE POLICY "Users can view their own entities"
  ON legal_entities FOR SELECT
  USING (
    owner_profile_id IN (
      SELECT profile_id FROM owner_profiles
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert their own entities"
  ON legal_entities FOR INSERT
  WITH CHECK (
    owner_profile_id IN (
      SELECT profile_id FROM owner_profiles
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own entities"
  ON legal_entities FOR UPDATE
  USING (
    owner_profile_id IN (
      SELECT profile_id FROM owner_profiles
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own entities"
  ON legal_entities FOR DELETE
  USING (
    owner_profile_id IN (
      SELECT profile_id FROM owner_profiles
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Policies pour entity_associates
CREATE POLICY "Users can view associates of their entities"
  ON entity_associates FOR SELECT
  USING (
    legal_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage associates of their entities"
  ON entity_associates FOR ALL
  USING (
    legal_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Policies pour property_ownership
CREATE POLICY "Users can view ownership of their properties"
  ON property_ownership FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
    OR
    legal_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage ownership of their properties"
  ON property_ownership FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Policy admin pour toutes les tables
CREATE POLICY "Admins can do everything on legal_entities"
  ON legal_entities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can do everything on entity_associates"
  ON entity_associates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can do everything on property_ownership"
  ON property_ownership FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- TRIGGERS updated_at
-- ============================================

CREATE TRIGGER update_legal_entities_updated_at
  BEFORE UPDATE ON legal_entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entity_associates_updated_at
  BEFORE UPDATE ON entity_associates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_ownership_updated_at
  BEFORE UPDATE ON property_ownership
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION DES DONNÉES EXISTANTES
-- ============================================

-- Créer une entité "particulier" pour chaque propriétaire existant qui n'en a pas
INSERT INTO legal_entities (
  owner_profile_id,
  entity_type,
  nom,
  regime_fiscal,
  is_active,
  siret,
  adresse_siege,
  iban
)
SELECT
  op.profile_id,
  CASE
    WHEN op.type = 'societe' THEN 'sci_ir'
    ELSE 'particulier'
  END,
  COALESCE(
    op.raison_sociale,
    CONCAT(p.prenom, ' ', p.nom),
    'Patrimoine personnel'
  ),
  'ir',
  true,
  op.siret,
  op.adresse_facturation,
  op.iban
FROM owner_profiles op
JOIN profiles p ON op.profile_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM legal_entities le
  WHERE le.owner_profile_id = op.profile_id
);

-- Lier les propriétés existantes à l'entité par défaut
UPDATE properties p
SET legal_entity_id = (
  SELECT le.id
  FROM legal_entities le
  WHERE le.owner_profile_id = p.owner_id
  ORDER BY le.created_at ASC
  LIMIT 1
),
detention_mode = 'direct'
WHERE p.legal_entity_id IS NULL
  AND EXISTS (
    SELECT 1 FROM legal_entities le
    WHERE le.owner_profile_id = p.owner_id
  );

-- Créer les enregistrements property_ownership pour les propriétés existantes
INSERT INTO property_ownership (
  property_id,
  legal_entity_id,
  profile_id,
  quote_part_numerateur,
  quote_part_denominateur,
  detention_type,
  date_acquisition,
  mode_acquisition,
  is_current
)
SELECT
  p.id,
  p.legal_entity_id,
  NULL,
  1,
  1,
  'pleine_propriete',
  p.created_at::DATE,
  'achat',
  true
FROM properties p
WHERE p.legal_entity_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM property_ownership po
    WHERE po.property_id = p.id
  );

COMMIT;


-- ========== 20260115000000_white_label_system.sql ==========
-- ============================================
-- Migration: Système White-Label complet
-- Date: 2026-01-15
-- Description: Tables pour organisations, branding et domaines personnalisés
-- ============================================

-- ============================================
-- TYPE ENUM pour les niveaux white-label
-- ============================================

CREATE TYPE white_label_level AS ENUM ('none', 'basic', 'full', 'premium');
CREATE TYPE domain_verification_method AS ENUM ('dns_txt', 'dns_cname', 'file');
CREATE TYPE ssl_status AS ENUM ('pending', 'active', 'failed', 'expired');
CREATE TYPE sso_provider AS ENUM ('saml', 'oidc');

-- ============================================
-- TABLE: organizations
-- Organisation/entreprise utilisant le white-label
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Informations de base
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,

  -- Propriétaire (user_id du propriétaire principal)
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Lien avec l'abonnement
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Niveau white-label (déterminé par le plan)
  white_label_level white_label_level NOT NULL DEFAULT 'none',

  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_subscription ON organizations(subscription_id);

-- ============================================
-- TABLE: organization_members
-- Membres d'une organisation
-- ============================================

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rôle dans l'organisation
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member

  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte unique
  UNIQUE(organization_id, user_id)
);

-- Index
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- ============================================
-- TABLE: organization_branding
-- Configuration du branding pour une organisation
-- ============================================

CREATE TABLE IF NOT EXISTS organization_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- ============================================
  -- NIVEAU BASIC (Enterprise M - 349€)
  -- ============================================

  -- Nom et identité
  company_name VARCHAR(255),
  tagline VARCHAR(500),

  -- Logo principal
  logo_url TEXT,
  logo_dark_url TEXT, -- Version pour dark mode

  -- Couleur principale
  primary_color VARCHAR(7), -- Format #RRGGBB

  -- Email basique
  email_from_name VARCHAR(255),
  email_from_address VARCHAR(255),
  email_logo_url TEXT,

  -- ============================================
  -- NIVEAU FULL (Enterprise L - 499€)
  -- ============================================

  -- Favicon
  favicon_url TEXT,

  -- Couleurs complètes
  secondary_color VARCHAR(7),
  accent_color VARCHAR(7),

  -- Background page connexion
  login_background_url TEXT,
  login_background_color VARCHAR(7),

  -- Email avancé
  email_reply_to VARCHAR(255),
  email_footer_html TEXT,
  email_primary_color VARCHAR(7),
  email_secondary_color VARCHAR(7),

  -- Options
  remove_powered_by BOOLEAN NOT NULL DEFAULT false,

  -- ============================================
  -- NIVEAU PREMIUM (Enterprise XL - 799€)
  -- ============================================

  -- CSS personnalisé
  custom_css TEXT,

  -- SSO
  sso_enabled BOOLEAN NOT NULL DEFAULT false,
  sso_provider sso_provider,
  sso_entity_id VARCHAR(255),
  sso_metadata_url TEXT,
  sso_certificate TEXT,
  sso_config JSONB DEFAULT '{}',

  -- API Branding
  api_branding_enabled BOOLEAN NOT NULL DEFAULT false,

  -- ============================================
  -- Métadonnées
  -- ============================================

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_org_branding_org ON organization_branding(organization_id);

-- ============================================
-- TABLE: custom_domains
-- Domaines personnalisés pour une organisation
-- ============================================

CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Domaine
  domain VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100), -- Si sous-domaine de talok.app

  -- Vérification
  verified BOOLEAN NOT NULL DEFAULT false,
  verification_token VARCHAR(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  verification_method domain_verification_method NOT NULL DEFAULT 'dns_txt',
  verification_attempts INTEGER NOT NULL DEFAULT 0,
  last_verification_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,

  -- SSL/TLS
  ssl_status ssl_status NOT NULL DEFAULT 'pending',
  ssl_certificate_id VARCHAR(255), -- ID chez le provider (Let's Encrypt, etc.)
  ssl_issued_at TIMESTAMPTZ,
  ssl_expires_at TIMESTAMPTZ,

  -- État
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  UNIQUE(domain)
);

-- Index
CREATE INDEX idx_custom_domains_org ON custom_domains(organization_id);
CREATE INDEX idx_custom_domains_domain ON custom_domains(domain);
CREATE INDEX idx_custom_domains_verified ON custom_domains(verified) WHERE verified = true;

-- ============================================
-- TABLE: branding_assets
-- Assets uploadés (logos, images, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS branding_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Type d'asset
  asset_type VARCHAR(50) NOT NULL, -- logo, favicon, login_bg, email_logo

  -- Fichier
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,

  -- Dimensions (pour images)
  width INTEGER,
  height INTEGER,

  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Métadonnées
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_branding_assets_org ON branding_assets(organization_id);
CREATE INDEX idx_branding_assets_type ON branding_assets(asset_type);

-- ============================================
-- FONCTIONS
-- ============================================

-- Fonction pour obtenir le branding d'une organisation
CREATE OR REPLACE FUNCTION get_organization_branding(p_organization_id UUID)
