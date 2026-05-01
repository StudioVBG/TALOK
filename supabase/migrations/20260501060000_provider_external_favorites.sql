-- =====================================================
-- Migration: provider_external_favorites
-- =====================================================
-- Stocke les prestataires "externes" (Google Places ou démo) qu'un
-- propriétaire a explicitement enregistrés depuis le composant
-- NearbyProvidersSearch. Avant cette table, les favoris étaient persistés
-- en localStorage uniquement, donc invisibles d'un appareil à l'autre et
-- perdus à chaque vidage du navigateur.
--
-- Un prestataire externe n'a pas de compte Talok : il n'apparaît donc
-- pas dans provider_profiles. On stocke ici un snapshot léger qui permet
-- d'afficher les favoris dans /owner/providers même quand l'API Google
-- ne renvoie plus le résultat (place_id volatile, hors zone, hors rayon).
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_external_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Identifiant fournisseur externe (Google place_id ou "demo-xxx")
  place_id TEXT NOT NULL,

  -- Snapshot des informations affichées
  name TEXT NOT NULL,
  category TEXT,
  address TEXT,
  phone TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  rating NUMERIC(3,2),
  reviews_count INTEGER,
  google_maps_url TEXT,

  -- Notes libres ajoutées par le propriétaire
  notes TEXT,

  source TEXT NOT NULL DEFAULT 'google' CHECK (source IN ('google', 'demo', 'manual')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un même prestataire ne peut être enregistré qu'une fois par propriétaire
  CONSTRAINT provider_external_favorites_unique
    UNIQUE (owner_profile_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_external_favorites_owner
  ON provider_external_favorites(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_external_favorites_category
  ON provider_external_favorites(owner_profile_id, category);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION provider_external_favorites_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_provider_external_favorites_updated_at
  ON provider_external_favorites;
CREATE TRIGGER trg_provider_external_favorites_updated_at
  BEFORE UPDATE ON provider_external_favorites
  FOR EACH ROW
  EXECUTE FUNCTION provider_external_favorites_set_updated_at();

-- RLS : chaque propriétaire ne voit que ses propres favoris
ALTER TABLE provider_external_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_external_favorites_owner_select
  ON provider_external_favorites;
CREATE POLICY provider_external_favorites_owner_select
  ON provider_external_favorites
  FOR SELECT
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS provider_external_favorites_owner_insert
  ON provider_external_favorites;
CREATE POLICY provider_external_favorites_owner_insert
  ON provider_external_favorites
  FOR INSERT
  WITH CHECK (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS provider_external_favorites_owner_update
  ON provider_external_favorites;
CREATE POLICY provider_external_favorites_owner_update
  ON provider_external_favorites
  FOR UPDATE
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS provider_external_favorites_owner_delete
  ON provider_external_favorites;
CREATE POLICY provider_external_favorites_owner_delete
  ON provider_external_favorites
  FOR DELETE
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Bypass admin
DROP POLICY IF EXISTS provider_external_favorites_admin
  ON provider_external_favorites;
CREATE POLICY provider_external_favorites_admin
  ON provider_external_favorites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'platform_admin')
    )
  );

NOTIFY pgrst, 'reload schema';
