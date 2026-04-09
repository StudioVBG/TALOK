-- ==========================================================
-- Phase 3 — Entites : Properties + Documents + Tenant + Subscriptions
-- 41 migrations combinees
-- Genere le 2026-04-09
-- ==========================================================

BEGIN;

-- === MIGRATION: 20260208100000_fix_data_storage_audit.sql ===
-- Migration: Fix data storage issues found during route audit (2026-02-08)
--
-- FIX #3: Add room_label, has_guarantor, guarantor_email, guarantor_name to roommates
-- FIX #3b: Make user_id, profile_id, first_name, last_name nullable (invited roommates don't have accounts yet)
-- FIX: Ensure edl_signatures.signer_role accepts values written by the routes

-- ============================================================
-- 1. Fix roommates table: make columns nullable for invited users
-- ============================================================

-- user_id: invited roommates don't have an auth account yet
ALTER TABLE roommates ALTER COLUMN user_id DROP NOT NULL;

-- profile_id: same — filled when user creates account
ALTER TABLE roommates ALTER COLUMN profile_id DROP NOT NULL;

-- first_name / last_name: invited users only have an email initially
ALTER TABLE roommates ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE roommates ALTER COLUMN last_name DROP NOT NULL;

-- Set defaults for text fields so insert without them doesn't fail
ALTER TABLE roommates ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE roommates ALTER COLUMN last_name SET DEFAULT '';

-- ============================================================
-- 2. Add missing columns to roommates for colocation data
-- ============================================================

-- Room label (text, not FK to rooms — rooms might not exist at invite time)
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS room_label TEXT;

-- Guarantor tracking
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS has_guarantor BOOLEAN DEFAULT false;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS guarantor_email TEXT;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS guarantor_name TEXT;

COMMENT ON COLUMN roommates.room_label IS 'Libellé de la chambre attribuée (texte libre, avant attribution room_id)';
COMMENT ON COLUMN roommates.has_guarantor IS 'Indique si ce colocataire a un garant';
COMMENT ON COLUMN roommates.guarantor_email IS 'Email du garant de ce colocataire';
COMMENT ON COLUMN roommates.guarantor_name IS 'Nom du garant de ce colocataire';

-- ============================================================
-- 3. Ensure leases.clauses_particulieres can store JSONB
-- ============================================================
-- The column exists as TEXT from migration 20251210100000.
-- We need it to accept JSON strings from the API.
-- TEXT is fine — the API serialises with JSON.stringify.
-- No change needed, just verify it exists:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leases' AND column_name = 'clauses_particulieres'
  ) THEN
    ALTER TABLE leases ADD COLUMN clauses_particulieres TEXT;
    COMMENT ON COLUMN leases.clauses_particulieres IS 'Clauses personnalisées du bail (JSON sérialisé)';
  END IF;
END $$;

-- ============================================================
-- 4. Drop the unique constraint that blocks invited roommates
-- ============================================================
-- Original: UNIQUE(lease_id, user_id) — fails when user_id IS NULL for multiple invitees
-- Replace with a partial unique: only enforce when user_id IS NOT NULL
ALTER TABLE roommates DROP CONSTRAINT IF EXISTS roommates_lease_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS roommates_lease_user_unique
  ON roommates (lease_id, user_id)
  WHERE user_id IS NOT NULL;

-- Also add a unique on (lease_id, invited_email) to prevent duplicate invites
CREATE UNIQUE INDEX IF NOT EXISTS roommates_lease_email_unique
  ON roommates (lease_id, invited_email)
  WHERE invited_email IS NOT NULL;


-- === MIGRATION: 20260211000000_p2_unique_constraint_and_gdpr_rpc.sql ===
-- REVIEW: Cette migration contient des DROP/DELETE dangereux. Verifier avant d'appliquer.
-- REVIEW: -- =====================================================
-- REVIEW: -- Migration P2: Contrainte UNIQUE partielle + RPC GDPR transactionnelle
-- REVIEW: -- Date: 2026-02-11
-- REVIEW: -- =====================================================
-- REVIEW: 
-- REVIEW: BEGIN;
-- REVIEW: 
-- REVIEW: -- ============================================
-- REVIEW: -- 1. CONTRAINTE UNIQUE PARTIELLE SUR DOCUMENTS
-- REVIEW: -- ============================================
-- REVIEW: -- Empêche la création de doublons pour les documents générés
-- REVIEW: -- (même type + même bail + même hash de contenu)
-- REVIEW: -- Ne s'applique qu'aux documents avec un content_hash (documents générés).
-- REVIEW: 
-- REVIEW: CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_type_lease_hash
-- REVIEW:   ON documents (type, lease_id, content_hash)
-- REVIEW:   WHERE content_hash IS NOT NULL
-- REVIEW:     AND lease_id IS NOT NULL;
-- REVIEW: 
-- REVIEW: COMMENT ON INDEX idx_documents_unique_type_lease_hash IS
-- REVIEW:   'Empêche les doublons de documents générés pour un même bail (P2 audit duplicate-detection)';
-- REVIEW: 
-- REVIEW: -- ============================================
-- REVIEW: -- 2. RPC TRANSACTIONNELLE POUR ANONYMISATION GDPR
-- REVIEW: -- ============================================
-- REVIEW: -- Toutes les opérations d'anonymisation sont wrappées dans une
-- REVIEW: -- transaction Postgres unique pour garantir l'atomicité.
-- REVIEW: -- Si une étape échoue, TOUT est annulé (rollback automatique).
-- REVIEW: 
-- REVIEW: CREATE OR REPLACE FUNCTION anonymize_user_cascade(
-- REVIEW:   p_user_id UUID,
-- REVIEW:   p_admin_user_id UUID,
-- REVIEW:   p_reason TEXT,
-- REVIEW:   p_keep_financial_records BOOLEAN DEFAULT TRUE
-- REVIEW: )
-- REVIEW: RETURNS JSONB AS $$
-- REVIEW: DECLARE
-- REVIEW:   v_profile_id UUID;
-- REVIEW:   v_profile_role TEXT;
-- REVIEW:   v_result JSONB := '{"tables_processed": [], "documents_deleted": 0, "total_rows_affected": 0}'::JSONB;
-- REVIEW:   v_tables JSONB := '[]'::JSONB;
-- REVIEW:   v_count INTEGER;
-- REVIEW:   v_total INTEGER := 0;
-- REVIEW:   v_doc RECORD;
-- REVIEW:   v_docs_deleted INTEGER := 0;
-- REVIEW: BEGIN
-- REVIEW:   -- Récupérer le profil cible
-- REVIEW:   SELECT id, role INTO v_profile_id, v_profile_role
-- REVIEW:   FROM profiles
-- REVIEW:   WHERE user_id = p_user_id;
-- REVIEW: 
-- REVIEW:   IF v_profile_id IS NULL THEN
-- REVIEW:     RAISE EXCEPTION 'Utilisateur non trouvé: %', p_user_id;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   IF v_profile_role = 'admin' THEN
-- REVIEW:     RAISE EXCEPTION 'Impossible d''anonymiser un administrateur';
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ========== 1. Profil principal ==========
-- REVIEW:   UPDATE profiles SET
-- REVIEW:     prenom = 'UTILISATEUR',
-- REVIEW:     nom = 'ANONYME',
-- REVIEW:     email = 'anonyme_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '@deleted.local',
-- REVIEW:     telephone = NULL,
-- REVIEW:     avatar_url = NULL,
-- REVIEW:     date_naissance = NULL,
-- REVIEW:     updated_at = NOW()
-- REVIEW:   WHERE user_id = p_user_id;
-- REVIEW:   GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'profiles', 'rows_affected', v_count));
-- REVIEW:   v_total := v_total + v_count;
-- REVIEW: 
-- REVIEW:   -- ========== 2. Owner profile ==========
-- REVIEW:   UPDATE owner_profiles SET
-- REVIEW:     siret = NULL, tva = NULL, iban = NULL, adresse_facturation = NULL
-- REVIEW:   WHERE profile_id = v_profile_id;
-- REVIEW:   GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   IF v_count > 0 THEN
-- REVIEW:     v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'owner_profiles', 'rows_affected', v_count));
-- REVIEW:     v_total := v_total + v_count;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ========== 3. Tenant profile ==========
-- REVIEW:   UPDATE tenant_profiles SET
-- REVIEW:     situation_pro = NULL, revenus_mensuels = NULL,
-- REVIEW:     employeur = NULL, employeur_adresse = NULL, employeur_telephone = NULL
-- REVIEW:   WHERE profile_id = v_profile_id;
-- REVIEW:   GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   IF v_count > 0 THEN
-- REVIEW:     v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'tenant_profiles', 'rows_affected', v_count));
-- REVIEW:     v_total := v_total + v_count;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ========== 4. Provider profile ==========
-- REVIEW:   UPDATE provider_profiles SET
-- REVIEW:     siret = NULL, certifications = NULL, zones_intervention = NULL
-- REVIEW:   WHERE profile_id = v_profile_id;
-- REVIEW:   GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   IF v_count > 0 THEN
-- REVIEW:     v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'provider_profiles', 'rows_affected', v_count));
-- REVIEW:     v_total := v_total + v_count;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ========== 5. Consentements ==========
-- REVIEW:   DELETE FROM user_consents WHERE user_id = p_user_id;
-- REVIEW:   GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   IF v_count > 0 THEN
-- REVIEW:     v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'user_consents', 'rows_affected', v_count));
-- REVIEW:     v_total := v_total + v_count;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ========== 6. Tickets ==========
-- REVIEW:   UPDATE tickets SET description = '[Contenu supprimé - RGPD]'
-- REVIEW:   WHERE created_by_profile_id = v_profile_id;
-- REVIEW:   GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   IF v_count > 0 THEN
-- REVIEW:     v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'tickets', 'rows_affected', v_count));
-- REVIEW:     v_total := v_total + v_count;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- Messages des tickets
-- REVIEW:   UPDATE ticket_messages SET content = '[Message supprimé - RGPD]'
-- REVIEW:   WHERE ticket_id IN (
-- REVIEW:     SELECT id FROM tickets WHERE created_by_profile_id = v_profile_id
-- REVIEW:   );
-- REVIEW:   GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   IF v_count > 0 THEN
-- REVIEW:     v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'ticket_messages', 'rows_affected', v_count));
-- REVIEW:     v_total := v_total + v_count;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ========== 7. Notifications ==========
-- REVIEW:   DELETE FROM notifications WHERE profile_id = v_profile_id;
-- REVIEW:   GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   IF v_count > 0 THEN
-- REVIEW:     v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'notifications', 'rows_affected', v_count));
-- REVIEW:     v_total := v_total + v_count;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ========== 8. Documents (métadonnées) ==========
-- REVIEW:   -- Note: la suppression des fichiers Storage doit être faite côté API
-- REVIEW:   -- car les fonctions SQL n'ont pas accès au Storage.
-- REVIEW:   -- On collecte les storage_path des docs non-financiers pour le caller.
-- REVIEW:   UPDATE documents SET
-- REVIEW:     metadata = jsonb_build_object('anonymized', true, 'anonymized_at', NOW())
-- REVIEW:   WHERE owner_id = v_profile_id OR tenant_id = v_profile_id;
-- REVIEW:   GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   IF v_count > 0 THEN
-- REVIEW:     v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'documents', 'rows_affected', v_count));
-- REVIEW:     v_total := v_total + v_count;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ========== 9. Factures (si autorisé) ==========
-- REVIEW:   IF NOT p_keep_financial_records THEN
-- REVIEW:     UPDATE invoices SET metadata = jsonb_build_object('anonymized', true)
-- REVIEW:     WHERE owner_id = v_profile_id OR tenant_id = v_profile_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     IF v_count > 0 THEN
-- REVIEW:       v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'invoices', 'rows_affected', v_count));
-- REVIEW:       v_total := v_total + v_count;
-- REVIEW:     END IF;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ========== 10. Logs de connexion ==========
-- REVIEW:   UPDATE audit_log SET
-- REVIEW:     metadata = jsonb_build_object('anonymized', true),
-- REVIEW:     ip_address = NULL
-- REVIEW:   WHERE user_id = p_user_id;
-- REVIEW:   GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   IF v_count > 0 THEN
-- REVIEW:     v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'audit_log', 'rows_affected', v_count));
-- REVIEW:     v_total := v_total + v_count;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ========== 11. Documents d'identité (métadonnées DB) ==========
-- REVIEW:   -- Les fichiers Storage seront supprimés côté API
-- REVIEW:   DELETE FROM tenant_identity_documents WHERE tenant_id = v_profile_id;
-- REVIEW:   GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   IF v_count > 0 THEN
-- REVIEW:     v_tables := v_tables || jsonb_build_array(jsonb_build_object('table', 'tenant_identity_documents', 'rows_affected', v_count));
-- REVIEW:     v_total := v_total + v_count;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ========== 12. Log de l'opération ==========
-- REVIEW:   INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata)
-- REVIEW:   VALUES (
-- REVIEW:     p_admin_user_id,
-- REVIEW:     'data_anonymized_cascade',
-- REVIEW:     'user',
-- REVIEW:     p_user_id::TEXT,
-- REVIEW:     jsonb_build_object(
-- REVIEW:       'reason', p_reason,
-- REVIEW:       'tables_processed', v_tables,
-- REVIEW:       'total_rows_affected', v_total,
-- REVIEW:       'keep_financial_records', p_keep_financial_records,
-- REVIEW:       'timestamp', NOW()
-- REVIEW:     )
-- REVIEW:   );
-- REVIEW: 
-- REVIEW:   -- Construire le résultat
-- REVIEW:   v_result := jsonb_build_object(
-- REVIEW:     'success', true,
-- REVIEW:     'profile_id', v_profile_id,
-- REVIEW:     'tables_processed', v_tables,
-- REVIEW:     'total_rows_affected', v_total
-- REVIEW:   );
-- REVIEW: 
-- REVIEW:   RETURN v_result;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: COMMENT ON FUNCTION anonymize_user_cascade IS
-- REVIEW:   'Anonymise toutes les données d''un utilisateur en une seule transaction atomique (RGPD Art. 17)';
-- REVIEW: 
-- REVIEW: -- ============================================
-- REVIEW: -- 3. RPC POUR NETTOYAGE ORPHELINS (utilisée par le cron)
-- REVIEW: -- ============================================
-- REVIEW: 
-- REVIEW: DROP FUNCTION IF EXISTS cleanup_orphan_documents();
-- REVIEW: CREATE OR REPLACE FUNCTION cleanup_orphan_documents()
-- REVIEW: RETURNS JSONB AS $$
-- REVIEW: DECLARE
-- REVIEW:   v_orphan_lease_count INTEGER := 0;
-- REVIEW:   v_orphan_property_count INTEGER := 0;
-- REVIEW:   v_old_notif_count INTEGER := 0;
-- REVIEW:   v_expired_otp_count INTEGER := 0;
-- REVIEW:   v_expired_preview_count INTEGER := 0;
-- REVIEW:   v_storage_paths TEXT[] := '{}';
-- REVIEW: BEGIN
-- REVIEW:   -- 1. Documents dont le bail a été supprimé
-- REVIEW:   -- Collecter les storage_path pour suppression côté Storage
-- REVIEW:   SELECT ARRAY_AGG(storage_path) INTO v_storage_paths
-- REVIEW:   FROM documents
-- REVIEW:   WHERE lease_id IS NOT NULL
-- REVIEW:     AND lease_id NOT IN (SELECT id FROM leases);
-- REVIEW: 
-- REVIEW:   DELETE FROM documents
-- REVIEW:   WHERE lease_id IS NOT NULL
-- REVIEW:     AND lease_id NOT IN (SELECT id FROM leases);
-- REVIEW:   GET DIAGNOSTICS v_orphan_lease_count = ROW_COUNT;
-- REVIEW: 
-- REVIEW:   -- 2. Documents dont la propriété a été hard-delete
-- REVIEW:   DELETE FROM documents
-- REVIEW:   WHERE property_id IS NOT NULL
-- REVIEW:     AND property_id NOT IN (SELECT id FROM properties);
-- REVIEW:   GET DIAGNOSTICS v_orphan_property_count = ROW_COUNT;
-- REVIEW: 
-- REVIEW:   -- 3. Notifications lues > 90 jours
-- REVIEW:   DELETE FROM notifications
-- REVIEW:   WHERE is_read = TRUE
-- REVIEW:     AND created_at < NOW() - INTERVAL '90 days';
-- REVIEW:   GET DIAGNOSTICS v_old_notif_count = ROW_COUNT;
-- REVIEW: 
-- REVIEW:   -- 4. OTP codes expirés > 24h
-- REVIEW:   DELETE FROM otp_codes
-- REVIEW:   WHERE expires_at < NOW() - INTERVAL '24 hours';
-- REVIEW:   GET DIAGNOSTICS v_expired_otp_count = ROW_COUNT;
-- REVIEW: 
-- REVIEW:   -- 5. Preview cache expirés
-- REVIEW:   DELETE FROM preview_cache
-- REVIEW:   WHERE expires_at < NOW();
-- REVIEW:   GET DIAGNOSTICS v_expired_preview_count = ROW_COUNT;
-- REVIEW: 
-- REVIEW:   RETURN jsonb_build_object(
-- REVIEW:     'orphan_documents_lease', v_orphan_lease_count,
-- REVIEW:     'orphan_documents_property', v_orphan_property_count,
-- REVIEW:     'old_notifications', v_old_notif_count,
-- REVIEW:     'expired_otp', v_expired_otp_count,
-- REVIEW:     'expired_previews', v_expired_preview_count,
-- REVIEW:     'storage_paths_to_delete', v_storage_paths,
-- REVIEW:     'executed_at', NOW()
-- REVIEW:   );
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: COMMENT ON FUNCTION cleanup_orphan_documents IS
-- REVIEW:   'Nettoie les enregistrements orphelins en une transaction. Retourne les storage_path à supprimer côté Storage.';
-- REVIEW: 
-- REVIEW: COMMIT;
-- REVIEW: 


-- === MIGRATION: 20260216000000_tenant_document_center.sql ===
-- =============================================================================
-- Migration : Tenant Document Center
-- Date      : 2026-02-16
-- Auteur    : Audit UX/UI — Refonte gestion documentaire locataire
--
-- Objectif  : Supporter le Document Center unifié côté locataire avec :
--   1. RPC tenant_document_center() — endpoint unique pour les 3 zones
--   2. Vue v_tenant_key_documents — 4 documents clés par locataire
--   3. Vue v_tenant_pending_actions — actions en attente agrégées
--   4. Index composite optimisé pour les requêtes du Document Center
--   5. RPC tenant_documents_search() — recherche full-text améliorée
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. INDEX COMPOSITE pour les requêtes Document Center
--    Optimise : SELECT * FROM documents WHERE tenant_id = ? ORDER BY created_at DESC
--    et       : SELECT * FROM documents WHERE tenant_id = ? AND type = ?
-- =============================================================================

