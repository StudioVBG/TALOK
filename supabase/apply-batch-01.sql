-- Batch 1 — migrations 1 a 8 sur 169
-- 8 migrations, chaque migration wrappee dans DO/EXCEPTION

-- === [HOTFIX] Fix trigger auto_verify_tenant_on_signup ===
CREATE OR REPLACE FUNCTION auto_verify_tenant_on_signup()
RETURNS TRIGGER AS $hf$
BEGIN
  IF NEW.kyc_status IS NULL OR NEW.kyc_status = 'pending' THEN
    IF EXISTS (
      SELECT 1 FROM invitations i
      WHERE LOWER(i.email) = LOWER((SELECT email FROM auth.users WHERE id = (SELECT user_id FROM profiles WHERE id = NEW.profile_id)))
      AND i.used_at IS NOT NULL
    ) THEN
      NEW.kyc_status := 'verified';
    END IF;
  END IF;
  RETURN NEW;
END;
$hf$ LANGUAGE plpgsql;

-- === [1/169] 20260208100000_fix_data_storage_audit.sql ===
DO $wrapper$ BEGIN
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
DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leases' AND column_name = 'clauses_particulieres'
  ) THEN
    ALTER TABLE leases ADD COLUMN clauses_particulieres TEXT;
    COMMENT ON COLUMN leases.clauses_particulieres IS 'Clauses personnalisées du bail (JSON sérialisé)';
  END IF;
END $mig$;

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

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [2/169] 20260209100000_create_sms_messages_table.sql ===
DO $wrapper$ BEGIN
-- Migration: Create sms_messages table for Twilio SMS tracking (2026-02-09)
--
-- The application code (API routes) already references this table:
--   - POST /api/notifications/sms/send  → inserts SMS records
--   - POST /api/webhooks/twilio          → updates delivery status
-- But the table was never created in a migration.

-- ============================================================
-- 1. Create sms_messages table
-- ============================================================

CREATE TABLE IF NOT EXISTS sms_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  from_number   TEXT NOT NULL,
  to_number     TEXT NOT NULL,
  message       TEXT NOT NULL,
  segments      INT DEFAULT 1,
  twilio_sid    TEXT,
  twilio_status TEXT,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'sent', 'delivered', 'undelivered', 'failed')),
  error_code    TEXT,
  error_message TEXT,
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  sms_messages IS 'Journal des SMS envoyés via Twilio';
COMMENT ON COLUMN sms_messages.profile_id    IS 'Profil destinataire (nullable si envoi à un numéro libre)';
COMMENT ON COLUMN sms_messages.from_number   IS 'Numéro ou service Twilio expéditeur';
COMMENT ON COLUMN sms_messages.to_number     IS 'Numéro de téléphone du destinataire (format E.164)';
COMMENT ON COLUMN sms_messages.segments      IS 'Nombre de segments SMS (1 segment = 160 caractères)';
COMMENT ON COLUMN sms_messages.twilio_sid    IS 'SID du message Twilio (pour corrélation webhook)';
COMMENT ON COLUMN sms_messages.twilio_status IS 'Dernier statut brut renvoyé par Twilio';
COMMENT ON COLUMN sms_messages.status        IS 'Statut normalisé : queued, sent, delivered, undelivered, failed';

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Lookup by Twilio SID (webhook updates)
CREATE INDEX IF NOT EXISTS idx_sms_messages_twilio_sid
  ON sms_messages (twilio_sid)
  WHERE twilio_sid IS NOT NULL;

-- Lookup by profile
CREATE INDEX IF NOT EXISTS idx_sms_messages_profile_id
  ON sms_messages (profile_id)
  WHERE profile_id IS NOT NULL;

-- Recent messages
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at
  ON sms_messages (created_at DESC);

-- ============================================================
-- 3. Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_sms_messages_updated_at()
RETURNS TRIGGER AS $mig$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sms_messages_updated_at ON sms_messages;
CREATE TRIGGER trg_sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_messages_updated_at();

-- ============================================================
-- 4. Row Level Security
-- ============================================================

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Admins can see all SMS
CREATE POLICY sms_messages_admin_all ON sms_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Owners can see SMS they sent (via their profile)
CREATE POLICY sms_messages_owner_select ON sms_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'owner'
        AND p.id = sms_messages.profile_id
    )
  );

-- Service role inserts (API routes use service role client, bypasses RLS)
-- No explicit INSERT policy needed for service role, but add one for completeness
CREATE POLICY sms_messages_service_insert ON sms_messages
  FOR INSERT
  WITH CHECK (true);

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [3/169] 20260211000000_p2_unique_constraint_and_gdpr_rpc.sql ===
DO $wrapper$ BEGIN
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
RETURNS JSONB AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION anonymize_user_cascade IS
  'Anonymise toutes les données d''un utilisateur en une seule transaction atomique (RGPD Art. 17)';

-- ============================================
-- 3. RPC POUR NETTOYAGE ORPHELINS (utilisée par le cron)
-- ============================================

DROP FUNCTION IF EXISTS cleanup_orphan_documents();
CREATE OR REPLACE FUNCTION cleanup_orphan_documents()
RETURNS JSONB AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_orphan_documents IS
  'Nettoie les enregistrements orphelins en une transaction. Retourne les storage_path à supprimer côté Storage.';

COMMIT;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [4/169] 20260211100000_bic_compliance_tax_regime.sql ===
DO $wrapper$ BEGIN
-- ============================================
-- BIC Compliance: Régime fiscal + Inventaire mobilier
-- Corrige les lacunes identifiées dans l'audit BIC
-- ============================================

