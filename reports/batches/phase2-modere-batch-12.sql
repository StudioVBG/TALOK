-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 12/15
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
-- Migration: 20260409180000_buildings_site_id_nullable.sql
-- Risk: MODERE
-- Why: ALTER column (type/constraint)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260409180000_buildings_site_id_nullable.sql'; END $pre$;

-- ============================================
-- Migration : Rendre site_id nullable sur buildings
--
-- La colonne site_id (FK vers sites) a été créée NOT NULL par la
-- migration copropriété (20251208). Pour les immeubles locatifs
-- gérés par un propriétaire, il n'y a pas de site de copropriété :
-- site_id doit être nullable.
-- ============================================

ALTER TABLE buildings ALTER COLUMN site_id DROP NOT NULL;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260409180000', 'buildings_site_id_nullable')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260409180000_buildings_site_id_nullable.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260410180000_fix_invoice_generation_sota.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260410180000_fix_invoice_generation_sota.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Consolidated invoice generation fixes (bugs A-H)
-- Date: 2026-04-10
--
-- Audit follow-up. Bundles 6 SQL fixes + 2 deprecation markers that
-- came out of the invoice-generation audit on lease
-- da2eb9da-1ff1-4020-8682-5f993aa6fde7. Every statement is idempotent
-- (CREATE OR REPLACE / DROP IF EXISTS / IF NOT EXISTS).
--
-- Runs inside a single transaction so the whole thing rolls back on
-- any failure.
-- =====================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- Bug A — notify_tenant_invoice_created: resolve user_id
-- ═══════════════════════════════════════════════════════════
-- The original trigger from 20260305100000 inserted into `notifications`
-- without providing `user_id`, which is NOT NULL per the schema in
-- 20240101000021_add_notifications_table.sql. Every insert therefore
-- failed with a constraint violation and the tenant never saw the new
-- invoice.
--
-- Fix: resolve the auth.users id via profiles.user_id using the
-- invoice's tenant_id, skip silently when it can't be resolved (so we
-- never block the invoice insert itself), and populate the columns that
-- actually exist on the production notifications table (user_id, type,
-- title, body, metadata).
CREATE OR REPLACE FUNCTION notify_tenant_invoice_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_property_address TEXT;
BEGIN
  -- Only notify for "sent" invoices (not drafts, cancellations, etc.)
  IF NEW.statut IS DISTINCT FROM 'sent' THEN
    RETURN NEW;
  END IF;

  -- Resolve the tenant's auth.users id via profiles.user_id. The invoice
  -- row carries tenant_id = profiles.id, not the auth user id.
  SELECT p.user_id
  INTO v_user_id
  FROM profiles p
  WHERE p.id = NEW.tenant_id;

  -- If we cannot resolve an auth user, silently skip the notification
  -- (no tenant profile linked, or the tenant hasn't finished onboarding).
  -- Returning NEW without inserting keeps the invoice insert working.
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lookup property address via the lease for a friendlier message.
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = NEW.lease_id;

  INSERT INTO notifications (
    user_id,
    type,
    title,
    body,
    metadata
  ) VALUES (
    v_user_id,
    'invoice_issued',
    'Nouvelle quittance disponible',
    'Quittance pour ' || COALESCE(v_property_address, 'votre logement')
      || ' — ' || COALESCE(NEW.montant_total::TEXT, '0') || ' €',
    jsonb_build_object(
      'invoice_id', NEW.id,
      'lease_id', NEW.lease_id,
      'montant', NEW.montant_total,
      'periode', NEW.periode,
      'link', '/tenant/payments?invoice=' || NEW.id
    )
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_tenant_invoice_created IS
  'Inserts a notifications row when an invoice is issued. Resolves '
  'the tenant auth user via profiles.user_id and silently skips the '
  'insert if the tenant is not linked to an auth user (prevents '
  'user_id NOT NULL constraint violations that used to swallow the '
  'whole invoice insert).';


-- ═══════════════════════════════════════════════════════════
-- Bug B — generate_monthly_invoices: missing columns
-- ═══════════════════════════════════════════════════════════
-- The RPC from 20260304000000 did not populate period_start, period_end
-- or metadata. Downstream code (grand livre, filters on metadata->>'type')
-- then had to fall back to fuzzy period string parsing. There is no
-- dedicated `type` column on invoices — the convention established by
-- 20260306100000 and 20260314030000 is to store it inside metadata JSONB
-- as `metadata->>'type'`, so we follow that convention here.
CREATE OR REPLACE FUNCTION generate_monthly_invoices(p_target_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_lease RECORD;
  v_result JSONB;
  v_days_in_month INT;
  v_jour_paiement INT;
  v_date_echeance DATE;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  -- Guard: p_target_month must be YYYY-MM
  IF p_target_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Format de mois invalide. Attendu: YYYY-MM';
  END IF;

  v_period_start := (p_target_month || '-01')::DATE;
  v_period_end := (DATE_TRUNC('month', v_period_start) + INTERVAL '1 month - 1 day')::DATE;
  v_days_in_month := EXTRACT(DAY FROM v_period_end)::INT;

  -- Active leases missing an invoice for this period
  FOR v_lease IN
    SELECT
      l.id AS lease_id,
      l.property_id,
      p.owner_id,
      ls.profile_id AS tenant_id,
      l.loyer,
      l.charges_forfaitaires,
      COALESCE(l.jour_paiement, 5) AS jour_paiement
    FROM leases l
    JOIN properties p ON p.id = l.property_id
    JOIN lease_signers ls
      ON ls.lease_id = l.id
      AND ls.role IN ('locataire', 'locataire_principal')
    WHERE l.statut = 'active'
      AND l.date_debut <= v_period_start
      AND (l.date_fin IS NULL OR l.date_fin >= v_period_start)
      AND NOT EXISTS (
        SELECT 1 FROM invoices
        WHERE lease_id = l.id
          AND periode = p_target_month
      )
  LOOP
    -- Clamp jour_paiement to the last day of the month (e.g. 30 → 28 in Feb)
    v_jour_paiement := LEAST(v_lease.jour_paiement, v_days_in_month);
    v_date_echeance := (p_target_month || '-' || LPAD(v_jour_paiement::TEXT, 2, '0'))::DATE;

    INSERT INTO invoices (
      lease_id,
      owner_id,
      tenant_id,
      periode,
      montant_loyer,
      montant_charges,
      montant_total,
      date_echeance,
      period_start,
      period_end,
      invoice_number,
      statut,
      metadata,
      created_at
    ) VALUES (
      v_lease.lease_id,
      v_lease.owner_id,
      v_lease.tenant_id,
      p_target_month,
      v_lease.loyer,
      v_lease.charges_forfaitaires,
      v_lease.loyer + v_lease.charges_forfaitaires,
      v_date_echeance,
      v_period_start,
      v_period_end,
      'QUI-' || REPLACE(p_target_month, '-', '') || '-' || UPPER(LEFT(v_lease.lease_id::TEXT, 8)),
      'sent',
      jsonb_build_object(
        'type', 'loyer',
        'generated_by', 'generate_monthly_invoices',
        'generated_at', NOW()::TEXT
      ),
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'month', p_target_month,
    'generated_count', v_count
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_monthly_invoices IS
  'Generates monthly rent invoices for every active lease missing one '
  'for the target month (YYYY-MM). Uses leases.jour_paiement for the '
  'due date, fills period_start/period_end, and stores the invoice '
  'type in metadata (metadata->>''type'' = ''loyer'').';


-- ═══════════════════════════════════════════════════════════
-- Bug E — broken index on non-existent column due_date
-- ═══════════════════════════════════════════════════════════
-- 20260408220000_payment_architecture_sota.sql created an index on
-- `invoices(due_date, statut)` but the invoices table has never had a
-- `due_date` column (it's `date_echeance`). The migration either failed
-- silently on prod or the index was never applied. Drop it to keep the
-- schema clean; the correct index idx_invoices_date_echeance already
-- exists (20260305000001 line 66).
DROP INDEX IF EXISTS idx_invoices_overdue_check;


-- ═══════════════════════════════════════════════════════════
-- Bug F — mark_overdue_invoices_late: due_date → date_echeance
-- ═══════════════════════════════════════════════════════════
-- The original function (20260304200000) referenced `due_date` and wrote
-- statut = 'late'. Rewrite to use the real column (`date_echeance`) and
-- the status value the rest of the app checks against (`overdue`).
-- The existing cron schedule `mark-overdue-invoices` (5 0 * * *) stays
-- in place and will pick up the new function body automatically.
CREATE OR REPLACE FUNCTION mark_overdue_invoices_late()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE invoices
  SET
    statut = 'overdue',
    updated_at = NOW()
  WHERE statut = 'sent'
    AND date_echeance < CURRENT_DATE
    AND date_echeance IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    RAISE NOTICE '[mark_overdue_invoices_late] % factures passées en overdue', v_count;
  END IF;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION mark_overdue_invoices_late IS
  'Marks every `sent` invoice whose date_echeance is in the past as '
  '`overdue`. Called daily by the `mark-overdue-invoices` pg_cron job. '
  'Returns the number of rows updated.';


-- ═══════════════════════════════════════════════════════════
-- Bug C + G — pg_cron: net.http_post → net.http_get + Vault secrets
-- ═══════════════════════════════════════════════════════════
-- Supabase hosted does NOT support the `app.settings.*` GUC pattern the
-- original 20260304100000 migration used, and every cron API route in
-- app/api/cron/ exports only GET, so `net.http_post` never worked on
-- prod either. Rewrite every schedule to:
--   1. Use net.http_get (all routes verified to export GET)
--   2. Read the app URL + cron secret from vault.decrypted_secrets
--      at every run (not baked in at schedule creation time), so
--      rotating the secret doesn't require re-scheduling.
--   3. Set timeout_milliseconds := 30000 explicitly.
--
-- Vault entries expected (create them via the Supabase dashboard →
-- Project Settings → Vault before the cron jobs actually fire):
--   • app_url       = 'https://talok.fr'    (or the Netlify URL)
--   • cron_secret   = '<matches CRON_SECRET env var in Netlify>'
--
-- Routes targeted (all verified to export GET in app/api/cron/):
--   generate-invoices, payment-reminders, process-outbox,
--   process-webhooks, lease-expiry-alerts, check-cni-expiry,
--   subscription-alerts, irl-indexation, visit-reminders
--
-- `generate-monthly-invoices` is intentionally NOT rescheduled — the
-- route does not exist in app/api/cron/. The existing
-- `generate-invoices` cron already calls the (now-fixed)
-- generate_monthly_invoices RPC via /api/cron/generate-invoices.
--
-- SQL-function crons (cleanup-exports, cleanup-webhooks,
-- mark-overdue-invoices) are left untouched — they call local PL/pgSQL,
-- no HTTP involved.

-- Unschedule stale HTTP-based jobs (idempotent).
DO $$
DECLARE
  v_job TEXT;
BEGIN
  FOREACH v_job IN ARRAY ARRAY[
    'payment-reminders',
    'generate-monthly-invoices',
    'generate-invoices',
    'process-webhooks',
    'process-outbox',
    'lease-expiry-alerts',
    'check-cni-expiry',
    'irl-indexation',
    'visit-reminders',
    'subscription-alerts',
    'notifications'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_job) THEN
      PERFORM cron.unschedule(v_job);
    END IF;
  END LOOP;
END $$;

-- ─── Reschedule with net.http_get + vault secrets ─────────────

-- Daily rent payment reminders — 08:00 UTC
SELECT cron.schedule('payment-reminders', '0 8 * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/payment-reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Monthly invoice generation — 1st of the month, 06:00 UTC
SELECT cron.schedule('generate-invoices', '0 6 1 * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/generate-invoices',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Outbox worker — every 5 minutes
SELECT cron.schedule('process-outbox', '*/5 * * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/process-outbox',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Webhook retry worker — every 5 minutes (offset +2 to avoid burst)
SELECT cron.schedule('process-webhooks', '2-59/5 * * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/process-webhooks',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Lease expiry alerts — Mondays at 08:00 UTC
SELECT cron.schedule('lease-expiry-alerts', '0 8 * * 1', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/lease-expiry-alerts',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- CNI expiry check — daily at 10:00 UTC
SELECT cron.schedule('check-cni-expiry', '0 10 * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/check-cni-expiry',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Subscription alerts — daily at 10:00 UTC (offset +5 min to avoid burst)
SELECT cron.schedule('subscription-alerts', '5 10 * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/subscription-alerts',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- IRL indexation — 1st of the month, 07:00 UTC
SELECT cron.schedule('irl-indexation', '0 7 1 * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/irl-indexation',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Visit reminders — every 30 minutes
SELECT cron.schedule('visit-reminders', '*/30 * * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/visit-reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);


-- ═══════════════════════════════════════════════════════════
-- Bug H — deprecation marker on generate_first_invoice
-- ═══════════════════════════════════════════════════════════
-- DEPRECATED: generate_first_invoice() is superseded by
-- generate_initial_signing_invoice(), introduced in
-- 20260306100000_invoice_on_fully_signed.sql. The trigger
-- trg_invoice_engine_on_lease_active still calls generate_first_invoice
-- for backwards compatibility, but the guard added in that same
-- migration (SELECT … WHERE metadata->>'type' = 'initial_invoice')
-- prevents duplicate invoices. Full removal is deferred to a follow-up
-- migration once the new path has logged a few weeks of clean runs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'generate_first_invoice'
  ) THEN
    COMMENT ON FUNCTION generate_first_invoice(UUID, UUID, UUID) IS
      'DEPRECATED: use generate_initial_signing_invoice() instead. '
      'Still called by trg_invoice_engine_on_lease_active but guarded '
      'by the initial_invoice metadata check to prevent duplicates. '
      'Scheduled for removal in a future migration.';
  END IF;
END $$;


COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260410180000', 'fix_invoice_generation_sota')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260410180000_fix_invoice_generation_sota.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260410204528_extend_invoices_rls_for_sci_access.sql
-- Risk: MODERE
-- Why: +3 policies, -3 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260410204528_extend_invoices_rls_for_sci_access.sql'; END $pre$;

-- =====================================================
-- Migration: Extend invoices/leases/properties SELECT RLS for SCI access
-- Date: 2026-04-10
--
-- CONTEXT:
-- Bug #3 — "Facture introuvable" on /owner/invoices/[id] for SCI owners.
--
-- ROOT CAUSE:
-- The existing RLS SELECT policies on `invoices`, `leases` and `properties`
-- only check direct ownership via `owner_id = public.user_profile_id()`.
-- They do NOT account for owners who hold assets through a legal_entity
-- (SCI, SARL, agence…). When a property is owned by a SCI, its
-- `owner_id` points to the SCI's profile (not the individual manager),
-- so any human member of that SCI is blocked by RLS when fetching the
-- nested join `invoices → leases → properties`.
--
-- NOTE: The list endpoints (features/billing/server/data-fetching.ts)
-- silently work today because they use `getServiceClient()` which
-- bypasses RLS. The detail endpoint (app/api/invoices/[id]/route.ts)
-- correctly uses the authenticated client and therefore is blocked.
--
-- FIX:
-- Extend each SELECT policy to ALSO allow access when the caller is a
-- member of the legal_entity that owns the property (via entity_members).
-- INSERT / UPDATE / DELETE policies are left unchanged: only SELECT
-- needs the SCI read-through.
--
-- IDEMPOTENCE:
-- All policies are DROPped and CREATEd, matching the project convention.
-- Safe to re-run.
-- =====================================================

-- =====================================================
-- 1. PROPERTIES — allow SCI members to view properties
-- =====================================================
DROP POLICY IF EXISTS "Owners can view own properties" ON properties;

CREATE POLICY "Owners can view own properties"
  ON properties FOR SELECT
  USING (
    -- Direct ownership (personal owner_id)
    owner_id = public.user_profile_id()
    -- OR the property is held by a legal_entity the user is a member of
    OR legal_entity_id IN (
      SELECT em.entity_id
      FROM entity_members em
      WHERE em.user_id = auth.uid()
    )
  );

-- =====================================================
-- 2. LEASES — allow SCI members to view leases of SCI-owned properties
-- =====================================================
DROP POLICY IF EXISTS "Owners can view leases of own properties" ON leases;

CREATE POLICY "Owners can view leases of own properties"
  ON leases FOR SELECT
  USING (
    -- Lease on a property directly owned by the caller
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.owner_id = public.user_profile_id()
    )
    -- Or on a unit of such a property
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.owner_id = public.user_profile_id()
    )
    -- OR lease on a property held by a legal_entity the user is a member of
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.legal_entity_id IN (
          SELECT em.entity_id
          FROM entity_members em
          WHERE em.user_id = auth.uid()
        )
    )
    -- Or same on a unit
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.legal_entity_id IN (
          SELECT em.entity_id
          FROM entity_members em
          WHERE em.user_id = auth.uid()
        )
    )
  );

-- =====================================================
-- 3. INVOICES — allow SCI members to view invoices of SCI-owned assets
-- =====================================================
DROP POLICY IF EXISTS "Owners can view invoices of own properties" ON invoices;

CREATE POLICY "Owners can view invoices of own properties"
  ON invoices FOR SELECT
  USING (
    -- Direct ownership (invoices.owner_id matches the caller's profile)
    owner_id = public.user_profile_id()
    -- OR the invoice is explicitly tied to a legal_entity the user is a member of
    -- (invoices.entity_id was added by 20260408220000_payment_architecture_sota.sql)
    OR entity_id IN (
      SELECT em.entity_id
      FROM entity_members em
      WHERE em.user_id = auth.uid()
    )
    -- OR the invoice's lease points to a property held by a legal_entity
    -- the user is a member of
    OR lease_id IN (
      SELECT l.id
      FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.legal_entity_id IN (
        SELECT em.entity_id
        FROM entity_members em
        WHERE em.user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 4. COMMENTS for future readers
-- =====================================================
COMMENT ON POLICY "Owners can view own properties" ON properties IS
  'SCI-aware: allows direct profile owners AND members of the owning legal_entity.';

COMMENT ON POLICY "Owners can view leases of own properties" ON leases IS
  'SCI-aware: allows direct profile owners AND members of the legal_entity holding the underlying property.';

COMMENT ON POLICY "Owners can view invoices of own properties" ON invoices IS
  'SCI-aware: allows direct profile owners, explicit entity_id matches, AND members of the legal_entity holding the invoiced property.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260410204528', 'extend_invoices_rls_for_sci_access')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260410204528_extend_invoices_rls_for_sci_access.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260410212232_fix_entity_members_policy_recursion.sql
-- Risk: MODERE
-- Why: +4 policies, -4 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260410212232_fix_entity_members_policy_recursion.sql'; END $pre$;

-- =====================================================
-- Migration: Fix entity_members RLS recursion
-- Date: 2026-04-10
--
-- CONTEXT:
-- The entity_members_admin_manage policy introduced in
-- 20260406200000_create_entities_view_and_members.sql:78-91 recursively
-- references the entity_members table in its own USING clause:
--
--   DROP POLICY IF EXISTS "entity_members_admin_manage" ON entity_members;
--   CREATE POLICY "entity_members_admin_manage" ON entity_members
--     FOR ALL TO authenticated
--     USING (
--       entity_id IN (
--         SELECT entity_id FROM entity_members em
--         WHERE em.user_id = auth.uid() AND em.role = 'admin'
--       )
--     )
--
-- This is fine in isolation (Postgres short-circuits on the simpler
-- own_access policy first for most queries), BUT as soon as ANOTHER
-- policy on a DIFFERENT table runs a subquery against entity_members
-- (e.g. the SCI-aware invoices SELECT policy added by
-- 20260410204528_extend_invoices_rls_for_sci_access.sql), Postgres
-- walks the admin_manage policy to check access, which kicks the
-- recursion and raises:
--
--   ERROR: 42P17 infinite recursion detected in policy for
--          relation "entity_members"
--
-- handleApiError (lib/helpers/api-error.ts:55-59) maps 42P17 to
-- HTTP 403 "Accès refusé", which is exactly what Marie-Line saw on
-- /owner/invoices/[id] for the SCI ATOMGISTE invoices after the
-- SCI-aware RLS migration landed.
--
-- FIX:
-- Replace the inline subquery with a SECURITY DEFINER helper function.
-- The function bypasses RLS on entity_members (because SECURITY
-- DEFINER runs with the owner's privileges) and therefore breaks the
-- recursion. It also becomes a single source of truth for "give me
-- the entities this authenticated user is a member of" and can be
-- reused by any other SCI-aware policy.
--
-- The admin_manage policy is also rewritten to use the helper, so the
-- recursion is eliminated at its source.
--
-- Safe to re-run (CREATE OR REPLACE + DROP IF EXISTS).
-- =====================================================

-- =====================================================
-- 1. Helper function: entities the authenticated user can access
-- =====================================================
CREATE OR REPLACE FUNCTION public.auth_user_entity_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT entity_id
  FROM public.entity_members
  WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.auth_user_entity_ids IS
  'Returns the set of legal_entity ids that the currently authenticated user '
  'is a member of. SECURITY DEFINER to bypass RLS on entity_members and '
  'avoid infinite recursion when used inside RLS policies of other tables.';

-- =====================================================
-- 2. Helper function: entities where the user is admin
-- =====================================================
CREATE OR REPLACE FUNCTION public.auth_user_admin_entity_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT entity_id
  FROM public.entity_members
  WHERE user_id = auth.uid()
    AND role = 'admin';
$$;

COMMENT ON FUNCTION public.auth_user_admin_entity_ids IS
  'Returns the set of legal_entity ids where the currently authenticated user '
  'has the admin role. SECURITY DEFINER to bypass RLS and avoid recursion.';

-- =====================================================
-- 3. Rewrite entity_members admin_manage policy without recursion
-- =====================================================
DROP POLICY IF EXISTS "entity_members_admin_manage" ON entity_members;

CREATE POLICY "entity_members_admin_manage" ON entity_members
  FOR ALL TO authenticated
  USING (entity_id IN (SELECT public.auth_user_admin_entity_ids()))
  WITH CHECK (entity_id IN (SELECT public.auth_user_admin_entity_ids()));

COMMENT ON POLICY "entity_members_admin_manage" ON entity_members IS
  'Admins of a legal_entity can fully manage its members. Uses the '
  'auth_user_admin_entity_ids() SECURITY DEFINER helper to avoid the '
  'infinite recursion caused by the previous inline subquery.';

-- =====================================================
-- 4. Rewrite the 3 SCI-aware SELECT policies to use the helper
-- =====================================================

-- 4a. PROPERTIES
DROP POLICY IF EXISTS "Owners can view own properties" ON properties;

CREATE POLICY "Owners can view own properties"
  ON properties FOR SELECT
  USING (
    owner_id = public.user_profile_id()
    OR legal_entity_id IN (SELECT public.auth_user_entity_ids())
  );

COMMENT ON POLICY "Owners can view own properties" ON properties IS
  'SCI-aware via auth_user_entity_ids() helper. No recursion.';

-- 4b. LEASES
DROP POLICY IF EXISTS "Owners can view leases of own properties" ON leases;

CREATE POLICY "Owners can view leases of own properties"
  ON leases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.owner_id = public.user_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.legal_entity_id IN (SELECT public.auth_user_entity_ids())
    )
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.legal_entity_id IN (SELECT public.auth_user_entity_ids())
    )
  );

COMMENT ON POLICY "Owners can view leases of own properties" ON leases IS
  'SCI-aware via auth_user_entity_ids() helper. No recursion.';

-- 4c. INVOICES
DROP POLICY IF EXISTS "Owners can view invoices of own properties" ON invoices;

CREATE POLICY "Owners can view invoices of own properties"
  ON invoices FOR SELECT
  USING (
    owner_id = public.user_profile_id()
    OR entity_id IN (SELECT public.auth_user_entity_ids())
    OR lease_id IN (
      SELECT l.id
      FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.legal_entity_id IN (SELECT public.auth_user_entity_ids())
    )
  );

COMMENT ON POLICY "Owners can view invoices of own properties" ON invoices IS
  'SCI-aware via auth_user_entity_ids() helper. No recursion.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260410212232', 'fix_entity_members_policy_recursion')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260410212232_fix_entity_members_policy_recursion.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260410213940_fix_properties_tenant_policy_recursion.sql
-- Risk: MODERE
-- Why: +1 policies, -1 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260410213940_fix_properties_tenant_policy_recursion.sql'; END $pre$;

-- =====================================================
-- Migration: Fix "Tenants can view linked properties" policy recursion
-- Date: 2026-04-10
--
-- CONTEXT:
-- The "Tenants can view linked properties" SELECT policy on `properties`
-- (created by an older, unidentified migration) runs this EXISTS
-- subquery in its USING clause:
--
--   EXISTS (
--     SELECT 1 FROM leases l
--     JOIN lease_signers ls ON ls.lease_id = l.id
--     WHERE l.property_id = properties.id
--       AND ls.profile_id = user_profile_id()
--       AND l.statut <> ALL (ARRAY['draft', 'cancelled'])
--   )
--
-- Reading `leases` triggers the leases SELECT RLS, whose policies
-- ("Owners can view leases of own properties" and "leases_owner_all")
-- include an EXISTS subquery back into `properties`. That brings us
-- right back to this same policy → Postgres detects the cycle at
-- query-plan time and raises:
--
--   ERROR: 42P17 infinite recursion detected in policy for
--          relation "leases"
--
-- handleApiError (lib/helpers/api-error.ts:55-59) maps 42P17 to
-- HTTP 403 "Accès refusé", which is what Marie-Line saw on
-- /owner/invoices/[id] even though her profile_id is exactly the
-- invoice.owner_id. The cycle is detected at plan time, so even
-- rows that would match the simple `owner_id = user_profile_id()`
-- branch fail before they are evaluated.
--
-- FIX:
-- Replace the inline EXISTS subquery with a SECURITY DEFINER helper
-- function that bypasses RLS on `leases` and `lease_signers`. Same
-- pattern already used by is_lease_member() and is_lease_owner() in
-- 20251228230000_definitive_rls_fix.sql.
--
-- Safe to re-run (CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS).
-- =====================================================

-- =====================================================
-- 1. SECURITY DEFINER helper: property ids the current authenticated
--    user has access to as a tenant / signer on an active lease
-- =====================================================
CREATE OR REPLACE FUNCTION public.tenant_accessible_property_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT l.property_id
  FROM public.leases l
  JOIN public.lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = public.user_profile_id()
    AND l.statut NOT IN ('draft', 'cancelled');
$$;

COMMENT ON FUNCTION public.tenant_accessible_property_ids IS
  'Returns property ids that the currently authenticated user has access '
  'to as a tenant signer on an active (non-draft / non-cancelled) lease. '
  'SECURITY DEFINER to bypass RLS on leases and lease_signers and avoid '
  'the infinite recursion caused by using an inline EXISTS subquery in '
  'the properties SELECT policy.';

-- =====================================================
-- 2. Rewrite the "Tenants can view linked properties" policy to use
--    the helper — no more inline subquery on leases
-- =====================================================
DROP POLICY IF EXISTS "Tenants can view linked properties" ON properties;

CREATE POLICY "Tenants can view linked properties"
  ON properties FOR SELECT
  USING (id IN (SELECT public.tenant_accessible_property_ids()));

COMMENT ON POLICY "Tenants can view linked properties" ON properties IS
  'Tenants and co-tenants can read the property attached to any of their '
  'active leases. Uses the tenant_accessible_property_ids() SECURITY '
  'DEFINER helper to avoid recursion through the leases SELECT policy.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260410213940', 'fix_properties_tenant_policy_recursion')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260410213940_fix_properties_tenant_policy_recursion.sql'; END $post$;

COMMIT;

-- END OF BATCH 12/15 (Phase 2 MODERE)