-- Index composite tenant_id + type + created_at (DESC) pour la zone "Tous les documents"
CREATE INDEX IF NOT EXISTS idx_documents_tenant_type_date
  ON documents (tenant_id, type, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Index composite lease_id + type + created_at (DESC) pour les docs liés au bail
CREATE INDEX IF NOT EXISTS idx_documents_lease_type_date
  ON documents (lease_id, type, created_at DESC)
  WHERE lease_id IS NOT NULL;


-- =============================================================================
-- 2. VUE : v_tenant_key_documents
--    Retourne les 4 documents clés les plus récents par locataire :
--    bail, quittance, EDL d'entrée, attestation d'assurance
-- =============================================================================

CREATE OR REPLACE VIEW v_tenant_key_documents AS
WITH ranked_docs AS (
  SELECT
    d.id,
    d.type,
    d.title,
    d.storage_path,
    d.created_at,
    d.tenant_id,
    d.lease_id,
    d.property_id,
    d.metadata,
    d.verification_status,
    d.ged_status,
    -- Catégorie normalisée pour les 4 slots
    CASE
      WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
      WHEN d.type IN ('quittance') THEN 'quittance'
      WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
      WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
      ELSE NULL
    END AS slot_key,
    ROW_NUMBER() OVER (
      PARTITION BY
        d.tenant_id,
        CASE
          WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
          WHEN d.type IN ('quittance') THEN 'quittance'
          WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
          WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
        END
      ORDER BY
        -- Prioriser les documents "final" et "signed"
        CASE WHEN (d.metadata->>'final')::boolean = true THEN 0 ELSE 1 END,
        CASE WHEN d.ged_status = 'signed' THEN 0 WHEN d.ged_status = 'active' THEN 1 ELSE 2 END,
        d.created_at DESC
    ) AS rn
  FROM documents d
  WHERE d.tenant_id IS NOT NULL
    AND d.type IN (
      'bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire',
      'quittance',
      'EDL_entree', 'edl_entree', 'inventaire',
      'attestation_assurance', 'assurance_pno'
    )
)
SELECT
  id,
  type,
  title,
  storage_path,
  created_at,
  tenant_id,
  lease_id,
  property_id,
  metadata,
  verification_status,
  ged_status,
  slot_key
FROM ranked_docs
WHERE rn = 1 AND slot_key IS NOT NULL;

COMMENT ON VIEW v_tenant_key_documents IS
  'Documents clés par locataire (bail, dernière quittance, EDL entrée, assurance). Retourne le plus récent/pertinent pour chaque slot.';


-- =============================================================================
-- 3. VUE : v_tenant_pending_actions
--    Agrège les actions en attente pour un locataire :
--    - Bail à signer
--    - EDL à signer
--    - Attestation d'assurance manquante
-- =============================================================================

CREATE OR REPLACE VIEW v_tenant_pending_actions AS

-- Action : Bail à signer
SELECT
  ls.profile_id AS tenant_profile_id,
  'sign_lease' AS action_type,
  l.id AS entity_id,
  'Signer mon bail' AS action_label,
  'Votre bail est prêt et attend votre signature.' AS action_description,
  '/tenant/onboarding/sign' AS action_href,
  'high' AS priority,
  l.created_at AS action_created_at
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE ls.signature_status = 'pending'
  AND ls.signed_at IS NULL
  AND l.statut IN ('pending_signature', 'partially_signed')
  AND ls.role IN ('locataire_principal', 'colocataire')

UNION ALL

-- Action : EDL à signer (via le système de signature unifié)
SELECT
  sp.profile_id AS tenant_profile_id,
  'sign_edl' AS action_type,
  ss.entity_id AS entity_id,
  'Signer l''état des lieux' AS action_label,
  'Un état des lieux est en attente de votre signature.' AS action_description,
  '/tenant/documents' AS action_href,
  'high' AS priority,
  ss.created_at AS action_created_at
FROM signature_participants sp
JOIN signature_sessions ss ON ss.id = sp.session_id
WHERE sp.status IN ('pending', 'notified')
  AND ss.status IN ('pending', 'ongoing')
  AND ss.entity_type = 'edl'
  AND sp.role IN ('locataire_principal', 'colocataire')

UNION ALL

-- Action : Attestation d'assurance manquante
SELECT
  ls.profile_id AS tenant_profile_id,
  'upload_insurance' AS action_type,
  l.property_id AS entity_id,
  'Déposer l''attestation d''assurance' AS action_label,
  'Obligatoire pour activer votre bail.' AS action_description,
  '/tenant/documents' AS action_href,
  'medium' AS priority,
  l.created_at AS action_created_at
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND l.statut IN ('active', 'pending_signature', 'partially_signed', 'fully_signed')
  AND NOT EXISTS (
    SELECT 1 FROM documents d
    WHERE d.tenant_id = ls.profile_id
      AND d.property_id = l.property_id
      AND d.type IN ('attestation_assurance', 'assurance_pno')
      AND (d.verification_status IS NULL OR d.verification_status != 'rejected')
  );

COMMENT ON VIEW v_tenant_pending_actions IS
  'Actions en attente par locataire : baux à signer, EDL à signer, documents manquants. Utilisé par la zone "À faire" du Document Center.';


-- =============================================================================
-- 4. RPC : tenant_document_center()
--    Endpoint unique qui retourne toutes les données pour les 3 zones
--    du Document Center en un seul appel.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_document_center(p_profile_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_pending_actions JSONB;
  v_key_documents JSONB;
  v_all_documents JSONB;
  v_stats JSONB;
BEGIN
  -- Résoudre le profile_id (paramètre ou utilisateur courant)
  IF p_profile_id IS NOT NULL THEN
    v_profile_id := p_profile_id;
  ELSE
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  -- Zone 1 : Actions en attente
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'action_type', action_type,
      'entity_id', entity_id,
      'label', action_label,
      'description', action_description,
      'href', action_href,
      'priority', priority,
      'created_at', action_created_at
    ) ORDER BY
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      action_created_at DESC
  ), '[]'::jsonb)
  INTO v_pending_actions
  FROM v_tenant_pending_actions
  WHERE tenant_profile_id = v_profile_id;

  -- Zone 2 : Documents clés (4 slots)
  SELECT COALESCE(jsonb_object_agg(
    slot_key,
    jsonb_build_object(
      'id', id,
      'type', type,
      'title', title,
      'storage_path', storage_path,
      'created_at', created_at,
      'lease_id', lease_id,
      'property_id', property_id,
      'metadata', COALESCE(metadata, '{}'::jsonb),
      'verification_status', verification_status,
      'ged_status', ged_status
    )
  ), '{}'::jsonb)
  INTO v_key_documents
  FROM v_tenant_key_documents
  WHERE tenant_id = v_profile_id;

  -- Zone 3 : Tous les documents (les 50 plus récents, dédoublonnés)
  SELECT COALESCE(jsonb_agg(doc ORDER BY doc->>'created_at' DESC), '[]'::jsonb)
  INTO v_all_documents
  FROM (
    SELECT DISTINCT ON (d.type, COALESCE(d.lease_id, d.property_id, d.id))
      jsonb_build_object(
        'id', d.id,
        'type', d.type,
        'title', d.title,
        'storage_path', d.storage_path,
        'created_at', d.created_at,
        'tenant_id', d.tenant_id,
        'lease_id', d.lease_id,
        'property_id', d.property_id,
        'metadata', COALESCE(d.metadata, '{}'::jsonb),
        'verification_status', d.verification_status,
        'ged_status', d.ged_status,
        'file_size', d.file_size,
        'mime_type', d.mime_type,
        'original_filename', d.original_filename
      ) AS doc
    FROM documents d
    WHERE (d.tenant_id = v_profile_id
      OR d.lease_id IN (
        SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
      )
    )
    ORDER BY d.type, COALESCE(d.lease_id, d.property_id, d.id), d.created_at DESC
    LIMIT 100
  ) sub
  LIMIT 50;

  -- Stats rapides
  SELECT jsonb_build_object(
    'total_documents', (
      SELECT COUNT(*) FROM documents d
      WHERE d.tenant_id = v_profile_id
        OR d.lease_id IN (SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id)
    ),
    'pending_actions_count', jsonb_array_length(v_pending_actions),
    'has_bail', v_key_documents ? 'bail',
    'has_quittance', v_key_documents ? 'quittance',
    'has_edl', v_key_documents ? 'edl',
    'has_assurance', v_key_documents ? 'assurance'
  ) INTO v_stats;

  -- Résultat final
  v_result := jsonb_build_object(
    'pending_actions', v_pending_actions,
    'key_documents', v_key_documents,
    'documents', v_all_documents,
    'stats', v_stats
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.tenant_document_center IS
  'Endpoint unique pour le Document Center locataire. Retourne : pending_actions, key_documents (4 slots), documents (tous, dédoublonnés), stats.';

-- Accès pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.tenant_document_center TO authenticated;


-- =============================================================================
-- 5. RPC : tenant_documents_search()
--    Recherche full-text améliorée dans les documents du locataire
--    avec filtres par type, période et tri.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_documents_search(
  p_query TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_period TEXT DEFAULT NULL,        -- '1m', '3m', '6m', '1y', 'all'
  p_sort TEXT DEFAULT 'date_desc',   -- 'date_desc', 'date_asc', 'type'
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_period_start TIMESTAMPTZ;
BEGIN
  -- Résoudre le profile_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found', 'documents', '[]'::jsonb);
  END IF;

  -- Calculer la date de début de période
  v_period_start := CASE p_period
    WHEN '1m' THEN NOW() - INTERVAL '1 month'
    WHEN '3m' THEN NOW() - INTERVAL '3 months'
    WHEN '6m' THEN NOW() - INTERVAL '6 months'
    WHEN '1y' THEN NOW() - INTERVAL '1 year'
    ELSE NULL -- Pas de filtre de date
  END;

  -- Requête avec filtres dynamiques
  SELECT jsonb_build_object(
    'documents', COALESCE(jsonb_agg(doc), '[]'::jsonb),
    'total', COUNT(*) OVER()
  )
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', d.id,
      'type', d.type,
      'title', d.title,
      'storage_path', d.storage_path,
      'created_at', d.created_at,
      'tenant_id', d.tenant_id,
      'lease_id', d.lease_id,
      'property_id', d.property_id,
      'metadata', COALESCE(d.metadata, '{}'::jsonb),
      'verification_status', d.verification_status,
      'ged_status', d.ged_status,
      'file_size', d.file_size,
      'mime_type', d.mime_type,
      'original_filename', d.original_filename,
      'is_recent', (d.created_at > NOW() - INTERVAL '7 days')
    ) AS doc,
    d.created_at,
    d.type
    FROM documents d
    WHERE (
      d.tenant_id = v_profile_id
      OR d.lease_id IN (
        SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
      )
    )
    -- Filtre full-text
    AND (p_query IS NULL OR p_query = '' OR
      d.search_vector @@ plainto_tsquery('french', p_query)
      OR d.title ILIKE '%' || p_query || '%'
      OR d.type ILIKE '%' || p_query || '%'
    )
    -- Filtre par type
    AND (p_type IS NULL OR p_type = 'all' OR d.type = p_type)
    -- Filtre par période
    AND (v_period_start IS NULL OR d.created_at >= v_period_start)
    -- Tri
    ORDER BY
      CASE WHEN p_sort = 'date_desc' THEN d.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'date_asc'  THEN d.created_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'type'      THEN d.type END ASC,
      d.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) sub;

  RETURN COALESCE(v_result, jsonb_build_object('documents', '[]'::jsonb, 'total', 0));
END;
$$;

COMMENT ON FUNCTION public.tenant_documents_search IS
  'Recherche full-text dans les documents du locataire avec filtres (type, période) et tri. Utilisé par la zone "Tous les documents" du Document Center.';

GRANT EXECUTE ON FUNCTION public.tenant_documents_search TO authenticated;


-- =============================================================================
-- 6. RLS : Politiques pour les vues (sécurité)
--    Les vues utilisent SECURITY DEFINER dans les RPC, mais on ajoute
--    des politiques de sécurité sur les tables sous-jacentes pour les accès directs.
-- =============================================================================

-- S'assurer que les lease_signers sont accessibles pour les vues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lease_signers' AND policyname = 'lease_signers_tenant_view_for_doc_center'
  ) THEN
    CREATE POLICY "lease_signers_tenant_view_for_doc_center"
      ON lease_signers
      FOR SELECT
      TO authenticated
      USING (
        profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      );
  END IF;
END $$;


-- =============================================================================
-- 7. TRIGGER : Mettre à jour search_vector lors de l'insertion/modification
--    pour supporter la recherche full-text améliorée
-- =============================================================================

CREATE OR REPLACE FUNCTION update_document_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('french', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.type, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.original_filename, '')), 'C') ||
    setweight(to_tsvector('french', COALESCE(NEW.metadata->>'description', '')), 'D');
  RETURN NEW;
END;
$$;

-- Le trigger peut déjà exister, on le recrée proprement
DROP TRIGGER IF EXISTS trg_documents_search_vector ON documents;
CREATE TRIGGER trg_documents_search_vector
  BEFORE INSERT OR UPDATE OF title, type, original_filename, metadata
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_search_vector();


-- =============================================================================
-- 8. BACKFILL : Recalculer search_vector pour les documents existants
--    qui n'ont pas encore de vecteur de recherche
-- =============================================================================

UPDATE documents
SET search_vector = 
  setweight(to_tsvector('french', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('french', COALESCE(type, '')), 'B') ||
  setweight(to_tsvector('french', COALESCE(original_filename, '')), 'C') ||
  setweight(to_tsvector('french', COALESCE(metadata->>'description', '')), 'D')
WHERE search_vector IS NULL;


COMMIT;

-- =============================================================================
-- Notes de migration :
--
-- Usage côté frontend (React Query) :
--
--   // Charger le Document Center complet en 1 appel
--   const { data } = await supabase.rpc('tenant_document_center');
--   // data.pending_actions → Zone "À faire"
--   // data.key_documents   → Zone "Documents clés" (bail, quittance, edl, assurance)
--   // data.documents       → Zone "Tous les documents"
--   // data.stats           → Compteurs et flags
--
--   // Recherche avec filtres
--   const { data } = await supabase.rpc('tenant_documents_search', {
--     p_query: 'bail',
--     p_type: 'quittance',
--     p_period: '3m',
--     p_sort: 'date_desc',
--   });
--
-- Rollback :
--   DROP FUNCTION IF EXISTS public.tenant_document_center;
--   DROP FUNCTION IF EXISTS public.tenant_documents_search;
--   DROP VIEW IF EXISTS v_tenant_key_documents;
--   DROP VIEW IF EXISTS v_tenant_pending_actions;
--   DROP INDEX IF EXISTS idx_documents_tenant_type_date;
--   DROP INDEX IF EXISTS idx_documents_lease_type_date;
-- =============================================================================


-- === MIGRATION: 20260216000001_document_center_notifications.sql ===
-- =============================================================================
-- Migration : Document Center — Notifications & URL updates
-- Date      : 2026-02-16
-- Auteur    : Audit UX/UI — Unification des routes documentaires
--
-- Objectif  : Mettre à jour les templates de notification et les URLs
--             qui référençaient /tenant/receipts ou /tenant/signatures
--             pour pointer vers /tenant/documents (Document Center unifié).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Mettre à jour les templates d'email qui contiennent les anciennes routes
--    (table email_templates si elle existe)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates') THEN
    -- Remplacer /tenant/receipts par /tenant/documents?type=quittance
    UPDATE email_templates
    SET body_html = REPLACE(body_html, '/tenant/receipts', '/tenant/documents?type=quittance'),
        body_text = REPLACE(body_text, '/tenant/receipts', '/tenant/documents?type=quittance'),
        updated_at = NOW()
    WHERE body_html LIKE '%/tenant/receipts%' OR body_text LIKE '%/tenant/receipts%';

    -- Remplacer /tenant/signatures par /tenant/documents
    UPDATE email_templates
    SET body_html = REPLACE(body_html, '/tenant/signatures', '/tenant/documents'),
        body_text = REPLACE(body_text, '/tenant/signatures', '/tenant/documents'),
        updated_at = NOW()
    WHERE body_html LIKE '%/tenant/signatures%' OR body_text LIKE '%/tenant/signatures%';

    RAISE NOTICE 'email_templates updated: receipts → documents, signatures → documents';
  ELSE
    RAISE NOTICE 'email_templates table does not exist, skipping';
  END IF;
END $$;


-- =============================================================================
-- 2. Mettre à jour les notifications existantes qui pointent vers les anciennes routes
--    (table notifications si elle existe)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    -- Mettre à jour les metadata.action_url des notifications non lues
    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{action_url}',
      to_jsonb(REPLACE(metadata->>'action_url', '/tenant/receipts', '/tenant/documents?type=quittance'))
    )
    WHERE metadata->>'action_url' LIKE '%/tenant/receipts%'
      AND read_at IS NULL;

    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{action_url}',
      to_jsonb(REPLACE(metadata->>'action_url', '/tenant/signatures', '/tenant/documents'))
    )
    WHERE metadata->>'action_url' LIKE '%/tenant/signatures%'
      AND read_at IS NULL;

    RAISE NOTICE 'notifications metadata updated for unread notifications';
  ELSE
    RAISE NOTICE 'notifications table does not exist, skipping';
  END IF;
END $$;