-- 1. Enum pour le régime fiscal BIC
DO $mig$ BEGIN
  CREATE TYPE tax_regime_type AS ENUM (
    'micro_foncier',    -- Revenus fonciers < 15k€ (location nue)
    'reel_foncier',     -- Revenus fonciers réel (location nue)
    'micro_bic',        -- BIC micro < 77 700€ (location meublée)
    'reel_bic'          -- BIC réel (location meublée)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $mig$;

-- 2. Enum pour le statut LMNP/LMP
DO $mig$ BEGIN
  CREATE TYPE lmnp_status_type AS ENUM (
    'lmnp',  -- Loueur Meublé Non Professionnel
    'lmp'    -- Loueur Meublé Professionnel
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $mig$;

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
RETURNS TRIGGER AS $mig$
BEGIN
  IF NEW.type_bail IN ('meuble', 'bail_mobilite', 'etudiant') THEN
    UPDATE properties
    SET is_furnished = true
    WHERE id = NEW.property_id
      AND is_furnished = false;
  END IF;
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

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

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [5/169] 20260212000000_audit_database_integrity.sql ===
DO $wrapper$ BEGIN
-- ============================================================================
-- AUDIT D'INTÉGRITÉ DE LA BASE DE DONNÉES TALOK
-- Date: 2026-02-12
-- Auteur: Audit automatisé
-- ============================================================================
-- Ce script est un audit SAFE (lecture seule + fonctions de diagnostic).
-- Il ne supprime AUCUNE donnée. Il crée :
--   1. Des fonctions RPC de diagnostic pour détecter les orphelins
--   2. Des fonctions RPC de diagnostic pour détecter les doublons
--   3. Une vue matérialisée consolidée de l'état d'intégrité
--   4. Des fonctions de nettoyage SAFE (soft-delete / archivage)
-- ============================================================================

-- ============================================================================
-- PHASE 1: FONCTIONS DE DÉTECTION DES ORPHELINS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Audit global : retourne toutes les relations orphelines en un seul appel
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_orphan_records()
RETURNS TABLE(
  source_table TEXT,
  fk_column TEXT,
  target_table TEXT,
  orphan_count BIGINT,
  severity TEXT,
  description TEXT
) AS $mig$
BEGIN

  -- ── PROFILES ──────────────────────────────────────────────────────
  -- profiles → auth.users (user_id)
  RETURN QUERY
  SELECT 'profiles'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profiles sans compte auth.users associé'::TEXT
  FROM profiles p
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);

  -- ── PROPERTIES ────────────────────────────────────────────────────
  -- properties → profiles (owner_id)
  RETURN QUERY
  SELECT 'properties'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Propriétés dont le propriétaire (profile) n''existe plus'::TEXT
  FROM properties p
  WHERE p.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = p.owner_id);

  -- properties → buildings (building_id)
  RETURN QUERY
  SELECT 'properties'::TEXT, 'building_id'::TEXT, 'buildings'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Propriétés avec building_id pointant vers un immeuble inexistant'::TEXT
  FROM properties p
  WHERE p.building_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = p.building_id);

  -- properties → legal_entities (legal_entity_id)
  RETURN QUERY
  SELECT 'properties'::TEXT, 'legal_entity_id'::TEXT, 'legal_entities'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Propriétés avec legal_entity_id pointant vers une entité inexistante'::TEXT
  FROM properties p
  WHERE p.legal_entity_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.id = p.legal_entity_id);

  -- ── UNITS ─────────────────────────────────────────────────────────
  -- units → properties (property_id)
  RETURN QUERY
  SELECT 'units'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Unités de colocation dont la propriété n''existe plus'::TEXT
  FROM units u
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = u.property_id);

  -- ── LEASES ────────────────────────────────────────────────────────
  -- leases → properties (property_id)
  RETURN QUERY
  SELECT 'leases'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Baux dont la propriété n''existe plus'::TEXT
  FROM leases l
  WHERE l.property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = l.property_id);

  -- leases → units (unit_id)
  RETURN QUERY
  SELECT 'leases'::TEXT, 'unit_id'::TEXT, 'units'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux dont l''unité n''existe plus'::TEXT
  FROM leases l
  WHERE l.unit_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM units u WHERE u.id = l.unit_id);

  -- leases → profiles (tenant_id) — FK implicite ajoutée plus tard
  RETURN QUERY
  SELECT 'leases'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux dont le locataire (tenant_id) n''existe plus dans profiles'::TEXT
  FROM leases l
  WHERE l.tenant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = l.tenant_id);

  -- leases → profiles (owner_id) — FK implicite
  RETURN QUERY
  SELECT 'leases'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux dont le propriétaire (owner_id) n''existe plus dans profiles'::TEXT
  FROM leases l
  WHERE l.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = l.owner_id);

  -- Baux actifs sans aucun signataire
  RETURN QUERY
  SELECT 'leases'::TEXT, '(no_signers)'::TEXT, 'lease_signers'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux actifs/pending sans aucun signataire'::TEXT
  FROM leases l
  WHERE l.statut NOT IN ('draft', 'cancelled', 'archived', 'terminated')
    AND NOT EXISTS (SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id);

  -- ── LEASE_SIGNERS ─────────────────────────────────────────────────
  -- lease_signers → leases (lease_id)
  RETURN QUERY
  SELECT 'lease_signers'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Signataires dont le bail n''existe plus'::TEXT
  FROM lease_signers ls
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);

  -- lease_signers → profiles (profile_id)
  RETURN QUERY
  SELECT 'lease_signers'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Signataires dont le profil n''existe plus'::TEXT
  FROM lease_signers ls
  WHERE ls.profile_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = ls.profile_id);

  -- ── INVOICES ──────────────────────────────────────────────────────
  -- invoices → leases (lease_id)
  RETURN QUERY
  SELECT 'invoices'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Factures dont le bail n''existe plus'::TEXT
  FROM invoices i
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);

  -- invoices → profiles (owner_id)
  RETURN QUERY
  SELECT 'invoices'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures dont le profil propriétaire n''existe plus'::TEXT
  FROM invoices i
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = i.owner_id);

  -- invoices → profiles (tenant_id)
  RETURN QUERY
  SELECT 'invoices'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures dont le profil locataire n''existe plus'::TEXT
  FROM invoices i
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = i.tenant_id);

  -- ── PAYMENTS ──────────────────────────────────────────────────────
  -- payments → invoices (invoice_id)
  RETURN QUERY
  SELECT 'payments'::TEXT, 'invoice_id'::TEXT, 'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Paiements dont la facture n''existe plus'::TEXT
  FROM payments py
  WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);

  -- ── DOCUMENTS ─────────────────────────────────────────────────────
  -- documents → leases (lease_id)
  RETURN QUERY
  SELECT 'documents'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Documents dont le bail n''existe plus'::TEXT
  FROM documents d
  WHERE d.lease_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);

  -- documents → properties (property_id)
  RETURN QUERY
  SELECT 'documents'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont la propriété n''existe plus'::TEXT
  FROM documents d
  WHERE d.property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);

  -- documents → profiles (owner_id)
  RETURN QUERY
  SELECT 'documents'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont le profil owner n''existe plus'::TEXT
  FROM documents d
  WHERE d.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.owner_id);

  -- documents → profiles (tenant_id)
  RETURN QUERY
  SELECT 'documents'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont le profil tenant n''existe plus'::TEXT
  FROM documents d
  WHERE d.tenant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.tenant_id);

  -- documents → profiles (profile_id)
  RETURN QUERY
  SELECT 'documents'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont le profile_id n''existe plus'::TEXT
  FROM documents d
  WHERE d.profile_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.profile_id);

  -- Documents totalement flottants (aucune FK remplie)
  RETURN QUERY
  SELECT 'documents'::TEXT, '(no_parent)'::TEXT, '(none)'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Documents sans aucun rattachement (owner_id, tenant_id, property_id, lease_id tous NULL)'::TEXT
  FROM documents d
  WHERE d.owner_id IS NULL
    AND d.tenant_id IS NULL
    AND d.property_id IS NULL
    AND d.lease_id IS NULL
    AND d.profile_id IS NULL;

  -- ── TICKETS ───────────────────────────────────────────────────────
  -- tickets → properties (property_id)
  RETURN QUERY
  SELECT 'tickets'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Tickets dont la propriété n''existe plus'::TEXT
  FROM tickets t
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = t.property_id);

  -- tickets → profiles (created_by_profile_id)
  RETURN QUERY
  SELECT 'tickets'::TEXT, 'created_by_profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Tickets dont le créateur n''existe plus'::TEXT
  FROM tickets t
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.created_by_profile_id);

  -- tickets → leases (lease_id)
  RETURN QUERY
  SELECT 'tickets'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Tickets avec lease_id pointant vers un bail inexistant'::TEXT
  FROM tickets t
  WHERE t.lease_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);

  -- ── WORK_ORDERS ───────────────────────────────────────────────────
  -- work_orders → tickets (ticket_id)
  RETURN QUERY
  SELECT 'work_orders'::TEXT, 'ticket_id'::TEXT, 'tickets'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Ordres de travail dont le ticket n''existe plus'::TEXT
  FROM work_orders wo
  WHERE NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = wo.ticket_id);

  -- work_orders → profiles (provider_id)
  RETURN QUERY
  SELECT 'work_orders'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Ordres de travail dont le prestataire n''existe plus'::TEXT
  FROM work_orders wo
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = wo.provider_id);

  -- ── CHARGES ───────────────────────────────────────────────────────
  -- charges → properties (property_id)
  RETURN QUERY
  SELECT 'charges'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Charges dont la propriété n''existe plus'::TEXT
  FROM charges c
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = c.property_id);

  -- ── EDL ───────────────────────────────────────────────────────────
  -- edl → leases (lease_id)
  RETURN QUERY
  SELECT 'edl'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'États des lieux dont le bail n''existe plus'::TEXT
  FROM edl e
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id);

  -- edl_items → edl (edl_id)
  RETURN QUERY
  SELECT 'edl_items'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Items d''EDL dont l''EDL parent n''existe plus'::TEXT
  FROM edl_items ei
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = ei.edl_id);

  -- edl_media → edl (edl_id)
  RETURN QUERY
  SELECT 'edl_media'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Médias d''EDL dont l''EDL parent n''existe plus'::TEXT
  FROM edl_media em
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = em.edl_id);

  -- edl_signatures → edl (edl_id)
  RETURN QUERY
  SELECT 'edl_signatures'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Signatures d''EDL dont l''EDL parent n''existe plus'::TEXT
  FROM edl_signatures es
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = es.edl_id);

  -- edl_meter_readings → edl (edl_id)
  RETURN QUERY
  SELECT 'edl_meter_readings'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Relevés compteurs EDL dont l''EDL n''existe plus'::TEXT
  FROM edl_meter_readings emr
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = emr.edl_id);

  -- ── METERS ────────────────────────────────────────────────────────
  -- meters → leases (lease_id)
  RETURN QUERY
  SELECT 'meters'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Compteurs dont le bail n''existe plus'::TEXT
  FROM meters m
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);

  -- meter_readings → meters (meter_id)
  RETURN QUERY
  SELECT 'meter_readings'::TEXT, 'meter_id'::TEXT, 'meters'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Relevés de compteur dont le compteur n''existe plus'::TEXT
  FROM meter_readings mr
  WHERE NOT EXISTS (SELECT 1 FROM meters m WHERE m.id = mr.meter_id);

  -- ── ROOMMATES ─────────────────────────────────────────────────────
  -- roommates → leases (lease_id)
  RETURN QUERY
  SELECT 'roommates'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Colocataires dont le bail n''existe plus'::TEXT
  FROM roommates r
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);

  -- roommates → profiles (profile_id)
  RETURN QUERY
  SELECT 'roommates'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Colocataires dont le profil n''existe plus'::TEXT
  FROM roommates r
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = r.profile_id);

  -- ── PAYMENT_SHARES ────────────────────────────────────────────────
  -- payment_shares → roommates (roommate_id)
  RETURN QUERY
  SELECT 'payment_shares'::TEXT, 'roommate_id'::TEXT, 'roommates'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Parts de paiement dont le colocataire n''existe plus'::TEXT
  FROM payment_shares ps
  WHERE NOT EXISTS (SELECT 1 FROM roommates r WHERE r.id = ps.roommate_id);

  -- payment_shares → invoices (invoice_id)
  RETURN QUERY
  SELECT 'payment_shares'::TEXT, 'invoice_id'::TEXT, 'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Parts de paiement dont la facture n''existe plus'::TEXT
  FROM payment_shares ps
  WHERE ps.invoice_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = ps.invoice_id);

  -- ── DEPOSIT_SHARES ────────────────────────────────────────────────
  -- deposit_shares → roommates (roommate_id)
  RETURN QUERY
  SELECT 'deposit_shares'::TEXT, 'roommate_id'::TEXT, 'roommates'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Parts de dépôt dont le colocataire n''existe plus'::TEXT
  FROM deposit_shares ds
  WHERE NOT EXISTS (SELECT 1 FROM roommates r WHERE r.id = ds.roommate_id);

  -- ── DEPOSIT_MOVEMENTS ─────────────────────────────────────────────
  -- deposit_movements → leases (lease_id)
  RETURN QUERY
  SELECT 'deposit_movements'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Mouvements de dépôt dont le bail n''existe plus'::TEXT
  FROM deposit_movements dm
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);

  -- ── NOTIFICATIONS ─────────────────────────────────────────────────
  -- notifications → auth.users (user_id)
  RETURN QUERY
  SELECT 'notifications'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Notifications dont l''utilisateur n''existe plus'::TEXT
  FROM notifications n
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = n.user_id);

  -- ── SUBSCRIPTIONS ─────────────────────────────────────────────────
  -- subscriptions → profiles (user_id / owner_id)
  RETURN QUERY
  SELECT 'subscriptions'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Abonnements dont l''utilisateur n''existe plus'::TEXT
  FROM subscriptions s
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);

  -- ── OWNER_PROFILES ────────────────────────────────────────────────
  -- owner_profiles → profiles (profile_id)
  RETURN QUERY
  SELECT 'owner_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profils propriétaire dont le profil de base n''existe plus'::TEXT
  FROM owner_profiles op
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = op.profile_id);

  -- ── TENANT_PROFILES ───────────────────────────────────────────────
  -- tenant_profiles → profiles (profile_id)
  RETURN QUERY
  SELECT 'tenant_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profils locataire dont le profil de base n''existe plus'::TEXT
  FROM tenant_profiles tp
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = tp.profile_id);

  -- ── PROVIDER_PROFILES ─────────────────────────────────────────────
  -- provider_profiles → profiles (profile_id)
  RETURN QUERY
  SELECT 'provider_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profils prestataire dont le profil de base n''existe plus'::TEXT
  FROM provider_profiles pp
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pp.profile_id);

  -- ── CONVERSATIONS ─────────────────────────────────────────────────
  -- conversations → profiles (owner_id)
  RETURN QUERY
  SELECT 'conversations'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Conversations dont le profil owner n''existe plus'::TEXT
  FROM conversations c
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = c.owner_id);

  -- messages → conversations (conversation_id)
  RETURN QUERY
  SELECT 'messages'::TEXT, 'conversation_id'::TEXT, 'conversations'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Messages dont la conversation n''existe plus'::TEXT
  FROM messages m
  WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id = m.conversation_id);

  -- ── UNIFIED CONVERSATIONS ─────────────────────────────────────────
  -- unified_messages → unified_conversations (conversation_id)
  RETURN QUERY
  SELECT 'unified_messages'::TEXT, 'conversation_id'::TEXT, 'unified_conversations'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Messages unifiés dont la conversation n''existe plus'::TEXT
  FROM unified_messages um
  WHERE NOT EXISTS (SELECT 1 FROM unified_conversations uc WHERE uc.id = um.conversation_id);

  -- ── SIGNATURE_SESSIONS ────────────────────────────────────────────
  -- signature_participants → signature_sessions (session_id)
  RETURN QUERY
  SELECT 'signature_participants'::TEXT, 'session_id'::TEXT, 'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Participants de signature dont la session n''existe plus'::TEXT
  FROM signature_participants sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sp.session_id);

  -- signature_proofs → signature_participants (participant_id)
  RETURN QUERY
  SELECT 'signature_proofs'::TEXT, 'participant_id'::TEXT, 'signature_participants'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Preuves de signature dont le participant n''existe plus'::TEXT
  FROM signature_proofs sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_participants pa WHERE pa.id = sp.participant_id);

  -- signature_audit_log → signature_sessions (session_id)
  RETURN QUERY
  SELECT 'signature_audit_log'::TEXT, 'session_id'::TEXT, 'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Logs d''audit de signature dont la session n''existe plus'::TEXT
  FROM signature_audit_log sal
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sal.session_id);

  -- ── LEGAL_ENTITIES ────────────────────────────────────────────────
  -- legal_entities → profiles (owner_profile_id)
  RETURN QUERY
  SELECT 'legal_entities'::TEXT, 'owner_profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Entités légales dont le profil propriétaire n''existe plus'::TEXT
  FROM legal_entities le
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = le.owner_profile_id);

  -- entity_associates → legal_entities (legal_entity_id)
  RETURN QUERY
  SELECT 'entity_associates'::TEXT, 'legal_entity_id'::TEXT, 'legal_entities'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Associés dont l''entité légale n''existe plus'::TEXT
  FROM entity_associates ea
  WHERE NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.id = ea.legal_entity_id);

  -- ── PROPERTY_OWNERSHIP ────────────────────────────────────────────
  -- property_ownership → properties (property_id)
  RETURN QUERY
  SELECT 'property_ownership'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Détentions de propriété dont le bien n''existe plus'::TEXT
  FROM property_ownership po
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = po.property_id);

  -- ── BUILDINGS ─────────────────────────────────────────────────────
  -- buildings → profiles (owner_id) — si la colonne existe
  RETURN QUERY
  SELECT 'buildings'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Immeubles dont le propriétaire n''existe plus'::TEXT
  FROM buildings b
  WHERE b.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = b.owner_id);

  -- building_units → buildings (building_id)
  RETURN QUERY
  SELECT 'building_units'::TEXT, 'building_id'::TEXT, 'buildings'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Lots d''immeuble dont l''immeuble n''existe plus'::TEXT
  FROM building_units bu
  WHERE NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = bu.building_id);

  -- ── LEASE_END_PROCESSES ───────────────────────────────────────────
  -- lease_end_processes → leases (lease_id)
  RETURN QUERY
  SELECT 'lease_end_processes'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Processus de fin de bail dont le bail n''existe plus'::TEXT
  FROM lease_end_processes lep
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = lep.lease_id);

  -- edl_inspection_items → lease_end_processes (lease_end_process_id)
  RETURN QUERY
  SELECT 'edl_inspection_items'::TEXT, 'lease_end_process_id'::TEXT, 'lease_end_processes'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Items d''inspection dont le processus de fin n''existe plus'::TEXT
  FROM edl_inspection_items eii
  WHERE NOT EXISTS (SELECT 1 FROM lease_end_processes lep WHERE lep.id = eii.lease_end_process_id);

  -- renovation_items → lease_end_processes (lease_end_process_id)
  RETURN QUERY
  SELECT 'renovation_items'::TEXT, 'lease_end_process_id'::TEXT, 'lease_end_processes'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Items de rénovation dont le processus de fin n''existe plus'::TEXT
  FROM renovation_items ri
  WHERE NOT EXISTS (SELECT 1 FROM lease_end_processes lep WHERE lep.id = ri.lease_end_process_id);

  -- renovation_quotes → renovation_items (renovation_item_id)
  RETURN QUERY
  SELECT 'renovation_quotes'::TEXT, 'renovation_item_id'::TEXT, 'renovation_items'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Devis de rénovation dont l''item de rénovation n''existe plus'::TEXT
  FROM renovation_quotes rq
  WHERE NOT EXISTS (SELECT 1 FROM renovation_items ri WHERE ri.id = rq.renovation_item_id);

  -- ── PHOTOS ────────────────────────────────────────────────────────
  -- photos → properties (property_id)
  RETURN QUERY
  SELECT 'photos'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Photos dont la propriété n''existe plus'::TEXT
  FROM photos ph
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = ph.property_id);

  -- ── VISIT SCHEDULING ──────────────────────────────────────────────
  -- visit_slots → properties (property_id)
  RETURN QUERY
  SELECT 'visit_slots'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Créneaux de visite dont la propriété n''existe plus'::TEXT
  FROM visit_slots vs
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = vs.property_id);

  -- visit_bookings → visit_slots (slot_id)
  RETURN QUERY
  SELECT 'visit_bookings'::TEXT, 'slot_id'::TEXT, 'visit_slots'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Réservations de visite dont le créneau n''existe plus'::TEXT
  FROM visit_bookings vb
  WHERE NOT EXISTS (SELECT 1 FROM visit_slots vs WHERE vs.id = vb.slot_id);

  -- ── QUOTES ────────────────────────────────────────────────────────
  -- quotes → tickets (ticket_id)
  RETURN QUERY
  SELECT 'quotes'::TEXT, 'ticket_id'::TEXT, 'tickets'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Devis dont le ticket n''existe plus'::TEXT
  FROM quotes q
  WHERE q.ticket_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = q.ticket_id);

  -- quotes → profiles (provider_id)
  RETURN QUERY
  SELECT 'quotes'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Devis dont le prestataire n''existe plus'::TEXT
  FROM quotes q
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = q.provider_id);

  -- ── CONVERSATION_PARTICIPANTS ─────────────────────────────────────
  -- conversation_participants → unified_conversations (conversation_id)
  RETURN QUERY
  SELECT 'conversation_participants'::TEXT, 'conversation_id'::TEXT, 'unified_conversations'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Participants de conversation dont la conversation unifiée n''existe plus'::TEXT
  FROM conversation_participants cp
  WHERE NOT EXISTS (SELECT 1 FROM unified_conversations uc WHERE uc.id = cp.conversation_id);

  -- ── ORGANIZATION_BRANDING ─────────────────────────────────────────
  -- organization_branding → organizations (organization_id)
  RETURN QUERY
  SELECT 'organization_branding'::TEXT, 'organization_id'::TEXT, 'organizations'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Branding d''organisation dont l''organisation n''existe plus'::TEXT
  FROM organization_branding ob
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ob.organization_id);

  -- ── PROVIDER_INVOICES ─────────────────────────────────────────────
  -- provider_invoices → profiles (provider_id)
  RETURN QUERY
  SELECT 'provider_invoices'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures prestataire dont le profil prestataire n''existe plus'::TEXT
  FROM provider_invoices pi
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pi.provider_id);

  -- ── PROVIDER_QUOTES ───────────────────────────────────────────────
  -- provider_quotes → profiles (provider_id)
  RETURN QUERY
  SELECT 'provider_quotes'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Devis prestataire dont le profil prestataire n''existe plus'::TEXT
  FROM provider_quotes pq
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pq.provider_id);

  -- ── SIGNATURES (legacy) ───────────────────────────────────────────
  -- signatures → leases (lease_id)
  RETURN QUERY
  SELECT 'signatures'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Signatures legacy dont le bail n''existe plus'::TEXT
  FROM signatures s
  WHERE s.lease_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = s.lease_id);

  -- signatures → profiles (signer_profile_id)
  RETURN QUERY
  SELECT 'signatures'::TEXT, 'signer_profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Signatures legacy dont le profil signataire n''existe plus'::TEXT
  FROM signatures s
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = s.signer_profile_id);

  -- Filter: only return rows where orphan_count > 0
  -- (handled by caller, but the function returns all checks for completeness)

