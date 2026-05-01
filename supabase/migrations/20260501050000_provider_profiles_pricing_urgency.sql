-- =====================================================
-- Migration: provider_profiles — colonnes tarification + urgence
-- =====================================================
-- Les colonnes tarif_min, tarif_max, disponibilite, disponibilite_urgence
-- étaient déclarées dans lib/supabase/database.types.ts et utilisées par
-- - app/api/providers/search/route.ts
-- - app/api/providers/[id]/route.ts
-- mais n'avaient jamais été créées en base, ce qui provoquait des 500
-- (PostgREST: column does not exist) sur la marketplace prestataires.
-- =====================================================

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS tarif_min NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tarif_max NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS disponibilite TEXT,
  ADD COLUMN IF NOT EXISTS disponibilite_urgence BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_provider_profiles_tarif_min
  ON provider_profiles(tarif_min);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_disponibilite_urgence
  ON provider_profiles(disponibilite_urgence)
  WHERE disponibilite_urgence = true;

NOTIFY pgrst, 'reload schema';