-- =============================================================================
-- 3. Fonction utilitaire : tenant_has_key_document()
--    Vérifie si un locataire a un document clé spécifique
--    Utilisée par les triggers de notification et le dashboard
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_has_key_document(
  p_tenant_id UUID,
  p_slot_key TEXT  -- 'bail', 'quittance', 'edl', 'assurance'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_types TEXT[];
  v_exists BOOLEAN;
BEGIN
  -- Mapper le slot_key aux types de documents
  v_types := CASE p_slot_key
    WHEN 'bail' THEN ARRAY['bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire']
    WHEN 'quittance' THEN ARRAY['quittance']
    WHEN 'edl' THEN ARRAY['EDL_entree', 'edl_entree', 'inventaire']
    WHEN 'assurance' THEN ARRAY['attestation_assurance', 'assurance_pno']
    ELSE ARRAY[]::TEXT[]
  END;

  SELECT EXISTS (
    SELECT 1 FROM documents
    WHERE tenant_id = p_tenant_id
      AND type = ANY(v_types)
      AND (verification_status IS NULL OR verification_status != 'rejected')
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

COMMENT ON FUNCTION public.tenant_has_key_document IS
  'Vérifie si un locataire possède un document clé (bail, quittance, edl, assurance). Utilisé par le Document Center et les triggers.';

GRANT EXECUTE ON FUNCTION public.tenant_has_key_document TO authenticated;


-- =============================================================================
-- 4. Trigger : Notifier le locataire quand un document clé est ajouté
--    (mise à jour du trigger existant pour utiliser les nouvelles routes)
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_tenant_document_center_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_label TEXT;
  v_notification_type TEXT;
BEGIN
  -- Ne notifier que pour les documents liés à un locataire
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Déterminer le label et le type de notification
  v_doc_label := CASE
    WHEN NEW.type IN ('bail', 'contrat', 'avenant') THEN 'Un nouveau bail'
    WHEN NEW.type = 'quittance' THEN 'Une nouvelle quittance'
    WHEN NEW.type IN ('EDL_entree', 'edl_entree') THEN 'Un état des lieux d''entrée'
    WHEN NEW.type IN ('EDL_sortie', 'edl_sortie') THEN 'Un état des lieux de sortie'
    WHEN NEW.type IN ('attestation_assurance') THEN 'Votre attestation d''assurance'
    WHEN NEW.type IN ('dpe', 'erp', 'crep') THEN 'Un diagnostic technique'
    ELSE 'Un document'
  END;

  v_notification_type := CASE
    WHEN NEW.type IN ('bail', 'contrat', 'avenant') THEN 'document_lease_added'
    WHEN NEW.type = 'quittance' THEN 'document_receipt_added'
    WHEN NEW.type LIKE 'EDL%' OR NEW.type LIKE 'edl%' THEN 'document_edl_added'
    ELSE 'document_added'
  END;

  -- Insérer la notification (si la table existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    INSERT INTO notifications (
      profile_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      NEW.tenant_id,
      v_notification_type,
      v_doc_label || ' a été ajouté',
      v_doc_label || ' est disponible dans votre espace documents.',
      jsonb_build_object(
        'document_id', NEW.id,
        'document_type', NEW.type,
        'action_url', '/tenant/documents',
        'action_label', 'Voir le document'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recréer le trigger
DROP TRIGGER IF EXISTS trg_notify_tenant_document_center ON documents;
CREATE TRIGGER trg_notify_tenant_document_center
  AFTER INSERT ON documents
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NOT NULL)
  EXECUTE FUNCTION notify_tenant_document_center_update();


-- =============================================================================
-- 5. Stats : Fonction pour les analytics du Document Center
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_document_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  IF p_tenant_id IS NOT NULL THEN
    v_profile_id := p_tenant_id;
  ELSE
    SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'by_type', jsonb_object_agg(type, cnt),
    'recent_7d', SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END),
    'has_bail', bool_or(type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire')),
    'has_quittance', bool_or(type = 'quittance'),
    'has_edl', bool_or(type IN ('EDL_entree', 'edl_entree', 'inventaire')),
    'has_assurance', bool_or(type IN ('attestation_assurance', 'assurance_pno'))
  )
  INTO v_result
  FROM (
    SELECT type, COUNT(*) AS cnt, MIN(created_at) AS created_at
    FROM documents
    WHERE tenant_id = v_profile_id
    GROUP BY type
  ) sub;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.tenant_document_stats IS
  'Statistiques du coffre-fort documentaire du locataire : total, par type, récents, flags de complétude.';

GRANT EXECUTE ON FUNCTION public.tenant_document_stats TO authenticated;


COMMIT;

-- =============================================================================
-- Rollback :
--   DROP FUNCTION IF EXISTS public.tenant_has_key_document;
--   DROP FUNCTION IF EXISTS public.tenant_document_stats;
--   DROP FUNCTION IF EXISTS notify_tenant_document_center_update() CASCADE;
--   DROP TRIGGER IF EXISTS trg_notify_tenant_document_center ON documents;
-- =============================================================================


-- === MIGRATION: 20260216500000_fix_tenant_dashboard_complete.sql ===
-- ============================================================================
-- MIGRATION: Compléter la RPC tenant_dashboard avec toutes les données nécessaires
-- Date: 2026-02-16
-- Description:
--   1. Réintroduit les clés (keys) depuis le dernier EDL signé
--   2. Ajoute owner_id, surface_habitable_m2, chauffage_energie, regime
--   3. Ajoute les champs DPE complets (consommation, emissions, dates)
--   4. Ajoute le statut 'fully_signed' au filtre des baux
--   5. Conserve la recherche par email + signers enrichis
-- ============================================================================

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_user_email TEXT;
  v_tenant_data JSONB;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_notifications JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_kyc_status TEXT := 'pending';
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil ET l'email de l'utilisateur
  SELECT p.id, u.email,
         jsonb_build_object(
           'id', p.id,
           'prenom', p.prenom,
           'nom', p.nom,
           'email', u.email,
           'telephone', p.telephone,
           'avatar_url', p.avatar_url
         )
  INTO v_profile_id, v_user_email, v_tenant_data
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = p_tenant_user_id AND p.role = 'tenant';

  IF v_profile_id IS NULL THEN
    RAISE NOTICE '[tenant_dashboard] Aucun profil trouvé pour user_id: %', p_tenant_user_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE '[tenant_dashboard] Profil trouvé: %, email: %', v_profile_id, v_user_email;

  -- 2. Récupérer TOUS les baux avec données techniques enrichies + clés + compteurs
  SELECT jsonb_agg(lease_data ORDER BY lease_data->>'statut' = 'active' DESC, lease_data->>'created_at' DESC)
  INTO v_leases
  FROM (
    SELECT
      jsonb_build_object(
        'id', l.id,
        'type_bail', l.type_bail,
        'statut', l.statut,
        'loyer', l.loyer,
        'charges_forfaitaires', l.charges_forfaitaires,
        'depot_de_garantie', l.depot_de_garantie,
        'date_debut', l.date_debut,
        'date_fin', l.date_fin,
        'created_at', l.created_at,
        -- Signataires complets avec profils + invited fallback
        'signers', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', ls2.id,
              'profile_id', ls2.profile_id,
              'role', ls2.role,
              'signature_status', ls2.signature_status,
              'signed_at', ls2.signed_at,
              'invited_name', ls2.invited_name,
              'invited_email', ls2.invited_email,
              'prenom', COALESCE(p_sig.prenom, SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 1)),
              'nom', COALESCE(p_sig.nom, NULLIF(SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 2), '')),
              'avatar_url', p_sig.avatar_url
            )
          ), '[]'::jsonb)
          FROM lease_signers ls2
          LEFT JOIN profiles p_sig ON p_sig.id = ls2.profile_id
          WHERE ls2.lease_id = l.id
        ),
        -- Propriété avec champs techniques complets
        'property', jsonb_build_object(
          'id', p.id,
          'owner_id', p.owner_id,
          'adresse_complete', COALESCE(p.adresse_complete, 'Adresse à compléter'),
          'ville', COALESCE(p.ville, ''),
          'code_postal', COALESCE(p.code_postal, ''),
          'type', COALESCE(p.type, 'appartement'),
          'surface', p.surface,
          'surface_habitable_m2', p.surface_habitable_m2,
          'nb_pieces', p.nb_pieces,
          'etage', p.etage,
          'ascenseur', p.ascenseur,
          'annee_construction', p.annee_construction,
          'parking_numero', p.parking_numero,
          'has_cave', p.has_cave,
          'num_lot', p.num_lot,
          'digicode', p.digicode,
          'interphone', p.interphone,
          -- DPE complet : COALESCE pour supporter ancien + nouveau nommage
          'energie', p.energie,
          'ges', p.ges,
          'dpe_classe_energie', COALESCE(p.dpe_classe_energie, p.energie),
          'dpe_classe_climat', COALESCE(p.dpe_classe_climat, p.ges),
          'dpe_consommation', p.dpe_consommation,
          'dpe_emissions', p.dpe_emissions,
          'dpe_date_realisation', p.dpe_date_realisation,
          'dpe_date_expiration', p.dpe_date_expiration,
          -- Caractéristiques techniques
          'chauffage_type', p.chauffage_type,
          'chauffage_energie', p.chauffage_energie,
          'eau_chaude_type', p.eau_chaude_type,
          'regime', p.regime,
          -- Photo de couverture
          'cover_url', (
            SELECT url FROM property_photos
            WHERE property_id = p.id AND is_main = true
            LIMIT 1
          ),
          -- Compteurs actifs avec dernière lecture
          'meters', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', m.id,
                'type', m.type,
                'serial_number', m.serial_number,
                'unit', m.unit,
                'last_reading_value', (
                  SELECT reading_value FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                ),
                'last_reading_date', (
                  SELECT reading_date FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                )
              )
            ), '[]'::jsonb)
            FROM meters m
            WHERE m.property_id = p.id AND m.is_active = true
          ),
          -- Clés depuis le dernier EDL signé ou complété
          'keys', (
            SELECT e_keys.keys
            FROM edl e_keys
            WHERE e_keys.property_id = p.id
              AND e_keys.status IN ('signed', 'completed')
              AND e_keys.keys IS NOT NULL
              AND e_keys.keys != '[]'::jsonb
            ORDER BY COALESCE(e_keys.completed_date, e_keys.created_at) DESC
            LIMIT 1
          )
        ),
        -- Propriétaire
        'owner', jsonb_build_object(
          'id', owner_prof.id,
          'name', COALESCE(
            (SELECT raison_sociale FROM owner_profiles WHERE profile_id = owner_prof.id),
            CONCAT(COALESCE(owner_prof.prenom, ''), ' ', COALESCE(owner_prof.nom, ''))
          ),
          'email', owner_prof.email,
          'telephone', owner_prof.telephone
        )
      ) as lease_data
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE
      (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
      AND l.statut IN ('active', 'pending_signature', 'fully_signed', 'terminated')
  ) sub;

  RAISE NOTICE '[tenant_dashboard] Baux trouvés: %', COALESCE(jsonb_array_length(v_leases), 0);

  -- 3. Factures (10 dernières)
  SELECT COALESCE(jsonb_agg(invoice_data), '[]'::jsonb) INTO v_invoices
  FROM (
    SELECT
      i.id,
      i.periode,
      i.montant_total,
      i.statut,
      i.created_at,
      i.due_date,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Tickets récents (10 derniers)
  SELECT COALESCE(jsonb_agg(ticket_data), '[]'::jsonb) INTO v_tickets
  FROM (
    SELECT
      t.id,
      t.titre,
      t.description,
      t.priorite,
      t.statut,
      t.created_at,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Notifications récentes
  SELECT COALESCE(jsonb_agg(notif_data), '[]'::jsonb) INTO v_notifications
  FROM (
    SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at, n.action_url
    FROM notifications n
    WHERE n.profile_id = v_profile_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 5
  ) notif_data;

  -- 6. EDLs en attente de signature
  SELECT COALESCE(jsonb_agg(edl_data), '[]'::jsonb) INTO v_pending_edls
  FROM (
    SELECT
      e.id,
      e.type,
      e.status,
      e.scheduled_at,
      es.invitation_token,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    JOIN properties p ON p.id = e.property_id
    WHERE (es.signer_profile_id = v_profile_id OR LOWER(es.signer_email) = LOWER(v_user_email))
    AND es.signed_at IS NULL
    AND e.status IN ('draft', 'scheduled', 'in_progress', 'completed')
    ORDER BY e.created_at DESC
  ) edl_data;

  -- 7. Vérifier l'assurance
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 8. Stats globales
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(i.montant_total) FILTER (WHERE i.statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE i.statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(
      (SELECT SUM(l2.loyer + l2.charges_forfaitaires)
       FROM leases l2
       JOIN lease_signers ls2 ON ls2.lease_id = l2.id
       WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
       AND l2.statut = 'active'),
      0
    ),
    'active_leases_count', (
      SELECT COUNT(DISTINCT l2.id)
      FROM leases l2
      JOIN lease_signers ls2 ON ls2.lease_id = l2.id
      WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
      AND l2.statut = 'active'
    )
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  LEFT JOIN invoices i ON i.lease_id = l.id
  WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email));

  -- 9. KYC status
  BEGIN
    SELECT COALESCE(tp.kyc_status, 'pending') INTO v_kyc_status
    FROM tenant_profiles tp
    WHERE tp.profile_id = v_profile_id;
  EXCEPTION WHEN OTHERS THEN
    v_kyc_status := 'pending';
  END;

  -- 10. Assembler le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'tenant', v_tenant_data,
    'kyc_status', COALESCE(v_kyc_status, 'pending'),
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'lease', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN v_leases->0 ELSE NULL END,
    'property', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN (v_leases->0)->'property' ELSE NULL END,
    'invoices', v_invoices,
    'tickets', v_tickets,
    'notifications', v_notifications,
    'pending_edls', v_pending_edls,
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION tenant_dashboard(UUID) IS
'RPC dashboard locataire v4. Cherche par profile_id OU invited_email.
Inclut: signers enrichis, property complète (DPE, meters, keys), insurance, KYC status.';


-- === MIGRATION: 20260221100000_fix_tenant_dashboard_draft_visibility.sql ===
-- ============================================================================
-- MIGRATION: Fix tenant_dashboard — inclure les baux 'draft' pour le locataire
-- Date: 2026-02-21
--
-- PROBLÈME CORRIGÉ:
--   Le locataire ne voit pas son logement quand le bail est en statut 'draft'.
--   La RPC tenant_dashboard filtre par statut IN ('active', 'pending_signature',
--   'fully_signed', 'terminated') — excluant 'draft'.
--   Résultat: le locataire voit "Pas encore de logement" même s'il est lié au bail.
--   Il ne peut donc pas signer les éléments du bail (bail, EDL).
--
-- FIX: Ajouter 'draft' au filtre de statut.
-- ============================================================================

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_user_email TEXT;
  v_tenant_data JSONB;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_notifications JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_kyc_status TEXT := 'pending';
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil ET l'email de l'utilisateur
  SELECT p.id, u.email,
         jsonb_build_object(
           'id', p.id,
           'prenom', p.prenom,
           'nom', p.nom,
           'email', u.email,
           'telephone', p.telephone,
           'avatar_url', p.avatar_url
         )
  INTO v_profile_id, v_user_email, v_tenant_data
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = p_tenant_user_id AND p.role = 'tenant';

  IF v_profile_id IS NULL THEN
    RAISE NOTICE '[tenant_dashboard] Aucun profil trouvé pour user_id: %', p_tenant_user_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE '[tenant_dashboard] Profil trouvé: %, email: %', v_profile_id, v_user_email;

  -- 2. Récupérer TOUS les baux avec données techniques enrichies + clés + compteurs
  --    ✅ FIX: Inclure 'draft' pour que le locataire voie le bail dès qu'il est invité
  SELECT jsonb_agg(lease_data ORDER BY lease_data->>'statut' = 'active' DESC, lease_data->>'created_at' DESC)
  INTO v_leases
  FROM (
    SELECT
      jsonb_build_object(
        'id', l.id,
        'type_bail', l.type_bail,
        'statut', l.statut,
        'loyer', l.loyer,
        'charges_forfaitaires', l.charges_forfaitaires,
        'depot_de_garantie', l.depot_de_garantie,
        'date_debut', l.date_debut,
        'date_fin', l.date_fin,
        'created_at', l.created_at,
        -- Signataires complets avec profils + invited fallback
        'signers', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', ls2.id,
              'profile_id', ls2.profile_id,
              'role', ls2.role,
              'signature_status', ls2.signature_status,
              'signed_at', ls2.signed_at,
              'invited_name', ls2.invited_name,
              'invited_email', ls2.invited_email,
              'prenom', COALESCE(p_sig.prenom, SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 1)),
              'nom', COALESCE(p_sig.nom, NULLIF(SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 2), '')),
              'avatar_url', p_sig.avatar_url
            )
          ), '[]'::jsonb)
          FROM lease_signers ls2
          LEFT JOIN profiles p_sig ON p_sig.id = ls2.profile_id
          WHERE ls2.lease_id = l.id
        ),
        -- Propriété avec champs techniques complets
        'property', jsonb_build_object(
          'id', p.id,
          'owner_id', p.owner_id,
          'adresse_complete', COALESCE(p.adresse_complete, 'Adresse à compléter'),
          'ville', COALESCE(p.ville, ''),
          'code_postal', COALESCE(p.code_postal, ''),
          'type', COALESCE(p.type, 'appartement'),
          'surface', p.surface,
          'surface_habitable_m2', p.surface_habitable_m2,
          'nb_pieces', p.nb_pieces,
          'etage', p.etage,
          'ascenseur', p.ascenseur,
          'annee_construction', p.annee_construction,
          'parking_numero', p.parking_numero,
          'has_cave', p.has_cave,
          'num_lot', p.num_lot,
          'digicode', p.digicode,
          'interphone', p.interphone,
          -- DPE complet : COALESCE pour supporter ancien + nouveau nommage
          'energie', p.energie,
          'ges', p.ges,
          'dpe_classe_energie', COALESCE(p.dpe_classe_energie, p.energie),
          'dpe_classe_climat', COALESCE(p.dpe_classe_climat, p.ges),
          'dpe_consommation', p.dpe_consommation,
          'dpe_emissions', p.dpe_emissions,
          'dpe_date_realisation', p.dpe_date_realisation,
          'dpe_date_expiration', p.dpe_date_expiration,
          -- Caractéristiques techniques
          'chauffage_type', p.chauffage_type,
          'chauffage_energie', p.chauffage_energie,
          'eau_chaude_type', p.eau_chaude_type,
          'regime', p.regime,
          -- Photo de couverture
          'cover_url', (
            SELECT url FROM property_photos
            WHERE property_id = p.id AND is_main = true
            LIMIT 1
          ),
          -- Compteurs actifs avec dernière lecture
          'meters', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', m.id,
                'type', m.type,
                'serial_number', m.serial_number,
                'unit', m.unit,
                'last_reading_value', (
                  SELECT reading_value FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                ),
                'last_reading_date', (
                  SELECT reading_date FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                )
              )
            ), '[]'::jsonb)
            FROM meters m
            WHERE m.property_id = p.id AND m.is_active = true
          ),
          -- Clés depuis le dernier EDL signé ou complété
          'keys', (
            SELECT e_keys.keys
            FROM edl e_keys
            WHERE e_keys.property_id = p.id
              AND e_keys.status IN ('signed', 'completed')
              AND e_keys.keys IS NOT NULL
              AND e_keys.keys != '[]'::jsonb
            ORDER BY COALESCE(e_keys.completed_date, e_keys.created_at) DESC
            LIMIT 1
          )
        ),
        -- Propriétaire
        'owner', jsonb_build_object(
          'id', owner_prof.id,
          'name', COALESCE(
            (SELECT raison_sociale FROM owner_profiles WHERE profile_id = owner_prof.id),
            CONCAT(COALESCE(owner_prof.prenom, ''), ' ', COALESCE(owner_prof.nom, ''))
          ),
          'email', owner_prof.email,
          'telephone', owner_prof.telephone
        )
      ) as lease_data
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE
      (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
      AND l.statut IN ('draft', 'active', 'pending_signature', 'fully_signed', 'terminated')
  ) sub;

  RAISE NOTICE '[tenant_dashboard] Baux trouvés: %', COALESCE(jsonb_array_length(v_leases), 0);

  -- 3. Factures (10 dernières)
  SELECT COALESCE(jsonb_agg(invoice_data), '[]'::jsonb) INTO v_invoices
  FROM (
    SELECT
      i.id,
      i.periode,
      i.montant_total,
      i.statut,
      i.created_at,
      i.due_date,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Tickets récents (10 derniers)
  SELECT COALESCE(jsonb_agg(ticket_data), '[]'::jsonb) INTO v_tickets
  FROM (
    SELECT
      t.id,
      t.titre,
      t.description,
      t.priorite,
      t.statut,
      t.created_at,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Notifications récentes
  SELECT COALESCE(jsonb_agg(notif_data), '[]'::jsonb) INTO v_notifications
  FROM (
    SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at, n.action_url
    FROM notifications n
    WHERE n.profile_id = v_profile_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 5
  ) notif_data;

  -- 6. EDLs en attente de signature
  SELECT COALESCE(jsonb_agg(edl_data), '[]'::jsonb) INTO v_pending_edls
  FROM (
    SELECT
      e.id,
      e.type,
      e.status,
      e.scheduled_at,
      es.invitation_token,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    JOIN properties p ON p.id = e.property_id
    WHERE (es.signer_profile_id = v_profile_id OR LOWER(es.signer_email) = LOWER(v_user_email))
    AND es.signed_at IS NULL
    AND e.status IN ('draft', 'scheduled', 'in_progress', 'completed')
    ORDER BY e.created_at DESC
  ) edl_data;

  -- 7. Vérifier l'assurance
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 8. Stats globales
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(i.montant_total) FILTER (WHERE i.statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE i.statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(
      (SELECT SUM(l2.loyer + l2.charges_forfaitaires)
       FROM leases l2
       JOIN lease_signers ls2 ON ls2.lease_id = l2.id
       WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
       AND l2.statut = 'active'),
      0
    ),
    'active_leases_count', (
      SELECT COUNT(DISTINCT l2.id)
      FROM leases l2
      JOIN lease_signers ls2 ON ls2.lease_id = l2.id
      WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
      AND l2.statut = 'active'
    )
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  LEFT JOIN invoices i ON i.lease_id = l.id
  WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email));

  -- 9. KYC status
  BEGIN
    SELECT COALESCE(tp.kyc_status, 'pending') INTO v_kyc_status
    FROM tenant_profiles tp
    WHERE tp.profile_id = v_profile_id;
  EXCEPTION WHEN OTHERS THEN
    v_kyc_status := 'pending';
  END;

  -- 10. Assembler le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'tenant', v_tenant_data,
    'kyc_status', COALESCE(v_kyc_status, 'pending'),
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'lease', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN v_leases->0 ELSE NULL END,
    'property', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN (v_leases->0)->'property' ELSE NULL END,
    'invoices', v_invoices,
    'tickets', v_tickets,
    'notifications', v_notifications,
    'pending_edls', v_pending_edls,
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION tenant_dashboard(UUID) IS
'RPC dashboard locataire v5. Cherche par profile_id OU invited_email.
FIX: Inclut les baux draft pour que le locataire voie son logement dès invitation.
Inclut: signers enrichis, property complète (DPE, meters, keys), insurance, KYC status.';


-- === MIGRATION: 20260221300000_fix_tenant_dashboard_owner_join.sql ===
-- ============================================================================
-- MIGRATION: Fix tenant_dashboard — LEFT JOIN sur owner_prof + adresse_complete
-- Date: 2026-02-21
--
-- PROBLÈMES CORRIGÉS:
--   1. INNER JOIN sur profiles owner_prof exclut silencieusement les baux
--      si owner_id est NULL ou si le profil propriétaire n'existe pas.
--      → Changé en LEFT JOIN pour que les baux soient toujours retournés.
--
--   2. COALESCE(p.adresse_complete, 'Adresse à compléter') est inutile car
--      le frontend gère maintenant les adresses NULL/incomplètes.
--      → Remplacé par COALESCE pour retourner une chaîne vide au lieu d'un
--      placeholder qui causait des faux négatifs.
-- ============================================================================

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_user_email TEXT;
  v_tenant_data JSONB;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_notifications JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_kyc_status TEXT := 'pending';
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil ET l'email de l'utilisateur
  SELECT p.id, u.email,
         jsonb_build_object(
           'id', p.id,
           'prenom', p.prenom,
           'nom', p.nom,
           'email', u.email,
           'telephone', p.telephone,
           'avatar_url', p.avatar_url
         )
  INTO v_profile_id, v_user_email, v_tenant_data
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = p_tenant_user_id AND p.role = 'tenant';

  IF v_profile_id IS NULL THEN
    RAISE NOTICE '[tenant_dashboard] Aucun profil trouvé pour user_id: %', p_tenant_user_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE '[tenant_dashboard] Profil trouvé: %, email: %', v_profile_id, v_user_email;

  -- 2. Récupérer TOUS les baux avec données techniques enrichies + clés + compteurs
  --    ✅ FIX: LEFT JOIN sur owner_prof pour ne pas perdre les baux si le propriétaire manque
  --    ✅ FIX: Inclure 'draft' pour que le locataire voie le bail dès qu'il est invité
  SELECT jsonb_agg(lease_data ORDER BY lease_data->>'statut' = 'active' DESC, lease_data->>'created_at' DESC)
  INTO v_leases
  FROM (
    SELECT
      jsonb_build_object(
        'id', l.id,
        'type_bail', l.type_bail,
        'statut', l.statut,
        'loyer', l.loyer,
        'charges_forfaitaires', l.charges_forfaitaires,
        'depot_de_garantie', l.depot_de_garantie,
        'date_debut', l.date_debut,
        'date_fin', l.date_fin,
        'created_at', l.created_at,
        -- Signataires complets avec profils + invited fallback
        'signers', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', ls2.id,
              'profile_id', ls2.profile_id,
              'role', ls2.role,
              'signature_status', ls2.signature_status,
              'signed_at', ls2.signed_at,
              'invited_name', ls2.invited_name,
              'invited_email', ls2.invited_email,
              'prenom', COALESCE(p_sig.prenom, SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 1)),
              'nom', COALESCE(p_sig.nom, NULLIF(SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 2), '')),
              'avatar_url', p_sig.avatar_url
            )
          ), '[]'::jsonb)
          FROM lease_signers ls2
          LEFT JOIN profiles p_sig ON p_sig.id = ls2.profile_id
          WHERE ls2.lease_id = l.id
        ),
        -- Propriété avec champs techniques complets
        'property', jsonb_build_object(
          'id', p.id,
          'owner_id', p.owner_id,
          'adresse_complete', p.adresse_complete,
          'ville', COALESCE(p.ville, ''),
          'code_postal', COALESCE(p.code_postal, ''),
          'type', COALESCE(p.type, 'appartement'),
          'surface', p.surface,
          'surface_habitable_m2', p.surface_habitable_m2,
          'nb_pieces', p.nb_pieces,
          'etage', p.etage,
          'ascenseur', p.ascenseur,
          'annee_construction', p.annee_construction,
          'parking_numero', p.parking_numero,
          'has_cave', p.has_cave,
          'num_lot', p.num_lot,
          'digicode', p.digicode,
          'interphone', p.interphone,
          -- DPE complet : COALESCE pour supporter ancien + nouveau nommage
          'energie', p.energie,
          'ges', p.ges,
          'dpe_classe_energie', COALESCE(p.dpe_classe_energie, p.energie),
          'dpe_classe_climat', COALESCE(p.dpe_classe_climat, p.ges),
          'dpe_consommation', p.dpe_consommation,
          'dpe_emissions', p.dpe_emissions,
          'dpe_date_realisation', p.dpe_date_realisation,
          'dpe_date_expiration', p.dpe_date_expiration,
          -- Caractéristiques techniques
          'chauffage_type', p.chauffage_type,
          'chauffage_energie', p.chauffage_energie,
          'eau_chaude_type', p.eau_chaude_type,
          'regime', p.regime,
          -- Photo de couverture
          'cover_url', (
            SELECT url FROM property_photos
            WHERE property_id = p.id AND is_main = true
            LIMIT 1
          ),
          -- Compteurs actifs avec dernière lecture
          'meters', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', m.id,
                'type', m.type,
                'serial_number', m.serial_number,
                'unit', m.unit,
                'last_reading_value', (
                  SELECT reading_value FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                ),
                'last_reading_date', (
                  SELECT reading_date FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                )
              )
            ), '[]'::jsonb)
            FROM meters m
            WHERE m.property_id = p.id AND m.is_active = true
          ),
          -- Clés depuis le dernier EDL signé ou complété
          'keys', (
            SELECT e_keys.keys
            FROM edl e_keys
            WHERE e_keys.property_id = p.id
              AND e_keys.status IN ('signed', 'completed')
              AND e_keys.keys IS NOT NULL
              AND e_keys.keys != '[]'::jsonb
            ORDER BY COALESCE(e_keys.completed_date, e_keys.created_at) DESC
            LIMIT 1
          )
        ),
        -- Propriétaire (peut être NULL si owner_prof manquant)
        'owner', CASE
          WHEN owner_prof.id IS NOT NULL THEN
            jsonb_build_object(
              'id', owner_prof.id,
              'name', COALESCE(
                (SELECT raison_sociale FROM owner_profiles WHERE profile_id = owner_prof.id),
                CONCAT(COALESCE(owner_prof.prenom, ''), ' ', COALESCE(owner_prof.nom, ''))
              ),
              'email', owner_prof.email,
              'telephone', owner_prof.telephone
            )
          ELSE
            jsonb_build_object(
              'id', p.owner_id,
              'name', 'Propriétaire',
              'email', NULL,
              'telephone', NULL
            )
        END
      ) as lease_data
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    LEFT JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE
      (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
      AND l.statut IN ('draft', 'active', 'pending_signature', 'fully_signed', 'terminated')
  ) sub;

  RAISE NOTICE '[tenant_dashboard] Baux trouvés: %', COALESCE(jsonb_array_length(v_leases), 0);

  -- 3. Factures (10 dernières)
  SELECT COALESCE(jsonb_agg(invoice_data), '[]'::jsonb) INTO v_invoices
  FROM (
    SELECT
      i.id,
      i.periode,
      i.montant_total,
      i.statut,
      i.created_at,
      i.due_date,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Tickets récents (10 derniers)
  SELECT COALESCE(jsonb_agg(ticket_data), '[]'::jsonb) INTO v_tickets
  FROM (
    SELECT
      t.id,
      t.titre,
      t.description,
      t.priorite,
      t.statut,
      t.created_at,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Notifications récentes
  SELECT COALESCE(jsonb_agg(notif_data), '[]'::jsonb) INTO v_notifications
  FROM (
    SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at, n.action_url
    FROM notifications n
    WHERE n.profile_id = v_profile_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 5
  ) notif_data;

  -- 6. EDLs en attente de signature
  SELECT COALESCE(jsonb_agg(edl_data), '[]'::jsonb) INTO v_pending_edls
  FROM (
    SELECT
      e.id,
      e.type,
      e.status,
      e.scheduled_at,
      es.invitation_token,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    JOIN properties p ON p.id = e.property_id
    WHERE (es.signer_profile_id = v_profile_id OR LOWER(es.signer_email) = LOWER(v_user_email))
    AND es.signed_at IS NULL
    AND e.status IN ('draft', 'scheduled', 'in_progress', 'completed')
    ORDER BY e.created_at DESC
  ) edl_data;

  -- 7. Vérifier l'assurance
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 8. Stats globales
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(i.montant_total) FILTER (WHERE i.statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE i.statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(
      (SELECT SUM(l2.loyer + l2.charges_forfaitaires)
       FROM leases l2
       JOIN lease_signers ls2 ON ls2.lease_id = l2.id
       WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
       AND l2.statut = 'active'),
      0
    ),
    'active_leases_count', (
      SELECT COUNT(DISTINCT l2.id)
      FROM leases l2
      JOIN lease_signers ls2 ON ls2.lease_id = l2.id
      WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
      AND l2.statut = 'active'
    )
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  LEFT JOIN invoices i ON i.lease_id = l.id
  WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email));

  -- 9. KYC status
  BEGIN
    SELECT COALESCE(tp.kyc_status, 'pending') INTO v_kyc_status
    FROM tenant_profiles tp
    WHERE tp.profile_id = v_profile_id;
  EXCEPTION WHEN OTHERS THEN
    v_kyc_status := 'pending';
  END;

  -- 10. Assembler le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'tenant', v_tenant_data,
    'kyc_status', COALESCE(v_kyc_status, 'pending'),
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'lease', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN v_leases->0 ELSE NULL END,
    'property', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN (v_leases->0)->'property' ELSE NULL END,
    'invoices', v_invoices,
    'tickets', v_tickets,
    'notifications', v_notifications,
    'pending_edls', v_pending_edls,
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION tenant_dashboard(UUID) IS
'RPC dashboard locataire v6. Cherche par profile_id OU invited_email.
FIX: LEFT JOIN sur owner_prof pour ne pas perdre les baux si le propriétaire manque.
FIX: adresse_complete retourné tel quel (le frontend gère les NULL).
Inclut baux draft, signers enrichis, property complète (DPE, meters, keys), insurance, KYC status.';


-- === MIGRATION: 20260222200000_ensure_all_owners_have_entity.sql ===
-- ============================================
-- Migration: S'assurer que tous les propriétaires ont une entité juridique
-- Date: 2026-02-22
-- Description:
--   Backfill idempotent : crée une entité "particulier" pour chaque owner_profiles
--   qui n'en a pas, puis lie les propriétés orphelines à l'entité par défaut.
-- Idempotent: peut être exécutée plusieurs fois sans effet secondaire.
-- ============================================

BEGIN;

-- Créer legal_entities manquantes pour les propriétaires
INSERT INTO legal_entities (owner_profile_id, entity_type, nom, regime_fiscal, is_active)
SELECT op.profile_id, 'particulier',
  COALESCE(TRIM(CONCAT(p.prenom, ' ', p.nom)), 'Patrimoine personnel'), 'ir', true
FROM owner_profiles op
JOIN profiles p ON op.profile_id = p.id
WHERE NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.owner_profile_id = op.profile_id);

