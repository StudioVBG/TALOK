-- Migration: Ajout identity_status et onboarding_step sur profiles
-- Ces colonnes alimentent le middleware identity-gate qui contrôle
-- l'accès aux routes protégées selon le niveau de vérification.

-- Enum pour le statut d'identité
DO $$ BEGIN
  CREATE TYPE identity_status_enum AS ENUM (
    'unverified',
    'phone_verified',
    'document_uploaded',
    'identity_review',
    'identity_verified',
    'identity_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum pour l'étape d'onboarding
DO $$ BEGIN
  CREATE TYPE onboarding_step_enum AS ENUM (
    'account_created',
    'phone_pending',
    'phone_done',
    'profile_pending',
    'profile_done',
    'document_pending',
    'document_done',
    'complete'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ajout des colonnes sur profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_status identity_status_enum NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS onboarding_step onboarding_step_enum NOT NULL DEFAULT 'account_created',
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Index pour les requêtes du middleware (lookup par user + status)
CREATE INDEX IF NOT EXISTS idx_profiles_identity_status ON profiles (identity_status);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_step ON profiles (onboarding_step);

COMMENT ON COLUMN profiles.identity_status IS 'Niveau de vérification d''identité — utilisé par le middleware identity-gate';
COMMENT ON COLUMN profiles.onboarding_step IS 'Étape courante du parcours d''onboarding';
