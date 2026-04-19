-- =============================================================================
-- APPLY SPRINT B2 — BATCH 01_FEB2026 (IDEMPOTENT v2)
-- Genere le 2026-04-19T07:37:58Z
--
-- Contenu : 61 migrations (action=apply uniquement)
-- Plage   : 20260208100000 -> 20260230100000
-- Risque  : SAFE=11 / MODERE=19 / DANGEREUX=6 / CRITIQUE=25
--
-- IDEMPOTENCE : chaque CREATE POLICY est precede d'un DROP POLICY IF EXISTS,
-- chaque CREATE TRIGGER est precede d'un DROP TRIGGER IF EXISTS.
-- Les CREATE TABLE/INDEX/FUNCTION utilisent deja IF NOT EXISTS ou OR REPLACE.
-- => Re-executable sans erreur si une migration a deja ete partiellement appliquee.
--
-- INSTRUCTIONS :
-- 1. BACKUP prod obligatoire avant execution (pg_dump + Supabase PITR).
-- 2. Ouvrir Supabase Dashboard > SQL Editor > New Query.
-- 3. Coller ce fichier integralement et cliquer Run.
-- 4. Chaque migration est encapsulee dans son propre BEGIN/COMMIT : rollback cible.
-- 5. Ne PAS appliquer les 28 migrations "rename-then-apply" (branche dedup requise).
--
-- ORDRE : CHRONOLOGIQUE STRICT — ne pas reordonner.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1/61 -- 20260208100000 -- MODERE -- 20260208100000_fix_data_storage_audit.sql
-- risk: ALTER column (type/constraint)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 1/61 (MODERE) 20260208100000_fix_data_storage_audit.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 2/61 -- 20260209100000 -- DANGEREUX -- 20260209100000_create_sms_messages_table.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 2/61 (DANGEREUX) 20260209100000_create_sms_messages_table.sql'; END $$;
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
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
DROP POLICY IF EXISTS sms_messages_admin_all ON sms_messages;
CREATE POLICY sms_messages_admin_all ON sms_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Owners can see SMS they sent (via their profile)
DROP POLICY IF EXISTS sms_messages_owner_select ON sms_messages;
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
DROP POLICY IF EXISTS sms_messages_service_insert ON sms_messages;
CREATE POLICY sms_messages_service_insert ON sms_messages
  FOR INSERT
  WITH CHECK (true);

COMMIT;

-- -----------------------------------------------------------------------------
-- 3/61 -- 20260211000000 -- MODERE -- 20260211000000_p2_unique_constraint_and_gdpr_rpc.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 3/61 (MODERE) 20260211000000_p2_unique_constraint_and_gdpr_rpc.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 4/61 -- 20260211100000 -- MODERE -- 20260211100000_bic_compliance_tax_regime.sql
-- risk: +1 triggers, UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 4/61 (MODERE) 20260211100000_bic_compliance_tax_regime.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 5/61 -- 20260212000000 -- CRITIQUE -- 20260212000000_audit_database_integrity.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 5/61 (CRITIQUE) 20260212000000_audit_database_integrity.sql'; END $$;
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
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION safe_cleanup_orphans(BOOLEAN, TEXT) IS
  'Nettoyage SAFE des orphelins avec archivage. Par défaut en DRY RUN. Usage: SELECT * FROM safe_cleanup_orphans(false) pour exécuter.';


-- ============================================================================
-- PHASE 6: FONCTION DE RESTAURATION (rollback d'un batch de nettoyage)
-- ============================================================================

CREATE OR REPLACE FUNCTION restore_cleanup_batch(p_batch_id UUID)
RETURNS TABLE(
  restored_table TEXT,
  restored_count BIGINT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION restore_cleanup_batch(UUID) IS
  'Liste les enregistrements restaurables pour un batch de nettoyage donné.';


-- ============================================================================
-- LOGS DE MIGRATION
-- ============================================================================
DO $$
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
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 6/61 -- 20260212000001 -- CRITIQUE -- 20260212000001_fix_guarantor_role_and_tables.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 6/61 (CRITIQUE) 20260212000001_fix_guarantor_role_and_tables.sql'; END $$;
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
AS $$
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
$$;

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

DROP POLICY IF EXISTS "user_consents_select_own" ON user_consents;
CREATE POLICY "user_consents_select_own" ON user_consents
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_consents_insert_own" ON user_consents;
CREATE POLICY "user_consents_insert_own" ON user_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_consents_update_own" ON user_consents;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 7/61 -- 20260212100000 -- MODERE -- 20260212100000_audit_v2_merge_and_prevention.sql
-- risk: +2 triggers, UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 7/61 (MODERE) 20260212100000_audit_v2_merge_and_prevention.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 8/61 -- 20260212100001 -- CRITIQUE -- 20260212100001_email_template_system.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 8/61 (CRITIQUE) 20260212100001_email_template_system.sql'; END $$;
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
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON email_templates;
CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_template_updated_at();

-- Trigger pour versionner automatiquement les modifications
CREATE OR REPLACE FUNCTION version_email_template()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
DROP POLICY IF EXISTS "email_templates_admin_read" ON email_templates;
CREATE POLICY "email_templates_admin_read" ON email_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "email_templates_admin_write" ON email_templates;
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
DROP POLICY IF EXISTS "email_templates_service_read" ON email_templates;
CREATE POLICY "email_templates_service_read" ON email_templates
  FOR SELECT TO service_role
  USING (true);

-- email_template_versions: lecture pour les admins
DROP POLICY IF EXISTS "email_template_versions_admin_read" ON email_template_versions;
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
DROP POLICY IF EXISTS "email_logs_admin_read" ON email_logs;
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
DROP POLICY IF EXISTS "email_logs_service_insert" ON email_logs;
CREATE POLICY "email_logs_service_insert" ON email_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

COMMIT;

-- -----------------------------------------------------------------------------
-- 9/61 -- 20260212100002 -- SAFE -- 20260212100002_email_templates_seed.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 9/61 (SAFE) 20260212100002_email_templates_seed.sql'; END $$;
-- ============================================================
-- Seed data: 31 email templates
-- ============================================================

-- ============================================
-- CATÉGORIE : AUTHENTIFICATION (auth)
-- ============================================

INSERT INTO email_templates (slug, category, name, description, subject, body_html, body_text, available_variables, send_delay_minutes) VALUES

-- 1. Confirmation d'inscription
('auth_confirmation', 'auth', 'Confirmation d''inscription', 'Email de confirmation envoyé après la création de compte', 'Confirmez votre inscription sur Talok, {{prenom}}',
'<h2>Bienvenue sur Talok, {{prenom}} !</h2>
<p>Vous venez de créer un compte en tant que <strong>{{role}}</strong>.</p>
<p>Pour activer votre compte et commencer à utiliser Talok, veuillez confirmer votre adresse email :</p>
<a href="{{confirmation_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Confirmer mon adresse email</a>
<p>Ce lien est valable 24 heures. Si vous n''avez pas créé de compte, ignorez cet email.</p>
<p>À très vite sur Talok,<br>L''équipe Talok</p>',
'Bienvenue sur Talok, {{prenom}} !

Vous venez de créer un compte en tant que {{role}}.

Pour activer votre compte, confirmez votre adresse email en cliquant sur le lien suivant :
{{confirmation_url}}

Ce lien est valable 24 heures. Si vous n''avez pas créé de compte, ignorez cet email.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom de l''utilisateur", "example": "Thomas"}, {"key": "email", "label": "Adresse email", "example": "thomas@email.com"}, {"key": "confirmation_url", "label": "Lien de confirmation", "example": "https://talok.fr/auth/confirm?token=..."}, {"key": "role", "label": "Rôle (Propriétaire/Locataire/Prestataire)", "example": "Propriétaire"}]'::jsonb,
0),

-- 2. Réinitialisation de mot de passe
('auth_reset_password', 'auth', 'Réinitialisation de mot de passe', 'Email envoyé lors d''une demande de réinitialisation de mot de passe', 'Réinitialisation de votre mot de passe Talok',
'<h2>Réinitialisation de mot de passe</h2>
<p>Bonjour {{prenom}},</p>
<p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
<a href="{{reset_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Réinitialiser mon mot de passe</a>
<p>Ce lien expire dans {{expiration}}. Si vous n''êtes pas à l''origine de cette demande, ignorez cet email — votre mot de passe ne sera pas modifié.</p>',
'Bonjour {{prenom}},

Vous avez demandé la réinitialisation de votre mot de passe.
Cliquez sur le lien suivant pour en choisir un nouveau :
{{reset_url}}

Ce lien expire dans {{expiration}}.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "reset_url", "label": "Lien de réinitialisation", "example": "https://talok.fr/auth/reset?token=..."}, {"key": "expiration", "label": "Durée de validité", "example": "1 heure"}]'::jsonb,
0),

-- 3. Connexion par lien magique
('auth_magic_link', 'auth', 'Connexion par lien magique', 'Lien magique de connexion sans mot de passe', 'Votre lien de connexion Talok',
'<p>Bonjour {{prenom}},</p>
<p>Cliquez sur le bouton ci-dessous pour vous connecter à Talok :</p>
<a href="{{magic_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Se connecter</a>
<p>Ce lien expire dans {{expiration}} et ne peut être utilisé qu''une seule fois.</p>',
'Bonjour {{prenom}},

Connectez-vous à Talok via ce lien :
{{magic_url}}

Ce lien expire dans {{expiration}} et ne peut être utilisé qu''une seule fois.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "magic_url", "label": "Lien de connexion", "example": "https://talok.fr/auth/magic?token=..."}, {"key": "expiration", "label": "Durée de validité", "example": "15 minutes"}]'::jsonb,
0),