-- Lier les propriétés orphelines à l'entité par défaut du propriétaire
UPDATE properties p
SET legal_entity_id = (
  SELECT le.id FROM legal_entities le
  WHERE le.owner_profile_id = p.owner_id
  ORDER BY le.created_at ASC
  LIMIT 1
)
WHERE p.legal_entity_id IS NULL
  AND p.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM legal_entities le WHERE le.owner_profile_id = p.owner_id);

COMMIT;


-- === MIGRATION: 20260222200001_get_entity_stats_for_store.sql ===
-- ============================================
-- Migration: get_entity_stats aligné avec la logique du store (properties.legal_entity_id + particulier)
-- Date: 2026-02-22
-- Description:
--   Remplace get_entity_stats pour compter comme le store front :
--   - Biens : properties.legal_entity_id = entity OU (particulier et legal_entity_id IS NULL)
--   - Baux actifs : signatory_entity_id = entity, statut in (active, pending_signature, fully_signed)
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
  WITH entity_props AS (
    SELECT
      le.id AS eid,
      COUNT(DISTINCT p.id) AS prop_count
    FROM legal_entities le
    LEFT JOIN properties p ON p.deleted_at IS NULL
      AND (
        p.legal_entity_id = le.id
        OR (le.entity_type = 'particulier' AND p.owner_id = le.owner_profile_id AND p.legal_entity_id IS NULL)
      )
    WHERE le.owner_profile_id = p_owner_profile_id
      AND le.is_active = true
    GROUP BY le.id
  ),
  entity_leases AS (
    SELECT
      l.signatory_entity_id AS eid,
      COUNT(*) AS lease_count
    FROM leases l
    WHERE l.signatory_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id = p_owner_profile_id AND is_active = true
    )
    AND l.statut IN ('active', 'pending_signature', 'fully_signed')
    GROUP BY l.signatory_entity_id
  )
  SELECT
    le.id AS entity_id,
    le.nom AS entity_name,
    le.entity_type,
    le.regime_fiscal,
    COALESCE(ep.prop_count, 0)::BIGINT AS properties_count,
    0::DECIMAL(14,2) AS total_value,
    0::DECIMAL(12,2) AS monthly_rent,
    COALESCE(el.lease_count, 0)::BIGINT AS active_leases
  FROM legal_entities le
  LEFT JOIN entity_props ep ON ep.eid = le.id
  LEFT JOIN entity_leases el ON el.eid = le.id
  WHERE le.owner_profile_id = p_owner_profile_id
    AND le.is_active = true
  ORDER BY properties_count DESC, le.nom;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- === MIGRATION: 20260223000001_auto_fill_document_fk.sql ===
-- =====================================================
-- MIGRATION SOTA 2026: Auto-complétion des FK documents
-- Date: 2026-02-23
--
-- PROBLÈME CORRIGÉ:
--   Quand un document est créé avec seulement lease_id,
--   property_id et owner_id restent NULL → le propriétaire ne le voit pas.
--   Inversement, un document créé par le propriétaire sans tenant_id
--   empêche le locataire de le voir via tenant_id direct.
--
-- FIX:
--   1. Trigger BEFORE INSERT/UPDATE : auto-remplit property_id depuis lease_id,
--      owner_id depuis property_id, tenant_id depuis lease_signers.
--   2. Fix rétroactif : corrige les documents existants.
--
-- SÉCURITÉ:
--   - Exception handler non-bloquant (ne casse jamais l'INSERT/UPDATE)
--   - SECURITY DEFINER pour accéder aux tables liées sans RLS
--   - Additive : ne supprime ni ne modifie aucun trigger existant
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-complétion des FK documents
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_fill_document_fk()
RETURNS TRIGGER AS $$
BEGIN
  -- Étape 1 : Dériver property_id depuis lease_id
  IF NEW.property_id IS NULL AND NEW.lease_id IS NOT NULL THEN
    SELECT COALESCE(property_id, (SELECT property_id FROM units WHERE id = unit_id))
    INTO NEW.property_id
    FROM public.leases
    WHERE id = NEW.lease_id;
  END IF;

  -- Étape 2 : Dériver owner_id depuis property_id
  IF NEW.owner_id IS NULL AND NEW.property_id IS NOT NULL THEN
    SELECT owner_id INTO NEW.owner_id
    FROM public.properties
    WHERE id = NEW.property_id;
  END IF;

  -- Étape 3 : Dériver tenant_id depuis lease_signers (locataire principal)
  IF NEW.tenant_id IS NULL AND NEW.lease_id IS NOT NULL THEN
    SELECT ls.profile_id INTO NEW.tenant_id
    FROM public.lease_signers ls
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'locataire', 'tenant')
      AND ls.profile_id IS NOT NULL
    ORDER BY ls.created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_fill_document_fk] Non-blocking error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.auto_fill_document_fk() IS
  'SOTA 2026: Auto-remplit property_id (depuis lease), owner_id (depuis property), et tenant_id (depuis lease_signers) pour garantir la visibilité inter-comptes des documents.';

-- ============================================
-- 2. TRIGGER: Exécuter BEFORE INSERT OR UPDATE sur documents
--    (s''exécute avant les triggers search_vector, ged_status, etc.)
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_fill_document_fk ON public.documents;

CREATE TRIGGER trigger_auto_fill_document_fk
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_document_fk();

-- ============================================
-- 3. FIX RÉTROACTIF A : property_id depuis lease_id
-- ============================================
DO $$
DECLARE
  fixed_count INT;
BEGIN
  UPDATE public.documents d
  SET property_id = l.property_id
  FROM public.leases l
  WHERE d.lease_id = l.id
    AND d.property_id IS NULL
    AND l.property_id IS NOT NULL;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  IF fixed_count > 0 THEN
    RAISE NOTICE '[fix_A] % documents: property_id rempli depuis lease_id', fixed_count;
  ELSE
    RAISE NOTICE '[fix_A] Aucun document sans property_id à corriger';
  END IF;
END $$;

-- ============================================
-- 4. FIX RÉTROACTIF B : owner_id depuis property_id
-- ============================================
DO $$
DECLARE
  fixed_count INT;
BEGIN
  UPDATE public.documents d
  SET owner_id = p.owner_id
  FROM public.properties p
  WHERE d.property_id = p.id
    AND d.owner_id IS NULL
    AND p.owner_id IS NOT NULL;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  IF fixed_count > 0 THEN
    RAISE NOTICE '[fix_B] % documents: owner_id rempli depuis property_id', fixed_count;
  ELSE
    RAISE NOTICE '[fix_B] Aucun document sans owner_id à corriger';
  END IF;
END $$;

-- ============================================
-- 5. FIX RÉTROACTIF C : tenant_id depuis lease_signers
-- ============================================
DO $$
DECLARE
  fixed_count INT;
BEGIN
  UPDATE public.documents d
  SET tenant_id = sub.profile_id
  FROM (
    SELECT DISTINCT ON (ls.lease_id)
      ls.lease_id,
      ls.profile_id
    FROM public.lease_signers ls
    WHERE ls.role IN ('locataire_principal', 'locataire', 'tenant')
      AND ls.profile_id IS NOT NULL
    ORDER BY ls.lease_id, ls.created_at ASC
  ) sub
  WHERE d.lease_id = sub.lease_id
    AND d.tenant_id IS NULL;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  IF fixed_count > 0 THEN
    RAISE NOTICE '[fix_C] % documents: tenant_id rempli depuis lease_signers', fixed_count;
  ELSE
    RAISE NOTICE '[fix_C] Aucun document sans tenant_id à corriger';
  END IF;
END $$;

-- ============================================
-- 6. AUDIT : Vérifier l'état final
-- ============================================
DO $$
DECLARE
  docs_no_owner INT;
  docs_no_property INT;
  docs_no_tenant INT;
BEGIN
  SELECT count(*)::INT INTO docs_no_owner
  FROM public.documents
  WHERE owner_id IS NULL
    AND (property_id IS NOT NULL OR lease_id IS NOT NULL);

  SELECT count(*)::INT INTO docs_no_property
  FROM public.documents
  WHERE property_id IS NULL
    AND lease_id IS NOT NULL;

  SELECT count(*)::INT INTO docs_no_tenant
  FROM public.documents
  WHERE tenant_id IS NULL
    AND lease_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM lease_signers ls
      WHERE ls.lease_id = documents.lease_id
        AND ls.role IN ('locataire_principal', 'locataire', 'tenant')
        AND ls.profile_id IS NOT NULL
    );

  RAISE NOTICE '=== AUDIT DOCUMENTS FK ===';
  RAISE NOTICE 'Documents avec property/lease mais sans owner_id: %', docs_no_owner;
  RAISE NOTICE 'Documents avec lease_id mais sans property_id: %', docs_no_property;
  RAISE NOTICE 'Documents avec bail+locataire mais sans tenant_id: %', docs_no_tenant;

  IF docs_no_owner = 0 AND docs_no_property = 0 THEN
    RAISE NOTICE '✅ Tous les documents ont des FK cohérentes';
  END IF;
END $$;

COMMIT;


-- === MIGRATION: 20260223000002_document_access_views.sql ===
-- =====================================================
-- MIGRATION SOTA 2026: Vues d'accès documents optimisées
-- Date: 2026-02-23
--
-- PROBLÈME CORRIGÉ:
--   Le hook use-documents.ts fait 3 requêtes séparées pour le locataire
--   (directDocs, leaseDocs, propertyDocs) + déduplication côté client.
--   Le propriétaire fait 2 requêtes (ownerDocs, propertyDocs).
--   C'est lent, fragile, et source de bugs de visibilité.
--
-- FIX:
--   Deux vues read-only qui unifient la logique de visibilité :
--   - v_tenant_accessible_documents : tout ce qu'un locataire peut voir
--   - v_owner_accessible_documents : tout ce qu'un propriétaire peut voir
--
-- SÉCURITÉ:
--   - Vues read-only (SELECT uniquement)
--   - Utilisent user_profile_id() SECURITY DEFINER (déjà existant et testé)
--   - Additives : aucun impact sur INSERT/UPDATE/DELETE des documents
--   - RLS hérité de la table documents (les vues ne contournent pas RLS)
-- =====================================================

BEGIN;

-- ============================================
-- 1. VUE LOCATAIRE : Documents accessibles
-- ============================================
CREATE OR REPLACE VIEW public.v_tenant_accessible_documents AS
SELECT DISTINCT ON (d.id) d.*
FROM public.documents d
WHERE
  -- Documents directement liés au locataire
  d.tenant_id = public.user_profile_id()
  -- Documents liés aux baux du locataire
  OR d.lease_id IN (
    SELECT ls.lease_id
    FROM public.lease_signers ls
    WHERE ls.profile_id = public.user_profile_id()
  )
  -- Documents partagés de la propriété (diagnostics, EDL, etc.)
  OR (
    d.property_id IN (
      SELECT l.property_id
      FROM public.leases l
      JOIN public.lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = public.user_profile_id()
        AND l.property_id IS NOT NULL
    )
    AND d.type IN (
      'diagnostic_performance', 'dpe', 'erp', 'crep', 'amiante',
      'electricite', 'gaz', 'reglement_copro', 'notice_information',
      'EDL_entree', 'EDL_sortie', 'edl', 'edl_entree', 'edl_sortie'
    )
  );

COMMENT ON VIEW public.v_tenant_accessible_documents IS
  'SOTA 2026: Vue unifiée de tous les documents accessibles par le locataire connecté (via tenant_id, lease_id, ou property_id pour les types partagés).';

-- ============================================
-- 2. VUE PROPRIÉTAIRE : Documents accessibles
-- ============================================
CREATE OR REPLACE VIEW public.v_owner_accessible_documents AS
SELECT DISTINCT ON (d.id) d.*
FROM public.documents d
WHERE
  -- Documents directement liés au propriétaire
  d.owner_id = public.user_profile_id()
  -- Documents liés à ses propriétés (y compris ceux uploadés par les locataires)
  OR d.property_id IN (
    SELECT p.id
    FROM public.properties p
    WHERE p.owner_id = public.user_profile_id()
  );

COMMENT ON VIEW public.v_owner_accessible_documents IS
  'SOTA 2026: Vue unifiée de tous les documents accessibles par le propriétaire connecté (via owner_id ou property_id).';

-- ============================================
-- 3. GRANTS pour les rôles authentifiés
-- ============================================
GRANT SELECT ON public.v_tenant_accessible_documents TO authenticated;
GRANT SELECT ON public.v_owner_accessible_documents TO authenticated;

COMMIT;


-- === MIGRATION: 20260223000003_notify_owner_on_tenant_document.sql ===
-- =====================================================
-- MIGRATION SOTA 2026: Notification propriétaire sur dépôt document locataire
-- Date: 2026-02-23
--
-- PROBLÈME CORRIGÉ:
--   Le trigger trg_notify_tenant_document_center notifie le locataire
--   quand un document lui est ajouté. Mais AUCUNE notification n'existait
--   côté propriétaire quand le locataire dépose un document (assurance,
--   identité, justificatifs, etc.).
--
-- FIX:
--   Trigger AFTER INSERT sur documents qui crée une notification pour
--   le propriétaire lorsque tenant_id ET owner_id sont renseignés.
--
-- SÉCURITÉ:
--   - AFTER INSERT : s'exécute après auto_fill_document_fk (BEFORE)
--   - Exception handler non-bloquant
--   - WHEN clause pour filtrer au niveau trigger (pas de surcoût)
--   - Utilise create_notification() existante
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Notifier le propriétaire
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_owner_on_tenant_document()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_name TEXT;
  v_doc_label TEXT;
BEGIN
  -- Récupérer le nom du locataire
  SELECT COALESCE(
    NULLIF(TRIM(COALESCE(prenom, '') || ' ' || COALESCE(nom, '')), ''),
    email,
    'Un locataire'
  )
  INTO v_tenant_name
  FROM public.profiles
  WHERE id = NEW.tenant_id;

  -- Label lisible pour le type de document
  v_doc_label := CASE NEW.type
    WHEN 'attestation_assurance' THEN 'attestation d''assurance'
    WHEN 'cni_recto' THEN 'pièce d''identité (recto)'
    WHEN 'cni_verso' THEN 'pièce d''identité (verso)'
    WHEN 'piece_identite' THEN 'pièce d''identité'
    WHEN 'passeport' THEN 'passeport'
    WHEN 'titre_sejour' THEN 'titre de séjour'
    WHEN 'justificatif_revenus' THEN 'justificatif de revenus'
    WHEN 'avis_imposition' THEN 'avis d''imposition'
    WHEN 'bulletin_paie' THEN 'bulletin de paie'
    WHEN 'rib' THEN 'RIB'
    WHEN 'attestation_loyer' THEN 'attestation de loyer'
    ELSE COALESCE(NEW.type, 'document')
  END;

  -- Utiliser la fonction create_notification existante
  PERFORM create_notification(
    NEW.owner_id,
    'document_uploaded',
    'Nouveau document déposé',
    v_tenant_name || ' a déposé : ' || v_doc_label,
    '/owner/documents',
    NEW.id,
    'document'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_owner_on_tenant_document] Non-blocking: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.notify_owner_on_tenant_document() IS
  'SOTA 2026: Notifie le propriétaire quand un locataire dépose un document (assurance, identité, etc.)';

-- ============================================
-- 2. TRIGGER: Exécuter AFTER INSERT quand tenant_id et owner_id sont set
-- ============================================
DROP TRIGGER IF EXISTS trigger_notify_owner_on_tenant_document ON public.documents;

CREATE TRIGGER trigger_notify_owner_on_tenant_document
  AFTER INSERT ON public.documents
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NOT NULL AND NEW.owner_id IS NOT NULL
        AND NEW.uploaded_by IS NOT NULL
        AND NEW.tenant_id = NEW.uploaded_by)
  EXECUTE FUNCTION public.notify_owner_on_tenant_document();

COMMIT;


