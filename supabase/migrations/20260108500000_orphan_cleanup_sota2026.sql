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