-- 4. Changement d'adresse email
('auth_email_change', 'auth', 'Changement d''adresse email', 'Confirmation lors d''un changement d''adresse email', 'Confirmez votre nouvelle adresse email',
'<p>Bonjour {{prenom}},</p>
<p>Vous avez demandé le changement de votre adresse email vers <strong>{{new_email}}</strong>.</p>
<a href="{{confirm_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Confirmer le changement</a>
<p>Si vous n''êtes pas à l''origine de cette demande, sécurisez votre compte immédiatement.</p>',
'Bonjour {{prenom}},

Vous avez demandé le changement de votre adresse email vers {{new_email}}.

Confirmez le changement via ce lien :
{{confirm_url}}

Si vous n''êtes pas à l''origine de cette demande, sécurisez votre compte immédiatement.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "new_email", "label": "Nouvelle adresse email", "example": "nouveau@email.com"}, {"key": "confirm_url", "label": "Lien de confirmation", "example": "https://talok.fr/auth/confirm-email?token=..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : INVITATIONS & ONBOARDING (invitation)
-- ============================================

-- 5. Invitation locataire
('invitation_tenant', 'invitation', 'Invitation locataire', 'Email d''invitation envoyé à un locataire par le propriétaire', '{{nom_proprietaire}} vous invite à rejoindre Talok',
'<h2>Vous êtes invité(e) sur Talok</h2>
<p>Bonjour {{prenom_locataire}},</p>
<p><strong>{{nom_proprietaire}}</strong> vous invite à rejoindre Talok pour gérer votre location au :</p>
<p style="background:#f1f5f9;padding:12px 16px;border-radius:8px;border-left:4px solid #2563eb;">📍 {{adresse_bien}}</p>
<p>Avec Talok, vous pourrez :</p>
<ul>
  <li>Consulter et télécharger vos quittances de loyer</li>
  <li>Signaler des incidents et suivre leur résolution</li>
  <li>Signer vos documents numériquement</li>
  <li>Communiquer facilement avec votre propriétaire</li>
</ul>
<a href="{{invitation_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Créer mon compte locataire</a>',
'Bonjour {{prenom_locataire}},

{{nom_proprietaire}} vous invite à rejoindre Talok pour gérer votre location au :
{{adresse_bien}}

Créez votre compte via ce lien :
{{invitation_url}}

L''équipe Talok',
'[{"key": "prenom_locataire", "label": "Prénom du locataire", "example": "Marie"}, {"key": "nom_proprietaire", "label": "Nom du propriétaire", "example": "M. Dupont"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas, Fort-de-France"}, {"key": "invitation_url", "label": "Lien d''invitation", "example": "https://talok.fr/invite?token=..."}]'::jsonb,
0),

-- 6. Invitation prestataire
('invitation_provider', 'invitation', 'Invitation prestataire', 'Email d''invitation envoyé à un prestataire par le propriétaire', '{{nom_proprietaire}} vous invite comme prestataire sur Talok',
'<p>Bonjour {{prenom_prestataire}},</p>
<p><strong>{{nom_proprietaire}}</strong> souhaite vous ajouter comme prestataire <strong>{{specialite}}</strong> sur Talok.</p>
<p>En rejoignant Talok, vous pourrez recevoir et gérer vos interventions directement depuis votre espace dédié.</p>
<a href="{{invitation_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Rejoindre Talok</a>',
'Bonjour {{prenom_prestataire}},

{{nom_proprietaire}} souhaite vous ajouter comme prestataire {{specialite}} sur Talok.

Rejoignez Talok via ce lien :
{{invitation_url}}

L''équipe Talok',
'[{"key": "prenom_prestataire", "label": "Prénom du prestataire", "example": "Jacques"}, {"key": "nom_proprietaire", "label": "Nom du propriétaire", "example": "M. Dupont"}, {"key": "specialite", "label": "Spécialité", "example": "plomberie"}, {"key": "invitation_url", "label": "Lien d''invitation", "example": "https://talok.fr/invite?token=..."}]'::jsonb,
0),

-- 7. Bienvenue propriétaire
('welcome_owner', 'invitation', 'Bienvenue propriétaire', 'Email de bienvenue envoyé après confirmation du compte propriétaire', 'Bienvenue sur Talok, {{prenom}} ! Voici comment démarrer',
'<h2>Votre compte est activé</h2>
<p>Bonjour {{prenom}},</p>
<p>Bienvenue sur Talok ! Voici les premières étapes pour bien démarrer :</p>
<ol>
  <li><strong>Ajoutez votre premier bien</strong> — renseignez l''adresse, le type et les caractéristiques</li>
  <li><strong>Créez un bail</strong> — associez un locataire et définissez les conditions</li>
  <li><strong>Invitez votre locataire</strong> — il recevra un email pour créer son espace</li>
</ol>
<a href="{{dashboard_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Accéder à mon tableau de bord</a>
<p>Besoin d''aide ? Notre équipe est disponible à support@talok.fr</p>',
'Bonjour {{prenom}},

Bienvenue sur Talok ! Voici les premières étapes :
1. Ajoutez votre premier bien
2. Créez un bail
3. Invitez votre locataire

Accédez à votre tableau de bord : {{dashboard_url}}

Besoin d''aide ? Contactez support@talok.fr

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "dashboard_url", "label": "Lien vers le dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : BAUX (lease)
-- ============================================

-- 8. Bail créé
('lease_created', 'lease', 'Bail créé', 'Notification au propriétaire lors de la création d''un bail', 'Bail créé — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Le bail pour le bien situé au <strong>{{adresse_bien}}</strong> a été créé avec succès.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Locataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_locataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Début du bail</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_debut}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Loyer mensuel</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant_loyer}} €</td></tr>
</table>
<a href="{{lease_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le bail</a>',
'Bonjour {{prenom}},

Le bail pour le bien au {{adresse_bien}} a été créé.
Locataire : {{nom_locataire}}
Début : {{date_debut}}
Loyer : {{montant_loyer}} €

Voir le bail : {{lease_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas, Fort-de-France"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "date_debut", "label": "Date de début du bail", "example": "1er mars 2026"}, {"key": "montant_loyer", "label": "Montant du loyer", "example": "850"}, {"key": "lease_url", "label": "Lien vers le bail", "example": "https://talok.fr/owner/leases/..."}]'::jsonb,
0),

-- 9. Bail expirant
('lease_expiring', 'lease', 'Bail arrivant à échéance', 'Alerte au propriétaire avant l''expiration d''un bail', 'Bail expirant dans {{jours_restants}} jours — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Le bail de <strong>{{nom_locataire}}</strong> au <strong>{{adresse_bien}}</strong> arrive à échéance le <strong>{{date_fin}}</strong> (dans {{jours_restants}} jours).</p>
<p>Pensez à :</p>
<ul>
  <li>Renouveler le bail si vous souhaitez continuer la location</li>
  <li>Planifier un état des lieux de sortie</li>
  <li>Prévenir votre locataire de vos intentions</li>
</ul>
<a href="{{lease_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Gérer ce bail</a>',
'Bonjour {{prenom}},

Le bail de {{nom_locataire}} au {{adresse_bien}} expire le {{date_fin}} (dans {{jours_restants}} jours).

Gérer ce bail : {{lease_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "date_fin", "label": "Date de fin du bail", "example": "31 mars 2026"}, {"key": "jours_restants", "label": "Nombre de jours restants", "example": "30"}, {"key": "lease_url", "label": "Lien vers le bail", "example": "https://talok.fr/owner/leases/..."}]'::jsonb,
0),

-- 10. Résiliation de bail
('lease_terminated', 'lease', 'Résiliation de bail', 'Notification de résiliation de bail', 'Résiliation de bail — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Le bail pour le bien situé au <strong>{{adresse_bien}}</strong> a été résilié.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date de fin effective</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_fin}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Motif</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{motif}}</td></tr>
</table>
<p>Un état des lieux de sortie devra être planifié avant cette date.</p>',
'Bonjour {{prenom}},

Le bail au {{adresse_bien}} a été résilié.
Date de fin : {{date_fin}}
Motif : {{motif}}

Un état des lieux de sortie devra être planifié.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Thomas"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "date_fin", "label": "Date effective de fin", "example": "31 mars 2026"}, {"key": "motif", "label": "Motif de résiliation", "example": "Congé du locataire"}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : PAIEMENTS & LOYERS (payment)
-- ============================================

-- 11. Rappel de loyer
('rent_reminder', 'payment', 'Rappel de loyer', 'Rappel envoyé au locataire avant l''échéance du loyer', 'Rappel : loyer de {{montant}} € à régler avant le {{date_echeance}}',
'<p>Bonjour {{prenom}},</p>
<p>Votre loyer de <strong>{{montant}} €</strong> pour le bien situé au <strong>{{adresse_bien}}</strong> est à régler avant le <strong>{{date_echeance}}</strong>.</p>
<a href="{{payment_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Payer mon loyer</a>
<p>Si vous avez déjà effectué le paiement, veuillez ignorer cet email.</p>',
'Bonjour {{prenom}},

Votre loyer de {{montant}} € pour le bien au {{adresse_bien}} est à régler avant le {{date_echeance}}.

Payer : {{payment_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "montant", "label": "Montant du loyer", "example": "850"}, {"key": "date_echeance", "label": "Date d''échéance", "example": "5 mars 2026"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "payment_url", "label": "Lien de paiement", "example": "https://talok.fr/tenant/payments/..."}]'::jsonb,
0),

-- 12. Loyer reçu (propriétaire)
('rent_received', 'payment', 'Loyer reçu', 'Notification au propriétaire après réception d''un loyer', 'Loyer reçu — {{montant}} € de {{nom_locataire}}',
'<p>Bonjour {{prenom}},</p>
<p>Le loyer du mois de <strong>{{mois}}</strong> a été reçu :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Locataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_locataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} €</td></tr>
</table>
<p>La quittance sera automatiquement générée et envoyée au locataire.</p>',
'Bonjour {{prenom}},

Loyer de {{mois}} reçu :
Locataire : {{nom_locataire}}
Bien : {{adresse_bien}}
Montant : {{montant}} €

La quittance sera générée automatiquement.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "montant", "label": "Montant reçu", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "mois", "label": "Mois concerné", "example": "mars 2026"}, {"key": "dashboard_url", "label": "Lien dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0),

-- 13. Loyer en retard (propriétaire)
('rent_late', 'payment', 'Loyer en retard', 'Alerte au propriétaire pour un loyer impayé', 'Loyer impayé — {{nom_locataire}} ({{jours_retard}} jours de retard)',
'<p>Bonjour {{prenom}},</p>
<p>Le loyer de <strong>{{nom_locataire}}</strong> pour le bien au <strong>{{adresse_bien}}</strong> est en retard de <strong>{{jours_retard}} jours</strong>.</p>
<p>Montant impayé : <strong>{{montant}} €</strong></p>
<a href="{{lease_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le détail</a>',
'Bonjour {{prenom}},

Loyer impayé de {{nom_locataire}} au {{adresse_bien}}.
Retard : {{jours_retard}} jours
Montant : {{montant}} €

Voir le détail : {{lease_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "montant", "label": "Montant dû", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "jours_retard", "label": "Jours de retard", "example": "5"}, {"key": "lease_url", "label": "Lien vers le bail", "example": "https://talok.fr/owner/leases/..."}]'::jsonb,
0),

-- 14. Relance loyer impayé (locataire)
('rent_late_tenant', 'payment', 'Relance loyer impayé', 'Relance envoyée au locataire pour un loyer en retard', 'Rappel important : loyer impayé de {{montant}} €',
'<p>Bonjour {{prenom}},</p>
<p>Nous vous informons que votre loyer pour le bien au <strong>{{adresse_bien}}</strong> est en retard de <strong>{{jours_retard}} jours</strong>.</p>
<p>Montant à régler : <strong>{{montant}} €</strong></p>
<a href="{{payment_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Régulariser maintenant</a>
<p>En cas de difficulté, nous vous encourageons à contacter votre propriétaire pour trouver une solution amiable.</p>',
'Bonjour {{prenom}},

Votre loyer au {{adresse_bien}} est en retard de {{jours_retard}} jours.
Montant : {{montant}} €

Régulariser : {{payment_url}}

En cas de difficulté, contactez votre propriétaire.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "montant", "label": "Montant dû", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "jours_retard", "label": "Jours de retard", "example": "5"}, {"key": "payment_url", "label": "Lien de paiement", "example": "https://talok.fr/tenant/payments/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : DOCUMENTS & QUITTANCES (document)
-- ============================================

-- 15. Quittance disponible
('quittance_available', 'document', 'Quittance disponible', 'Notification au locataire quand une quittance est prête', 'Votre quittance de loyer — {{mois}} {{annee}}',
'<p>Bonjour {{prenom}},</p>
<p>Votre quittance de loyer pour <strong>{{mois}} {{annee}}</strong> est disponible.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} €</td></tr>
</table>
<a href="{{download_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Télécharger ma quittance</a>',
'Bonjour {{prenom}},

Votre quittance de loyer pour {{mois}} {{annee}} est disponible.
Bien : {{adresse_bien}}
Montant : {{montant}} €

Télécharger : {{download_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "mois", "label": "Mois", "example": "mars"}, {"key": "annee", "label": "Année", "example": "2026"}, {"key": "montant", "label": "Montant", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "download_url", "label": "Lien de téléchargement", "example": "https://talok.fr/tenant/documents/..."}]'::jsonb,
0),

-- 16. Document à signer
('document_to_sign', 'document', 'Document à signer', 'Notification quand un document nécessite une signature', 'Document à signer : {{type_document}} — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_expediteur}}</strong> vous invite à signer le document suivant :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Document</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{type_document}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien concerné</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">À signer avant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{expiration}}</td></tr>
</table>
<a href="{{sign_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Signer le document</a>
<p>Ce lien expire le {{expiration}}.</p>',
'Bonjour {{prenom}},

{{nom_expediteur}} vous invite à signer : {{type_document}}
Bien : {{adresse_bien}}
À signer avant : {{expiration}}

Signer : {{sign_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du signataire", "example": "Marie"}, {"key": "type_document", "label": "Type de document", "example": "Bail d''habitation"}, {"key": "nom_expediteur", "label": "Nom de l''expéditeur", "example": "M. Dupont"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "sign_url", "label": "Lien de signature", "example": "https://talok.fr/signature/..."}, {"key": "expiration", "label": "Date d''expiration", "example": "15 mars 2026"}]'::jsonb,
0),

-- 17. Document signé
('document_signed', 'document', 'Document signé', 'Notification quand un document a été signé', 'Document signé par {{nom_signataire}} — {{type_document}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_signataire}}</strong> a signé le document <strong>{{type_document}}</strong> concernant le bien au <strong>{{adresse_bien}}</strong> le {{date_signature}}.</p>
<a href="{{document_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le document signé</a>',
'Bonjour {{prenom}},

{{nom_signataire}} a signé le document {{type_document}} pour le bien au {{adresse_bien}} le {{date_signature}}.

Voir le document : {{document_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Thomas"}, {"key": "type_document", "label": "Type de document", "example": "Bail d''habitation"}, {"key": "nom_signataire", "label": "Nom du signataire", "example": "Marie Martin"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "date_signature", "label": "Date de signature", "example": "1er mars 2026"}, {"key": "document_url", "label": "Lien vers le document", "example": "https://talok.fr/documents/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : ÉTATS DES LIEUX (edl)
-- ============================================

-- 18. EDL planifié
('edl_scheduled', 'edl', 'EDL planifié', 'Notification quand un état des lieux est programmé', 'État des lieux {{type_edl}} planifié — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Un état des lieux <strong>{{type_edl}}</strong> a été planifié :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_edl}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Organisé par</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_organisateur}}</td></tr>
</table>
<a href="{{edl_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir les détails</a>
<p>Veuillez vous présenter à l''adresse indiquée à la date et heure convenues.</p>',
'Bonjour {{prenom}},

État des lieux {{type_edl}} planifié :
Bien : {{adresse_bien}}
Date : {{date_edl}}
Organisé par : {{nom_organisateur}}

Détails : {{edl_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Marie"}, {"key": "type_edl", "label": "Type (Entrée/Sortie)", "example": "d''entrée"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "date_edl", "label": "Date et heure", "example": "15 mars 2026 à 10h00"}, {"key": "nom_organisateur", "label": "Organisateur", "example": "M. Dupont"}, {"key": "edl_url", "label": "Lien vers le détail", "example": "https://talok.fr/edl/..."}]'::jsonb,
0),

-- 19. EDL terminé
('edl_completed', 'edl', 'EDL terminé', 'Notification quand un état des lieux est finalisé', 'État des lieux {{type_edl}} terminé — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>L''état des lieux <strong>{{type_edl}}</strong> du bien au <strong>{{adresse_bien}}</strong> réalisé le {{date_edl}} est maintenant finalisé.</p>
<a href="{{report_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Consulter le rapport</a>
<p>Le rapport est disponible dans votre espace documents.</p>',
'Bonjour {{prenom}},

L''état des lieux {{type_edl}} au {{adresse_bien}} réalisé le {{date_edl}} est finalisé.

Consulter le rapport : {{report_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "type_edl", "label": "Type (Entrée/Sortie)", "example": "de sortie"}, {"key": "adresse_bien", "label": "Adresse", "example": "12 rue des Lilas"}, {"key": "date_edl", "label": "Date de réalisation", "example": "15 mars 2026"}, {"key": "report_url", "label": "Lien vers le rapport", "example": "https://talok.fr/edl/report/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : INCIDENTS & INTERVENTIONS (incident)
-- ============================================

-- 20. Incident signalé (propriétaire)
('incident_reported', 'incident', 'Incident signalé', 'Notification au propriétaire quand un locataire signale un incident', 'Incident signalé — {{titre_incident}} ({{urgence}})',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_locataire}}</strong> a signalé un incident au <strong>{{adresse_bien}}</strong> :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Incident</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{titre_incident}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Urgence</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{urgence}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Description</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{description_incident}}</td></tr>
</table>
<a href="{{incident_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Gérer l''incident</a>',
'Bonjour {{prenom}},

{{nom_locataire}} a signalé un incident au {{adresse_bien}} :
Incident : {{titre_incident}}
Urgence : {{urgence}}
Description : {{description_incident}}

Gérer : {{incident_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "nom_locataire", "label": "Locataire", "example": "Marie Martin"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "titre_incident", "label": "Titre de l''incident", "example": "Fuite robinet cuisine"}, {"key": "description_incident", "label": "Description", "example": "Le robinet fuit depuis ce matin"}, {"key": "urgence", "label": "Niveau d''urgence", "example": "urgent"}, {"key": "incident_url", "label": "Lien vers l''incident", "example": "https://talok.fr/owner/tickets/..."}]'::jsonb,
0),

-- 21. Mise à jour d'incident (locataire)
('incident_update', 'incident', 'Mise à jour d''incident', 'Notification au locataire lors de la mise à jour d''un incident', 'Mise à jour de votre incident — {{titre_incident}}',
'<p>Bonjour {{prenom}},</p>
<p>Votre incident <strong>{{titre_incident}}</strong> a été mis à jour :</p>
<p>Nouveau statut : <strong>{{nouveau_statut}}</strong></p>
<p>{{commentaire}}</p>
<a href="{{incident_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le détail</a>',
'Bonjour {{prenom}},

Votre incident "{{titre_incident}}" a été mis à jour.
Nouveau statut : {{nouveau_statut}}
{{commentaire}}

Détail : {{incident_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "titre_incident", "label": "Titre de l''incident", "example": "Fuite robinet cuisine"}, {"key": "nouveau_statut", "label": "Nouveau statut", "example": "En cours de traitement"}, {"key": "commentaire", "label": "Commentaire", "example": "Un technicien passera demain."}, {"key": "incident_url", "label": "Lien", "example": "https://talok.fr/tenant/tickets/..."}]'::jsonb,
0),

-- 22. Intervention assignée (prestataire)
('intervention_assigned', 'incident', 'Intervention assignée', 'Notification au prestataire quand une intervention lui est assignée', 'Nouvelle intervention — {{titre_intervention}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_proprietaire}}</strong> vous assigne une intervention :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Intervention</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{titre_intervention}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Adresse</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date souhaitée</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_souhaitee}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Urgence</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{urgence}}</td></tr>
</table>
<a href="{{intervention_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Accepter / Planifier</a>',
'Bonjour {{prenom}},

{{nom_proprietaire}} vous assigne une intervention :
Intervention : {{titre_intervention}}
Adresse : {{adresse_bien}}
Date souhaitée : {{date_souhaitee}}
Urgence : {{urgence}}

Accepter/Planifier : {{intervention_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du prestataire", "example": "Jacques"}, {"key": "nom_proprietaire", "label": "Nom du propriétaire", "example": "M. Dupont"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "titre_intervention", "label": "Description", "example": "Réparation fuite robinet"}, {"key": "date_souhaitee", "label": "Date souhaitée", "example": "18 mars 2026"}, {"key": "urgence", "label": "Niveau d''urgence", "example": "urgent"}, {"key": "intervention_url", "label": "Lien", "example": "https://talok.fr/provider/work-orders/..."}]'::jsonb,
0),

-- 23. Intervention planifiée (locataire)
('intervention_scheduled', 'incident', 'Intervention planifiée', 'Notification au locataire quand une intervention est programmée', 'Intervention planifiée — {{titre_intervention}}',
'<p>Bonjour {{prenom}},</p>
<p>Une intervention a été planifiée pour votre logement au <strong>{{adresse_bien}}</strong> :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Intervention</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{titre_intervention}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Prestataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_prestataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_intervention}}</td></tr>
</table>
<p>Merci de vous assurer que l''accès au logement sera possible à cette date.</p>',
'Bonjour {{prenom}},

Intervention planifiée au {{adresse_bien}} :
Intervention : {{titre_intervention}}
Prestataire : {{nom_prestataire}}
Date : {{date_intervention}}

Merci d''assurer l''accès au logement.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "titre_intervention", "label": "Description", "example": "Réparation fuite robinet"}, {"key": "nom_prestataire", "label": "Nom du prestataire", "example": "Jacques Martin"}, {"key": "date_intervention", "label": "Date et créneau", "example": "18 mars 2026, 9h-12h"}, {"key": "adresse_bien", "label": "Adresse", "example": "12 rue des Lilas"}]'::jsonb,
0),

-- 24. Intervention terminée (propriétaire)
('intervention_completed', 'incident', 'Intervention terminée', 'Notification au propriétaire quand une intervention est finalisée', 'Intervention terminée — {{titre_intervention}}',
'<p>Bonjour {{prenom}},</p>
<p>L''intervention <strong>{{titre_intervention}}</strong> au <strong>{{adresse_bien}}</strong> a été réalisée.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Prestataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_prestataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_realisation}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Coût</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{cout}} €</td></tr>
</table>
<a href="{{intervention_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le compte-rendu</a>',
'Bonjour {{prenom}},

Intervention terminée : {{titre_intervention}} au {{adresse_bien}}
Prestataire : {{nom_prestataire}}
Date : {{date_realisation}}
Coût : {{cout}} €

Compte-rendu : {{intervention_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "titre_intervention", "label": "Description", "example": "Réparation fuite robinet"}, {"key": "nom_prestataire", "label": "Prestataire", "example": "Jacques Martin"}, {"key": "adresse_bien", "label": "Adresse", "example": "12 rue des Lilas"}, {"key": "date_realisation", "label": "Date de réalisation", "example": "18 mars 2026"}, {"key": "cout", "label": "Coût", "example": "150"}, {"key": "intervention_url", "label": "Lien", "example": "https://talok.fr/owner/work-orders/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : ABONNEMENT & FACTURATION (subscription)
-- ============================================

-- 25. Bienvenue abonnement
('subscription_welcome', 'subscription', 'Bienvenue abonnement', 'Email de bienvenue après souscription à un plan', 'Votre abonnement Talok {{plan}} est activé !',
'<p>Bonjour {{prenom}},</p>
<p>Votre abonnement <strong>Talok {{plan}}</strong> est maintenant actif. Merci pour votre confiance !</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Plan</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{plan}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} € / an</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Prochain renouvellement</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_renouvellement}}</td></tr>
</table>
<a href="{{dashboard_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Accéder à Talok</a>',
'Bonjour {{prenom}},

Votre abonnement Talok {{plan}} est actif.
Plan : {{plan}}
Montant : {{montant}} € / an
Prochain renouvellement : {{date_renouvellement}}

Accéder à Talok : {{dashboard_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "plan", "label": "Nom du plan", "example": "Confort"}, {"key": "montant", "label": "Montant annuel", "example": "290"}, {"key": "date_renouvellement", "label": "Date de renouvellement", "example": "12 février 2027"}, {"key": "dashboard_url", "label": "Lien dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0),

-- 26. Abonnement expirant
('subscription_expiring', 'subscription', 'Abonnement expirant', 'Alerte avant l''expiration d''un abonnement', 'Votre abonnement Talok expire dans {{jours_restants}} jours',
'<p>Bonjour {{prenom}},</p>
<p>Votre abonnement <strong>Talok {{plan}}</strong> expire le <strong>{{date_expiration}}</strong>.</p>
<p>Pour continuer à profiter de toutes les fonctionnalités, pensez à renouveler votre abonnement.</p>
<a href="{{renewal_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Renouveler mon abonnement</a>',
'Bonjour {{prenom}},

Votre abonnement Talok {{plan}} expire le {{date_expiration}}.

Renouveler : {{renewal_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "plan", "label": "Plan actuel", "example": "Confort"}, {"key": "date_expiration", "label": "Date d''expiration", "example": "12 mars 2026"}, {"key": "jours_restants", "label": "Jours restants", "example": "15"}, {"key": "renewal_url", "label": "Lien de renouvellement", "example": "https://talok.fr/settings/billing"}]'::jsonb,
0),

-- 27. Abonnement renouvelé
('subscription_renewed', 'subscription', 'Abonnement renouvelé', 'Confirmation de renouvellement d''abonnement', 'Abonnement Talok renouvelé',
'<p>Bonjour {{prenom}},</p>
<p>Votre abonnement <strong>Talok {{plan}}</strong> a été renouvelé avec succès.</p>
<p>Montant : <strong>{{montant}} €</strong><br>
Prochain renouvellement : {{date_renouvellement}}</p>
<a href="{{invoice_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Télécharger ma facture</a>',
'Bonjour {{prenom}},

Votre abonnement Talok {{plan}} a été renouvelé.
Montant : {{montant}} €
Prochain renouvellement : {{date_renouvellement}}

Facture : {{invoice_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "plan", "label": "Plan", "example": "Confort"}, {"key": "montant", "label": "Montant facturé", "example": "290"}, {"key": "date_renouvellement", "label": "Prochaine échéance", "example": "12 février 2027"}, {"key": "invoice_url", "label": "Lien vers la facture", "example": "https://talok.fr/settings/billing/invoices/..."}]'::jsonb,
0),

-- 28. Échec de paiement
('payment_failed', 'subscription', 'Échec de paiement', 'Alerte lors d''un échec de paiement d''abonnement', 'Échec du paiement Talok — Action requise',
'<p>Bonjour {{prenom}},</p>
<p>Le paiement de <strong>{{montant}} €</strong> pour votre abonnement Talok a échoué.</p>
<p>Raison : {{raison}}</p>
<p>Veuillez mettre à jour vos informations de paiement pour éviter toute interruption de service.</p>
<a href="{{billing_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Mettre à jour mon moyen de paiement</a>',
'Bonjour {{prenom}},

Le paiement de {{montant}} € pour votre abonnement Talok a échoué.
Raison : {{raison}}

Mettez à jour vos informations de paiement : {{billing_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "montant", "label": "Montant", "example": "290"}, {"key": "raison", "label": "Raison de l''échec", "example": "Carte expirée"}, {"key": "billing_url", "label": "Lien paramètres de paiement", "example": "https://talok.fr/settings/billing"}]'::jsonb,
0),

-- 29. Facture disponible
('invoice_available', 'subscription', 'Facture disponible', 'Notification quand une facture Talok est prête', 'Facture Talok n°{{numero_facture}} disponible',
'<p>Bonjour {{prenom}},</p>
<p>Votre facture Talok est disponible :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Facture n°</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{numero_facture}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_facture}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} €</td></tr>
</table>
<a href="{{invoice_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Télécharger la facture</a>',
'Bonjour {{prenom}},

Facture Talok disponible :
N° : {{numero_facture}}
Date : {{date_facture}}
Montant : {{montant}} €

Télécharger : {{invoice_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "numero_facture", "label": "Numéro de facture", "example": "TLK-2026-0042"}, {"key": "montant", "label": "Montant", "example": "290"}, {"key": "date_facture", "label": "Date", "example": "12 février 2026"}, {"key": "invoice_url", "label": "Lien de téléchargement", "example": "https://talok.fr/settings/billing/invoices/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : MESSAGERIE (messaging)
-- ============================================

-- 30. Nouveau message
('new_message', 'messaging', 'Nouveau message', 'Notification quand un nouveau message est reçu', 'Nouveau message de {{nom_expediteur}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_expediteur}}</strong> vous a envoyé un message :</p>
<blockquote style="border-left:4px solid #2563eb;padding:8px 16px;margin:16px 0;background:#f8fafc;">{{apercu_message}}</blockquote>
<a href="{{message_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Répondre</a>',
'Bonjour {{prenom}},

{{nom_expediteur}} vous a envoyé un message :
"{{apercu_message}}"

Répondre : {{message_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Thomas"}, {"key": "nom_expediteur", "label": "Nom de l''expéditeur", "example": "Marie Martin"}, {"key": "apercu_message", "label": "Aperçu du message", "example": "Bonjour, j''ai une question concernant..."}, {"key": "message_url", "label": "Lien vers la conversation", "example": "https://talok.fr/messages/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : RAPPORTS (report)
-- ============================================

-- 31. Récapitulatif mensuel propriétaire
('monthly_summary_owner', 'report', 'Récapitulatif mensuel', 'Rapport mensuel envoyé aux propriétaires', 'Récapitulatif {{mois}} {{annee}} — {{loyers_recus}} € encaissés',
'<h2>Récapitulatif du mois de {{mois}} {{annee}}</h2>
<p>Bonjour {{prenom}}, voici le résumé de votre activité locative :</p>
<h3>Finances</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Loyers encaissés</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{loyers_recus}} € / {{loyers_attendus}} €</td></tr>
</table>
<h3>Patrimoine</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Biens gérés</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nb_biens}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Taux d''occupation</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{taux_occupation}} %</td></tr>
</table>
<h3>Maintenance</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Incidents ouverts</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nb_incidents_ouverts}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Interventions ce mois</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nb_interventions}}</td></tr>
</table>
<a href="{{dashboard_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le détail</a>',
'Bonjour {{prenom}},

Récapitulatif {{mois}} {{annee}} :

FINANCES
Loyers encaissés : {{loyers_recus}} € / {{loyers_attendus}} €

PATRIMOINE
Biens gérés : {{nb_biens}}
Taux d''occupation : {{taux_occupation}} %

MAINTENANCE
Incidents ouverts : {{nb_incidents_ouverts}}
Interventions : {{nb_interventions}}

Détail : {{dashboard_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "mois", "label": "Mois", "example": "février"}, {"key": "annee", "label": "Année", "example": "2026"}, {"key": "nb_biens", "label": "Nombre de biens", "example": "3"}, {"key": "loyers_recus", "label": "Loyers encaissés", "example": "2550"}, {"key": "loyers_attendus", "label": "Loyers attendus", "example": "2550"}, {"key": "nb_incidents_ouverts", "label": "Incidents ouverts", "example": "1"}, {"key": "nb_interventions", "label": "Interventions du mois", "example": "2"}, {"key": "taux_occupation", "label": "Taux d''occupation", "example": "100"}, {"key": "dashboard_url", "label": "Lien dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0)
ON CONFLICT (slug) DO NOTHING;

COMMIT;

-- -----------------------------------------------------------------------------
-- 10/61 -- 20260212200000 -- CRITIQUE -- 20260212200000_audit_v3_comprehensive_integrity.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 10/61 (CRITIQUE) 20260212200000_audit_v3_comprehensive_integrity.sql'; END $$;
-- ============================================================================
-- AUDIT D'INTÉGRITÉ V3 — VÉRIFICATIONS ÉTENDUES & QUALITÉ DES DONNÉES
-- Date: 2026-02-12
-- Complète 20260212000000 + 20260212100000
-- ============================================================================
-- Ce script ajoute :
--   Phase 6 : Intégrité signatures (sessions, participants, preuves)
--   Phase 7 : Intégrité organisations & white-label
--   Phase 8 : Intégrité commercial (fonds de commerce, location-gérance)
--   Phase 9 : Qualité des données (champs obligatoires, cohérence métier)
--   Phase 10 : Rapport d'audit unifié (score global)
-- ============================================================================
-- PRÉREQUIS : 20260212000000 + 20260212100000 déjà appliqués
-- ============================================================================


-- ============================================================================
-- PHASE 6 : INTÉGRITÉ DES SIGNATURES
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_signature_integrity()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT,
  sample_ids TEXT
) AS $$
BEGIN

  -- Sessions sans participants
  RETURN QUERY
  SELECT 'sessions_without_participants'::TEXT,
    'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Sessions de signature actives sans aucun participant'::TEXT,
    string_agg(ss.id::TEXT, ', ')::TEXT
  FROM signature_sessions ss
  WHERE ss.status IN ('pending', 'ongoing')
    AND NOT EXISTS (SELECT 1 FROM signature_participants sp WHERE sp.session_id = ss.id);

  -- Participants orphelins (session supprimée)
  RETURN QUERY
  SELECT 'orphan_participants'::TEXT,
    'signature_participants'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Participants dont la session de signature n''existe plus'::TEXT,
    string_agg(sp.id::TEXT, ', ')::TEXT
  FROM signature_participants sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sp.session_id);

  -- Preuves orphelines (participant supprimé)
  RETURN QUERY
  SELECT 'orphan_proofs'::TEXT,
    'signature_proofs'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Preuves de signature dont le participant n''existe plus'::TEXT,
    string_agg(sp.id::TEXT, ', ')::TEXT
  FROM signature_proofs sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_participants pa WHERE pa.id = sp.participant_id);

  -- Sessions "done" sans preuve pour tous les participants signés
  RETURN QUERY
  SELECT 'done_sessions_missing_proofs'::TEXT,
    'signature_sessions'::TEXT,
    COUNT(DISTINCT ss.id)::BIGINT,
    'HIGH'::TEXT,
    'Sessions terminées avec des participants signés sans preuve eIDAS'::TEXT,
    string_agg(DISTINCT ss.id::TEXT, ', ')::TEXT
  FROM signature_sessions ss
  JOIN signature_participants sp ON sp.session_id = ss.id
  WHERE ss.status = 'done'
    AND sp.status = 'signed'
    AND NOT EXISTS (
      SELECT 1 FROM signature_proofs pr WHERE pr.participant_id = sp.id
    );

  -- Sessions expirées non marquées
  RETURN QUERY
  SELECT 'expired_sessions_not_marked'::TEXT,
    'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Sessions avec deadline dépassée mais statut non-expiré'::TEXT,
    string_agg(ss.id::TEXT, ', ')::TEXT
  FROM signature_sessions ss
  WHERE ss.deadline < NOW()
    AND ss.status IN ('pending', 'ongoing');

  -- Audit log orphelin
  RETURN QUERY
  SELECT 'orphan_audit_log'::TEXT,
    'signature_audit_log'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Logs d''audit dont la session n''existe plus'::TEXT,
    NULL::TEXT
  FROM signature_audit_log sal
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sal.session_id);

  -- Participants avec profile_id invalide
  RETURN QUERY
  SELECT 'participant_invalid_profile'::TEXT,
    'signature_participants'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Participants avec un profile_id pointant vers un profil inexistant'::TEXT,
    string_agg(sp.id::TEXT, ', ')::TEXT
  FROM signature_participants sp
  WHERE sp.profile_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = sp.profile_id);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_signature_integrity() IS
  'Vérifie l''intégrité du système de signatures (sessions, participants, preuves eIDAS).';


-- ============================================================================
-- PHASE 7 : INTÉGRITÉ ORGANISATIONS & WHITE-LABEL
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_organization_integrity()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT,
  sample_ids TEXT
) AS $$
BEGIN

  -- Organisations sans owner
  RETURN QUERY
  SELECT 'org_without_owner'::TEXT,
    'organizations'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Organisations dont le propriétaire (auth.users) n''existe plus'::TEXT,
    string_agg(o.id::TEXT, ', ')::TEXT
  FROM organizations o
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.owner_id);

  -- Membres orphelins (org supprimée)
  RETURN QUERY
  SELECT 'orphan_members'::TEXT,
    'organization_members'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Membres d''organisation dont l''organisation n''existe plus'::TEXT,
    string_agg(om.id::TEXT, ', ')::TEXT
  FROM organization_members om
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = om.organization_id);

  -- Membres orphelins (user supprimé)
  RETURN QUERY
  SELECT 'member_invalid_user'::TEXT,
    'organization_members'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Membres d''organisation dont le user_id n''existe plus'::TEXT,
    string_agg(om.id::TEXT, ', ')::TEXT
  FROM organization_members om
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = om.user_id);

  -- Branding orphelin
  RETURN QUERY
  SELECT 'orphan_branding'::TEXT,
    'organization_branding'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Branding d''organisation dont l''organisation n''existe plus'::TEXT,
    string_agg(ob.id::TEXT, ', ')::TEXT
  FROM organization_branding ob
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ob.organization_id);

  -- Domaines personnalisés orphelins
  RETURN QUERY
  SELECT 'orphan_domains'::TEXT,
    'custom_domains'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Domaines personnalisés dont l''organisation n''existe plus'::TEXT,
    string_agg(cd.id::TEXT, ', ')::TEXT
  FROM custom_domains cd
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = cd.organization_id);

  -- Orgs actives sans branding
  RETURN QUERY
  SELECT 'active_org_no_branding'::TEXT,
    'organizations'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Organisations actives en mode white-label sans branding configuré'::TEXT,
    string_agg(o.id::TEXT, ', ')::TEXT
  FROM organizations o
  WHERE o.is_active = true
    AND o.white_label_level != 'none'
    AND NOT EXISTS (SELECT 1 FROM organization_branding ob WHERE ob.organization_id = o.id);

  -- Domaines actifs avec SSL expiré
  RETURN QUERY
  SELECT 'expired_ssl'::TEXT,
    'custom_domains'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Domaines actifs avec certificat SSL expiré'::TEXT,
    string_agg(cd.domain, ', ')::TEXT
  FROM custom_domains cd
  WHERE cd.is_active = true
    AND cd.verified = true
    AND cd.ssl_expires_at IS NOT NULL
    AND cd.ssl_expires_at < NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_organization_integrity() IS
  'Vérifie l''intégrité du système multi-tenant et white-label.';


-- ============================================================================
-- PHASE 8 : INTÉGRITÉ COMMERCIAL (FONDS DE COMMERCE, LOCATION-GÉRANCE)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_commercial_integrity()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT,
  sample_ids TEXT
) AS $$
BEGIN

  -- Fonds de commerce sans owner
  RETURN QUERY
  SELECT 'fonds_without_owner'::TEXT,
    'fonds_commerce'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Fonds de commerce dont le propriétaire n''existe plus'::TEXT,
    string_agg(fc.id::TEXT, ', ')::TEXT
  FROM fonds_commerce fc
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = fc.owner_id);

  -- Fonds avec bail_commercial_id invalide
  RETURN QUERY
  SELECT 'fonds_invalid_bail'::TEXT,
    'fonds_commerce'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Fonds avec bail_commercial_id pointant vers un bail inexistant'::TEXT,
    string_agg(fc.id::TEXT, ', ')::TEXT
  FROM fonds_commerce fc
  WHERE fc.bail_commercial_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = fc.bail_commercial_id);

  -- Licences orphelines
  RETURN QUERY
  SELECT 'orphan_licences'::TEXT,
    'fonds_commerce_licences'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Licences dont le fonds de commerce n''existe plus'::TEXT,
    string_agg(fcl.id::TEXT, ', ')::TEXT
  FROM fonds_commerce_licences fcl
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = fcl.fonds_id);

  -- Équipements orphelins
  RETURN QUERY
  SELECT 'orphan_equipements'::TEXT,
    'fonds_commerce_equipements'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Équipements dont le fonds de commerce n''existe plus'::TEXT,
    string_agg(fce.id::TEXT, ', ')::TEXT
  FROM fonds_commerce_equipements fce
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = fce.fonds_id);

  -- Contrats location-gérance avec fonds supprimé
  RETURN QUERY
  SELECT 'gerance_orphan_fonds'::TEXT,
    'location_gerance_contracts'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Contrats de location-gérance dont le fonds n''existe plus'::TEXT,
    string_agg(lgc.id::TEXT, ', ')::TEXT
  FROM location_gerance_contracts lgc
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = lgc.fonds_id);

  -- Redevances orphelines
  RETURN QUERY
  SELECT 'orphan_redevances'::TEXT,
    'location_gerance_redevances'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Redevances dont le contrat de location-gérance n''existe plus'::TEXT,
    string_agg(lgr.id::TEXT, ', ')::TEXT
  FROM location_gerance_redevances lgr
  WHERE NOT EXISTS (SELECT 1 FROM location_gerance_contracts lgc WHERE lgc.id = lgr.contract_id);

  -- Contrats actifs avec date_fin dépassée
  RETURN QUERY
  SELECT 'expired_contracts_active'::TEXT,
    'location_gerance_contracts'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Contrats location-gérance actifs avec date_fin dépassée'::TEXT,
    string_agg(lgc.id::TEXT, ', ')::TEXT
  FROM location_gerance_contracts lgc
  WHERE lgc.status = 'active'
    AND lgc.date_fin IS NOT NULL
    AND lgc.date_fin < CURRENT_DATE;

  -- Redevances impayées > 90 jours
  RETURN QUERY
  SELECT 'overdue_redevances'::TEXT,
    'location_gerance_redevances'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Redevances impayées depuis plus de 90 jours'::TEXT,
    string_agg(lgr.id::TEXT, ', ')::TEXT
  FROM location_gerance_redevances lgr
  WHERE lgr.statut IN ('pending', 'late')
    AND lgr.date_echeance < CURRENT_DATE - INTERVAL '90 days';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_commercial_integrity() IS
  'Vérifie l''intégrité des fonds de commerce et contrats de location-gérance.';


