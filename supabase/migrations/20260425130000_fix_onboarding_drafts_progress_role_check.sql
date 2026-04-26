-- ============================================
-- Migration : Autoriser syndic + agency dans onboarding_drafts et onboarding_progress
-- Date : 2026-04-25
-- Contexte :
--   La migration 20240101000004_onboarding_tables.sql a créé les tables
--   `onboarding_drafts` et `onboarding_progress` avec une contrainte CHECK
--   sur `role` limitée à ('owner', 'tenant', 'provider', 'guarantor').
--
--   La migration 20260411130300 a corrigé `onboarding_analytics` et
--   `onboarding_reminders` pour les 6 rôles publics, mais a oublié ces deux
--   tables. La migration 20260415000000_signup_integrity_guard utilise
--   `CREATE TABLE IF NOT EXISTS` qui ne touche pas aux contraintes existantes.
--
--   Résultat : un syndic ou une agence qui sauvegarde un brouillon
--   d'onboarding ou marque une étape complétée déclenche une violation
--   CHECK silencieuse côté base.
--
--   Cette migration aligne ces deux tables sur les 6 rôles publics Talok.
-- ============================================

ALTER TABLE public.onboarding_drafts
  DROP CONSTRAINT IF EXISTS onboarding_drafts_role_check;

ALTER TABLE public.onboarding_drafts
  ADD CONSTRAINT onboarding_drafts_role_check
  CHECK (role IS NULL OR role IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency'));

ALTER TABLE public.onboarding_progress
  DROP CONSTRAINT IF EXISTS onboarding_progress_role_check;

ALTER TABLE public.onboarding_progress
  ADD CONSTRAINT onboarding_progress_role_check
  CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency'));