-- === MIGRATION: 20260223100000_fix_entity_connections.sql ===
-- ============================================================================
-- Migration: Correction des connexions entites juridiques
-- Date: 2026-02-23
-- Description:
--   1. Backfill leases.signatory_entity_id pour TOUS les baux
--   2. Backfill invoices.issuer_entity_id pour toutes les factures
--   3. Backfill documents.entity_id pour tous les documents
--   4. Backfill property_ownership manquants
--   5. Triggers auto-propagation entity sur INSERT (properties, leases, invoices)
--   6. Corriger get_entity_stats avec total_value et monthly_rent reels
-- Idempotent: peut etre executee plusieurs fois sans effet secondaire.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. BACKFILL : properties.legal_entity_id (re-passe pour les nouvelles)
-- ============================================================================

UPDATE properties p
SET legal_entity_id = (
  SELECT le.id FROM legal_entities le
  WHERE le.owner_profile_id = p.owner_id
    AND le.is_active = true
  ORDER BY le.created_at ASC
  LIMIT 1
)
WHERE p.legal_entity_id IS NULL
  AND p.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM legal_entities le
    WHERE le.owner_profile_id = p.owner_id
      AND le.is_active = true
  );

-- ============================================================================
-- 2. BACKFILL : leases.signatory_entity_id (TOUS les statuts)
-- ============================================================================

UPDATE leases l
SET signatory_entity_id = p.legal_entity_id
FROM properties p
WHERE l.property_id = p.id
  AND l.signatory_entity_id IS NULL
  AND p.legal_entity_id IS NOT NULL;

-- Pour les baux via unit_id (colocation)
UPDATE leases l
SET signatory_entity_id = p.legal_entity_id
FROM units u
JOIN properties p ON u.property_id = p.id
WHERE l.unit_id = u.id
  AND l.property_id IS NULL
  AND l.signatory_entity_id IS NULL
  AND p.legal_entity_id IS NOT NULL;

-- ============================================================================
-- 3. BACKFILL : invoices.issuer_entity_id
-- ============================================================================

UPDATE invoices i
SET issuer_entity_id = l.signatory_entity_id
FROM leases l
WHERE i.lease_id = l.id
  AND i.issuer_entity_id IS NULL
  AND l.signatory_entity_id IS NOT NULL;

-- ============================================================================
-- 4. BACKFILL : documents.entity_id via property
-- ============================================================================

UPDATE documents d
SET entity_id = p.legal_entity_id
FROM properties p
WHERE d.property_id = p.id
  AND d.entity_id IS NULL
  AND p.legal_entity_id IS NOT NULL;

-- Documents lies a un bail (via lease_id → property → legal_entity)
UPDATE documents d
SET entity_id = p.legal_entity_id
FROM leases l
JOIN properties p ON l.property_id = p.id
WHERE d.lease_id = l.id
  AND d.entity_id IS NULL
  AND d.property_id IS NULL
  AND p.legal_entity_id IS NOT NULL;

-- ============================================================================
-- 5. BACKFILL : property_ownership manquants
-- ============================================================================

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
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM property_ownership po
    WHERE po.property_id = p.id
  );

-- ============================================================================
-- 6. TRIGGER : Auto-remplir legal_entity_id sur nouvelle propriete
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_set_property_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.legal_entity_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    NEW.legal_entity_id := (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = NEW.owner_id
        AND is_active = true
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_set_property_entity ON properties;
CREATE TRIGGER trg_auto_set_property_entity
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_property_entity();

-- ============================================================================
-- 7. TRIGGER : Auto-remplir signatory_entity_id sur nouveau bail
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_set_lease_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.signatory_entity_id IS NULL THEN
    IF NEW.property_id IS NOT NULL THEN
      NEW.signatory_entity_id := (
        SELECT legal_entity_id FROM properties WHERE id = NEW.property_id
      );
    ELSIF NEW.unit_id IS NOT NULL THEN
      NEW.signatory_entity_id := (
        SELECT p.legal_entity_id
        FROM units u
        JOIN properties p ON u.property_id = p.id
        WHERE u.id = NEW.unit_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_set_lease_entity ON leases;
CREATE TRIGGER trg_auto_set_lease_entity
  BEFORE INSERT ON leases
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_lease_entity();

-- ============================================================================
-- 8. TRIGGER : Auto-remplir issuer_entity_id sur nouvelle facture
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_set_invoice_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.issuer_entity_id IS NULL AND NEW.lease_id IS NOT NULL THEN
    NEW.issuer_entity_id := (
      SELECT signatory_entity_id FROM leases WHERE id = NEW.lease_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_set_invoice_entity ON invoices;
CREATE TRIGGER trg_auto_set_invoice_entity
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_invoice_entity();

-- ============================================================================
-- 9. CORRIGER get_entity_stats : total_value et monthly_rent reels
-- ============================================================================

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
  WITH entity_props AS (
    SELECT
      le.id AS eid,
      COUNT(DISTINCT p.id) AS prop_count,
      COALESCE(SUM(p.loyer_hc), 0) AS rent_sum
    FROM legal_entities le
    LEFT JOIN properties p ON p.deleted_at IS NULL
      AND (
        p.legal_entity_id = le.id
        OR (le.entity_type = 'particulier' AND p.owner_id = le.owner_profile_id AND p.legal_entity_id IS NULL)
      )
    WHERE le.owner_profile_id = p_owner_profile_id
      AND le.is_active = true
    GROUP BY le.id
  ),
  entity_values AS (
    SELECT
      po.legal_entity_id AS eid,
      COALESCE(SUM(po.prix_acquisition), 0) AS total_val
    FROM property_ownership po
    WHERE po.legal_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id = p_owner_profile_id AND is_active = true
    )
    AND po.is_current = true
    GROUP BY po.legal_entity_id
  ),
  entity_leases AS (
    SELECT
      l.signatory_entity_id AS eid,
      COUNT(*) AS lease_count
    FROM leases l
    WHERE l.signatory_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id = p_owner_profile_id AND is_active = true
    )
    AND l.statut IN ('active', 'pending_signature', 'fully_signed')
    GROUP BY l.signatory_entity_id
  )
  SELECT
    le.id AS entity_id,
    le.nom AS entity_name,
    le.entity_type,
    le.regime_fiscal,
    COALESCE(ep.prop_count, 0)::BIGINT AS properties_count,
    COALESCE(ev.total_val, 0)::DECIMAL(14,2) AS total_value,
    COALESCE(ep.rent_sum, 0)::DECIMAL(12,2) AS monthly_rent,
    COALESCE(el.lease_count, 0)::BIGINT AS active_leases
  FROM legal_entities le
  LEFT JOIN entity_props ep ON ep.eid = le.id
  LEFT JOIN entity_values ev ON ev.eid = le.id
  LEFT JOIN entity_leases el ON el.eid = le.id
  WHERE le.owner_profile_id = p_owner_profile_id
    AND le.is_active = true
  ORDER BY properties_count DESC, le.nom;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;


-- === MIGRATION: 20260224000000_fix_tenant_sync_and_notifications.sql ===
-- =====================================================
-- Migration: Fix tenant data sync — liaison orpheline + notifications manquantes
-- Date: 2026-02-24
--
-- Contexte: Bug critique où le compte locataire est isolé malgré un bail signé
-- côté propriétaire. Causes: lease_signers.profile_id NULL (auto-link raté),
-- profiles.email manquant, notifications jamais créées.
--
-- Actions (toutes idempotentes):
-- 1. Re-lier les lease_signers orphelins (profile_id NULL + email matche auth)
-- 2. Backfill profiles.email depuis auth.users
-- 3. Backfill notifications pour locataires avec bail actif sans notification
-- 4. Diagnostic final
-- =====================================================

BEGIN;

-- ============================================
-- 1. ORPHAN LINKING: lease_signers avec profile_id NULL
-- ============================================
-- Pour chaque lease_signer dont le profile_id est NULL mais dont l'invited_email
-- correspond à un compte auth existant, on lie automatiquement.
UPDATE public.lease_signers ls
SET profile_id = p.id
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

-- ============================================
-- 2. BACKFILL: profiles.email depuis auth.users
-- ============================================
-- Certains profils n'ont pas d'email renseigné, ce qui empêche certaines
-- recherches de fonctionner. On récupère l'email depuis auth.users.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.user_id
  AND (p.email IS NULL OR TRIM(p.email) = '');

-- ============================================
-- 3. BACKFILL: notifications pour locataires avec bail actif
-- ============================================
-- Crée une notification "bail activé" pour chaque locataire lié à un bail
-- actif/fully_signed qui n'a jamais reçu de notification de type lease_activated.
INSERT INTO public.notifications (user_id, profile_id, type, title, body, is_read, metadata)
SELECT DISTINCT
  p.user_id,
  p.id,
  'lease_activated',
  'Bail activé',
  'Votre bail a été activé. Vous pouvez désormais accéder à toutes les fonctionnalités de votre espace locataire.',
  false,
  jsonb_build_object('lease_id', l.id, 'auto_backfill', true)
FROM public.lease_signers ls
JOIN public.leases l ON l.id = ls.lease_id
JOIN public.profiles p ON p.id = ls.profile_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND l.statut IN ('active', 'fully_signed')
  AND p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.profile_id = p.id
      AND n.type = 'lease_activated'
  );

-- ============================================
-- 4. DIAGNOSTIC FINAL
-- ============================================
DO $$
DECLARE
  orphans INT;
  backfilled INT;
  linked INT;
BEGIN
  -- Compter les orphelins restants (email valide sans compte)
  SELECT count(*)::INT INTO orphans
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND TRIM(invited_email) != ''
    AND invited_email NOT LIKE '%@a-definir%'
    AND invited_email NOT LIKE '%@placeholder%';

  -- Compter les notifications backfillées
  SELECT count(*)::INT INTO backfilled
  FROM public.notifications
  WHERE metadata->>'auto_backfill' = 'true';

  -- Compter les lease_signers liés par cette migration
  SELECT count(*)::INT INTO linked
  FROM public.lease_signers
  WHERE profile_id IS NOT NULL;

  RAISE NOTICE '[fix_tenant_sync] Orphelins restants: % | Notifications backfillées: % | Signers liés total: %',
    orphans, backfilled, linked;

  IF orphans > 0 THEN
    RAISE NOTICE '[fix_tenant_sync] Les % orphelins restants correspondent à des emails sans compte créé (attendu)', orphans;
  ELSE
    RAISE NOTICE '[fix_tenant_sync] Tous les signers avec email valide sont liés';
  END IF;
END $$;

COMMIT;


-- === MIGRATION: 20260224100000_fix_tenant_dashboard_notifications_query.sql ===
-- ============================================================================
-- MIGRATION: Fix tenant_dashboard RPC — notification query includes user_id
-- Date: 2026-02-24
--
-- PROBLEM:
--   The notification sub-query in tenant_dashboard only searches by profile_id.
--   Notifications created with user_id but without profile_id (e.g. from
--   process-outbox or direct inserts) are invisible to the tenant.
--
-- FIX: Add OR n.user_id = p_tenant_user_id to the notification query.
-- ============================================================================

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_user_email TEXT;
  v_tenant_data JSONB;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_notifications JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_kyc_status TEXT := 'pending';
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil ET l'email de l'utilisateur
  SELECT p.id, u.email,
         jsonb_build_object(
           'id', p.id,
           'prenom', p.prenom,
           'nom', p.nom,
           'email', u.email,
           'telephone', p.telephone,
           'avatar_url', p.avatar_url
         )
  INTO v_profile_id, v_user_email, v_tenant_data
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = p_tenant_user_id AND p.role = 'tenant';

  IF v_profile_id IS NULL THEN
    RAISE NOTICE '[tenant_dashboard] Aucun profil trouvé pour user_id: %', p_tenant_user_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE '[tenant_dashboard] Profil trouvé: %, email: %', v_profile_id, v_user_email;

  -- 2. Récupérer TOUS les baux avec données techniques enrichies + clés + compteurs
  --    ✅ FIX: Inclure 'draft' pour que le locataire voie le bail dès qu'il est invité
  SELECT jsonb_agg(lease_data ORDER BY lease_data->>'statut' = 'active' DESC, lease_data->>'created_at' DESC)
  INTO v_leases
  FROM (
    SELECT
      jsonb_build_object(
        'id', l.id,
        'type_bail', l.type_bail,
        'statut', l.statut,
        'loyer', l.loyer,
        'charges_forfaitaires', l.charges_forfaitaires,
        'depot_de_garantie', l.depot_de_garantie,
        'date_debut', l.date_debut,
        'date_fin', l.date_fin,
        'created_at', l.created_at,
        -- Signataires complets avec profils + invited fallback
        'signers', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', ls2.id,
              'profile_id', ls2.profile_id,
              'role', ls2.role,
              'signature_status', ls2.signature_status,
              'signed_at', ls2.signed_at,
              'invited_name', ls2.invited_name,
              'invited_email', ls2.invited_email,
              'prenom', COALESCE(p_sig.prenom, SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 1)),
              'nom', COALESCE(p_sig.nom, NULLIF(SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 2), '')),
              'avatar_url', p_sig.avatar_url
            )
          ), '[]'::jsonb)
          FROM lease_signers ls2
          LEFT JOIN profiles p_sig ON p_sig.id = ls2.profile_id
          WHERE ls2.lease_id = l.id
        ),
        -- Propriété avec champs techniques complets
        'property', jsonb_build_object(
          'id', p.id,
          'owner_id', p.owner_id,
          'adresse_complete', COALESCE(p.adresse_complete, 'Adresse à compléter'),
          'ville', COALESCE(p.ville, ''),
          'code_postal', COALESCE(p.code_postal, ''),
          'type', COALESCE(p.type, 'appartement'),
          'surface', p.surface,
          'surface_habitable_m2', p.surface_habitable_m2,
          'nb_pieces', p.nb_pieces,
          'etage', p.etage,
          'ascenseur', p.ascenseur,
          'annee_construction', p.annee_construction,
          'parking_numero', p.parking_numero,
          'has_cave', p.has_cave,
          'num_lot', p.num_lot,
          'digicode', p.digicode,
          'interphone', p.interphone,
          -- DPE complet : COALESCE pour supporter ancien + nouveau nommage
          'energie', p.energie,
          'ges', p.ges,
          'dpe_classe_energie', COALESCE(p.dpe_classe_energie, p.energie),
          'dpe_classe_climat', COALESCE(p.dpe_classe_climat, p.ges),
          'dpe_consommation', p.dpe_consommation,
          'dpe_emissions', p.dpe_emissions,
          'dpe_date_realisation', p.dpe_date_realisation,
          'dpe_date_expiration', p.dpe_date_expiration,
          -- Caractéristiques techniques
          'chauffage_type', p.chauffage_type,
          'chauffage_energie', p.chauffage_energie,
          'eau_chaude_type', p.eau_chaude_type,
          'regime', p.regime,
          -- Photo de couverture
          'cover_url', (
            SELECT url FROM property_photos
            WHERE property_id = p.id AND is_main = true
            LIMIT 1
          ),
          -- Compteurs actifs avec dernière lecture
          'meters', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', m.id,
                'type', m.type,
                'serial_number', m.serial_number,
                'unit', m.unit,
                'last_reading_value', (
                  SELECT reading_value FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                ),
                'last_reading_date', (
                  SELECT reading_date FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                )
              )
            ), '[]'::jsonb)
            FROM meters m
            WHERE m.property_id = p.id AND m.is_active = true
          ),
          -- Clés depuis le dernier EDL signé ou complété
          'keys', (
            SELECT e_keys.keys
            FROM edl e_keys
            WHERE e_keys.property_id = p.id
              AND e_keys.status IN ('signed', 'completed')
              AND e_keys.keys IS NOT NULL
              AND e_keys.keys != '[]'::jsonb
            ORDER BY COALESCE(e_keys.completed_date, e_keys.created_at) DESC
            LIMIT 1
          )
        ),
        -- Propriétaire
        'owner', jsonb_build_object(
          'id', owner_prof.id,
          'name', COALESCE(
            (SELECT raison_sociale FROM owner_profiles WHERE profile_id = owner_prof.id),
            CONCAT(COALESCE(owner_prof.prenom, ''), ' ', COALESCE(owner_prof.nom, ''))
          ),
          'email', owner_prof.email,
          'telephone', owner_prof.telephone
        )
      ) as lease_data
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE
      (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
      AND l.statut IN ('draft', 'active', 'pending_signature', 'fully_signed', 'terminated')
  ) sub;

  RAISE NOTICE '[tenant_dashboard] Baux trouvés: %', COALESCE(jsonb_array_length(v_leases), 0);

  -- 3. Factures (10 dernières)
  SELECT COALESCE(jsonb_agg(invoice_data), '[]'::jsonb) INTO v_invoices
  FROM (
    SELECT
      i.id,
      i.periode,
      i.montant_total,
      i.statut,
      i.created_at,
      i.due_date,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Tickets récents (10 derniers)
  SELECT COALESCE(jsonb_agg(ticket_data), '[]'::jsonb) INTO v_tickets
  FROM (
    SELECT
      t.id,
      t.titre,
      t.description,
      t.priorite,
      t.statut,
      t.created_at,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Notifications récentes
  --    ✅ FIX: Also check user_id so notifications created with only user_id are visible
  SELECT COALESCE(jsonb_agg(notif_data), '[]'::jsonb) INTO v_notifications
  FROM (
    SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at, n.action_url
    FROM notifications n
    WHERE n.profile_id = v_profile_id OR n.user_id = p_tenant_user_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 5
  ) notif_data;

  -- 6. EDLs en attente de signature
  SELECT COALESCE(jsonb_agg(edl_data), '[]'::jsonb) INTO v_pending_edls
  FROM (
    SELECT
      e.id,
      e.type,
      e.status,
      e.scheduled_at,
      es.invitation_token,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    JOIN properties p ON p.id = e.property_id
    WHERE (es.signer_profile_id = v_profile_id OR LOWER(es.signer_email) = LOWER(v_user_email))
    AND es.signed_at IS NULL
    AND e.status IN ('draft', 'scheduled', 'in_progress', 'completed')
    ORDER BY e.created_at DESC
  ) edl_data;

  -- 7. Vérifier l'assurance
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 8. Stats globales
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(i.montant_total) FILTER (WHERE i.statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE i.statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(
      (SELECT SUM(l2.loyer + l2.charges_forfaitaires)
       FROM leases l2
       JOIN lease_signers ls2 ON ls2.lease_id = l2.id
       WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
       AND l2.statut = 'active'),
      0
    ),
    'active_leases_count', (
      SELECT COUNT(DISTINCT l2.id)
      FROM leases l2
      JOIN lease_signers ls2 ON ls2.lease_id = l2.id
      WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
      AND l2.statut = 'active'
    )
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  LEFT JOIN invoices i ON i.lease_id = l.id
  WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email));

  -- 9. KYC status
  BEGIN
    SELECT COALESCE(tp.kyc_status, 'pending') INTO v_kyc_status
    FROM tenant_profiles tp
    WHERE tp.profile_id = v_profile_id;
  EXCEPTION WHEN OTHERS THEN
    v_kyc_status := 'pending';
  END;

  -- 10. Assembler le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'tenant', v_tenant_data,
    'kyc_status', COALESCE(v_kyc_status, 'pending'),
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'lease', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN v_leases->0 ELSE NULL END,
    'property', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN (v_leases->0)->'property' ELSE NULL END,
    'invoices', v_invoices,
    'tickets', v_tickets,
    'notifications', v_notifications,
    'pending_edls', v_pending_edls,
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION tenant_dashboard(UUID) IS
'RPC dashboard locataire v6. Cherche par profile_id OU invited_email.
FIX v6: Notification query also matches on user_id (not just profile_id).
Inclut: signers enrichis, property complète (DPE, meters, keys), insurance, KYC status.';


-- === MIGRATION: 20260303000000_backfill_uploaded_by.sql ===
-- =====================================================
-- MIGRATION: Backfill uploaded_by pour documents existants
-- Date: 2026-03-03
--
-- PROBLÈME:
--   - /api/documents/upload ne renseignait pas uploaded_by
--   - /api/documents/upload-batch ne le faisait que pour les galeries
--   => Les documents existants n'ont pas uploaded_by, ce qui empêche
--      la détection de source inter-compte (locataire vs propriétaire).
--
-- FIX:
--   Backfill uploaded_by en se basant sur le type de document et les FK.
--   Heuristique :
--     1. Types locataire (assurance, CNI, etc.) → uploaded_by = tenant_id
--     2. Types propriétaire (bail, quittance, etc.) → uploaded_by = owner_id
--     3. Documents avec owner_id seul (sans tenant) → uploaded_by = owner_id
--
-- SÉCURITÉ:
--   - UPDATE conditionnel (WHERE uploaded_by IS NULL)
--   - Ne touche pas aux documents déjà renseignés
--   - Non-bloquant : si aucune ligne à MAJ, pas d'effet
-- =====================================================

BEGIN;

-- 1. Documents typiquement uploadés par le locataire
UPDATE public.documents
SET uploaded_by = tenant_id
WHERE uploaded_by IS NULL
  AND tenant_id IS NOT NULL
  AND type IN (
    'attestation_assurance', 'cni_recto', 'cni_verso', 'piece_identite',
    'passeport', 'justificatif_revenus', 'avis_imposition', 'bulletin_paie',
    'rib', 'titre_sejour', 'cni', 'justificatif_domicile'
  );

-- 2. Documents typiquement générés/uploadés par le propriétaire
UPDATE public.documents
SET uploaded_by = owner_id
WHERE uploaded_by IS NULL
  AND owner_id IS NOT NULL
  AND type IN (
    'bail', 'quittance', 'avenant', 'appel_loyer', 'releve_charges',
    'dpe', 'erp', 'crep', 'amiante', 'electricite', 'gaz',
    'diagnostic', 'diagnostic_gaz', 'diagnostic_electricite',
    'diagnostic_plomb', 'diagnostic_amiante', 'diagnostic_termites',
    'diagnostic_performance', 'reglement_copro', 'notice_information',
    'EDL_entree', 'EDL_sortie', 'edl', 'edl_entree', 'edl_sortie',
    'assurance_pno', 'facture', 'contrat', 'engagement_garant'
  );

-- 3. Restant : documents owner sans tenant → attribuer au propriétaire
UPDATE public.documents
SET uploaded_by = owner_id
WHERE uploaded_by IS NULL
  AND owner_id IS NOT NULL
  AND tenant_id IS NULL;

-- 4. Restant : documents avec tenant et owner mais type inconnu → attribuer au tenant
--    (hypothèse : si un tenant est lié, c'est probablement lui qui a uploadé)
UPDATE public.documents
SET uploaded_by = tenant_id
WHERE uploaded_by IS NULL
  AND tenant_id IS NOT NULL
  AND owner_id IS NOT NULL;

COMMIT;


-- === MIGRATION: 20260306000000_lease_documents_visible_tenant.sql ===
-- Migration: Add visible_tenant column to documents table
-- Allows owners to control which documents are visible to tenants

ALTER TABLE documents ADD COLUMN IF NOT EXISTS visible_tenant BOOLEAN NOT NULL DEFAULT true;

-- Index for tenant document visibility queries
CREATE INDEX IF NOT EXISTS idx_documents_lease_visible_tenant
  ON documents(lease_id, visible_tenant) WHERE lease_id IS NOT NULL;

-- RLS policy: tenants can only see documents marked as visible_tenant = true
-- (Updates existing tenant read policy to add visible_tenant check)
DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON documents;
CREATE POLICY "Tenants can read visible lease documents"
  ON documents FOR SELECT
  USING (
    tenant_id = public.user_profile_id()
    OR (
      visible_tenant = true
      AND lease_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM lease_signers ls
        JOIN profiles p ON p.id = ls.profile_id
        WHERE ls.lease_id = documents.lease_id
          AND p.id = public.user_profile_id()
          AND ls.role IN ('locataire_principal', 'locataire', 'colocataire')
      )
    )
    OR owner_id = public.user_profile_id()
    OR (
      property_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = documents.property_id
          AND p.owner_id = public.user_profile_id()
      )
    )
    OR public.user_role() = 'admin'
  );


