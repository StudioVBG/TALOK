-- Migration: Corriger la récursion RLS sur profiles pour les admins
-- Date: 3 Décembre 2025
-- 
-- PROBLÈME: Les politiques RLS sur profiles créent une récursion infinie
-- car la vérification "role = 'admin'" requiert de lire la table profiles
-- qui déclenche à nouveau la politique.
--
-- SOLUTION: Utiliser la fonction user_role() qui est SECURITY DEFINER
-- et contourne donc le RLS pour la vérification.

BEGIN;

-- ============================================
-- ÉTAPE 1: SUPPRIMER LES POLITIQUES PROBLÉMATIQUES
-- ============================================

DROP POLICY IF EXISTS "admins_read_all_profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_profiles_all" ON profiles;

-- ============================================
-- ÉTAPE 2: RECRÉER LES POLITIQUES SANS RÉCURSION
-- ============================================

-- Admin peut tout faire sur profiles (utilise user_role() SECURITY DEFINER)
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Les utilisateurs peuvent voir leur propre profil (pas de récursion car auth.uid() direct)
CREATE POLICY "profiles_user_select_own" ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Les utilisateurs peuvent mettre à jour leur propre profil
CREATE POLICY "profiles_user_update_own" ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- ÉTAPE 3: S'ASSURER QUE RLS EST ACTIVÉ
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================
-- COMMENTAIRES
-- ============================================
-- 
-- Ordre de vérification des politiques:
-- 1. profiles_admin_all → Admin peut tout voir/modifier
-- 2. profiles_user_select_own → User peut voir son profil
-- 3. profiles_user_update_own → User peut modifier son profil
--
-- La clé est l'utilisation de public.user_role() qui est SECURITY DEFINER,
-- ce qui lui permet de lire la table profiles sans déclencher les politiques RLS.