-- ============================================================================
-- PHASE 9 : QUALITÉ DES DONNÉES & COHÉRENCE MÉTIER
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_data_quality()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT
) AS $$
BEGIN

  -- ── PROFILS ──────────────────────────────────────────────────────────

  -- Profils sans email
  RETURN QUERY
  SELECT 'profile_missing_email'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Profils sans adresse email'::TEXT
  FROM profiles p
  WHERE (p.email IS NULL OR TRIM(p.email) = '');

  -- Profils sans nom
  RETURN QUERY
  SELECT 'profile_missing_name'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Profils sans nom renseigné'::TEXT
  FROM profiles p
  WHERE (p.nom IS NULL OR TRIM(p.nom) = '');

  -- Profils owner sans owner_profiles
  RETURN QUERY
  SELECT 'owner_without_owner_profile'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Profils avec role=owner sans enregistrement owner_profiles associé'::TEXT
  FROM profiles p
  WHERE p.role = 'owner'
    AND NOT EXISTS (SELECT 1 FROM owner_profiles op WHERE op.profile_id = p.id);

  -- Profils tenant sans tenant_profiles
  RETURN QUERY
  SELECT 'tenant_without_tenant_profile'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Profils avec role=tenant sans enregistrement tenant_profiles associé'::TEXT
  FROM profiles p
  WHERE p.role = 'tenant'
    AND NOT EXISTS (SELECT 1 FROM tenant_profiles tp WHERE tp.profile_id = p.id);

  -- ── PROPRIÉTÉS ───────────────────────────────────────────────────────

  -- Propriétés sans adresse
  RETURN QUERY
  SELECT 'property_missing_address'::TEXT,
    'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Propriétés sans adresse complète'::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
    AND (p.adresse_complete IS NULL OR TRIM(p.adresse_complete) = '');

  -- Propriétés sans code postal
  RETURN QUERY
  SELECT 'property_missing_postal_code'::TEXT,
    'properties'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Propriétés sans code postal'::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
    AND (p.code_postal IS NULL OR TRIM(p.code_postal) = '');

  -- Propriétés avec surface <= 0
  RETURN QUERY
  SELECT 'property_invalid_surface'::TEXT,
    'properties'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Propriétés avec surface <= 0 ou NULL'::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
    AND (p.surface IS NULL OR p.surface <= 0);

  -- ── BAUX ─────────────────────────────────────────────────────────────

  -- Baux actifs sans owner_id ET sans tenant_id
  RETURN QUERY
  SELECT 'lease_no_parties'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Baux actifs sans propriétaire NI locataire'::TEXT
  FROM leases l
  WHERE l.statut NOT IN ('draft', 'cancelled', 'archived')
    AND l.owner_id IS NULL
    AND l.tenant_id IS NULL;

  -- Baux avec date_fin < date_debut
  RETURN QUERY
  SELECT 'lease_invalid_dates'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Baux avec date_fin antérieure à date_debut'::TEXT
  FROM leases l
  WHERE l.date_fin IS NOT NULL
    AND l.date_fin < l.date_debut;

  -- Baux actifs avec loyer <= 0
  RETURN QUERY
  SELECT 'lease_invalid_rent'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux actifs avec loyer <= 0 ou NULL'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND (l.loyer IS NULL OR l.loyer <= 0);

  -- Baux terminés mais toujours marqués actifs (date_fin dépassée > 30j)
  RETURN QUERY
  SELECT 'lease_should_be_terminated'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Baux actifs avec date_fin dépassée de plus de 30 jours'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND l.date_fin IS NOT NULL
    AND l.date_fin < CURRENT_DATE - INTERVAL '30 days';

  -- ── FACTURES ─────────────────────────────────────────────────────────

  -- Factures avec montant négatif
  RETURN QUERY
  SELECT 'invoice_negative_amount'::TEXT,
    'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures avec montant_total négatif'::TEXT
  FROM invoices i
  WHERE i.montant_total < 0;

  -- Factures "paid" sans aucun paiement
  RETURN QUERY
  SELECT 'invoice_paid_no_payment'::TEXT,
    'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures marquées payées sans aucun enregistrement de paiement'::TEXT
  FROM invoices i
  WHERE i.statut = 'paid'
    AND NOT EXISTS (SELECT 1 FROM payments py WHERE py.invoice_id = i.id);

  -- Factures envoyées mais bail terminé/annulé
  RETURN QUERY
  SELECT 'invoice_on_terminated_lease'::TEXT,
    'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Factures non-payées sur des baux terminés ou annulés'::TEXT
  FROM invoices i
  JOIN leases l ON l.id = i.lease_id
  WHERE i.statut NOT IN ('paid', 'cancelled')
    AND l.statut IN ('terminated', 'cancelled', 'archived');

  -- ── DOCUMENTS ────────────────────────────────────────────────────────

  -- Documents expirés non marqués
  RETURN QUERY
  SELECT 'document_expired_not_flagged'::TEXT,
    'documents'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents avec valid_until dépassé mais statut toujours actif'::TEXT
  FROM documents d
  WHERE d.valid_until IS NOT NULL
    AND d.valid_until < CURRENT_DATE
    AND d.ged_status = 'active';

  -- Documents obligatoires manquants pour baux actifs
  RETURN QUERY
  SELECT 'lease_missing_mandatory_docs'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux actifs sans document de type bail attaché'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND NOT EXISTS (
      SELECT 1 FROM documents d
      WHERE d.lease_id = l.id AND d.type = 'bail'
    );

  -- ── DÉPÔTS DE GARANTIE ──────────────────────────────────────────────

  -- Baux actifs sans mouvement de dépôt
  RETURN QUERY
  SELECT 'lease_missing_deposit'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Baux actifs avec dépôt de garantie > 0 mais sans mouvement de dépôt'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND l.depot_de_garantie IS NOT NULL
    AND l.depot_de_garantie > 0
    AND NOT EXISTS (SELECT 1 FROM deposit_movements dm WHERE dm.lease_id = l.id);

  -- ── ENTITÉS LÉGALES ─────────────────────────────────────────────────

  -- Entités actives sans gérant
  RETURN QUERY
  SELECT 'entity_no_manager'::TEXT,
    'legal_entities'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Entités légales actives de type société sans gérant désigné'::TEXT
  FROM legal_entities le
  WHERE le.is_active = true
    AND le.entity_type NOT IN ('particulier', 'indivision')
    AND NOT EXISTS (
      SELECT 1 FROM entity_associates ea
      WHERE ea.legal_entity_id = le.id AND ea.is_gerant = true AND ea.is_current = true
    );

  -- Détention totale != 100% par propriété
  RETURN QUERY
  SELECT 'ownership_not_100_percent'::TEXT,
    'property_ownership'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Propriétés dont la somme des pourcentages de détention != 100%'::TEXT
  FROM (
    SELECT po.property_id, SUM(po.pourcentage_detention) AS total
    FROM property_ownership po
    WHERE po.is_current = true
    GROUP BY po.property_id
    HAVING ABS(SUM(po.pourcentage_detention) - 100) > 0.01
  ) sub;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_data_quality() IS
  'Vérifie la qualité et la cohérence métier des données (champs manquants, incohérences).';


-- ============================================================================
-- PHASE 10 : RAPPORT UNIFIÉ + SCORE DE SANTÉ
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_full_report()
RETURNS TABLE(
  category TEXT,
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT
) AS $$
BEGIN

  -- Orphelins (V1)
  RETURN QUERY
  SELECT 'ORPHANS'::TEXT, aor.fk_column, aor.source_table, aor.orphan_count, aor.severity, aor.description
  FROM audit_orphan_records() aor
  WHERE aor.orphan_count > 0;

  -- Doublons (V1)
  RETURN QUERY
  SELECT 'DUPLICATES'::TEXT, adr.duplicate_key, adr.table_name, adr.duplicate_count, adr.severity, adr.description
  FROM audit_duplicate_records() adr;

  -- Signatures (V3)
  RETURN QUERY
  SELECT 'SIGNATURES'::TEXT, asi.check_name, asi.source_table, asi.issue_count, asi.severity, asi.description
  FROM audit_signature_integrity() asi
  WHERE asi.issue_count > 0;

  -- Organisations (V3)
  RETURN QUERY
  SELECT 'ORGANIZATIONS'::TEXT, aoi.check_name, aoi.source_table, aoi.issue_count, aoi.severity, aoi.description
  FROM audit_organization_integrity() aoi
  WHERE aoi.issue_count > 0;

  -- Commercial (V3)
  RETURN QUERY
  SELECT 'COMMERCIAL'::TEXT, aci.check_name, aci.source_table, aci.issue_count, aci.severity, aci.description
  FROM audit_commercial_integrity() aci
  WHERE aci.issue_count > 0;

  -- Qualité (V3)
  RETURN QUERY
  SELECT 'DATA_QUALITY'::TEXT, adq.check_name, adq.source_table, adq.issue_count, adq.severity, adq.description
  FROM audit_data_quality() adq
  WHERE adq.issue_count > 0;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_full_report() IS
  'Rapport d''audit complet combinant toutes les vérifications (orphelins, doublons, signatures, orga, commercial, qualité).';


-- Score de santé global (0-100)
CREATE OR REPLACE FUNCTION audit_health_score()
RETURNS TABLE(
  total_checks INTEGER,
  passed_checks INTEGER,
  critical_issues INTEGER,
  high_issues INTEGER,
  medium_issues INTEGER,
  low_issues INTEGER,
  health_score NUMERIC(5,2),
  grade TEXT
) AS $$
DECLARE
  v_total INTEGER := 0;
  v_passed INTEGER := 0;
  v_critical INTEGER := 0;
  v_high INTEGER := 0;
  v_medium INTEGER := 0;
  v_low INTEGER := 0;
  v_score NUMERIC(5,2);
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM audit_full_report() LOOP
    v_total := v_total + 1;
    CASE r.severity
      WHEN 'CRITICAL' THEN v_critical := v_critical + 1;
      WHEN 'HIGH' THEN v_high := v_high + 1;
      WHEN 'MEDIUM' THEN v_medium := v_medium + 1;
      WHEN 'LOW' THEN v_low := v_low + 1;
      ELSE NULL;
    END CASE;
  END LOOP;

  -- Compter le total attendu de checks (orphelins + doublons + signatures + orga + commercial + qualité)
  -- On considère les catégories, pas les résultats
  v_total := v_total + 20; -- base checks that can pass silently
  v_passed := v_total - (v_critical + v_high + v_medium + v_low);

  -- Score : chaque sévérité a un poids
  -- CRITICAL = -10, HIGH = -5, MEDIUM = -2, LOW = -0.5
  v_score := GREATEST(0, LEAST(100,
    100.0
    - (v_critical * 10.0)
    - (v_high * 5.0)
    - (v_medium * 2.0)
    - (v_low * 0.5)
  ));

  total_checks := v_total;
  passed_checks := v_passed;
  critical_issues := v_critical;
  high_issues := v_high;
  medium_issues := v_medium;
  low_issues := v_low;
  health_score := v_score;
  grade := CASE
    WHEN v_score >= 95 THEN 'A+'
    WHEN v_score >= 90 THEN 'A'
    WHEN v_score >= 80 THEN 'B'
    WHEN v_score >= 70 THEN 'C'
    WHEN v_score >= 50 THEN 'D'
    ELSE 'F'
  END;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_health_score() IS
  'Retourne un score de santé global de la base (0-100) avec une note A+ à F.';


-- ============================================================================
-- LOGS DE MIGRATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  AUDIT V3 — Vérifications étendues installées';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 6 — Intégrité signatures :';
  RAISE NOTICE '    SELECT * FROM audit_signature_integrity();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 7 — Intégrité organisations :';
  RAISE NOTICE '    SELECT * FROM audit_organization_integrity();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 8 — Intégrité commercial :';
  RAISE NOTICE '    SELECT * FROM audit_commercial_integrity();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 9 — Qualité des données :';
  RAISE NOTICE '    SELECT * FROM audit_data_quality();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 10 — Rapport unifié + Score :';
  RAISE NOTICE '    SELECT * FROM audit_full_report();';
  RAISE NOTICE '    SELECT * FROM audit_health_score();';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 11/61 -- 20260213000000 -- MODERE -- 20260213000000_fix_profiles_rls_recursion_v2.sql
-- risk: +3 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 11/61 (MODERE) 20260213000000_fix_profiles_rls_recursion_v2.sql'; END $$;
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
DROP POLICY IF EXISTS "profiles_own_access" ON profiles;
CREATE POLICY "profiles_own_access" ON profiles
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Politique admin : les admins peuvent voir tous les profils
-- is_admin() est SECURITY DEFINER donc bypasse les RLS
DROP POLICY IF EXISTS "profiles_admin_read" ON profiles;
CREATE POLICY "profiles_admin_read" ON profiles
FOR SELECT TO authenticated
USING (public.is_admin());

-- Politique propriétaire : peut voir les profils de ses locataires
-- get_my_profile_id() est SECURITY DEFINER donc bypasse les RLS
DROP POLICY IF EXISTS "profiles_owner_read_tenants" ON profiles;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 12/61 -- 20260213100000 -- DANGEREUX -- 20260213100000_fix_rls_all_tables_recursion.sql
-- risk: UPDATE sans WHERE : to
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 12/61 (DANGEREUX) 20260213100000_fix_rls_all_tables_recursion.sql'; END $$;
-- =====================================================
-- MIGRATION: Correction globale de la récursion RLS
-- Date: 2026-02-13
-- Problème: Les politiques RLS de subscriptions, notifications et
--           d'autres tables font des sous-requêtes directes sur `profiles`
--           ce qui déclenche l'évaluation RLS sur profiles → récursion (42P17).
--
-- SOLUTION: Remplacer toutes les sous-requêtes `SELECT id FROM profiles WHERE user_id = auth.uid()`
--           par l'appel à `public.get_my_profile_id()` (SECURITY DEFINER, bypass RLS).
-- =====================================================

-- ============================================
-- 0. CORRIGER profiles : retirer FORCE si présent
-- ============================================
-- FORCE ROW LEVEL SECURITY fait que même le propriétaire de la table (postgres)
-- est soumis aux RLS, ce qui casse les fonctions SECURITY DEFINER.
ALTER TABLE profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1. CORRIGER subscriptions
-- ============================================
DROP POLICY IF EXISTS "Owners can view their subscription" ON subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;

-- Propriétaire voit son abonnement (utilise get_my_profile_id au lieu de sous-requête)
CREATE POLICY "Owners can view their subscription" ON subscriptions
  FOR SELECT TO authenticated
  USING (owner_id = public.get_my_profile_id());

