-- ============================================
-- EXÉCUTER CE SQL DANS SUPABASE SQL EDITOR
-- ============================================

-- Ajouter la colonne signature_image à lease_signers
ALTER TABLE lease_signers ADD COLUMN IF NOT EXISTS signature_image TEXT;

-- Commentaire
COMMENT ON COLUMN lease_signers.signature_image IS 'Image de signature en base64 (data:image/png;base64,...) ou URL';

-- Vérification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lease_signers' 
AND column_name = 'signature_image';






