-- ====================================================================
-- Sprint B2 — Phase 1 SAFE — Batch 7/10
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
-- Migration: 20260408110000_agency_hoguet.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408110000_agency_hoguet.sql'; END $pre$;

-- ============================================================================
-- Sprint 6: Agency Hoguet compliance columns
--
-- Adds Carte G (carte professionnelle gestion immobiliere) and caisse de
-- garantie information to legal_entities for Loi Hoguet compliance.
-- ============================================================================

ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_numero TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_expiry DATE;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie_numero TEXT;

-- Index for quick Hoguet compliance checks
CREATE INDEX IF NOT EXISTS idx_legal_entities_carte_g
  ON legal_entities (carte_g_numero)
  WHERE carte_g_numero IS NOT NULL;

COMMENT ON COLUMN legal_entities.carte_g_numero IS 'Numero de carte professionnelle G (gestion immobiliere) - Loi Hoguet';
COMMENT ON COLUMN legal_entities.carte_g_expiry IS 'Date expiration de la carte G';
COMMENT ON COLUMN legal_entities.caisse_garantie IS 'Nom de la caisse de garantie financiere';
COMMENT ON COLUMN legal_entities.caisse_garantie_numero IS 'Numero adhesion a la caisse de garantie';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408110000', 'agency_hoguet')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408110000_agency_hoguet.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260409150000_fix_signature_tracking_and_analytics.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260409150000_fix_signature_tracking_and_analytics.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Fix 2 SQL bugs (signature tracking + analytics view)
-- Date: 2026-04-09
-- =====================================================

-- ============================================================
-- BUG 2: "column reference period_month is ambiguous"
-- The RETURNS TABLE column `period_month` clashes with
-- subscription_usage.period_month in PL/pgSQL queries.
-- Fix: prefix all column references with the table name.
-- ============================================================

-- Fix get_signature_usage
CREATE OR REPLACE FUNCTION get_signature_usage(p_subscription_id UUID)
RETURNS TABLE (
  signatures_used INTEGER,
  signatures_limit INTEGER,
  signatures_remaining INTEGER,
  usage_percentage INTEGER,
  period_month TEXT,
  last_signature_at TIMESTAMPTZ
) AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
  v_last_at TIMESTAMPTZ;
BEGIN
  SELECT
    COALESCE(SUM(su.quantity), 0)::INTEGER,
    MAX(su.created_at)
  INTO v_used, v_last_at
  FROM subscription_usage su
  WHERE su.subscription_id = p_subscription_id
    AND su.usage_type = 'signature'
    AND su.period_month = v_current_month;

  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  v_limit := COALESCE(v_limit, 0);
  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    v_used,
    v_limit,
    CASE WHEN v_limit = -1 THEN 999999 ELSE GREATEST(0, v_limit - v_used) END,
    CASE
      WHEN v_limit = -1 THEN 0
      WHEN v_limit = 0 THEN 100
      ELSE LEAST(100, (v_used * 100) / NULLIF(v_limit, 0))
    END::INTEGER,
    v_current_month,
    v_last_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fix increment_signature_usage
