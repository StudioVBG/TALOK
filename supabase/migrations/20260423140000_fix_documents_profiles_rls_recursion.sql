-- =====================================================
-- Migration: Fix 42P17 infinite recursion on documents <-> profiles RLS
-- Date: 2026-04-23
--
-- CONTEXT:
--   HTTP 500 returned by PostgREST when the client hooks useDocuments,
--   useGedDocuments, useGedAlertsSummary query `documents` or
--   `v_owner_accessible_documents` from /owner/documents. The server-side
--   fetcher (app/owner/_data/fetchDocuments.ts) works around it by using
--   the service role and avoiding joins, but the workaround was never
--   ported to the RLS layer.
--
-- ROOT CAUSE — Cycle chain (diagnosed via pg_policies audit 2026-04-23):
--
--   (1) Client SELECT on documents
--   (2) documents policy "Tenants can read visible lease documents" evaluates:
--         EXISTS (SELECT 1 FROM lease_signers ls JOIN profiles p
--                 ON p.id = ls.profile_id
--                 WHERE ls.lease_id = documents.lease_id ...)
--         EXISTS (SELECT 1 FROM properties p
--                 WHERE p.id = documents.property_id AND p.owner_id = user_profile_id())
--   (3) The JOIN on profiles triggers profiles RLS policies, including:
--         "profiles_owner_read_tenants" (from 20260107150000)
--           USING EXISTS (
--             SELECT 1 FROM lease_signers ls
--             JOIN leases l ON l.id = ls.lease_id
--             JOIN properties p ON p.id = l.property_id
--             WHERE ls.profile_id = profiles.id
--               AND p.owner_id = get_my_profile_id()
--           )
--   (4) The SELECT on leases and properties triggers their RLS, which can
--       circle back to documents (via other cross-table policies) or at
--       minimum form a cycle detectable by PostgreSQL at plan time.
--   (5) Postgres raises ERROR 42P17 "infinite recursion detected in policy"
--       → Supabase returns HTTP 500.
--
-- Note: Using get_my_profile_id() / user_profile_id() (both SECURITY DEFINER)
--   avoids recursion on the `profiles` table itself but NOT on the joined
--   tables in the USING sub-SELECT. The planner sees the full cross-table
--   dependency graph and refuses to plan.
--
-- FIX — same pattern used by 20260410213940, 20260415140000, 20260418130000:
--   extract each inline EXISTS sub-SELECT into a SECURITY DEFINER helper.
--   The helper runs with definer privileges, which bypasses RLS on the
--   joined tables, breaking the cycle at the language level.
--
-- SEMANTICS PRESERVED:
--   - Tenants still read docs where tenant_id = me AND visible_tenant != false
--   - Tenants on a lease still read docs of that lease (visible_tenant = true)
--   - Owners still read docs owned by them or attached to their properties
--   - Admins still read all
--   - Owners still read tenant profiles tied to their active leases
--
--   Only the *plan shape* changes (helpers instead of inline EXISTS).
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. SECURITY DEFINER helpers
-- =====================================================

-- Helper: is the current auth user the owner of this property?
CREATE OR REPLACE FUNCTION public.is_owner_of_property(p_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = p_property_id
      AND owner_id = public.user_profile_id()
  );
$$;