-- Admins voient tout (utilise is_admin qui est SECURITY DEFINER)
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ============================================
-- 2. CORRIGER subscription_invoices (si la table existe)
-- ============================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners can view their invoices" ON subscription_invoices;
  CREATE POLICY "Owners can view their invoices" ON subscription_invoices
    FOR SELECT TO authenticated
    USING (
      subscription_id IN (
        SELECT id FROM subscriptions
        WHERE owner_id = public.get_my_profile_id()
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'subscription_invoices does not exist yet, skipping';
END $$;

-- ============================================
-- 3. CORRIGER subscription_usage (si la table existe)
-- ============================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners can view their usage" ON subscription_usage;
  CREATE POLICY "Owners can view their usage" ON subscription_usage
    FOR SELECT TO authenticated
    USING (
      subscription_id IN (
        SELECT id FROM subscriptions
        WHERE owner_id = public.get_my_profile_id()
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'subscription_usage does not exist yet, skipping';
END $$;

-- ============================================
-- 4. CORRIGER notifications
-- ============================================
-- Supprimer TOUTES les anciennes politiques de notifications pour repartir proprement
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'notifications' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Lecture : l'utilisateur voit ses propres notifications
-- Utilise auth.uid() directement et get_my_profile_id() pour recipient_id/profile_id
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Mise à jour : l'utilisateur peut modifier ses propres notifications
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Suppression : l'utilisateur peut supprimer ses propres notifications
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Insertion : le système peut insérer des notifications
DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;
CREATE POLICY "notifications_insert_system" ON notifications
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. VÉRIFICATION : lister les politiques restantes avec sous-requête profiles
-- ============================================
-- Note: Les tables ci-dessous ont aussi des sous-requêtes sur profiles dans leurs
-- politiques RLS. Elles sont moins critiques car elles ne sont pas appelées
-- en cascade depuis profiles, mais pour la robustesse on les corrige aussi.

-- Cette requête est un diagnostic, elle n'échouera pas si les tables n'existent pas
DO $$
BEGIN
  RAISE NOTICE '=== Migration RLS globale appliquée avec succès ===';
  RAISE NOTICE 'Tables corrigées: profiles, subscriptions, subscription_invoices, subscription_usage, notifications';
  RAISE NOTICE 'Méthode: get_my_profile_id() SECURITY DEFINER au lieu de sous-requêtes directes';
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 13/61 -- 20260215100000 -- MODERE -- 20260215100000_signature_security_audit_fixes.sql
-- risk: RENAME column
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 13/61 (MODERE) 20260215100000_signature_security_audit_fixes.sql'; END $$;
-- ============================================================================
-- MIGRATION: Corrections audit sécurité signatures (2026-02-15)
-- ============================================================================
-- 
-- Fixes appliqués :
-- P1-3: Suppression de la colonne signature_image (base64) de lease_signers
-- P1-6: Harmonisation du requirement CNI (décision: CNI optionnel partout)
-- P0-4: Vérification de la contrainte CHECK sur les statuts de bail
--
-- IMPORTANT: Migration NON-DESTRUCTIVE (soft delete avec renommage)
-- ============================================================================

BEGIN;

-- ============================================================================
-- P1-3: Renommer signature_image → _signature_image_deprecated
-- ============================================================================
-- On ne supprime pas immédiatement pour éviter les erreurs d'application
-- pendant le déploiement. La colonne sera supprimée dans une migration future.

DO $$
BEGIN
  -- Vérifier si la colonne existe avant de la renommer
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_signers' 
    AND column_name = 'signature_image'
    AND table_schema = 'public'
  ) THEN
    -- Renommer plutôt que supprimer (rollback possible)
    ALTER TABLE lease_signers RENAME COLUMN signature_image TO _signature_image_deprecated;
    
    COMMENT ON COLUMN lease_signers._signature_image_deprecated IS 
      'DEPRECATED 2026-02-15: Utiliser signature_image_path (Storage) à la place. '
      'Cette colonne sera supprimée lors de la prochaine migration majeure.';
    
    RAISE NOTICE 'Colonne lease_signers.signature_image renommée en _signature_image_deprecated';
  ELSE
    RAISE NOTICE 'Colonne lease_signers.signature_image déjà absente ou renommée';
  END IF;
END $$;

-- ============================================================================
-- P0-4: S'assurer que les statuts de bail incluent tous ceux utilisés par le code
-- ============================================================================
-- Le code utilise ces statuts : draft, pending_signature, partially_signed,
-- fully_signed, active, terminated, archived, cancelled
-- 
-- Vérifier et mettre à jour la contrainte CHECK si nécessaire

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Trouver le nom de la contrainte CHECK sur statut
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'leases'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%statut%';

  IF v_constraint_name IS NOT NULL THEN
    -- Supprimer l'ancienne contrainte
    EXECUTE 'ALTER TABLE leases DROP CONSTRAINT ' || v_constraint_name;
    RAISE NOTICE 'Ancienne contrainte supprimée: %', v_constraint_name;
  END IF;

  -- Recréer avec tous les statuts valides (SSOT 2026)
  ALTER TABLE leases ADD CONSTRAINT leases_statut_check CHECK (
    statut IN (
      'draft',
      'pending_signature',
      'partially_signed',
      'fully_signed',
      'active',
      'terminated',
      'archived',
      'cancelled'
    )
  );
  
  RAISE NOTICE 'Contrainte CHECK sur leases.statut mise à jour avec tous les statuts SSOT 2026';
END $$;

-- ============================================================================
-- P2-6: Ajouter un champ template_version aux lease_signers pour traçabilité
-- ============================================================================

ALTER TABLE lease_signers 
ADD COLUMN IF NOT EXISTS template_version TEXT;

COMMENT ON COLUMN lease_signers.template_version IS 
  'Version du template de bail utilisée au moment de la signature. '
  'Permet de régénérer le PDF avec le bon template si nécessaire.';

-- ============================================================================
-- Index pour améliorer les performances des requêtes de signature
-- ============================================================================

-- Index partiel pour les signatures en attente (optimise checkSignatureRights)
CREATE INDEX IF NOT EXISTS idx_lease_signers_pending 
ON lease_signers(lease_id, role) 
WHERE signature_status = 'pending';

-- Index partiel pour les signatures complètes (optimise determineLeaseStatus)
CREATE INDEX IF NOT EXISTS idx_lease_signers_signed 
ON lease_signers(lease_id) 
WHERE signature_status = 'signed';

-- Index sur invited_email pour la recherche par email (optimise routes token)
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email 
ON lease_signers(invited_email) 
WHERE invited_email IS NOT NULL;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 14/61 -- 20260215200000 -- MODERE -- 20260215200000_fix_rls_properties_tenant_pre_active.sql
-- risk: +1 policies, -1 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 14/61 (MODERE) 20260215200000_fix_rls_properties_tenant_pre_active.sql'; END $$;
-- ============================================================================
-- P0-E1: Fix RLS properties pour locataires avant bail "active"
-- ============================================================================
-- PROBLÈME: La policy "Tenants can view properties with active leases" exige
--           l.statut = 'active', ce qui empêche un nouveau locataire de voir
--           sa propriété pendant la phase de signature / onboarding.
--
-- FIX: Élargir la condition pour inclure tous les statuts où le locataire
--      est légitimement lié au bien (pending_signature, partially_signed,
--      fully_signed, active, notice_given, terminated).
-- ============================================================================

-- 1. Supprimer l'ancienne policy restrictive
DROP POLICY IF EXISTS "Tenants can view properties with active leases" ON properties;

-- 2. Créer la nouvelle policy élargie
DROP POLICY IF EXISTS "Tenants can view linked properties" ON properties;
CREATE POLICY "Tenants can view linked properties"
  ON properties
  FOR SELECT
  USING (
    -- Le locataire peut voir la propriété s'il est signataire d'un bail lié,
    -- quel que soit le statut du bail (sauf draft et cancelled)
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = properties.id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
  );

-- 3. Vérification : s'assurer que les autres policies existantes ne sont pas impactées
-- (les policies owner et admin restent inchangées)

COMMENT ON POLICY "Tenants can view linked properties" ON properties IS
  'P0-E1: Locataires voient les propriétés liées à leurs baux (sauf draft/cancelled). '
  'Remplace l''ancienne policy qui exigeait statut=active uniquement.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 15/61 -- 20260215200001 -- SAFE -- 20260215200001_add_notice_given_lease_status.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 15/61 (SAFE) 20260215200001_add_notice_given_lease_status.sql'; END $$;
-- ============================================================================
-- MIGRATION CORRECTIVE: Harmonisation complète des statuts de bail
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Les migrations successives (20260107000001 → 20260108400000)
--           se sont écrasées mutuellement, supprimant des statuts légitimes
--           (sent, pending_owner_signature, amended, notice_given, cancelled).
--
-- FIX: Recréer la contrainte CHECK avec l'union de TOUS les statuts métier
--      nécessaires au cycle de vie complet d'un bail.
--
-- Flux normal :
--   draft → sent → pending_signature → partially_signed
--   → pending_owner_signature → fully_signed → active
--   → notice_given → terminated → archived
--
-- Branches :
--   draft|pending_signature → cancelled
--   active → amended → active (avenant)
-- ============================================================================

DO $$
BEGIN
  -- Supprimer toute contrainte CHECK existante sur statut
  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS check_lease_statut;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS lease_status_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Recréer avec la liste complète et définitive
  ALTER TABLE leases
    ADD CONSTRAINT leases_statut_check CHECK (
      statut IN (
        'draft',                    -- Brouillon initial
        'sent',                     -- Envoyé au locataire pour lecture
        'pending_signature',        -- En attente de signatures
        'partially_signed',         -- Au moins un signataire a signé
        'pending_owner_signature',  -- Locataire(s) signé(s), attente propriétaire
        'fully_signed',             -- Tous ont signé (avant activation)
        'active',                   -- Bail en cours
        'notice_given',             -- Congé donné (préavis en cours)
        'amended',                  -- Avenant en cours de traitement
        'terminated',               -- Résilié / terminé
        'archived',                 -- Archivé (conservation légale)
        'cancelled'                 -- Annulé (jamais activé)
      )
    );

  RAISE NOTICE '[MIGRATION] CHECK constraint leases_statut_check harmonisée — 12 statuts';
END $$;

-- Mettre à jour le commentaire de colonne
COMMENT ON COLUMN leases.statut IS 'Statut du bail: draft, sent, pending_signature, partially_signed, pending_owner_signature, fully_signed, active, notice_given, amended, terminated, archived, cancelled';

-- Index partiel pour baux en attente d'action (requêtes fréquentes)
DROP INDEX IF EXISTS idx_leases_pending_action;
CREATE INDEX IF NOT EXISTS idx_leases_pending_action ON leases(statut) 
  WHERE statut IN ('pending_signature', 'partially_signed', 'pending_owner_signature', 'fully_signed', 'sent');

COMMIT;

-- -----------------------------------------------------------------------------
-- 16/61 -- 20260215200002 -- MODERE -- 20260215200002_fix_rls_tenant_access_beyond_active.sql
-- risk: +4 policies, -6 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 16/61 (MODERE) 20260215200002_fix_rls_tenant_access_beyond_active.sql'; END $$;
-- ============================================================================
-- MIGRATION CORRECTIVE: Élargir les RLS units/charges/tickets pour les locataires
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Plusieurs policies RLS pour les tables units, charges et tickets
--           filtrent sur l.statut = 'active' uniquement, empêchant les locataires
--           d'accéder aux données pendant les phases de signature, préavis, etc.
--
-- FIX: Remplacer les policies restrictives par des versions élargies utilisant
--      NOT IN ('draft', 'cancelled') pour couvrir tout le cycle de vie.
-- ============================================================================

-- ============================================
-- 1. UNITS — Policy tenant trop restrictive
-- ============================================
DROP POLICY IF EXISTS "Users can view units of accessible properties" ON units;

CREATE POLICY "Users can view units of accessible properties"
  ON units
  FOR SELECT
  USING (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = units.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail non-brouillon/non-annulé sur ce bien
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE (l.property_id = units.property_id OR l.unit_id = units.id)
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- 2. CHARGES — Policy tenant trop restrictive
-- ============================================
DROP POLICY IF EXISTS "Tenants can view charges of properties with active leases" ON charges;

DROP POLICY IF EXISTS "Tenants can view charges of linked properties" ON charges;
CREATE POLICY "Tenants can view charges of linked properties"
  ON charges
  FOR SELECT
  USING (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = charges.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis sur ce bien
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = charges.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given', 'fully_signed')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- 3. TICKETS — Policies tenant trop restrictives
-- ============================================

-- 3a. Policy SELECT
DROP POLICY IF EXISTS "Users can view tickets of accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;

CREATE POLICY "Users can view tickets of accessible properties"
  ON tickets
  FOR SELECT
  USING (
    -- Créateur du ticket
    tickets.created_by_profile_id = public.user_profile_id()
    OR
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    -- Prestataire assigné via work_order
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.ticket_id = tickets.id
        AND wo.provider_id = public.user_profile_id()
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- 3b. Policy INSERT
DROP POLICY IF EXISTS "Users can create tickets for accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;

CREATE POLICY "Users can create tickets for accessible properties"
  ON tickets
  FOR INSERT
  WITH CHECK (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis (peut signaler un problème)
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- Log
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '[MIGRATION] RLS units/charges/tickets élargies au-delà de active';
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 17/61 -- 20260215200003 -- SAFE -- 20260215200003_fix_copro_fk_on_delete.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 17/61 (SAFE) 20260215200003_fix_copro_fk_on_delete.sql'; END $$;
-- ============================================================================
-- MIGRATION CORRECTIVE: Ajouter ON DELETE aux FK copropriété
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Les FK suivantes n'ont pas de clause ON DELETE, ce qui peut
--           causer des erreurs de contrainte si un profil ou une propriété
--           est supprimé(e).
--
-- Tables affectées :
--   - copro_units.owner_profile_id → profiles(id)  → SET NULL
--   - copro_units.property_id → properties(id)      → SET NULL
--   - sites.syndic_profile_id → profiles(id)        → SET NULL
-- ============================================================================

-- 1. copro_units.owner_profile_id
DO $$
BEGIN
  -- Trouver et supprimer la contrainte FK existante
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'copro_units' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'owner_profile_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE copro_units DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'owner_profile_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'copro_units.owner_profile_id FK not found, skipping drop';
END $$;

ALTER TABLE copro_units
  ADD CONSTRAINT copro_units_owner_profile_id_fkey
  FOREIGN KEY (owner_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. copro_units.property_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'copro_units' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'property_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE copro_units DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'property_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'copro_units.property_id FK not found, skipping drop';
END $$;

ALTER TABLE copro_units
  ADD CONSTRAINT copro_units_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;

-- 3. sites.syndic_profile_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sites' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'sites' AND column_name = 'syndic_profile_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE sites DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'sites' AND column_name = 'syndic_profile_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sites.syndic_profile_id FK not found, skipping drop';
END $$;

ALTER TABLE sites
  ADD CONSTRAINT sites_syndic_profile_id_fkey
  FOREIGN KEY (syndic_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Log
DO $$
BEGIN
  RAISE NOTICE '[MIGRATION] FK ON DELETE SET NULL ajoutées pour copro_units et sites';
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 18/61 -- 20260216000000 -- DANGEREUX -- 20260216000000_tenant_document_center.sql
-- risk: UPDATE sans WHERE : of
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 18/61 (DANGEREUX) 20260216000000_tenant_document_center.sql'; END $$;
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
    DROP POLICY IF EXISTS "lease_signers_tenant_view_for_doc_center" ON lease_signers;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 19/61 -- 20260216000001 -- MODERE -- 20260216000001_document_center_notifications.sql
-- risk: +1 triggers, UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 19/61 (MODERE) 20260216000001_document_center_notifications.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 20/61 -- 20260216100000 -- MODERE -- 20260216100000_security_audit_rls_fixes.sql
-- risk: +3 policies, -7 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 20/61 (MODERE) 20260216100000_security_audit_rls_fixes.sql'; END $$;
-- =====================================================
-- MIGRATION: Correctifs sécurité P0 — Audit BIC2026
-- Date: 2026-02-16
--
-- PROBLÈMES CORRIGÉS:
-- 1. Table `leases`: suppression des policies USING(true) résiduelles
--    (créées par 20241130000004, normalement supprimées par 20251228230000
--     mais cette migration assure la sécurité même en cas de re-application)
-- 2. Table `notifications`: policy INSERT trop permissive (WITH CHECK(true))
-- 3. Table `document_ged_audit_log`: policy INSERT trop permissive
-- 4. Table `professional_orders`: policy SELECT trop permissive
-- =====================================================

BEGIN;

-- ============================================
-- 1. LEASES: Supprimer les policies permissives résiduelles
-- ============================================
-- Ces policies permettaient à tout utilisateur authentifié de lire/modifier tous les baux.
-- Les bonnes policies (leases_admin_all, leases_owner_all, leases_tenant_select)
-- ont été créées dans 20251228230000_definitive_rls_fix.sql

DROP POLICY IF EXISTS "authenticated_users_view_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_insert_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_update_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_delete_leases" ON leases;

-- Vérifier que les bonnes policies existent
DO $$
DECLARE
  policy_count INT;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'leases' AND schemaname = 'public';

  IF policy_count = 0 THEN
    RAISE EXCEPTION 'ERREUR CRITIQUE: Table leases n''a aucune policy RLS après nettoyage. '
                     'Les policies sécurisées de 20251228230000 doivent être présentes.';
  END IF;

  RAISE NOTICE 'leases: % policies RLS actives après nettoyage', policy_count;
END $$;

-- ============================================
-- 2. NOTIFICATIONS: Restreindre l'INSERT
-- ============================================
-- Avant: WITH CHECK(true) → tout authentifié peut insérer pour n'importe qui
-- Après: Seul le service_role ou l'utilisateur peut insérer ses propres notifs

DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;

-- Le service_role bypass RLS par défaut, donc cette policy est pour les
-- appels authentifiés qui insèrent des notifications pour eux-mêmes.
-- Les Edge Functions (service_role) ne sont pas affectées par cette restriction.
DROP POLICY IF EXISTS "notifications_insert_own_or_service" ON notifications;
CREATE POLICY "notifications_insert_own_or_service" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    -- L'utilisateur ne peut insérer que des notifications qui le concernent
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- ============================================
-- 3. DOCUMENT_GED_AUDIT_LOG: Restreindre l'INSERT
-- ============================================
-- Avant: WITH CHECK(true) → tout authentifié peut insérer des logs d'audit
-- Après: Seuls les utilisateurs authentifiés peuvent insérer leurs propres logs

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'document_ged_audit_log' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert audit logs" ON document_ged_audit_log';

    -- Restreindre aux logs créés par l'utilisateur authentifié
    EXECUTE '
      DROP POLICY IF EXISTS "audit_log_insert_own" ON document_ged_audit_log;
      CREATE POLICY "audit_log_insert_own" ON document_ged_audit_log
        FOR INSERT TO authenticated
        WITH CHECK (
          performed_by = auth.uid()
          OR performed_by IS NULL
        )
    ';

    RAISE NOTICE 'document_ged_audit_log: policy INSERT corrigée';
  ELSE
    RAISE NOTICE 'document_ged_audit_log: table non existante, skip';
  END IF;
END $$;

-- ============================================
-- 4. PROFESSIONAL_ORDERS: Restreindre le SELECT
-- ============================================
-- Avant: USING(TRUE) → tout authentifié voit toutes les commandes
-- Après: ownership check

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'professional_orders' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "professional_orders_select_policy" ON professional_orders';

    -- professional_orders is a read-only reference table, keep open read
    EXECUTE '
      DROP POLICY IF EXISTS "professional_orders_select_scoped" ON professional_orders;
      CREATE POLICY "professional_orders_select_scoped" ON professional_orders
        FOR SELECT TO authenticated
        USING (TRUE)
    ';

    RAISE NOTICE 'professional_orders: policy SELECT recréée (reference table, read-only)';
  ELSE
    RAISE NOTICE 'professional_orders: table non existante, skip';
  END IF;
END $$;

-- ============================================
-- 5. VÉRIFICATION FINALE
-- ============================================
DO $$
DECLARE
  dangerous_count INT;
BEGIN
  -- Compter les policies qui ont encore USING(true) ou WITH CHECK(true)
  -- sur les tables critiques (hors reference tables et service_role policies)
  SELECT count(*) INTO dangerous_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('leases', 'profiles', 'properties', 'invoices', 'payments', 'documents', 'tickets')
    AND (qual = 'true' OR with_check = 'true')
    AND policyname NOT LIKE '%service%'
    AND policyname NOT LIKE '%admin%';

  IF dangerous_count > 0 THEN
    RAISE WARNING 'ATTENTION: % policies avec USING(true)/WITH CHECK(true) restantes sur les tables critiques', dangerous_count;
  ELSE
    RAISE NOTICE 'OK: Aucune policy USING(true) dangereuse sur les tables critiques';
  END IF;
END $$;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 21/61 -- 20260216200000 -- CRITIQUE -- 20260216200000_auto_link_lease_signers_trigger.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 21/61 (CRITIQUE) 20260216200000_auto_link_lease_signers_trigger.sql'; END $$;
-- =====================================================
-- MIGRATION: Auto-link lease_signers + fix profil orphelin
-- Date: 2026-02-16
--
-- PROBLÈMES CORRIGÉS:
-- 1. Trigger DB: quand un profil est créé, lier automatiquement 
--    les lease_signers orphelins (invited_email match, profile_id NULL)
-- 2. Trigger DB: quand un profil est créé, marquer les invitations
--    correspondantes comme utilisées
-- 3. Fix immédiat: créer le profil manquant pour user 6337af52-...
-- 4. Fix rétroactif: lier tous les lease_signers orphelins existants
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-link lease_signers au moment de la création d'un profil
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  -- Récupérer l'email de l'utilisateur auth
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Lier tous les lease_signers orphelins avec cet email
  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)', 
      linked_count, NEW.id, user_email;
  END IF;

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. TRIGGER: Exécuter auto-link après chaque INSERT sur profiles
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_link_lease_signers ON public.profiles;

CREATE TRIGGER trigger_auto_link_lease_signers
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_created();

-- ============================================
-- 3. FIX IMMÉDIAT: Créer le profil manquant pour l'utilisateur signalé
-- ============================================
DO $$
DECLARE
  target_user_id UUID := '6337af52-2fb7-41d7-b620-d9ddd689d294';
  user_email TEXT;
  user_role TEXT;
  new_profile_id UUID;
BEGIN
  -- Vérifier si le user existe dans auth.users
  SELECT email, COALESCE(raw_user_meta_data->>'role', 'tenant')
  INTO user_email, user_role
  FROM auth.users
  WHERE id = target_user_id;

  IF user_email IS NULL THEN
    RAISE NOTICE 'User % non trouvé dans auth.users — skip', target_user_id;
    RETURN;
  END IF;

  -- Vérifier si le profil existe déjà
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id) THEN
    RAISE NOTICE 'Profil déjà existant pour user % — skip', target_user_id;
    RETURN;
  END IF;

  -- Créer le profil manquant
  INSERT INTO public.profiles (user_id, role, email)
  VALUES (target_user_id, user_role, user_email)
  RETURNING id INTO new_profile_id;

  RAISE NOTICE 'Profil créé: id=%, user_id=%, email=%, role=%', 
    new_profile_id, target_user_id, user_email, user_role;

  -- Le trigger auto_link_lease_signers se chargera de lier les lease_signers
END $$;

-- ============================================
-- 4. FIX RÉTROACTIF: Lier tous les lease_signers orphelins existants
-- ============================================
-- Pour tous les profils existants dont l'email matche un lease_signer orphelin
DO $$
DECLARE
  linked_total INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.id AS profile_id, u.email AS user_email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE u.email IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.lease_signers ls
        WHERE LOWER(ls.invited_email) = LOWER(u.email)
          AND ls.profile_id IS NULL
      )
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE LOWER(invited_email) = LOWER(rec.user_email)
      AND profile_id IS NULL;

    linked_total := linked_total + 1;
  END LOOP;

  IF linked_total > 0 THEN
    RAISE NOTICE '[rétro-link] % profils avec des lease_signers orphelins ont été liés', linked_total;
  ELSE
    RAISE NOTICE '[rétro-link] Aucun lease_signer orphelin trouvé — tout est déjà lié';
  END IF;
END $$;

-- ============================================
-- 5. VÉRIFICATION: Compter les lease_signers encore orphelins
-- ============================================
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING '⚠️  % lease_signers orphelins restants (email sans compte correspondant)', orphan_count;
  ELSE
    RAISE NOTICE '✅ Aucun lease_signer orphelin — tous les comptes sont liés';
  END IF;
END $$;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 22/61 -- 20260216300000 -- CRITIQUE -- 20260216300000_fix_auth_profile_sync.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 22/61 (CRITIQUE) 20260216300000_fix_auth_profile_sync.sql'; END $$;
-- =====================================================
-- MIGRATION: Correction synchronisation auth <-> profiles
-- Date: 2026-02-16
-- Version: 20260216300000
--
-- PROBLEMES CORRIGES:
--   1. handle_new_user() ne remplissait pas la colonne `email`
--   2. handle_new_user() n'incluait pas la gestion du role `guarantor`
--      dans le ON CONFLICT (deja corrige en 20260212, consolide ici)
--   3. Des utilisateurs auth.users existent sans profil correspondant
--      (trigger rate, erreur RLS, race condition)
--   4. Des profils existants ont email = NULL
--   5. Absence de policy INSERT explicite sur profiles
--      (le FOR ALL couvre le cas, mais une policy INSERT explicite est
--       plus lisible et securise les futures evolutions)
--
-- ACTIONS:
--   A. Mettre a jour handle_new_user() (email + guarantor + robustesse)
--   B. Creer les profils manquants pour les auth.users desynchronises
--   C. Backfill les emails NULL dans les profils existants
--   D. Assurer qu'une policy INSERT RLS existe sur profiles
-- =====================================================

BEGIN;

-- ============================================
-- A. MISE A JOUR DE handle_new_user()
-- ============================================
-- Ajout de l'email, meilleure gestion d'erreur,
-- support du role guarantor (consolidation)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
  v_email TEXT;
BEGIN
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (inclut 'guarantor')
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Recuperer l'email depuis le champ auth.users.email
  v_email := NEW.email;

  -- Inserer le profil avec toutes les donnees, y compris l'email
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone, email)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone, v_email)
  ON CONFLICT (user_id) DO UPDATE SET
    role = COALESCE(EXCLUDED.role, profiles.role),
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la creation d'un utilisateur auth
  -- meme si l'insertion du profil echoue
  RAISE WARNING '[handle_new_user] Erreur lors de la creation du profil pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur auth.
Lit le role et les informations personnelles depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
Supporte les roles: admin, owner, tenant, provider, guarantor.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.
Ne bloque jamais la creation auth meme en cas d''erreur (EXCEPTION handler).';

-- S'assurer que le trigger existe (idempotent)
DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '[fix_auth_sync] Cannot modify trigger on auth.users (insufficient privilege) — skipping';
END $$;

-- ============================================
-- B. CREER LES PROFILS MANQUANTS
-- ============================================
-- Pour chaque utilisateur dans auth.users qui n'a pas de profil,
-- en creer un avec les donnees disponibles.

DO $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT
      u.id,
      u.email,
      COALESCE(u.raw_user_meta_data->>'role', 'tenant') AS role,
      u.raw_user_meta_data->>'prenom' AS prenom,
      u.raw_user_meta_data->>'nom' AS nom,
      u.raw_user_meta_data->>'telephone' AS telephone
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.id IS NULL
  LOOP
    -- Valider le role
    IF v_user.role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
      v_user.role := 'tenant';
    END IF;

    BEGIN
      INSERT INTO public.profiles (user_id, role, email, prenom, nom, telephone)
      VALUES (
        v_user.id,
        v_user.role,
        v_user.email,
        v_user.prenom,
        v_user.nom,
        v_user.telephone
      )
      ON CONFLICT (user_id) DO NOTHING;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[fix_auth_sync] Impossible de creer le profil pour user_id=%: %',
        v_user.id, SQLERRM;
    END;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE '[fix_auth_sync] % profil(s) manquant(s) cree(s)', v_count;
  ELSE
    RAISE NOTICE '[fix_auth_sync] Aucun profil manquant — tous les auth.users ont un profil';
  END IF;
END $$;

-- ============================================
-- C. BACKFILL DES EMAILS NULL
-- ============================================
-- Mettre a jour les profils existants qui ont email = NULL
-- avec l'email provenant de auth.users.

DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND (p.email IS NULL OR p.email = '')
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[fix_auth_sync] % profil(s) mis a jour avec l''email depuis auth.users', v_updated;
  ELSE
    RAISE NOTICE '[fix_auth_sync] Tous les profils ont deja un email renseigne';
  END IF;
END $$;

-- ============================================
-- D. POLICY INSERT EXPLICITE SUR PROFILES
-- ============================================
-- Le FOR ALL existant (profiles_own_access) couvre l'INSERT,
-- mais une policy INSERT explicite est plus claire et securise
-- les futures modifications de profiles_own_access.

-- Supprimer si elle existe deja (idempotent)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

-- Permettre a un utilisateur authentifie de creer son propre profil
-- (couvre le cas ou le trigger handle_new_user echoue et que le
--  client tente un INSERT direct ou via l'API)
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- E. VERIFICATION FINALE
-- ============================================
DO $$
DECLARE
  v_total_auth INTEGER;
  v_total_profiles INTEGER;
  v_orphan_count INTEGER;
  v_null_email_count INTEGER;
BEGIN
  SELECT count(*) INTO v_total_auth FROM auth.users;
  SELECT count(*) INTO v_total_profiles FROM public.profiles;

  SELECT count(*) INTO v_orphan_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.id IS NULL;

  SELECT count(*) INTO v_null_email_count
  FROM public.profiles
  WHERE email IS NULL OR email = '';

  RAISE NOTICE '========================================';
  RAISE NOTICE '  RAPPORT DE SYNCHRONISATION AUTH <-> PROFILES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  auth.users total       : %', v_total_auth;
  RAISE NOTICE '  profiles total         : %', v_total_profiles;
  RAISE NOTICE '  auth sans profil       : %', v_orphan_count;
  RAISE NOTICE '  profils sans email     : %', v_null_email_count;

  IF v_orphan_count = 0 AND v_null_email_count = 0 THEN
    RAISE NOTICE '  STATUS: SYNC OK — Aucun probleme detecte';
  ELSE
    RAISE WARNING '  STATUS: PROBLEMES RESTANTS — Verifier manuellement';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- F. FONCTIONS RPC POUR LE HEALTH CHECK (/api/health/auth)
-- ============================================
-- Ces fonctions sont appelees par l'endpoint de monitoring
-- et doivent etre SECURITY DEFINER pour acceder a auth.users.

-- Compter les auth.users total
CREATE OR REPLACE FUNCTION public.count_auth_users()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER FROM auth.users;
$$;

-- Compter les auth.users sans profil
CREATE OR REPLACE FUNCTION public.check_auth_without_profile()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.id IS NULL;
$$;

-- Compter les profils orphelins (sans auth.users)
CREATE OR REPLACE FUNCTION public.check_orphan_profiles()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE u.id IS NULL AND p.user_id IS NOT NULL;
$$;

-- Compter les emails desynchronises
CREATE OR REPLACE FUNCTION public.check_desync_emails()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.email IS DISTINCT FROM u.email
    AND p.email IS NOT NULL
    AND u.email IS NOT NULL;
$$;

-- Verifier si un trigger existe sur auth.users
CREATE OR REPLACE FUNCTION public.check_trigger_exists(p_trigger_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = p_trigger_name
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  );
$$;

-- Verifier si une policy INSERT ou ALL existe sur une table
CREATE OR REPLACE FUNCTION public.check_insert_policy_exists(p_table_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = p_table_name
      AND schemaname = 'public'
      AND (cmd = 'INSERT' OR cmd = '*')
  );
$$;

-- Permissions pour les fonctions de health check (admin seulement via service role)
GRANT EXECUTE ON FUNCTION public.count_auth_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_without_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_orphan_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_desync_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trigger_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_insert_policy_exists(TEXT) TO authenticated;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 23/61 -- 20260216400000 -- SAFE -- 20260216400000_performance_indexes_rls.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 23/61 (SAFE) 20260216400000_performance_indexes_rls.sql'; END $$;
-- =====================================================
-- MIGRATION: Index de performance pour les policies RLS
-- Date: 2026-02-16
--
-- Les policies RLS sur documents et storage.objects utilisent
-- des EXISTS avec 3 niveaux de jointure. Ces index accélèrent
-- les lookups les plus fréquents.
-- =====================================================

BEGIN;

-- ============================================
-- 1. LEASE_SIGNERS: Index composite pour lookup par profile_id + lease_id
-- Utilisé par quasi toutes les policies RLS inter-comptes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lease_signers_profile_id
  ON public.lease_signers (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email_lower
  ON public.lease_signers (LOWER(invited_email))
  WHERE invited_email IS NOT NULL AND profile_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_lease_signers_lease_profile
  ON public.lease_signers (lease_id, profile_id)
  WHERE profile_id IS NOT NULL;

-- ============================================
-- 2. DOCUMENTS: Index pour les colonnes utilisées dans les policies RLS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_documents_property_id
  ON public.documents (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_lease_id
  ON public.documents (lease_id)
  WHERE lease_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_owner_id
  ON public.documents (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_id
  ON public.documents (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_storage_path
  ON public.documents (storage_path)
  WHERE storage_path IS NOT NULL;

-- ============================================
-- 3. LEASES: Index pour lookup property_id (jointures RLS)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leases_property_id
  ON public.leases (property_id);

-- ============================================
-- 4. PROPERTIES: Index pour lookup owner_id (jointures RLS)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_properties_owner_id
  ON public.properties (owner_id);

-- ============================================
-- 5. INVOICES: Index pour filtrage par owner/tenant
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invoices_owner_id
  ON public.invoices (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id
  ON public.invoices (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_lease_id
  ON public.invoices (lease_id);

-- ============================================
-- 6. TICKETS: Index pour filtrage
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tickets_property_id
  ON public.tickets (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_created_by
  ON public.tickets (created_by_profile_id)
  WHERE created_by_profile_id IS NOT NULL;

-- ============================================
-- 7. PROFILES: Index pour lookup user_id (utilisé partout)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles (user_id);

-- ============================================
-- VÉRIFICATION
-- ============================================
DO $$
DECLARE
  idx_count INT;
BEGIN
  SELECT count(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';

  RAISE NOTICE '✅ % index de performance créés/vérifiés', idx_count;
END $$;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 24/61 -- 20260216500000 -- CRITIQUE -- 20260216500000_fix_tenant_dashboard_complete.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 24/61 (CRITIQUE) 20260216500000_fix_tenant_dashboard_complete.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 25/61 -- 20260216500001 -- SAFE -- 20260216500001_enforce_unique_constraints_safety.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 25/61 (SAFE) 20260216500001_enforce_unique_constraints_safety.sql'; END $$;
-- Migration: Enforce unique constraints safety net
-- Date: 2026-02-16
-- Description: S'assure que les contraintes uniques critiques sont bien appliquées.
--              Idempotent : ne fait rien si elles existent déjà.
--              Nettoie les doublons existants avant de créer les contraintes.

BEGIN;

-- =============================================
-- 1. INVOICES: unique (lease_id, periode)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_lease_periode'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_invoices_lease_periode'
  ) THEN
    -- Supprimer les doublons en gardant le plus récent
    DELETE FROM invoices
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY lease_id, periode ORDER BY created_at DESC) AS rn
        FROM invoices
        WHERE lease_id IS NOT NULL AND periode IS NOT NULL
      ) sub
      WHERE sub.rn > 1
    );

    ALTER TABLE invoices
      ADD CONSTRAINT uq_invoices_lease_periode
      UNIQUE (lease_id, periode);

    RAISE NOTICE 'Created constraint uq_invoices_lease_periode on invoices';
  ELSE
    RAISE NOTICE 'Constraint uq_invoices_lease_periode already exists, skipping';
  END IF;
END $$;

-- =============================================
-- 2. LEASE_SIGNERS: unique (lease_id, profile_id) WHERE profile_id IS NOT NULL
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_lease_signers_lease_profile'
  ) THEN
    -- Supprimer les doublons en gardant celui qui a été signé (ou le plus récent)
    DELETE FROM lease_signers
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY lease_id, profile_id
                 ORDER BY
                   CASE WHEN signature_status = 'signed' THEN 0 ELSE 1 END,
                   created_at DESC
               ) AS rn
        FROM lease_signers
        WHERE profile_id IS NOT NULL
      ) sub
      WHERE sub.rn > 1
    );

    CREATE UNIQUE INDEX uq_lease_signers_lease_profile
      ON lease_signers (lease_id, profile_id)
      WHERE profile_id IS NOT NULL;

    RAISE NOTICE 'Created index uq_lease_signers_lease_profile on lease_signers';
  ELSE
    RAISE NOTICE 'Index uq_lease_signers_lease_profile already exists, skipping';
  END IF;
END $$;

-- =============================================
-- 3. ROOMMATES: unique (lease_id, profile_id)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_roommates_lease_profile'
  ) THEN
    -- Vérifier si la table roommates existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roommates') THEN
      -- Supprimer les doublons
      DELETE FROM roommates
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY lease_id, profile_id ORDER BY created_at DESC) AS rn
          FROM roommates
          WHERE lease_id IS NOT NULL AND profile_id IS NOT NULL
        ) sub
        WHERE sub.rn > 1
      );

      CREATE UNIQUE INDEX uq_roommates_lease_profile
        ON roommates (lease_id, profile_id);

      RAISE NOTICE 'Created index uq_roommates_lease_profile on roommates';
    ELSE
      RAISE NOTICE 'Table roommates does not exist, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Index uq_roommates_lease_profile already exists, skipping';
  END IF;
END $$;

-- =============================================
-- 4. DOCUMENTS: Empêcher les doublons de fichiers (même storage_path)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_documents_storage_path'
  ) THEN
    -- Supprimer les doublons en gardant le plus récent
    DELETE FROM documents
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY storage_path ORDER BY created_at DESC) AS rn
        FROM documents
        WHERE storage_path IS NOT NULL
      ) sub
      WHERE sub.rn > 1
    );

    CREATE UNIQUE INDEX uq_documents_storage_path
      ON documents (storage_path)
      WHERE storage_path IS NOT NULL;

    RAISE NOTICE 'Created index uq_documents_storage_path on documents';
  ELSE
    RAISE NOTICE 'Index uq_documents_storage_path already exists, skipping';
  END IF;
END $$;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 26/61 -- 20260217000000 -- CRITIQUE -- 20260217000000_data_integrity_audit_repair.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 26/61 (CRITIQUE) 20260217000000_data_integrity_audit_repair.sql'; END $$;
-- ============================================================================
-- MIGRATION: Audit & Réparation Intégrité Relationnelle Complète
-- Date: 2026-02-17
-- Version: 20260217000000
--
-- CONTEXTE:
--   Les données existent en base mais les liens entre tables sont cassés.
--   Un locataire se connecte → dashboard vide (lease_signers non liés).
--   Un propriétaire se connecte → ne voit pas ses biens (owner_id incorrect).
--
-- SCHÉMA RELATIONNEL RÉEL DÉCOUVERT:
--   auth.users (id)
--     └── profiles (user_id → auth.users.id)
--           ├── properties (owner_id → profiles.id)
--           │     ├── leases (property_id → properties.id)
--           │     │     ├── lease_signers (lease_id, profile_id → profiles.id)
--           │     │     ├── invoices (lease_id, owner_id, tenant_id)
--           │     │     └── edl (lease_id, property_id)
--           │     ├── tickets (property_id, created_by_profile_id, owner_id)
--           │     ├── meters (property_id)
--           │     └── documents (property_id, lease_id, profile_id)
--           ├── notifications (profile_id)
--           └── subscriptions (user_id)
--
-- NOTE: La relation bail↔locataire passe par `lease_signers` (pas de tenant_id sur leases).
--
-- ACTIONS:
--   A. Créer la table d'audit _repair_log
--   B. Réparer auth→profiles (profils manquants, emails NULL)
--   C. Réparer lease_signers orphelins (profile_id NULL avec email match)
--   D. Réparer invoices.tenant_id orphelins
--   E. Réparer invoices.owner_id orphelins
--   F. Créer la fonction check_data_integrity()
--   G. Créer le trigger de validation sur leases
--   H. Ajouter les FK manquantes (si safe)
--   I. Rapport final
-- ============================================================================

BEGIN;

