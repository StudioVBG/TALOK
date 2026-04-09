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
