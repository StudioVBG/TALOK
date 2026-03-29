-- ==============================================
-- FIX COMPLET RLS - Solution définitive
-- ÉTAPE 1 : Copiez TOUT ce script
-- ÉTAPE 2 : Collez dans Supabase SQL Editor  
-- ÉTAPE 3 : Cliquez "Run"
-- ==============================================

-- ===== PHASE 1: DÉSACTIVER RLS =====
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- ===== PHASE 2: SUPPRIMER TOUTES LES POLITIQUES =====
DO $$ 
DECLARE 
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- ===== PHASE 3: CRÉER FONCTIONS SECURITY DEFINER =====

-- Fonction pour obtenir l'ID du profil actuel
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Fonction pour vérifier si admin
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

-- Fonction pour obtenir le rôle
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

-- Alias pour compatibilité
CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$ SELECT public.get_my_profile_id(); $$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$ SELECT public.get_my_role(); $$;

-- ===== PHASE 4: ACCORDER LES PERMISSIONS =====
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;

-- ===== PHASE 5: RÉACTIVER RLS =====
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ===== PHASE 6: CRÉER LES NOUVELLES POLITIQUES SIMPLES =====

-- Politique 1: Chaque utilisateur voit son propre profil
CREATE POLICY "profiles_own_access" ON profiles
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Politique 2: Les admins voient tous les profils  
CREATE POLICY "profiles_admin_read" ON profiles
FOR SELECT TO authenticated
USING (public.is_admin());

-- Politique 3: Les propriétaires voient leurs locataires (via baux)
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

-- ===== PHASE 7: VÉRIFICATION =====
SELECT 
  'Politiques créées:' AS status,
  COUNT(*) AS nombre_politiques
FROM pg_policies 
WHERE tablename = 'profiles';

SELECT 'FIX RLS APPLIQUÉ AVEC SUCCÈS !' AS resultat;