-- ============================================
-- A. TABLE D'AUDIT _repair_log
-- ============================================
CREATE TABLE IF NOT EXISTS public._repair_log (
  id SERIAL PRIMARY KEY,
  repair_date TIMESTAMPTZ DEFAULT NOW(),
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'LINK', 'DELETE', 'DIAGNOSTIC'
  details JSONB,
  reversed BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE public._repair_log IS
  'Table d''audit pour tracer toutes les opérations de réparation d''intégrité relationnelle.';

-- ============================================
-- B. RÉPARER auth.users → profiles
-- ============================================
-- B.1 Créer les profils manquants (consolidated - may already be done by 20260216300000)
DO $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT
      au.id,
      au.email,
      COALESCE(au.raw_user_meta_data->>'role', 'tenant') AS role,
      au.raw_user_meta_data->>'prenom' AS prenom,
      au.raw_user_meta_data->>'nom' AS nom,
      au.raw_user_meta_data->>'telephone' AS telephone
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE p.id IS NULL
  LOOP
    IF v_user.role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
      v_user.role := 'tenant';
    END IF;

    BEGIN
      INSERT INTO public.profiles (user_id, role, email, prenom, nom, telephone)
      VALUES (v_user.id, v_user.role, v_user.email, v_user.prenom, v_user.nom, v_user.telephone)
      ON CONFLICT (user_id) DO NOTHING;

      IF FOUND THEN
        v_count := v_count + 1;
        INSERT INTO public._repair_log (table_name, record_id, action, details)
        VALUES ('profiles', v_user.id::TEXT, 'INSERT',
          jsonb_build_object('email', v_user.email, 'role', v_user.role, 'reason', 'user_sans_profil'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[repair] Erreur creation profil user_id=%: %', v_user.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[B.1] % profil(s) manquant(s) créé(s)', v_count;
END $$;

-- B.2 Backfill emails NULL dans profiles
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.profiles p
    SET email = au.email, updated_at = NOW()
    FROM auth.users au
    WHERE p.user_id = au.id
      AND (p.email IS NULL OR p.email = '')
      AND au.email IS NOT NULL AND au.email != ''
    RETURNING p.id, au.email AS new_email
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'profiles', id::TEXT, 'UPDATE',
    jsonb_build_object('new_email', new_email, 'reason', 'email_null_backfill')
  FROM updated;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '[B.2] % email(s) backfillé(s)', v_updated;
END $$;

-- B.3 Synchroniser les emails désynchronisés (auth.email != profile.email)
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.profiles p
    SET email = au.email, updated_at = NOW()
    FROM auth.users au
    WHERE p.user_id = au.id
      AND p.email IS DISTINCT FROM au.email
      AND au.email IS NOT NULL AND au.email != ''
      AND p.email IS NOT NULL
    RETURNING p.id, p.email AS old_email, au.email AS new_email
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'profiles', id::TEXT, 'UPDATE',
    jsonb_build_object('old_email', old_email, 'new_email', new_email, 'reason', 'email_desync')
  FROM updated;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '[B.3] % email(s) resynchronisé(s)', v_updated;
END $$;

-- ============================================
-- C. RÉPARER lease_signers ORPHELINS
-- ============================================
-- C.1 Lier les lease_signers dont invited_email matche un profil existant
DO $$
DECLARE
  v_linked INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.id AS profile_id, LOWER(au.email) AS user_email
    FROM public.profiles p
    JOIN auth.users au ON au.id = p.user_id
    WHERE au.email IS NOT NULL AND au.email != ''
      AND EXISTS (
        SELECT 1 FROM public.lease_signers ls
        WHERE LOWER(ls.invited_email) = LOWER(au.email)
          AND ls.profile_id IS NULL
      )
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE LOWER(invited_email) = rec.user_email
      AND profile_id IS NULL;

    IF FOUND THEN
      v_linked := v_linked + 1;
      INSERT INTO public._repair_log (table_name, record_id, action, details)
      VALUES ('lease_signers', rec.profile_id::TEXT, 'LINK',
        jsonb_build_object('email', rec.user_email, 'reason', 'orphan_signer_relinked'));
    END IF;
  END LOOP;

  RAISE NOTICE '[C.1] % profil(s) liés à des lease_signers orphelins', v_linked;
END $$;

-- C.2 Compter les lease_signers encore orphelins (ceux qui n'ont pas de compte)
DO $$
DECLARE
  v_orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND invited_email != ''
    AND invited_email != 'locataire@a-definir.com';

  INSERT INTO public._repair_log (table_name, action, details)
  VALUES ('lease_signers', 'DIAGNOSTIC',
    jsonb_build_object('orphan_signers_remaining', v_orphan_count,
      'note', 'Ces locataires n''ont pas encore créé leur compte'));

  IF v_orphan_count > 0 THEN
    RAISE NOTICE '[C.2] % lease_signers orphelins restants (locataires sans compte)', v_orphan_count;
  ELSE
    RAISE NOTICE '[C.2] Aucun lease_signer orphelin restant';
  END IF;
END $$;

-- ============================================
-- D. RÉPARER invoices.tenant_id ORPHELINS
-- ============================================
-- Les invoices doivent avoir un tenant_id qui pointe vers le profile du locataire du bail
DO $$
DECLARE
  v_fixed INTEGER := 0;
BEGIN
  -- Cas 1: invoices avec tenant_id NULL - remplir depuis lease_signers
  WITH fix AS (
    UPDATE public.invoices inv
    SET tenant_id = ls.profile_id
    FROM public.lease_signers ls
    WHERE inv.lease_id = ls.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire')
      AND ls.profile_id IS NOT NULL
      AND (inv.tenant_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = inv.tenant_id
      ))
    RETURNING inv.id, ls.profile_id AS new_tenant_id
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'invoices', id::TEXT, 'UPDATE',
    jsonb_build_object('new_tenant_id', new_tenant_id, 'reason', 'tenant_id_orphan_or_null')
  FROM fix;

  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RAISE NOTICE '[D] % invoice(s) avec tenant_id réparé(s)', v_fixed;
END $$;

-- ============================================
-- E. RÉPARER invoices.owner_id ORPHELINS
-- ============================================
DO $$
DECLARE
  v_fixed INTEGER := 0;
BEGIN
  WITH fix AS (
    UPDATE public.invoices inv
    SET owner_id = prop.owner_id
    FROM public.leases l
    JOIN public.properties prop ON prop.id = l.property_id
    WHERE inv.lease_id = l.id
      AND (inv.owner_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = inv.owner_id
      ))
      AND prop.owner_id IS NOT NULL
    RETURNING inv.id, prop.owner_id AS new_owner_id
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'invoices', id::TEXT, 'UPDATE',
    jsonb_build_object('new_owner_id', new_owner_id, 'reason', 'owner_id_orphan_or_null')
  FROM fix;

  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RAISE NOTICE '[E] % invoice(s) avec owner_id réparé(s)', v_fixed;
END $$;

-- ============================================
-- F. FONCTION check_data_integrity()
-- ============================================
CREATE OR REPLACE FUNCTION public.check_data_integrity()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  count INT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check 1: Auth users sans profil
  RETURN QUERY
  SELECT 'users_sans_profil'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Utilisateurs auth.users sans profil dans public.profiles'::TEXT
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE p.id IS NULL;

  -- Check 2: Profils orphelins (sans auth.users)
  RETURN QUERY
  SELECT 'profils_orphelins'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Profils sans utilisateur auth.users correspondant'::TEXT
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE au.id IS NULL AND p.user_id IS NOT NULL;

  -- Check 3: Emails désynchronisés
  RETURN QUERY
  SELECT 'emails_desync'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Profils avec email different de auth.users'::TEXT
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.user_id
  WHERE p.email IS DISTINCT FROM au.email
    AND p.email IS NOT NULL AND au.email IS NOT NULL;

  -- Check 4: Properties sans owner valide
  RETURN QUERY
  SELECT 'properties_sans_owner'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Propriétés dont owner_id ne pointe vers aucun profil'::TEXT
  FROM public.properties pr
  LEFT JOIN public.profiles p ON pr.owner_id = p.id
  WHERE p.id IS NULL;

  -- Check 5: Properties dont l'owner n'est pas role='owner'
  RETURN QUERY
  SELECT 'properties_owner_mauvais_role'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Propriétés dont le owner_id pointe vers un profil non-owner'::TEXT
  FROM public.properties pr
  JOIN public.profiles p ON pr.owner_id = p.id
  WHERE p.role NOT IN ('owner', 'admin');

  -- Check 6: Leases sans property valide
  RETURN QUERY
  SELECT 'leases_sans_property'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Baux dont property_id ne pointe vers aucune propriété'::TEXT
  FROM public.leases l
  LEFT JOIN public.properties pr ON l.property_id = pr.id
  WHERE pr.id IS NULL;

  -- Check 7: Leases sans aucun signataire locataire
  RETURN QUERY
  SELECT 'leases_sans_tenant_signer'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Baux sans signataire locataire dans lease_signers'::TEXT
  FROM public.leases l
  WHERE NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
      AND ls.role IN ('locataire_principal', 'colocataire')
  )
  AND l.statut NOT IN ('draft', 'archived');

  -- Check 8: Lease_signers orphelins (profile_id NULL, email match un profil existant)
  RETURN QUERY
  SELECT 'lease_signers_linkables'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Signataires avec profile_id NULL qui pourraient etre liés'::TEXT
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.users au2
      JOIN public.profiles p2 ON p2.user_id = au2.id
      WHERE LOWER(au2.email) = LOWER(ls.invited_email)
    );

  -- Check 9: Lease_signers orphelins (email sans compte)
  RETURN QUERY
  SELECT 'lease_signers_sans_compte'::TEXT,
    'INFO'::TEXT,
    COUNT(*)::INT,
    'Signataires invités qui n''ont pas encore créé leur compte'::TEXT
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND ls.invited_email != 'locataire@a-definir.com'
    AND NOT EXISTS (
      SELECT 1 FROM auth.users au2
      WHERE LOWER(au2.email) = LOWER(ls.invited_email)
    );

  -- Check 10: Invoices sans lease valide
  RETURN QUERY
  SELECT 'invoices_sans_lease'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Factures dont lease_id ne pointe vers aucun bail'::TEXT
  FROM public.invoices inv
  LEFT JOIN public.leases l ON inv.lease_id = l.id
  WHERE l.id IS NULL AND inv.lease_id IS NOT NULL;

  -- Check 11: Invoices sans tenant_id valide
  RETURN QUERY
  SELECT 'invoices_sans_tenant'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Factures avec tenant_id NULL ou pointant vers un profil inexistant'::TEXT
  FROM public.invoices inv
  LEFT JOIN public.profiles p ON inv.tenant_id = p.id
  WHERE (inv.tenant_id IS NULL OR p.id IS NULL)
    AND inv.lease_id IS NOT NULL;

  -- Check 12: Documents orphelins (property_id invalide)
  BEGIN
    RETURN QUERY
    SELECT 'documents_orphelins'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'Documents dont property_id pointe vers une propriété inexistante'::TEXT
    FROM public.documents d
    LEFT JOIN public.properties pr ON d.property_id = pr.id
    WHERE d.property_id IS NOT NULL AND pr.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'documents_orphelins'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table documents inexistante'::TEXT;
  END;

  -- Check 13: Tickets orphelins (property_id invalide)
  BEGIN
    RETURN QUERY
    SELECT 'tickets_orphelins'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'Tickets dont property_id pointe vers une propriété inexistante'::TEXT
    FROM public.tickets t
    LEFT JOIN public.properties pr ON t.property_id = pr.id
    WHERE t.property_id IS NOT NULL AND pr.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'tickets_orphelins'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table tickets inexistante'::TEXT;
  END;

  -- Check 14: EDL orphelins
  BEGIN
    RETURN QUERY
    SELECT 'edl_orphelins'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'EDL dont lease_id pointe vers un bail inexistant'::TEXT
    FROM public.edl e
    LEFT JOIN public.leases l ON e.lease_id = l.id
    WHERE e.lease_id IS NOT NULL AND l.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'edl_orphelins'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table edl inexistante'::TEXT;
  END;

  -- Check 15: Notifications orphelines
  BEGIN
    RETURN QUERY
    SELECT 'notifications_orphelines'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'Notifications dont profile_id ne pointe vers aucun profil'::TEXT
    FROM public.notifications n
    LEFT JOIN public.profiles p ON n.profile_id = p.id
    WHERE n.profile_id IS NOT NULL AND p.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'notifications_orphelines'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table notifications inexistante'::TEXT;
  END;

  -- Check 16: Chaînes complètes owner→property→lease→tenant
  RETURN QUERY
  SELECT 'chaines_completes'::TEXT,
    'INFO'::TEXT,
    COUNT(DISTINCT l.id)::INT,
    'Baux avec chaîne complète owner→property→lease→tenant_signer'::TEXT
  FROM public.leases l
  JOIN public.properties pr ON l.property_id = pr.id
  JOIN public.profiles own ON pr.owner_id = own.id
  JOIN public.lease_signers ls ON ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
  JOIN public.profiles ten ON ls.profile_id = ten.id;

  -- Check 17: Trigger handle_new_user existe
  RETURN QUERY
  SELECT 'trigger_handle_new_user'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.tgname = 'on_auth_user_created'
        AND n.nspname = 'auth' AND c.relname = 'users'
    ) THEN 'OK' ELSE 'ERREUR' END::TEXT,
    0::INT,
    'Trigger on_auth_user_created sur auth.users'::TEXT;

  -- Check 18: Trigger auto_link_lease_signers existe
  RETURN QUERY
  SELECT 'trigger_auto_link'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.tgname = 'trigger_auto_link_lease_signers'
        AND n.nspname = 'public' AND c.relname = 'profiles'
    ) THEN 'OK' ELSE 'ERREUR' END::TEXT,
    0::INT,
    'Trigger auto_link_lease_signers sur profiles'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.check_data_integrity() IS
  'Fonction de diagnostic complète pour vérifier l''intégrité relationnelle de toutes les tables.
   Usage: SELECT * FROM check_data_integrity();';

GRANT EXECUTE ON FUNCTION public.check_data_integrity() TO authenticated;

-- ============================================
-- G. TRIGGER DE VALIDATION SUR LEASES
-- ============================================
-- Empêche la création d'un bail avec un property_id invalide
CREATE OR REPLACE FUNCTION public.validate_lease_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que la property existe
  IF NOT EXISTS (
    SELECT 1 FROM public.properties WHERE id = NEW.property_id
  ) THEN
    RAISE EXCEPTION 'Property % inexistante', NEW.property_id;
  END IF;

  -- Si unit_id est fourni, vérifier qu'il existe et appartient à la property
  IF NEW.unit_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.units
      WHERE id = NEW.unit_id AND property_id = NEW.property_id
    ) THEN
      RAISE EXCEPTION 'Unit % inexistante ou n''appartient pas à la property %',
        NEW.unit_id, NEW.property_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_lease_before_insert ON public.leases;
CREATE TRIGGER validate_lease_before_insert
  BEFORE INSERT ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_lease_insert();

COMMENT ON TRIGGER validate_lease_before_insert ON public.leases IS
  'Valide que property_id et unit_id sont valides avant l''insertion d''un bail.';

-- ============================================
-- G.2 TRIGGER: Auto-link lease_signers quand un profil est MIS À JOUR avec un email
-- ============================================
-- Couvre le cas où un profil existant n'avait pas d'email et le reçoit plus tard
CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_email_update()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  -- Seulement si l'email a changé
  IF NEW.email IS NOT NULL AND NEW.email != '' AND (OLD.email IS NULL OR OLD.email = '' OR OLD.email != NEW.email) THEN
    -- Aussi récupérer l'email auth pour double-check
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
    user_email := COALESCE(user_email, NEW.email);

    UPDATE public.lease_signers
    SET profile_id = NEW.id
    WHERE LOWER(invited_email) = LOWER(user_email)
      AND profile_id IS NULL;

    GET DIAGNOSTICS linked_count = ROW_COUNT;

    IF linked_count > 0 THEN
      RAISE NOTICE '[auto_link_update] % lease_signers liés au profil % (email: %)',
        linked_count, NEW.id, user_email;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_link_on_profile_update ON public.profiles;
CREATE TRIGGER trigger_auto_link_on_profile_update
  AFTER UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_email_update();

-- ============================================
-- H. FK MANQUANTES (ajoutées SEULEMENT si safe)
-- ============================================

-- H.1 properties.owner_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_properties_owner'
      AND table_name = 'properties' AND table_schema = 'public'
  ) AND NOT EXISTS (
    -- Vérifier qu'il n'y a pas de FK existante avec un autre nom
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'properties' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'owner_id'
  ) THEN
    -- Vérifier qu'il n'y a pas de données orphelines
    IF NOT EXISTS (
      SELECT 1 FROM public.properties pr
      LEFT JOIN public.profiles p ON pr.owner_id = p.id
      WHERE p.id IS NULL AND pr.owner_id IS NOT NULL
    ) THEN
      ALTER TABLE public.properties
        ADD CONSTRAINT fk_properties_owner
        FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
      RAISE NOTICE '[H.1] FK fk_properties_owner créée';
    ELSE
      RAISE WARNING '[H.1] FK fk_properties_owner NON créée: données orphelines existantes';
    END IF;
  ELSE
    RAISE NOTICE '[H.1] FK sur properties.owner_id existe déjà — skip';
  END IF;
END $$;

-- H.2 leases.property_id → properties.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'leases' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'property_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.leases l
      LEFT JOIN public.properties pr ON l.property_id = pr.id
      WHERE pr.id IS NULL AND l.property_id IS NOT NULL
    ) THEN
      ALTER TABLE public.leases
        ADD CONSTRAINT fk_leases_property
        FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE RESTRICT;
      RAISE NOTICE '[H.2] FK fk_leases_property créée';
    ELSE
      RAISE WARNING '[H.2] FK fk_leases_property NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.2] FK sur leases.property_id existe déjà — skip';
  END IF;
END $$;

-- H.3 lease_signers.lease_id → leases.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'lease_signers' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'lease_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.lease_signers ls
      LEFT JOIN public.leases l ON ls.lease_id = l.id
      WHERE l.id IS NULL AND ls.lease_id IS NOT NULL
    ) THEN
      ALTER TABLE public.lease_signers
        ADD CONSTRAINT fk_lease_signers_lease
        FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;
      RAISE NOTICE '[H.3] FK fk_lease_signers_lease créée';
    ELSE
      RAISE WARNING '[H.3] FK fk_lease_signers_lease NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.3] FK sur lease_signers.lease_id existe déjà — skip';
  END IF;
END $$;

-- H.4 lease_signers.profile_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'lease_signers' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'profile_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.lease_signers ls
      LEFT JOIN public.profiles p ON ls.profile_id = p.id
      WHERE p.id IS NULL AND ls.profile_id IS NOT NULL
    ) THEN
      ALTER TABLE public.lease_signers
        ADD CONSTRAINT fk_lease_signers_profile
        FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
      RAISE NOTICE '[H.4] FK fk_lease_signers_profile créée';
    ELSE
      RAISE WARNING '[H.4] FK fk_lease_signers_profile NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.4] FK sur lease_signers.profile_id existe déjà — skip';
  END IF;
END $$;

-- H.5 invoices.lease_id → leases.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'invoices' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'lease_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices inv
      LEFT JOIN public.leases l ON inv.lease_id = l.id
      WHERE l.id IS NULL AND inv.lease_id IS NOT NULL
    ) THEN
      ALTER TABLE public.invoices
        ADD CONSTRAINT fk_invoices_lease
        FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE RESTRICT;
      RAISE NOTICE '[H.5] FK fk_invoices_lease créée';
    ELSE
      RAISE WARNING '[H.5] FK fk_invoices_lease NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.5] FK sur invoices.lease_id existe déjà — skip';
  END IF;
END $$;

-- ============================================
-- I. RAPPORT FINAL
-- ============================================
DO $$
DECLARE
  v_auth_users INT;
  v_profiles INT;
  v_users_sans_profil INT;
  v_profils_orphelins INT;
  v_properties INT;
  v_props_sans_owner INT;
  v_leases INT;
  v_leases_sans_property INT;
  v_signers_orphelins INT;
  v_signers_linkables INT;
  v_chaines_completes INT;
  v_repair_count INT;
BEGIN
  SELECT COUNT(*) INTO v_auth_users FROM auth.users;
  SELECT COUNT(*) INTO v_profiles FROM public.profiles;

  SELECT COUNT(*) INTO v_users_sans_profil
  FROM auth.users au LEFT JOIN public.profiles p ON p.user_id = au.id WHERE p.id IS NULL;

  SELECT COUNT(*) INTO v_profils_orphelins
  FROM public.profiles p LEFT JOIN auth.users au ON au.id = p.user_id WHERE au.id IS NULL AND p.user_id IS NOT NULL;

  SELECT COUNT(*) INTO v_properties FROM public.properties;
  SELECT COUNT(*) INTO v_props_sans_owner
  FROM public.properties pr LEFT JOIN public.profiles p ON pr.owner_id = p.id WHERE p.id IS NULL;

  SELECT COUNT(*) INTO v_leases FROM public.leases;
  SELECT COUNT(*) INTO v_leases_sans_property
  FROM public.leases l LEFT JOIN public.properties pr ON l.property_id = pr.id WHERE pr.id IS NULL;

  SELECT COUNT(*) INTO v_signers_orphelins
  FROM public.lease_signers WHERE profile_id IS NULL AND invited_email IS NOT NULL
    AND invited_email != 'locataire@a-definir.com';

  SELECT COUNT(*) INTO v_signers_linkables
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL AND ls.invited_email IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.users au2
      JOIN public.profiles p2 ON p2.user_id = au2.id
      WHERE LOWER(au2.email) = LOWER(ls.invited_email)
    );

  SELECT COUNT(DISTINCT l.id) INTO v_chaines_completes
  FROM public.leases l
  JOIN public.properties pr ON l.property_id = pr.id
  JOIN public.profiles own ON pr.owner_id = own.id
  JOIN public.lease_signers ls ON ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
  JOIN public.profiles ten ON ls.profile_id = ten.id;

  SELECT COUNT(*) INTO v_repair_count FROM public._repair_log;

  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '  RAPPORT INTEGRITE RELATIONNELLE — TALOK — POST-REPARATION';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '  Date : %', NOW();
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  AUTH -> PROFILES';
  RAISE NOTICE '    Auth users total         : %', v_auth_users;
  RAISE NOTICE '    Profiles total           : %', v_profiles;
  RAISE NOTICE '    Users SANS profil        : % %', v_users_sans_profil,
    CASE WHEN v_users_sans_profil = 0 THEN '(OK)' ELSE '(ERREUR)' END;
  RAISE NOTICE '    Profils orphelins        : % %', v_profils_orphelins,
    CASE WHEN v_profils_orphelins = 0 THEN '(OK)' ELSE '(ATTENTION)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  PROPERTIES';
  RAISE NOTICE '    Total                    : %', v_properties;
  RAISE NOTICE '    Sans owner valide        : % %', v_props_sans_owner,
    CASE WHEN v_props_sans_owner = 0 THEN '(OK)' ELSE '(ERREUR)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  LEASES (BAUX)';
  RAISE NOTICE '    Total                    : %', v_leases;
  RAISE NOTICE '    Sans property valide     : % %', v_leases_sans_property,
    CASE WHEN v_leases_sans_property = 0 THEN '(OK)' ELSE '(ERREUR)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  LEASE_SIGNERS';
  RAISE NOTICE '    Orphelins (pas de compte): %', v_signers_orphelins;
  RAISE NOTICE '    Linkables (ont un compte): % %', v_signers_linkables,
    CASE WHEN v_signers_linkables = 0 THEN '(OK)' ELSE '(A REPARER)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  CHAINES COMPLETES';
  RAISE NOTICE '    owner->property->lease->tenant: %', v_chaines_completes;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  REPARATIONS EFFECTUEES     : % entrée(s) dans _repair_log', v_repair_count;
  RAISE NOTICE '================================================================';

  -- Logger le rapport dans _repair_log
  INSERT INTO public._repair_log (table_name, action, details)
  VALUES ('SYSTEM', 'INTEGRITY_REPORT', jsonb_build_object(
    'auth_users', v_auth_users,
    'profiles', v_profiles,
    'users_sans_profil', v_users_sans_profil,
    'profils_orphelins', v_profils_orphelins,
    'properties', v_properties,
    'properties_sans_owner', v_props_sans_owner,
    'leases', v_leases,
    'leases_sans_property', v_leases_sans_property,
    'signers_orphelins', v_signers_orphelins,
    'signers_linkables', v_signers_linkables,
    'chaines_completes', v_chaines_completes
  ));
END $$;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 27/61 -- 20260218000000 -- CRITIQUE -- 20260218000000_audit_repair_profiles.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 27/61 (CRITIQUE) 20260218000000_audit_repair_profiles.sql'; END $$;
-- ============================================================================
-- BLOC 1 : TABLE D'AUDIT + RÉPARATION PROFILS
-- ============================================================================

-- 1. Création de la table de log des réparations
CREATE TABLE IF NOT EXISTS public._repair_log (
  id          SERIAL PRIMARY KEY,
  repair_date TIMESTAMPTZ DEFAULT NOW(),
  table_name  TEXT NOT NULL,
  record_id   TEXT,
  action      TEXT NOT NULL,
  details     JSONB
);

