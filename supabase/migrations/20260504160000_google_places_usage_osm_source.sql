-- =====================================================
-- Autorise la source 'osm' dans google_places_usage
-- Suite au remplacement du fallback "demo" (données fictives) par
-- une recherche réelle via Overpass API / OpenStreetMap quand
-- Google Places n'est pas disponible (clé absente, REQUEST_DENIED…).
-- =====================================================

ALTER TABLE public.google_places_usage
  DROP CONSTRAINT IF EXISTS google_places_usage_source_check;

ALTER TABLE public.google_places_usage
  ADD CONSTRAINT google_places_usage_source_check
  CHECK (source IN ('google', 'cache', 'demo', 'osm'));

-- Idem sur provider_external_favorites : permettre 'osm' pour mémoriser
-- des favoris ajoutés depuis la liste de prestataires OSM.
ALTER TABLE public.provider_external_favorites
  DROP CONSTRAINT IF EXISTS provider_external_favorites_source_check;

ALTER TABLE public.provider_external_favorites
  ADD CONSTRAINT provider_external_favorites_source_check
  CHECK (source IN ('google', 'demo', 'manual', 'osm'));
