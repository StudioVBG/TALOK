-- Migration: Créer une fonction RPC pour appliquer les corrections RLS
-- Cette fonction est SECURITY DEFINER et peut modifier les politiques
-- Elle vérifie que l'appelant est admin avant d'exécuter

CREATE OR REPLACE FUNCTION apply_admin_rls_fixes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_result JSONB;
BEGIN
  -- 1. Vérifier que l'utilisateur est admin
  v_user_id := auth.uid();
  
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_user_id
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Accès refusé : réservé aux administrateurs';
  END IF;

  -- 2. Supprimer les anciennes politiques sur profiles
  DROP POLICY IF EXISTS "admins_read_all_profiles" ON profiles;
  DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
  DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
  DROP POLICY IF EXISTS "admin_profiles_all" ON profiles;
  DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
  DROP POLICY IF EXISTS "profiles_user_select_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_user_update_own" ON profiles;

  -- 3. Créer les nouvelles politiques sur profiles
  CREATE POLICY "profiles_admin_all" ON profiles
    FOR ALL TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');

  CREATE POLICY "profiles_user_select_own" ON profiles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

  CREATE POLICY "profiles_user_update_own" ON profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  -- 4. owner_profiles
  DROP POLICY IF EXISTS "Admins can view all owner profiles" ON owner_profiles;
  DROP POLICY IF EXISTS "owner_profiles_admin_all" ON owner_profiles;
  
  CREATE POLICY "owner_profiles_admin_all" ON owner_profiles
    FOR ALL TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');

  -- 5. tenant_profiles
  DROP POLICY IF EXISTS "Admins can view all tenant profiles" ON tenant_profiles;
  DROP POLICY IF EXISTS "tenant_profiles_admin_all" ON tenant_profiles;
  
  CREATE POLICY "tenant_profiles_admin_all" ON tenant_profiles
    FOR ALL TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');

  -- 6. provider_profiles
  DROP POLICY IF EXISTS "Admins can view all provider profiles" ON provider_profiles;
  DROP POLICY IF EXISTS "provider_profiles_admin_all" ON provider_profiles;
  
  CREATE POLICY "provider_profiles_admin_all" ON provider_profiles
    FOR ALL TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');

  -- 7. invoices
  DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
  DROP POLICY IF EXISTS "invoices_admin_all" ON invoices;
  
  CREATE POLICY "invoices_admin_all" ON invoices
    FOR ALL TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');

  -- 8. payments
  DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
  DROP POLICY IF EXISTS "payments_admin_all" ON payments;
  
  CREATE POLICY "payments_admin_all" ON payments
    FOR ALL TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');

  -- 9. tickets
  DROP POLICY IF EXISTS "Admins can view all tickets" ON tickets;
  DROP POLICY IF EXISTS "tickets_admin_all" ON tickets;
  
  CREATE POLICY "tickets_admin_all" ON tickets
    FOR ALL TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');

  -- 10. work_orders
  DROP POLICY IF EXISTS "Admins can view all work_orders" ON work_orders;
  DROP POLICY IF EXISTS "work_orders_admin_all" ON work_orders;
  
  CREATE POLICY "work_orders_admin_all" ON work_orders
    FOR ALL TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');

  -- 11. documents
  DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
  DROP POLICY IF EXISTS "documents_admin_all" ON documents;
  
  CREATE POLICY "documents_admin_all" ON documents
    FOR ALL TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');

  -- 12. charges
  DROP POLICY IF EXISTS "Admins can view all charges" ON charges;
  DROP POLICY IF EXISTS "charges_admin_all" ON charges;
  
  CREATE POLICY "charges_admin_all" ON charges
    FOR ALL TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');

  -- 13. units
  DROP POLICY IF EXISTS "Admins can view all units" ON units;
  DROP POLICY IF EXISTS "units_admin_all" ON units;
  
  CREATE POLICY "units_admin_all" ON units
    FOR ALL TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');

  -- Retourner le résultat
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Politiques RLS admin corrigées avec succès',
    'tables_updated', ARRAY[
      'profiles', 'owner_profiles', 'tenant_profiles', 'provider_profiles',
      'invoices', 'payments', 'tickets', 'work_orders', 'documents', 'charges', 'units'
    ]
  );

  RETURN v_result;
END;
$$;

-- Commenter la fonction
COMMENT ON FUNCTION apply_admin_rls_fixes() IS 'Applique les corrections RLS pour les administrateurs. Réservé aux admins.';