-- === MIGRATION: 20260306100000_add_digicode_interphone_columns.sql ===
-- Add digicode and interphone text columns to properties table
-- These store the actual access codes/names for tenant display

ALTER TABLE properties ADD COLUMN IF NOT EXISTS digicode TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS interphone TEXT;

COMMENT ON COLUMN properties.digicode IS 'Code digicode de l''immeuble';
COMMENT ON COLUMN properties.interphone IS 'Nom/numéro interphone du logement';


-- === MIGRATION: 20260306200000_notify_tenant_digicode_changed.sql ===
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


-- === MIGRATION: 20260309000000_entity_status_and_dedup.sql ===
-- REVIEW: Cette migration contient des DROP/DELETE dangereux. Verifier avant d'appliquer.
-- REVIEW: -- ============================================
-- REVIEW: -- Migration: Ajout status sur legal_entities + anti-doublons + déduplication
-- REVIEW: -- Date: 2026-03-09
-- REVIEW: -- Description:
-- REVIEW: --   1. Ajout colonne `status` ('draft','active','archived') avec sync `is_active`
-- REVIEW: --   2. Index partiel anti-doublons pour entités sans SIRET
-- REVIEW: --   3. Fonction admin de déduplication des entités
-- REVIEW: -- ============================================
-- REVIEW: 
-- REVIEW: BEGIN;
-- REVIEW: 
-- REVIEW: -- ============================================
-- REVIEW: -- 1. Ajout de la colonne `status`
-- REVIEW: -- ============================================
-- REVIEW: 
-- REVIEW: ALTER TABLE legal_entities
-- REVIEW:   ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
-- REVIEW:   CHECK (status IN ('draft', 'active', 'archived'));
-- REVIEW: 
-- REVIEW: -- Backfill des valeurs existantes
-- REVIEW: UPDATE legal_entities SET status = 'active'  WHERE is_active = true  AND status IS DISTINCT FROM 'active';
-- REVIEW: UPDATE legal_entities SET status = 'archived' WHERE is_active = false AND status IS DISTINCT FROM 'archived';
-- REVIEW: 
-- REVIEW: -- Index sur status
-- REVIEW: CREATE INDEX IF NOT EXISTS idx_legal_entities_status ON legal_entities(status);
-- REVIEW: 
-- REVIEW: -- ============================================
-- REVIEW: -- 2. Trigger de synchronisation is_active <-> status
-- REVIEW: -- ============================================
-- REVIEW: 
-- REVIEW: CREATE OR REPLACE FUNCTION sync_entity_status_and_is_active()
-- REVIEW: RETURNS TRIGGER AS $$
-- REVIEW: BEGIN
-- REVIEW:   -- Si status a changé, mettre à jour is_active
-- REVIEW:   IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
-- REVIEW:     NEW.is_active := (NEW.status = 'active');
-- REVIEW:   -- Si is_active a changé mais pas status, mettre à jour status
-- REVIEW:   ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
-- REVIEW:     IF NEW.is_active THEN
-- REVIEW:       NEW.status := 'active';
-- REVIEW:     ELSE
-- REVIEW:       NEW.status := 'archived';
-- REVIEW:     END IF;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   RETURN NEW;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql;
-- REVIEW: 
-- REVIEW: DROP TRIGGER IF EXISTS trg_sync_entity_status ON legal_entities;
-- REVIEW: CREATE TRIGGER trg_sync_entity_status
-- REVIEW:   BEFORE INSERT OR UPDATE ON legal_entities
-- REVIEW:   FOR EACH ROW
-- REVIEW:   EXECUTE FUNCTION sync_entity_status_and_is_active();
-- REVIEW: 
-- REVIEW: -- ============================================
-- REVIEW: -- 3. Index partiel anti-doublons (entités sans SIRET)
-- REVIEW: -- ============================================
-- REVIEW: -- Empêche de créer deux entités actives avec le même (owner, type, nom)
-- REVIEW: -- quand aucun SIRET n'est renseigné (typiquement les "particulier")
-- REVIEW: 
-- REVIEW: CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_entities_no_siret_unique
-- REVIEW:   ON legal_entities(owner_profile_id, entity_type, nom)
-- REVIEW:   WHERE siret IS NULL AND status = 'active';
-- REVIEW: 
-- REVIEW: -- ============================================
-- REVIEW: -- 4. Fonction de déduplication admin
-- REVIEW: -- ============================================
-- REVIEW: 
-- REVIEW: CREATE OR REPLACE FUNCTION admin_deduplicate_entities(p_owner_profile_id UUID)
-- REVIEW: RETURNS TABLE(deleted_count INTEGER, reassigned_properties INTEGER, reassigned_leases INTEGER)
-- REVIEW: LANGUAGE plpgsql
-- REVIEW: SECURITY DEFINER
-- REVIEW: AS $$
-- REVIEW: DECLARE
-- REVIEW:   v_deleted INTEGER := 0;
-- REVIEW:   v_reassigned_props INTEGER := 0;
-- REVIEW:   v_reassigned_leases INTEGER := 0;
-- REVIEW:   v_group RECORD;
-- REVIEW:   v_keep_id UUID;
-- REVIEW:   v_dup RECORD;
-- REVIEW:   v_props_moved INTEGER;
-- REVIEW:   v_leases_moved INTEGER;
-- REVIEW: BEGIN
-- REVIEW:   -- Pour chaque groupe de doublons (même owner, type, nom, tous actifs)
-- REVIEW:   FOR v_group IN
-- REVIEW:     SELECT le.owner_profile_id, le.entity_type, le.nom, COUNT(*) AS cnt
-- REVIEW:     FROM legal_entities le
-- REVIEW:     WHERE le.owner_profile_id = p_owner_profile_id
-- REVIEW:       AND le.status = 'active'
-- REVIEW:       AND le.siret IS NULL
-- REVIEW:     GROUP BY le.owner_profile_id, le.entity_type, le.nom
-- REVIEW:     HAVING COUNT(*) > 1
-- REVIEW:   LOOP
-- REVIEW:     -- Garder la plus ancienne (created_at ASC)
-- REVIEW:     SELECT id INTO v_keep_id
-- REVIEW:     FROM legal_entities
-- REVIEW:     WHERE owner_profile_id = v_group.owner_profile_id
-- REVIEW:       AND entity_type = v_group.entity_type
-- REVIEW:       AND nom = v_group.nom
-- REVIEW:       AND status = 'active'
-- REVIEW:       AND siret IS NULL
-- REVIEW:     ORDER BY created_at ASC
-- REVIEW:     LIMIT 1;
-- REVIEW: 
-- REVIEW:     -- Pour chaque doublon (hors la gardée)
-- REVIEW:     FOR v_dup IN
-- REVIEW:       SELECT id FROM legal_entities
-- REVIEW:       WHERE owner_profile_id = v_group.owner_profile_id
-- REVIEW:         AND entity_type = v_group.entity_type
-- REVIEW:         AND nom = v_group.nom
-- REVIEW:         AND status = 'active'
-- REVIEW:         AND siret IS NULL
-- REVIEW:         AND id != v_keep_id
-- REVIEW:     LOOP
-- REVIEW:       -- Réassigner les propriétés orphelines
-- REVIEW:       UPDATE properties
-- REVIEW:       SET legal_entity_id = v_keep_id
-- REVIEW:       WHERE legal_entity_id = v_dup.id
-- REVIEW:         AND deleted_at IS NULL;
-- REVIEW:       GET DIAGNOSTICS v_props_moved = ROW_COUNT;
-- REVIEW:       v_reassigned_props := v_reassigned_props + v_props_moved;
-- REVIEW: 
-- REVIEW:       -- Réassigner les property_ownership
-- REVIEW:       UPDATE property_ownership
-- REVIEW:       SET legal_entity_id = v_keep_id
-- REVIEW:       WHERE legal_entity_id = v_dup.id;
-- REVIEW: 
-- REVIEW:       -- Réassigner les baux
-- REVIEW:       UPDATE leases
-- REVIEW:       SET signatory_entity_id = v_keep_id
-- REVIEW:       WHERE signatory_entity_id = v_dup.id;
-- REVIEW:       GET DIAGNOSTICS v_leases_moved = ROW_COUNT;
-- REVIEW:       v_reassigned_leases := v_reassigned_leases + v_leases_moved;
-- REVIEW: 
-- REVIEW:       -- Réassigner les factures
-- REVIEW:       UPDATE invoices
-- REVIEW:       SET issuer_entity_id = v_keep_id
-- REVIEW:       WHERE issuer_entity_id = v_dup.id;
-- REVIEW: 
-- REVIEW:       -- Supprimer les associés du doublon
-- REVIEW:       DELETE FROM entity_associates WHERE legal_entity_id = v_dup.id;
-- REVIEW: 
-- REVIEW:       -- Supprimer le doublon
-- REVIEW:       DELETE FROM legal_entities WHERE id = v_dup.id;
-- REVIEW:       v_deleted := v_deleted + 1;
-- REVIEW:     END LOOP;
-- REVIEW:   END LOOP;
-- REVIEW: 
-- REVIEW:   RETURN QUERY SELECT v_deleted, v_reassigned_props, v_reassigned_leases;
-- REVIEW: END;
-- REVIEW: $$;
-- REVIEW: 
-- REVIEW: COMMIT;
-- REVIEW: 


-- === MIGRATION: 20260309100000_sync_subscription_plans_features.sql ===
-- =====================================================
-- Migration: Synchronisation complète des plans d'abonnement
-- Date: 2026-03-09
-- Description:
--   - Synchronise les features JSONB de subscription_plans avec le frontend (plans.ts)
--   - Ajoute les plans manquants (gratuit, enterprise_s/m/l/xl)
--   - Met à jour les prix (confort 29→35€, pro 59→69€)
--   - Synchronise subscriptions.plan_slug avec subscription_plans.slug
--   - Migre les abonnements enterprise legacy → enterprise_s
--   - Recalcule les compteurs d'usage
--   - Crée les abonnements manquants pour les propriétaires orphelins
--   - Met à jour has_subscription_feature() pour les features non-booléennes
-- =====================================================

BEGIN;

-- =====================================================
-- ÉTAPE 1: UPSERT des 8 plans avec features complètes
-- Source de vérité : lib/subscriptions/plans.ts
-- =====================================================

-- GRATUIT - 0€/mois (1 bien) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'gratuit',
  'Gratuit',
  'Découvrez la gestion locative simplifiée avec 1 bien',
  0, 0,
  1, 1, 2, 0.1,
  '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "open_banking": false,
    "open_banking_level": "none",
    "bank_reconciliation": false,
    "auto_reminders": false,
    "auto_reminders_sms": false,
    "irl_revision": false,
    "alerts_deadlines": false,
    "tenant_portal": "basic",
    "tenant_payment_online": false,
    "lease_generation": true,
    "colocation": false,
    "multi_units": false,
    "multi_users": false,
    "max_users": 1,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": false,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": false,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": false,
    "scoring_advanced": false,
    "edl_digital": false,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, false, -1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- STARTER - 9€/mois (3 biens) - MISE À JOUR features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'starter',
  'Starter',
  'Idéal pour gérer jusqu''à 3 biens en toute simplicité',
  900, 9000,
  3, 5, 10, 1,
  '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "open_banking": false,
    "open_banking_level": "none",
    "bank_reconciliation": false,
    "auto_reminders": "email_basic",
    "auto_reminders_sms": false,
    "irl_revision": false,
    "alerts_deadlines": false,
    "tenant_portal": "basic",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": false,
    "multi_units": false,
    "multi_users": false,
    "max_users": 1,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": false,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": false,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": false,
    "scoring_advanced": false,
    "edl_digital": false,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, false, 0
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- CONFORT - 35€/mois (10 biens) - MISE À JOUR prix + features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'confort',
  'Confort',
  'Pour les propriétaires actifs avec plusieurs biens',
  3500, 33600,  -- 35€/mois, 336€/an (=28€/mois, -20%)
  10, 25, 40, 5,
  '{
    "signatures": true,
    "signatures_monthly_quota": 2,
    "open_banking": true,
    "open_banking_level": "basic",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": false,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "advanced",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 2,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": true,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": true,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": false,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, true, 1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- PRO - 69€/mois (50 biens) - MISE À JOUR prix + features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'pro',
  'Pro',
  'Pour les gestionnaires professionnels et SCI',
  6900, 66200,  -- 69€/mois, 662€/an (=55€/mois, -20%)
  50, -1, -1, 30,
  '{
    "signatures": true,
    "signatures_monthly_quota": 10,
    "open_banking": true,
    "open_banking_level": "advanced",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 5,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": true,
    "api_access_level": "read_write",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, false, 2
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE S - 249€/mois (100 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_s',
  'Enterprise S',
  'Pour les gestionnaires de 50 à 100 biens',
  24900, 239000,
  100, -1, -1, 50,
  '{
    "signatures": true,
    "signatures_monthly_quota": 25,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, false, 3
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE M - 349€/mois (200 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_m',
  'Enterprise M',
  'Pour les gestionnaires de 100 à 200 biens',
  34900, 335000,
  200, -1, -1, 100,
  '{
    "signatures": true,
    "signatures_monthly_quota": 40,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, false, 4
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE L - 499€/mois (500 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_l',
  'Enterprise L',
  'Pour les gestionnaires de 200 à 500 biens',
  49900, 479000,
  500, -1, -1, 200,
  '{
    "signatures": true,
    "signatures_monthly_quota": 60,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": true,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, true, 5
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE XL - 799€/mois (illimité) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_xl',
  'Enterprise XL',
  'Solution sur-mesure pour +500 biens',
  79900, 767000,
  -1, -1, -1, -1,
  '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, false, 6
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE (Legacy) - Mise à jour features pour cohérence
-- On garde le plan en BDD pour les abonnements existants mais on le masque
UPDATE subscription_plans
SET
  features = '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  display_order = 99,
  updated_at = NOW()
WHERE slug = 'enterprise';

-- =====================================================
-- ÉTAPE 2: Synchroniser subscriptions.plan_slug
-- =====================================================

-- 2a. Synchroniser plan_slug avec le slug réel du plan lié
UPDATE subscriptions s
SET plan_slug = sp.slug, updated_at = NOW()
FROM subscription_plans sp
WHERE s.plan_id = sp.id
AND (s.plan_slug IS NULL OR s.plan_slug != sp.slug);

-- 2b. Migrer les abonnements enterprise legacy → enterprise_s
DO $$
DECLARE
  v_enterprise_s_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_enterprise_s_id FROM subscription_plans WHERE slug = 'enterprise_s';

  IF v_enterprise_s_id IS NOT NULL THEN
    UPDATE subscriptions
    SET plan_slug = 'enterprise_s',
        plan_id = v_enterprise_s_id,
        updated_at = NOW()
    WHERE plan_slug = 'enterprise';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) enterprise migré(s) vers enterprise_s', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 3: Recalculer les compteurs d'usage
-- =====================================================

-- 3a. Recalculer properties_count pour les comptes actifs
UPDATE subscriptions s
SET
  properties_count = COALESCE(prop_counts.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT p.owner_id, COUNT(*) as cnt
  FROM properties p
  WHERE p.deleted_at IS NULL
  GROUP BY p.owner_id
) prop_counts
WHERE s.owner_id = prop_counts.owner_id
AND s.status IN ('active', 'trialing');

-- 3b. Recalculer leases_count pour les comptes actifs
UPDATE subscriptions s
SET
  leases_count = COALESCE(lease_counts.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT pr.owner_id, COUNT(*) as cnt
  FROM leases l
  JOIN properties pr ON l.property_id = pr.id
  WHERE l.statut IN ('active', 'pending_signature', 'partially_signed', 'fully_signed')
  GROUP BY pr.owner_id
) lease_counts
WHERE s.owner_id = lease_counts.owner_id
AND s.status IN ('active', 'trialing');

-- =====================================================
-- ÉTAPE 4: Créer abonnements manquants
-- =====================================================

DO $$
DECLARE
  v_starter_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_starter_id FROM subscription_plans WHERE slug = 'starter' LIMIT 1;

  IF v_starter_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      owner_id, plan_id, plan_slug, status, billing_cycle,
      current_period_start, current_period_end, trial_end,
      properties_count, leases_count
    )
    SELECT
      p.id,
      v_starter_id,
      'starter',
      'trialing',
      'monthly',
      NOW(),
      NOW() + INTERVAL '30 days',
      NOW() + INTERVAL '30 days',
      COALESCE((SELECT COUNT(*) FROM properties pr WHERE pr.owner_id = p.id AND pr.deleted_at IS NULL), 0),
      0
    FROM profiles p
    WHERE p.role = 'owner'
    AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.owner_id = p.id)
    ON CONFLICT (owner_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) Starter créé(s) pour propriétaires orphelins', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 5: Mettre à jour has_subscription_feature()
-- Support des features non-booléennes (niveaux, nombres)
-- =====================================================

CREATE OR REPLACE FUNCTION has_subscription_feature(p_owner_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  feature_raw JSONB;
  feature_type TEXT;
BEGIN
  -- Récupérer la valeur brute de la feature depuis le plan
  SELECT sp.features -> p_feature
  INTO feature_raw
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.slug = COALESCE(s.plan_slug, 'gratuit')
  WHERE s.owner_id = p_owner_id;

  -- Si pas de subscription ou feature absente
  IF feature_raw IS NULL THEN
    RETURN false;
  END IF;

  -- Déterminer le type JSONB
  feature_type := jsonb_typeof(feature_raw);

  -- Booléen : retourner directement
  IF feature_type = 'boolean' THEN
    RETURN feature_raw::text::boolean;
  END IF;

  -- Nombre : true si > 0 (ou -1 pour illimité)
  IF feature_type = 'number' THEN
    RETURN (feature_raw::text::numeric != 0);
  END IF;

  -- String : true si non vide et pas "none" ou "false"
  IF feature_type = 'string' THEN
    RETURN (feature_raw::text NOT IN ('"none"', '"false"', '""'));
  END IF;

  -- Null explicite
  IF feature_type = 'null' THEN
    RETURN false;
  END IF;

  -- Autres types (array, object) : considérer comme true
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_subscription_feature(UUID, TEXT) IS
  'Vérifie si un owner a accès à une feature selon son forfait. Supporte bool, niveaux (string) et quotas (number).';

-- =====================================================
-- ÉTAPE 6: Mise à jour du trigger create_owner_subscription
-- Mettre à jour les intervalles pour 30 jours (cohérence)
-- =====================================================

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Seulement pour les propriétaires
  IF NEW.role = 'owner' THEN
    -- Récupérer l'ID du plan starter (plan par défaut)
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = 'starter'
    LIMIT 1;

    -- Créer l'abonnement si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id,
        plan_id,
        plan_slug,
        status,
        billing_cycle,
        current_period_start,
        current_period_end,
        trial_end,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'starter',
        'trialing',
        'monthly',
        NOW(),
        NOW() + INTERVAL '30 days',
        NOW() + INTERVAL '30 days',
        0,
        0
      )
      ON CONFLICT (owner_id) DO NOTHING;

      RAISE NOTICE 'Abonnement Talok Starter (essai 30j) créé pour le propriétaire %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;


-- === MIGRATION: 20260310000000_fix_subscription_plans_display_order.sql ===
-- =====================================================
-- Migration: Fix display_order des plans d'abonnement
-- Date: 2026-03-10
-- Description:
--   - Corrige display_order du plan Gratuit (-1 → 0)
--   - Réordonne tous les plans avec des valeurs séquentielles
-- =====================================================

BEGIN;

