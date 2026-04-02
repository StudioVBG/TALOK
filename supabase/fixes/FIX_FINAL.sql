-- SCRIPT FINAL : Désactiver RLS SANS recréer de politiques
-- Copiez ce script ENTIER et collez-le dans Supabase SQL Editor

-- Étape 1: Désactiver RLS
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Étape 2: Supprimer TOUTES les politiques existantes
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
    END LOOP;
END $$;

-- Vérification
SELECT 'RLS désactivé, politiques supprimées' AS status;

