-- =====================================================
-- Migration: Ajouter signer_email à edl_signatures
-- Date: 2026-01-02
-- =====================================================
-- Permet de créer des signatures EDL avec invited_email
-- avant que le signataire n'ait créé son compte
-- =====================================================

BEGIN;

-- Ajouter la colonne signer_email si elle n'existe pas
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

-- Rendre signer_profile_id nullable si ce n'est pas déjà fait
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'edl_signatures' 
        AND column_name = 'signer_profile_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.edl_signatures 
        ALTER COLUMN signer_profile_id DROP NOT NULL;
    END IF;
END $$;

-- Rendre signer_user nullable si ce n'est pas déjà fait (pour les invitations)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'edl_signatures' 
        AND column_name = 'signer_user'
        AND is_nullable = 'NO'
    ) THEN
        -- Supprimer la contrainte FK d'abord si elle existe
        ALTER TABLE public.edl_signatures 
        DROP CONSTRAINT IF EXISTS edl_signatures_signer_user_fkey;
        
        ALTER TABLE public.edl_signatures 
        ALTER COLUMN signer_user DROP NOT NULL;
        
        -- Recréer la FK mais sans NOT NULL
        ALTER TABLE public.edl_signatures
        ADD CONSTRAINT edl_signatures_signer_user_fkey 
        FOREIGN KEY (signer_user) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Ajouter une contrainte CHECK pour s'assurer qu'on a soit signer_profile_id, soit signer_email
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'edl_signatures_profile_or_email_check'
    ) THEN
        ALTER TABLE public.edl_signatures
        ADD CONSTRAINT edl_signatures_profile_or_email_check 
        CHECK (
            (signer_profile_id IS NOT NULL) OR 
            (signer_email IS NOT NULL)
        );
    END IF;
END $$;

-- Index pour rechercher par email
CREATE INDEX IF NOT EXISTS idx_edl_signatures_signer_email 
ON public.edl_signatures(signer_email) 
WHERE signer_email IS NOT NULL;

-- Modifier la contrainte UNIQUE existante pour permettre plusieurs NULL
-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE public.edl_signatures
DROP CONSTRAINT IF EXISTS edl_signatures_edl_id_signer_profile_id_key;

-- Créer une contrainte UNIQUE partielle qui ne s'applique que si signer_profile_id n'est pas NULL
-- Cela permet plusieurs lignes avec signer_profile_id = NULL pour le même edl_id
CREATE UNIQUE INDEX IF NOT EXISTS edl_signatures_edl_id_signer_profile_id_unique
ON public.edl_signatures(edl_id, signer_profile_id)
WHERE signer_profile_id IS NOT NULL;

-- Créer une contrainte UNIQUE pour signer_email (un seul signataire invité par email par EDL)
CREATE UNIQUE INDEX IF NOT EXISTS edl_signatures_edl_id_signer_email_unique
ON public.edl_signatures(edl_id, signer_email)
WHERE signer_email IS NOT NULL;

COMMIT;