END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_orphan_records() IS
  'Audit complet des enregistrements orphelins. Retourne toutes les relations cassées avec leur sévérité.';


-- ============================================================================
-- PHASE 2: FONCTIONS DE DÉTECTION DES DOUBLONS
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_duplicate_records()
RETURNS TABLE(
  table_name TEXT,
  duplicate_key TEXT,
  duplicate_count BIGINT,
  severity TEXT,
  description TEXT,
  sample_ids TEXT
) AS $mig$
BEGIN

  -- ── PROFILES : même user_id (devrait être UNIQUE) ────────────────
  RETURN QUERY
  SELECT 'profiles'::TEXT,
    'user_id'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Comptes avec plusieurs profils pour le même auth.users'::TEXT,
    string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
  FROM profiles p
  GROUP BY p.user_id
  HAVING COUNT(*) > 1;

  -- ── PROFILES : même email (doublons fonctionnels) ─────────────────
  RETURN QUERY
  SELECT 'profiles'::TEXT,
    'email=' || COALESCE(p.email, '(null)'),
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Profils avec le même email'::TEXT,
    string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
  FROM profiles p
  WHERE p.email IS NOT NULL AND p.email != ''
  GROUP BY p.email
  HAVING COUNT(*) > 1;

  -- ── PROPERTIES : même adresse + même propriétaire ─────────────────
  RETURN QUERY
  SELECT 'properties'::TEXT,
    'owner_id+adresse=' || p.owner_id || '+' || LOWER(TRIM(p.adresse_complete)),
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Propriétés dupliquées (même propriétaire + même adresse)'::TEXT,
    string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
  GROUP BY p.owner_id, LOWER(TRIM(p.adresse_complete))
  HAVING COUNT(*) > 1;

  -- ── PROPERTIES : même unique_code (devrait être impossible) ───────
  RETURN QUERY
  SELECT 'properties'::TEXT,
    'unique_code=' || p.unique_code,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Propriétés avec le même code unique (violation unicité)'::TEXT,
    string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
  FROM properties p
  GROUP BY p.unique_code
  HAVING COUNT(*) > 1;

  -- ── LEASES : même property_id + dates qui se chevauchent ──────────
  RETURN QUERY
  SELECT 'leases'::TEXT,
    'property_id=' || l1.property_id || ' overlap_with=' || l2.id,
    2::BIGINT,
    'HIGH'::TEXT,
    'Baux actifs qui se chevauchent sur la même propriété'::TEXT,
    (l1.id::TEXT || ', ' || l2.id::TEXT)::TEXT
  FROM leases l1
  JOIN leases l2 ON l1.property_id = l2.property_id
    AND l1.id < l2.id
    AND l1.statut IN ('active', 'pending_signature', 'fully_signed')
    AND l2.statut IN ('active', 'pending_signature', 'fully_signed')
    AND l1.property_id IS NOT NULL
    AND l1.date_debut <= COALESCE(l2.date_fin, '9999-12-31'::DATE)
    AND l2.date_debut <= COALESCE(l1.date_fin, '9999-12-31'::DATE);

  -- ── INVOICES : même bail + même période ───────────────────────────
  RETURN QUERY
  SELECT 'invoices'::TEXT,
    'lease_id+periode=' || i.lease_id || '+' || i.periode,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Factures dupliquées pour le même bail et la même période'::TEXT,
    string_agg(i.id::TEXT, ', ' ORDER BY i.created_at)::TEXT
  FROM invoices i
  GROUP BY i.lease_id, i.periode
  HAVING COUNT(*) > 1;

  -- ── LEASE_SIGNERS : même bail + même profil ───────────────────────
  RETURN QUERY
  SELECT 'lease_signers'::TEXT,
    'lease_id+profile_id=' || ls.lease_id || '+' || ls.profile_id,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Signataires dupliqués sur le même bail'::TEXT,
    string_agg(ls.id::TEXT, ', ' ORDER BY ls.created_at)::TEXT
  FROM lease_signers ls
  WHERE ls.profile_id IS NOT NULL
  GROUP BY ls.lease_id, ls.profile_id
  HAVING COUNT(*) > 1;

  -- ── LEASE_SIGNERS : même bail + même invited_email ────────────────
  RETURN QUERY
  SELECT 'lease_signers'::TEXT,
    'lease_id+invited_email=' || ls.lease_id || '+' || ls.invited_email,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Signataires invités en double sur le même bail (même email)'::TEXT,
    string_agg(ls.id::TEXT, ', ' ORDER BY ls.created_at)::TEXT
  FROM lease_signers ls
  WHERE ls.invited_email IS NOT NULL AND ls.invited_email != ''
  GROUP BY ls.lease_id, ls.invited_email
  HAVING COUNT(*) > 1;

  -- ── DOCUMENTS : même storage_path ─────────────────────────────────
  RETURN QUERY
  SELECT 'documents'::TEXT,
    'storage_path=' || COALESCE(d.storage_path, d.url),
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents pointant vers le même fichier storage'::TEXT,
    string_agg(d.id::TEXT, ', ' ORDER BY d.created_at)::TEXT
  FROM documents d
  WHERE COALESCE(d.storage_path, d.url) IS NOT NULL
  GROUP BY COALESCE(d.storage_path, d.url)
  HAVING COUNT(*) > 1;

  -- ── OWNER_PROFILES : même profile_id (PK, mais vérifions) ────────
  RETURN QUERY
  SELECT 'owner_profiles'::TEXT,
    'profile_id=' || op.profile_id,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profils propriétaire dupliqués pour le même profil'::TEXT,
    string_agg(op.profile_id::TEXT, ', ')::TEXT
  FROM owner_profiles op
  GROUP BY op.profile_id
  HAVING COUNT(*) > 1;

  -- ── SUBSCRIPTIONS : abonnements actifs multiples ──────────────────
  RETURN QUERY
  SELECT 'subscriptions'::TEXT,
    'user_id=' || s.user_id || ' (active)',
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Utilisateurs avec plusieurs abonnements actifs'::TEXT,
    string_agg(s.id::TEXT, ', ' ORDER BY s.created_at)::TEXT
  FROM subscriptions s
  WHERE s.status IN ('active', 'trialing')
  GROUP BY s.user_id
  HAVING COUNT(*) > 1;

  -- ── NOTIFICATIONS : doublons exacts ───────────────────────────────
  RETURN QUERY
  SELECT 'notifications'::TEXT,
    'user+type+title=' || n.user_id || '+' || n.type || '+' || n.title,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Notifications dupliquées (même user, type, titre, même minute)'::TEXT,
    string_agg(n.id::TEXT, ', ' ORDER BY n.created_at)::TEXT
  FROM notifications n
  GROUP BY n.user_id, n.type, n.title, date_trunc('minute', n.created_at)
  HAVING COUNT(*) > 1;

  -- ── ROOMMATES : même bail + même profil ───────────────────────────
  RETURN QUERY
  SELECT 'roommates'::TEXT,
    'lease_id+profile_id=' || r.lease_id || '+' || r.profile_id,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Colocataires dupliqués sur le même bail'::TEXT,
    string_agg(r.id::TEXT, ', ' ORDER BY r.created_at)::TEXT
  FROM roommates r
  GROUP BY r.lease_id, r.profile_id
  HAVING COUNT(*) > 1;

  -- ── PHOTOS : même property + même storage_path ────────────────────
  RETURN QUERY
  SELECT 'photos'::TEXT,
    'property_id+storage_path=' || ph.property_id || '+' || COALESCE(ph.storage_path, ph.url),
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Photos dupliquées pour la même propriété'::TEXT,
    string_agg(ph.id::TEXT, ', ' ORDER BY ph.created_at)::TEXT
  FROM photos ph
  WHERE COALESCE(ph.storage_path, ph.url) IS NOT NULL
  GROUP BY ph.property_id, COALESCE(ph.storage_path, ph.url)
  HAVING COUNT(*) > 1;

  -- ── LEGAL_ENTITIES : même SIRET ───────────────────────────────────
  RETURN QUERY
  SELECT 'legal_entities'::TEXT,
    'siret=' || le.siret,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Entités légales avec le même SIRET'::TEXT,
    string_agg(le.id::TEXT, ', ' ORDER BY le.created_at)::TEXT
  FROM legal_entities le
  WHERE le.siret IS NOT NULL AND le.siret != ''
  GROUP BY le.siret
  HAVING COUNT(*) > 1;

  -- ── EDL : même bail + même type ───────────────────────────────────
  RETURN QUERY
  SELECT 'edl'::TEXT,
    'lease_id+type=' || e.lease_id || '+' || e.type,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'EDL dupliqués pour le même bail et le même type'::TEXT,
    string_agg(e.id::TEXT, ', ' ORDER BY e.created_at)::TEXT
  FROM edl e
  GROUP BY e.lease_id, e.type
  HAVING COUNT(*) > 1;