UPDATE subscription_plans SET display_order = 0, updated_at = NOW() WHERE slug = 'gratuit';
UPDATE subscription_plans SET display_order = 1, updated_at = NOW() WHERE slug = 'starter';
UPDATE subscription_plans SET display_order = 2, updated_at = NOW() WHERE slug = 'confort';
UPDATE subscription_plans SET display_order = 3, updated_at = NOW() WHERE slug = 'pro';
UPDATE subscription_plans SET display_order = 4, updated_at = NOW() WHERE slug = 'enterprise_s';
UPDATE subscription_plans SET display_order = 5, updated_at = NOW() WHERE slug = 'enterprise_m';
UPDATE subscription_plans SET display_order = 6, updated_at = NOW() WHERE slug = 'enterprise_l';
UPDATE subscription_plans SET display_order = 7, updated_at = NOW() WHERE slug = 'enterprise_xl';
UPDATE subscription_plans SET display_order = 99, updated_at = NOW() WHERE slug = 'enterprise';

COMMIT;


-- === MIGRATION: 20260310100000_fix_property_limit_enforcement.sql ===
-- =====================================================
-- Migration: Fix Property Limit Enforcement & Counter Sync
--
-- Problème: Les compteurs properties_count/leases_count dans
-- la table subscriptions se désynchronisent car :
-- 1. Le trigger enforce_property_limit() lit le compteur caché
--    au lieu de faire un vrai COUNT
-- 2. Le trigger update_subscription_properties_count() ne gère
--    pas les soft-deletes (UPDATE de deleted_at)
-- 3. Les compteurs existants sont potentiellement faux
--
-- Fix:
-- - enforce_property_limit() utilise un vrai COUNT(*)
-- - enforce_lease_limit() utilise un vrai COUNT(*) avec deleted_at IS NULL
-- - update_subscription_properties_count() gère les soft-deletes via recount
-- - Recalcul des compteurs pour TOUS les comptes
-- =====================================================

-- =====================================================
-- 1. Fix enforce_property_limit() : utiliser un vrai COUNT
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
BEGIN
  -- Compter les propriétés actives (non soft-deleted) avec un vrai COUNT
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL;

  -- Récupérer la limite du plan
  SELECT
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. Fix enforce_lease_limit() : COUNT live + deleted_at IS NULL
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

  -- Compter les baux actifs sur les propriétés non soft-deleted
  SELECT COUNT(*) INTO current_count
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE p.owner_id = property_owner_id
    AND p.deleted_at IS NULL
    AND l.statut IN ('active', 'pending_signature');

  -- Récupérer la limite du plan
  SELECT
    COALESCE(sp.max_leases, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = property_owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bail(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour créer plus de baux.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. Fix update_subscription_properties_count() : gérer soft-deletes
--    Utilise un recount complet (self-healing) au lieu de inc/dec
-- =====================================================
CREATE OR REPLACE FUNCTION update_subscription_properties_count()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_owner_id := OLD.owner_id;
  ELSE
    v_owner_id := NEW.owner_id;
  END IF;

  -- Recalculer le compteur à partir de l'état réel de la table
  UPDATE subscriptions
  SET properties_count = (
    SELECT COUNT(*)
    FROM properties
    WHERE owner_id = v_owner_id
      AND deleted_at IS NULL
  ),
  updated_at = NOW()
  WHERE owner_id = v_owner_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour le trigger pour écouter aussi les UPDATE (soft-delete/restore)
DROP TRIGGER IF EXISTS trg_update_subscription_properties ON properties;
CREATE TRIGGER trg_update_subscription_properties
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_subscription_properties_count();

-- =====================================================
-- 4. Recalculer properties_count pour TOUS les comptes
-- =====================================================
UPDATE subscriptions s
SET
  properties_count = COALESCE(pc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(p.id) as cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  GROUP BY s2.owner_id
) pc
WHERE s.owner_id = pc.owner_id;

-- =====================================================
-- 5. Recalculer leases_count pour TOUS les comptes
-- =====================================================
UPDATE subscriptions s
SET
  leases_count = COALESCE(lc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(l.id) as cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  LEFT JOIN leases l ON l.property_id = p.id AND l.statut IN ('active', 'pending_signature')
  GROUP BY s2.owner_id
) lc
WHERE s.owner_id = lc.owner_id;

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON FUNCTION enforce_property_limit() IS 'Vérifie la limite de biens via COUNT réel (pas le compteur caché). Gère correctement les soft-deletes.';
COMMENT ON FUNCTION enforce_lease_limit() IS 'Vérifie la limite de baux via COUNT réel. Exclut les propriétés soft-deleted.';
COMMENT ON FUNCTION update_subscription_properties_count() IS 'Met à jour le compteur properties_count via recount complet sur INSERT, DELETE et soft-delete (UPDATE deleted_at).';


-- === MIGRATION: 20260310200000_fix_property_limit_extra_properties.sql ===
-- =====================================================
-- Migration: Allow extra properties for paid plans
--
-- Problème: Le trigger enforce_property_limit() bloque la
-- création de biens au-delà de max_properties, même pour
-- les forfaits payants (Starter, Confort, Pro) qui permettent
-- d'ajouter des biens supplémentaires moyennant un surcoût.
--
-- Fix:
-- - Ajouter la colonne extra_property_price à subscription_plans
-- - Mettre à jour enforce_property_limit() pour ne pas bloquer
--   quand extra_property_price > 0 (biens supplémentaires autorisés)
-- =====================================================

-- 1. Ajouter la colonne extra_property_price si elle n'existe pas
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS extra_property_price INTEGER DEFAULT 0;

COMMENT ON COLUMN subscription_plans.extra_property_price IS
  'Prix en centimes par bien supplémentaire au-delà du quota inclus. 0 = pas de bien suppl. autorisé.';

-- 2. Peupler la colonne pour les plans existants
UPDATE subscription_plans SET extra_property_price = 0   WHERE slug = 'gratuit';
UPDATE subscription_plans SET extra_property_price = 300 WHERE slug = 'starter';    -- 3€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 250 WHERE slug = 'confort';    -- 2,50€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 200 WHERE slug = 'pro';        -- 2€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 0   WHERE slug LIKE 'enterprise%';

-- 3. Mettre à jour enforce_property_limit() pour autoriser les biens
--    supplémentaires sur les forfaits qui le permettent
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
  v_extra_property_price INTEGER;
BEGIN
  -- Compter les propriétés actives (non soft-deleted) avec un vrai COUNT
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL;

  -- Récupérer la limite du plan et le prix des biens supplémentaires
  SELECT
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit'),
    COALESCE(sp.extra_property_price, 0)
  INTO max_allowed, plan_slug, v_extra_property_price
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
    v_extra_property_price := 0;
  END IF;

  -- Si le forfait autorise des biens supplémentaires payants, ne pas bloquer
  IF v_extra_property_price > 0 THEN
    RETURN NEW;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enforce_property_limit() IS
  'Vérifie la limite de biens. Autorise les biens supplémentaires payants pour les forfaits avec extra_property_price > 0.';


-- === MIGRATION: 20260310300000_add_stripe_price_extra_property_id.sql ===
-- Add stripe_price_extra_property_id column to subscription_plans
-- Stores the Stripe Price ID for per-unit extra property billing

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_price_extra_property_id TEXT;

COMMENT ON COLUMN subscription_plans.stripe_price_extra_property_id
IS 'Stripe Price ID for recurring per-unit billing of extra properties beyond included quota';


-- === MIGRATION: 20260311100000_sync_subscription_plan_slugs.sql ===
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


-- === MIGRATION: 20260312000000_admin_dashboard_rpcs.sql ===
-- ============================================================================
-- Migration: Admin Dashboard RPCs
-- Date: 2026-03-12
-- Description: Crée les RPCs manquantes pour le dashboard admin V2
--   - admin_monthly_revenue : revenus mensuels sur 12 mois
--   - admin_subscription_stats : stats abonnements
--   - admin_daily_trends : tendances 7 derniers jours
-- ============================================================================

-- 1. RPC: admin_monthly_revenue
-- Retourne les revenus attendus vs encaissés sur les 12 derniers mois
CREATE OR REPLACE FUNCTION admin_monthly_revenue()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      to_char(month_start, 'Mon') AS month,
      COALESCE(SUM(montant_total), 0)::numeric AS attendu,
      COALESCE(SUM(CASE WHEN statut = 'paid' THEN montant_total ELSE 0 END), 0)::numeric AS encaisse
    FROM generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS month_start
    LEFT JOIN invoices ON date_trunc('month', invoices.created_at) = month_start
    GROUP BY month_start
    ORDER BY month_start
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 2. RPC: admin_subscription_stats
-- Retourne les statistiques d'abonnements
CREATE OR REPLACE FUNCTION admin_subscription_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*)::int,
    'active', COUNT(*) FILTER (WHERE status = 'active')::int,
    'trial', COUNT(*) FILTER (WHERE status = 'trialing' OR (trial_end IS NOT NULL AND trial_end > now()))::int,
    'churned', COUNT(*) FILTER (WHERE status IN ('canceled', 'expired'))::int
  )
  INTO result
  FROM subscriptions;

  RETURN COALESCE(result, json_build_object('total', 0, 'active', 0, 'trial', 0, 'churned', 0));
END;
$$;

-- 3. RPC: admin_daily_trends
-- Retourne les tendances des 7 derniers jours (nouveaux users, properties, leases)
CREATE OR REPLACE FUNCTION admin_daily_trends()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  users_arr int[];
  properties_arr int[];
  leases_arr int[];
  d date;
BEGIN
  users_arr := ARRAY[]::int[];
  properties_arr := ARRAY[]::int[];
  leases_arr := ARRAY[]::int[];

  FOR d IN SELECT generate_series(
    (current_date - interval '6 days')::date,
    current_date,
    interval '1 day'
  )::date
  LOOP
    users_arr := users_arr || COALESCE(
      (SELECT COUNT(*)::int FROM profiles WHERE created_at::date = d), 0
    );
    properties_arr := properties_arr || COALESCE(
      (SELECT COUNT(*)::int FROM properties WHERE created_at::date = d), 0
    );
    leases_arr := leases_arr || COALESCE(
      (SELECT COUNT(*)::int FROM leases WHERE created_at::date = d), 0
    );
  END LOOP;

  RETURN json_build_object(
    'users', to_json(users_arr),
    'properties', to_json(properties_arr),
    'leases', to_json(leases_arr)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_monthly_revenue() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_subscription_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_daily_trends() TO authenticated;


-- === MIGRATION: 20260312000001_fix_owner_subscription_defaults.sql ===
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


-- === MIGRATION: 20260315090000_market_standard_subscription_alignment.sql ===
BEGIN;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS selected_plan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS selected_plan_source TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_plan_id UUID REFERENCES subscription_plans(id),
  ADD COLUMN IF NOT EXISTS scheduled_plan_slug TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_plan_effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_subscription_schedule_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_selected_plan_at
  ON subscriptions(selected_plan_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_scheduled_plan_effective_at
  ON subscriptions(scheduled_plan_effective_at)
  WHERE scheduled_plan_effective_at IS NOT NULL;

UPDATE subscriptions s
SET plan_id = sp.id
FROM subscription_plans sp
WHERE s.plan_id IS NULL
  AND s.plan_slug IS NOT NULL
  AND sp.slug = s.plan_slug;

UPDATE subscriptions s
SET plan_slug = sp.slug
FROM subscription_plans sp
WHERE s.plan_slug IS NULL
  AND s.plan_id IS NOT NULL
  AND sp.id = s.plan_id;

UPDATE subscriptions
SET status = 'paused'
WHERE status = 'suspended';

UPDATE subscriptions
SET selected_plan_at = COALESCE(current_period_start, updated_at, created_at),
    selected_plan_source = CASE
      WHEN stripe_subscription_id IS NOT NULL THEN COALESCE(selected_plan_source, 'backfill_stripe')
      ELSE COALESCE(selected_plan_source, 'backfill_local')
    END
WHERE selected_plan_at IS NULL
   OR selected_plan_source IS NULL;

UPDATE subscriptions
SET scheduled_plan_id = NULL,
    scheduled_plan_slug = NULL,
    scheduled_plan_effective_at = NULL,
    stripe_subscription_schedule_id = NULL
WHERE scheduled_plan_effective_at IS NOT NULL
  AND scheduled_plan_effective_at < NOW() - INTERVAL '7 days';

UPDATE subscriptions s
SET scheduled_plan_id = sp.id
FROM subscription_plans sp
WHERE s.scheduled_plan_id IS NULL
  AND s.scheduled_plan_slug IS NOT NULL
  AND sp.slug = s.scheduled_plan_slug;

UPDATE subscriptions s
SET scheduled_plan_slug = sp.slug
FROM subscription_plans sp
WHERE s.scheduled_plan_slug IS NULL
  AND s.scheduled_plan_id IS NOT NULL
  AND sp.id = s.scheduled_plan_id;

UPDATE subscriptions
SET properties_count = property_counts.count_value
FROM (
  SELECT owner_id, COUNT(*)::INT AS count_value
  FROM properties
  WHERE deleted_at IS NULL
  GROUP BY owner_id
) AS property_counts
WHERE subscriptions.owner_id = property_counts.owner_id;

UPDATE subscriptions
SET properties_count = 0
WHERE properties_count IS NULL;

COMMIT;


-- === MIGRATION: 20260326022700_migrate_tenant_documents.sql ===
-- Migration: Unifier tenant_documents dans la table documents
-- Les CNI et autres pieces d'identite locataire sont dans tenant_documents
-- mais invisibles dans le systeme unifie. Cette migration les copie.

DO $$
DECLARE
  migrated_count INT := 0;
BEGIN
  -- Verifier que tenant_documents existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'tenant_documents'
  ) THEN
    RAISE NOTICE 'Table tenant_documents absente, rien a migrer';
    RETURN;
  END IF;

  -- Copier les documents qui ne sont pas deja dans documents (par storage_path)
  INSERT INTO documents (
    type, category, title, original_filename,
    tenant_id, owner_id,
    storage_path, file_size, mime_type,
    uploaded_by, is_generated, ged_status,
    visible_tenant, verification_status,
    metadata, created_at, updated_at
  )
  SELECT
    CASE
      WHEN td.document_type ILIKE '%recto%' OR td.document_type = 'cni_recto' THEN 'cni_recto'
      WHEN td.document_type ILIKE '%verso%' OR td.document_type = 'cni_verso' THEN 'cni_verso'
      WHEN td.document_type = 'passeport' THEN 'passeport'
      WHEN td.document_type = 'titre_sejour' THEN 'titre_sejour'
      WHEN td.document_type ILIKE '%identit%' THEN 'piece_identite'
      ELSE COALESCE(td.document_type, 'autre')
    END AS type,
    'identite' AS category,
    CASE
      WHEN td.document_type ILIKE '%recto%' OR td.document_type = 'cni_recto'
        THEN 'Carte d''identite (recto)'
      WHEN td.document_type ILIKE '%verso%' OR td.document_type = 'cni_verso'
        THEN 'Carte d''identite (verso)'
      WHEN td.document_type = 'passeport' THEN 'Passeport'
      WHEN td.document_type = 'titre_sejour' THEN 'Titre de sejour'
      ELSE COALESCE(td.file_name, 'Document identite')
    END AS title,
    td.file_name AS original_filename,
    td.tenant_profile_id AS tenant_id,
    NULL AS owner_id,
    td.file_path AS storage_path,
    td.file_size,
    td.mime_type,
    td.uploaded_by,
    false AS is_generated,
    'active' AS ged_status,
    true AS visible_tenant,
    CASE WHEN td.is_valid = true THEN 'verified' ELSE 'pending' END AS verification_status,
    jsonb_build_object(
      'migrated_from', 'tenant_documents',
      'original_id', td.id,
      'ocr_confidence', td.ocr_confidence,
      'extracted_data', td.extracted_data
    ) AS metadata,
    td.created_at,
    COALESCE(td.updated_at, td.created_at)
  FROM tenant_documents td
  WHERE NOT EXISTS (
    SELECT 1 FROM documents d
    WHERE d.storage_path = td.file_path
  )
  AND td.file_path IS NOT NULL
  AND td.file_path != '';

  GET DIAGNOSTICS migrated_count = ROW_COUNT;

  RAISE NOTICE 'Migration tenant_documents: % documents copies vers documents', migrated_count;

  -- Le trigger auto_fill_document_fk completera owner_id et property_id
  -- via lease_signers si disponible
END $$;


-- === MIGRATION: 20260326022800_create_document_links.sql ===
-- Table document_links: liens de partage temporaires
-- Utilisee par POST /api/documents/[id]/download et /api/documents/[id]/copy-link

CREATE TABLE IF NOT EXISTS document_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  max_views INTEGER DEFAULT 10,
  view_count INTEGER NOT NULL DEFAULT 0,
  accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_links_token ON document_links(token);
CREATE INDEX IF NOT EXISTS idx_document_links_document_id ON document_links(document_id);
CREATE INDEX IF NOT EXISTS idx_document_links_expires_at ON document_links(expires_at);

-- RLS
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document links" ON document_links
  FOR SELECT TO authenticated
  USING (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_links.document_id
      AND (d.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR d.tenant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can create document links" ON document_links
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access document_links" ON document_links
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- === MIGRATION: 20260326023000_fix_document_titles.sql ===
-- Fix document titles for existing records with NULL, screenshot names, or raw technical names
-- Uses TYPE_TO_LABEL mapping from lib/documents/constants.ts as source of truth

UPDATE documents SET title = CASE
  WHEN type = 'cni_recto' THEN 'Carte d''identite (recto)'
  WHEN type = 'cni_verso' THEN 'Carte d''identite (verso)'
  WHEN type = 'attestation_assurance' THEN 'Attestation d''assurance'
  WHEN type = 'assurance_pno' THEN 'Assurance PNO'
  WHEN type = 'bail' THEN 'Contrat de bail'
  WHEN type = 'avenant' THEN 'Avenant au bail'
  WHEN type = 'engagement_garant' THEN 'Engagement de caution'
  WHEN type = 'bail_signe_locataire' THEN 'Bail signe (locataire)'
  WHEN type = 'bail_signe_proprietaire' THEN 'Bail signe (proprietaire)'
  WHEN type = 'piece_identite' THEN 'Piece d''identite'
  WHEN type = 'passeport' THEN 'Passeport'
  WHEN type = 'titre_sejour' THEN 'Titre de sejour'
  WHEN type = 'quittance' THEN 'Quittance de loyer'
  WHEN type = 'facture' THEN 'Facture'
  WHEN type = 'rib' THEN 'RIB'
  WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
  WHEN type = 'bulletin_paie' THEN 'Bulletin de paie'
  WHEN type = 'attestation_loyer' THEN 'Attestation de loyer'
  WHEN type = 'justificatif_revenus' THEN 'Justificatif de revenus'
  WHEN type = 'diagnostic' THEN 'Diagnostic'
  WHEN type = 'dpe' THEN 'DPE'
  WHEN type = 'diagnostic_gaz' THEN 'Diagnostic gaz'
  WHEN type = 'diagnostic_electricite' THEN 'Diagnostic electricite'
  WHEN type = 'diagnostic_plomb' THEN 'Diagnostic plomb'
  WHEN type = 'diagnostic_amiante' THEN 'Diagnostic amiante'
  WHEN type = 'diagnostic_termites' THEN 'Diagnostic termites'
  WHEN type = 'diagnostic_performance' THEN 'Diagnostic de performance'
  WHEN type = 'erp' THEN 'Etat des risques (ERP)'
  WHEN type = 'EDL_entree' THEN 'Etat des lieux d''entree'
  WHEN type = 'EDL_sortie' THEN 'Etat des lieux de sortie'
  WHEN type = 'inventaire' THEN 'Inventaire mobilier'
  WHEN type = 'devis' THEN 'Devis'
  WHEN type = 'ordre_mission' THEN 'Ordre de mission'
  WHEN type = 'rapport_intervention' THEN 'Rapport d''intervention'
  WHEN type = 'taxe_fonciere' THEN 'Taxe fonciere'
  WHEN type = 'copropriete' THEN 'Document copropriete'
  WHEN type = 'proces_verbal' THEN 'Proces-verbal'
  WHEN type = 'appel_fonds' THEN 'Appel de fonds'
  WHEN type = 'photo' THEN 'Photo'
  WHEN type = 'courrier' THEN 'Courrier'
  WHEN type = 'autre' THEN 'Autre document'
  ELSE title
END
WHERE title IS NULL
   OR title ~ '^Capture d.cran'
   OR title ~ '^[A-Z_]+$';


-- === MIGRATION: 20260329052631_fix_contrat_bail_visible_tenant.sql ===
-- Migration: Rendre les documents de bail visibles aux locataires
-- Contexte: Le route /seal ne définissait pas visible_tenant=true sur les documents de bail
-- Impact: Les locataires ne voyaient pas leur bail dans /tenant/documents

-- S'assurer que tous les documents bail liés à un lease ont visible_tenant=true
UPDATE documents
SET
  visible_tenant = true,
  title = CASE
    WHEN title = 'Bail de location signé' THEN 'Contrat de bail signé'
    ELSE title
  END,
  original_filename = COALESCE(
    original_filename,
    'bail_signe_' || lease_id::text || '.html'
  ),
  updated_at = now()
WHERE
  type = 'bail'
  AND lease_id IS NOT NULL
  AND (visible_tenant IS NULL OR visible_tenant = false);


-- === MIGRATION: 20260329164841_fix_document_titles.sql ===
-- Migration: Corriger les titres bruts/manquants des documents existants
-- Remplace les titres NULL, screenshots, codes bruts et dates par des labels lisibles
-- Source: talok-documents-sota section 8

UPDATE documents SET
  title = CASE
    WHEN type = 'cni_recto' THEN 'Carte d''identité (Recto)'
    WHEN type = 'cni_verso' THEN 'Carte d''identité (Verso)'
    WHEN type = 'attestation_assurance' THEN 'Attestation d''assurance'
    WHEN type = 'assurance_pno' THEN 'Assurance PNO'
    WHEN type = 'bail' THEN 'Contrat de bail'
    WHEN type = 'avenant' THEN 'Avenant au bail'
    WHEN type = 'engagement_garant' THEN 'Engagement de caution'
    WHEN type = 'bail_signe_locataire' THEN 'Bail signé (locataire)'
    WHEN type = 'bail_signe_proprietaire' THEN 'Bail signé (propriétaire)'
    WHEN type = 'piece_identite' THEN 'Pièce d''identité'
    WHEN type = 'passeport' THEN 'Passeport'
    WHEN type = 'titre_sejour' THEN 'Titre de séjour'
    WHEN type = 'quittance' THEN 'Quittance de loyer'
    WHEN type = 'facture' THEN 'Facture'
    WHEN type = 'rib' THEN 'RIB'
    WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
    WHEN type = 'bulletin_paie' THEN 'Bulletin de paie'
    WHEN type = 'attestation_loyer' THEN 'Attestation de loyer'
    WHEN type = 'justificatif_revenus' THEN 'Justificatif de revenus'
    WHEN type = 'dpe' THEN 'Diagnostic de performance énergétique'
    WHEN type = 'diagnostic_gaz' THEN 'Diagnostic gaz'
    WHEN type = 'diagnostic_electricite' THEN 'Diagnostic électricité'
    WHEN type = 'diagnostic_plomb' THEN 'Diagnostic plomb (CREP)'
    WHEN type = 'diagnostic_amiante' THEN 'Diagnostic amiante'
    WHEN type = 'diagnostic_termites' THEN 'Diagnostic termites'
    WHEN type = 'erp' THEN 'État des risques (ERP)'
    WHEN type = 'EDL_entree' THEN 'État des lieux d''entrée'
    WHEN type = 'EDL_sortie' THEN 'État des lieux de sortie'
    WHEN type = 'inventaire' THEN 'Inventaire mobilier'
    WHEN type = 'taxe_fonciere' THEN 'Taxe foncière'
    WHEN type = 'devis' THEN 'Devis'
    WHEN type = 'rapport_intervention' THEN 'Rapport d''intervention'
    ELSE COALESCE(title, 'Document')
  END
WHERE title IS NULL
   OR title ~ '^Capture d.écran'
   OR title ~ '^[A-Z_]+$'
   OR title ~ '^\d{4}-\d{2}-\d{2}';


-- === MIGRATION: 20260329190000_force_visible_tenant_generated_docs.sql ===
-- Migration: Backfill visible_tenant for generated documents + trigger guard
-- Date: 2026-03-29
-- Description:
--   1. Backfill: force visible_tenant = true on all existing generated documents
--   2. Trigger: prevent any future INSERT/UPDATE from creating a generated doc with visible_tenant = false

-- ============================================================================
-- 1. Backfill existing generated documents
-- ============================================================================
UPDATE documents
SET visible_tenant = true, updated_at = NOW()
WHERE is_generated = true AND (visible_tenant = false OR visible_tenant IS NULL);

-- ============================================================================
-- 2. Trigger function: force visible_tenant on generated documents
-- ============================================================================
CREATE OR REPLACE FUNCTION public.force_visible_tenant_on_generated()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_generated = true THEN
        NEW.visible_tenant := true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Trigger on documents table
-- ============================================================================
DROP TRIGGER IF EXISTS trg_force_visible_tenant_on_generated ON documents;
CREATE TRIGGER trg_force_visible_tenant_on_generated
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION public.force_visible_tenant_on_generated();


-- === MIGRATION: 20260331100000_add_agricultural_property_types.sql ===
-- ============================================
-- Migration: Ajouter les types agricoles au CHECK constraint properties
-- Alignement avec le skill SOTA 2026 (14 types)
-- Ref: .cursor/skills/sota-property-system/SKILL.md §1
-- ============================================

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_type_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_type_check
  CHECK (type IN (
    'appartement',
    'maison',
    'studio',
    'colocation',
    'saisonnier',
    'parking',
    'box',
    'local_commercial',
    'bureaux',
    'entrepot',
    'fonds_de_commerce',
    'immeuble',
    'terrain_agricole',
    'exploitation_agricole'
  ));


-- === MIGRATION: 20260331100000_fix_document_titles_bruts.sql ===
-- B7: Corriger les titres bruts des anciens documents
-- Remplacer les noms de fichiers (ex: "Capture_d_ecran_2024-03-15.png")
-- par des titres lisibles selon le type de document

UPDATE documents SET title = CASE
  WHEN type = 'cni_recto' THEN 'Carte d''Identité (Recto)'
  WHEN type = 'cni_verso' THEN 'Carte d''Identité (Verso)'
  WHEN type = 'assurance_habitation' THEN 'Attestation d''assurance habitation'
  WHEN type = 'contrat_bail' THEN 'Contrat de bail'
  WHEN type = 'quittance_loyer' THEN 'Quittance de loyer'
  WHEN type = 'bulletin_salaire' THEN 'Bulletin de salaire'
  WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
  WHEN type = 'justificatif_domicile' THEN 'Justificatif de domicile'
  WHEN type = 'rib' THEN 'Relevé d''Identité Bancaire'
  WHEN type = 'kbis' THEN 'Extrait KBIS'
  WHEN type = 'attestation_assurance_rc' THEN 'Attestation assurance RC Pro'
  WHEN type = 'dpe' THEN 'Diagnostic de Performance Énergétique'
  WHEN type = 'edl_entree' THEN 'État des lieux d''entrée'
  WHEN type = 'edl_sortie' THEN 'État des lieux de sortie'
  WHEN type = 'mandat_gestion' THEN 'Mandat de gestion'
  WHEN type = 'reglement_copropriete' THEN 'Règlement de copropriété'
  ELSE title
END
WHERE (
  title IS NULL
  OR title ~ '^Capture d.écran'
  OR title ~ '^capture'
  OR title ~ '^Screenshot'
  OR title ~ '^IMG_'
  OR title ~ '^[A-Z_]{4,}$'
  OR title ~ '^\d{4}-\d{2}-\d{2}'
  OR title ~ '\.(png|jpg|jpeg|pdf|webp)$'
)
AND type IS NOT NULL;


-- === MIGRATION: 20260406200000_create_entities_view_and_members.sql ===
-- =====================================================
-- MIGRATION: Create entities view + entity_members table
-- Date: 2026-04-07
--
-- CONTEXT: Le module comptabilite (20260406210000) reference
-- les tables `entities` et `entity_members` qui n'existent pas.
-- La table `legal_entities` existe deja et est utilisee partout.
--
-- SOLUTION (Option B - non-destructive) :
-- 1. Creer une vue `entities` pointant vers `legal_entities`
-- 2. Creer la table `entity_members` (junction users <-> entites)
-- 3. Backfill entity_members depuis les proprietaires existants
-- 4. Ajouter colonne `territory` pour TVA DROM-COM
-- =====================================================

-- =====================================================
-- 1. VUE entities → legal_entities
-- Permet au module comptable de faire FROM entities
-- sans renommer la table existante
-- =====================================================
CREATE OR REPLACE VIEW entities AS
  SELECT
    id,
    owner_profile_id,
    entity_type AS type,
    nom AS name,
    nom_commercial,
    siren,
    siret,
    numero_tva,
    adresse_siege AS address,
    code_postal_siege,
    ville_siege,
    pays_siege,
    regime_fiscal,
    tva_assujetti,
    tva_regime,
    tva_taux_defaut,
    iban,
    bic,
    is_active,
    created_at,
    updated_at
  FROM legal_entities;

COMMENT ON VIEW entities IS 'Vue de compatibilite pour le module comptable. Source: legal_entities.';

-- =====================================================
-- 2. TABLE entity_members
-- Junction table: qui a acces a quelle entite
-- Utilisee par toutes les RLS policies du module compta
-- =====================================================
CREATE TABLE IF NOT EXISTS entity_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'member', 'readonly', 'ec')),
  share_percentage NUMERIC(5,2),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entity_member_unique UNIQUE (entity_id, user_id)
);

