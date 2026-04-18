-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 10/15
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
-- Migration: 20260401000001_backfill_identity_status.sql
-- Note: file on disk is 20260401000001_backfill_identity_status.sql but will be renamed to 20260401000002_backfill_identity_status.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260401000001_backfill_identity_status.sql'; END $pre$;

-- Migration: Backfill identity_status pour les profils existants
-- Protège les utilisateurs existants avant activation du middleware identity-gate.
-- Ordre d'exécution important : les requêtes les plus spécifiques d'abord.
--
-- FIX: Utilise les vrais statuts leases (active, fully_signed, notice_given, terminated)
-- FIX: Supprime onboarding_completed_at (n'existe pas dans le schéma)
-- FIX: Utilise aussi lease_signers comme fallback quand leases.tenant_id est NULL

-- 1. Tenants/Owners avec bail actif/signé/terminé → identity_verified + complete
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at    = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step      = 'complete'
WHERE (
  -- Via leases.tenant_id (dénormalisé)
  id IN (
    SELECT DISTINCT tenant_id FROM leases
    WHERE statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
    AND tenant_id IS NOT NULL
  )
  OR
  -- Via lease_signers (source de vérité)
  id IN (
    SELECT DISTINCT ls.profile_id FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    WHERE l.statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
    AND ls.signature_status = 'signed'
    AND ls.profile_id IS NOT NULL
  )
  OR
  -- Propriétaires avec des biens
  id IN (
    SELECT DISTINCT owner_id FROM properties WHERE owner_id IS NOT NULL
  )
)
AND identity_status = 'unverified';

-- 2. Utilisateurs ayant uploadé des documents → identity_verified
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at    = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step      = 'complete'
WHERE id IN (
  SELECT DISTINCT uploaded_by FROM documents WHERE uploaded_by IS NOT NULL
)
AND identity_status = 'unverified';

-- 3. Admins → identity_verified d'office
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = true,
  onboarding_step      = 'complete'
WHERE role = 'admin'
AND identity_status = 'unverified';

-- 4. Comptes avec téléphone renseigné + prénom/nom → phone_verified
UPDATE profiles SET
  identity_status = 'phone_verified',
  phone_verified  = true,
  phone_verified_at = NOW(),
  onboarding_step = 'profile_done'
WHERE identity_status = 'unverified'
AND telephone IS NOT NULL AND telephone <> ''
AND prenom IS NOT NULL AND prenom <> ''
AND nom IS NOT NULL AND nom <> '';

-- 5. Comptes créés depuis plus de 24h sans rien → phone_verified (grace period)
UPDATE profiles SET
  identity_status = 'phone_verified',
  onboarding_step = 'phone_done'
WHERE identity_status = 'unverified'
AND created_at < NOW() - INTERVAL '1 day';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260401000002', 'backfill_identity_status')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260401000001_backfill_identity_status.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260404100000_rls_push_subscriptions.sql
-- Risk: MODERE
-- Why: +1 policies, -1 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260404100000_rls_push_subscriptions.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Activer RLS sur push_subscriptions
-- Date: 2026-04-04
--
-- PROBLÈME: L'audit sécurité a révélé que la table push_subscriptions
-- n'a pas de RLS activé. Un utilisateur authentifié pourrait potentiellement
-- lire/modifier les subscriptions push d'autres utilisateurs.
--
-- FIX: Activer RLS + policy user_id = auth.uid()
-- =====================================================

-- Activer RLS (idempotent si déjà activé)
ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions;

-- Policy : chaque utilisateur ne peut accéder qu'à ses propres subscriptions
DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions;
CREATE POLICY "push_subs_own_access" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "push_subs_own_access" ON push_subscriptions IS
  'Sécurité: un utilisateur ne peut voir/modifier que ses propres abonnements push.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260404100000', 'rls_push_subscriptions')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260404100000_rls_push_subscriptions.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260404100200_fix_ticket_messages_rls_lease_signers.sql
-- Risk: MODERE
-- Why: +2 policies, -2 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260404100200_fix_ticket_messages_rls_lease_signers.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Fix ticket_messages RLS — utiliser lease_signers au lieu de roommates
-- Date: 2026-04-04
--
-- PROBLÈME: La policy SELECT sur ticket_messages vérifie l'accès via
-- la table `roommates` (user_id), mais les locataires sont référencés
-- dans `lease_signers` (profile_id). Si roommates n'est pas peuplée,
-- le locataire n'a pas accès aux messages de ses tickets.
--
-- FIX: Remplacer roommates par lease_signers + user_profile_id()
-- =====================================================

-- SELECT policy
DROP POLICY IF EXISTS "Ticket messages same lease select" ON ticket_messages;

CREATE POLICY "Ticket messages same lease select"
  ON ticket_messages FOR SELECT
  USING (
    (
      -- Créateur du ticket
      ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.created_by_profile_id = public.user_profile_id()
      )
      -- Membre du bail via lease_signers
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls
          WHERE ls.profile_id = public.user_profile_id()
        )
      )
      -- Propriétaire du bien
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = public.user_profile_id()
      )
      -- Admin
      OR public.user_role() = 'admin'
    )
    AND (
      NOT is_internal
      OR public.user_role() IN ('owner', 'admin')
    )
  );

-- INSERT policy
DROP POLICY IF EXISTS "Ticket messages same lease insert" ON ticket_messages;

