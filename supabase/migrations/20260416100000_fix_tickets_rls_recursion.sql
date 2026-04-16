-- =====================================================
-- Migration: Fix tickets RLS infinite recursion (42P17)
-- Date: 2026-04-16
--
-- CONTEXT:
-- The "Users can view tickets of accessible properties" SELECT policy
-- on `tickets` (20260215200002_fix_rls_tenant_access_beyond_active.sql)
-- uses inline EXISTS subqueries that cause circular RLS evaluation:
--
--   EXISTS (
--     SELECT 1 FROM leases l
--     JOIN lease_signers ls ON ls.lease_id = l.id
--     WHERE l.property_id = tickets.property_id
--       AND ls.profile_id = user_profile_id()
--       AND l.statut IN ('active', 'notice_given')
--   )
--
-- Reading `leases` triggers leases SELECT RLS → which checks
-- `properties` RLS → which uses tenant_accessible_property_ids() →
-- reads `leases` again → Postgres detects the cycle at plan time:
--
--   ERROR: 42P17 infinite recursion detected in policy for
--          relation "tickets"
--
-- This breaks useTenantRealtime (500 on tickets query) and any
-- tenant-side ticket access.
--
-- FIX:
-- Replace the inline EXISTS on leases/lease_signers with a
-- SECURITY DEFINER helper function that bypasses RLS. Same pattern
-- used by tenant_accessible_property_ids() and
-- owner_accessible_work_order_ids().
--
-- Also fix the INSERT policy which has the same inline pattern.
--
-- Safe to re-run (CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS).
-- =====================================================

-- =====================================================
-- 1. SECURITY DEFINER helper: ticket ids the current authenticated
--    user can read as a tenant (via lease_signers on the same property)
-- =====================================================
CREATE OR REPLACE FUNCTION public.tenant_accessible_ticket_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT t.id
  FROM public.tickets t
  JOIN public.leases l ON l.property_id = t.property_id
  JOIN public.lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = public.user_profile_id()
    AND l.statut IN ('active', 'notice_given');
$$;

COMMENT ON FUNCTION public.tenant_accessible_ticket_ids IS
  'Returns ticket ids that the currently authenticated user can access '
  'as a tenant signer on an active or notice_given lease for the same '
  'property. SECURITY DEFINER to bypass RLS on leases and lease_signers '
  'and avoid the infinite recursion caused by the inline EXISTS subquery '
  'in the tickets SELECT policy.';

-- =====================================================
-- 2. SECURITY DEFINER helper: property ids the current user can
--    create tickets for as a tenant
-- =====================================================
CREATE OR REPLACE FUNCTION public.tenant_ticketable_property_ids()
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
    AND l.statut IN ('active', 'notice_given');
$$;

COMMENT ON FUNCTION public.tenant_ticketable_property_ids IS
  'Returns property ids where the current user is a tenant with an '
  'active or notice_given lease. Used for the tickets INSERT policy '
  'to avoid RLS recursion.';

-- =====================================================
-- 3. Rewrite SELECT policy — no more inline leases/profiles subqueries
-- =====================================================
DROP POLICY IF EXISTS "Users can view tickets of accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;

CREATE POLICY "Users can view tickets of accessible properties"
  ON tickets
  FOR SELECT
  USING (
    -- Creator of the ticket
    tickets.created_by_profile_id = public.user_profile_id()
    OR
    -- Owner of the property (direct check, no sub-select on properties)
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Tenant with active/notice_given lease (SECURITY DEFINER helper)
    tickets.id IN (SELECT public.tenant_accessible_ticket_ids())
    OR
    -- Provider assigned via work_order
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.ticket_id = tickets.id
        AND wo.provider_id = public.user_profile_id()
    )
    OR
    -- Admin (direct check on auth.uid(), no sub-select on profiles)
    public.user_profile_id() IN (
      SELECT p.id FROM profiles p WHERE p.id = public.user_profile_id() AND p.role = 'admin'
    )
  );

COMMENT ON POLICY "Users can view tickets of accessible properties" ON tickets IS
  'Unified SELECT policy for tickets. Uses tenant_accessible_ticket_ids() '
  'SECURITY DEFINER helper to avoid the infinite recursion through '
  'leases → properties → leases policies.';

-- =====================================================
-- 4. Rewrite INSERT policy — same recursion fix
-- =====================================================
DROP POLICY IF EXISTS "Users can create tickets for accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;

CREATE POLICY "Users can create tickets for accessible properties"
  ON tickets
  FOR INSERT
  WITH CHECK (
    -- Owner of the property
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Tenant with active/notice_given lease (SECURITY DEFINER helper)
    tickets.property_id IN (SELECT public.tenant_ticketable_property_ids())
    OR
    -- Admin
    public.user_profile_id() IN (
      SELECT p.id FROM profiles p WHERE p.id = public.user_profile_id() AND p.role = 'admin'
    )
  );

COMMENT ON POLICY "Users can create tickets for accessible properties" ON tickets IS
  'INSERT policy for tickets. Uses tenant_ticketable_property_ids() '
  'SECURITY DEFINER helper to avoid the infinite recursion.';

-- =====================================================
-- Log
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '[MIGRATION] Fix tickets RLS recursion — replaced inline leases/lease_signers EXISTS with SECURITY DEFINER helpers';
END $$;
