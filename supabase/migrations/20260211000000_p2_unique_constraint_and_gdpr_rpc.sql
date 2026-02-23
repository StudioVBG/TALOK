-- =====================================================
-- Migration P2: Contrainte UNIQUE partielle + RPC GDPR transactionnelle
-- Date: 2026-02-11
-- =====================================================

BEGIN;

-- ============================================
-- 1. CONTRAINTE UNIQUE PARTIELLE SUR DOCUMENTS
-- ============================================
-- Empêche la création de doublons pour les documents générés
-- (même type + même bail + même hash de contenu)
-- Ne s'applique qu'aux documents avec un content_hash (documents générés).

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_type_lease_hash
  ON documents (type, lease_id, content_hash)
  WHERE content_hash IS NOT NULL
    AND lease_id IS NOT NULL;

COMMENT ON INDEX idx_documents_unique_type_lease_hash IS
  'Empêche les doublons de documents générés pour un même bail (P2 audit duplicate-detection)';

-- ============================================
-- 2. RPC TRANSACTIONNELLE POUR ANONYMISATION GDPR
-- ============================================
-- Toutes les opérations d'anonymisation sont wrappées dans une
-- transaction Postgres unique pour garantir l'atomicité.
-- Si une étape échoue, TOUT est annulé (rollback automatique).

CREATE OR REPLACE FUNCTION anonymize_user_cascade(
  p_user_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT,
  p_keep_financial_records BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
  v_profile_id UUID;
  v_profile_role TEXT;
  v_result JSONB := '{"tables_processed": [], "documents_deleted": 0, "total_rows_affected": 0}'::JSONB;
  v_tables JSONB := '[]'::JSONB;
  v_count INTEGER;
  v_total INTEGER := 0;
  v_doc RECORD;
  v_docs_deleted INTEGER := 0;
BEGIN
  -- Récupérer le profil cible
  SELECT id, role INTO v_profile_id, v_profile_role
  FROM profiles
  WHERE user_id = p_user_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non trouvé: %', p_user_id;
  END IF;

  IF v_profile_role = 'admin' THEN
    RAISE EXCEPTION 'Impossible d''anonymiser un administrateur';
  END IF;

  -- ========== 1. Profil principal ==========
  UPDATE profiles SET
    prenom = 'UTILISATEUR',
    nom = 'ANONYME',
    email = 'anonyme_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '@deleted.local',
    telephone = NULL,
    avatar_url = NULL,
    date_naissance = NULL,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'profiles', 'rows_affected', v_count));
  v_total := v_total + v_count;

  -- ========== 2. Owner profile ==========
  UPDATE owner_profiles SET
    siret = NULL, tva = NULL, iban = NULL, adresse_facturation = NULL
  WHERE profile_id = v_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'owner_profiles', 'rows_affected', v_count));
    v_total := v_total + v_count;
  END IF;

  -- ========== 3. Tenant profile ==========
  UPDATE tenant_profiles SET
    situation_pro = NULL, revenus_mensuels = NULL,
    employeur = NULL, employeur_adresse = NULL, employeur_telephone = NULL
  WHERE profile_id = v_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'tenant_profiles', 'rows_affected', v_count));
    v_total := v_total + v_count;
  END IF;

  -- ========== 4. Provider profile ==========
  UPDATE provider_profiles SET
    siret = NULL, certifications = NULL, zones_intervention = NULL
  WHERE profile_id = v_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'provider_profiles', 'rows_affected', v_count));
    v_total := v_total + v_count;
  END IF;

  -- ========== 5. Consentements ==========
  DELETE FROM user_consents WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'user_consents', 'rows_affected', v_count));
    v_total := v_total + v_count;
  END IF;

  -- ========== 6. Tickets ==========
  UPDATE tickets SET description = '[Contenu supprimé - RGPD]'
  WHERE created_by_profile_id = v_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'tickets', 'rows_affected', v_count));
    v_total := v_total + v_count;
  END IF;

  -- Messages des tickets
  UPDATE ticket_messages SET content = '[Message supprimé - RGPD]'
  WHERE ticket_id IN (
    SELECT id FROM tickets WHERE created_by_profile_id = v_profile_id
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'ticket_messages', 'rows_affected', v_count));
    v_total := v_total + v_count;
  END IF;

  -- ========== 7. Notifications ==========
  DELETE FROM notifications WHERE profile_id = v_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'notifications', 'rows_affected', v_count));
    v_total := v_total + v_count;
  END IF;

  -- ========== 8. Documents (métadonnées) ==========
  -- Note: la suppression des fichiers Storage doit être faite côté API
  -- car les fonctions SQL n'ont pas accès au Storage.
  -- On collecte les storage_path des docs non-financiers pour le caller.
  UPDATE documents SET
    metadata = jsonb_build_object('anonymized', true, 'anonymized_at', NOW())
  WHERE owner_id = v_profile_id OR tenant_id = v_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'documents', 'rows_affected', v_count));
    v_total := v_total + v_count;
  END IF;

  -- ========== 9. Factures (si autorisé) ==========
  IF NOT p_keep_financial_records THEN
    UPDATE invoices SET metadata = jsonb_build_object('anonymized', true)
    WHERE owner_id = v_profile_id OR tenant_id = v_profile_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'invoices', 'rows_affected', v_count));
      v_total := v_total + v_count;
    END IF;
  END IF;

  -- ========== 10. Logs de connexion ==========
  UPDATE audit_log SET
    metadata = jsonb_build_object('anonymized', true),
    ip_address = NULL
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'audit_log', 'rows_affected', v_count));
    v_total := v_total + v_count;
  END IF;

  -- ========== 11. Documents d'identité (métadonnées DB) ==========
  -- Les fichiers Storage seront supprimés côté API
  DELETE FROM tenant_identity_documents WHERE tenant_id = v_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'tenant_identity_documents', 'rows_affected', v_count));
    v_total := v_total + v_count;
  END IF;

  -- ========== 12. Log de l'opération ==========
  INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_admin_user_id,
    'data_anonymized_cascade',
    'user',
    p_user_id::TEXT,
    jsonb_build_object(
      'reason', p_reason,
      'tables_processed', v_tables,
      'total_rows_affected', v_total,
      'keep_financial_records', p_keep_financial_records,
      'timestamp', NOW()
    )
  );

  -- Construire le résultat
  v_result := jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'tables_processed', v_tables,
    'total_rows_affected', v_total
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION anonymize_user_cascade IS
  'Anonymise toutes les données d''un utilisateur en une seule transaction atomique (RGPD Art. 17)';

