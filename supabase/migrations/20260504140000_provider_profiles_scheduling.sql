-- =====================================================
-- Provider scheduling preferences
-- Persiste les préférences de disponibilité saisies à
-- l'onboarding /provider/onboarding/ops (auparavant
-- stockées uniquement dans onboarding_drafts.data en JSON).
-- =====================================================

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS jours_disponibles TEXT[] DEFAULT '{}'
    CHECK (jours_disponibles <@ ARRAY[
      'lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'
    ]::text[]);

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS horaires_debut TIME;

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS horaires_fin TIME;

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS sla_souhaite TEXT
    CHECK (sla_souhaite IN ('24h','48h','72h','semaine'));
