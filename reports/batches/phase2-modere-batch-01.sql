-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 1/15
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260208100000_fix_data_storage_audit.sql
-- Risk: MODERE
-- Why: ALTER column (type/constraint)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260208100000_fix_data_storage_audit.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260208100000', 'fix_data_storage_audit')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260208100000_fix_data_storage_audit.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260211000000_p2_unique_constraint_and_gdpr_rpc.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260211000000_p2_unique_constraint_and_gdpr_rpc.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260211000000', 'p2_unique_constraint_and_gdpr_rpc')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260211000000_p2_unique_constraint_and_gdpr_rpc.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260211100000_bic_compliance_tax_regime.sql
-- Risk: MODERE
-- Why: +1 triggers, UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260211100000_bic_compliance_tax_regime.sql'; END $pre$;

-- ============================================
-- BIC Compliance: Régime fiscal + Inventaire mobilier
-- Corrige les lacunes identifiées dans l'audit BIC
-- ============================================

-- 1. Enum pour le régime fiscal BIC
DO $$ BEGIN
  CREATE TYPE tax_regime_type AS ENUM (
    'micro_foncier',    -- Revenus fonciers < 15k€ (location nue)
    'reel_foncier',     -- Revenus fonciers réel (location nue)
    'micro_bic',        -- BIC micro < 77 700€ (location meublée)
    'reel_bic'          -- BIC réel (location meublée)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Enum pour le statut LMNP/LMP
DO $$ BEGIN
  CREATE TYPE lmnp_status_type AS ENUM (
    'lmnp',  -- Loueur Meublé Non Professionnel
    'lmp'    -- Loueur Meublé Professionnel
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Ajouter colonnes au tableau leases
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS tax_regime text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lmnp_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS furniture_inventory jsonb DEFAULT NULL;

-- 4. Ajouter indicateur meublé au tableau properties
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS is_furnished boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_tax_regime text DEFAULT NULL;

-- 5. Contrainte: si bail meublé, tax_regime doit être BIC
-- (informative, pas bloquante pour permettre migration progressive)
COMMENT ON COLUMN leases.tax_regime IS
  'Régime fiscal: micro_foncier, reel_foncier (bail nu), micro_bic, reel_bic (bail meublé)';

COMMENT ON COLUMN leases.lmnp_status IS
  'Statut fiscal meublé: lmnp (non professionnel) ou lmp (professionnel)';

COMMENT ON COLUMN leases.furniture_inventory IS
  'Inventaire mobilier JSON (Décret 2015-981) — 11 éléments obligatoires + supplémentaires';

COMMENT ON COLUMN properties.is_furnished IS
  'Indique si le bien est meublé (conditionne le type de bail et le régime fiscal BIC)';

COMMENT ON COLUMN properties.default_tax_regime IS
  'Régime fiscal par défaut pour les nouveaux baux sur ce bien';

-- 6. Auto-update is_furnished quand un bail meublé est créé
CREATE OR REPLACE FUNCTION update_property_furnished_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type_bail IN ('meuble', 'bail_mobilite', 'etudiant') THEN
    UPDATE properties
    SET is_furnished = true
    WHERE id = NEW.property_id
      AND is_furnished = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_property_furnished ON leases;
CREATE TRIGGER trg_update_property_furnished
  AFTER INSERT ON leases
  FOR EACH ROW
  EXECUTE FUNCTION update_property_furnished_status();

-- 7. Vue pour le monitoring LMNP/LMP
CREATE OR REPLACE VIEW v_owner_rental_income AS
SELECT
  p.owner_id,
  EXTRACT(YEAR FROM i.periode::date) AS year,
  SUM(CASE
    WHEN l.type_bail IN ('meuble', 'bail_mobilite', 'etudiant', 'saisonnier')
    THEN i.montant_total
    ELSE 0
  END) AS furnished_income,
  SUM(CASE
    WHEN l.type_bail IN ('nu', 'bail_mixte')
    THEN i.montant_total
    ELSE 0
  END) AS unfurnished_income,
  SUM(i.montant_total) AS total_income
FROM invoices i
  JOIN leases l ON l.id = i.lease_id
  JOIN properties p ON p.id = l.property_id
WHERE i.statut = 'paid'
GROUP BY p.owner_id, EXTRACT(YEAR FROM i.periode::date);

-- 8. Index pour performances
CREATE INDEX IF NOT EXISTS idx_leases_tax_regime ON leases(tax_regime) WHERE tax_regime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_is_furnished ON properties(is_furnished) WHERE is_furnished = true;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260211100000', 'bic_compliance_tax_regime')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260211100000_bic_compliance_tax_regime.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260212100000_audit_v2_merge_and_prevention.sql
-- Risk: MODERE
-- Why: +2 triggers, UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260212100000_audit_v2_merge_and_prevention.sql'; END $pre$;

-- ============================================================================
-- AUDIT D'INTÉGRITÉ V2 — FUSION, DRY RUN, ROLLBACK, PRÉVENTION
-- Date: 2026-02-12
-- Complète 20260212000000_audit_database_integrity.sql
-- ============================================================================
-- Ce script ajoute :
--   Phase 3 : Détection avancée des doublons (fuzzy, temporels)
--   Phase 4 : Fonctions de fusion SAFE (merge avec backup + rollback)
--   Phase 5 : Contraintes de prévention (FK, UNIQUE, triggers)
-- ============================================================================
-- PRÉREQUIS : 20260212000000_audit_database_integrity.sql déjà appliqué
-- ============================================================================


-- ============================================================================
-- INFRASTRUCTURE : Tables de support
-- ============================================================================

-- Table d'audit pour TOUTES les opérations de nettoyage
CREATE TABLE IF NOT EXISTS _audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,          -- MERGE, DELETE, NULLIFY, BACKUP, ROLLBACK
  table_name TEXT NOT NULL,
  old_id TEXT,
  new_id TEXT,
  details TEXT,
  affected_rows INTEGER DEFAULT 0,
  executed_by TEXT DEFAULT current_user,
  session_id TEXT DEFAULT current_setting('request.jwt.claim.sub', true),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON _audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON _audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_date ON _audit_log(created_at);

COMMENT ON TABLE _audit_log IS 'Journal d''audit de toutes les opérations de nettoyage/fusion de données.';


-- ============================================================================
-- PHASE 3 : DÉTECTION AVANCÉE DES DOUBLONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 Doublons de propriétés (adresse normalisée + code_postal + ville)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_properties()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  owner_ids UUID[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons exacts : même adresse normalisée + CP + ville + même owner
  RETURN QUERY
  SELECT
    ('exact:' || p.owner_id || ':' || LOWER(TRIM(p.adresse_complete)) || ':' || p.code_postal)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(p.id ORDER BY p.created_at ASC),
    ARRAY_AGG(DISTINCT p.owner_id),
    MIN(p.created_at),
    MAX(p.created_at),
    'EXACT'::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
  GROUP BY p.owner_id, LOWER(TRIM(p.adresse_complete)), p.code_postal
  HAVING COUNT(*) > 1;

  -- Doublons temporels : même owner, créés à < 5 min d'intervalle
  RETURN QUERY
  SELECT
    ('temporal:' || p1.owner_id || ':' || p1.id || ':' || p2.id)::TEXT,
    2::BIGINT,
    ARRAY[p1.id, p2.id],
    ARRAY[p1.owner_id],
    LEAST(p1.created_at, p2.created_at),
    GREATEST(p1.created_at, p2.created_at),
    'TEMPORAL (<5min)'::TEXT
  FROM properties p1
  JOIN properties p2 ON p1.owner_id = p2.owner_id
    AND p1.id < p2.id
    AND p1.deleted_at IS NULL AND p2.deleted_at IS NULL
    AND ABS(EXTRACT(EPOCH FROM (p1.created_at - p2.created_at))) < 300
    AND LOWER(TRIM(p1.ville)) = LOWER(TRIM(p2.ville))
    AND p1.code_postal = p2.code_postal;

  -- Doublons flous : même CP + ville, adresses très similaires (même owner)
  RETURN QUERY
  SELECT
    ('fuzzy:' || p1.owner_id || ':' || p1.id || ':' || p2.id)::TEXT,
    2::BIGINT,
    ARRAY[p1.id, p2.id],
    ARRAY[p1.owner_id],
    LEAST(p1.created_at, p2.created_at),
    GREATEST(p1.created_at, p2.created_at),
    'FUZZY (même CP+ville, type identique)'::TEXT
  FROM properties p1
  JOIN properties p2 ON p1.owner_id = p2.owner_id
    AND p1.id < p2.id
    AND p1.deleted_at IS NULL AND p2.deleted_at IS NULL
    AND p1.code_postal = p2.code_postal
    AND LOWER(TRIM(p1.ville)) = LOWER(TRIM(p2.ville))
    AND p1.type = p2.type
    AND p1.surface = p2.surface
    AND p1.nb_pieces = p2.nb_pieces
    -- Exclure les paires déjà capturées en exact
    AND LOWER(TRIM(p1.adresse_complete)) != LOWER(TRIM(p2.adresse_complete));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.2 Doublons de profils/contacts (email OU nom+prénom+date_naissance)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_profiles()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  emails TEXT[],
  roles TEXT[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons par email (même email dans profiles)
  RETURN QUERY
  SELECT
    ('email:' || LOWER(TRIM(p.email)))::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(p.id ORDER BY p.created_at ASC),
    ARRAY_AGG(DISTINCT p.email),
    ARRAY_AGG(DISTINCT p.role),
    MIN(p.created_at),
    MAX(p.created_at),
    'EMAIL_EXACT'::TEXT
  FROM profiles p
  WHERE p.email IS NOT NULL AND TRIM(p.email) != ''
  GROUP BY LOWER(TRIM(p.email))
  HAVING COUNT(*) > 1;

  -- Doublons par nom+prénom+date_naissance
  RETURN QUERY
  SELECT
    ('identity:' || LOWER(TRIM(COALESCE(p.nom,''))) || ':' || LOWER(TRIM(COALESCE(p.prenom,''))) || ':' || COALESCE(p.date_naissance::TEXT,''))::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(p.id ORDER BY p.created_at ASC),
    ARRAY_AGG(p.email),
    ARRAY_AGG(DISTINCT p.role),
    MIN(p.created_at),
    MAX(p.created_at),
    'IDENTITY (nom+prénom+naissance)'::TEXT
  FROM profiles p
  WHERE p.nom IS NOT NULL AND p.prenom IS NOT NULL AND p.date_naissance IS NOT NULL
    AND TRIM(p.nom) != '' AND TRIM(p.prenom) != ''
  GROUP BY LOWER(TRIM(p.nom)), LOWER(TRIM(p.prenom)), p.date_naissance
  HAVING COUNT(*) > 1;

  -- Doublons user_id (critique : même auth.users → 2+ profiles)
  RETURN QUERY
  SELECT
    ('user_id:' || p.user_id)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(p.id ORDER BY p.created_at ASC),
    ARRAY_AGG(p.email),
    ARRAY_AGG(DISTINCT p.role),
    MIN(p.created_at),
    MAX(p.created_at),
    'CRITICAL: même user_id'::TEXT
  FROM profiles p
  GROUP BY p.user_id
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.3 Doublons de baux (property_id + tenant_id + date_debut ±7j)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_leases()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  statuts TEXT[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons exacts : même property + même période
  RETURN QUERY
  SELECT
    ('exact:' || l.property_id || ':' || l.date_debut)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(l.id ORDER BY l.created_at ASC),
    ARRAY_AGG(l.statut),
    MIN(l.created_at),
    MAX(l.created_at),
    'EXACT (même property+date_debut)'::TEXT
  FROM leases l
  WHERE l.property_id IS NOT NULL
    AND l.statut NOT IN ('cancelled', 'archived')
  GROUP BY l.property_id, l.date_debut
  HAVING COUNT(*) > 1;

  -- Doublons temporels : même property, dates proches (±7 jours), même type
  RETURN QUERY
  SELECT
    ('temporal:' || l1.id || ':' || l2.id)::TEXT,
    2::BIGINT,
    ARRAY[l1.id, l2.id],
    ARRAY[l1.statut, l2.statut],
    LEAST(l1.created_at, l2.created_at),
    GREATEST(l1.created_at, l2.created_at),
    'TEMPORAL (même property, date ±7j)'::TEXT
  FROM leases l1
  JOIN leases l2 ON l1.property_id = l2.property_id
    AND l1.id < l2.id
    AND l1.property_id IS NOT NULL
    AND l1.type_bail = l2.type_bail
    AND l1.statut NOT IN ('cancelled', 'archived')
    AND l2.statut NOT IN ('cancelled', 'archived')
    AND ABS(l1.date_debut - l2.date_debut) <= 7;

  -- Baux actifs chevauchants sur même propriété
  RETURN QUERY
  SELECT
    ('overlap:' || l1.property_id || ':' || l1.id || ':' || l2.id)::TEXT,
    2::BIGINT,
    ARRAY[l1.id, l2.id],
    ARRAY[l1.statut, l2.statut],
    LEAST(l1.created_at, l2.created_at),
    GREATEST(l1.created_at, l2.created_at),
    'OVERLAP (baux actifs chevauchants)'::TEXT
  FROM leases l1
  JOIN leases l2 ON l1.property_id = l2.property_id
    AND l1.id < l2.id
    AND l1.property_id IS NOT NULL
    AND l1.statut IN ('active', 'pending_signature', 'fully_signed')
    AND l2.statut IN ('active', 'pending_signature', 'fully_signed')
    AND l1.date_debut <= COALESCE(l2.date_fin, '9999-12-31'::DATE)
    AND l2.date_debut <= COALESCE(l1.date_fin, '9999-12-31'::DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.4 Doublons de documents (nom + entité + created_at ±1min)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_documents()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons par storage_path (même fichier physique)
  RETURN QUERY
  SELECT
    ('storage:' || COALESCE(d.storage_path, d.url))::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(d.id ORDER BY d.created_at ASC),
    MIN(d.created_at),
    MAX(d.created_at),
    'STORAGE_PATH identique'::TEXT
  FROM documents d
  WHERE COALESCE(d.storage_path, d.url) IS NOT NULL
  GROUP BY COALESCE(d.storage_path, d.url)
  HAVING COUNT(*) > 1;

  -- Doublons temporels par entité (même type + même parent + <1 min)
  RETURN QUERY
  SELECT
    ('temporal:' || d1.id || ':' || d2.id)::TEXT,
    2::BIGINT,
    ARRAY[d1.id, d2.id],
    LEAST(d1.created_at, d2.created_at),
    GREATEST(d1.created_at, d2.created_at),
    'TEMPORAL (<1min, même type+parent)'::TEXT
  FROM documents d1
  JOIN documents d2 ON d1.id < d2.id
    AND d1.type = d2.type
    AND COALESCE(d1.lease_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(d2.lease_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND COALESCE(d1.property_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(d2.property_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND ABS(EXTRACT(EPOCH FROM (d1.created_at - d2.created_at))) < 60;

  -- Doublons par nom de fichier + entité
  RETURN QUERY
  SELECT
    ('name:' || LOWER(TRIM(COALESCE(d.nom, d.nom_fichier, ''))) || ':' || COALESCE(d.lease_id::TEXT, d.property_id::TEXT, 'none'))::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(d.id ORDER BY d.created_at ASC),
    MIN(d.created_at),
    MAX(d.created_at),
    'NOM_FICHIER identique (même entité)'::TEXT
  FROM documents d
  WHERE COALESCE(d.nom, d.nom_fichier) IS NOT NULL
    AND TRIM(COALESCE(d.nom, d.nom_fichier, '')) != ''
  GROUP BY LOWER(TRIM(COALESCE(d.nom, d.nom_fichier, ''))), COALESCE(d.lease_id::TEXT, d.property_id::TEXT, 'none')
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.5 Doublons de paiements (montant + invoice_id + date ±1j)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_payments()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  montants NUMERIC[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons exacts : même invoice + même montant
  RETURN QUERY
  SELECT
    ('exact:' || py.invoice_id || ':' || py.montant)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(py.id ORDER BY py.created_at ASC),
    ARRAY_AGG(py.montant),
    MIN(py.created_at),
    MAX(py.created_at),
    'EXACT (même invoice+montant)'::TEXT
  FROM payments py
  GROUP BY py.invoice_id, py.montant
  HAVING COUNT(*) > 1;

  -- Doublons temporels : même invoice, même montant, < 1 jour
  RETURN QUERY
  SELECT
    ('temporal:' || p1.id || ':' || p2.id)::TEXT,
    2::BIGINT,
    ARRAY[p1.id, p2.id],
    ARRAY[p1.montant, p2.montant],
    LEAST(p1.created_at, p2.created_at),
    GREATEST(p1.created_at, p2.created_at),
    'TEMPORAL (<24h, même invoice+montant)'::TEXT
  FROM payments p1
  JOIN payments p2 ON p1.invoice_id = p2.invoice_id
    AND p1.id < p2.id
    AND p1.montant = p2.montant
    AND ABS(EXTRACT(EPOCH FROM (p1.created_at - p2.created_at))) < 86400;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.6 Doublons d'EDL (lease_id + type + date ±1j)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_edl()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  statuts TEXT[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons exacts : même bail + même type
  RETURN QUERY
  SELECT
    ('exact:' || e.lease_id || ':' || e.type)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(e.id ORDER BY e.created_at ASC),
    ARRAY_AGG(e.status),
    MIN(e.created_at),
    MAX(e.created_at),
    'EXACT (même bail+type)'::TEXT
  FROM edl e
  GROUP BY e.lease_id, e.type
  HAVING COUNT(*) > 1;

  -- Doublons temporels
  RETURN QUERY
  SELECT
    ('temporal:' || e1.id || ':' || e2.id)::TEXT,
    2::BIGINT,
    ARRAY[e1.id, e2.id],
    ARRAY[e1.status, e2.status],
    LEAST(e1.created_at, e2.created_at),
    GREATEST(e1.created_at, e2.created_at),
    'TEMPORAL (<24h, même bail+type)'::TEXT
  FROM edl e1
  JOIN edl e2 ON e1.lease_id = e2.lease_id
    AND e1.type = e2.type
    AND e1.id < e2.id
    AND ABS(EXTRACT(EPOCH FROM (e1.created_at - e2.created_at))) < 86400;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.7 Doublons de factures (lease_id + periode)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_invoices()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  montants NUMERIC[],
  statuts TEXT[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ('exact:' || i.lease_id || ':' || i.periode)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(i.id ORDER BY i.created_at ASC),
    ARRAY_AGG(i.montant_total),
    ARRAY_AGG(i.statut),
    MIN(i.created_at),
    MAX(i.created_at),
    'EXACT (même bail+période)'::TEXT
  FROM invoices i
  GROUP BY i.lease_id, i.periode
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.8 Rapport consolidé de tous les doublons
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_all_duplicates_summary()
RETURNS TABLE(
  entity TEXT,
  match_type TEXT,
  duplicate_groups BIGINT,
  total_excess_records BIGINT,
  severity TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'properties'::TEXT, dp.match_type, COUNT(*)::BIGINT,
    SUM(dp.nb_doublons - 1)::BIGINT, 'HIGH'::TEXT
  FROM audit_duplicate_properties() dp
  GROUP BY dp.match_type;

  RETURN QUERY
  SELECT 'profiles'::TEXT, dp.match_type, COUNT(*)::BIGINT,
    SUM(dp.nb_doublons - 1)::BIGINT,
    CASE WHEN dp.match_type LIKE '%user_id%' THEN 'CRITICAL' ELSE 'HIGH' END::TEXT
  FROM audit_duplicate_profiles() dp
  GROUP BY dp.match_type;

  RETURN QUERY
  SELECT 'leases'::TEXT, dl.match_type, COUNT(*)::BIGINT,
    SUM(dl.nb_doublons - 1)::BIGINT,
    CASE WHEN dl.match_type LIKE '%OVERLAP%' THEN 'CRITICAL' ELSE 'HIGH' END::TEXT
  FROM audit_duplicate_leases() dl
  GROUP BY dl.match_type;

  RETURN QUERY
  SELECT 'documents'::TEXT, dd.match_type, COUNT(*)::BIGINT,
    SUM(dd.nb_doublons - 1)::BIGINT, 'MEDIUM'::TEXT
  FROM audit_duplicate_documents() dd
  GROUP BY dd.match_type;

  RETURN QUERY
  SELECT 'payments'::TEXT, dp.match_type, COUNT(*)::BIGINT,
    SUM(dp.nb_doublons - 1)::BIGINT, 'CRITICAL'::TEXT
  FROM audit_duplicate_payments() dp
  GROUP BY dp.match_type;

  RETURN QUERY
  SELECT 'edl'::TEXT, de.match_type, COUNT(*)::BIGINT,
    SUM(de.nb_doublons - 1)::BIGINT, 'MEDIUM'::TEXT
  FROM audit_duplicate_edl() de
  GROUP BY de.match_type;

  RETURN QUERY
  SELECT 'invoices'::TEXT, di.match_type, COUNT(*)::BIGINT,
    SUM(di.nb_doublons - 1)::BIGINT, 'CRITICAL'::TEXT
  FROM audit_duplicate_invoices() di
  GROUP BY di.match_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PHASE 4 : FONCTIONS DE FUSION SAFE (MERGE)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 Fusion générique : élit un master, transfère les enfants, supprime
-- ----------------------------------------------------------------------------

-- Helper : compter les champs non-null d'un enregistrement
CREATE OR REPLACE FUNCTION _count_non_null_fields(p_table TEXT, p_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  EXECUTE format(
    'SELECT COUNT(*) FROM (
       SELECT unnest(ARRAY[%s]) AS val
     ) sub WHERE val IS NOT NULL',
    (SELECT string_agg(quote_ident(column_name) || '::TEXT', ', ')
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = p_table)
  ) USING p_id INTO v_count;
  RETURN v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- 4.2 Merge de propriétés
CREATE OR REPLACE FUNCTION merge_duplicate_properties(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Validation
  IF p_master_id = p_duplicate_id THEN
    step := 'ERROR'; detail := 'master_id et duplicate_id sont identiques'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_master_id) THEN
    step := 'ERROR'; detail := 'master_id introuvable'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_duplicate_id) THEN
    step := 'ERROR'; detail := 'duplicate_id introuvable'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- 1. Backup
  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'properties', p_duplicate_id::TEXT, 'MERGE', to_jsonb(p), 'Fusion vers ' || p_master_id
    FROM properties p WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon dans _audit_cleanup_archive'; affected_rows := 1;
  RETURN NEXT;

  -- 2. Transfert : leases
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM leases WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE leases SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'leases.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 3. Transfert : units
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM units WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE units SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'units.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 4. Transfert : charges
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM charges WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE charges SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'charges.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 5. Transfert : documents
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM documents WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE documents SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'documents.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 6. Transfert : tickets
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM tickets WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE tickets SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'tickets.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 7. Transfert : photos
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM photos WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE photos SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'photos.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 8. Transfert : visit_slots
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM visit_slots WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE visit_slots SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'visit_slots.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 9. Transfert : property_ownership
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM property_ownership WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE property_ownership SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'property_ownership.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 10. Transfert : conversations
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM conversations WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE conversations SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'conversations.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 11. Enrichir le master avec les champs manquants du doublon
  IF NOT p_dry_run THEN
    UPDATE properties SET
      cover_url = COALESCE(properties.cover_url, dup.cover_url),
      loyer_reference = COALESCE(properties.loyer_reference, dup.loyer_reference),
      loyer_base = COALESCE(properties.loyer_base, dup.loyer_base),
      charges_mensuelles = COALESCE(properties.charges_mensuelles, dup.charges_mensuelles),
      depot_garantie = COALESCE(properties.depot_garantie, dup.depot_garantie),
      dpe_classe_energie = COALESCE(properties.dpe_classe_energie, dup.dpe_classe_energie),
      dpe_classe_climat = COALESCE(properties.dpe_classe_climat, dup.dpe_classe_climat),
      visite_virtuelle_url = COALESCE(properties.visite_virtuelle_url, dup.visite_virtuelle_url),
      latitude = COALESCE(properties.latitude, dup.latitude),
      longitude = COALESCE(properties.longitude, dup.longitude)
    FROM properties dup
    WHERE properties.id = p_master_id AND dup.id = p_duplicate_id;
  END IF;
  step := '3.ENRICH'; detail := 'Champs manquants copiés vers master'; affected_rows := 1;
  RETURN NEXT;

  -- 12. Suppression (soft-delete si colonne existe, sinon hard delete)
  IF NOT p_dry_run THEN
    UPDATE properties SET deleted_at = NOW() WHERE id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
    VALUES ('MERGE', 'properties', p_duplicate_id::TEXT, p_master_id::TEXT,
            'Fusion propriété doublon → master');
  ELSE
    v_count := 1;
  END IF;
  step := '4.DELETE'; detail := 'Soft-delete du doublon (deleted_at = NOW())'; affected_rows := v_count;
  RETURN NEXT;

  step := 'DONE';
  detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN terminé — aucune modification' ELSE '✅ Fusion exécutée' END;
  affected_rows := 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.3 Merge de factures dupliquées
CREATE OR REPLACE FUNCTION merge_duplicate_invoices(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_master_id = p_duplicate_id THEN
    step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- 1. Backup
  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'invoices', p_duplicate_id::TEXT, 'MERGE', to_jsonb(i), 'Fusion vers ' || p_master_id
    FROM invoices i WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1;
  RETURN NEXT;

  -- 2. Transfert des paiements
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM payments WHERE invoice_id = p_duplicate_id;
  ELSE
    UPDATE payments SET invoice_id = p_master_id WHERE invoice_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'payments.invoice_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 3. Transfert des payment_shares
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM payment_shares WHERE invoice_id = p_duplicate_id;
  ELSE
    UPDATE payment_shares SET invoice_id = p_master_id WHERE invoice_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'payment_shares.invoice_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 4. Suppression
  IF NOT p_dry_run THEN
    DELETE FROM invoices WHERE id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
    VALUES ('MERGE', 'invoices', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion facture doublon');
  ELSE
    v_count := 1;
  END IF;
  step := '3.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count;
  RETURN NEXT;

  step := 'DONE';
  detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN' ELSE '✅ Fusion exécutée' END;
  affected_rows := 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.4 Merge de documents dupliqués
CREATE OR REPLACE FUNCTION merge_duplicate_documents(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_master_id = p_duplicate_id THEN
    step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- 1. Backup
  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'documents', p_duplicate_id::TEXT, 'MERGE', to_jsonb(d), 'Fusion vers ' || p_master_id
    FROM documents d WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1;
  RETURN NEXT;

  -- 2. Transfert : documents.replaced_by
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM documents WHERE replaced_by = p_duplicate_id;
  ELSE
    UPDATE documents SET replaced_by = p_master_id WHERE replaced_by = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'documents.replaced_by'; affected_rows := v_count;
  RETURN NEXT;

  -- 3. Enrichir master
  IF NOT p_dry_run THEN
    UPDATE documents SET
      storage_path = COALESCE(documents.storage_path, dup.storage_path),
      url = COALESCE(documents.url, dup.url),
      mime_type = COALESCE(documents.mime_type, dup.mime_type),
      size = COALESCE(documents.size, dup.size),
      preview_url = COALESCE(documents.preview_url, dup.preview_url)
    FROM documents dup
    WHERE documents.id = p_master_id AND dup.id = p_duplicate_id;
  END IF;
  step := '3.ENRICH'; detail := 'Champs manquants copiés'; affected_rows := 1;
  RETURN NEXT;

  -- 4. Suppression
  IF NOT p_dry_run THEN
    DELETE FROM documents WHERE id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
    VALUES ('MERGE', 'documents', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion document doublon');
  ELSE
    v_count := 1;
  END IF;
  step := '4.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count;
  RETURN NEXT;

  step := 'DONE';
  detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN' ELSE '✅ Fusion exécutée' END;
  affected_rows := 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.5 Merge d'EDL dupliqués
CREATE OR REPLACE FUNCTION merge_duplicate_edl(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_master_id = p_duplicate_id THEN
    step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- 1. Backup
  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'edl', p_duplicate_id::TEXT, 'MERGE', to_jsonb(e), 'Fusion vers ' || p_master_id
    FROM edl e WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1;
  RETURN NEXT;

  -- 2. Transfert edl_items (ceux du doublon qui n'existent pas dans le master)
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM edl_items WHERE edl_id = p_duplicate_id;
  ELSE
    UPDATE edl_items SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'edl_items.edl_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 3. Transfert edl_media
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM edl_media WHERE edl_id = p_duplicate_id;
  ELSE
    UPDATE edl_media SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'edl_media.edl_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 4. Transfert edl_signatures
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM edl_signatures WHERE edl_id = p_duplicate_id;
  ELSE
    UPDATE edl_signatures SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'edl_signatures.edl_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 5. Transfert edl_meter_readings
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM edl_meter_readings WHERE edl_id = p_duplicate_id;
  ELSE
    UPDATE edl_meter_readings SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'edl_meter_readings.edl_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 6. Suppression
  IF NOT p_dry_run THEN
    DELETE FROM edl WHERE id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
    VALUES ('MERGE', 'edl', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion EDL doublon');
  ELSE
    v_count := 1;
  END IF;
  step := '3.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count;
  RETURN NEXT;

  step := 'DONE';
  detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN' ELSE '✅ Fusion exécutée' END;
  affected_rows := 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PHASE 5 : PRÉVENTION — CONTRAINTES FK, UNIQUE, TRIGGERS
-- ============================================================================
-- ⚠️ Ces contraintes sont ajoutées avec NOT VALID + VALIDATE séparément
-- pour éviter de bloquer la table pendant la création.
-- Elles sont idempotentes (IF NOT EXISTS / DO $$ ... $$).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 FK Formelles manquantes
-- ----------------------------------------------------------------------------

-- leases.tenant_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leases_tenant_id' AND table_name = 'leases'
  ) THEN
    -- D'abord nettoyer les valeurs invalides
    UPDATE leases SET tenant_id = NULL
    WHERE tenant_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = leases.tenant_id);
    -- Puis ajouter la contrainte
    ALTER TABLE leases
      ADD CONSTRAINT fk_leases_tenant_id
      FOREIGN KEY (tenant_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- leases.owner_id → profiles.id (skip if column doesn't exist)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'owner_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leases_owner_id' AND table_name = 'leases'
  ) THEN
    UPDATE leases SET owner_id = NULL
    WHERE owner_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = leases.owner_id);
    ALTER TABLE leases
      ADD CONSTRAINT fk_leases_owner_id
      FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- tickets.assigned_provider_id → profiles.id (skip if column doesn't exist)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'assigned_provider_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tickets_assigned_provider_id' AND table_name = 'tickets'
  ) THEN
    UPDATE tickets SET assigned_provider_id = NULL
    WHERE assigned_provider_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = tickets.assigned_provider_id);
    ALTER TABLE tickets
      ADD CONSTRAINT fk_tickets_assigned_provider_id
      FOREIGN KEY (assigned_provider_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- tickets.owner_id → profiles.id (skip if column doesn't exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'owner_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_tickets_owner_id' AND table_name = 'tickets')
  THEN
    UPDATE tickets SET owner_id = NULL WHERE owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = tickets.owner_id);
    ALTER TABLE tickets ADD CONSTRAINT fk_tickets_owner_id FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- documents.profile_id → profiles.id (skip if column doesn't exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'profile_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_documents_profile_id' AND table_name = 'documents')
  THEN
    UPDATE documents SET profile_id = NULL WHERE profile_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = documents.profile_id);
    ALTER TABLE documents ADD CONSTRAINT fk_documents_profile_id FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- building_units.current_lease_id → leases.id (skip if column/table doesn't exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'building_units' AND column_name = 'current_lease_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_building_units_current_lease_id' AND table_name = 'building_units')
  THEN
    UPDATE building_units SET current_lease_id = NULL WHERE current_lease_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leases WHERE id = building_units.current_lease_id);
    ALTER TABLE building_units ADD CONSTRAINT fk_building_units_current_lease_id FOREIGN KEY (current_lease_id) REFERENCES leases(id) ON DELETE SET NULL;
  END IF;
END $$;

-- work_orders.quote_id → quotes.id (skip if column doesn't exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_work_orders_quote_id' AND table_name = 'work_orders')
  THEN
    UPDATE work_orders SET quote_id = NULL WHERE quote_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quotes WHERE id = work_orders.quote_id);
    ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_quote_id FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- work_orders.property_id → properties.id (skip if column doesn't exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'property_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_work_orders_property_id' AND table_name = 'work_orders')
  THEN
    UPDATE work_orders SET property_id = NULL WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties WHERE id = work_orders.property_id);
    ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5.2 Contraintes UNIQUE pour empêcher les futurs doublons
-- ----------------------------------------------------------------------------

-- Empêcher 2 factures pour le même bail + même période
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_lease_periode'
  ) THEN
    -- Supprimer les doublons avant d'ajouter la contrainte
    -- On garde la plus ancienne (ou la payée si elle existe)
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY lease_id, periode
        ORDER BY
          CASE WHEN statut = 'paid' THEN 0 ELSE 1 END,
          created_at ASC
      ) AS rn
      FROM invoices
    )
    DELETE FROM invoices WHERE id IN (
      SELECT id FROM ranked WHERE rn > 1
    );

    ALTER TABLE invoices
      ADD CONSTRAINT uq_invoices_lease_periode
      UNIQUE (lease_id, periode);
  END IF;
END $$;

-- Empêcher 2 signataires identiques sur le même bail
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_lease_signers_lease_profile'
  ) THEN
    -- Supprimer les doublons (garder le plus ancien)
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY lease_id, profile_id
        ORDER BY
          CASE WHEN signature_status = 'signed' THEN 0 ELSE 1 END,
          created_at ASC
      ) AS rn
      FROM lease_signers
      WHERE profile_id IS NOT NULL
    )
    DELETE FROM lease_signers WHERE id IN (
      SELECT id FROM ranked WHERE rn > 1
    );

    -- Contrainte partielle (profile_id non null)
    CREATE UNIQUE INDEX IF NOT EXISTS uq_lease_signers_lease_profile
      ON lease_signers (lease_id, profile_id)
      WHERE profile_id IS NOT NULL;
  END IF;
END $$;

-- Empêcher 2 EDL de même type sur le même bail (hors annulés)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_edl_lease_type_active'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_edl_lease_type_active
      ON edl (lease_id, type)
      WHERE status NOT IN ('cancelled', 'disputed');
  END IF;
END $$;

-- Empêcher les doublons de roommates sur le même bail
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_roommates_lease_profile'
  ) THEN
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY lease_id, profile_id ORDER BY created_at ASC
      ) AS rn
      FROM roommates
    )
    DELETE FROM roommates WHERE id IN (
      SELECT id FROM ranked WHERE rn > 1
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_roommates_lease_profile
      ON roommates (lease_id, profile_id);
  END IF;
END $$;

-- Empêcher les abonnements actifs multiples par user
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_subscriptions_user_active'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user_active
      ON subscriptions (owner_id)
      WHERE status IN ('active', 'trialing');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5.3 Trigger anti-doublon sur INSERT de propriétés
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_duplicate_property()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- Chercher un doublon exact (même owner + même adresse + même CP)
  SELECT id INTO v_existing_id
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND LOWER(TRIM(adresse_complete)) = LOWER(TRIM(NEW.adresse_complete))
    AND code_postal = NEW.code_postal
    AND deleted_at IS NULL
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Propriété en doublon détectée (id: %). Même adresse et code postal pour ce propriétaire.', v_existing_id
      USING HINT = 'Vérifiez si cette propriété existe déjà avant d''en créer une nouvelle.',
            ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_property ON properties;
CREATE TRIGGER trg_prevent_duplicate_property
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_property();

-- ----------------------------------------------------------------------------
-- 5.4 Trigger anti-doublon sur INSERT de paiements (même invoice + même montant + <24h)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_duplicate_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  SELECT id INTO v_existing_id
  FROM payments
  WHERE invoice_id = NEW.invoice_id
    AND montant = NEW.montant
    AND ABS(EXTRACT(EPOCH FROM (created_at - NOW()))) < 86400
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE WARNING 'Paiement potentiellement en doublon (id existant: %). Même montant + même facture en < 24h.', v_existing_id;
    -- On ne bloque pas, on avertit seulement (pour ne pas casser les paiements légitimes)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_payment ON payments;
CREATE TRIGGER trg_prevent_duplicate_payment
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_payment();


-- ============================================================================
-- LOGS
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  AUDIT V2 — Fusion, Prévention, Contraintes installés';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 3 — Détection avancée doublons :';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_properties();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_profiles();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_leases();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_documents();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_payments();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_edl();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_invoices();';
  RAISE NOTICE '    SELECT * FROM audit_all_duplicates_summary();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 4 — Fusion SAFE (DRY RUN par défaut) :';
  RAISE NOTICE '    SELECT * FROM merge_duplicate_properties(master, dup, true);';
  RAISE NOTICE '    SELECT * FROM merge_duplicate_invoices(master, dup, true);';
  RAISE NOTICE '    SELECT * FROM merge_duplicate_documents(master, dup, true);';
  RAISE NOTICE '    SELECT * FROM merge_duplicate_edl(master, dup, true);';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 5 — Contraintes de prévention installées :';
  RAISE NOTICE '    - 8 FK formelles ajoutées';
  RAISE NOTICE '    - 5 contraintes UNIQUE ajoutées';
  RAISE NOTICE '    - 2 triggers anti-doublon activés';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260212100000', 'audit_v2_merge_and_prevention')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260212100000_audit_v2_merge_and_prevention.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260213000000_fix_profiles_rls_recursion_v2.sql
-- Risk: MODERE
-- Why: +3 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260213000000_fix_profiles_rls_recursion_v2.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Correction définitive de la récursion RLS sur profiles (v2)
-- Date: 2026-02-13
-- Problème: "RLS recursion detected" - erreur 500 sur profiles
--
-- CAUSE: Les politiques RLS sur `profiles` appellent des fonctions
--        qui requêtent `profiles`, créant une boucle infinie (42P17).
--
-- SOLUTION:
--   1. Fonctions SECURITY DEFINER qui bypassen les RLS
--   2. Politiques RLS simplifiées utilisant auth.uid() directement
--   3. Pas de sous-requête vers profiles dans les politiques profiles
-- =====================================================

-- 1. DÉSACTIVER TEMPORAIREMENT RLS POUR LE NETTOYAGE
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER TOUTES LES ANCIENNES POLITIQUES SUR profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. CRÉER/REMPLACER LES FONCTIONS HELPER (SECURITY DEFINER = bypass RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1),
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

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

-- 4. RÉACTIVER RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. CRÉER LES NOUVELLES POLITIQUES (SANS RÉCURSION)

-- Politique principale : chaque utilisateur peut voir/modifier son propre profil
-- Utilise auth.uid() directement, aucune sous-requête vers profiles
CREATE POLICY "profiles_own_access" ON profiles
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Politique admin : les admins peuvent voir tous les profils
-- is_admin() est SECURITY DEFINER donc bypasse les RLS
CREATE POLICY "profiles_admin_read" ON profiles
FOR SELECT TO authenticated
USING (public.is_admin());

-- Politique propriétaire : peut voir les profils de ses locataires
-- get_my_profile_id() est SECURITY DEFINER donc bypasse les RLS
CREATE POLICY "profiles_owner_read_tenants" ON profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM lease_signers ls
    INNER JOIN leases l ON l.id = ls.lease_id
    INNER JOIN properties p ON p.id = l.property_id
    WHERE ls.profile_id = profiles.id
    AND p.owner_id = public.get_my_profile_id()
  )
);

-- 6. ACCORDER LES PERMISSIONS SUR LES FONCTIONS
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role(UUID) TO authenticated;

-- Permissions pour anon (nécessaire pour certaines requêtes pré-auth)
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_role() TO anon;

-- 7. S'assurer que RLS est activé (SANS FORCE pour que SECURITY DEFINER fonctionne)
-- IMPORTANT: Ne PAS utiliser FORCE ROW LEVEL SECURITY car cela forcerait
-- les politiques RLS même pour le propriétaire de la table (postgres),
-- ce qui casserait les fonctions SECURITY DEFINER et causerait la récursion.
-- Le service_role bypass RLS par défaut dans Supabase.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260213000000', 'fix_profiles_rls_recursion_v2')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260213000000_fix_profiles_rls_recursion_v2.sql'; END $post$;

COMMIT;

-- END OF BATCH 1/15 (Phase 2 MODERE)
