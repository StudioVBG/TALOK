-- Migration: Ajout des champs de vérification IA pour les documents
BEGIN;

-- Create document_verification_status enum type if not exists
DO $$ BEGIN
    CREATE TYPE document_verification_status AS ENUM ('pending', 'verified', 'rejected', 'manual_review_required');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add columns to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS verification_status document_verification_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS ai_analysis JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Update RLS policies to allow users to read verification status
-- (Already covered by existing policies as they select *, but good to keep in mind)

COMMIT;

