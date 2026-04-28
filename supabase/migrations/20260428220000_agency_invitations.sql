-- =====================================================
-- MIGRATION: Module invitations agence (collaborateurs)
-- Date: 2026-04-28
--
-- Une agence (profile.role='agency') peut inviter des collaborateurs
-- (directeur, gestionnaire, assistant, comptable) via email. Le
-- collaborateur invité s'inscrit avec profile.role='agency' et est lié
-- à l'agence via une nouvelle ligne dans `agency_managers`.
--
-- Architecture alignée avec :
--   - guarantor_invitations (modèle d'invitation standalone)
--   - agency_managers (table de liaison existante, role_agence :
--     directeur | gestionnaire | assistant | comptable)
-- =====================================================

BEGIN;

-- ============================================
-- 1. TABLE agency_invitations
-- ============================================

CREATE TABLE IF NOT EXISTS public.agency_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Agence émettrice
  agency_profile_id UUID NOT NULL REFERENCES public.agency_profiles(profile_id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Destinataire
  email TEXT NOT NULL,
  prenom TEXT,
  nom TEXT,
  telephone TEXT,

  -- Rôle dans l'agence (cf. agency_managers.role_agence)
  role_agence TEXT NOT NULL DEFAULT 'gestionnaire'
    CHECK (role_agence IN ('directeur', 'gestionnaire', 'assistant', 'comptable')),
  can_sign_documents BOOLEAN NOT NULL DEFAULT FALSE,

  personal_message TEXT,

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

  -- Lien post-acceptation
  accepted_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  agency_manager_id UUID REFERENCES public.agency_managers(id) ON DELETE SET NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (agency_profile_id, email)
);

CREATE INDEX IF NOT EXISTS idx_agency_invitations_agency ON public.agency_invitations(agency_profile_id);
CREATE INDEX IF NOT EXISTS idx_agency_invitations_email ON public.agency_invitations(email);
CREATE INDEX IF NOT EXISTS idx_agency_invitations_status ON public.agency_invitations(status);
CREATE INDEX IF NOT EXISTS idx_agency_invitations_token ON public.agency_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_agency_invitations_expires_at ON public.agency_invitations(expires_at);

COMMENT ON TABLE public.agency_invitations IS 'Invitations envoyées par une agence à ses collaborateurs (directeur/gestionnaire/assistant/comptable)';
COMMENT ON COLUMN public.agency_invitations.invitation_token IS 'UUID utilisé dans l''URL /signup/role?invite=...';

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_agency_invitations_updated_at ON public.agency_invitations;
CREATE TRIGGER update_agency_invitations_updated_at
  BEFORE UPDATE ON public.agency_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2. RLS — agency_invitations
-- ============================================

ALTER TABLE public.agency_invitations ENABLE ROW LEVEL SECURITY;

-- L'agence émettrice voit/gère ses invitations
CREATE POLICY "agency_invitations_owner_select" ON public.agency_invitations
  FOR SELECT USING (
    invited_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR agency_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "agency_invitations_owner_insert" ON public.agency_invitations
  FOR INSERT WITH CHECK (
    invited_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "agency_invitations_owner_update" ON public.agency_invitations
  FOR UPDATE USING (
    invited_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR agency_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Le collaborateur invité voit son invitation (par email match)
CREATE POLICY "agency_invitations_invited_select" ON public.agency_invitations
  FOR SELECT USING (
    LOWER(email) = LOWER(COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
  );

-- Admin de la plateforme : accès complet
CREATE POLICY "agency_invitations_admin_all" ON public.agency_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'platform_admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_invitations TO authenticated;

COMMIT;
