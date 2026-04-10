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
