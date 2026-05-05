-- =====================================================
-- Tracking des invitations envoyées depuis la marketplace
-- =====================================================
-- POST /api/providers/external-favorites/[placeId]/invite envoie un mail
-- Talok-side à un artisan repéré sur la carte. On persiste ici les
-- métadonnées de tracking (qui a invité qui, quand, combien de fois)
-- pour : (a) éviter les doublons si le propriétaire reclique, (b) afficher
-- un badge "Invité le 5/5/2026" dans le sheet détail, (c) servir de base
-- à un funnel de conversion plus tard (PostHog).

ALTER TABLE public.provider_external_favorites
  ADD COLUMN IF NOT EXISTS last_invite_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_invite_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS invite_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.provider_external_favorites.last_invite_at IS
  'Horodatage du dernier envoi d''invitation Talok-side via /invite. NULL = jamais invité.';
COMMENT ON COLUMN public.provider_external_favorites.last_invite_email IS
  'Email cible de la dernière invitation (pour audit + dédup côté UI).';
COMMENT ON COLUMN public.provider_external_favorites.invite_count IS
  'Nombre total d''invitations envoyées pour ce favori (toutes adresses confondues).';

-- Index partiel : la liste "favoris déjà invités" reste petite, on peut
-- afficher un badge sans scan de table.
CREATE INDEX IF NOT EXISTS idx_provider_external_favorites_last_invite
  ON public.provider_external_favorites (owner_profile_id, last_invite_at DESC NULLS LAST)
  WHERE last_invite_at IS NOT NULL;
