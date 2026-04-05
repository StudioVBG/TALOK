-- ═══════════════════════════════════════════════════════════════════════════════
-- TALOK — SCRIPT SQL PRODUCTION CONSOLIDÉ
-- Sprint : audit-talok-tenant-T33nc
-- Date : 2026-04-05
--
-- Contient 6 migrations à exécuter dans l'ordre.
-- Toutes les opérations sont idempotentes (IF NOT EXISTS, DROP IF EXISTS).
-- Temps estimé : < 30 secondes sur une base < 100k lignes.
--
-- PRÉREQUIS : Les fonctions SECURITY DEFINER suivantes doivent exister :
--   - public.user_profile_id()
--   - public.user_role()
--   - public.is_admin()
-- (Créées par la migration 20260213000000_fix_profiles_rls_recursion_v2.sql)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1/6 — ENUMS + COLONNES identity_status / onboarding_step
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE identity_status_enum AS ENUM (
    'unverified',
    'phone_verified',
    'document_uploaded',
    'identity_review',
    'identity_verified',
    'identity_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE onboarding_step_enum AS ENUM (
    'account_created',
    'phone_pending',
    'phone_done',
    'profile_pending',
    'profile_done',
    'document_pending',
    'document_done',
    'complete'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_status identity_status_enum NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS onboarding_step onboarding_step_enum NOT NULL DEFAULT 'account_created',
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_identity_status ON profiles (identity_status);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_step ON profiles (onboarding_step);

COMMENT ON COLUMN profiles.identity_status IS 'Niveau de vérification d''identité — utilisé par le middleware identity-gate';
COMMENT ON COLUMN profiles.onboarding_step IS 'Étape courante du parcours d''onboarding';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2/6 — BACKFILL identity_status (du plus spécifique au plus général)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Tenants/Owners avec bail actif → identity_verified + complete
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at    = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step      = 'complete'
WHERE (
  id IN (
    SELECT DISTINCT tenant_id FROM leases
    WHERE statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
      AND tenant_id IS NOT NULL
  )
  OR id IN (
    SELECT DISTINCT ls.profile_id FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    WHERE l.statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
      AND ls.signature_status = 'signed'
      AND ls.profile_id IS NOT NULL
  )
  OR id IN (
    SELECT DISTINCT owner_id FROM properties WHERE owner_id IS NOT NULL
  )
)
AND identity_status = 'unverified';

-- 2b. Users ayant uploadé des documents → identity_verified
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

-- 2c. Admins → identity_verified d'office
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = true,
  onboarding_step      = 'complete'
WHERE role = 'admin'
AND identity_status = 'unverified';

-- 2d. Comptes avec téléphone + prénom + nom → phone_verified
UPDATE profiles SET
  identity_status   = 'phone_verified',
  phone_verified    = true,
  phone_verified_at = NOW(),
  onboarding_step   = 'profile_done'
WHERE identity_status = 'unverified'
  AND telephone IS NOT NULL AND telephone <> ''
  AND prenom IS NOT NULL AND prenom <> ''
  AND nom IS NOT NULL AND nom <> '';

-- 2e. Comptes > 24h restants → phone_verified (grace period)
UPDATE profiles SET
  identity_status = 'phone_verified',
  onboarding_step = 'phone_done'
WHERE identity_status = 'unverified'
  AND created_at < NOW() - INTERVAL '1 day';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3/6 — COLONNES initial_payment sur leases + backfill
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS initial_payment_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_payment_date timestamptz,
  ADD COLUMN IF NOT EXISTS initial_payment_stripe_pi text;

UPDATE leases l
SET initial_payment_confirmed = true,
    initial_payment_date = i.date_paiement
FROM invoices i
WHERE i.lease_id = l.id
  AND i.statut = 'paid'
  AND (i.metadata->>'type' = 'initial_invoice' OR i.type = 'initial_invoice')
  AND l.initial_payment_confirmed = false;

CREATE INDEX IF NOT EXISTS idx_leases_initial_payment_pending
  ON leases (id) WHERE initial_payment_confirmed = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4/6 — RLS SUR push_subscriptions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions;
CREATE POLICY "push_subs_own_access" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5/6 — VUE DOCUMENTS TENANT AVEC visible_tenant
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_tenant_accessible_documents AS
SELECT DISTINCT ON (d.id) d.*
FROM public.documents d
WHERE
  -- Documents du tenant lui-même (toujours visibles)
  d.tenant_id = public.user_profile_id()
  -- Documents du bail (visible_tenant requis)
  OR (
    d.visible_tenant = true
    AND d.lease_id IN (
      SELECT ls.lease_id FROM public.lease_signers ls
      WHERE ls.profile_id = public.user_profile_id()
    )
  )
  -- Documents partagés de la propriété (diagnostics, EDL — visible_tenant requis)
  OR (
    d.visible_tenant = true
    AND d.property_id IN (
      SELECT l.property_id FROM public.leases l
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
  'Vue unifiée des documents accessibles par le locataire. Filtre visible_tenant=true sauf pour les docs uploadés par le tenant.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6/6 — FIX RLS ticket_messages (lease_signers au lieu de roommates)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Ticket messages same lease select" ON ticket_messages;
CREATE POLICY "Ticket messages same lease select"
  ON ticket_messages FOR SELECT
  USING (
    ticket_id IN (SELECT t.id FROM tickets t WHERE t.created_by_profile_id = public.user_profile_id())
    OR ticket_id IN (
      SELECT t.id FROM tickets t
      WHERE t.lease_id IN (SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = public.user_profile_id())
    )
    OR ticket_id IN (
      SELECT t.id FROM tickets t JOIN properties p ON p.id = t.property_id WHERE p.owner_id = public.user_profile_id()
    )
    OR public.user_role() = 'admin'
  )
  AND (NOT is_internal OR public.user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Ticket messages same lease insert" ON ticket_messages;
CREATE POLICY "Ticket messages same lease insert"
  ON ticket_messages FOR INSERT
  WITH CHECK (
    sender_user = auth.uid()
    AND (
      ticket_id IN (SELECT t.id FROM tickets t WHERE t.created_by_profile_id = public.user_profile_id())
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.lease_id IN (SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = public.user_profile_id())
      )
      OR ticket_id IN (
        SELECT t.id FROM tickets t JOIN properties p ON p.id = t.property_id WHERE p.owner_id = public.user_profile_id()
      )
      OR public.user_role() = 'admin'
    )
  );

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION POST-MIGRATION — Exécuter séparément après le COMMIT
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Distribution identity_status
SELECT identity_status, COUNT(*) AS total FROM profiles GROUP BY identity_status ORDER BY total DESC;

-- 2. Distribution onboarding_step
SELECT onboarding_step, COUNT(*) AS total FROM profiles GROUP BY onboarding_step ORDER BY total DESC;

-- 3. Comptes test
SELECT email, role, identity_status, onboarding_step, phone_verified
FROM profiles
WHERE email IN ('contact.explore.mq@gmail.com', 'volberg.thomas@hotmail.fr');

-- 4. RLS push_subscriptions
SELECT policyname FROM pg_policies WHERE tablename = 'push_subscriptions';

-- 5. RLS ticket_messages
SELECT policyname FROM pg_policies WHERE tablename = 'ticket_messages';

-- 6. Vue documents (doit retourner un nombre > 0 pour un user connecté)
-- SELECT COUNT(*) FROM v_tenant_accessible_documents;

-- 7. Comptes encore unverified (devrait être 0 ou seulement les comptes < 24h)
SELECT COUNT(*) AS still_unverified FROM profiles WHERE identity_status = 'unverified';
