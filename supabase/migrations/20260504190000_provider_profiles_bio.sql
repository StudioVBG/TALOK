-- Migration: provider_profiles — ajout colonne bio
-- Bug fix: la sauvegarde du profil prestataire échouait avec
-- "Could not find the 'bio' column of 'provider_profiles' in the schema cache"
-- car la colonne était utilisée par /api/me/provider-profile (PUT) et la page
-- /provider/settings, mais n'avait jamais été créée en base.

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS bio TEXT;

COMMENT ON COLUMN provider_profiles.bio IS
  'Description / présentation du prestataire affichée aux propriétaires (max 2000 caractères, contrôlé côté API).';

NOTIFY pgrst, 'reload schema';