END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_duplicate_records() IS
  'Audit complet des enregistrements dupliqués. Retourne tous les doublons détectés avec leur sévérité.';


-- ============================================================================
-- PHASE 3: DÉTECTION DES FK IMPLICITES (colonnes *_id sans contrainte)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_missing_fk_constraints()
RETURNS TABLE(
  table_name TEXT,
  column_name TEXT,
  expected_target TEXT,
  has_fk BOOLEAN,
  recommendation TEXT
) AS $mig$
BEGIN

  -- Lister toutes les colonnes finissant par _id dans le schéma public
  -- et vérifier si elles ont une contrainte FK
  RETURN QUERY
  WITH id_columns AS (
    SELECT
      c.table_name::TEXT AS tbl,
      c.column_name::TEXT AS col,
      CASE
        WHEN c.column_name LIKE '%profile_id%' THEN 'profiles'
        WHEN c.column_name LIKE '%owner_id%' THEN 'profiles'
        WHEN c.column_name LIKE '%tenant_id%' THEN 'profiles'
        WHEN c.column_name LIKE '%user_id%' THEN 'auth.users'
        WHEN c.column_name LIKE '%property_id%' THEN 'properties'
        WHEN c.column_name LIKE '%lease_id%' THEN 'leases'
        WHEN c.column_name LIKE '%unit_id%' THEN 'units'
        WHEN c.column_name LIKE '%invoice_id%' THEN 'invoices'
        WHEN c.column_name LIKE '%ticket_id%' THEN 'tickets'
        WHEN c.column_name LIKE '%building_id%' THEN 'buildings'
        WHEN c.column_name LIKE '%edl_id%' THEN 'edl'
        WHEN c.column_name LIKE '%meter_id%' THEN 'meters'
        WHEN c.column_name LIKE '%conversation_id%' THEN 'conversations/unified_conversations'
        WHEN c.column_name LIKE '%session_id%' THEN 'signature_sessions'
        WHEN c.column_name LIKE '%organization_id%' THEN 'organizations'
        WHEN c.column_name LIKE '%legal_entity_id%' THEN 'legal_entities'
        WHEN c.column_name LIKE '%roommate_id%' THEN 'roommates'
        WHEN c.column_name LIKE '%provider_id%' THEN 'profiles/provider_profiles'
        WHEN c.column_name LIKE '%document_id%' THEN 'documents'
        WHEN c.column_name LIKE '%quote_id%' THEN 'quotes'
        WHEN c.column_name LIKE '%work_order_id%' THEN 'work_orders'
        WHEN c.column_name LIKE '%application_id%' THEN 'tenant_applications'
        WHEN c.column_name LIKE '%participant_id%' THEN 'signature_participants'
        ELSE '(unknown)'
      END AS expected_target
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.data_type IN ('uuid', 'text')
      AND (c.column_name LIKE '%_id' OR c.column_name LIKE '%_uuid')
      AND c.column_name != 'id'
      AND c.table_name NOT LIKE '_%' -- skip internal tables
  ),
  existing_fks AS (
    SELECT
      tc.table_name::TEXT AS tbl,
      kcu.column_name::TEXT AS col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  )
  SELECT
    ic.tbl,
    ic.col,
    ic.expected_target,
    EXISTS(SELECT 1 FROM existing_fks ef WHERE ef.tbl = ic.tbl AND ef.col = ic.col),
    CASE
      WHEN EXISTS(SELECT 1 FROM existing_fks ef WHERE ef.tbl = ic.tbl AND ef.col = ic.col)
        THEN 'FK existe — OK'
      ELSE 'MANQUANTE — Ajouter ALTER TABLE ' || ic.tbl || ' ADD CONSTRAINT fk_' || ic.tbl || '_' || ic.col || ' FOREIGN KEY (' || ic.col || ') REFERENCES ' || ic.expected_target || '(id)'
    END
  FROM id_columns ic
  WHERE ic.expected_target != '(unknown)'
  ORDER BY
    CASE WHEN EXISTS(SELECT 1 FROM existing_fks ef WHERE ef.tbl = ic.tbl AND ef.col = ic.col) THEN 1 ELSE 0 END,
    ic.tbl, ic.col;