CREATE OR REPLACE FUNCTION increment_signature_usage(
  p_subscription_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT COALESCE(SUM(su.quantity), 0)::INTEGER
  INTO v_used
  FROM subscription_usage su
  WHERE su.subscription_id = p_subscription_id
    AND su.usage_type = 'signature'
    AND su.period_month = v_current_month;

  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  IF v_limit != -1 AND (COALESCE(v_used, 0) + p_quantity) > v_limit THEN
    RETURN false;
  END IF;

  INSERT INTO subscription_usage (
    subscription_id, usage_type, quantity, period_month, metadata
  ) VALUES (
    p_subscription_id, 'signature', p_quantity, v_current_month, p_metadata
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix can_use_signature
CREATE OR REPLACE FUNCTION can_use_signature(p_subscription_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT COALESCE(SUM(su.quantity), 0)::INTEGER
  INTO v_used
  FROM subscription_usage su
  WHERE su.subscription_id = p_subscription_id
    AND su.usage_type = 'signature'
    AND su.period_month = v_current_month;

  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  IF v_limit = -1 THEN RETURN true; END IF;
  RETURN v_used < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- BUG 3: "column i.created_at must appear in the GROUP BY clause"
-- The mv_owner_monthly_stats materialized view was created with
-- IF NOT EXISTS, so it may be stale. Drop and recreate.
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_owner_monthly_stats;

CREATE MATERIALIZED VIEW mv_owner_monthly_stats AS
SELECT
  p.id AS owner_id,
  DATE_TRUNC('month', i.created_at) AS month,
  COUNT(DISTINCT prop.id) AS properties_count,
  COUNT(DISTINCT l.id) AS active_leases_count,
  COUNT(DISTINCT i.id) AS invoices_count,
  COALESCE(SUM(i.montant_total), 0) AS total_invoiced,
  COALESCE(SUM(CASE WHEN i.statut = 'paid' THEN i.montant_total ELSE 0 END), 0) AS total_collected,
  COALESCE(SUM(CASE WHEN i.statut = 'late' THEN i.montant_total ELSE 0 END), 0) AS total_late,
  COUNT(CASE WHEN i.statut = 'paid' THEN 1 END) AS paid_invoices_count,
  COUNT(CASE WHEN i.statut = 'late' THEN 1 END) AS late_invoices_count,
  ROUND(
    CASE
      WHEN COUNT(i.id) > 0
      THEN COUNT(CASE WHEN i.statut = 'paid' THEN 1 END)::DECIMAL / COUNT(i.id) * 100
      ELSE 0
    END, 2
  ) AS collection_rate
FROM profiles p
LEFT JOIN properties prop ON prop.owner_id = p.id
LEFT JOIN leases l ON l.property_id = prop.id AND l.statut = 'active'
LEFT JOIN invoices i ON i.owner_id = p.id
WHERE p.role = 'owner'
GROUP BY p.id, DATE_TRUNC('month', i.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_owner_monthly_stats
  ON mv_owner_monthly_stats(owner_id, month);


-- Verification
DO $$ BEGIN
  RAISE NOTICE 'Fixed: signature tracking period_month ambiguity + analytics GROUP BY';
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260409150000', 'fix_signature_tracking_and_analytics')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260409150000_fix_signature_tracking_and_analytics.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260410100000_accounting_missing_indexes.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260410100000_accounting_missing_indexes.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Accounting — missing indexes for hot queries
-- Date: 2026-04-10
--
-- Audit P2-4 follow-up. Adds composite / trigram indexes that
-- accelerate the three slowest owner-accounting queries:
--
--  1. Grand-livre par exercice + compte
--     (join accounting_entries × accounting_entry_lines filtered by
--      exercise_id and account_number)
--
--  2. Dashboard rapprochement bancaire
--     (bank_transactions filtered by connection_id + reconciliation_status
--      and sorted by transaction_date DESC)
--
--  3. Recherche plein-texte sur le libellé des écritures
--     (EntriesPageClient search input → ilike on accounting_entries.label)
--
-- All statements are idempotent (CREATE INDEX IF NOT EXISTS).
-- pg_trgm is already enabled by supabase/migrations/20240101000000_initial_schema.sql:6
-- so no CREATE EXTENSION is needed here.
-- =====================================================

-- ---------------------------------------------------------------
-- 1. Grand-livre acceleration
-- ---------------------------------------------------------------
-- `accounting_entry_lines` does NOT carry `exercise_id` (the exercise
-- lives on the parent `accounting_entries`), so the canonical composite
-- `(exercise_id, account_number)` would have to live on the parent
-- table. We add the two indexes that together cover the join:
--
--   SELECT ... FROM accounting_entry_lines l
--   JOIN accounting_entries e ON e.id = l.entry_id
--   WHERE e.exercise_id = $1 AND l.account_number LIKE $2
--   ORDER BY e.entry_date ASC;

CREATE INDEX IF NOT EXISTS idx_entries_exercise_date
  ON accounting_entries(exercise_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_entry_lines_account_entry
  ON accounting_entry_lines(account_number, entry_id);

-- ---------------------------------------------------------------
-- 2. Bank reconciliation dashboard
-- ---------------------------------------------------------------
-- `bank_transactions` has no `entity_id` column — the entity is
-- resolved via bank_connections. The composite index therefore uses
-- `connection_id` + `reconciliation_status` + `transaction_date`, which
-- matches /api/accounting/bank/reconciliation/route.ts query shape.

CREATE INDEX IF NOT EXISTS idx_bank_tx_connection_status_date
  ON bank_transactions(connection_id, reconciliation_status, transaction_date DESC);

-- ---------------------------------------------------------------
-- 3. Full-text search on entry labels
-- ---------------------------------------------------------------
-- Powers the search box in EntriesPageClient which runs
--   .or('label.ilike.%X%,piece_ref.ilike.%X%')
-- A GIN trigram index makes ILIKE %X% selective instead of a seq scan.
-- pg_trgm is enabled globally in 20240101000000_initial_schema.sql.

CREATE INDEX IF NOT EXISTS idx_entries_label_trgm
  ON accounting_entries USING gin(label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entries_piece_ref_trgm
  ON accounting_entries USING gin(piece_ref gin_trgm_ops);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260410100000', 'accounting_missing_indexes')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260410100000_accounting_missing_indexes.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260410110000_cleanup_orphan_analyses.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260410110000_cleanup_orphan_analyses.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Cleanup orphan document_analyses
-- Date: 2026-04-10
--
-- Audit P2-7 follow-up. `document_analyses` rows reference a
-- `document_id` that can be deleted from the `documents` table
-- independently (soft delete, user purge, tenant exit, etc.). When
-- that happens, the analysis row stays behind forever.
--
-- This migration adds:
--   1. A SECURITY DEFINER cleanup function that deletes analyses whose
--      parent document no longer exists AND that are older than 7 days
--      (the grace period gives the backfill / retry flows time to
--      re-link a recreated document without losing OCR work).
--   2. A weekly pg_cron schedule at 03:00 every Sunday. pg_cron is
--      already enabled project-wide via
--      supabase/migrations/20260304100000_activate_pg_cron_schedules.sql
--      so we can schedule in the same migration; if it were not, the
--      cron.schedule call would simply no-op and an admin would need to
--      activate pg_cron from the Supabase dashboard before re-running.
--
-- All statements are idempotent (CREATE OR REPLACE / DO-block guards).
-- =====================================================

-- ---------------------------------------------------------------
-- 1. Cleanup function
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_cleanup_orphan_document_analyses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.document_analyses da
  WHERE da.document_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.documents d WHERE d.id = da.document_id
    )
    AND da.created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION fn_cleanup_orphan_document_analyses IS
  'Supprime les lignes document_analyses dont le document parent '
  'n''existe plus depuis au moins 7 jours. Planifié via pg_cron '
  '(cron schedule: cleanup-orphan-analyses).';

-- ---------------------------------------------------------------
-- 2. Weekly schedule via pg_cron
-- ---------------------------------------------------------------
-- Runs every Sunday at 03:00 UTC. Wrapped in a DO block so the
-- migration stays idempotent and doesn't fail if pg_cron hasn't been
-- activated yet on this project — in that case it logs a NOTICE and
-- an admin can run the SELECT manually from the Supabase SQL editor
-- once pg_cron is enabled.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Unschedule any previous version with the same name, then reschedule.
    PERFORM cron.unschedule('cleanup-orphan-analyses')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphan-analyses'
    );

    PERFORM cron.schedule(
      'cleanup-orphan-analyses',
      '0 3 * * 0',
      $cron$SELECT public.fn_cleanup_orphan_document_analyses();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not installed; skipping schedule. '
      'Enable pg_cron from the Supabase dashboard and run:'
      E'\n  SELECT cron.schedule(''cleanup-orphan-analyses'', ''0 3 * * 0'', '
      E'''SELECT public.fn_cleanup_orphan_document_analyses();'');';
  END IF;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260410110000', 'cleanup_orphan_analyses')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260410110000_cleanup_orphan_analyses.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260410210341_fix_notify_tenant_invoice_created_user_id.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260410210341_fix_notify_tenant_invoice_created_user_id.sql'; END $pre$;

-- =====================================================
-- Migration: Fix notify_tenant_invoice_created — populate user_id
-- Date: 2026-04-10
--
-- CONTEXT:
-- The previous version of this trigger (migration
-- 20260305100000_fix_invoice_draft_notification.sql) rewrote the
-- function with a direct INSERT into notifications BUT forgot the
-- `user_id` column, which is NOT NULL (see
-- 20240101000009_tenant_advanced.sql:445 and
-- 20240101000021_add_notifications_table.sql:5).
--
-- Impact:
-- Every attempt to create an invoice with statut='sent' rolled back
-- because the AFTER INSERT trigger failed with:
--   null value in column "user_id" of relation "notifications"
--   violates not-null constraint
-- This made it impossible for generate_monthly_invoices(),
-- ensureInitialInvoiceForLease() or any other caller to produce an
-- invoice in 'sent' state. In practice, invoice generation was
-- silently broken in production since 2026-03-05.
--
-- FIX:
-- Recreate notify_tenant_invoice_created() to resolve the auth.users
-- id via profiles.user_id and include it in the INSERT.
-- Also protect against tenants that no longer have a linked user
-- (pr.user_id IS NOT NULL).
--
-- STATUS IN PRODUCTION:
-- The fix was already applied directly via SQL Editor during the
-- 2026-04-10 invoice-generation audit session. This migration records
-- the change in version control so it is reapplied on any rebuild.
-- Safe to re-run (CREATE OR REPLACE).
-- =====================================================

CREATE OR REPLACE FUNCTION notify_tenant_invoice_created()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
BEGIN
  -- Only notify for sent invoices (avoid drafts and already-paid ones).
  IF NEW.statut != 'sent' THEN
    RETURN NEW;
  END IF;

  -- Resolve the property address via the lease.
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = NEW.lease_id;

  -- Notify every tenant signer of the lease, joining profiles so we can
  -- populate the notifications.user_id NOT NULL column.
  FOR v_tenant IN
    SELECT DISTINCT ls.profile_id, pr.user_id
    FROM lease_signers ls
    JOIN profiles pr ON pr.id = ls.profile_id
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire')
      AND ls.profile_id IS NOT NULL
      AND pr.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (
      user_id,
      profile_id,
      type,
      title,
      message,
      link,
      metadata
    ) VALUES (
      v_tenant.user_id,
      v_tenant.profile_id,
      'invoice',
      'Nouvelle quittance disponible',
      'Quittance pour ' || v_property_address || ' - ' ||
        COALESCE(NEW.montant_total::text, '0') || '€',
      '/tenant/payments?invoice=' || NEW.id,
      jsonb_build_object(
        'invoice_id', NEW.id,
        'lease_id', NEW.lease_id,
        'montant', NEW.montant_total,
        'periode', NEW.periode
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_tenant_invoice_created IS
  'Creates a notification for every tenant signer when an invoice transitions '
  'to statut=sent. Resolves notifications.user_id via profiles.user_id to '
  'satisfy the NOT NULL constraint.';

-- The trigger itself was already created by 20260108200000 and is not
-- dropped/recreated here (CREATE OR REPLACE FUNCTION is enough to hot-swap
-- the implementation).

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260410210341', 'fix_notify_tenant_invoice_created_user_id')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260410210341_fix_notify_tenant_invoice_created_user_id.sql'; END $post$;

COMMIT;

-- END OF BATCH 7/10 (Phase 1 SAFE)
