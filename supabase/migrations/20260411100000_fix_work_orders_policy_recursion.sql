-- =====================================================
-- Migration: Fix work_orders RLS recursion via tickets/properties/leases
-- Date: 2026-04-11
--
-- CONTEXT:
-- The original "Owners can view work orders of own properties" SELECT
-- policy on `work_orders` (20240101000001_rls_policies.sql:427-436) runs
-- this EXISTS subquery in its USING clause:
--
--   EXISTS (
--     SELECT 1 FROM tickets t
--     JOIN properties p ON p.id = t.property_id
--     WHERE t.id = work_orders.ticket_id
--       AND p.owner_id = public.user_profile_id()
--   )
--
-- Reading `tickets` triggers the tickets SELECT RLS, which in turn
-- joins through `properties` — and `properties` now has the
-- "Tenants can view linked properties" policy that reads `leases`, and
-- `leases` policies read back into `properties`. Postgres sees the
-- whole graph at plan time and raises:
--
--   ERROR: 42P17 infinite recursion detected in policy for relation …
--
-- handleApiError (lib/helpers/api-error.ts) maps 42P17 to HTTP 500,
-- which is what the owner Tickets page observed as "Erreur lors du
-- chargement des interventions". Standalone work_orders (ticket_id
-- NULL) are also never visible to owners under this policy.
--
-- FIX:
-- Mirror the pattern used by 20260410213940_fix_properties_tenant_policy_recursion.sql:
-- replace the inline EXISTS subquery with a SECURITY DEFINER helper
-- that bypasses RLS on tickets/properties. The helper also covers
-- the standalone case (work_orders.owner_id matches the profile
-- directly, added by 20260408120000_providers_module_sota.sql).
--
-- Safe to re-run (CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS).
-- =====================================================

-- =====================================================
-- 1. SECURITY DEFINER helper: work_order ids the current authenticated
--    user can read as an owner (via ticket.property.owner_id OR direct
--    work_orders.owner_id for standalone orders).
-- =====================================================
CREATE OR REPLACE FUNCTION public.owner_accessible_work_order_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT wo.id
  FROM public.work_orders wo
  LEFT JOIN public.tickets t ON t.id = wo.ticket_id
  LEFT JOIN public.properties p ON p.id = COALESCE(wo.property_id, t.property_id)
  WHERE
    -- Standalone work_orders created through the providers module
    wo.owner_id = public.user_profile_id()
    -- Ticket-linked work_orders where the owner owns the property
    OR p.owner_id = public.user_profile_id();
$$;

COMMENT ON FUNCTION public.owner_accessible_work_order_ids IS
  'Returns work_order ids visible to the currently authenticated owner, '
  'either through a ticket on one of their properties or a standalone '
  'work_orders.owner_id match. SECURITY DEFINER to bypass RLS on tickets, '
  'properties and leases and avoid the infinite recursion triggered by '
  'nesting the tickets→properties→leases policies inside work_orders.';

-- =====================================================
-- 2. Rewrite the "Owners can view work orders of own properties"
--    policy to use the helper — no more inline subquery on tickets.
-- =====================================================
DROP POLICY IF EXISTS "Owners can view work orders of own properties" ON work_orders;

CREATE POLICY "Owners can view work orders of own properties"
  ON work_orders FOR SELECT
  USING (id IN (SELECT public.owner_accessible_work_order_ids()));

COMMENT ON POLICY "Owners can view work orders of own properties" ON work_orders IS
  'Owners can read work_orders attached to their properties (via the '
  'linked ticket) and the standalone ones they created themselves. Uses '
  'the owner_accessible_work_order_ids() SECURITY DEFINER helper to '
  'avoid recursion through the tickets/properties/leases policies.';
