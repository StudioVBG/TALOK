-- ========================================
-- BATCH 1: Migrations 20260208 → 20260211
-- ========================================


-- ============================================
-- SOURCE: 20260208100000_fix_data_storage_audit.sql
-- ============================================
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


-- ============================================
-- SOURCE: 20260209100000_create_sms_messages_table.sql
-- ============================================
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


-- ============================================
-- SOURCE: 20260211000000_p2_unique_constraint_and_gdpr_rpc.sql
-- ============================================
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


-- ============================================
-- SOURCE: 20260211100000_bic_compliance_tax_regime.sql
-- ============================================
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

