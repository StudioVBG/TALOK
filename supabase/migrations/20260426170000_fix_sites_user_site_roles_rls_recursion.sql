-- =====================================================
-- Migration: Fix 42P17 infinite recursion on sites <-> user_site_roles
-- Date: 2026-04-26
-- Branche: claude/fix-document-api-query-CRrzG
--
-- CONTEXT:
--   PostgREST returns HTTP 500 with
--     `infinite recursion detected in policy for relation "sites"`
--   on every SELECT against `documents` from /owner/documents
--   (useGedDocuments / useGedAlertsSummary).
--
-- ROOT CAUSE — Cycle chain (audited 2026-04-26):
--
--   (1) Client SELECT on documents.
--       PostgREST evaluates ALL SELECT policies on documents combined with
--       OR — even for an owner who is NOT a coproprietaire, every policy
--       USING clause is planned and may touch RLS on referenced tables.
--
--   (2) Policy `documents_coproprietaire_select`
--       (migration 20260412110000_documents_copro_fk.sql) evaluates:
--         copro_site_id IN (
--           SELECT usr.site_id FROM public.user_site_roles usr
--           WHERE usr.user_id = auth.uid()
--             AND usr.role_code IN ('coproprietaire', ...)
--         )
--
--   (3) The inline SELECT on `user_site_roles` triggers its RLS, including
--       `user_site_roles_select` (migration 20251208000000):
--         user_id = auth.uid()
--         OR EXISTS (
--           SELECT 1 FROM sites s
--           WHERE s.id = site_id
--             AND s.syndic_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
--         )
--
--   (4) The EXISTS on `sites` triggers its RLS, including
--       `sites_coproprietaire_select`:
--         EXISTS (
--           SELECT 1 FROM user_site_roles usr
--           WHERE usr.site_id = sites.id AND usr.user_id = auth.uid()
--         )
--
--   (5) `sites_coproprietaire_select` queries `user_site_roles` again
--       → Postgres planner detects the cycle → ERROR 42P17.
--
--   (Same cycle is reachable via documents_syndic_copro_select.)
--
-- FIX (same pattern as 20260423140000_fix_documents_profiles_rls_recursion):
--   Replace every inline cross-table EXISTS / IN-subquery in the policies
--   along the cycle with SECURITY DEFINER helpers. Definer functions
--   bypass RLS on the joined tables, breaking the cycle at the language
--   level, while preserving exact authorization semantics.
--
-- SEMANTICS PRESERVED:
--   - Syndic still sees / mutates sites where syndic_profile_id = me
--   - Coproprietaire still sees sites they belong to via user_site_roles
--   - Admin still sees everything
--   - Syndic still sees / mutates user_site_roles for sites they manage
--   - Documents copro RLS unchanged in semantics, only plan shape differs
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. SECURITY DEFINER helpers
-- =====================================================

-- Helper: list site_ids where current auth user is the syndic.
-- Bypasses sites RLS to avoid the sites <-> user_site_roles cycle.
CREATE OR REPLACE FUNCTION public.current_user_syndic_site_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id
  FROM public.sites s
  WHERE s.syndic_profile_id = public.user_profile_id();
$$;

REVOKE ALL ON FUNCTION public.current_user_syndic_site_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_syndic_site_ids()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.current_user_syndic_site_ids() IS
  'Returns site ids where the current authenticated user is the syndic. '
  'SECURITY DEFINER to bypass sites RLS and break the sites <-> '
  'user_site_roles cycle that caused 42P17 on /owner/documents.';


-- Helper: is current auth user the syndic of the given site?
CREATE OR REPLACE FUNCTION public.is_syndic_of_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sites
    WHERE id = p_site_id
      AND syndic_profile_id = public.user_profile_id()
  );
$$;