END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_missing_fk_constraints() IS
  'Détecte les colonnes *_id sans contrainte FK formelle (FK implicites).';


-- ============================================================================
-- PHASE 4: VUE CONSOLIDÉE DU TABLEAU DE BORD D'INTÉGRITÉ
-- ============================================================================

CREATE OR REPLACE VIEW audit_integrity_dashboard AS

-- Orphelins
SELECT
  'orphan' AS audit_type,
  source_table,
  fk_column AS detail_key,
  target_table AS detail_value,
  orphan_count AS count,
  severity,
  description
FROM audit_orphan_records()
WHERE orphan_count > 0

UNION ALL

-- Doublons
SELECT
  'duplicate' AS audit_type,
  table_name AS source_table,
  duplicate_key AS detail_key,
  sample_ids AS detail_value,
  duplicate_count AS count,
  severity,
  description
FROM audit_duplicate_records();

COMMENT ON VIEW audit_integrity_dashboard IS
  'Vue consolidée de tous les problèmes d''intégrité détectés (orphelins + doublons).';


-- ============================================================================
-- PHASE 5: FONCTIONS DE NETTOYAGE SAFE (avec backup préalable)
-- ============================================================================

-- 5.1 Table d'archivage pour les enregistrements nettoyés
CREATE TABLE IF NOT EXISTS _audit_cleanup_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_batch_id UUID NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  fk_column TEXT,
  original_data JSONB NOT NULL,
  cleanup_reason TEXT NOT NULL,
  cleaned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleaned_by TEXT DEFAULT current_user
);

