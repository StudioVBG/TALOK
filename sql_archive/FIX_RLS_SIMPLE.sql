-- ==============================================
-- FIX RAPIDE : Récursion RLS sur profiles
-- Copiez ce script dans Supabase > SQL Editor > Run
-- ==============================================

-- 1. Désactive RLS temporairement
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. Supprime les politiques problématiques
DROP POLICY IF EXISTS "profiles_owner_view_tenants" ON profiles;
DROP POLICY IF EXISTS "profiles_self_all" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
DROP POLICY IF EXISTS "profiles_own_access" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_read" ON profiles;
DROP POLICY IF EXISTS "profiles_owner_read_tenants" ON profiles;

-- 3. Créer fonction helper SECURITY DEFINER (évite récursion)
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
    LIMIT 1
  );
$$;

-- 4. Réactive RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Crée les politiques SANS récursion
-- Chaque user accède à son propre profil
CREATE POLICY "profiles_own_access" ON profiles 
FOR ALL TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin peut tout voir
CREATE POLICY "profiles_admin_read" ON profiles 
FOR SELECT TO authenticated 
USING (public.is_admin());

-- Propriétaires voient les locataires de leurs biens
CREATE POLICY "profiles_owner_read_tenants" ON profiles 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 
    FROM lease_signers ls
    INNER JOIN leases l ON l.id = ls.lease_id
    INNER JOIN properties p ON p.id = l.property_id
    WHERE ls.profile_id = profiles.id
    AND p.owner_id = public.get_my_profile_id()
  )
);

-- 6. Permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;

-- Test
SELECT 'FIX APPLIQUÉ AVEC SUCCÈS !' AS resultat;

