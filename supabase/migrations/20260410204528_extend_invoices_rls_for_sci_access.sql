-- =====================================================
-- Migration: Extend invoices/leases/properties SELECT RLS for SCI access
-- Date: 2026-04-10
--
-- CONTEXT:
-- Bug #3 — "Facture introuvable" on /owner/invoices/[id] for SCI owners.
--
-- ROOT CAUSE:
-- The existing RLS SELECT policies on `invoices`, `leases` and `properties`
-- only check direct ownership via `owner_id = public.user_profile_id()`.
-- They do NOT account for owners who hold assets through a legal_entity
-- (SCI, SARL, agence…). When a property is owned by a SCI, its
-- `owner_id` points to the SCI's profile (not the individual manager),
-- so any human member of that SCI is blocked by RLS when fetching the
-- nested join `invoices → leases → properties`.
--
-- NOTE: The list endpoints (features/billing/server/data-fetching.ts)
-- silently work today because they use `getServiceClient()` which
-- bypasses RLS. The detail endpoint (app/api/invoices/[id]/route.ts)
-- correctly uses the authenticated client and therefore is blocked.
--
-- FIX:
-- Extend each SELECT policy to ALSO allow access when the caller is a
-- member of the legal_entity that owns the property (via entity_members).
-- INSERT / UPDATE / DELETE policies are left unchanged: only SELECT
-- needs the SCI read-through.
--
-- IDEMPOTENCE:
-- All policies are DROPped and CREATEd, matching the project convention.
-- Safe to re-run.
-- =====================================================

-- =====================================================
-- 1. PROPERTIES — allow SCI members to view properties
-- =====================================================
DROP POLICY IF EXISTS "Owners can view own properties" ON properties;

CREATE POLICY "Owners can view own properties"
  ON properties FOR SELECT
  USING (
    -- Direct ownership (personal owner_id)
    owner_id = public.user_profile_id()
    -- OR the property is held by a legal_entity the user is a member of
    OR legal_entity_id IN (
      SELECT em.entity_id
      FROM entity_members em
      WHERE em.user_id = auth.uid()
    )
  );

-- =====================================================
-- 2. LEASES — allow SCI members to view leases of SCI-owned properties
-- =====================================================
DROP POLICY IF EXISTS "Owners can view leases of own properties" ON leases;

CREATE POLICY "Owners can view leases of own properties"
  ON leases FOR SELECT
  USING (
    -- Lease on a property directly owned by the caller
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.owner_id = public.user_profile_id()
    )
    -- Or on a unit of such a property
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.owner_id = public.user_profile_id()
    )
    -- OR lease on a property held by a legal_entity the user is a member of
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.legal_entity_id IN (
          SELECT em.entity_id
          FROM entity_members em
          WHERE em.user_id = auth.uid()
        )
    )
    -- Or same on a unit
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.legal_entity_id IN (
          SELECT em.entity_id
          FROM entity_members em
          WHERE em.user_id = auth.uid()
        )
    )
  );

-- =====================================================
-- 3. INVOICES — allow SCI members to view invoices of SCI-owned assets
-- =====================================================
DROP POLICY IF EXISTS "Owners can view invoices of own properties" ON invoices;

CREATE POLICY "Owners can view invoices of own properties"
  ON invoices FOR SELECT
  USING (
    -- Direct ownership (invoices.owner_id matches the caller's profile)
    owner_id = public.user_profile_id()
    -- OR the invoice is explicitly tied to a legal_entity the user is a member of
    -- (invoices.entity_id was added by 20260408220000_payment_architecture_sota.sql)
    OR entity_id IN (
      SELECT em.entity_id
      FROM entity_members em
      WHERE em.user_id = auth.uid()
    )
    -- OR the invoice's lease points to a property held by a legal_entity
    -- the user is a member of
    OR lease_id IN (
      SELECT l.id
      FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.legal_entity_id IN (
        SELECT em.entity_id
        FROM entity_members em
        WHERE em.user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 4. COMMENTS for future readers
-- =====================================================
COMMENT ON POLICY "Owners can view own properties" ON properties IS
  'SCI-aware: allows direct profile owners AND members of the owning legal_entity.';

COMMENT ON POLICY "Owners can view leases of own properties" ON leases IS
  'SCI-aware: allows direct profile owners AND members of the legal_entity holding the underlying property.';

COMMENT ON POLICY "Owners can view invoices of own properties" ON invoices IS
  'SCI-aware: allows direct profile owners, explicit entity_id matches, AND members of the legal_entity holding the invoiced property.';
