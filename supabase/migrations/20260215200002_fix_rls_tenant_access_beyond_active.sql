-- ============================================================================
-- MIGRATION CORRECTIVE: Élargir les RLS units/charges/tickets pour les locataires
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Plusieurs policies RLS pour les tables units, charges et tickets
--           filtrent sur l.statut = 'active' uniquement, empêchant les locataires
--           d'accéder aux données pendant les phases de signature, préavis, etc.
--
-- FIX: Remplacer les policies restrictives par des versions élargies utilisant
--      NOT IN ('draft', 'cancelled') pour couvrir tout le cycle de vie.
-- ============================================================================

-- ============================================
-- 1. UNITS — Policy tenant trop restrictive
-- ============================================
DROP POLICY IF EXISTS "Users can view units of accessible properties" ON units;

CREATE POLICY "Users can view units of accessible properties"
  ON units
  FOR SELECT
  USING (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = units.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail non-brouillon/non-annulé sur ce bien
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE (l.property_id = units.property_id OR l.unit_id = units.id)
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- 2. CHARGES — Policy tenant trop restrictive
-- ============================================
DROP POLICY IF EXISTS "Tenants can view charges of properties with active leases" ON charges;

CREATE POLICY "Tenants can view charges of linked properties"
  ON charges
  FOR SELECT
  USING (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = charges.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis sur ce bien
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = charges.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given', 'fully_signed')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- 3. TICKETS — Policies tenant trop restrictives
-- ============================================

-- 3a. Policy SELECT
DROP POLICY IF EXISTS "Users can view tickets of accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;

CREATE POLICY "Users can view tickets of accessible properties"
  ON tickets
  FOR SELECT
  USING (
    -- Créateur du ticket
    tickets.created_by_profile_id = public.user_profile_id()
    OR
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    -- Prestataire assigné via work_order
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.ticket_id = tickets.id
        AND wo.provider_id = public.user_profile_id()
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- 3b. Policy INSERT
DROP POLICY IF EXISTS "Users can create tickets for accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;

CREATE POLICY "Users can create tickets for accessible properties"
  ON tickets
  FOR INSERT
  WITH CHECK (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis (peut signaler un problème)
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- Log
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '[MIGRATION] RLS units/charges/tickets élargies au-delà de active';
END $$;
