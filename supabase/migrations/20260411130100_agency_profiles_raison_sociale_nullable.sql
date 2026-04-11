-- ============================================
-- Migration: Rendre raison_sociale nullable sur agency_profiles
-- Date: 2026-04-11
-- Contexte:
--   L'API /api/v1/auth/register upsert agency_profiles avec { profile_id }
--   uniquement à l'inscription. La raison_sociale sera fournie ensuite
--   lors de l'onboarding /agency/onboarding/profile.
--
--   La contrainte NOT NULL faisait crasher silencieusement l'upsert,
--   bloquant toute inscription en tant qu'agence.
-- ============================================

ALTER TABLE public.agency_profiles
  ALTER COLUMN raison_sociale DROP NOT NULL;

COMMENT ON COLUMN public.agency_profiles.raison_sociale IS
'Raison sociale de l''agence. NULL autorisé temporairement entre l''inscription
et la finalisation de l''onboarding /agency/onboarding/profile qui la renseigne.';
