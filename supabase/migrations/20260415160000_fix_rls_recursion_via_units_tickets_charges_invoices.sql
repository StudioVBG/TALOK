-- =====================================================
-- Migration: Fix V2 — Récursion RLS résiduelle via units/tickets/charges/invoices
-- Date: 2026-04-15
-- Branche: claude/fix-tenant-payment-signing-UuhJr (follow-up)
--
-- CONTEXTE:
--   La migration précédente (20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql)
--   a cassé la chaîne leases → properties → leases en droppant la policy
--   redondante "tenant_select_properties". Mais une autre chaîne de
--   récursion subsiste, observée en production :
--
--     GET /rest/v1/leases?... → 500
--     GET /rest/v1/invoices?... → 500
--     GET /rest/v1/tickets?... → 500
--     [useTenantRealtime] leases error: infinite recursion detected in
--                                        policy for relation "leases"
--
-- CHAÎNE DE RÉCURSION RÉELLE:
--   (1) Tenant SELECT FROM leases
--   (2) Policy "Owners can view leases of own properties" (20260410212232)
--       fait EXISTS(units u JOIN properties p WHERE u.id = leases.unit_id ...)
--       ← lit `units` inline (branches 2 et 4)
--   (3) Postgres évalue les policies de `units`. Parmi elles,
--       "Users can view units of accessible properties" (20260215200002)
--       fait EXISTS(leases l JOIN lease_signers ls WHERE l.property_id = units.property_id ...)
--       ← lit `leases` inline
--   (4) → CYCLE leases → units → leases → 42P17
--
-- MÊMES CHAÎNES via:
--   - tickets  → EXISTS(leases JOIN lease_signers) ← branche tenant (20260215200002:102)
--   - charges  → EXISTS(leases JOIN lease_signers) ← branche tenant (20260215200002:64)
--   - invoices → lease_id IN (SELECT FROM leases JOIN properties) ← branche SCI (20260410212232:162)
--
-- FIX:
--   Remplacer les 4 EXISTS(leases) inline par des appels à des helpers
--   SECURITY DEFINER qui bypassent les RLS de leases/lease_signers.
--   Helpers créés (en plus de tenant_accessible_property_ids() déjà présent):
--     - tenant_accessible_unit_ids()  : unit_ids du tenant (pour le check via units.id)
--     - sci_accessible_lease_ids()    : lease_ids d'une legal_entity (SCI)
--
-- Safe to re-run (CREATE OR REPLACE / DROP IF EXISTS partout).
-- =====================================================

BEGIN;

-- ============================================================
-- 1. Helpers SECURITY DEFINER
-- ============================================================

-- 1a. Unit ids accessibles au tenant via lease.unit_id
CREATE OR REPLACE FUNCTION public.tenant_accessible_unit_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT l.unit_id
  FROM public.leases l
  JOIN public.lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = public.user_profile_id()
    AND l.unit_id IS NOT NULL
    AND l.statut NOT IN ('draft', 'cancelled');
$$;

COMMENT ON FUNCTION public.tenant_accessible_unit_ids() IS
  'SOTA 2026 — Unit ids accessibles au profil authentifié via lease.unit_id '
  'sur un bail non-draft/non-cancelled. SECURITY DEFINER pour bypasser les '
  'RLS de leases/lease_signers et éviter la récursion leases → units → leases.';

REVOKE ALL ON FUNCTION public.tenant_accessible_unit_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_accessible_unit_ids()
  TO authenticated, service_role;

-- 1b. Lease ids accessibles via une legal_entity (SCI, SARL, agence)
CREATE OR REPLACE FUNCTION public.sci_accessible_lease_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.id
  FROM public.leases l
  JOIN public.properties p ON p.id = l.property_id
  WHERE p.legal_entity_id IN (SELECT public.auth_user_entity_ids());
$$;

COMMENT ON FUNCTION public.sci_accessible_lease_ids() IS
  'SOTA 2026 — Lease ids attachés à une propriété détenue par une legal_entity '
  'dont l''utilisateur authentifié est membre. SECURITY DEFINER pour bypasser '
  'les RLS de leases/properties et éviter la récursion dans la policy '
  'SCI-aware "Owners can view invoices of own properties".';