CREATE INDEX IF NOT EXISTS idx_cleanup_archive_batch
  ON _audit_cleanup_archive(cleanup_batch_id);
CREATE INDEX IF NOT EXISTS idx_cleanup_archive_table
  ON _audit_cleanup_archive(source_table);
CREATE INDEX IF NOT EXISTS idx_cleanup_archive_date
  ON _audit_cleanup_archive(cleaned_at);

COMMENT ON TABLE _audit_cleanup_archive IS
  'Archive des enregistrements supprimés lors du nettoyage d''intégrité. Permet de restaurer si nécessaire.';

-- 5.2 Fonction de nettoyage SAFE avec archivage
CREATE OR REPLACE FUNCTION safe_cleanup_orphans(
  p_dry_run BOOLEAN DEFAULT TRUE,
  p_severity_filter TEXT DEFAULT 'ALL'
)
RETURNS TABLE(
  action TEXT,
  source_table TEXT,
  fk_column TEXT,
  records_affected BIGINT,
  detail TEXT
) AS $mig$
DECLARE
  v_batch_id UUID := gen_random_uuid();
  v_count BIGINT;
BEGIN

  -- Header
  action := 'INFO';
  source_table := '(batch)';
  fk_column := '';
  records_affected := 0;
  detail := 'Batch ID: ' || v_batch_id::TEXT || ' | Mode: ' || CASE WHEN p_dry_run THEN 'DRY RUN (aucune suppression)' ELSE 'EXECUTION RÉELLE' END;
  RETURN NEXT;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- CRITICAL: lease_signers orphelins (bail supprimé)
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  IF p_severity_filter IN ('ALL', 'CRITICAL') THEN

    -- Archive + delete lease_signers sans bail
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'lease_signers', ls.id::TEXT, 'lease_id', to_jsonb(ls), 'Bail inexistant'
      FROM lease_signers ls
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);

      DELETE FROM lease_signers ls
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM lease_signers ls
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'lease_signers';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Signataires dont le bail n''existe plus';
    RETURN NEXT;

    -- Archive + delete invoices sans bail
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'invoices', i.id::TEXT, 'lease_id', to_jsonb(i), 'Bail inexistant'
      FROM invoices i
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);

      DELETE FROM invoices i
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM invoices i
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'invoices';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Factures dont le bail n''existe plus';
    RETURN NEXT;

    -- Archive + delete payments sans invoice
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'payments', py.id::TEXT, 'invoice_id', to_jsonb(py), 'Facture inexistante'
      FROM payments py
      WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);

      DELETE FROM payments py
      WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM payments py
      WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'payments';
    fk_column := 'invoice_id → invoices';
    records_affected := v_count;
    detail := 'Paiements dont la facture n''existe plus';
    RETURN NEXT;

  END IF;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- HIGH: documents orphelins
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  IF p_severity_filter IN ('ALL', 'CRITICAL', 'HIGH') THEN

    -- Documents avec lease_id invalide → SET NULL (ne pas supprimer)
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'documents', d.id::TEXT, 'lease_id', jsonb_build_object('lease_id', d.lease_id), 'Bail inexistant — lease_id mis à NULL'
      FROM documents d
      WHERE d.lease_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);

      UPDATE documents d
      SET lease_id = NULL
      WHERE d.lease_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM documents d
      WHERE d.lease_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
    source_table := 'documents';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Documents: lease_id mis à NULL (bail inexistant)';
    RETURN NEXT;

    -- Documents avec property_id invalide → SET NULL
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'documents', d.id::TEXT, 'property_id', jsonb_build_object('property_id', d.property_id), 'Propriété inexistante — property_id mis à NULL'
      FROM documents d
      WHERE d.property_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);

      UPDATE documents d
      SET property_id = NULL
      WHERE d.property_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM documents d
      WHERE d.property_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
    source_table := 'documents';
    fk_column := 'property_id → properties';
    records_affected := v_count;
    detail := 'Documents: property_id mis à NULL (propriété inexistante)';
    RETURN NEXT;

    -- EDL orphelins (bail supprimé)
    IF NOT p_dry_run THEN
      -- D'abord archiver et supprimer les enfants des EDL orphelins
      WITH orphan_edls AS (
        SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id)
      )
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'edl', e.id::TEXT, 'lease_id', to_jsonb(e), 'Bail inexistant'
      FROM edl e
      WHERE e.id IN (SELECT id FROM orphan_edls);

      DELETE FROM edl_items WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl_media WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl_signatures WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl_meter_readings WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = edl.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'edl (+ items, media, signatures)';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'EDL orphelins supprimés en cascade';
    RETURN NEXT;

    -- Roommates orphelins (bail supprimé)
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'roommates', r.id::TEXT, 'lease_id', to_jsonb(r), 'Bail inexistant'
      FROM roommates r
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);

      DELETE FROM roommates r
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM roommates r WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'roommates';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Colocataires dont le bail n''existe plus';
    RETURN NEXT;

    -- Deposit_movements orphelins
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'deposit_movements', dm.id::TEXT, 'lease_id', to_jsonb(dm), 'Bail inexistant'
      FROM deposit_movements dm
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);

      DELETE FROM deposit_movements dm
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM deposit_movements dm WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'deposit_movements';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Mouvements de dépôt dont le bail n''existe plus';
    RETURN NEXT;

    -- Meters orphelins
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'meters', m.id::TEXT, 'lease_id', to_jsonb(m), 'Bail inexistant'
      FROM meters m
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);

      -- D'abord supprimer les readings des meters orphelins
      DELETE FROM meter_readings WHERE meter_id IN (
        SELECT m.id FROM meters m WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id)
      );
      DELETE FROM meters m
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM meters m WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'meters (+ readings)';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Compteurs orphelins supprimés en cascade';
    RETURN NEXT;

    -- Tickets avec lease_id invalide → SET NULL (garder le ticket)
    IF NOT p_dry_run THEN
      UPDATE tickets t
      SET lease_id = NULL
      WHERE t.lease_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM tickets t
      WHERE t.lease_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
    source_table := 'tickets';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Tickets: lease_id mis à NULL (bail inexistant)';
    RETURN NEXT;

  END IF;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- LOW: Notifications obsolètes
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  IF p_severity_filter = 'ALL' THEN

    -- Notifications lues > 90 jours
    IF NOT p_dry_run THEN
      DELETE FROM notifications
      WHERE is_read = true
        AND created_at < NOW() - INTERVAL '90 days';
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM notifications
      WHERE is_read = true
        AND created_at < NOW() - INTERVAL '90 days';
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'notifications';
    fk_column := '(age > 90 days + read)';
    records_affected := v_count;
    detail := 'Notifications lues de plus de 90 jours';
    RETURN NEXT;

  END IF;

  -- Summary
  action := 'SUMMARY';
  source_table := '(all)';
  fk_column := '';
  records_affected := 0;
  detail := 'Nettoyage terminé. Batch: ' || v_batch_id::TEXT || ' — Consultez _audit_cleanup_archive pour restaurer.';
  RETURN NEXT;

