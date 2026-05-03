-- ============================================
-- P0 — Récupération des owners promus syndic par erreur
-- ============================================
-- Contexte : deux routes API mutaient silencieusement profiles.role
-- de 'owner' vers 'syndic' :
--   1. POST /api/syndic-invite/[token]
--   2. POST /api/buildings/[id]/activate-as-syndic
--
-- Conséquence : owner perdu l'accès à /owner/** sans rollback possible.
--
-- Fix routes : voir commit P0 (les UPDATE role sont retirés).
-- Fix data : cette migration restaure profiles.role = 'owner' pour tout
-- profil qui possède une trace d'activité owner antérieure (owner_profiles
-- existant) et qui est aujourd'hui en role='syndic' uniquement parce
-- qu'on l'a promu.
--
-- L'accès syndic continue d'être garanti par :
--   - sites.syndic_profile_id (le profil reste gestionnaire)
--   - user_site_roles.role_code = 'syndic' (créé par cette migration
--     pour conserver l'éligibilité au namespace /syndic).
-- ============================================

DO $$
DECLARE
  v_recovered INTEGER := 0;
  v_role_traces INTEGER := 0;
BEGIN
  -- 1. Pour chaque profil owner promu syndic, on insère un user_site_role
  --    'syndic' sur chaque site qu'il gère, AVANT de remettre role='owner'.
  --    Ainsi le layout /syndic continue de l'autoriser.
  WITH promoted AS (
    SELECT p.id AS profile_id, p.user_id
    FROM public.profiles p
    WHERE p.role = 'syndic'
      AND EXISTS (SELECT 1 FROM public.owner_profiles op WHERE op.profile_id = p.id)
  ),
  inserted_roles AS (
    INSERT INTO public.user_site_roles (user_id, site_id, role_code)
    SELECT pr.user_id, s.id, 'syndic'
    FROM promoted pr
    JOIN public.sites s ON s.syndic_profile_id = pr.profile_id
    WHERE pr.user_id IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_role_traces FROM inserted_roles;

  -- 2. On rétablit role='owner' pour ces profils.
  WITH promoted AS (
    SELECT p.id AS profile_id
    FROM public.profiles p
    WHERE p.role = 'syndic'
      AND EXISTS (SELECT 1 FROM public.owner_profiles op WHERE op.profile_id = p.id)
  ),
  fixed AS (
    UPDATE public.profiles p
    SET role = 'owner', updated_at = NOW()
    FROM promoted pr
    WHERE p.id = pr.profile_id
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_recovered FROM fixed;

  IF v_recovered > 0 THEN
    RAISE NOTICE 'Recovery: % profil(s) restauré(s) en role=owner, % rôle(s) syndic conservé(s) via user_site_roles',
      v_recovered, v_role_traces;
  ELSE
    RAISE NOTICE 'Recovery: aucun owner promu syndic à restaurer.';
  END IF;
END $$;

-- 3. Garde-fou DB : empêche toute mutation owner→syndic sans trace explicite.
--    Le trigger lève une exception. On ne bloque PAS les vrais syndics qui
--    s'inscrivent (INSERT direct avec role='syndic') ni les changements
--    initiés par platform_admin.
CREATE OR REPLACE FUNCTION public.prevent_silent_owner_to_syndic_promotion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.role = 'owner'
     AND NEW.role = 'syndic' THEN
    RAISE EXCEPTION
      'Mutation owner -> syndic interdite : utiliser sites.syndic_profile_id + user_site_roles. '
      'Si vous êtes platform_admin, faites le changement via la console admin avec un audit log.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_silent_owner_to_syndic ON public.profiles;
CREATE TRIGGER trg_prevent_silent_owner_to_syndic
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_silent_owner_to_syndic_promotion();

COMMENT ON FUNCTION public.prevent_silent_owner_to_syndic_promotion() IS
  'Garde-fou P0 : interdit la promotion silencieuse owner -> syndic. '
  'Source de vérité du rôle syndic = sites.syndic_profile_id + user_site_roles.role_code.';
