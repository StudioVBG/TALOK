-- =====================================================
-- FIX: Erreur "Database error querying schema" (500)
-- Date: 2026-01-07
-- Problème: L'authentification échoue avec une erreur 500
-- Cause: Fonctions RLS manquantes ou politiques mal configurées
-- =====================================================

BEGIN;

-- 1. RECRÉER LES FONCTIONS HELPER AVEC SECURITY DEFINER
-- Ces fonctions sont utilisées par les politiques RLS et doivent bypasser RLS

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Version avec paramètre pour les cas où on veut passer explicitement le user_id
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
  SELECT role FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- 2. S'ASSURER QUE RLS EST ACTIVÉ SUR PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. SUPPRIMER TOUTES LES POLITIQUES EXISTANTES SUR PROFILES
-- (pour éviter les conflits et les récursions)
DROP POLICY IF EXISTS "profiles_self_all" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
DROP POLICY IF EXISTS "profiles_owner_view_tenants" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "users_view_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "admins_view_all_profiles" ON profiles;

-- 4. RECRÉER LES POLITIQUES CORRECTEMENT

-- Politique principale : chaque utilisateur peut gérer son propre profil
-- IMPORTANT : utilise auth.uid() directement (pas de fonction helper) pour éviter la récursion
CREATE POLICY "profiles_self_all" ON profiles 
FOR ALL TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Les admins peuvent voir tous les profils (utilise la fonction helper sécurisée)
CREATE POLICY "profiles_admin_all" ON profiles 
FOR SELECT TO authenticated 
USING (public.user_role() = 'admin');

-- Les propriétaires peuvent voir les profils de leurs locataires
CREATE POLICY "profiles_owner_view_tenants" ON profiles 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    JOIN properties p ON p.id = l.property_id
    WHERE ls.profile_id = profiles.id
    AND p.owner_id = public.user_profile_id()
  )
);

-- 5. VÉRIFICATION : Afficher les politiques créées
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'profiles';
  
  RAISE NOTICE '✅ Fix appliqué avec succès!';
  RAISE NOTICE '📊 Nombre de politiques sur profiles: %', policy_count;
END $$;

COMMIT;