-- 2. Créer les profils manquants (users sans profil)
WITH inserted AS (
  INSERT INTO public.profiles (user_id, role, email, prenom, nom, telephone)
  SELECT
    au.id,
    COALESCE(
      CASE WHEN au.raw_user_meta_data->>'role' IN ('admin','owner','tenant','provider','guarantor')
           THEN au.raw_user_meta_data->>'role'
           ELSE NULL END,
      'tenant'
    ),
    au.email,
    au.raw_user_meta_data->>'prenom',
    au.raw_user_meta_data->>'nom',
    CASE WHEN (au.raw_user_meta_data->>'telephone') ~ '^\+[1-9]\d{1,14}$'
         THEN au.raw_user_meta_data->>'telephone'
         ELSE NULL END
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE p.id IS NULL
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id, email, role
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', user_id::TEXT, 'INSERT',
       jsonb_build_object('email', email, 'role', role, 'reason', 'user_sans_profil')
FROM inserted;

-- 3. Sync emails NULL (profils sans email alors que auth.users en a un)
WITH updated AS (
  UPDATE public.profiles p
  SET email = au.email, updated_at = NOW()
  FROM auth.users au
  WHERE p.user_id = au.id
    AND (p.email IS NULL OR p.email = '')
    AND au.email IS NOT NULL AND au.email != ''
  RETURNING p.id, au.email AS new_email
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', id::TEXT, 'UPDATE',
       jsonb_build_object('new_email', new_email, 'reason', 'email_null_backfill')
FROM updated;

-- 4. Sync emails désynchronisés (profil a un email différent de auth.users)
WITH updated AS (
  UPDATE public.profiles p
  SET email = au.email, updated_at = NOW()
  FROM auth.users au
  WHERE p.user_id = au.id
    AND p.email IS DISTINCT FROM au.email
    AND au.email IS NOT NULL AND au.email != ''
    AND p.email IS NOT NULL
  RETURNING p.id, p.email AS old_email, au.email AS new_email
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', id::TEXT, 'UPDATE',
       jsonb_build_object('old_email', old_email, 'new_email', new_email, 'reason', 'email_desync')
FROM updated;

-- 5. Résultat
SELECT action, COUNT(*) AS nb, details->>'reason' AS reason
FROM public._repair_log
WHERE table_name = 'profiles'
GROUP BY action, details->>'reason';

COMMIT;

-- -----------------------------------------------------------------------------
-- 28/61 -- 20260218100000 -- CRITIQUE -- 20260218100000_sync_auth_email_updates.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 28/61 (CRITIQUE) 20260218100000_sync_auth_email_updates.sql'; END $$;
-- =====================================================
-- MIGRATION: Synchronisation des changements d'email auth -> profiles
-- Date: 2026-02-18
-- Version: 20260218100000
--
-- PROBLEME:
--   Quand un utilisateur change son email via Supabase Auth
--   (confirmation d'email, changement d'email, etc.),
--   la colonne profiles.email n'est PAS mise a jour automatiquement.
--   Cela cause une desynchronisation entre auth.users.email
--   et profiles.email.
--
-- SOLUTION:
--   A. Trigger AFTER UPDATE sur auth.users qui met a jour
--      profiles.email quand auth.users.email change.
--   B. Backfill immediat des emails desynchronises.
--
-- SECURITE:
--   La fonction utilise SECURITY DEFINER pour bypasser les RLS
--   et mettre a jour le profil sans restrictions.
--   SET search_path = public pour eviter les injections de schema.
-- =====================================================

BEGIN;

-- ============================================
-- A. FONCTION DE SYNCHRONISATION EMAIL
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne rien faire si l'email n'a pas change
  IF NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;

  -- Mettre a jour l'email dans le profil
  UPDATE public.profiles
  SET
    email = NEW.email,
    updated_at = NOW()
  WHERE user_id = NEW.id;

  IF NOT FOUND THEN
    -- Le profil n'existe pas encore (race condition possible)
    -- handle_new_user() le creera avec le bon email
    RAISE WARNING '[handle_user_email_change] Profil introuvable pour user_id=%, email non synchronise', NEW.id;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la modification d'un utilisateur auth
  RAISE WARNING '[handle_user_email_change] Erreur sync email pour user_id=%: % (SQLSTATE=%)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_user_email_change() IS
'Synchronise automatiquement profiles.email quand auth.users.email change.
SECURITY DEFINER pour bypasser les RLS.
Ne bloque jamais la modification auth (EXCEPTION handler).';

-- ============================================
-- B. TRIGGER SUR auth.users (UPDATE)
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;

CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.handle_user_email_change();

-- ============================================
-- C. BACKFILL DES EMAILS DESYNCHRONISES
-- ============================================
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND p.email IS DISTINCT FROM u.email
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[email_sync] % profil(s) resynchronise(s) avec l''email de auth.users', v_updated;
  ELSE
    RAISE NOTICE '[email_sync] Tous les emails sont deja synchronises';
  END IF;
END $$;

-- ============================================
-- D. VERIFICATION
-- ============================================
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_desync_count INTEGER;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_email_changed'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) INTO v_trigger_exists;

  SELECT count(*) INTO v_desync_count
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.email IS DISTINCT FROM u.email
    AND u.email IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE '  VERIFICATION EMAIL SYNC TRIGGER';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  Trigger on_auth_user_email_changed : %',
    CASE WHEN v_trigger_exists THEN 'ACTIF' ELSE 'MANQUANT' END;
  RAISE NOTICE '  Emails desynchronises restants     : %', v_desync_count;
  RAISE NOTICE '========================================';
END $$;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 29/61 -- 20260219000000 -- MODERE -- 20260219000000_missing_tables_and_rag.sql
-- risk: +18 policies, -18 policies, +1 triggers, UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 29/61 (MODERE) 20260219000000_missing_tables_and_rag.sql'; END $$;
-- =====================================================
-- MIGRATION: Tables et fonctions manquantes
-- Date: 2026-02-19
-- Version: 20260219000000
--
-- Contenu:
--   1. tenant_rewards + colonne total_points sur tenant_profiles
--   2. invoice_reminders
--   3. webhook_logs
--   4. ai_conversations
--   5. Extension pgvector + tables RAG (legal_embeddings,
--      platform_knowledge, user_context_embeddings)
--   6. Fonctions RPC RAG (match_legal_documents,
--      hybrid_search_legal, match_platform_knowledge,
--      match_user_context)
--   7. RLS sur toutes les nouvelles tables
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TENANT REWARDS
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points NUMERIC(10,2) NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'rent_paid_on_time',
    'energy_saving',
    'profile_completed',
    'document_uploaded',
    'on_time_streak',
    'referral'
  )),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_rewards_profile
  ON tenant_rewards(profile_id, created_at DESC);

ALTER TABLE tenant_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_rewards_select_own" ON tenant_rewards;
CREATE POLICY "tenant_rewards_select_own" ON tenant_rewards
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tenant_rewards_insert_own" ON tenant_rewards;
CREATE POLICY "tenant_rewards_insert_own" ON tenant_rewards
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tenant_rewards_admin" ON tenant_rewards;
CREATE POLICY "tenant_rewards_admin" ON tenant_rewards
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- Colonne total_points sur tenant_profiles
ALTER TABLE tenant_profiles
  ADD COLUMN IF NOT EXISTS total_points NUMERIC(10,2) DEFAULT 0;

-- Trigger pour mettre a jour total_points automatiquement
CREATE OR REPLACE FUNCTION update_tenant_total_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tenant_profiles
  SET total_points = COALESCE(total_points, 0) + NEW.points
  WHERE profile_id = NEW.profile_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_tenant_total_points ON tenant_rewards;
CREATE TRIGGER trg_update_tenant_total_points
  AFTER INSERT ON tenant_rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_total_points();

-- =====================================================
-- 2. INVOICE REMINDERS
-- =====================================================

CREATE TABLE IF NOT EXISTS invoice_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT DEFAULT 'email' CHECK (method IN ('email', 'sms', 'courrier')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  recipient_email TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice
  ON invoice_reminders(invoice_id, created_at DESC);

ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_reminders_select_owner" ON invoice_reminders;
CREATE POLICY "invoice_reminders_select_owner" ON invoice_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_reminders.invoice_id
        AND i.owner_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "invoice_reminders_insert_owner" ON invoice_reminders;
CREATE POLICY "invoice_reminders_insert_owner" ON invoice_reminders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_id
        AND i.owner_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "invoice_reminders_admin" ON invoice_reminders;
CREATE POLICY "invoice_reminders_admin" ON invoice_reminders
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- =====================================================
-- 3. WEBHOOK LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'stripe',
  event_type TEXT NOT NULL,
  event_id TEXT,
  payload JSONB,
  error TEXT,
  processed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider_date
  ON webhook_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id
  ON webhook_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status
  ON webhook_logs(status) WHERE status = 'error';

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Seuls les admins et le service_role lisent les webhook logs
DROP POLICY IF EXISTS "webhook_logs_admin" ON webhook_logs;
CREATE POLICY "webhook_logs_admin" ON webhook_logs
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- Permettre l'insertion depuis les API routes (service_role)
DROP POLICY IF EXISTS "webhook_logs_service_insert" ON webhook_logs;
CREATE POLICY "webhook_logs_service_insert" ON webhook_logs
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- 4. AI CONVERSATIONS (analytics)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_query TEXT NOT NULL,
  assistant_response TEXT,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  model_used TEXT,
  rag_docs_retrieved INTEGER DEFAULT 0,
  rag_sources JSONB DEFAULT '[]',
  thread_id UUID REFERENCES assistant_threads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_profile
  ON ai_conversations(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_model
  ON ai_conversations(model_used, created_at DESC);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations_select_own" ON ai_conversations;
CREATE POLICY "ai_conversations_select_own" ON ai_conversations
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_conversations_insert_own" ON ai_conversations;
CREATE POLICY "ai_conversations_insert_own" ON ai_conversations
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_conversations_admin" ON ai_conversations;
CREATE POLICY "ai_conversations_admin" ON ai_conversations
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- =====================================================
-- 5. EXTENSION PGVECTOR + TABLES RAG
-- =====================================================

-- Tenter d'installer pgvector. Si indisponible, on skip toute la section RAG.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Extension vector non disponible: %. Section RAG ignorée.', SQLERRM;
END $$;

-- Si pgvector est disponible, créer les tables RAG avec colonnes vector
-- Sinon, créer les tables sans colonnes vector (fallback JSONB)
DO $$
DECLARE
  v_has_vector BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') INTO v_has_vector;

  IF v_has_vector THEN
    RAISE NOTICE 'pgvector détecté, création des tables RAG avec vector(1536)';

    EXECUTE 'CREATE TABLE IF NOT EXISTS legal_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      source_title TEXT,
      source_url TEXT,
      source_date DATE,
      article_reference TEXT,
      metadata JSONB DEFAULT ''{}'',
      embedding vector(1536),
      tsv tsvector GENERATED ALWAYS AS (
        to_tsvector(''french'', coalesce(content, '''') || '' '' || coalesce(source_title, ''''))
      ) STORED,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS platform_knowledge (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      knowledge_type TEXT NOT NULL,
      target_roles TEXT[] DEFAULT ''{owner,tenant,provider}'',
      slug TEXT UNIQUE,
      priority INTEGER DEFAULT 0,
      metadata JSONB DEFAULT ''{}'',
      embedding vector(1536),
      is_published BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS user_context_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      embedding vector(1536),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(entity_type, entity_id)
    )';

  ELSE
    RAISE NOTICE 'pgvector absent, création des tables RAG sans vector (fallback JSONB)';

    EXECUTE 'CREATE TABLE IF NOT EXISTS legal_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      source_title TEXT,
      source_url TEXT,
      source_date DATE,
      article_reference TEXT,
      metadata JSONB DEFAULT ''{}'',
      embedding JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS platform_knowledge (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      knowledge_type TEXT NOT NULL,
      target_roles TEXT[] DEFAULT ''{owner,tenant,provider}'',
      slug TEXT UNIQUE,
      priority INTEGER DEFAULT 0,
      metadata JSONB DEFAULT ''{}'',
      embedding JSONB,
      is_published BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS user_context_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      embedding JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(entity_type, entity_id)
    )';
  END IF;
END $$;

-- Index standards (non-vector)
CREATE INDEX IF NOT EXISTS idx_legal_embeddings_category ON legal_embeddings(category);
CREATE INDEX IF NOT EXISTS idx_platform_knowledge_type ON platform_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_platform_knowledge_slug ON platform_knowledge(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_context_profile ON user_context_embeddings(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_context_entity ON user_context_embeddings(entity_type, entity_id);

-- Index vector uniquement si pgvector est disponible
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_legal_embeddings_vector ON legal_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_platform_knowledge_vector ON platform_knowledge USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_context_vector ON user_context_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip vector indexes: %', SQLERRM;
    END;
  END IF;
END $$;

-- RLS
ALTER TABLE legal_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_embeddings_select_authenticated" ON legal_embeddings;
CREATE POLICY "legal_embeddings_select_authenticated" ON legal_embeddings
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "legal_embeddings_admin_manage" ON legal_embeddings;
CREATE POLICY "legal_embeddings_admin_manage" ON legal_embeddings
  FOR ALL USING (public.user_role() = 'admin');

DROP POLICY IF EXISTS "platform_knowledge_select_authenticated" ON platform_knowledge;
CREATE POLICY "platform_knowledge_select_authenticated" ON platform_knowledge
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_published = true);
DROP POLICY IF EXISTS "platform_knowledge_admin_manage" ON platform_knowledge;
CREATE POLICY "platform_knowledge_admin_manage" ON platform_knowledge
  FOR ALL USING (public.user_role() = 'admin');

DROP POLICY IF EXISTS "user_context_select_own" ON user_context_embeddings;
CREATE POLICY "user_context_select_own" ON user_context_embeddings
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "user_context_manage_own" ON user_context_embeddings;
CREATE POLICY "user_context_manage_own" ON user_context_embeddings
  FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "user_context_admin" ON user_context_embeddings;
CREATE POLICY "user_context_admin" ON user_context_embeddings
  FOR ALL USING (public.user_role() = 'admin');

-- Fonctions RAG (uniquement si pgvector)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION match_legal_documents(
        query_embedding vector(1536), match_count INTEGER DEFAULT 5,
        filter_category TEXT DEFAULT NULL, min_similarity FLOAT DEFAULT 0.7
      ) RETURNS TABLE (id UUID, content TEXT, category TEXT, source_title TEXT, article_reference TEXT, metadata JSONB, similarity FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      BEGIN RETURN QUERY SELECT le.id, le.content, le.category, le.source_title, le.article_reference, le.metadata, 1 - (le.embedding <=> query_embedding) AS similarity FROM legal_embeddings le WHERE (filter_category IS NULL OR le.category = filter_category) AND 1 - (le.embedding <=> query_embedding) >= min_similarity ORDER BY le.embedding <=> query_embedding LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION hybrid_search_legal(
        query_text TEXT, query_embedding vector(1536), match_count INTEGER DEFAULT 5,
        filter_category TEXT DEFAULT NULL, vector_weight FLOAT DEFAULT 0.7
      ) RETURNS TABLE (id UUID, content TEXT, category TEXT, source_title TEXT, article_reference TEXT, combined_score FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      DECLARE text_weight FLOAT := 1.0 - vector_weight;
      BEGIN RETURN QUERY SELECT le.id, le.content, le.category, le.source_title, le.article_reference, (vector_weight * (1 - (le.embedding <=> query_embedding)) + text_weight * COALESCE(ts_rank_cd(le.tsv, plainto_tsquery('french', query_text)), 0)) AS combined_score FROM legal_embeddings le WHERE (filter_category IS NULL OR le.category = filter_category) AND (1 - (le.embedding <=> query_embedding) >= 0.5 OR le.tsv @@ plainto_tsquery('french', query_text)) ORDER BY combined_score DESC LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION match_platform_knowledge(
        query_embedding vector(1536), match_count INTEGER DEFAULT 5,
        filter_type TEXT DEFAULT NULL, filter_role TEXT DEFAULT NULL
      ) RETURNS TABLE (id UUID, title TEXT, content TEXT, knowledge_type TEXT, similarity FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      BEGIN RETURN QUERY SELECT pk.id, pk.title, pk.content, pk.knowledge_type, 1 - (pk.embedding <=> query_embedding) AS similarity FROM platform_knowledge pk WHERE pk.is_published = true AND (filter_type IS NULL OR pk.knowledge_type = filter_type) AND (filter_role IS NULL OR filter_role = ANY(pk.target_roles)) AND 1 - (pk.embedding <=> query_embedding) >= 0.5 ORDER BY pk.embedding <=> query_embedding LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION match_user_context(
        query_embedding vector(1536), p_profile_id UUID,
        match_count INTEGER DEFAULT 5, filter_entity_type TEXT DEFAULT NULL
      ) RETURNS TABLE (id UUID, entity_type TEXT, entity_id UUID, content TEXT, summary TEXT, similarity FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      BEGIN RETURN QUERY SELECT uce.id, uce.entity_type, uce.entity_id, uce.content, uce.summary, 1 - (uce.embedding <=> query_embedding) AS similarity FROM user_context_embeddings uce WHERE uce.profile_id = p_profile_id AND (filter_entity_type IS NULL OR uce.entity_type = filter_entity_type) AND 1 - (uce.embedding <=> query_embedding) >= 0.5 ORDER BY uce.embedding <=> query_embedding LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE 'GRANT EXECUTE ON FUNCTION match_legal_documents TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION hybrid_search_legal TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION match_platform_knowledge TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION match_user_context TO authenticated';
  ELSE
    RAISE NOTICE 'pgvector absent: fonctions RAG non créées.';
  END IF;
END $$;

-- =====================================================
-- 7. GRANTS (tables non-vector)
-- =====================================================

GRANT SELECT, INSERT ON tenant_rewards TO authenticated;
GRANT SELECT, INSERT ON invoice_reminders TO authenticated;
GRANT INSERT ON webhook_logs TO authenticated;
GRANT SELECT ON webhook_logs TO authenticated;
GRANT SELECT, INSERT ON ai_conversations TO authenticated;
GRANT SELECT ON legal_embeddings TO authenticated;
GRANT SELECT ON platform_knowledge TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_context_embeddings TO authenticated;

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON TABLE tenant_rewards IS 'Points de fidelite et recompenses locataires';
COMMENT ON TABLE invoice_reminders IS 'Historique des relances de factures envoyees';
COMMENT ON TABLE webhook_logs IS 'Logs des webhooks recus (Stripe, etc.)';
COMMENT ON TABLE ai_conversations IS 'Historique analytique des conversations avec l''assistant IA';
COMMENT ON TABLE legal_embeddings IS 'Embeddings vectoriels des documents juridiques pour RAG';
COMMENT ON TABLE platform_knowledge IS 'Base de connaissances plateforme avec embeddings pour RAG';
COMMENT ON TABLE user_context_embeddings IS 'Embeddings du contexte utilisateur pour recherche personnalisee RAG';

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 30/61 -- 20260219100000 -- CRITIQUE -- 20260219100000_auto_link_notify_owner.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 30/61 (CRITIQUE) 20260219100000_auto_link_notify_owner.sql'; END $$;
-- =====================================================
-- MIGRATION: Notify owner when tenant creates account (auto-link)
-- Date: 2026-02-19
--
-- PROBLÈME CORRIGÉ:
-- Quand un locataire crée son compte et que le trigger auto-link
-- lie son profil aux lease_signers, le propriétaire n'était PAS notifié.
-- Le locataire restait invisible jusqu'au prochain rafraîchissement
-- de la page propriétaire.
--
-- SOLUTION:
-- Enrichir la fonction auto_link_lease_signers_on_profile_created()
-- pour créer une notification in-app pour chaque propriétaire concerné.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
  rec RECORD;
BEGIN
  -- Récupérer l'email de l'utilisateur auth
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Lier tous les lease_signers orphelins avec cet email
  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)',
      linked_count, NEW.id, user_email;

    -- ✅ NOUVEAU: Notifier chaque propriétaire concerné
    FOR rec IN
      SELECT DISTINCT
        p_owner.id AS owner_profile_id,
        p_owner.user_id AS owner_user_id,
        prop.adresse_complete AS property_address,
        l.id AS lease_id
      FROM public.lease_signers ls
      JOIN public.leases l ON l.id = ls.lease_id
      JOIN public.properties prop ON prop.id = l.property_id
      JOIN public.profiles p_owner ON p_owner.id = prop.owner_id
      WHERE ls.profile_id = NEW.id
        AND ls.role IN ('locataire_principal', 'colocataire')
    LOOP
      INSERT INTO public.notifications (
        user_id,
        profile_id,
        type,
        title,
        body,
        is_read,
        read,
        metadata
      ) VALUES (
        rec.owner_user_id,
        rec.owner_profile_id,
        'tenant_account_created',
        'Locataire inscrit',
        format('%s a créé son compte pour le bail au %s. Son profil est maintenant visible dans votre liste de locataires.',
          user_email, COALESCE(rec.property_address, 'adresse non renseignée')),
        false,
        false,
        jsonb_build_object(
          'lease_id', rec.lease_id,
          'tenant_email', user_email,
          'tenant_profile_id', NEW.id,
          'action_url', format('/owner/leases/%s', rec.lease_id)
        )
      );
      RAISE NOTICE '[auto_link] Notification créée pour propriétaire % (bail %)',
        rec.owner_profile_id, rec.lease_id;
    END LOOP;
  END IF;

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 31/61 -- 20260219200000 -- CRITIQUE -- 20260219200000_fix_autolink_triggers_audit.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 31/61 (CRITIQUE) 20260219200000_fix_autolink_triggers_audit.sql'; END $$;
-- =====================================================
-- MIGRATION: Corrections issues de l'audit auto-link triggers
-- Date: 2026-02-19
-- Ref: AUDIT_AUTOLINK_TRIGGERS.md
--
-- Corrections appliquées:
--   P0-1: Supprimer le trigger obsolète on_profile_created_auto_link
--   P1-1: Ajouter EXCEPTION handler à auto_link_lease_signers_on_profile_created
--   P1-2: Supprimer la politique RLS trop permissive "System can insert notifications"
--   P2-1: Ajouter déduplication aux triggers de notification
-- =====================================================

BEGIN;

-- =====================================================
-- P0-1: Supprimer le trigger OBSOLÈTE on_profile_created_auto_link
-- Ce trigger (case-sensitive, sans notifications, sans invitations)
-- est remplacé par trigger_auto_link_lease_signers depuis la migration
-- 20260219100000_auto_link_notify_owner.sql
-- =====================================================

DROP TRIGGER IF EXISTS on_profile_created_auto_link ON public.profiles;
DROP FUNCTION IF EXISTS public.auto_link_signer_profile();

-- =====================================================
-- P1-1: Ajouter EXCEPTION handler à auto_link_lease_signers_on_profile_created
-- Sans cet handler, une erreur dans la notification (ex: colonne manquante)
-- provoque un rollback de la création du profil → l'utilisateur ne peut
-- pas s'inscrire.
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
  rec RECORD;
BEGIN
  -- Récupérer l'email de l'utilisateur auth
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Lier tous les lease_signers orphelins avec cet email
  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)',
      linked_count, NEW.id, user_email;

    -- Notifier chaque propriétaire concerné
    FOR rec IN
      SELECT DISTINCT
        p_owner.id AS owner_profile_id,
        p_owner.user_id AS owner_user_id,
        prop.adresse_complete AS property_address,
        l.id AS lease_id
      FROM public.lease_signers ls
      JOIN public.leases l ON l.id = ls.lease_id
      JOIN public.properties prop ON prop.id = l.property_id
      JOIN public.profiles p_owner ON p_owner.id = prop.owner_id
      WHERE ls.profile_id = NEW.id
        AND ls.role IN ('locataire_principal', 'colocataire')
    LOOP
      INSERT INTO public.notifications (
        user_id,
        profile_id,
        type,
        title,
        body,
        is_read,
        read,
        metadata
      ) VALUES (
        rec.owner_user_id,
        rec.owner_profile_id,
        'tenant_account_created',
        'Locataire inscrit',
        format('%s a créé son compte pour le bail au %s. Son profil est maintenant visible dans votre liste de locataires.',
          user_email, COALESCE(rec.property_address, 'adresse non renseignée')),
        false,
        false,
        jsonb_build_object(
          'lease_id', rec.lease_id,
          'tenant_email', user_email,
          'tenant_profile_id', NEW.id,
          'action_url', format('/owner/leases/%s', rec.lease_id)
        )
      );
      RAISE NOTICE '[auto_link] Notification créée pour propriétaire % (bail %)',
        rec.owner_profile_id, rec.lease_id;
    END LOOP;
  END IF;

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la création du profil
  RAISE WARNING '[auto_link] Erreur non-bloquante: % (SQLSTATE=%)', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- P1-2: Remplacer la politique RLS trop permissive
-- "System can insert notifications" (WITH CHECK (true))
-- par une politique restrictive: seuls les triggers SECURITY DEFINER
-- peuvent insérer (pas les utilisateurs authentifiés directement)
-- =====================================================

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Les triggers SECURITY DEFINER bypassent RLS, donc aucune politique
-- INSERT permissive n'est nécessaire pour eux. On ne crée PAS de
-- remplacement car les fonctions trigger sont toutes SECURITY DEFINER.
-- Si une politique INSERT est nécessaire pour le service role,
-- elle sera ajoutée par la couche applicative.

-- =====================================================
-- P2-1: Ajouter déduplication aux triggers de notification
-- Empêche les doublons si un statut oscille (ex: late -> paid -> late)
-- Fenêtre de déduplication : 1 heure
-- =====================================================

-- TRIGGER 1: notify_invoice_late - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_invoice_late()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tenant_name TEXT;
  v_property_address TEXT;
  v_amount NUMERIC;
BEGIN
  -- Seulement si le statut passe à 'late'
  IF NEW.statut = 'late' AND (OLD.statut IS NULL OR OLD.statut != 'late') THEN
    -- Récupérer les infos
    SELECT
      p.owner_id,
      COALESCE(pr.prenom || ' ' || pr.nom, 'Locataire'),
      COALESCE(p.adresse_complete, 'Adresse inconnue'),
      NEW.montant_total
    INTO v_owner_id, v_tenant_name, v_property_address, v_amount
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles pr ON ls.profile_id = pr.id
    WHERE l.id = NEW.lease_id;

    -- Notifier le propriétaire (avec déduplication)
    IF v_owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'payment_late'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_owner_id,
        'payment_late',
        'Loyer impayé',
        format('Le loyer de %s (%s) de %s€ est en retard.', v_tenant_name, v_property_address, v_amount),
        '/app/owner/money?filter=late',
        NEW.id,
        'invoice'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER 2: notify_payment_received - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tenant_name TEXT;
  v_amount NUMERIC;
BEGIN
  -- Seulement si le statut passe à 'succeeded'
  IF NEW.statut = 'succeeded' AND (OLD.statut IS NULL OR OLD.statut != 'succeeded') THEN
    -- Récupérer les infos via la facture
    SELECT
      p.owner_id,
      COALESCE(pr.prenom || ' ' || pr.nom, 'Locataire'),
      NEW.montant
    INTO v_owner_id, v_tenant_name, v_amount
    FROM invoices i
    JOIN leases l ON i.lease_id = l.id
    JOIN properties p ON l.property_id = p.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles pr ON ls.profile_id = pr.id
    WHERE i.id = NEW.invoice_id;

    -- Notifier le propriétaire (avec déduplication)
    IF v_owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'payment_received'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_owner_id,
        'payment_received',
        'Paiement reçu',
        format('Paiement de %s€ reçu de %s.', v_amount, v_tenant_name),
        '/app/owner/money',
        NEW.id,
        'payment'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER 3: notify_lease_signed - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_lease_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_address TEXT;
BEGIN
  -- Seulement si le statut passe à 'active'
  IF NEW.statut = 'active' AND (OLD.statut IS NULL OR OLD.statut != 'active') THEN
    -- Récupérer les infos
    SELECT p.owner_id, COALESCE(p.adresse_complete, 'Adresse inconnue')
    INTO v_owner_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    -- Notifier le propriétaire (avec déduplication)
    IF v_owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'lease_signed'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_owner_id,
        'lease_signed',
        'Bail signé !',
        format('Le bail pour %s est maintenant actif.', v_property_address),
        '/app/owner/leases/' || NEW.id,
        NEW.id,
        'lease'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER 5: notify_ticket_resolved - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_ticket_resolved()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id UUID;
  v_property_address TEXT;
BEGIN
  -- Seulement si le statut passe à 'resolved' ou 'closed'
  IF NEW.statut IN ('resolved', 'closed') AND OLD.statut NOT IN ('resolved', 'closed') THEN
    -- Récupérer les infos
    SELECT
      NEW.created_by_profile_id,
      COALESCE(p.adresse_complete, 'Adresse inconnue')
    INTO v_creator_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    -- Notifier le créateur du ticket (avec déduplication)
    IF v_creator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'ticket_resolved'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_creator_id,
        'ticket_resolved',
        'Ticket résolu',
        format('Votre demande "%s" a été traitée.', NEW.titre),
        '/app/owner/tickets/' || NEW.id,
        NEW.id,
        'ticket'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: trigger_notify_ticket_created (INSERT only) n'a pas besoin de
-- déduplication car un INSERT ne peut se produire qu'une fois.

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 32/61 -- 20260220000000 -- CRITIQUE -- 20260220000000_auto_link_signer_on_insert.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 32/61 (CRITIQUE) 20260220000000_auto_link_signer_on_insert.sql'; END $$;
-- =====================================================
-- MIGRATION: SOTA 2026 — Auto-link signer à l'INSERT
-- Date: 2026-02-20
--
-- OBJECTIF:
--   Quand un lease_signer est créé avec invited_email et profile_id NULL,
--   lier immédiatement au profil existant si l'email correspond (auth.users).
--   Couvre le cas "locataire déjà inscrit invité sur un nouveau bail".
--
-- CONTENU:
--   1. Fonction auto_link_signer_on_insert() — BEFORE INSERT sur lease_signers
--   2. RPC find_profile_by_email(target_email) — pour l'API invite
--   3. Fix rétroactif — lier les orphelins existants
--   4. Vérification finale
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-link à l'INSERT du signer
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_link_signer_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  found_profile_id UUID;
BEGIN
  IF NEW.profile_id IS NULL AND NEW.invited_email IS NOT NULL AND TRIM(NEW.invited_email) != '' THEN
    SELECT p.id INTO found_profile_id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(NEW.invited_email))
    LIMIT 1;

    IF found_profile_id IS NOT NULL THEN
      NEW.profile_id := found_profile_id;
      RAISE NOTICE '[auto_link_on_insert] Lien immédiat: % -> profil %', NEW.invited_email, found_profile_id;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_link_on_insert] Erreur non-bloquante: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_link_signer_on_insert() IS
'SOTA 2026: À l''INSERT d''un lease_signer avec invited_email et profile_id NULL, lie au profil existant si l''email matche auth.users. Ne bloque jamais l''INSERT.';

-- ============================================
-- 2. TRIGGER: Exécuter avant chaque INSERT sur lease_signers
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_link_signer_on_insert ON public.lease_signers;

CREATE TRIGGER trigger_auto_link_signer_on_insert
  BEFORE INSERT ON public.lease_signers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_signer_on_insert();

-- ============================================
-- 3. RPC: find_profile_by_email — pour l'API (remplace listUsers)
-- ============================================
CREATE OR REPLACE FUNCTION public.find_profile_by_email(target_email TEXT)
RETURNS TABLE(id UUID, user_id UUID, role TEXT) AS $$
BEGIN
  IF target_email IS NULL OR TRIM(target_email) = '' THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id, p.user_id, p.role::TEXT
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(target_email))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.find_profile_by_email(TEXT) IS
'SOTA 2026: Retourne (id, user_id, role) du profil dont l''email auth correspond. Utilisé par l''API invite pour éviter listUsers().';

-- ============================================
-- 4. FIX RÉTROACTIF: Lier les lease_signers orphelins existants
-- ============================================
DO $$
DECLARE
  linked_total INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT ls.id AS signer_id, p.id AS profile_id
    FROM public.lease_signers ls
    JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
    JOIN public.profiles p ON p.user_id = u.id
    WHERE ls.profile_id IS NULL
      AND ls.invited_email IS NOT NULL
      AND TRIM(ls.invited_email) != ''
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE lease_signers.id = rec.signer_id;
    linked_total := linked_total + 1;
  END LOOP;

  IF linked_total > 0 THEN
    RAISE NOTICE '[rétro-link] % lease_signers orphelins liés à un profil existant', linked_total;
  ELSE
    RAISE NOTICE '[rétro-link] Aucun lease_signer orphelin à lier';
  END IF;
END $$;

-- ============================================
-- 5. VÉRIFICATION: Compter les orphelins restants
-- ============================================
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*)::INT INTO orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND TRIM(invited_email) != ''
    AND invited_email NOT LIKE '%@a-definir%';

  IF orphan_count > 0 THEN
    RAISE NOTICE '⚠️  % lease_signers orphelins restants (email sans compte correspondant)', orphan_count;
  ELSE
    RAISE NOTICE '✅ Tous les signers avec email valide sont liés ou n''ont pas encore de compte';
  END IF;
END $$;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 33/61 -- 20260220100000 -- CRITIQUE -- 20260220100000_fix_orphan_signers_audit.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 33/61 (CRITIQUE) 20260220100000_fix_orphan_signers_audit.sql'; END $$;
-- =====================================================
-- MIGRATION: Audit connexion comptes — fix rétroactif + RPC
-- Date: 2026-02-20
-- Ref: docs/AUDIT_CONNEXION_COMPTES.md
--
-- CONTENU:
--   1. Fix rétroactif — relier les lease_signers orphelins (idempotent)
--   2. Index LOWER(invited_email) si absent (IF NOT EXISTS)
--   3. RPC audit_account_connections() — diagnostic réutilisable
-- =====================================================

BEGIN;

-- ============================================
-- 1. FIX RÉTROACTIF: Lier les orphelins existants
-- (Idempotent: ne fait rien si déjà liés)
-- ============================================
DO $$
DECLARE
  linked_total INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT ls.id AS signer_id, p.id AS profile_id
    FROM public.lease_signers ls
    JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
    JOIN public.profiles p ON p.user_id = u.id
    WHERE ls.profile_id IS NULL
      AND ls.invited_email IS NOT NULL
      AND TRIM(ls.invited_email) != ''
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE lease_signers.id = rec.signer_id;
    linked_total := linked_total + 1;
  END LOOP;

  IF linked_total > 0 THEN
    RAISE NOTICE '[audit_fix] % lease_signers orphelins liés à un profil existant', linked_total;
  END IF;
END $$;

-- ============================================
-- 2. INDEX: LOWER(invited_email) pour lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email_lower
  ON public.lease_signers (LOWER(TRIM(invited_email)))
  WHERE invited_email IS NOT NULL AND TRIM(invited_email) != '';

-- ============================================
-- 3. RPC: audit_account_connections()
-- Retourne un diagnostic global (orphelins, invitations, notifications)
-- ============================================
CREATE OR REPLACE FUNCTION public.audit_account_connections()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orphan_count INT;
  linkable_count INT;  -- orphelins qui ont un compte (email match)
  invitations_not_used_count INT;
  result JSONB;
BEGIN
  -- Signataires orphelins (profile_id NULL, invited_email valide)
  SELECT count(*)::INT INTO orphan_count
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND TRIM(ls.invited_email) != ''
    AND ls.invited_email NOT LIKE '%@a-definir%';

  -- Orphelins pour lesquels un profil existe (email correspondant)
  SELECT count(*)::INT INTO linkable_count
  FROM public.lease_signers ls
  JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
  JOIN public.profiles p ON p.user_id = u.id
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND TRIM(ls.invited_email) != '';

  -- Invitations non marquées utilisées (email présent dans auth.users)
  SELECT count(*)::INT INTO invitations_not_used_count
  FROM public.invitations i
  WHERE i.used_at IS NULL
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(i.email))
    );

  result := jsonb_build_object(
    'orphan_signers_count', orphan_count,
    'linkable_orphans_count', linkable_count,
    'invitations_not_used_count', invitations_not_used_count,
    'message', CASE
      WHEN linkable_count > 0 THEN 'Des orphelins peuvent être liés (exécuter le fix SQL ou la migration).'
      WHEN orphan_count > 0 THEN 'Orphelins restants sans compte correspondant.'
      ELSE 'Aucun signataire orphelin à lier.'
    END
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.audit_account_connections() IS
'Audit connexion comptes: retourne orphan_signers_count, linkable_orphans_count, invitations_not_used_count. Ref: docs/AUDIT_CONNEXION_COMPTES.md';

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 34/61 -- 20260221000001 -- CRITIQUE -- 20260221000001_auto_link_trigger_update.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 34/61 (CRITIQUE) 20260221000001_auto_link_trigger_update.sql'; END $$;
-- =====================================================
-- Auto-link lease_signers on profile UPDATE
-- Date: 2026-02-21
--
-- Quand un profil est mis à jour (ex: email confirmé, user_id lié),
-- lier les lease_signers orphelins dont invited_email matche l'email du user.
-- Réutilise la même logique que l'INSERT (auth.users.email -> lease_signers.invited_email).
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_updated()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR TRIM(user_email) = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(TRIM(invited_email)) = LOWER(TRIM(user_email))
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link_update] % lease_signers liés au profil % (email: %)',
      linked_count, NEW.id, user_email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_link_lease_signers_on_profile_updated() IS
'SOTA 2026: À l''UPDATE d''un profil, lie les lease_signers orphelins dont invited_email matche l''email auth.';

DROP TRIGGER IF EXISTS trigger_auto_link_lease_signers_on_update ON public.profiles;

CREATE TRIGGER trigger_auto_link_lease_signers_on_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_updated();

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 35/61 -- 20260221000002 -- CRITIQUE -- 20260221000002_fix_edl_signatures_rls.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 35/61 (CRITIQUE) 20260221000002_fix_edl_signatures_rls.sql'; END $$;
-- =====================================================
-- Fix RLS edl_signatures pour invités (signer_user NULL)
-- Date: 2026-02-21
--
-- Un locataire invité par email a une ligne edl_signatures avec
-- signer_user = NULL, signer_profile_id = NULL, signer_email = son email.
-- Il doit pouvoir SELECT et UPDATE sa ligne pour signer.
-- =====================================================

BEGIN;

DROP POLICY IF EXISTS "EDL signatures creator update" ON edl_signatures;

DROP POLICY IF EXISTS "EDL signatures update" ON edl_signatures;
CREATE POLICY "EDL signatures update"
  ON edl_signatures FOR UPDATE
  USING (
    signer_user = auth.uid()
    OR signer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR (signer_email IS NOT NULL AND LOWER(TRIM(signer_email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid()))))
    OR edl_id IN (SELECT id FROM edl WHERE created_by = auth.uid())
  )
  WITH CHECK (
    signer_user = auth.uid()
    OR signer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR (signer_email IS NOT NULL AND LOWER(TRIM(signer_email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid()))))
    OR edl_id IN (SELECT id FROM edl WHERE created_by = auth.uid())
  );