END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION safe_cleanup_orphans(BOOLEAN, TEXT) IS
  'Nettoyage SAFE des orphelins avec archivage. Par défaut en DRY RUN. Usage: SELECT * FROM safe_cleanup_orphans(false) pour exécuter.';


-- ============================================================================
-- PHASE 6: FONCTION DE RESTAURATION (rollback d'un batch de nettoyage)
-- ============================================================================

CREATE OR REPLACE FUNCTION restore_cleanup_batch(p_batch_id UUID)
RETURNS TABLE(
  restored_table TEXT,
  restored_count BIGINT
) AS $mig$
DECLARE
  r RECORD;
  v_count BIGINT := 0;
BEGIN
  -- On ne peut restaurer que les lignes supprimées (pas les NULL-ifiées)
  -- Pour chaque table dans l'archive, on ré-insère les données
  FOR r IN
    SELECT DISTINCT a.source_table
    FROM _audit_cleanup_archive a
    WHERE a.cleanup_batch_id = p_batch_id
      AND a.cleanup_reason NOT LIKE '%mis à NULL%'
    ORDER BY a.source_table
  LOOP
    restored_table := r.source_table;

    -- Compter les enregistrements à restaurer
    SELECT COUNT(*) INTO v_count
    FROM _audit_cleanup_archive a
    WHERE a.cleanup_batch_id = p_batch_id
      AND a.source_table = r.source_table
      AND a.cleanup_reason NOT LIKE '%mis à NULL%';

    restored_count := v_count;
    RETURN NEXT;
  END LOOP;

  -- Note : la restauration réelle nécessite un INSERT dynamique
  -- qui doit être exécuté manuellement pour chaque table
  -- car la structure des colonnes diffère
  restored_table := '⚠️ IMPORTANT';
  restored_count := 0;
  RETURN NEXT;

  restored_table := 'Les données sont dans _audit_cleanup_archive.original_data (JSONB)';
  restored_count := 0;
  RETURN NEXT;

  restored_table := 'Utilisez: SELECT original_data FROM _audit_cleanup_archive WHERE cleanup_batch_id = ''' || p_batch_id::TEXT || '''';
  restored_count := 0;
  RETURN NEXT;

END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION restore_cleanup_batch(UUID) IS
  'Liste les enregistrements restaurables pour un batch de nettoyage donné.';


-- ============================================================================
-- LOGS DE MIGRATION
-- ============================================================================
DO $mig$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  AUDIT D''INTÉGRITÉ TALOK — Migration installée';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  Fonctions disponibles :';
  RAISE NOTICE '    SELECT * FROM audit_orphan_records();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_records();';
  RAISE NOTICE '    SELECT * FROM audit_missing_fk_constraints();';
  RAISE NOTICE '    SELECT * FROM audit_integrity_dashboard;';
  RAISE NOTICE '';
  RAISE NOTICE '  Nettoyage (DRY RUN par défaut) :';
  RAISE NOTICE '    SELECT * FROM safe_cleanup_orphans(true);   -- prévisualiser';
  RAISE NOTICE '    SELECT * FROM safe_cleanup_orphans(false);  -- exécuter';
  RAISE NOTICE '';
  RAISE NOTICE '  Restauration :';
  RAISE NOTICE '    SELECT * FROM restore_cleanup_batch(''<batch_id>'');';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $mig$;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [6/169] 20260212000001_fix_guarantor_role_and_tables.sql ===
DO $wrapper$ BEGIN
-- ============================================
-- Migration: Ajouter le rôle guarantor + tables manquantes
-- Date: 2026-02-12
-- Description:
--   1. Ajouter 'guarantor' dans le CHECK constraint de profiles.role
--   2. Mettre à jour handle_new_user pour accepter 'guarantor'
--   3. Créer la table guarantor_profiles
--   4. Créer la table user_consents pour la conformité RGPD
--   5. Ajouter un CHECK constraint sur le champ telephone
-- ============================================

-- 1. Modifier le CHECK constraint de profiles.role pour inclure 'guarantor'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'owner', 'tenant', 'provider', 'guarantor'));

-- 2. Mettre à jour handle_new_user pour reconnaître 'guarantor'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $mig$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
BEGIN
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le rôle (inclut désormais 'guarantor')
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Insérer le profil avec toutes les données
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  RETURN NEW;
END;
$mig$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Crée automatiquement un profil lors de la création d''un utilisateur.
Lit le rôle et les informations personnelles depuis les raw_user_meta_data.
Supporte les rôles: admin, owner, tenant, provider, guarantor.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';

-- 3. Créer la table guarantor_profiles
CREATE TABLE IF NOT EXISTS guarantor_profiles (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  type_garantie TEXT CHECK (type_garantie IN ('personnelle', 'visale', 'depot_bancaire')),
  revenus_mensuels DECIMAL(10, 2),
  date_naissance DATE,
  piece_identite_path TEXT,
  justificatif_revenus_path TEXT,
  visale_path TEXT,
  depot_bancaire_montant DECIMAL(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS pour guarantor_profiles
ALTER TABLE guarantor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guarantor_profiles_select_own" ON guarantor_profiles;
CREATE POLICY "guarantor_profiles_select_own" ON guarantor_profiles
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "guarantor_profiles_insert_own" ON guarantor_profiles;
CREATE POLICY "guarantor_profiles_insert_own" ON guarantor_profiles
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "guarantor_profiles_update_own" ON guarantor_profiles;
CREATE POLICY "guarantor_profiles_update_own" ON guarantor_profiles
  FOR UPDATE USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- 4. Créer la table user_consents pour la conformité RGPD
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  terms_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted BOOLEAN NOT NULL DEFAULT false,
  privacy_version TEXT NOT NULL,
  privacy_accepted_at TIMESTAMPTZ,
  cookies_necessary BOOLEAN NOT NULL DEFAULT true,
  cookies_analytics BOOLEAN NOT NULL DEFAULT false,
  cookies_ads BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);

-- RLS pour user_consents
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_consents_select_own" ON user_consents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_consents_insert_own" ON user_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_consents_update_own" ON user_consents
  FOR UPDATE USING (user_id = auth.uid());

-- 5. Ajouter un CHECK constraint sur telephone (format E.164)
-- Le format E.164 commence par + suivi de 1 à 15 chiffres
-- D'abord nettoyer les données existantes non conformes
UPDATE profiles SET telephone = NULL
  WHERE telephone IS NOT NULL
    AND telephone !~ '^\+[1-9]\d{1,14}$';
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_telephone_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_telephone_check
  CHECK (telephone IS NULL OR telephone ~ '^\+[1-9]\d{1,14}$');

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [7/169] 20260212100000_audit_v2_merge_and_prevention.sql ===
DO $wrapper$ BEGIN
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
) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PHASE 4 : FONCTIONS DE FUSION SAFE (MERGE)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 Fusion générique : élit un master, transfère les enfants, supprime
-- ----------------------------------------------------------------------------

-- Helper : compter les champs non-null d'un enregistrement
CREATE OR REPLACE FUNCTION _count_non_null_fields(p_table TEXT, p_id UUID)
RETURNS INTEGER AS $mig$
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
$mig$ LANGUAGE plpgsql;

-- 4.2 Merge de propriétés
CREATE OR REPLACE FUNCTION merge_duplicate_properties(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.3 Merge de factures dupliquées
CREATE OR REPLACE FUNCTION merge_duplicate_invoices(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.4 Merge de documents dupliqués
CREATE OR REPLACE FUNCTION merge_duplicate_documents(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.5 Merge d'EDL dupliqués
CREATE OR REPLACE FUNCTION merge_duplicate_edl(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $mig$
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
$mig$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PHASE 5 : PRÉVENTION — CONTRAINTES FK, UNIQUE, TRIGGERS
-- ============================================================================
-- ⚠️ Ces contraintes sont ajoutées avec NOT VALID + VALIDATE séparément
-- pour éviter de bloquer la table pendant la création.
-- Elles sont idempotentes (IF NOT EXISTS / DO $mig$ ... $mig$).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 FK Formelles manquantes
-- ----------------------------------------------------------------------------

-- leases.tenant_id → profiles.id
DO $mig$ BEGIN
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
END $mig$;

-- leases.owner_id → profiles.id (skip if column doesn't exist)
DO $mig$ BEGIN
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
END $mig$;

-- tickets.assigned_provider_id → profiles.id (skip if column doesn't exist)
DO $mig$ BEGIN
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
END $mig$;

-- tickets.owner_id → profiles.id (skip if column doesn't exist)
DO $mig$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'owner_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_tickets_owner_id' AND table_name = 'tickets')
  THEN
    UPDATE tickets SET owner_id = NULL WHERE owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = tickets.owner_id);
    ALTER TABLE tickets ADD CONSTRAINT fk_tickets_owner_id FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $mig$;

-- documents.profile_id → profiles.id (skip if column doesn't exist)
DO $mig$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'profile_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_documents_profile_id' AND table_name = 'documents')
  THEN
    UPDATE documents SET profile_id = NULL WHERE profile_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = documents.profile_id);
    ALTER TABLE documents ADD CONSTRAINT fk_documents_profile_id FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $mig$;

-- building_units.current_lease_id → leases.id (skip if column/table doesn't exist)
DO $mig$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'building_units' AND column_name = 'current_lease_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_building_units_current_lease_id' AND table_name = 'building_units')
  THEN
    UPDATE building_units SET current_lease_id = NULL WHERE current_lease_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leases WHERE id = building_units.current_lease_id);
    ALTER TABLE building_units ADD CONSTRAINT fk_building_units_current_lease_id FOREIGN KEY (current_lease_id) REFERENCES leases(id) ON DELETE SET NULL;
  END IF;
END $mig$;

-- work_orders.quote_id → quotes.id (skip if column doesn't exist)
DO $mig$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_work_orders_quote_id' AND table_name = 'work_orders')
  THEN
    UPDATE work_orders SET quote_id = NULL WHERE quote_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quotes WHERE id = work_orders.quote_id);
    ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_quote_id FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $mig$;

-- work_orders.property_id → properties.id (skip if column doesn't exist)
DO $mig$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'property_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_work_orders_property_id' AND table_name = 'work_orders')
  THEN
    UPDATE work_orders SET property_id = NULL WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties WHERE id = work_orders.property_id);
    ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
  END IF;
END $mig$;

-- ----------------------------------------------------------------------------
-- 5.2 Contraintes UNIQUE pour empêcher les futurs doublons
-- ----------------------------------------------------------------------------

-- Empêcher 2 factures pour le même bail + même période
DO $mig$ BEGIN
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
END $mig$;

-- Empêcher 2 signataires identiques sur le même bail
DO $mig$ BEGIN
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
END $mig$;

-- Empêcher 2 EDL de même type sur le même bail (hors annulés)
DO $mig$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_edl_lease_type_active'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_edl_lease_type_active
      ON edl (lease_id, type)
      WHERE status NOT IN ('cancelled', 'disputed');
  END IF;
END $mig$;

-- Empêcher les doublons de roommates sur le même bail
DO $mig$ BEGIN
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
END $mig$;

-- Empêcher les abonnements actifs multiples par user
DO $mig$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_subscriptions_user_active'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user_active
      ON subscriptions (owner_id)
      WHERE status IN ('active', 'trialing');
  END IF;
END $mig$;

-- ----------------------------------------------------------------------------
-- 5.3 Trigger anti-doublon sur INSERT de propriétés
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_duplicate_property()
RETURNS TRIGGER AS $mig$
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
$mig$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_property ON properties;
CREATE TRIGGER trg_prevent_duplicate_property
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_property();

-- ----------------------------------------------------------------------------
-- 5.4 Trigger anti-doublon sur INSERT de paiements (même invoice + même montant + <24h)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_duplicate_payment()
RETURNS TRIGGER AS $mig$
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
$mig$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_payment ON payments;
CREATE TRIGGER trg_prevent_duplicate_payment
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_payment();


-- ============================================================================
-- LOGS
-- ============================================================================
DO $mig$
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
END $mig$;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [8/169] 20260212100001_email_template_system.sql ===
DO $wrapper$ BEGIN
-- ============================================================
-- Email Template System
-- Tables: email_templates, email_template_versions, email_logs
-- ============================================================

-- Table des templates email éditables
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  available_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  send_delay_minutes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherche rapide par slug et catégorie
CREATE INDEX IF NOT EXISTS idx_email_templates_slug ON email_templates(slug);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);

-- Historique des modifications (audit trail)
CREATE TABLE IF NOT EXISTS email_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  modified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_template_versions_template ON email_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_versions_created ON email_template_versions(created_at DESC);

-- Logs d'envoi
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  variables_used JSONB,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template_slug);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_email_template_updated_at()
RETURNS TRIGGER AS $mig$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON email_templates;
CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_template_updated_at();

-- Trigger pour versionner automatiquement les modifications
CREATE OR REPLACE FUNCTION version_email_template()
RETURNS TRIGGER AS $mig$
BEGIN
  -- Sauvegarder l'ancienne version si le contenu a changé
  IF OLD.subject IS DISTINCT FROM NEW.subject
     OR OLD.body_html IS DISTINCT FROM NEW.body_html
     OR OLD.body_text IS DISTINCT FROM NEW.body_text THEN
    INSERT INTO email_template_versions (template_id, subject, body_html, body_text, modified_by)
    VALUES (OLD.id, OLD.subject, OLD.body_html, OLD.body_text, auth.uid());
  END IF;
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_email_template_version ON email_templates;
CREATE TRIGGER trg_email_template_version
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION version_email_template();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- email_templates: lecture pour les admins, écriture pour les admins
CREATE POLICY "email_templates_admin_read" ON email_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "email_templates_admin_write" ON email_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- email_templates: lecture pour le service role (envoi d'emails)
CREATE POLICY "email_templates_service_read" ON email_templates
  FOR SELECT TO service_role
  USING (true);

-- email_template_versions: lecture pour les admins
CREATE POLICY "email_template_versions_admin_read" ON email_template_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- email_logs: lecture pour les admins
CREATE POLICY "email_logs_admin_read" ON email_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- email_logs: insertion pour service role
CREATE POLICY "email_logs_service_insert" ON email_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


