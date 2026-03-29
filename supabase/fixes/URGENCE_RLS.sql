-- =====================================================
-- URGENCE : DÉSACTIVER RLS TEMPORAIREMENT
-- Copiez-collez CE SCRIPT dans Supabase SQL Editor
-- =====================================================

-- SOLUTION RADICALE : Désactiver complètement RLS sur profiles
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Supprimer TOUTES les politiques
DROP POLICY IF EXISTS "profiles_own_access" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_read" ON profiles;
DROP POLICY IF EXISTS "profiles_owner_read_tenants" ON profiles;
DROP POLICY IF EXISTS "profiles_owner_view_tenants" ON profiles;
DROP POLICY IF EXISTS "profiles_self_all" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;

-- Vérification
SELECT 'RLS DÉSACTIVÉ - Plus d erreur de récursion!' AS status;
SELECT COUNT(*) AS politiques_restantes FROM pg_policies WHERE tablename = 'profiles';