REVOKE ALL ON FUNCTION public.is_syndic_of_site(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_syndic_of_site(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.is_syndic_of_site(uuid) IS
  'Returns true if current authenticated user is the syndic of the given '
  'site. SECURITY DEFINER, breaks sites <-> user_site_roles cycle.';


-- Helper: list site_ids where current auth user has any role in
-- user_site_roles. Optionally filtered by role_codes (NULL = any role).
-- Bypasses user_site_roles RLS to avoid the cycle.
CREATE OR REPLACE FUNCTION public.current_user_site_ids(p_role_codes text[] DEFAULT NULL)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT usr.site_id
  FROM public.user_site_roles usr
  WHERE usr.user_id = auth.uid()
    AND (p_role_codes IS NULL OR usr.role_code = ANY(p_role_codes));
$$;

REVOKE ALL ON FUNCTION public.current_user_site_ids(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_site_ids(text[])
  TO authenticated, service_role;

COMMENT ON FUNCTION public.current_user_site_ids(text[]) IS
  'Returns site ids where current authenticated user has any role (or one '
  'of the given roles) in user_site_roles. SECURITY DEFINER, bypasses '
  'user_site_roles RLS to break the sites <-> user_site_roles cycle.';


-- Helper: does current auth user have any role on the given site?
CREATE OR REPLACE FUNCTION public.is_user_in_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_site_roles
    WHERE site_id = p_site_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_user_in_site(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_in_site(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.is_user_in_site(uuid) IS
  'Returns true if current authenticated user has any role on the given '
  'site. SECURITY DEFINER, breaks sites <-> user_site_roles cycle.';


-- =====================================================
-- 2. Rewrite sites RLS policies using helpers
-- =====================================================

DROP POLICY IF EXISTS "sites_syndic_all" ON public.sites;
CREATE POLICY "sites_syndic_all" ON public.sites
  FOR ALL
  USING (syndic_profile_id = public.user_profile_id())
  WITH CHECK (syndic_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "sites_coproprietaire_select" ON public.sites;
CREATE POLICY "sites_coproprietaire_select" ON public.sites
  FOR SELECT
  USING (public.is_user_in_site(id));

DROP POLICY IF EXISTS "sites_admin_all" ON public.sites;
CREATE POLICY "sites_admin_all" ON public.sites
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =====================================================
-- 3. Rewrite user_site_roles RLS policies using helpers
-- =====================================================

DROP POLICY IF EXISTS "user_site_roles_select" ON public.user_site_roles;
CREATE POLICY "user_site_roles_select" ON public.user_site_roles
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_syndic_of_site(site_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "user_site_roles_syndic_manage" ON public.user_site_roles;
CREATE POLICY "user_site_roles_syndic_manage" ON public.user_site_roles
  FOR ALL
  USING (public.is_syndic_of_site(site_id) OR public.is_admin())
  WITH CHECK (public.is_syndic_of_site(site_id) OR public.is_admin());


-- =====================================================
-- 4. Rewrite documents copro policies using helpers
--    (avoids re-evaluating sites/user_site_roles RLS for every documents row)
-- =====================================================

DROP POLICY IF EXISTS "documents_syndic_copro_select" ON public.documents;
CREATE POLICY "documents_syndic_copro_select"
  ON public.documents
  FOR SELECT TO authenticated
  USING (
    copro_site_id IS NOT NULL
    AND copro_site_id IN (SELECT public.current_user_syndic_site_ids())
  );

DROP POLICY IF EXISTS "documents_syndic_copro_insert" ON public.documents;
CREATE POLICY "documents_syndic_copro_insert"
  ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    copro_site_id IS NULL
    OR copro_site_id IN (SELECT public.current_user_syndic_site_ids())
  );

DROP POLICY IF EXISTS "documents_syndic_copro_update" ON public.documents;
CREATE POLICY "documents_syndic_copro_update"
  ON public.documents
  FOR UPDATE TO authenticated
  USING (
    copro_site_id IS NOT NULL
    AND copro_site_id IN (SELECT public.current_user_syndic_site_ids())
  );

DROP POLICY IF EXISTS "documents_coproprietaire_select" ON public.documents;
CREATE POLICY "documents_coproprietaire_select"
  ON public.documents
  FOR SELECT TO authenticated
  USING (
    copro_site_id IS NOT NULL
    AND copro_site_id IN (
      SELECT public.current_user_site_ids(
        ARRAY['coproprietaire', 'coproprietaire_bailleur', 'conseil_syndical']
      )
    )
  );


-- =====================================================
-- 5. Sanity check — no inline cross-table EXISTS left
--    on sites / user_site_roles / documents copro policies
-- =====================================================
DO $$
DECLARE
  v_count INT;
  v_row RECORD;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (tablename = 'sites' AND (
        qual ILIKE '%FROM user_site_roles%'
        OR qual ILIKE '%FROM public.user_site_roles%'
      ))
      OR (tablename = 'user_site_roles' AND (
        qual ILIKE '%FROM sites%'
        OR qual ILIKE '%FROM public.sites%'
      ))
      OR (tablename = 'documents' AND policyname IN (
        'documents_syndic_copro_select',
        'documents_syndic_copro_insert',
        'documents_syndic_copro_update',
        'documents_coproprietaire_select'
      ) AND (
        qual ILIKE '%FROM sites%'
        OR qual ILIKE '%FROM user_site_roles%'
        OR qual ILIKE '%FROM public.sites%'
        OR qual ILIKE '%FROM public.user_site_roles%'
        OR qual ILIKE '%FROM profiles%'
      ))
    );

  IF v_count > 0 THEN
    FOR v_row IN
      SELECT tablename, policyname, qual
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('sites', 'user_site_roles', 'documents')
        AND (
          qual ILIKE '%FROM sites%'
          OR qual ILIKE '%FROM user_site_roles%'
          OR qual ILIKE '%FROM public.sites%'
          OR qual ILIKE '%FROM public.user_site_roles%'
        )
    LOOP
      RAISE WARNING '[residual cycle risk] %.% — qual: %',
        v_row.tablename, v_row.policyname, v_row.qual;
    END LOOP;
    RAISE WARNING
      'Still % RLS policies with inline cross-table EXISTS between sites '
      'and user_site_roles — potential residual recursion.', v_count;
  ELSE
    RAISE NOTICE 'OK: sites <-> user_site_roles cycle broken via SECURITY DEFINER helpers';
  END IF;
END $$;


-- =====================================================
-- 6. Reload PostgREST schema cache
-- =====================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
