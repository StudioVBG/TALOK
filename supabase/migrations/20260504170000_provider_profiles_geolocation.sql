-- =====================================================
-- Géolocalisation des prestataires Talok inscrits
-- Permet le tri par distance réelle dans la marketplace et
-- la fusion avec la recherche externe Google/OSM.
--
-- Cible la table `providers` (SOTA 2026) qui détient déjà
-- address/postal_code/city/service_radius_km/email/phone.
-- =====================================================

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS latitude       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude      DOUBLE PRECISION,
  -- Métadonnées de géocodage pour le monitoring/backfill.
  ADD COLUMN IF NOT EXISTS geocoded_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geocode_source TEXT;

-- Garde-fous : coordonnées dans la plage valide.
ALTER TABLE public.providers
  DROP CONSTRAINT IF EXISTS providers_latitude_range;
ALTER TABLE public.providers
  ADD CONSTRAINT providers_latitude_range
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE public.providers
  DROP CONSTRAINT IF EXISTS providers_longitude_range;
ALTER TABLE public.providers
  ADD CONSTRAINT providers_longitude_range
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

-- Index pour les requêtes de proximité (bounding-box queries simples).
-- PostGIS pourra être adopté plus tard si le volume le justifie.
CREATE INDEX IF NOT EXISTS idx_providers_latlng
  ON public.providers (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON COLUMN public.providers.latitude IS
  'Latitude de l''adresse (address + postal_code + city) géocodée. NULL = à géocoder.';
COMMENT ON COLUMN public.providers.longitude IS
  'Longitude de l''adresse géocodée.';
COMMENT ON COLUMN public.providers.geocoded_at IS
  'Timestamp du dernier géocodage réussi.';
COMMENT ON COLUMN public.providers.geocode_source IS
  'Service utilisé pour le géocodage (google | nominatim | data_gouv).';
