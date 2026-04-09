-- =====================================================
-- MIGRATION: Fix remaining RLS recursion on tables still using
--            direct sub-queries on profiles instead of get_my_profile_id()
-- Date: 2026-04-09
-- Problem: subscription_usage_metrics and api_webhook_deliveries still use
--          SELECT id FROM profiles WHERE user_id = auth.uid() in their RLS policies,
--          causing infinite recursion (42P17) when profiles table has RLS enabled.
-- Solution: Replace with public.get_my_profile_id() (SECURITY DEFINER, bypasses RLS).
-- =====================================================

-- ============================================
-- 1. FIX subscription_usage_metrics
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_usage_metrics') THEN
    DROP POLICY IF EXISTS "Owner can view own usage metrics" ON subscription_usage_metrics;
    CREATE POLICY "Owner can view own usage metrics" ON subscription_usage_metrics
      FOR SELECT TO authenticated
      USING (owner_id = public.get_my_profile_id());
  END IF;
END $$;

-- ============================================
-- 2. FIX api_webhook_deliveries
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_webhook_deliveries') THEN
    DROP POLICY IF EXISTS "webhook_deliveries_owner_access" ON api_webhook_deliveries;
    CREATE POLICY "webhook_deliveries_owner_access" ON api_webhook_deliveries
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM api_webhooks w
          WHERE w.id = api_webhook_deliveries.webhook_id
            AND w.profile_id = public.get_my_profile_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 3. FIX rgpd_consent_records (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rgpd_consent_records') THEN
    DROP POLICY IF EXISTS "consent_records_select_own" ON rgpd_consent_records;
    DROP POLICY IF EXISTS "consent_records_insert_own" ON rgpd_consent_records;
    CREATE POLICY "consent_records_select_own" ON rgpd_consent_records
      FOR SELECT TO authenticated
      USING (
        profile_id = public.get_my_profile_id()
      );
    CREATE POLICY "consent_records_insert_own" ON rgpd_consent_records
      FOR INSERT TO authenticated
      WITH CHECK (
        profile_id = public.get_my_profile_id()
      );
  END IF;
END $$;

-- ============================================
-- 4. FIX rgpd_data_requests (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rgpd_data_requests') THEN
    DROP POLICY IF EXISTS "data_requests_select_own" ON rgpd_data_requests;
    DROP POLICY IF EXISTS "data_requests_insert_own" ON rgpd_data_requests;
    DROP POLICY IF EXISTS "data_requests_update_own" ON rgpd_data_requests;
    CREATE POLICY "data_requests_select_own" ON rgpd_data_requests
      FOR SELECT TO authenticated
      USING (
        profile_id = public.get_my_profile_id()
      );
    CREATE POLICY "data_requests_insert_own" ON rgpd_data_requests
      FOR INSERT TO authenticated
      WITH CHECK (
        profile_id = public.get_my_profile_id()
      );
    CREATE POLICY "data_requests_update_own" ON rgpd_data_requests
      FOR UPDATE TO authenticated
      USING (
        profile_id = public.get_my_profile_id()
      );
  END IF;
END $$;

-- ============================================
-- 5. FIX rgpd_processing_activities (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rgpd_processing_activities') THEN
    DROP POLICY IF EXISTS "processing_activities_select_own" ON rgpd_processing_activities;
    CREATE POLICY "processing_activities_select_own" ON rgpd_processing_activities
      FOR SELECT TO authenticated
      USING (
        profile_id IN (SELECT public.get_my_profile_id())
      );
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '=== Migration RLS recursion fix (remaining tables) applied ===';
  RAISE NOTICE 'Fixed: subscription_usage_metrics, api_webhook_deliveries, rgpd_consent_records, rgpd_data_requests, rgpd_processing_activities';
  RAISE NOTICE 'Method: get_my_profile_id() SECURITY DEFINER instead of direct sub-queries';
END $$;
