-- Fix 42P17 infinite recursion on profiles <-> lease_signers
--
-- Recursion chain detected during Sprint B3 PASS 6.1 (login owner):
--   1. SELECT FROM profiles triggers profiles_owner_read_tenants
--   2. Its USING clause sub-SELECTs lease_signers
--   3. lease_signers_tenant_view_for_doc_center USING sub-SELECTs profiles
--   => two-hop infinite recursion
--
-- Fix: rewrite lease_signers_tenant_view_for_doc_center to use the SECURITY
-- DEFINER helper public.get_my_profile_id() which bypasses RLS on profiles.
-- Semantics preserved: "tenant can see their own lease_signers rows".

DROP POLICY IF EXISTS lease_signers_tenant_view_for_doc_center ON public.lease_signers;

CREATE POLICY lease_signers_tenant_view_for_doc_center
  ON public.lease_signers
  FOR SELECT
  TO authenticated
  USING (profile_id = public.get_my_profile_id());
