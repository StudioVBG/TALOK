-- =====================================================
-- Migration: Ajouter contrainte CHECK et index pour signataires invités
-- Date: 2026-01-02
-- =====================================================
-- Complète la migration 20251221000003 qui rend profile_id nullable
-- Ajoute une contrainte CHECK et un index pour optimiser les requêtes
-- =====================================================

BEGIN;

-- 1. Vérifier si profile_id est déjà nullable (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_signers' 
    AND column_name = 'profile_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE lease_signers 
      ALTER COLUMN profile_id DROP NOT NULL;
  END IF;
END $$;

-- 2. Ajouter la contrainte CHECK pour s'assurer qu'on a soit profile_id, soit invited_email
-- (idempotent - vérifie si la contrainte existe déjà)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'lease_signers_profile_or_email_check'
  ) THEN
    ALTER TABLE lease_signers
      ADD CONSTRAINT lease_signers_profile_or_email_check 
      CHECK (
        (profile_id IS NOT NULL) OR 
        (invited_email IS NOT NULL)
      );
  END IF;
END $$;

-- 3. Ajouter un index partiel pour les signataires invités (sans profile_id)
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited 
ON lease_signers(lease_id, invited_email) 
WHERE profile_id IS NULL AND invited_email IS NOT NULL;

-- 4. Commentaires pour documentation
COMMENT ON COLUMN lease_signers.profile_id IS 
  'ID du profil (NULL si le signataire n''a pas encore créé son compte)';
COMMENT ON COLUMN lease_signers.invited_email IS 
  'Email d''invitation (requis si profile_id est NULL)';

COMMIT;

