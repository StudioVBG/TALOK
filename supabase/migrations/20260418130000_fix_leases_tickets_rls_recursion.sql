-- Fix 42P17 infinite recursion on leases and tickets
--
-- Sprint B3 PASS 6 revealed 2 remaining RLS cycles after the lease_signers fix:
--
--   Cycle 1 — leases <-> units:
--     leases: "Owners can view leases of own properties"
--       USING ... EXISTS (FROM units u JOIN properties p ...)
--     units : "Users can view units of accessible properties"
--       USING ... EXISTS (FROM leases l JOIN lease_signers ls ...)
--     => when evaluating leases policies, units sub-SELECT triggers units
--        policies, one of which sub-SELECTs leases again.
--
--   Cycle 2 — tickets <-> work_orders:
--     tickets     : "Users can view tickets of accessible properties"
--       USING ... EXISTS (FROM work_orders wo WHERE wo.provider_id = X)
--     work_orders : owners_view_work_orders, tenants_view_work_orders
--       USING ... EXISTS (FROM tickets t ...)
--     => symmetric cycle.
--
-- Fix: replace the cross-table sub-SELECTs with SECURITY DEFINER helpers,
-- which bypass RLS and therefore cannot re-enter the caller's table.
-- Semantics preserved in each case.

-- =====================================================================
-- Cycle 1 fix: units tenant visibility via SECURITY DEFINER helper
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_unit_accessible_to_tenant(
  p_unit_id uuid,
  p_property_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leases l
    JOIN public.lease_signers ls ON ls.lease_id = l.id
    WHERE (l.property_id = p_property_id OR l.unit_id = p_unit_id)
      AND ls.profile_id = public.user_profile_id()
      AND l.statut <> ALL (ARRAY['draft'::text, 'cancelled'::text])
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_unit_accessible_to_tenant(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view units of accessible properties" ON public.units;

CREATE POLICY "Users can view units of accessible properties" ON public.units
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = units.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR public.is_unit_accessible_to_tenant(units.id, units.property_id)
    OR public.is_admin_user()
  );

-- =====================================================================
-- Cycle 2 fix: work_orders and tickets via SECURITY DEFINER helpers
-- =====================================================================

-- Helper: ticket is assigned to me as a provider
CREATE OR REPLACE FUNCTION public.is_ticket_provider(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.ticket_id = p_ticket_id
      AND wo.provider_id = public.user_profile_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ticket_provider(uuid) TO authenticated;

-- Helper: work_order's ticket belongs to one of my properties (as owner)
CREATE OR REPLACE FUNCTION public.work_order_is_for_my_property(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tickets t
    JOIN public.properties p ON p.id = t.property_id
    WHERE t.id = p_ticket_id
      AND p.owner_id = public.current_user_profile_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.work_order_is_for_my_property(uuid) TO authenticated;

-- Helper: work_order's ticket was created by me (tenant side)
CREATE OR REPLACE FUNCTION public.work_order_ticket_created_by_me(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = p_ticket_id
      AND t.created_by_profile_id = public.current_user_profile_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.work_order_ticket_created_by_me(uuid) TO authenticated;

-- Rewrite tickets SELECT policy without the work_orders sub-SELECT
DROP POLICY IF EXISTS "Users can view tickets of accessible properties" ON public.tickets;

CREATE POLICY "Users can view tickets of accessible properties" ON public.tickets
  FOR SELECT
  TO authenticated
  USING (
    created_by_profile_id = public.user_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR tickets.id IN (SELECT public.tenant_accessible_ticket_ids())
    OR public.is_ticket_provider(tickets.id)
    OR public.is_admin_user()
  );

-- Rewrite tickets INSERT policy without the profiles sub-SELECT admin branch
-- (redundant with is_admin_user() which is SECURITY DEFINER)
DROP POLICY IF EXISTS "Users can create tickets for accessible properties" ON public.tickets;

CREATE POLICY "Users can create tickets for accessible properties" ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR tickets.property_id IN (SELECT public.tenant_ticketable_property_ids())
    OR public.is_admin_user()
  );

-- Rewrite work_orders policies that sub-SELECT tickets, using helpers
DROP POLICY IF EXISTS owners_view_work_orders ON public.work_orders;
CREATE POLICY owners_view_work_orders ON public.work_orders
  FOR SELECT
  TO authenticated
  USING (public.work_order_is_for_my_property(work_orders.ticket_id));

DROP POLICY IF EXISTS owners_update_work_orders ON public.work_orders;
CREATE POLICY owners_update_work_orders ON public.work_orders
  FOR UPDATE
  TO authenticated
  USING (public.work_order_is_for_my_property(work_orders.ticket_id));

DROP POLICY IF EXISTS owners_create_work_orders ON public.work_orders;
CREATE POLICY owners_create_work_orders ON public.work_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (public.work_order_is_for_my_property(work_orders.ticket_id));

DROP POLICY IF EXISTS tenants_view_work_orders ON public.work_orders;
CREATE POLICY tenants_view_work_orders ON public.work_orders
  FOR SELECT
  TO authenticated
  USING (public.work_order_ticket_created_by_me(work_orders.ticket_id));
