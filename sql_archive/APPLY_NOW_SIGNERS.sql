-- =====================================================
-- APPLIQUER IMMÉDIATEMENT - Correction invitations
-- =====================================================
-- Exécutez ce script dans Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Coller > Run
-- =====================================================

-- 1. Rendre profile_id nullable
ALTER TABLE lease_signers 
ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Ajouter invited_email
ALTER TABLE lease_signers 
ADD COLUMN IF NOT EXISTS invited_email VARCHAR(255);

-- 3. Ajouter invited_at  
ALTER TABLE lease_signers 
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Ajouter invited_name
ALTER TABLE lease_signers 
ADD COLUMN IF NOT EXISTS invited_name VARCHAR(255);

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email 
ON lease_signers(invited_email) 
WHERE invited_email IS NOT NULL;

-- Vérification
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'lease_signers'
ORDER BY ordinal_position;

