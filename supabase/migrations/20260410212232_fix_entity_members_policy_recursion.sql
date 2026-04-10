-- =====================================================
-- Migration: Fix entity_members RLS recursion
-- Date: 2026-04-10
--
-- CONTEXT:
-- The entity_members_admin_manage policy introduced in
-- 20260406200000_create_entities_view_and_members.sql:78-91 recursively
-- references the entity_members table in its own USING clause:
--
--   CREATE POLICY "entity_members_admin_manage" ON entity_members
--     FOR ALL TO authenticated
--     USING (
--       entity_id IN (
--         SELECT entity_id FROM entity_members em
--         WHERE em.user_id = auth.uid() AND em.role = 'admin'
--       )
--     )
--
-- This is fine in isolation (Postgres short-circuits on the simpler
-- own_access policy first for most queries), BUT as soon as ANOTHER
-- policy on a DIFFERENT table runs a subquery against entity_members
-- (e.g. the SCI-aware invoices SELECT policy added by
-- 20260410204528_extend_invoices_rls_for_sci_access.sql), Postgres
-- walks the admin_manage policy to check access, which kicks the
-- recursion and raises:
--
--   ERROR: 42P17 infinite recursion detected in policy for
--          relation "entity_members"
--
-- handleApiError (lib/helpers/api-error.ts:55-59) maps 42P17 to
-- HTTP 403 "Accès refusé", which is exactly what Marie-Line saw on
-- /owner/invoices/[id] for the SCI ATOMGISTE invoices after the
-- SCI-aware RLS migration landed.
--
-- FIX:
-- Replace the inline subquery with a SECURITY DEFINER helper function.
-- The function bypasses RLS on entity_members (because SECURITY
-- DEFINER runs with the owner's privileges) and therefore breaks the
-- recursion. It also becomes a single source of truth for "give me
-- the entities this authenticated user is a member of" and can be
-- reused by any other SCI-aware policy.
--
-- The admin_manage policy is also rewritten to use the helper, so the
-- recursion is eliminated at its source.
--
-- Safe to re-run (CREATE OR REPLACE + DROP IF EXISTS).
-- =====================================================

-- =====================================================
-- 1. Helper function: entities the authenticated user can access
-- =====================================================
CREATE OR REPLACE FUNCTION public.auth_user_entity_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT entity_id
  FROM public.entity_members
  WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.auth_user_entity_ids IS
  'Returns the set of legal_entity ids that the currently authenticated user '
  'is a member of. SECURITY DEFINER to bypass RLS on entity_members and '
  'avoid infinite recursion when used inside RLS policies of other tables.';

-- =====================================================
-- 2. Helper function: entities where the user is admin
-- =====================================================
CREATE OR REPLACE FUNCTION public.auth_user_admin_entity_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT entity_id
  FROM public.entity_members
  WHERE user_id = auth.uid()
    AND role = 'admin';
$$;

COMMENT ON FUNCTION public.auth_user_admin_entity_ids IS
  'Returns the set of legal_entity ids where the currently authenticated user '
  'has the admin role. SECURITY DEFINER to bypass RLS and avoid recursion.';

-- =====================================================
-- 3. Rewrite entity_members admin_manage policy without recursion
-- =====================================================
DROP POLICY IF EXISTS "entity_members_admin_manage" ON entity_members;

CREATE POLICY "entity_members_admin_manage" ON entity_members
  FOR ALL TO authenticated
  USING (entity_id IN (SELECT public.auth_user_admin_entity_ids()))
  WITH CHECK (entity_id IN (SELECT public.auth_user_admin_entity_ids()));

COMMENT ON POLICY "entity_members_admin_manage" ON entity_members IS
  'Admins of a legal_entity can fully manage its members. Uses the '
  'auth_user_admin_entity_ids() SECURITY DEFINER helper to avoid the '
  'infinite recursion caused by the previous inline subquery.';

-- =====================================================
-- 4. Rewrite the 3 SCI-aware SELECT policies to use the helper
-- =====================================================

-- 4a. PROPERTIES
DROP POLICY IF EXISTS "Owners can view own properties" ON properties;

CREATE POLICY "Owners can view own properties"
  ON properties FOR SELECT
  USING (
    owner_id = public.user_profile_id()
    OR legal_entity_id IN (SELECT public.auth_user_entity_ids())
  );

COMMENT ON POLICY "Owners can view own properties" ON properties IS
  'SCI-aware via auth_user_entity_ids() helper. No recursion.';

-- 4b. LEASES
DROP POLICY IF EXISTS "Owners can view leases of own properties" ON leases;

CREATE POLICY "Owners can view leases of own properties"
  ON leases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.owner_id = public.user_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.legal_entity_id IN (SELECT public.auth_user_entity_ids())
    )
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.legal_entity_id IN (SELECT public.auth_user_entity_ids())
    )
  );

COMMENT ON POLICY "Owners can view leases of own properties" ON leases IS
  'SCI-aware via auth_user_entity_ids() helper. No recursion.';

-- 4c. INVOICES
DROP POLICY IF EXISTS "Owners can view invoices of own properties" ON invoices;

CREATE POLICY "Owners can view invoices of own properties"
  ON invoices FOR SELECT
  USING (
    owner_id = public.user_profile_id()
    OR entity_id IN (SELECT public.auth_user_entity_ids())
    OR lease_id IN (
      SELECT l.id
      FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.legal_entity_id IN (SELECT public.auth_user_entity_ids())
    )
  );

COMMENT ON POLICY "Owners can view invoices of own properties" ON invoices IS
  'SCI-aware via auth_user_entity_ids() helper. No recursion.';
