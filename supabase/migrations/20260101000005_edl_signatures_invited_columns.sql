-- =====================================================
-- Migration: Colonnes d'invitation pour edl_signatures
-- Date: 2026-01-01
-- =====================================================
-- Permet de stocker les informations des signataires invités sans compte

BEGIN;

-- 1. Rendre signer_profile_id et signer_user nullable
ALTER TABLE public.edl_signatures 
  ALTER COLUMN signer_profile_id DROP NOT NULL;

-- signer_user peut aussi être NULL pour les invités
DO $$
BEGIN
    ALTER TABLE public.edl_signatures 
      ALTER COLUMN signer_user DROP NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 2. Ajouter la colonne signer_email si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'edl_signatures' 
        AND column_name = 'signer_email'
    ) THEN
        ALTER TABLE public.edl_signatures 
        ADD COLUMN signer_email VARCHAR(255);
        
        COMMENT ON COLUMN public.edl_signatures.signer_email IS 
            'Email du signataire (utilisé si signer_profile_id est NULL pour les invitations)';
    END IF;
END $$;

-- 3. Ajouter la colonne signer_name si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'edl_signatures' 
        AND column_name = 'signer_name'
    ) THEN
        ALTER TABLE public.edl_signatures 
        ADD COLUMN signer_name VARCHAR(255);
        
        COMMENT ON COLUMN public.edl_signatures.signer_name IS 
            'Nom du signataire (stocké directement ou extrait du profil)';
    END IF;
END $$;

-- 4. Index pour rechercher par email
CREATE INDEX IF NOT EXISTS idx_edl_signatures_signer_email 
ON public.edl_signatures(signer_email) 
WHERE signer_email IS NOT NULL;

-- 5. Modifier la contrainte UNIQUE existante pour permettre plusieurs NULL
-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE public.edl_signatures 
DROP CONSTRAINT IF EXISTS edl_signatures_edl_id_signer_profile_id_key;

-- Créer une contrainte UNIQUE partielle (uniquement pour signer_profile_id non-NULL)
CREATE UNIQUE INDEX IF NOT EXISTS edl_signatures_edl_id_signer_profile_id_unique
ON public.edl_signatures(edl_id, signer_profile_id)
WHERE signer_profile_id IS NOT NULL;

-- Créer une contrainte UNIQUE pour signer_email (un seul signataire invité par email par EDL)
CREATE UNIQUE INDEX IF NOT EXISTS edl_signatures_edl_id_signer_email_unique
ON public.edl_signatures(edl_id, signer_email)
WHERE signer_email IS NOT NULL;

COMMIT;

