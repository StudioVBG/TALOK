-- Migration: Corriger TOUTES les politiques RLS admin pour utiliser user_role()
-- Date: 3 Décembre 2025
-- 
-- PROBLÈME: De nombreuses politiques RLS utilisent des sous-requêtes sur profiles
-- qui peuvent être bloquées par les politiques RLS de profiles elles-mêmes.
--
-- SOLUTION: Utiliser public.user_role() partout, qui est SECURITY DEFINER
-- et contourne le RLS pour obtenir le rôle de l'utilisateur.

BEGIN;

-- ============================================
-- OWNER_PROFILES - Politiques admin
-- ============================================

DROP POLICY IF EXISTS "Admins can view all owner profiles" ON owner_profiles;
DROP POLICY IF EXISTS "admin_owner_profiles_all" ON owner_profiles;

CREATE POLICY "owner_profiles_admin_all" ON owner_profiles
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- TENANT_PROFILES - Politiques admin
-- ============================================

DROP POLICY IF EXISTS "Admins can view all tenant profiles" ON tenant_profiles;
DROP POLICY IF EXISTS "admin_tenant_profiles_all" ON tenant_profiles;

CREATE POLICY "tenant_profiles_admin_all" ON tenant_profiles
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- PROVIDER_PROFILES - Politiques admin
-- ============================================

DROP POLICY IF EXISTS "Admins can view all provider profiles" ON provider_profiles;
DROP POLICY IF EXISTS "admin_provider_profiles_all" ON provider_profiles;

CREATE POLICY "provider_profiles_admin_all" ON provider_profiles
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- INVOICES - Politiques admin
-- ============================================

DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "admin_invoices_all" ON invoices;

CREATE POLICY "invoices_admin_all" ON invoices
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- PAYMENTS - Politiques admin
-- ============================================

DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "admin_payments_all" ON payments;

CREATE POLICY "payments_admin_all" ON payments
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- TICKETS - Politiques admin
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
-- WORK_ORDERS - Politiques admin
-- ============================================

DROP POLICY IF EXISTS "Admins can view all work_orders" ON work_orders;
DROP POLICY IF EXISTS "admin_work_orders_all" ON work_orders;

CREATE POLICY "work_orders_admin_all" ON work_orders
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- DOCUMENTS - Politiques admin
-- ============================================

DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
DROP POLICY IF EXISTS "admin_documents_all" ON documents;

CREATE POLICY "documents_admin_all" ON documents
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- CHARGES - Politiques admin
-- ============================================

DROP POLICY IF EXISTS "Admins can view all charges" ON charges;
DROP POLICY IF EXISTS "admin_charges_all" ON charges;

CREATE POLICY "charges_admin_all" ON charges
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- BLOG_POSTS - Politiques admin
-- ============================================

DROP POLICY IF EXISTS "Admins can manage all blog posts" ON blog_posts;
DROP POLICY IF EXISTS "admin_blog_posts_all" ON blog_posts;

CREATE POLICY "blog_posts_admin_all" ON blog_posts
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- UNITS - Politiques admin
-- ============================================

DROP POLICY IF EXISTS "Admins can view all units" ON units;
DROP POLICY IF EXISTS "admin_units_all" ON units;

CREATE POLICY "units_admin_all" ON units
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- ROOMMATES - Politiques admin (si la table existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'roommates') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all roommates" ON roommates';
    EXECUTE 'DROP POLICY IF EXISTS "admin_roommates_all" ON roommates';
    EXECUTE 'CREATE POLICY "roommates_admin_all" ON roommates
      FOR ALL
      TO authenticated
      USING (public.user_role() = ''admin'')
      WITH CHECK (public.user_role() = ''admin'')';
  END IF;
END $$;

COMMIT;

-- ============================================
-- COMMENTAIRES
-- ============================================
-- 
-- Cette migration assure que toutes les tables principales ont une politique
-- admin qui utilise public.user_role() au lieu de sous-requêtes sur profiles.
--
-- Cela évite les problèmes de récursion et garantit que l'admin peut voir
-- toutes les données de la plateforme.