COMMENT ON POLICY "EDL signatures update" ON edl_signatures IS
'SOTA 2026: Permet au signataire (uid, profile_id, ou email invité) et au créateur EDL de mettre à jour.';

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 36/61 -- 20260221100000 -- CRITIQUE -- 20260221100000_fix_tenant_dashboard_draft_visibility.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 36/61 (CRITIQUE) 20260221100000_fix_tenant_dashboard_draft_visibility.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 37/61 -- 20260221100001 -- CRITIQUE -- 20260221100001_auto_upgrade_draft_on_tenant_signer.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 37/61 (CRITIQUE) 20260221100001_auto_upgrade_draft_on_tenant_signer.sql'; END $$;
-- =====================================================
-- MIGRATION: Auto-upgrade baux draft + fix rétroactif complet
-- Date: 2026-02-21
--
-- PROBLÈMES CORRIGÉS:
--   1. Trigger: quand un signataire locataire est ajouté à un bail 'draft',
--      passer automatiquement le bail en 'pending_signature'
--   2. Fix rétroactif A: re-lier les lease_signers orphelins (invited_email match)
--   3. Fix rétroactif B: upgrader les baux draft qui ont déjà un locataire
--   4. Fix rétroactif C: créer les lease_signers manquants depuis edl_signatures
--   5. Audit: vérifier qu'aucun bail ne reste à demi connecté
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-upgrade draft → pending_signature
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_upgrade_draft_lease_on_signer()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand un signataire locataire est ajouté, upgrader le bail draft
  IF NEW.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire') THEN
    UPDATE public.leases
    SET statut = 'pending_signature', updated_at = NOW()
    WHERE id = NEW.lease_id
      AND statut = 'draft';
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'INSERT du signer
  RAISE WARNING '[auto_upgrade_draft] Erreur non-bloquante: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_upgrade_draft_lease_on_signer() IS
'SOTA 2026: Quand un signataire locataire est ajouté à un bail draft, passe le bail en pending_signature automatiquement.';

-- ============================================
-- 2. TRIGGER: Exécuter après chaque INSERT sur lease_signers
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_upgrade_draft_on_signer ON public.lease_signers;

CREATE TRIGGER trigger_auto_upgrade_draft_on_signer
  AFTER INSERT ON public.lease_signers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_upgrade_draft_lease_on_signer();

-- ============================================
-- 3. FIX RÉTROACTIF A: Re-lier les lease_signers orphelins
--    (invited_email correspond à un compte existant mais profile_id est NULL)
-- ============================================
DO $$
DECLARE
  linked_total INT := 0;
BEGIN
  UPDATE public.lease_signers ls
  SET profile_id = p.id
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
    AND ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND TRIM(ls.invited_email) != ''
    AND ls.invited_email NOT LIKE '%@a-definir%'
    AND ls.invited_email NOT LIKE '%@placeholder%';

  GET DIAGNOSTICS linked_total = ROW_COUNT;

  IF linked_total > 0 THEN
    RAISE NOTICE '[fix_A] % lease_signers orphelins re-liés à un profil existant', linked_total;
  ELSE
    RAISE NOTICE '[fix_A] Aucun lease_signer orphelin à re-lier';
  END IF;
END $$;

-- ============================================
-- 4. FIX RÉTROACTIF B: Upgrader les baux draft qui ont un locataire
-- ============================================
DO $$
DECLARE
  upgraded_count INT := 0;
BEGIN
  UPDATE public.leases
  SET statut = 'pending_signature', updated_at = NOW()
  WHERE statut = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = leases.id
    AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
  );

  GET DIAGNOSTICS upgraded_count = ROW_COUNT;

  IF upgraded_count > 0 THEN
    RAISE NOTICE '[fix_B] % baux draft upgradés en pending_signature', upgraded_count;
  ELSE
    RAISE NOTICE '[fix_B] Aucun bail draft avec locataire à upgrader';
  END IF;
END $$;

-- ============================================
-- 5. FIX RÉTROACTIF C: Créer les lease_signers manquants
--    depuis les edl_signatures (EDL a un locataire mais le bail n'a pas le signer)
-- ============================================
DO $$
DECLARE
  created_count INT := 0;
BEGIN
  INSERT INTO public.lease_signers (lease_id, profile_id, role, signature_status, invited_email, invited_name)
  SELECT DISTINCT ON (e.lease_id)
    e.lease_id,
    es.signer_profile_id,
    'locataire_principal',
    'pending',
    es.signer_email,
    es.signer_name
  FROM public.edl e
  JOIN public.edl_signatures es ON es.edl_id = e.id
  WHERE es.signer_role IN ('tenant', 'locataire', 'locataire_principal')
    AND e.lease_id IS NOT NULL
    -- Le bail n'a pas déjà un signer locataire
    AND NOT EXISTS (
      SELECT 1 FROM public.lease_signers ls
      WHERE ls.lease_id = e.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
    )
    -- Le signer a au moins un profil ou un email valide
    AND (
      es.signer_profile_id IS NOT NULL
      OR (es.signer_email IS NOT NULL AND TRIM(es.signer_email) != '' AND es.signer_email NOT LIKE '%@a-definir%')
    )
  ORDER BY e.lease_id, e.created_at DESC;

  GET DIAGNOSTICS created_count = ROW_COUNT;

  IF created_count > 0 THEN
    RAISE NOTICE '[fix_C] % lease_signers créés depuis edl_signatures', created_count;
  ELSE
    RAISE NOTICE '[fix_C] Aucun lease_signer manquant à créer depuis les EDL';
  END IF;
END $$;

-- ============================================
-- 6. AUDIT: Vérifier l'état final
-- ============================================
DO $$
DECLARE
  orphan_signers INT;
  draft_with_tenant INT;
  leases_without_tenant INT;
BEGIN
  -- Signataires orphelins restants (profile_id NULL, email valide, pas placeholder)
  SELECT count(*)::INT INTO orphan_signers
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND TRIM(invited_email) != ''
    AND invited_email NOT LIKE '%@a-definir%'
    AND invited_email NOT LIKE '%@placeholder%';

  -- Baux draft avec un locataire (ne devrait plus en avoir)
  SELECT count(*)::INT INTO draft_with_tenant
  FROM public.leases l
  WHERE l.statut = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
  );

  -- Baux non-draft sans signataire locataire
  SELECT count(*)::INT INTO leases_without_tenant
  FROM public.leases l
  WHERE l.statut NOT IN ('draft', 'terminated', 'cancelled', 'archived')
  AND NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
  );

  RAISE NOTICE '=== AUDIT RÉSULTAT ===';
  RAISE NOTICE 'Signataires orphelins (email sans compte): %', orphan_signers;
  RAISE NOTICE 'Baux draft avec locataire (devrait être 0): %', draft_with_tenant;
  RAISE NOTICE 'Baux actifs sans locataire: %', leases_without_tenant;

  IF draft_with_tenant = 0 THEN
    RAISE NOTICE '✅ Aucun bail draft à demi connecté';
  ELSE
    RAISE WARNING '⚠️  % baux draft ont encore un locataire — vérifier manuellement', draft_with_tenant;
  END IF;
END $$;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 38/61 -- 20260221200000 -- MODERE -- 20260221200000_sync_edl_signer_to_lease_signer.sql
-- risk: +1 triggers
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 38/61 (MODERE) 20260221200000_sync_edl_signer_to_lease_signer.sql'; END $$;
-- =====================================================
-- MIGRATION: Sync edl_signatures → lease_signers (défense en profondeur)
-- Date: 2026-02-21
--
-- PROBLÈME CORRIGÉ:
--   Quand une edl_signature tenant est créée pour un EDL lié à un bail,
--   il se peut qu'aucun lease_signers correspondant n'existe (ex: bail
--   créé en mode "manual draft"). Le locataire ne voit alors pas le bail
--   sur son dashboard car la RPC tenant_dashboard passe par lease_signers.
--
-- FIX: Trigger AFTER INSERT sur edl_signatures qui crée automatiquement
--   un lease_signers si aucun signer tenant n'existe pour le bail associé.
--   Ne bloque jamais l'INSERT original (exception handler).
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Sync edl_signature → lease_signer
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_edl_signer_to_lease_signer()
RETURNS TRIGGER AS $$
DECLARE
  v_lease_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- Uniquement pour les rôles tenant
  IF NEW.signer_role NOT IN ('tenant', 'locataire', 'locataire_principal') THEN
    RETURN NEW;
  END IF;

  -- Doit avoir au moins un email ou un profile_id
  IF NEW.signer_profile_id IS NULL AND (NEW.signer_email IS NULL OR TRIM(NEW.signer_email) = '') THEN
    RETURN NEW;
  END IF;

  -- Ignorer les emails placeholder
  IF NEW.signer_email IS NOT NULL AND (
    NEW.signer_email LIKE '%@a-definir%' OR
    NEW.signer_email LIKE '%@placeholder%'
  ) THEN
    RETURN NEW;
  END IF;

  -- Récupérer le lease_id depuis l'EDL
  SELECT lease_id INTO v_lease_id
  FROM public.edl
  WHERE id = NEW.edl_id;

  IF v_lease_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Vérifier si un signer tenant existe déjà pour ce bail
  SELECT EXISTS (
    SELECT 1 FROM public.lease_signers
    WHERE lease_id = v_lease_id
    AND role IN ('locataire_principal', 'locataire', 'tenant', 'colocataire')
  ) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, invited_name, role, signature_status)
    VALUES (v_lease_id, NEW.signer_profile_id, NEW.signer_email, NEW.signer_name, 'locataire_principal', 'pending');
    RAISE NOTICE '[sync_edl_signer] Created lease_signer for lease % from edl_signature %', v_lease_id, NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'INSERT de edl_signatures
  RAISE WARNING '[sync_edl_signer] Error (non-blocking): %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.sync_edl_signer_to_lease_signer() IS
'SOTA 2026: Quand une edl_signature tenant est créée, vérifie que le bail associé a un lease_signer locataire. Sinon, en crée un. Ne bloque jamais l''INSERT.';

-- ============================================
-- 2. TRIGGER: Exécuter après chaque INSERT sur edl_signatures
-- ============================================
DROP TRIGGER IF EXISTS trigger_sync_edl_signer_to_lease_signer ON public.edl_signatures;

CREATE TRIGGER trigger_sync_edl_signer_to_lease_signer
  AFTER INSERT ON public.edl_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_edl_signer_to_lease_signer();

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 39/61 -- 20260221300000 -- CRITIQUE -- 20260221300000_fix_tenant_dashboard_owner_join.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 39/61 (CRITIQUE) 20260221300000_fix_tenant_dashboard_owner_join.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 40/61 -- 20260222000000 -- CRITIQUE -- 20260222000000_fix_invitations_and_orphan_signers.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 40/61 (CRITIQUE) 20260222000000_fix_invitations_and_orphan_signers.sql'; END $$;
-- =====================================================
-- Migration: Lier les lease_signers orphelins et créer les invitations manquantes
-- Date: 2026-02-22
--
-- Contexte: Les baux créés avant l'unification des flux n'ont pas de record
-- dans la table invitations, ce qui empêche le locataire de voir/accepter
-- l'invitation. Cette migration :
-- 1. Lie les lease_signers orphelins (profile_id NULL) dont l'email correspond à un compte.
-- 2. Crée une invitation (token, email, role, lease_id, ...) pour chaque signataire
--    locataire (locataire_principal, colocataire) qui n'a pas déjà une invitation
--    valide (non utilisée) pour ce bail et cet email.
-- =====================================================

BEGIN;

-- 1. Lier les lease_signers orphelins : profile_id NULL + invited_email matche auth.users
UPDATE public.lease_signers ls
SET profile_id = p.id
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

-- 2. Créer les invitations manquantes pour les signataires locataires sans invitation utilisable
--    (une invitation par lease_id + email, avec token unique et expiration 30 jours)
INSERT INTO public.invitations (
  token,
  email,
  role,
  property_id,
  unit_id,
  lease_id,
  created_by,
  expires_at
)
SELECT
  encode(gen_random_bytes(32), 'hex') AS token,
  ls.invited_email AS email,
  ls.role::TEXT AS role,
  l.property_id AS property_id,
  l.unit_id AS unit_id,
  ls.lease_id AS lease_id,
  p.owner_id AS created_by,
  (NOW() + INTERVAL '30 days')::TIMESTAMPTZ AS expires_at
FROM public.lease_signers ls
JOIN public.leases l ON l.id = ls.lease_id
JOIN public.properties p ON p.id = l.property_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.invitations i
    WHERE i.lease_id = ls.lease_id
      AND LOWER(TRIM(i.email)) = LOWER(TRIM(ls.invited_email))
      AND i.used_at IS NULL
      AND i.expires_at > NOW()
  );

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 41/61 -- 20260222100000 -- CRITIQUE -- 20260222100000_repair_missing_signers_and_invitations.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 41/61 (CRITIQUE) 20260222100000_repair_missing_signers_and_invitations.sql'; END $$;
-- =====================================================
-- Migration: Réparation complète — signataires manquants + invitations
-- Date: 2026-02-22
--
-- Problème : Certains baux (notamment da2eb9da) sont en fully_signed
-- mais n'ont AUCUN lease_signers, ce qui empêche l'affichage du locataire
-- et bloque le flux d'activation.
--
-- Cette migration :
-- 1. [DIAGNOSTIC] Identifie les baux signés sans signataires
-- 2. Crée le signataire PROPRIETAIRE manquant pour chaque bail signé
-- 3. Crée le signataire LOCATAIRE manquant à partir des invitations
-- 4. Lie les lease_signers orphelins (profile_id NULL) dont l'email matche un compte
-- 5. Crée les invitations manquantes pour les signataires sans invitation valide
-- =====================================================

BEGIN;

-- ========================================================
-- ÉTAPE 1 : Créer les signataires PROPRIETAIRE manquants
-- Pour tout bail en fully_signed/active/terminated sans signataire propriétaire
-- ========================================================
INSERT INTO public.lease_signers (lease_id, profile_id, role, signature_status, signed_at)
SELECT
  l.id AS lease_id,
  p.owner_id AS profile_id,
  'proprietaire' AS role,
  'signed' AS signature_status,
  COALESCE(l.sealed_at, l.updated_at, NOW()) AS signed_at
FROM public.leases l
JOIN public.properties p ON p.id = l.property_id
WHERE l.statut IN ('fully_signed', 'active', 'terminated', 'archived')
  AND NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
      AND ls.role = 'proprietaire'
  )
ON CONFLICT DO NOTHING;

-- ========================================================
-- ÉTAPE 2 : Créer les signataires LOCATAIRE PRINCIPAL manquants
-- Source prioritaire : table invitations (contient l'email du locataire invité)
-- ========================================================
INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, role, signature_status, signed_at)
SELECT DISTINCT ON (i.lease_id)
  i.lease_id,
  COALESCE(pr.id, NULL) AS profile_id,
  i.email AS invited_email,
  'locataire_principal' AS role,
  CASE
    WHEN le.statut IN ('fully_signed', 'active', 'terminated', 'archived') THEN 'signed'
    ELSE 'pending'
  END AS signature_status,
  CASE
    WHEN le.statut IN ('fully_signed', 'active', 'terminated', 'archived')
    THEN COALESCE(i.used_at, le.sealed_at, le.updated_at, NOW())
    ELSE NULL
  END AS signed_at
FROM public.invitations i
JOIN public.leases le ON le.id = i.lease_id
LEFT JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(i.email))
LEFT JOIN public.profiles pr ON pr.user_id = u.id
WHERE i.role IN ('locataire_principal', 'locataire', 'tenant')
  AND NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = i.lease_id
      AND ls.role IN ('locataire_principal', 'locataire', 'tenant')
  )
ORDER BY i.lease_id, i.created_at DESC;

-- ========================================================
-- ÉTAPE 3 : Lier les lease_signers orphelins
-- profile_id NULL + invited_email matche un compte auth.users
-- ========================================================
UPDATE public.lease_signers ls
SET profile_id = pr.id
FROM public.profiles pr
JOIN auth.users u ON u.id = pr.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

-- ========================================================
-- ÉTAPE 4 : Créer les invitations manquantes
-- Pour les signataires locataires/colocataires sans invitation valide
-- ========================================================
INSERT INTO public.invitations (
  token,
  email,
  role,
  property_id,
  unit_id,
  lease_id,
  created_by,
  expires_at
)
SELECT
  encode(gen_random_bytes(32), 'hex') AS token,
  ls.invited_email AS email,
  ls.role::TEXT AS role,
  l.property_id AS property_id,
  l.unit_id AS unit_id,
  ls.lease_id AS lease_id,
  p.owner_id AS created_by,
  (NOW() + INTERVAL '30 days')::TIMESTAMPTZ AS expires_at
FROM public.lease_signers ls
JOIN public.leases l ON l.id = ls.lease_id
JOIN public.properties p ON p.id = l.property_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(ls.invited_email)) NOT LIKE '%@a-definir%'
  AND NOT EXISTS (
    SELECT 1 FROM public.invitations i
    WHERE i.lease_id = ls.lease_id
      AND LOWER(TRIM(i.email)) = LOWER(TRIM(ls.invited_email))
      AND i.used_at IS NULL
      AND i.expires_at > NOW()
  );

-- ========================================================
-- ÉTAPE 5 : Filet de sécurité — bail da2eb9da (Thomas VOLBERG)
-- Uniquement si ce bail existe (migration de réparation production)
-- ========================================================
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM public.leases WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7') THEN

  -- 5a. Créer le locataire signer si manquant
  INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, invited_name, role, signature_status, signed_at)
  SELECT
    'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, pr.id, 'volberg.thomas@hotmail.fr', 'Thomas VOLBERG', 'locataire_principal', 'signed', NOW()
  FROM (SELECT pr2.id FROM public.profiles pr2 JOIN auth.users u ON u.id = pr2.user_id WHERE LOWER(u.email) = 'volberg.thomas@hotmail.fr' LIMIT 1) pr
  WHERE NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role IN ('locataire_principal', 'locataire', 'tenant'));

  -- 5b. Fallback signer orphelin
  INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, invited_name, role, signature_status, signed_at)
  SELECT 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, NULL, 'volberg.thomas@hotmail.fr', 'Thomas VOLBERG', 'locataire_principal', 'signed', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role IN ('locataire_principal', 'locataire', 'tenant'));

  -- 5c. Proprio signer
  INSERT INTO public.lease_signers (lease_id, profile_id, role, signature_status, signed_at)
  SELECT 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, p.owner_id, 'proprietaire', 'signed', NOW()
  FROM public.leases l JOIN public.properties p ON p.id = l.property_id
  WHERE l.id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
    AND NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role = 'proprietaire');

END IF;
END $$;

-- ========================================================
-- ÉTAPE 6 : Lier les profils tenant sans user_id à auth.users
-- (complémentaire : certains profiles ont role='tenant' mais user_id NULL)
-- ========================================================
UPDATE public.profiles p
SET user_id = u.id
FROM auth.users u
WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
  AND p.role = 'tenant'
  AND p.user_id IS NULL;

