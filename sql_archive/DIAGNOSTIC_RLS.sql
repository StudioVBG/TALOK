-- ==============================================
-- DIAGNOSTIC RLS - Vérifier l'état des politiques sur profiles
-- Exécutez ce script DANS SUPABASE SQL EDITOR
-- ==============================================

-- 1. Voir toutes les politiques sur la table profiles
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 2. Vérifier si RLS est activé
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname = 'profiles';

-- 3. Vérifier si les fonctions helper existent
SELECT 
  proname AS function_name,
  prosecdef AS is_security_definer
FROM pg_proc 
WHERE proname IN ('get_my_profile_id', 'is_admin', 'user_role', 'user_profile_id');

