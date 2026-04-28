-- =====================================================
-- MIGRATION: Hardening des RPC d'invitations copro
-- Date: 2026-04-28
--
-- Findings de l'audit sécurité des RPC SECURITY DEFINER
-- (lib/invitations/server-resolver + audit C):
--
-- 1. 🔴 accept_copro_invite acceptait n'importe quel p_user_id sans
--    vérifier qu'il correspond au caller authentifié. Un user
--    authentifié pouvait forger l'acceptation d'une invitation au
--    nom d'un autre user (à condition que l'email cible matche).
--    Fix : exiger auth.uid() = p_user_id.
--
-- 2. ⚠️ validate_copro_invite retournait l'email/first_name/last_name
--    même pour des invitations cancelled/accepted. Le token étant
--    secret (UUID v4, 122 bits) le risque est limité, mais on
--    durcit pour ne révéler que les infos minimales nécessaires.
-- =====================================================

BEGIN;

-- ============================================
-- 1. validate_copro_invite : ne pas leak email pour status non-pending
-- ============================================

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
  SELECT * INTO v_invite FROM public.copro_invites ci WHERE ci.token = p_token LIMIT 1;

  IF v_invite IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::UUID, NULL::TEXT, NULL::UUID, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::NUMERIC, 'Invitation introuvable'::TEXT;
    RETURN;
  END IF;

  -- Pour les status non-actionnables, ne pas leak les PII
  -- (email, prenom, nom). On retourne juste le code d'erreur.
  IF v_invite.status = 'cancelled' THEN
    RETURN QUERY SELECT FALSE, v_invite.id, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::UUID, NULL::TEXT, NULL::UUID, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::NUMERIC,
      'Cette invitation a été annulée'::TEXT;
    RETURN;
  END IF;

  IF v_invite.status = 'accepted' THEN
    RETURN QUERY SELECT FALSE, v_invite.id, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::UUID, NULL::TEXT, NULL::UUID, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::NUMERIC,
      'Cette invitation a déjà été acceptée'::TEXT;
    RETURN;
  END IF;

  IF v_invite.expires_at < NOW() THEN
    UPDATE public.copro_invites SET status = 'expired'
    WHERE id = v_invite.id AND status IN ('pending', 'sent');

    RETURN QUERY SELECT FALSE, v_invite.id, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::UUID, NULL::TEXT, NULL::UUID, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::NUMERIC,
      'Cette invitation a expiré. Demandez un nouveau lien au syndic.'::TEXT;
    RETURN;
  END IF;

  -- Status pending/sent : retour enrichi pour la page d'acceptation
  SELECT s.name INTO v_site_name FROM public.sites s WHERE s.id = v_invite.site_id;
  IF v_invite.unit_id IS NOT NULL THEN
    SELECT cu.lot_number INTO v_lot_number FROM public.copro_units cu WHERE cu.id = v_invite.unit_id;
  END IF;

  RETURN QUERY SELECT TRUE, v_invite.id, v_invite.email, v_invite.first_name, v_invite.last_name,
    v_invite.site_id, v_site_name, v_invite.unit_id, v_lot_number,
    v_invite.target_role, v_invite.ownership_type, v_invite.ownership_share, NULL::TEXT;
END;
$$;

-- ============================================
-- 2. accept_copro_invite : exiger auth.uid() = p_user_id
-- ============================================

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
  v_caller UUID;
BEGIN
  -- 0. Vérifier que le caller authentifié correspond à p_user_id.
  --    Empêche un user authentifié de forger l'acceptation d'une
  --    invitation au nom d'un autre user (même si l'email matche).
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, FALSE,
      'Authentification requise'::TEXT;
    RETURN;
  END IF;
  IF v_caller <> p_user_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, FALSE,
      'Le user ne correspond pas à la session authentifiée'::TEXT;
    RETURN;
  END IF;

  -- 1. Charger l'invitation
  SELECT * INTO v_invite FROM public.copro_invites ci WHERE ci.token = p_token LIMIT 1;

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
  SET status = 'accepted', accepted_at = NOW(), accepted_by = p_user_id
  WHERE id = v_invite.id AND status IN ('pending', 'sent');

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
    ELSE NULL
  END;

  -- 5. Insérer dans user_site_roles si rôle mappable
  IF v_role_code IS NOT NULL THEN
    INSERT INTO public.user_site_roles (user_id, site_id, role_code, unit_ids, granted_by)
    VALUES (
      p_user_id, v_invite.site_id, v_role_code,
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
     AND v_invite.target_role IN ('coproprietaire_occupant', 'coproprietaire_bailleur', 'coproprietaire_nu', 'usufruitier')
  THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
    IF v_profile_id IS NOT NULL THEN
      UPDATE public.copro_units SET owner_profile_id = v_profile_id WHERE id = v_invite.unit_id;
      v_ownership_created := TRUE;
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, v_invite.id, COALESCE(v_role_code, v_invite.target_role)::TEXT,
    v_ownership_created, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION public.accept_copro_invite(UUID, UUID) IS
  'Accepte une invitation copro de manière atomique. Vérifie auth.uid()=p_user_id (anti-forgery), email match, expiration, race conditions. Mappe target_role et porte l''ownership.';

COMMIT;