REVOKE ALL ON FUNCTION public.sci_accessible_lease_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sci_accessible_lease_ids()
  TO authenticated, service_role;

-- ============================================================
-- 2. UNITS — policy SELECT sans EXISTS(leases) inline
-- ============================================================
DROP POLICY IF EXISTS "Users can view units of accessible properties" ON public.units;

CREATE POLICY "Users can view units of accessible properties"
  ON public.units FOR SELECT
  USING (
    -- Owner direct
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = units.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Tenant via property (SECURITY DEFINER helper)
    property_id IN (SELECT public.tenant_accessible_property_ids())
    OR
    -- Tenant via unit (SECURITY DEFINER helper)
    id IN (SELECT public.tenant_accessible_unit_ids())
    OR
    -- Admin
    public.user_role() = 'admin'
  );

COMMENT ON POLICY "Users can view units of accessible properties" ON public.units IS
  'SOTA 2026 — Owner voit ses units, tenant voit celles liées à ses baux via '
  'tenant_accessible_property_ids() / tenant_accessible_unit_ids() (SECURITY '
  'DEFINER). Supprime la récursion leases → units → leases.';

-- ============================================================
-- 3. TICKETS — policy SELECT/INSERT sans EXISTS(leases) inline
-- ============================================================
DROP POLICY IF EXISTS "Users can view tickets of accessible properties" ON public.tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON public.tickets;

CREATE POLICY "Users can view tickets of accessible properties"
  ON public.tickets FOR SELECT
  USING (
    tickets.created_by_profile_id = public.user_profile_id()
    OR
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    property_id IN (SELECT public.tenant_accessible_property_ids())
    OR
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.ticket_id = tickets.id
        AND wo.provider_id = public.user_profile_id()
    )
    OR
    public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can create tickets for accessible properties" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON public.tickets;

CREATE POLICY "Users can create tickets for accessible properties"
  ON public.tickets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    property_id IN (SELECT public.tenant_accessible_property_ids())
    OR
    public.user_role() = 'admin'
  );

-- ============================================================
-- 4. CHARGES — policy SELECT sans EXISTS(leases) inline
-- ============================================================
DROP POLICY IF EXISTS "Tenants can view charges of linked properties" ON public.charges;

CREATE POLICY "Tenants can view charges of linked properties"
  ON public.charges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = charges.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    property_id IN (SELECT public.tenant_accessible_property_ids())
    OR
    public.user_role() = 'admin'
  );

-- ============================================================
-- 5. INVOICES — policy SCI-aware sans EXISTS(leases JOIN properties) inline
-- ============================================================
DROP POLICY IF EXISTS "Owners can view invoices of own properties" ON public.invoices;

CREATE POLICY "Owners can view invoices of own properties"
  ON public.invoices FOR SELECT
  USING (
    owner_id = public.user_profile_id()
    OR entity_id IN (SELECT public.auth_user_entity_ids())
    OR lease_id IN (SELECT public.sci_accessible_lease_ids())
  );

COMMENT ON POLICY "Owners can view invoices of own properties" ON public.invoices IS
  'SOTA 2026 — Owner direct, membre d''entité, ou via sci_accessible_lease_ids() '
  '(SECURITY DEFINER). Supprime la récursion via la sous-requête leases/properties.';

-- ============================================================
-- 6. Sanity check — aucune policy tenant ne lit leases inline
-- ============================================================
DO $$
DECLARE
  v_row RECORD;
  v_count INT := 0;
BEGIN
  FOR v_row IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('units', 'tickets', 'charges', 'invoices', 'properties')
      AND (qual ILIKE '%FROM leases%' OR qual ILIKE '%JOIN leases%')
      AND qual NOT ILIKE '%accessible_lease_ids%'
      AND qual NOT ILIKE '%accessible_property_ids%'
      AND qual NOT ILIKE '%accessible_unit_ids%'
  LOOP
    RAISE WARNING 'Policy % sur % lit toujours leases inline — risque de récursion',
      v_row.policyname, v_row.tablename;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE NOTICE 'OK: aucune policy RLS sur units/tickets/charges/invoices/properties ne lit leases inline';
  END IF;
END $$;

-- ============================================================
-- 7. Reload PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
