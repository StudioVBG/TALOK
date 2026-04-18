-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 11/15
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
-- Migration: 20260408130000_fix_subscription_plan_prices.sql
-- Note: file on disk is 20260408130000_fix_subscription_plan_prices.sql but will be renamed to 20260408130005_fix_subscription_plan_prices.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408130000_fix_subscription_plan_prices.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408130005', 'fix_subscription_plan_prices')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408130000_fix_subscription_plan_prices.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408130000_rgpd_consent_records_and_data_requests.sql
-- Note: file on disk is 20260408130000_rgpd_consent_records_and_data_requests.sql but will be renamed to 20260408130009_rgpd_consent_records_and_data_requests.sql
-- Risk: MODERE
-- Why: +5 policies, UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408130000_rgpd_consent_records_and_data_requests.sql'; END $pre$;

-- Migration RGPD : consent_records (historique granulaire) + data_requests (demandes export/suppression)
-- Complète la table user_consents existante avec un historique versionné

-- ============================================
-- 1. consent_records : historique granulaire des consentements
-- ============================================
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'cgu', 'privacy_policy', 'marketing', 'analytics',
    'cookies_functional', 'cookies_analytics'
  )),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  version TEXT NOT NULL
);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consent records"
  ON consent_records FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own consent records"
  ON consent_records FOR INSERT
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_consent_records_profile_id ON consent_records(profile_id);
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);

-- ============================================
-- 2. data_requests : demandes RGPD (export, suppression, rectification)
-- ============================================
CREATE TABLE IF NOT EXISTS data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'deletion', 'rectification')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason TEXT,
  completed_at TIMESTAMPTZ,
  download_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data requests"
  ON data_requests FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own data requests"
  ON data_requests FOR INSERT
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own pending data requests"
  ON data_requests FOR UPDATE
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status = 'pending'
  );

CREATE INDEX idx_data_requests_profile_id ON data_requests(profile_id);
CREATE INDEX idx_data_requests_status ON data_requests(status);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408130009', 'rgpd_consent_records_and_data_requests')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408130000_rgpd_consent_records_and_data_requests.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260409100000_add_missing_rls.sql
-- Risk: MODERE
-- Why: +13 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260409100000_add_missing_rls.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260409100000', 'add_missing_rls')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260409100000_add_missing_rls.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260409120000_fix_subscriptions_rls_recursion.sql
-- Risk: MODERE
-- Why: +3 policies, -3 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260409120000_fix_subscriptions_rls_recursion.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Ensure subscriptions RLS uses get_my_profile_id() (no recursion)
-- Date: 2026-04-09
-- Problem: The "Owners can view their subscription" policy may still use a direct
--          sub-query on profiles (SELECT id FROM profiles WHERE user_id = auth.uid()),
--          which triggers infinite recursion (42P17) when profiles RLS is active.
--          Additionally, subscriptions has no INSERT/UPDATE policies for owners,
--          meaning writes must go through service_role only (which is correct).
-- Solution: Idempotently replace the SELECT policy with get_my_profile_id() (SECURITY DEFINER).
-- =====================================================

-- 1. Drop and recreate the owner SELECT policy to guarantee it uses get_my_profile_id()
DROP POLICY IF EXISTS "Owners can view their subscription" ON subscriptions;
CREATE POLICY "Owners can view their subscription" ON subscriptions
  FOR SELECT TO authenticated
  USING (owner_id = public.get_my_profile_id());

-- 2. Ensure admin policy also uses is_admin() (SECURITY DEFINER)
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin());

-- 3. Fix subscription_addon_subscriptions if it exists (may also have recursion)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_addon_subscriptions') THEN
    DROP POLICY IF EXISTS "addon_subs_owner_select" ON subscription_addon_subscriptions;
    CREATE POLICY "addon_subs_owner_select" ON subscription_addon_subscriptions
      FOR SELECT TO authenticated
      USING (
        subscription_id IN (
          SELECT id FROM subscriptions
          WHERE owner_id = public.get_my_profile_id()
        )
      );
  END IF;
END $$;

-- 4. Verification
DO $$
BEGIN
  RAISE NOTICE '=== Migration: subscriptions RLS recursion fix applied ===';
  RAISE NOTICE 'Policies replaced: Owners can view their subscription, Admins can view all subscriptions';
  RAISE NOTICE 'Method: get_my_profile_id() / is_admin() SECURITY DEFINER';
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260409120000', 'fix_subscriptions_rls_recursion')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260409120000_fix_subscriptions_rls_recursion.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260409140000_fix_addons_sms_rls_recursion.sql
-- Risk: MODERE
-- Why: +2 policies, -2 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260409140000_fix_addons_sms_rls_recursion.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Fix RLS on subscription_addons & sms_usage
-- Date: 2026-04-09
-- Problem: Both tables use `profile_id = auth.uid()` which is WRONG.
--          `profile_id` references `profiles.id` (a profile UUID),
--          while `auth.uid()` returns the user's auth UUID (user_id).
--          These are DIFFERENT values, so the condition NEVER matches
--          and users can never see their own data.
-- Solution: Replace with `profile_id = public.get_my_profile_id()`
--           which is SECURITY DEFINER and returns the correct profiles.id.
-- =====================================================

-- 1. Fix subscription_addons
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_addons') THEN
    DROP POLICY IF EXISTS "Users can view their own addons" ON subscription_addons;
    CREATE POLICY "Users can view their own addons" ON subscription_addons
      FOR SELECT TO authenticated
      USING (profile_id = public.get_my_profile_id());
  END IF;
END $$;

-- 2. Fix sms_usage
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sms_usage') THEN
    DROP POLICY IF EXISTS "Users can view their own sms usage" ON sms_usage;
    CREATE POLICY "Users can view their own sms usage" ON sms_usage
      FOR SELECT TO authenticated
      USING (profile_id = public.get_my_profile_id());
  END IF;
END $$;

-- 3. Verification
DO $$
BEGIN
  RAISE NOTICE '=== Migration: subscription_addons & sms_usage RLS fixed ===';
  RAISE NOTICE 'Changed: profile_id = auth.uid() → profile_id = public.get_my_profile_id()';
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260409140000', 'fix_addons_sms_rls_recursion')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260409140000_fix_addons_sms_rls_recursion.sql'; END $post$;

COMMIT;

-- END OF BATCH 11/15 (Phase 2 MODERE)
