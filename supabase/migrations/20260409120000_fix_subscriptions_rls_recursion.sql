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