CREATE INDEX idx_entity_members_entity ON entity_members(entity_id);
CREATE INDEX idx_entity_members_user ON entity_members(user_id);
CREATE INDEX idx_entity_members_profile ON entity_members(profile_id) WHERE profile_id IS NOT NULL;

ALTER TABLE entity_members ENABLE ROW LEVEL SECURITY;

-- Policy: un utilisateur voit ses propres memberships
CREATE POLICY "entity_members_own_access" ON entity_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Policy: un admin d'une entite peut gerer ses membres
CREATE POLICY "entity_members_admin_manage" ON entity_members
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  );

COMMENT ON TABLE entity_members IS 'Membres d''une entite (SCI, agence, copro). Utilise par RLS de toutes les tables comptables.';

-- =====================================================
-- 3. COLONNE territory sur legal_entities
-- Pour la validation TVA DROM-COM
-- =====================================================
ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS territory TEXT DEFAULT 'metropole'
  CHECK (territory IN ('metropole', 'martinique', 'guadeloupe', 'reunion', 'guyane', 'mayotte'));

COMMENT ON COLUMN legal_entities.territory IS 'Territoire pour taux TVA DROM-COM. Defaut: metropole (20%).';

-- =====================================================
-- 4. BACKFILL entity_members
-- Pour chaque legal_entity existante, creer un member admin
-- en suivant la chaine FK:
-- legal_entities.owner_profile_id → owner_profiles.profile_id
-- → profiles.id → profiles.user_id → auth.users.id
-- =====================================================
INSERT INTO entity_members (entity_id, user_id, profile_id, role)
SELECT
  le.id AS entity_id,
  p.user_id AS user_id,
  p.id AS profile_id,
  'admin' AS role
FROM legal_entities le
JOIN profiles p ON le.owner_profile_id = p.id
WHERE le.is_active = true
ON CONFLICT (entity_id, user_id) DO NOTHING;

-- Aussi backfill depuis entity_associates (associes de SCI, etc.)
INSERT INTO entity_members (entity_id, user_id, profile_id, role, share_percentage)
SELECT
  ea.legal_entity_id AS entity_id,
  p.user_id AS user_id,
  p.id AS profile_id,
  CASE
    WHEN ea.is_gerant THEN 'admin'
    ELSE 'member'
  END AS role,
  ea.pourcentage_capital AS share_percentage
FROM entity_associates ea
JOIN profiles p ON ea.profile_id = p.id
WHERE p.user_id IS NOT NULL
ON CONFLICT (entity_id, user_id) DO NOTHING;

-- =====================================================
-- 5. AUTO-PROVISION: trigger pour creer un entity_member
-- quand une nouvelle legal_entity est creee
-- =====================================================
CREATE OR REPLACE FUNCTION fn_auto_entity_member()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM profiles
  WHERE id = NEW.owner_profile_id;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO entity_members (entity_id, user_id, profile_id, role)
    VALUES (NEW.id, v_user_id, NEW.owner_profile_id, 'admin')
    ON CONFLICT (entity_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_entity_member ON legal_entities;
CREATE TRIGGER trg_auto_entity_member
  AFTER INSERT ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_entity_member();

-- =====================================================
-- 6. Updated_at trigger pour entity_members
-- =====================================================
CREATE OR REPLACE FUNCTION fn_entity_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entity_members_updated_at
  BEFORE UPDATE ON entity_members
  FOR EACH ROW
  EXECUTE FUNCTION fn_entity_members_updated_at();


-- === MIGRATION: 20260408120000_smart_meters_connected.sql ===
-- Migration : Compteurs connectés — Enedis SGE, GRDF ADICT, alertes conso
-- Feature gate : Pro+ (connected_meters)

-- ============================================================
-- Table 1 : Compteurs liés à un bien (property_meters)
-- Complète la table "meters" existante (liée à lease_id)
-- property_meters est liée au bien, pas au bail
-- ============================================================
CREATE TABLE IF NOT EXISTS property_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  meter_type TEXT NOT NULL
    CHECK (meter_type IN ('electricity', 'gas', 'water', 'heating', 'other')),
  provider TEXT,                          -- 'enedis', 'grdf', 'veolia', 'manual'

  -- Identifiant compteur
  meter_reference TEXT NOT NULL,          -- PDL, PCE, ou numéro compteur eau
  meter_serial TEXT,                      -- Numéro de série physique

  -- Connexion API
  is_connected BOOLEAN DEFAULT false,
  connection_consent_at TIMESTAMPTZ,      -- Date consentement locataire
  connection_consent_by UUID REFERENCES profiles(id),
  oauth_token_encrypted TEXT,             -- Token chiffré
  oauth_refresh_token_encrypted TEXT,
  oauth_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'active', 'error', 'expired')),
  sync_error_message TEXT,

  -- Contrat
  contract_holder TEXT,                   -- Nom titulaire contrat
  contract_start_date DATE,
  tariff_option TEXT,                     -- 'base', 'hc_hp', 'tempo'
  subscribed_power_kva INTEGER,           -- Puissance souscrite (kVA)

  -- Config alertes
  alert_threshold_daily NUMERIC,          -- Seuil alerte conso journalière
  alert_threshold_monthly NUMERIC,        -- Seuil mensuel

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, meter_type, meter_reference)
);

ALTER TABLE property_meters ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_property_meters_property ON property_meters(property_id);
CREATE INDEX IF NOT EXISTS idx_property_meters_sync ON property_meters(is_connected, sync_status);
CREATE INDEX IF NOT EXISTS idx_property_meters_type ON property_meters(meter_type);

-- ============================================================
-- Table 2 : Relevés compteurs connectés
-- Étend le concept de meter_readings pour les compteurs connectés
-- ============================================================
CREATE TABLE IF NOT EXISTS property_meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES property_meters(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),

  reading_date DATE NOT NULL,
  value NUMERIC NOT NULL,                 -- kWh, m³, etc.
  unit TEXT NOT NULL DEFAULT 'kWh'
    CHECK (unit IN ('kWh', 'm3', 'litres')),

  -- Source
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'enedis', 'grdf', 'veolia', 'import')),
  recorded_by UUID REFERENCES profiles(id), -- NULL si auto

  -- Photo (relevé manuel)
  photo_document_id UUID REFERENCES documents(id),

  -- Coût estimé
  estimated_cost_cents INTEGER,           -- Coût estimé basé sur le tarif

  -- Déduplication
  external_id TEXT,                       -- ID unique côté fournisseur

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meter_id, reading_date, source)
);

ALTER TABLE property_meter_readings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pm_readings_meter_date ON property_meter_readings(meter_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_pm_readings_property ON property_meter_readings(property_id);
CREATE INDEX IF NOT EXISTS idx_pm_readings_source ON property_meter_readings(source);

-- ============================================================
-- Table 3 : Alertes consommation
-- ============================================================
CREATE TABLE IF NOT EXISTS meter_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES property_meters(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  alert_type TEXT NOT NULL
    CHECK (alert_type IN ('overconsumption', 'no_reading', 'anomaly', 'contract_expiry')),
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  data JSONB DEFAULT '{}',
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meter_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_meter_alerts_meter ON meter_alerts(meter_id);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_property ON meter_alerts(property_id);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_type ON meter_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_unacked ON meter_alerts(meter_id) WHERE acknowledged_at IS NULL;

-- ============================================================
-- RLS Policies
-- ============================================================

-- property_meters: propriétaire du bien peut tout faire
CREATE POLICY "property_meters_owner_select" ON property_meters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "property_meters_owner_insert" ON property_meters
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "property_meters_owner_update" ON property_meters
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "property_meters_owner_delete" ON property_meters
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- property_meters: locataire avec bail actif peut lire
CREATE POLICY "property_meters_tenant_select" ON property_meters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meters.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

-- property_meter_readings: propriétaire
CREATE POLICY "pm_readings_owner_select" ON property_meter_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "pm_readings_owner_insert" ON property_meter_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- property_meter_readings: locataire avec bail actif
CREATE POLICY "pm_readings_tenant_select" ON property_meter_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meter_readings.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

CREATE POLICY "pm_readings_tenant_insert" ON property_meter_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meter_readings.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

-- meter_alerts: propriétaire
CREATE POLICY "meter_alerts_owner_select" ON meter_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "meter_alerts_owner_update" ON meter_alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- meter_alerts: locataire
CREATE POLICY "meter_alerts_tenant_select" ON meter_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = meter_alerts.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

-- ============================================================
-- Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_property_meters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_property_meters_updated_at
  BEFORE UPDATE ON property_meters
  FOR EACH ROW EXECUTE FUNCTION update_property_meters_updated_at();

-- ============================================================
-- Service role policies (for cron sync & OAuth callbacks)
-- ============================================================
CREATE POLICY "property_meters_service_all" ON property_meters
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

CREATE POLICY "pm_readings_service_all" ON property_meter_readings
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

CREATE POLICY "meter_alerts_service_all" ON meter_alerts
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );


-- === MIGRATION: 20260408120000_subscription_addons.sql ===
-- ============================================================
-- Migration: subscription_addons & sms_usage
-- Module Add-ons Stripe (packs signatures, stockage, SMS, RAR, état daté)
-- ============================================================

-- Table principale : add-ons achetés
CREATE TABLE IF NOT EXISTS subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  entity_id UUID REFERENCES legal_entities(id),

  -- Type
  addon_type TEXT NOT NULL
    CHECK (addon_type IN (
      'signature_pack',
      'storage_20gb',
      'sms',
      'rar_electronic',
      'etat_date'
    )),

  -- Stripe
  stripe_checkout_session_id TEXT,
  stripe_subscription_id TEXT,
  stripe_subscription_item_id TEXT,
  stripe_invoice_id TEXT,

  -- Quantité / Usage
  quantity INTEGER NOT NULL DEFAULT 1,
  consumed_count INTEGER DEFAULT 0,

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'active',
      'consumed',
      'cancelled',
      'expired'
    )),

  -- Dates
  purchased_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;

-- RLS : les utilisateurs ne voient que leurs propres add-ons
CREATE POLICY "Users can view their own addons"
  ON subscription_addons FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Service role full access on subscription_addons"
  ON subscription_addons FOR ALL
  USING (auth.role() = 'service_role');

-- Index
CREATE INDEX idx_addons_profile ON subscription_addons(profile_id);
CREATE INDEX idx_addons_type_status ON subscription_addons(addon_type, status);
CREATE INDEX idx_addons_stripe_session ON subscription_addons(stripe_checkout_session_id);
CREATE INDEX idx_addons_stripe_subscription ON subscription_addons(stripe_subscription_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_subscription_addons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscription_addons_updated_at
  BEFORE UPDATE ON subscription_addons
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_addons_updated_at();

-- ============================================================
-- Table : Suivi usage SMS (agrégé par mois)
-- ============================================================

CREATE TABLE IF NOT EXISTS sms_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  month TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  reported_to_stripe BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, month)
);

ALTER TABLE sms_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sms usage"
  ON sms_usage FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Service role full access on sms_usage"
  ON sms_usage FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_sms_usage_profile_month ON sms_usage(profile_id, month);

-- ============================================================
-- RPC : Incrémenter usage SMS (upsert atomique)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_sms_usage(
  p_profile_id UUID,
  p_month TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO sms_usage (profile_id, month, count)
  VALUES (p_profile_id, p_month, 1)
  ON CONFLICT (profile_id, month)
  DO UPDATE SET count = sms_usage.count + 1
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC : Consommer une signature d'un pack (FIFO)
-- ============================================================

CREATE OR REPLACE FUNCTION consume_addon_signature(
  p_profile_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_addon_id UUID;
BEGIN
  -- Sélectionner le pack actif le plus ancien (FIFO) qui a des signatures restantes
  SELECT id INTO v_addon_id
  FROM subscription_addons
  WHERE profile_id = p_profile_id
    AND addon_type = 'signature_pack'
    AND status = 'active'
    AND consumed_count < quantity
  ORDER BY purchased_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_addon_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Incrémenter consumed_count
  UPDATE subscription_addons
  SET consumed_count = consumed_count + 1,
      status = CASE
        WHEN consumed_count + 1 >= quantity THEN 'consumed'
        ELSE 'active'
      END,
      updated_at = now()
  WHERE id = v_addon_id;

  RETURN v_addon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === MIGRATION: 20260408130000_fix_subscription_plan_prices.sql ===
-- =====================================================
-- Migration: Fix subscription plan prices to match official pricing grid
-- Date: 2026-04-08
-- Description:
--   Ensures subscription_plans prices match the official Talok pricing:
--   - Gratuit: 0€/mois
--   - Starter: 9€/mois (900 centimes)
--   - Confort: 35€/mois (3500 centimes)
--   - Pro: 69€/mois (6900 centimes)
--   - Enterprise S: 249€/mois (24900 centimes)
--   Idempotent — safe to run multiple times.
-- =====================================================

BEGIN;

UPDATE subscription_plans SET price_monthly = 0, price_yearly = 0
WHERE slug = 'gratuit' AND price_monthly != 0;

UPDATE subscription_plans SET price_monthly = 900, price_yearly = 9000
WHERE slug = 'starter' AND price_monthly != 900;

UPDATE subscription_plans SET price_monthly = 3500, price_yearly = 35000
WHERE slug = 'confort' AND price_monthly != 3500;

UPDATE subscription_plans SET price_monthly = 6900, price_yearly = 69000
WHERE slug = 'pro' AND price_monthly != 6900;

UPDATE subscription_plans SET price_monthly = 24900, price_yearly = 249000
WHERE slug = 'enterprise_s' AND price_monthly != 24900;

COMMIT;


COMMIT;
