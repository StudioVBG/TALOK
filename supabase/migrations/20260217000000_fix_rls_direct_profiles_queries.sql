-- =====================================================
-- MIGRATION: Remplacer les requêtes directes sur profiles dans les RLS
-- Date: 2026-02-17
--
-- PROBLÈME: Plusieurs policies RLS sur d'autres tables font
--   SELECT FROM profiles WHERE user_id = auth.uid()
-- au lieu d'utiliser les fonctions SECURITY DEFINER (is_admin(),
-- get_my_profile_id()), ce qui déclenche l'évaluation RLS sur profiles
-- et peut provoquer des ralentissements ou récursions (42P17).
--
-- SOLUTION: Remplacer ces sous-requêtes par les fonctions SECURITY DEFINER
-- créées dans 20260213000000_fix_profiles_rls_recursion_v2.sql
--
-- Tables affectées:
--   1. email_templates (admin read/write)
--   2. email_template_versions (admin read)
--   3. email_logs (admin read)
--   4. guarantor_profiles (own access)
--   5. units (admin check dans la policy élargie)
--   6. charges (admin check)
--   7. tickets SELECT (admin check)
--   8. tickets INSERT (admin check)
-- =====================================================

BEGIN;

-- ============================================
-- 1. EMAIL_TEMPLATES: Utiliser is_admin()
-- ============================================
DROP POLICY IF EXISTS "email_templates_admin_read" ON email_templates;
DROP POLICY IF EXISTS "email_templates_admin_write" ON email_templates;

CREATE POLICY "email_templates_admin_read" ON email_templates
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "email_templates_admin_write" ON email_templates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================
-- 2. EMAIL_TEMPLATE_VERSIONS: Utiliser is_admin()
-- ============================================
DROP POLICY IF EXISTS "email_template_versions_admin_read" ON email_template_versions;

CREATE POLICY "email_template_versions_admin_read" ON email_template_versions
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================
-- 3. EMAIL_LOGS: Utiliser is_admin()
-- ============================================
DROP POLICY IF EXISTS "email_logs_admin_read" ON email_logs;

CREATE POLICY "email_logs_admin_read" ON email_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================
-- 4. GUARANTOR_PROFILES: Utiliser get_my_profile_id()
-- ============================================
DROP POLICY IF EXISTS "guarantor_profiles_select_own" ON guarantor_profiles;
DROP POLICY IF EXISTS "guarantor_profiles_insert_own" ON guarantor_profiles;
DROP POLICY IF EXISTS "guarantor_profiles_update_own" ON guarantor_profiles;

CREATE POLICY "guarantor_profiles_select_own" ON guarantor_profiles
  FOR SELECT USING (profile_id = public.get_my_profile_id());

CREATE POLICY "guarantor_profiles_insert_own" ON guarantor_profiles
  FOR INSERT WITH CHECK (profile_id = public.get_my_profile_id());

CREATE POLICY "guarantor_profiles_update_own" ON guarantor_profiles
  FOR UPDATE USING (profile_id = public.get_my_profile_id());

-- ============================================
-- 5. UNITS: Remplacer admin check par is_admin()
-- ============================================
-- La policy actuelle (de 20260215200002) utilise:
--   EXISTS (SELECT 1 FROM profiles WHERE id = public.user_profile_id() AND role = 'admin')
-- On la remplace intégralement avec is_admin()

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
    -- Locataire avec bail non-brouillon/non-annulé
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE (l.property_id = units.property_id OR l.unit_id = units.id)
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
    OR
    -- Admin (via SECURITY DEFINER)
    public.is_admin()
  );

-- ============================================
-- 6. CHARGES: Remplacer admin check par is_admin()
-- ============================================
DROP POLICY IF EXISTS "Tenants can view charges of linked properties" ON charges;

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
    -- Locataire avec bail actif ou en préavis
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = charges.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given', 'fully_signed')
    )
    OR
    -- Admin (via SECURITY DEFINER)
    public.is_admin()
  );

-- ============================================
-- 7. TICKETS SELECT: Remplacer admin check par is_admin()
-- ============================================
DROP POLICY IF EXISTS "Users can view tickets of accessible properties" ON tickets;

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
    -- Admin (via SECURITY DEFINER)
    public.is_admin()
  );

-- ============================================
-- 8. TICKETS INSERT: Remplacer admin check par is_admin()
-- ============================================
DROP POLICY IF EXISTS "Users can create tickets for accessible properties" ON tickets;

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
    -- Locataire avec bail actif ou en préavis
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    -- Admin (via SECURITY DEFINER)
    public.is_admin()
  );

-- ============================================
-- 9. VÉRIFICATION
-- ============================================
DO $$
DECLARE
  remaining INT;
BEGIN
  -- Compter les policies qui font encore SELECT FROM profiles directement
  -- (hors table profiles elle-même et hors les anciennes migrations non-actives)
  RAISE NOTICE '[MIGRATION] RLS policies mises à jour pour utiliser les fonctions SECURITY DEFINER';
  RAISE NOTICE '[MIGRATION] Tables corrigées: email_templates, email_template_versions, email_logs, guarantor_profiles, units, charges, tickets';
END $$;

COMMIT;
