-- =====================================================
-- APPLIQUER IMMÉDIATEMENT - Colonnes profiles
-- =====================================================
-- Exécutez ce script dans Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Coller > Run
-- =====================================================

-- 1. Ajouter lieu_naissance
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS lieu_naissance VARCHAR(255);

-- 2. Ajouter adresse
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS adresse TEXT;

-- 3. Ajouter nationalite
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS nationalite VARCHAR(100) DEFAULT 'Française';

-- Vérification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('lieu_naissance', 'adresse', 'nationalite');






