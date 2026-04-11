-- ============================================
-- Migration : Autoriser syndic + agency dans onboarding_analytics et onboarding_reminders
-- Date : 2026-04-11
-- Contexte :
--   La migration 20260114000000 a créé les tables `onboarding_analytics`
--   et `onboarding_reminders` avec une contrainte CHECK sur `role` limitée
--   à ('owner', 'tenant', 'provider', 'guarantor').
--
--   Résultat : toute tentative de tracer l'onboarding d'un compte syndic
--   ou agency (appelée depuis useOnboarding → onboardingAnalyticsService
--   → startOnboarding) échoue avec une violation de contrainte CHECK.
--
--   De même, impossible de planifier un rappel d'onboarding (24h/72h/7d)
--   ou une relance de complétion pour un syndic ou une agence.
--
--   Cette migration remplace la contrainte par la liste complète des rôles
--   supportés par la plateforme Talok.
-- ============================================

ALTER TABLE public.onboarding_analytics
  DROP CONSTRAINT IF EXISTS onboarding_analytics_role_check;

ALTER TABLE public.onboarding_analytics
  ADD CONSTRAINT onboarding_analytics_role_check
  CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency'));

ALTER TABLE public.onboarding_reminders
  DROP CONSTRAINT IF EXISTS onboarding_reminders_role_check;

ALTER TABLE public.onboarding_reminders
  ADD CONSTRAINT onboarding_reminders_role_check
  CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency'));
