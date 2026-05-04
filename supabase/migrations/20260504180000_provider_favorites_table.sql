-- =====================================================
-- Favoris prestataires Talok (côté propriétaire)
-- Permet de mémoriser les artisans Talok inscrits ajoutés en
-- favori depuis la marketplace. Persisté côté serveur (sync
-- multi-device, comme provider_external_favorites pour les
-- artisans Google/OSM).
--
-- Le code applicatif référençait déjà cette table dans
-- /api/providers/[id]/favorite mais elle n'a jamais été créée :
-- chaque clic cœur échouait silencieusement. Cette migration
-- corrige ce bug latent.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.provider_favorites (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT provider_favorites_unique
    UNIQUE (owner_profile_id, provider_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_favorites_owner
  ON public.provider_favorites (owner_profile_id);

CREATE INDEX IF NOT EXISTS idx_provider_favorites_provider
  ON public.provider_favorites (provider_profile_id);

-- RLS : un propriétaire ne lit/écrit que ses propres favoris.
ALTER TABLE public.provider_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own provider_favorites" ON public.provider_favorites;
CREATE POLICY "Owners read own provider_favorites"
  ON public.provider_favorites
  FOR SELECT
  USING (
    owner_profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners insert own provider_favorites" ON public.provider_favorites;
CREATE POLICY "Owners insert own provider_favorites"
  ON public.provider_favorites
  FOR INSERT
  WITH CHECK (
    owner_profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners update own provider_favorites" ON public.provider_favorites;
CREATE POLICY "Owners update own provider_favorites"
  ON public.provider_favorites
  FOR UPDATE
  USING (
    owner_profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners delete own provider_favorites" ON public.provider_favorites;
CREATE POLICY "Owners delete own provider_favorites"
  ON public.provider_favorites
  FOR DELETE
  USING (
    owner_profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.provider_favorites IS
  'Favoris d''artisans Talok inscrits, côté propriétaire. Pour les artisans externes (Google/OSM) voir provider_external_favorites.';
