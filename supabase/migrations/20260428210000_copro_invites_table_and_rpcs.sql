-- =====================================================
-- MIGRATION: Module invitations copropriété
-- Date: 2026-04-28
--
-- Crée la table `copro_invites` et les RPC associées
-- (`validate_copro_invite`, `accept_copro_invite`) référencées par :
--   - app/api/copro/invites/route.ts (POST/GET, INSERT direct)
--   - app/api/copro/invites/[token]/route.ts (GET via RPC, POST via RPC, DELETE/PATCH)
--   - features/copro/services/invites.service.ts (CRUD client)
--   - app/syndic/invites/page.tsx, app/invite/copro/page.tsx (UI)
--
-- Contrats :
--   - lib/types/copro.ts : CoproInvite, InviteValidationResult, InviteAcceptResult
--   - InviteTargetRole : 10 valeurs (syndic, conseil_syndical, president_cs,
--     coproprietaire_occupant/bailleur/nu, usufruitier, locataire, gardien,
--     prestataire)
--
-- Mapping target_role → user_site_roles.role_code (CHECK existant restrictif) :
--   syndic                     → syndic
--   conseil_syndical/president → conseil_syndical
--   coproprietaire_occupant    → coproprietaire
--   coproprietaire_nu          → coproprietaire
--   usufruitier                → coproprietaire
--   coproprietaire_bailleur    → coproprietaire_bailleur
--   locataire                  → locataire_copro
--   gardien / prestataire      → pas de role dans user_site_roles
--
-- L'ownership est porté par copro_units.owner_profile_id (single owner) ;
-- pour les rôles coproprietaire_* avec unit_id, on update ce champ. La
-- gestion fine de l'indivision n'est pas dans ce périmètre.
-- =====================================================

BEGIN;

-- ============================================
-- 1. TABLE copro_invites
-- ============================================

CREATE TABLE IF NOT EXISTS public.copro_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Destinataire
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,

  -- Cible
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.copro_units(id) ON DELETE SET NULL,
  target_role TEXT NOT NULL DEFAULT 'coproprietaire_occupant'
    CHECK (target_role IN (
      'syndic', 'conseil_syndical', 'president_cs',
      'coproprietaire_occupant', 'coproprietaire_bailleur',
      'coproprietaire_nu', 'usufruitier',
      'locataire', 'gardien', 'prestataire'
    )),
  ownership_type TEXT
    CHECK (ownership_type IS NULL OR ownership_type IN (
      'pleine_propriete', 'nue_propriete', 'usufruit', 'indivision', 'sci', 'autre'
    )),
  ownership_share NUMERIC(5,4) NOT NULL DEFAULT 1.0
    CHECK (ownership_share >= 0 AND ownership_share <= 1),

  personal_message TEXT,

  -- Émetteur (auth user du syndic / admin)
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'accepted', 'expired', 'cancelled')),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,

  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Une seule invitation pending/sent par couple (site, email)
  UNIQUE (site_id, email)
);

