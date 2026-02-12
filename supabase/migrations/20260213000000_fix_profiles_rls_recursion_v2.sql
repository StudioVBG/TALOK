-- =====================================================
-- MIGRATION: Correction définitive de la récursion RLS sur profiles (v2)
-- Date: 2026-02-13
-- Problème: "RLS recursion detected" - erreur 500 sur profiles
--
-- CAUSE: Les politiques RLS sur `profiles` appellent des fonctions
--        qui requêtent `profiles`, créant une boucle infinie (42P17).
--
-- SOLUTION:
--   1. Fonctions SECURITY DEFINER qui bypassen les RLS
--   2. Politiques RLS simplifiées utilisant auth.uid() directement
--   3. Pas de sous-requête vers profiles dans les politiques profiles
-- =====================================================

-- 1. DÉSACTIVER TEMPORAIREMENT RLS POUR LE NETTOYAGE
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER TOUTES LES ANCIENNES POLITIQUES SUR profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. CRÉER/REMPLACER LES FONCTIONS HELPER (SECURITY DEFINER = bypass RLS)
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

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1),
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_my_profile_id();
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_my_role();
$$;

-- Versions avec paramètre (pour usage admin)
CREATE OR REPLACE FUNCTION public.user_profile_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(role, 'anonymous') FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- 4. RÉACTIVER RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. CRÉER LES NOUVELLES POLITIQUES (SANS RÉCURSION)

-- Politique principale : chaque utilisateur peut voir/modifier son propre profil
-- Utilise auth.uid() directement, aucune sous-requête vers profiles
CREATE POLICY "profiles_own_access" ON profiles
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Politique admin : les admins peuvent voir tous les profils
-- is_admin() est SECURITY DEFINER donc bypasse les RLS
CREATE POLICY "profiles_admin_read" ON profiles
FOR SELECT TO authenticated
USING (public.is_admin());

-- Politique propriétaire : peut voir les profils de ses locataires
-- get_my_profile_id() est SECURITY DEFINER donc bypasse les RLS
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

-- 6. ACCORDER LES PERMISSIONS SUR LES FONCTIONS
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role(UUID) TO authenticated;

-- Permissions pour anon (nécessaire pour certaines requêtes pré-auth)
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_role() TO anon;

-- 7. Permettre au service_role de bypass RLS (déjà le cas par défaut mais
-- explicite pour la documentation)
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