CREATE POLICY "Ticket messages same lease insert"
  ON ticket_messages FOR INSERT
  WITH CHECK (
    sender_user = auth.uid()
    AND (
      -- Créateur du ticket
      ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.created_by_profile_id = public.user_profile_id()
      )
      -- Membre du bail
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls
          WHERE ls.profile_id = public.user_profile_id()
        )
      )
      -- Propriétaire du bien
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = public.user_profile_id()
      )
      -- Admin
      OR public.user_role() = 'admin'
    )
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260404100200', 'fix_ticket_messages_rls_lease_signers')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260404100200_fix_ticket_messages_rls_lease_signers.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260407130000_ocr_category_rules.sql
-- Risk: MODERE
-- Why: +1 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260407130000_ocr_category_rules.sql'; END $pre$;

-- =====================================================
-- MIGRATION: OCR Category Rules + document_analyses extensions
-- Date: 2026-04-07
-- =====================================================

-- Table for OCR learning rules
CREATE TABLE IF NOT EXISTS ocr_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('supplier_name', 'supplier_siret', 'keyword')),
  match_value TEXT NOT NULL,
  target_account TEXT NOT NULL,
  target_category TEXT,
  target_journal TEXT,
  confidence_boost NUMERIC(5,2) DEFAULT 10.0,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entity_id, match_type, match_value)
);

CREATE INDEX IF NOT EXISTS idx_ocr_rules_entity ON ocr_category_rules(entity_id);
CREATE INDEX IF NOT EXISTS idx_ocr_rules_match ON ocr_category_rules(match_type, match_value);

ALTER TABLE ocr_category_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocr_rules_entity_access" ON ocr_category_rules;
CREATE POLICY "ocr_rules_entity_access" ON ocr_category_rules
  FOR ALL TO authenticated
  USING (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));

-- Extend document_analyses with OCR-specific columns
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES accounting_entries(id);
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS raw_ocr_text TEXT;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS suggested_entry JSONB;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260407130000', 'ocr_category_rules')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260407130000_ocr_category_rules.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408100000_copro_lots.sql
-- Risk: MODERE
-- Why: +2 policies, ALTER column (type/constraint), UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408100000_copro_lots.sql'; END $pre$;

-- Sprint 5: Copropriété lots + fund call lines
-- Tables for syndic copropriété module

CREATE TABLE IF NOT EXISTS copro_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copro_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  lot_type TEXT CHECK (lot_type IN ('habitation','commerce','parking','cave','bureau','autre')) DEFAULT 'habitation',
  owner_name TEXT NOT NULL,
  owner_entity_id UUID REFERENCES legal_entities(id),
  owner_profile_id UUID REFERENCES profiles(id),
  tantiemes_generaux INTEGER NOT NULL CHECK (tantiemes_generaux > 0),
  tantiemes_speciaux JSONB DEFAULT '{}',
  surface_m2 NUMERIC(8,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(copro_entity_id, lot_number)
);
CREATE INDEX IF NOT EXISTS idx_copro_lots_entity ON copro_lots(copro_entity_id);
ALTER TABLE copro_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "copro_lots_entity_access" ON copro_lots;
CREATE POLICY "copro_lots_entity_access" ON copro_lots FOR ALL TO authenticated
  USING (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));

-- Add missing columns to copro_fund_calls for syndic module
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES accounting_exercises(id);
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS call_number TEXT;
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS period_label TEXT;
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','partial','overdue'));

-- Make lot-level columns nullable (calls now represent periods, lines hold lot details)
ALTER TABLE copro_fund_calls ALTER COLUMN owner_name DROP NOT NULL;
ALTER TABLE copro_fund_calls ALTER COLUMN owner_name SET DEFAULT '';
ALTER TABLE copro_fund_calls ALTER COLUMN tantiemes DROP NOT NULL;
ALTER TABLE copro_fund_calls DROP CONSTRAINT IF EXISTS copro_fund_calls_tantiemes_check;
ALTER TABLE copro_fund_calls ALTER COLUMN tantiemes SET DEFAULT 0;
ALTER TABLE copro_fund_calls ALTER COLUMN total_tantiemes DROP NOT NULL;
ALTER TABLE copro_fund_calls DROP CONSTRAINT IF EXISTS copro_fund_calls_total_tantiemes_check;
ALTER TABLE copro_fund_calls ALTER COLUMN total_tantiemes SET DEFAULT 0;

-- Backfill exercise_id from budget if null
UPDATE copro_fund_calls SET exercise_id = copro_budgets.exercise_id
  FROM copro_budgets WHERE copro_fund_calls.budget_id = copro_budgets.id
  AND copro_fund_calls.exercise_id IS NULL;

-- Add copro_fund_call_lines if not exists
CREATE TABLE IF NOT EXISTS copro_fund_call_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES copro_fund_calls(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES copro_lots(id),
  owner_name TEXT NOT NULL,
  tantiemes INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','partial','paid','overdue')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE copro_fund_call_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "copro_fund_call_lines_access" ON copro_fund_call_lines;
CREATE POLICY "copro_fund_call_lines_access" ON copro_fund_call_lines FOR ALL TO authenticated
  USING (call_id IN (SELECT id FROM copro_fund_calls WHERE entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid())));

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408100000', 'copro_lots')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408100000_copro_lots.sql'; END $post$;

COMMIT;

-- END OF BATCH 10/15 (Phase 2 MODERE)
