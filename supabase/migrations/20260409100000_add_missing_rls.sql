-- ==========================================================
-- Migration: Add missing RLS to 8 unprotected tables
-- Date: 2026-04-09
-- Context: Audit express identified 8 tables without RLS
-- ==========================================================

-- ──────────────────────────────────────────────
-- 1. tenants (system multi-tenant table, no user column)
-- Admin-only access via service role
-- ──────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_admin_only"
  ON tenants FOR ALL
  USING (false);
-- Service role bypasses RLS; app code uses service client for admin ops

-- ──────────────────────────────────────────────
-- 2. two_factor_sessions (security-critical, has user_id)
-- ──────────────────────────────────────────────
ALTER TABLE two_factor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_2fa_sessions"
  ON two_factor_sessions FOR ALL
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 3. lease_templates (system-wide templates, read-only for users)
-- ──────────────────────────────────────────────
ALTER TABLE lease_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_templates_read_authenticated"
  ON lease_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "lease_templates_write_admin_only"
  ON lease_templates FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 4. idempotency_keys (API utility, no user column)
-- ──────────────────────────────────────────────
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idempotency_keys_service_only"
  ON idempotency_keys FOR ALL
  USING (false);
-- Only accessed via service role in API middleware

-- ──────────────────────────────────────────────
-- 5. repair_cost_grid (reference table, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE repair_cost_grid ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repair_cost_grid_read_authenticated"
  ON repair_cost_grid FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "repair_cost_grid_write_admin_only"
  ON repair_cost_grid FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 6. vetuste_grid (reference table for depreciation, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE vetuste_grid ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vetuste_grid_read_authenticated"
  ON vetuste_grid FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "vetuste_grid_write_admin_only"
  ON vetuste_grid FOR ALL
  USING (false);

-- ──────────────────────────────────────────────
-- 7. vetusty_grid (variant of vetuste_grid, read-only)
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_grid') THEN
    ALTER TABLE vetusty_grid ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_grid') THEN
    EXECUTE 'CREATE POLICY "vetusty_grid_read_authenticated" ON vetusty_grid FOR SELECT USING (auth.role() = ''authenticated'')';
    EXECUTE 'CREATE POLICY "vetusty_grid_write_admin_only" ON vetusty_grid FOR ALL USING (false)';
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- 8. api_webhook_deliveries (indirect user link via webhook_id)
-- ──────────────────────────────────────────────
ALTER TABLE api_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_deliveries_owner_access"
  ON api_webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_webhooks w
      WHERE w.id = api_webhook_deliveries.webhook_id
        AND w.profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "webhook_deliveries_write_service_only"
  ON api_webhook_deliveries FOR INSERT
  WITH CHECK (false);
-- Deliveries are created by the system (service role), users can only read their own
