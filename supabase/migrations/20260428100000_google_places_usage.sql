-- =====================================================
-- Suivi des appels à l'API Google Places
-- Permet le monitoring du quota gratuit (200 $/mois Maps Platform)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.google_places_usage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  called_at       timestamptz NOT NULL DEFAULT now(),
  endpoint        text NOT NULL CHECK (endpoint IN (
    'text_search',
    'nearby_search',
    'place_details',
    'geocoding',
    'place_photo'
  )),
  category        text,
  source          text NOT NULL CHECK (source IN ('google', 'cache', 'demo')),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL CHECK (status IN ('ok', 'error', 'zero_results')),
  results_count   integer NOT NULL DEFAULT 0,
  -- Coût estimé en centimes USD (Text Search = 32 USD / 1000 = 3.2 cents)
  estimated_cost_cents numeric(8,4) NOT NULL DEFAULT 0,
  cache_hit       boolean NOT NULL DEFAULT false,
  metadata        jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_google_places_usage_called_at
  ON public.google_places_usage (called_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_places_usage_endpoint
  ON public.google_places_usage (endpoint, called_at DESC);

-- RLS : seul un admin peut lire/écrire
ALTER TABLE public.google_places_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read google_places_usage" ON public.google_places_usage;
CREATE POLICY "Admins read google_places_usage"
  ON public.google_places_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins write google_places_usage" ON public.google_places_usage;
CREATE POLICY "Admins write google_places_usage"
  ON public.google_places_usage
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- (Le service role bypasse RLS et reste utilisé côté API pour logger.)

COMMENT ON TABLE public.google_places_usage IS
  'Journal des appels à Google Places API pour monitoring du quota gratuit (200 $/mois). Voir /admin/google-places-usage.';
