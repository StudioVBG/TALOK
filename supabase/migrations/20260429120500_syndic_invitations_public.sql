-- ============================================
-- Invitations publiques de syndics par les copropriétaires
-- ============================================
-- Quand un copropriétaire constate que son syndic n'est pas sur Talok,
-- il peut générer un token d'invitation et l'envoyer (par email ou en
-- partageant un lien). Le syndic clique → arrive sur une page d'inscription
-- pré-remplie. Une fois inscrit, on lui présente la copropriété à créer
-- et on auto-pré-rattache l'immeuble du copropriétaire qui l'a invité.

CREATE TABLE IF NOT EXISTS public.syndic_invitations_public (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,

  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  invited_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Coordonnées suggérées (pré-remplissage)
  suggested_syndic_name TEXT,
  suggested_syndic_email TEXT,
  suggested_syndic_phone TEXT,
  suggested_copro_name TEXT,
  message TEXT,

  -- Suivi
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days'),
  redeemed_at TIMESTAMPTZ,
  redeemed_by_user_id UUID REFERENCES auth.users(id),
  resulting_site_id UUID REFERENCES public.sites(id),

  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'redeemed', 'expired', 'cancelled')
  ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_syndic_invitations_public_token
  ON public.syndic_invitations_public(token);
CREATE INDEX IF NOT EXISTS idx_syndic_invitations_public_building
  ON public.syndic_invitations_public(building_id);
CREATE INDEX IF NOT EXISTS idx_syndic_invitations_public_status
  ON public.syndic_invitations_public(status, expires_at);

COMMENT ON TABLE public.syndic_invitations_public IS
'Invitations publiques générées par un copropriétaire pour qu''un syndic externe rejoigne Talok et prenne en charge la copropriété de l''invitant.';

-- ============================================
-- RLS — l'owner du building voit ses invitations
-- ============================================
ALTER TABLE public.syndic_invitations_public ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndic_invitations_public_owner_select" ON public.syndic_invitations_public;
CREATE POLICY "syndic_invitations_public_owner_select" ON public.syndic_invitations_public
  FOR SELECT TO authenticated
  USING (
    invited_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'platform_admin')
    )
  );

DROP POLICY IF EXISTS "syndic_invitations_public_owner_insert" ON public.syndic_invitations_public;
CREATE POLICY "syndic_invitations_public_owner_insert" ON public.syndic_invitations_public
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND building_id IN (
      SELECT b.id FROM public.buildings b
      JOIN public.profiles p ON p.id = b.owner_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "syndic_invitations_public_owner_update" ON public.syndic_invitations_public;
CREATE POLICY "syndic_invitations_public_owner_update" ON public.syndic_invitations_public
  FOR UPDATE TO authenticated
  USING (
    invited_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- La route /auth/syndic-invite/[token] charge l'invitation via service_role
-- (pas de policy public anonyme, le token suffit comme secret).
