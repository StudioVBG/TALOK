-- Script de correction RLS pour les administrateurs
-- À exécuter directement dans Supabase SQL Editor

-- ============================================
-- PROFILES - Correction récursion
-- ============================================

DROP POLICY IF EXISTS "admins_read_all_profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_profiles_all" ON profiles;

CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

CREATE POLICY "profiles_user_select_own" ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "profiles_user_update_own" ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- OWNER_PROFILES
-- ============================================

DROP POLICY IF EXISTS "Admins can view all owner profiles" ON owner_profiles;
DROP POLICY IF EXISTS "admin_owner_profiles_all" ON owner_profiles;

CREATE POLICY "owner_profiles_admin_all" ON owner_profiles
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- TENANT_PROFILES
-- ============================================

DROP POLICY IF EXISTS "Admins can view all tenant profiles" ON tenant_profiles;
DROP POLICY IF EXISTS "admin_tenant_profiles_all" ON tenant_profiles;

CREATE POLICY "tenant_profiles_admin_all" ON tenant_profiles
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- PROVIDER_PROFILES
-- ============================================

DROP POLICY IF EXISTS "Admins can view all provider profiles" ON provider_profiles;
DROP POLICY IF EXISTS "admin_provider_profiles_all" ON provider_profiles;

CREATE POLICY "provider_profiles_admin_all" ON provider_profiles
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- INVOICES
-- ============================================

DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "admin_invoices_all" ON invoices;

CREATE POLICY "invoices_admin_all" ON invoices
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- PAYMENTS
-- ============================================

DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "admin_payments_all" ON payments;

CREATE POLICY "payments_admin_all" ON payments
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- TICKETS
-- ============================================

DROP POLICY IF EXISTS "Admins can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON tickets;
DROP POLICY IF EXISTS "admin_tickets_all" ON tickets;

CREATE POLICY "tickets_admin_all" ON tickets
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- WORK_ORDERS
-- ============================================

DROP POLICY IF EXISTS "Admins can view all work_orders" ON work_orders;
DROP POLICY IF EXISTS "admin_work_orders_all" ON work_orders;

CREATE POLICY "work_orders_admin_all" ON work_orders
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- DOCUMENTS
-- ============================================

DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
DROP POLICY IF EXISTS "admin_documents_all" ON documents;

CREATE POLICY "documents_admin_all" ON documents
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- CHARGES
-- ============================================

DROP POLICY IF EXISTS "Admins can view all charges" ON charges;
DROP POLICY IF EXISTS "admin_charges_all" ON charges;

CREATE POLICY "charges_admin_all" ON charges
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- UNITS
-- ============================================

DROP POLICY IF EXISTS "Admins can view all units" ON units;
DROP POLICY IF EXISTS "admin_units_all" ON units;

CREATE POLICY "units_admin_all" ON units
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Message de confirmation
SELECT 'Politiques RLS admin corrigées avec succès!' AS message;