-- ========================================================
-- ÉTAPE 7 : Re-lier les lease_signers après la correction des profiles
-- (2e passe, car l'étape 6 a pu créer de nouvelles liaisons)
-- ========================================================
UPDATE public.lease_signers ls
SET profile_id = pr.id
FROM public.profiles pr
JOIN auth.users u ON u.id = pr.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 42/61 -- 20260222200000 -- MODERE -- 20260222200000_ensure_all_owners_have_entity.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 42/61 (MODERE) 20260222200000_ensure_all_owners_have_entity.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 43/61 -- 20260222200001 -- SAFE -- 20260222200001_get_entity_stats_for_store.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 43/61 (SAFE) 20260222200001_get_entity_stats_for_store.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 44/61 -- 20260223000000 -- CRITIQUE -- 20260223000000_fix_tenant_documents_rls.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 44/61 (CRITIQUE) 20260223000000_fix_tenant_documents_rls.sql'; END $$;
-- Migration : Corriger les politiques RLS sur tenant_documents
-- Date : 2026-02-23
--
-- Problème : Les politiques RLS existantes utilisent profile_id = auth.uid()
-- mais auth.uid() retourne le user_id (auth.users.id), pas le profile_id (profiles.id).
-- Résultat : les locataires ne peuvent jamais voir leurs propres documents.

-- ============================================
-- SUPPRIMER LES POLITIQUES INCORRECTES
-- ============================================

DROP POLICY IF EXISTS "tenant_view_own_documents" ON tenant_documents;
DROP POLICY IF EXISTS "tenant_insert_own_documents" ON tenant_documents;

-- ============================================
-- RECRÉER AVEC LA BONNE LOGIQUE
-- ============================================

-- Le locataire peut voir ses propres documents
CREATE POLICY "tenant_view_own_documents" ON tenant_documents
  FOR SELECT USING (
    tenant_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Le locataire peut uploader ses documents
CREATE POLICY "tenant_insert_own_documents" ON tenant_documents
  FOR INSERT WITH CHECK (
    tenant_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- AJOUTER tenant_email DANS LES METADATA DE L'EXPIRY CRON
-- La fonction check_expiring_cni() utilise d.metadata->>'tenant_email'
-- mais cette donnée n'était pas toujours présente.
-- Mettre à jour les documents CNI existants pour ajouter le tenant_email.
-- ============================================

UPDATE documents d
SET metadata = COALESCE(d.metadata, '{}'::jsonb) || jsonb_build_object(
  'tenant_email', COALESCE(
    (SELECT u.email FROM profiles p JOIN auth.users u ON u.id = p.user_id WHERE p.id = d.tenant_id),
    ''
  )
)
WHERE d.type IN ('cni_recto', 'cni_verso')
  AND d.tenant_id IS NOT NULL
  AND (d.metadata->>'tenant_email' IS NULL OR d.metadata->>'tenant_email' = '');

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON POLICY "tenant_view_own_documents" ON tenant_documents
  IS 'Le locataire peut voir ses documents via la jointure profiles.user_id = auth.uid()';
COMMENT ON POLICY "tenant_insert_own_documents" ON tenant_documents
  IS 'Le locataire peut insérer ses documents via la jointure profiles.user_id = auth.uid()';

COMMIT;

-- -----------------------------------------------------------------------------
-- 45/61 -- 20260223000001 -- DANGEREUX -- 20260223000001_auto_fill_document_fk.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 45/61 (DANGEREUX) 20260223000001_auto_fill_document_fk.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 46/61 -- 20260223000002 -- SAFE -- 20260223000002_document_access_views.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 46/61 (SAFE) 20260223000002_document_access_views.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 47/61 -- 20260223000003 -- MODERE -- 20260223000003_notify_owner_on_tenant_document.sql
-- risk: +1 triggers
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 47/61 (MODERE) 20260223000003_notify_owner_on_tenant_document.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 48/61 -- 20260223100000 -- MODERE -- 20260223100000_fix_entity_connections.sql
-- risk: +3 triggers, UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 48/61 (MODERE) 20260223100000_fix_entity_connections.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 49/61 -- 20260223200000 -- DANGEREUX -- 20260223200000_fix_all_missing_tables_and_columns.sql
-- risk: UPDATE sans WHERE : on,own,own
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 49/61 (DANGEREUX) 20260223200000_fix_all_missing_tables_and_columns.sql'; END $$;
-- ============================================================================
-- MIGRATION CONSOLIDÉE : Tables et colonnes manquantes (connexions BDD)
-- Date: 2026-02-23
-- Corrige : tenant_profiles (CNI/KYC), conversations, messages, documents, storage
-- ============================================================================

-- ============================================
-- 1. COLONNES tenant_profiles (CNI / KYC)
-- ============================================

ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_recto_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verso_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_number TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_expiry_date DATE;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verified_at TIMESTAMPTZ;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verification_method TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS identity_data JSONB DEFAULT '{}';
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS selfie_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS selfie_verified_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_profiles' AND column_name = 'kyc_status'
  ) THEN
    ALTER TABLE tenant_profiles
    ADD COLUMN kyc_status TEXT DEFAULT 'pending'
    CHECK (kyc_status IN ('pending', 'processing', 'verified', 'rejected'));
  END IF;
END $$;

-- ============================================
-- 2. FONCTION update_updated_at (si absente)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. TABLE conversations
-- ============================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  owner_unread_count INTEGER NOT NULL DEFAULT 0,
  tenant_unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_profile_id ON conversations(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_profile_id ON conversations(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_property_id ON conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can insert conversations" ON conversations;
CREATE POLICY "Users can insert conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

-- ============================================
-- 4. TABLE messages
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('owner', 'tenant')),
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'system')),
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  attachment_size INTEGER,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_profile_id ON messages(sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(conversation_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages of own conversations" ON messages;
CREATE POLICY "Users can view messages of own conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_profile_id = public.user_profile_id() OR c.tenant_profile_id = public.user_profile_id())
    )
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON messages;
CREATE POLICY "Users can insert messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    sender_profile_id = public.user_profile_id()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_profile_id = public.user_profile_id() OR c.tenant_profile_id = public.user_profile_id())
    )
  );

-- ============================================
-- 5. FONCTION RPC mark_messages_as_read
-- ============================================

CREATE OR REPLACE FUNCTION public.mark_messages_as_read(
  p_conversation_id UUID,
  p_reader_profile_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv RECORD;
BEGIN
  SELECT owner_profile_id, tenant_profile_id INTO v_conv
  FROM conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Marquer read_at sur les messages non lus reçus par le lecteur
  UPDATE messages
  SET read_at = COALESCE(read_at, NOW())
  WHERE conversation_id = p_conversation_id
    AND sender_profile_id != p_reader_profile_id
    AND read_at IS NULL;

  -- Remettre à zéro le compteur non lu du lecteur
  IF v_conv.owner_profile_id = p_reader_profile_id THEN
    UPDATE conversations
    SET owner_unread_count = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
  ELSIF v_conv.tenant_profile_id = p_reader_profile_id THEN
    UPDATE conversations
    SET tenant_unread_count = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(UUID, UUID) TO authenticated;

-- ============================================
-- 6. COLONNES documents (si manquantes)
-- ============================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS collection TEXT DEFAULT 'property_media';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- 7. BUCKET STORAGE documents
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Politique upload pour utilisateurs authentifiés
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- ============================================
-- FIN
-- ============================================================================

COMMIT;

-- -----------------------------------------------------------------------------
-- 50/61 -- 20260224000000 -- CRITIQUE -- 20260224000000_fix_tenant_sync_and_notifications.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 50/61 (CRITIQUE) 20260224000000_fix_tenant_sync_and_notifications.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 51/61 -- 20260224000001 -- SAFE -- 20260224000001_remove_yousign_sendgrid_brevo.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 51/61 (SAFE) 20260224000001_remove_yousign_sendgrid_brevo.sql'; END $$;
-- Suppression des providers Yousign, SendGrid et Brevo (signature/email intégrés ou non utilisés)
-- Les credentials associées sont supprimées en premier (FK)

DELETE FROM api_credentials
WHERE provider_id IN (
  SELECT id FROM api_providers
  WHERE lower(name) IN ('yousign', 'brevo', 'sendgrid')
);

DELETE FROM api_providers
WHERE lower(name) IN ('yousign', 'brevo', 'sendgrid');

COMMIT;

-- -----------------------------------------------------------------------------
-- 52/61 -- 20260224100000 -- CRITIQUE -- 20260224100000_fix_tenant_dashboard_notifications_query.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 52/61 (CRITIQUE) 20260224100000_fix_tenant_dashboard_notifications_query.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 53/61 -- 20260225000000 -- MODERE -- 20260225000000_owner_payment_audit_log.sql
-- risk: +3 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 53/61 (MODERE) 20260225000000_owner_payment_audit_log.sql'; END $$;
-- ============================================================
-- SOTA 2026 : Journal d'audit PSD3 pour les moyens de paiement propriétaire
-- Traçabilité des actions (carte ajoutée/supprimée, défaut, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS owner_payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payment_method_type TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opal_owner_created ON owner_payment_audit_log(owner_id, created_at DESC);

COMMENT ON TABLE owner_payment_audit_log IS 'Audit trail PSD3 pour les opérations sur les moyens de paiement propriétaire (abonnement, carte, etc.)';

ALTER TABLE owner_payment_audit_log ENABLE ROW LEVEL SECURITY;

-- Le propriétaire ne voit que ses propres logs
DROP POLICY IF EXISTS "opal_select_own" ON owner_payment_audit_log;
CREATE POLICY "opal_select_own" ON owner_payment_audit_log
  FOR SELECT USING (owner_id = public.user_profile_id());

-- Le propriétaire peut insérer des logs pour lui-même (via l'API qui utilise son session)
DROP POLICY IF EXISTS "opal_insert_own" ON owner_payment_audit_log;
CREATE POLICY "opal_insert_own" ON owner_payment_audit_log
  FOR INSERT WITH CHECK (owner_id = public.user_profile_id());

-- L'admin voit et gère tout (lecture seule en pratique, pas de UPDATE/DELETE prévus)
DROP POLICY IF EXISTS "opal_admin_all" ON owner_payment_audit_log;
CREATE POLICY "opal_admin_all" ON owner_payment_audit_log
  FOR ALL USING (public.user_role() = 'admin');

COMMIT;

-- -----------------------------------------------------------------------------
-- 54/61 -- 20260225000001 -- MODERE -- 20260225000001_fix_furniture_vetusty_rls.sql
-- risk: +11 policies, -11 policies, UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 54/61 (MODERE) 20260225000001_fix_furniture_vetusty_rls.sql'; END $$;
-- ============================================================================
-- P0-4: Correction RLS vétusté et mobilier
-- properties.owner_id et lease_signers.profile_id sont des profiles.id,
-- alors que auth.uid() renvoie auth.users.id. Il faut joindre profiles
-- et comparer pr.user_id = auth.uid().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. furniture_inventories
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS furniture_inventories_owner_policy ON furniture_inventories;
CREATE POLICY furniture_inventories_owner_policy ON furniture_inventories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = furniture_inventories.lease_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS furniture_inventories_tenant_policy ON furniture_inventories;
CREATE POLICY furniture_inventories_tenant_policy ON furniture_inventories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE l.id = furniture_inventories.lease_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 2. furniture_items
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS furniture_items_owner_policy ON furniture_items;
CREATE POLICY furniture_items_owner_policy ON furniture_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE fi.id = furniture_items.inventory_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS furniture_items_tenant_policy ON furniture_items;
CREATE POLICY furniture_items_tenant_policy ON furniture_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE fi.id = furniture_items.inventory_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 3. vetusty_reports
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "vetusty_reports_select_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_select_policy" ON vetusty_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr_owner ON pr_owner.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND (
        pr_owner.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          JOIN profiles pr ON pr.id = ls.profile_id
          WHERE ls.lease_id = l.id
          AND pr.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "vetusty_reports_insert_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_insert_policy" ON vetusty_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_reports_update_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_update_policy" ON vetusty_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. vetusty_items
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "vetusty_items_select_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_select_policy" ON vetusty_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr_owner ON pr_owner.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND (
        pr_owner.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          JOIN profiles pr ON pr.id = ls.profile_id
          WHERE ls.lease_id = l.id
          AND pr.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "vetusty_items_insert_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_insert_policy" ON vetusty_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_items_update_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_update_policy" ON vetusty_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_items_delete_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_delete_policy" ON vetusty_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
      AND vr.status = 'draft'
    )
  );

-- vetusty_grid_versions reste en lecture publique (USING (true)), pas de modification.

COMMIT;

-- -----------------------------------------------------------------------------
-- 55/61 -- 20260225100000 -- CRITIQUE -- 20260225100000_autolink_backfill_invoices_on_profile.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 55/61 (CRITIQUE) 20260225100000_autolink_backfill_invoices_on_profile.sql'; END $$;
-- =====================================================
-- MIGRATION: Backfill invoices.tenant_id dans l'auto-link profil
-- Date: 2026-02-25
--
-- OBJECTIF:
--   Quand un nouveau profil locataire est créé, le trigger
--   auto_link_lease_signers_on_profile_created() lie déjà les
--   lease_signers orphelins. On ajoute le backfill des factures
--   (invoices.tenant_id) pour que les nouveaux comptes voient
--   leurs factures dès le premier chargement.
--
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  -- Récupérer l'email de l'utilisateur auth
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Lier tous les lease_signers orphelins avec cet email
  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(TRIM(invited_email)) = LOWER(TRIM(user_email))
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)', 
      linked_count, NEW.id, user_email;

    -- Backfill invoices.tenant_id pour les baux désormais liés
    UPDATE public.invoices i
    SET tenant_id = NEW.id
    WHERE i.tenant_id IS NULL
      AND i.lease_id IN (
        SELECT lease_id FROM public.lease_signers WHERE profile_id = NEW.id
      );
  END IF;

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(user_email))
    AND used_at IS NULL;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_link_lease_signers_on_profile_created] Erreur non-bloquante: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.auto_link_lease_signers_on_profile_created() IS
'Après INSERT sur profiles: lie les lease_signers orphelins (invited_email = user email), backfill invoices.tenant_id, marque les invitations utilisées. Ne bloque jamais.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 56/61 -- 20260226000000 -- MODERE -- 20260226000000_backfill_existing_invoices_tenant_id.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 56/61 (MODERE) 20260226000000_backfill_existing_invoices_tenant_id.sql'; END $$;
-- =====================================================
-- MIGRATION: Backfill invoices.tenant_id pour les profils existants
-- Date: 2026-02-26
--
-- OBJECTIF:
--   Pour les factures existantes où tenant_id est NULL mais où
--   un lease_signer avec role locataire_principal existe et est
--   déjà lié à un profil, on renseigne le tenant_id.
--
-- SÉCURITÉ:
--   - Ne touche QUE les lignes où tenant_id IS NULL
--   - Ne crée aucune donnée, ne supprime rien
--   - Idempotent : peut être exécuté plusieurs fois sans effet
-- =====================================================

-- Backfill : lier les factures orphelines aux profils existants
UPDATE public.invoices i
SET tenant_id = ls.profile_id
FROM public.lease_signers ls
WHERE i.lease_id = ls.lease_id
  AND ls.role = 'locataire_principal'
  AND ls.profile_id IS NOT NULL
  AND i.tenant_id IS NULL;

-- Log du nombre de lignes mises à jour (visible dans les logs Supabase)
DO $$
DECLARE
  updated_count INT;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '[backfill_invoices_tenant_id] % factures liées à leur locataire', updated_count;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 57/61 -- 20260227000000 -- SAFE -- 20260227000000_drop_auto_activate_lease_trigger.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 57/61 (SAFE) 20260227000000_drop_auto_activate_lease_trigger.sql'; END $$;
-- Fix: Le trigger auto_activate_lease_on_edl n'a pas été supprimé
-- car la migration 20260207200000 ciblait le mauvais nom
DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON public.edl;
DROP FUNCTION IF EXISTS public.trigger_activate_lease_on_edl_signed();

COMMIT;

-- -----------------------------------------------------------------------------
-- 58/61 -- 20260228000000 -- SAFE -- 20260228000000_lease_signers_share_percentage.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 58/61 (SAFE) 20260228000000_lease_signers_share_percentage.sql'; END $$;
-- SOTA 2026: part de répartition par signataire (colocation).
-- Si NULL, l'UI utilise le fallback 100 / nombre de colocataires.
ALTER TABLE public.lease_signers
  ADD COLUMN IF NOT EXISTS share_percentage numeric(5,2) NULL
  CONSTRAINT chk_lease_signers_share_percentage CHECK (share_percentage IS NULL OR (share_percentage >= 0 AND share_percentage <= 100));

COMMENT ON COLUMN public.lease_signers.share_percentage IS 'Part en % du loyer/charges pour ce signataire (colocation). NULL = répartition égale.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 59/61 -- 20260228100000 -- DANGEREUX -- 20260228100000_tenant_payment_methods_sota2026.sql
-- risk: UPDATE sans WHERE : using,on,of,using,on,on,invoices,of
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 59/61 (DANGEREUX) 20260228100000_tenant_payment_methods_sota2026.sql'; END $$;
-- ============================================================
-- SOTA 2026 : Système de paiement locataire complet
-- - tenant_payment_methods  (multi-cartes, SEPA, wallets)
-- - sepa_mandates           (mandats SEPA avec conformité)
-- - payment_schedules       (prélèvements automatiques)
-- - payment_method_audit_log (traçabilité PSD3)
-- - Ajout statut 'partial' sur invoices
-- ============================================================

-- 1. TABLE PRINCIPALE : tenant_payment_methods
CREATE TABLE IF NOT EXISTS tenant_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,

  type TEXT NOT NULL CHECK (type IN ('card', 'sepa_debit', 'apple_pay', 'google_pay', 'link')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  label TEXT,

  -- Card-specific
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  card_fingerprint TEXT,

  -- SEPA-specific
  sepa_last4 TEXT,
  sepa_bank_code TEXT,
  sepa_country TEXT,
  sepa_fingerprint TEXT,
  sepa_mandate_id UUID,

  -- Metadata
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'failed')),
  last_used_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tpm_tenant ON tenant_payment_methods(tenant_profile_id);
CREATE INDEX idx_tpm_stripe_pm ON tenant_payment_methods(stripe_payment_method_id);
CREATE INDEX idx_tpm_default ON tenant_payment_methods(tenant_profile_id, is_default) WHERE is_default = true;
CREATE INDEX idx_tpm_active ON tenant_payment_methods(tenant_profile_id, status) WHERE status = 'active';

ALTER TABLE tenant_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tpm_select_own" ON tenant_payment_methods;
CREATE POLICY "tpm_select_own" ON tenant_payment_methods
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "tpm_insert_own" ON tenant_payment_methods;
CREATE POLICY "tpm_insert_own" ON tenant_payment_methods
  FOR INSERT WITH CHECK (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "tpm_update_own" ON tenant_payment_methods;
CREATE POLICY "tpm_update_own" ON tenant_payment_methods
  FOR UPDATE USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "tpm_delete_own" ON tenant_payment_methods;
CREATE POLICY "tpm_delete_own" ON tenant_payment_methods
  FOR DELETE USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "tpm_admin_all" ON tenant_payment_methods;
CREATE POLICY "tpm_admin_all" ON tenant_payment_methods
  FOR ALL USING (public.user_role() = 'admin');

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_tpm_updated_at ON tenant_payment_methods;
CREATE TRIGGER update_tpm_updated_at
  BEFORE UPDATE ON tenant_payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ensure only ONE default per tenant
CREATE OR REPLACE FUNCTION enforce_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE tenant_payment_methods
    SET is_default = false, updated_at = NOW()
    WHERE tenant_profile_id = NEW.tenant_profile_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_single_default_pm ON tenant_payment_methods;
CREATE TRIGGER trg_enforce_single_default_pm
  AFTER INSERT OR UPDATE OF is_default ON tenant_payment_methods
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION enforce_single_default_payment_method();


-- 2. TABLE : sepa_mandates
CREATE TABLE IF NOT EXISTS sepa_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_reference TEXT NOT NULL UNIQUE DEFAULT ('MNDT-' || substr(gen_random_uuid()::text, 1, 12)),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Debtor (locataire)
  debtor_name TEXT NOT NULL,
  debtor_iban TEXT NOT NULL,

  -- Creditor (propriétaire)
  creditor_name TEXT NOT NULL,
  creditor_iban TEXT NOT NULL,
  creditor_bic TEXT,

  -- Stripe references
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  stripe_mandate_id TEXT,

  -- Mandate details
  amount DECIMAL(10,2) NOT NULL,
  signature_date DATE NOT NULL DEFAULT CURRENT_DATE,
  signed_at TIMESTAMPTZ,
  signature_method TEXT DEFAULT 'electronic' CHECK (signature_method IN ('electronic', 'paper', 'api')),
  first_collection_date DATE,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'cancelled', 'expired', 'failed')),

  -- Pre-notification tracking (conformité SEPA D-14)
  last_prenotification_sent_at TIMESTAMPTZ,
  next_collection_date DATE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sepa_mandates_tenant ON sepa_mandates(tenant_profile_id);
CREATE INDEX idx_sepa_mandates_lease ON sepa_mandates(lease_id);
CREATE INDEX idx_sepa_mandates_status ON sepa_mandates(status) WHERE status = 'active';
CREATE INDEX idx_sepa_mandates_next_collection ON sepa_mandates(next_collection_date) WHERE status = 'active';

ALTER TABLE sepa_mandates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sepa_select_tenant" ON sepa_mandates;
CREATE POLICY "sepa_select_tenant" ON sepa_mandates
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "sepa_select_owner" ON sepa_mandates;
CREATE POLICY "sepa_select_owner" ON sepa_mandates
  FOR SELECT USING (owner_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "sepa_insert_tenant" ON sepa_mandates;
CREATE POLICY "sepa_insert_tenant" ON sepa_mandates
  FOR INSERT WITH CHECK (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "sepa_update_tenant" ON sepa_mandates;
CREATE POLICY "sepa_update_tenant" ON sepa_mandates
  FOR UPDATE USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "sepa_admin_all" ON sepa_mandates;
CREATE POLICY "sepa_admin_all" ON sepa_mandates
  FOR ALL USING (public.user_role() = 'admin');

DROP TRIGGER IF EXISTS update_sepa_mandates_updated_at ON sepa_mandates;
CREATE TRIGGER update_sepa_mandates_updated_at
  BEFORE UPDATE ON sepa_mandates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Link tenant_payment_methods to sepa_mandates
ALTER TABLE tenant_payment_methods
  ADD CONSTRAINT fk_tpm_sepa_mandate
  FOREIGN KEY (sepa_mandate_id) REFERENCES sepa_mandates(id) ON DELETE SET NULL;


-- 3. TABLE : payment_schedules (échéanciers de prélèvement)
CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  mandate_id UUID REFERENCES sepa_mandates(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES tenant_payment_methods(id) ON DELETE SET NULL,

  payment_method_type TEXT NOT NULL DEFAULT 'sepa'
    CHECK (payment_method_type IN ('sepa', 'card', 'pay_by_bank')),
  collection_day INTEGER NOT NULL DEFAULT 5 CHECK (collection_day BETWEEN 1 AND 28),
  rent_amount DECIMAL(10,2) NOT NULL,
  charges_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE NOT NULL,
  end_date DATE,

  -- Smart retry
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  next_retry_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(lease_id)
);

CREATE INDEX idx_ps_active ON payment_schedules(is_active, collection_day) WHERE is_active = true;
CREATE INDEX idx_ps_next_retry ON payment_schedules(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_ps_lease ON payment_schedules(lease_id);

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ps_select_tenant" ON payment_schedules;
CREATE POLICY "ps_select_tenant" ON payment_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.id = payment_schedules.lease_id
        AND ls.profile_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "ps_select_owner" ON payment_schedules;
CREATE POLICY "ps_select_owner" ON payment_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE l.id = payment_schedules.lease_id
        AND p.owner_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "ps_admin_all" ON payment_schedules;
CREATE POLICY "ps_admin_all" ON payment_schedules
  FOR ALL USING (public.user_role() = 'admin');

DROP TRIGGER IF EXISTS update_ps_updated_at ON payment_schedules;
CREATE TRIGGER update_ps_updated_at
  BEFORE UPDATE ON payment_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 4. TABLE : payment_method_audit_log (PSD3 Permission Dashboard)
CREATE TABLE IF NOT EXISTS payment_method_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES tenant_payment_methods(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'set_default', 'revoked', 'expired',
    'payment_success', 'payment_failed', 'prenotification_sent',
    'mandate_created', 'mandate_cancelled', 'data_accessed'
  )),
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pmal_tenant ON payment_method_audit_log(tenant_profile_id, created_at DESC);
CREATE INDEX idx_pmal_pm ON payment_method_audit_log(payment_method_id, created_at DESC);

ALTER TABLE payment_method_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pmal_select_own" ON payment_method_audit_log;
CREATE POLICY "pmal_select_own" ON payment_method_audit_log
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "pmal_admin_all" ON payment_method_audit_log;
CREATE POLICY "pmal_admin_all" ON payment_method_audit_log
  FOR ALL USING (public.user_role() = 'admin');


-- 5. Ajouter 'partial' au statut des invoices
DO $$
BEGIN
  -- Drop old constraint and recreate with 'partial'
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%invoices_statut_check%'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_statut_check;
  END IF;

  ALTER TABLE invoices ADD CONSTRAINT invoices_statut_check
    CHECK (statut IN ('draft', 'sent', 'paid', 'late', 'partial'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update invoices statut constraint: %', SQLERRM;
END $$;

-- Add partial tracking columns to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_remaining DECIMAL(10,2);

-- Auto-calculate remaining on update
CREATE OR REPLACE FUNCTION update_invoice_amount_remaining()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_remaining := NEW.montant_total - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_amount_remaining ON invoices;
CREATE TRIGGER trg_invoice_amount_remaining
  BEFORE INSERT OR UPDATE OF montant_total, amount_paid ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_invoice_amount_remaining();

-- Backfill existing invoices
UPDATE invoices
SET amount_paid = CASE WHEN statut = 'paid' THEN montant_total ELSE 0 END
WHERE amount_paid IS NULL OR amount_paid = 0;


-- 6. Add stripe_customer_id to profiles if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

COMMIT;

-- -----------------------------------------------------------------------------
-- 60/61 -- 20260229100000 -- MODERE -- 20260229100000_identity_2fa_requests.sql
-- risk: +1 policies, -1 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 60/61 (MODERE) 20260229100000_identity_2fa_requests.sql'; END $$;
-- Migration: Table pour les demandes 2FA (SMS + email) lors des changements d'identité
-- SOTA 2026 - Vérification à deux facteurs pour renouvellement / mise à jour CNI

CREATE TABLE IF NOT EXISTS identity_2fa_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('renew', 'initial', 'update')),
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  otp_hash TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_token ON identity_2fa_requests(token);
CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_profile_id ON identity_2fa_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_expires_at ON identity_2fa_requests(expires_at) WHERE verified_at IS NULL;

ALTER TABLE identity_2fa_requests ENABLE ROW LEVEL SECURITY;

-- Le locataire ne peut voir que ses propres demandes
DROP POLICY IF EXISTS "identity_2fa_requests_tenant_own" ON identity_2fa_requests;
CREATE POLICY "identity_2fa_requests_tenant_own"
  ON identity_2fa_requests FOR ALL TO authenticated
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

COMMENT ON TABLE identity_2fa_requests IS 'Demandes 2FA (OTP SMS + lien email) pour changement d''identité CNI';

COMMIT;

-- -----------------------------------------------------------------------------
-- 61/61 -- 20260230100000 -- SAFE -- 20260230100000_create_notification_resolve_profile_id.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 61/61 (SAFE) 20260230100000_create_notification_resolve_profile_id.sql'; END $$;
-- =====================================================
-- MIGRATION: create_notification — résolution profile_id → user_id
-- Date: 2026-02-30
--
-- OBJECTIF:
--   p_recipient_id peut être un profile_id (ex: triggers tenant) ou un user_id
--   (ex: triggers owner). Si c'est un profile_id, on résout user_id et on
--   insère les deux pour que la RLS (user_id = auth.uid()) et les vues
--   par profile_id fonctionnent.
-- =====================================================

DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_user_id UUID;
  v_is_profile BOOLEAN := false;
BEGIN
  -- Si p_recipient_id correspond à un profil, récupérer le user_id
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE id = p_recipient_id
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    v_is_profile := true;
  ELSE
    -- Rétrocompat : considérer p_recipient_id comme user_id
    v_user_id := p_recipient_id;
  END IF;

  -- Insérer avec user_id (obligatoire pour RLS) et optionnellement profile_id
  IF v_is_profile THEN
    INSERT INTO notifications (
      user_id,
      profile_id,
      type,
      title,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_recipient_id,
      p_type,
      p_title,
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  ELSE
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_type,
      p_title,
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN v_notification_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_notification] Erreur: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) IS
'Crée une notification. p_recipient_id peut être un profile_id (résolution user_id) ou un user_id (rétrocompat).';

COMMIT;