CREATE INDEX IF NOT EXISTS idx_copro_invites_site ON public.copro_invites(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_invites_email ON public.copro_invites(email);
CREATE INDEX IF NOT EXISTS idx_copro_invites_status ON public.copro_invites(status);
CREATE INDEX IF NOT EXISTS idx_copro_invites_token ON public.copro_invites(token);
CREATE INDEX IF NOT EXISTS idx_copro_invites_expires_at ON public.copro_invites(expires_at);

COMMENT ON TABLE public.copro_invites IS 'Invitations envoyées par les syndics aux copropriétaires/locataires/prestataires';
COMMENT ON COLUMN public.copro_invites.token IS 'UUID utilisé dans l''URL /invite/copro?token=...';
COMMENT ON COLUMN public.copro_invites.target_role IS 'Rôle cible (taxonomie copro fine) — mappé à user_site_roles.role_code à l''acceptation';

-- Trigger updated_at (la fonction update_updated_at_column existe déjà)
DROP TRIGGER IF EXISTS update_copro_invites_updated_at ON public.copro_invites;
CREATE TRIGGER update_copro_invites_updated_at
  BEFORE UPDATE ON public.copro_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2. RLS — copro_invites
-- ============================================

ALTER TABLE public.copro_invites ENABLE ROW LEVEL SECURITY;

-- Le syndic du site peut tout faire sur ses invitations
CREATE POLICY "copro_invites_syndic_all" ON public.copro_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = copro_invites.site_id
      AND s.syndic_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- L'utilisateur invité peut voir son invitation (par email match)
CREATE POLICY "copro_invites_invited_select" ON public.copro_invites
  FOR SELECT USING (
    LOWER(email) = LOWER(COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
  );

-- Admin
CREATE POLICY "copro_invites_admin_all" ON public.copro_invites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.copro_invites TO authenticated;

-- ============================================
-- 3. RPC validate_copro_invite
-- ============================================
-- Publique (SECURITY DEFINER) car appelée par /api/copro/invites/[token]
-- avant authentification utilisateur. Retourne les infos enrichies
-- (site_name + lot_number) pour l'affichage de la page d'acceptation.

CREATE OR REPLACE FUNCTION public.validate_copro_invite(p_token UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  invite_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  site_id UUID,
  site_name TEXT,
  unit_id UUID,
  lot_number TEXT,
  target_role TEXT,
  ownership_type TEXT,
  ownership_share NUMERIC,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite RECORD;
  v_site_name TEXT;
  v_lot_number TEXT;
BEGIN
  SELECT *
  INTO v_invite
  FROM public.copro_invites ci
  WHERE ci.token = p_token
  LIMIT 1;

  IF v_invite IS NULL THEN
    RETURN QUERY SELECT
      FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::UUID, NULL::TEXT, NULL::UUID, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::NUMERIC,
      'Invitation introuvable'::TEXT;
    RETURN;
  END IF;

  IF v_invite.status = 'cancelled' THEN
    RETURN QUERY SELECT
      FALSE, v_invite.id, v_invite.email, v_invite.first_name, v_invite.last_name,
      v_invite.site_id, NULL::TEXT, v_invite.unit_id, NULL::TEXT,
      v_invite.target_role, v_invite.ownership_type, v_invite.ownership_share,
      'Cette invitation a été annulée'::TEXT;
    RETURN;
  END IF;

  IF v_invite.status = 'accepted' THEN
    RETURN QUERY SELECT
      FALSE, v_invite.id, v_invite.email, v_invite.first_name, v_invite.last_name,
      v_invite.site_id, NULL::TEXT, v_invite.unit_id, NULL::TEXT,
      v_invite.target_role, v_invite.ownership_type, v_invite.ownership_share,
      'Cette invitation a déjà été acceptée'::TEXT;
    RETURN;
  END IF;

  IF v_invite.expires_at < NOW() THEN
    -- Marquer expired pour le tableau de bord syndic (effet de bord acceptable
    -- via SECURITY DEFINER : la validation publique est aussi un point de
    -- garbage collection naturel pour les invitations périmées).
    UPDATE public.copro_invites
    SET status = 'expired'
    WHERE id = v_invite.id AND status IN ('pending', 'sent');

    RETURN QUERY SELECT
      FALSE, v_invite.id, v_invite.email, v_invite.first_name, v_invite.last_name,
      v_invite.site_id, NULL::TEXT, v_invite.unit_id, NULL::TEXT,
      v_invite.target_role, v_invite.ownership_type, v_invite.ownership_share,
      'Cette invitation a expiré. Demandez un nouveau lien au syndic.'::TEXT;
    RETURN;
  END IF;

  -- Enrichir avec site_name et lot_number
  SELECT s.name INTO v_site_name FROM public.sites s WHERE s.id = v_invite.site_id;
  IF v_invite.unit_id IS NOT NULL THEN
    SELECT cu.lot_number INTO v_lot_number
    FROM public.copro_units cu
    WHERE cu.id = v_invite.unit_id;
  END IF;

  RETURN QUERY SELECT
    TRUE, v_invite.id, v_invite.email, v_invite.first_name, v_invite.last_name,
    v_invite.site_id, v_site_name, v_invite.unit_id, v_lot_number,
    v_invite.target_role, v_invite.ownership_type, v_invite.ownership_share,
    NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION public.validate_copro_invite(UUID) IS
  'Valide un token d''invitation copro et retourne les infos enrichies pour la page d''acceptation. Marque les invitations expirées au passage.';

GRANT EXECUTE ON FUNCTION public.validate_copro_invite(UUID) TO anon, authenticated;

-- ============================================
-- 4. RPC accept_copro_invite
-- ============================================
-- Atomique : utilise un UPDATE conditionné sur status pour éviter les race
-- conditions. Vérifie l'email match côté serveur (defense-in-depth en plus
-- du check côté API route).

CREATE OR REPLACE FUNCTION public.accept_copro_invite(
  p_token UUID,
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  invite_id UUID,
  role_assigned TEXT,
  ownership_created BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite RECORD;
  v_user_email TEXT;
  v_invite_email TEXT;
  v_role_code TEXT;
  v_profile_id UUID;
  v_ownership_created BOOLEAN := FALSE;
  v_updated_count INTEGER;
BEGIN
  -- 1. Charger l'invitation
  SELECT * INTO v_invite
  FROM public.copro_invites ci
  WHERE ci.token = p_token
  LIMIT 1;

  IF v_invite IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, FALSE, 'Invitation introuvable'::TEXT;
    RETURN;
  END IF;

  IF v_invite.status = 'cancelled' THEN
    RETURN QUERY SELECT FALSE, v_invite.id, NULL::TEXT, FALSE, 'Cette invitation a été annulée'::TEXT;
    RETURN;
  END IF;

  IF v_invite.status = 'accepted' THEN
    RETURN QUERY SELECT FALSE, v_invite.id, NULL::TEXT, FALSE, 'Cette invitation a déjà été acceptée'::TEXT;
    RETURN;
  END IF;

  IF v_invite.expires_at < NOW() OR v_invite.status = 'expired' THEN
    RETURN QUERY SELECT FALSE, v_invite.id, NULL::TEXT, FALSE, 'Cette invitation a expiré'::TEXT;
    RETURN;
  END IF;

  -- 2. Vérifier l'email match (defense-in-depth)
  SELECT LOWER(TRIM(email)) INTO v_user_email FROM auth.users WHERE id = p_user_id;
  v_invite_email := LOWER(TRIM(v_invite.email));

  IF v_user_email IS NULL OR v_user_email <> v_invite_email THEN
    RETURN QUERY SELECT FALSE, v_invite.id, NULL::TEXT, FALSE,
      'L''email du compte ne correspond pas à l''invitation'::TEXT;
    RETURN;
  END IF;

  -- 3. Acceptation atomique (race-condition-safe)
  UPDATE public.copro_invites
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = p_user_id
  WHERE id = v_invite.id
    AND status IN ('pending', 'sent');

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RETURN QUERY SELECT FALSE, v_invite.id, NULL::TEXT, FALSE,
      'Cette invitation a déjà été utilisée'::TEXT;
    RETURN;
  END IF;

  -- 4. Mapper target_role → user_site_roles.role_code (CHECK restrictif)
  v_role_code := CASE v_invite.target_role
    WHEN 'syndic' THEN 'syndic'
    WHEN 'conseil_syndical' THEN 'conseil_syndical'
    WHEN 'president_cs' THEN 'conseil_syndical'
    WHEN 'coproprietaire_occupant' THEN 'coproprietaire'
    WHEN 'coproprietaire_nu' THEN 'coproprietaire'
    WHEN 'usufruitier' THEN 'coproprietaire'
    WHEN 'coproprietaire_bailleur' THEN 'coproprietaire_bailleur'
    WHEN 'locataire' THEN 'locataire_copro'
    ELSE NULL  -- gardien, prestataire : pas de rôle site (gérés par le module prestataire)
  END;

  -- 5. Insérer dans user_site_roles si rôle mappable
  IF v_role_code IS NOT NULL THEN
    INSERT INTO public.user_site_roles (user_id, site_id, role_code, unit_ids, granted_by)
    VALUES (
      p_user_id,
      v_invite.site_id,
      v_role_code,
      CASE WHEN v_invite.unit_id IS NOT NULL THEN ARRAY[v_invite.unit_id] ELSE ARRAY[]::UUID[] END,
      v_invite.invited_by
    )
    ON CONFLICT (user_id, site_id, role_code) DO UPDATE
      SET unit_ids = (
        SELECT ARRAY(
          SELECT DISTINCT u FROM unnest(
            COALESCE(user_site_roles.unit_ids, ARRAY[]::UUID[]) ||
            CASE WHEN v_invite.unit_id IS NOT NULL THEN ARRAY[v_invite.unit_id] ELSE ARRAY[]::UUID[] END
          ) AS t(u)
        )
      );
  END IF;

  -- 6. Si rôle de propriétaire avec unit_id : porter l'ownership sur le lot
  IF v_invite.unit_id IS NOT NULL
     AND v_invite.target_role IN (
       'coproprietaire_occupant', 'coproprietaire_bailleur',
       'coproprietaire_nu', 'usufruitier'
     )
  THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
    IF v_profile_id IS NOT NULL THEN
      UPDATE public.copro_units
      SET owner_profile_id = v_profile_id
      WHERE id = v_invite.unit_id;
      v_ownership_created := TRUE;
    END IF;
  END IF;

  RETURN QUERY SELECT
    TRUE,
    v_invite.id,
    COALESCE(v_role_code, v_invite.target_role)::TEXT,
    v_ownership_created,
    NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION public.accept_copro_invite(UUID, UUID) IS
  'Accepte une invitation copro de manière atomique : marque l''invitation acceptée, attribue le rôle dans user_site_roles, et porte l''ownership si applicable. Vérifie l''email match en defense-in-depth.';

GRANT EXECUTE ON FUNCTION public.accept_copro_invite(UUID, UUID) TO authenticated;

COMMIT;