REVOKE ALL ON FUNCTION public.is_owner_of_property(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_owner_of_property(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.is_owner_of_property(uuid) IS
  'Returns true if the current authenticated user is the owner of the given '
  'property. SECURITY DEFINER to bypass RLS on properties and avoid the '
  'documents <-> properties <-> leases cycle in RLS policies.';


-- Helper: is the current auth user a tenant signer on this lease?
CREATE OR REPLACE FUNCTION public.is_tenant_signer_of_lease(p_lease_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lease_signers
    WHERE lease_id = p_lease_id
      AND profile_id = public.user_profile_id()
      AND role IN ('locataire_principal', 'locataire', 'colocataire')
  );
$$;

REVOKE ALL ON FUNCTION public.is_tenant_signer_of_lease(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_signer_of_lease(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.is_tenant_signer_of_lease(uuid) IS
  'Returns true if the current authenticated user is a tenant / principal / '
  'colocataire signer on the given lease. SECURITY DEFINER to bypass RLS on '
  'lease_signers and avoid recursion through profiles RLS.';


-- Helper: is the given profile a tenant signer on any lease of a property I own?
CREATE OR REPLACE FUNCTION public.is_tenant_of_my_property(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lease_signers ls
    JOIN public.leases l ON l.id = ls.lease_id
    JOIN public.properties p ON p.id = l.property_id
    WHERE ls.profile_id = p_profile_id
      AND p.owner_id = public.user_profile_id()
  );
$$;

REVOKE ALL ON FUNCTION public.is_tenant_of_my_property(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_of_my_property(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.is_tenant_of_my_property(uuid) IS
  'Returns true if the given profile is a signer on any lease attached to a '
  'property owned by the current authenticated user. SECURITY DEFINER to '
  'bypass RLS on lease_signers / leases / properties and break the cycle '
  'that made profiles_owner_read_tenants recurse into documents RLS.';


-- =====================================================
-- 2. Rewrite documents SELECT policy using helpers
-- =====================================================

DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON public.documents;

CREATE POLICY "Tenants can read visible lease documents"
  ON public.documents FOR SELECT
  USING (
    -- Tenant direct match: respect visible_tenant
    (tenant_id = public.user_profile_id() AND visible_tenant IS NOT FALSE)
    -- Tenant via lease signer (SECURITY DEFINER helper, no cycle)
    OR (
      visible_tenant = true
      AND lease_id IS NOT NULL
      AND public.is_tenant_signer_of_lease(lease_id)
    )
    -- Owner direct match
    OR owner_id = public.user_profile_id()
    -- Owner via property (SECURITY DEFINER helper, no cycle)
    OR (
      property_id IS NOT NULL
      AND public.is_owner_of_property(property_id)
    )
    -- Admin
    OR public.user_role() = 'admin'
  );

COMMENT ON POLICY "Tenants can read visible lease documents" ON public.documents IS
  'SOTA 2026-04-23: unified SELECT policy covering tenants (direct + lease '
  'signer), owners (direct + property), and admin. Uses SECURITY DEFINER '
  'helpers (is_tenant_signer_of_lease, is_owner_of_property) instead of '
  'inline EXISTS to avoid the 42P17 recursion via profiles_owner_read_tenants.';


-- =====================================================
-- 3. Rewrite profiles_owner_read_tenants using helper
-- =====================================================

DROP POLICY IF EXISTS profiles_owner_read_tenants ON public.profiles;

CREATE POLICY profiles_owner_read_tenants
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_tenant_of_my_property(profiles.id));

COMMENT ON POLICY profiles_owner_read_tenants ON public.profiles IS
  'SOTA 2026-04-23: owners can read profiles of tenants attached to their '
  'properties. Uses is_tenant_of_my_property() SECURITY DEFINER helper '
  'instead of inline EXISTS on lease_signers/leases/properties — prevents '
  'the cycle that caused 42P17 when documents RLS joined profiles.';


-- =====================================================
-- 4. Sanity check: no inline cross-table EXISTS left on documents/profiles
--    (skip helper-based policies from our rewrite)
-- =====================================================
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('documents', 'profiles')
    AND (
      qual ILIKE '%JOIN profiles%'
      OR qual ILIKE '%JOIN lease_signers%'
      OR qual ILIKE '%JOIN leases%'
      OR qual ILIKE '%FROM leases%'
    )
    -- Exclude helper-based policies (safe)
    AND qual NOT ILIKE '%is_tenant_signer_of_lease%'
    AND qual NOT ILIKE '%is_owner_of_property%'
    AND qual NOT ILIKE '%is_tenant_of_my_property%'
    AND qual NOT ILIKE '%tenant_accessible_%'
    AND qual NOT ILIKE '%is_unit_accessible_%';

  IF v_count > 0 THEN
    RAISE WARNING
      'Still % RLS policies on documents/profiles with inline cross-table '
      'EXISTS — potential residual recursion. Audit pg_policies and port '
      'them to SECURITY DEFINER helpers.', v_count;
  ELSE
    RAISE NOTICE 'OK: no inline cross-table EXISTS left on documents/profiles policies';
  END IF;
END $$;


-- =====================================================
-- 5. Reload PostgREST schema cache
-- =====================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