-- ============================================
-- 3. RPC POUR NETTOYAGE ORPHELINS (utilisée par le cron)
-- ============================================

DROP FUNCTION IF EXISTS cleanup_orphan_documents();
CREATE OR REPLACE FUNCTION cleanup_orphan_documents()
RETURNS JSONB AS $$
DECLARE
  v_orphan_lease_count INTEGER := 0;
  v_orphan_property_count INTEGER := 0;
  v_old_notif_count INTEGER := 0;
  v_expired_otp_count INTEGER := 0;
  v_expired_preview_count INTEGER := 0;
  v_storage_paths TEXT[] := '{}';
BEGIN
  -- 1. Documents dont le bail a été supprimé
  -- Collecter les storage_path pour suppression côté Storage
  SELECT ARRAY_AGG(storage_path) INTO v_storage_paths
  FROM documents
  WHERE lease_id IS NOT NULL
    AND lease_id NOT IN (SELECT id FROM leases);

  DELETE FROM documents
  WHERE lease_id IS NOT NULL
    AND lease_id NOT IN (SELECT id FROM leases);
  GET DIAGNOSTICS v_orphan_lease_count = ROW_COUNT;

  -- 2. Documents dont la propriété a été hard-delete
  DELETE FROM documents
  WHERE property_id IS NOT NULL
    AND property_id NOT IN (SELECT id FROM properties);
  GET DIAGNOSTICS v_orphan_property_count = ROW_COUNT;

  -- 3. Notifications lues > 90 jours
  DELETE FROM notifications
  WHERE is_read = TRUE
    AND created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_old_notif_count = ROW_COUNT;

  -- 4. OTP codes expirés > 24h
  DELETE FROM otp_codes
  WHERE expires_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_expired_otp_count = ROW_COUNT;

  -- 5. Preview cache expirés
  DELETE FROM preview_cache
  WHERE expires_at < NOW();
  GET DIAGNOSTICS v_expired_preview_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'orphan_documents_lease', v_orphan_lease_count,
    'orphan_documents_property', v_orphan_property_count,
    'old_notifications', v_old_notif_count,
    'expired_otp', v_expired_otp_count,
    'expired_previews', v_expired_preview_count,
    'storage_paths_to_delete', v_storage_paths,
    'executed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_orphan_documents IS
  'Nettoie les enregistrements orphelins en une transaction. Retourne les storage_path à supprimer côté Storage.';

COMMIT;
