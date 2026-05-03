-- ============================================
-- Fix : trigger apply_building_site_link ne réinitialisait pas site_id
-- ni owner_syndic_mode lors d'un cancel d'un link 'approved'
-- ============================================
-- Audit P1 (post-incident syndic du 2026-05-03) : la branche cancelled
-- du trigger ne couvrait que les transitions depuis 'pending' et oubliait
-- de remettre buildings.site_id à NULL. Conséquence : si on cancellait
-- une liaison approved par UPDATE direct (ex: console admin SQL),
-- buildings.site_id restait pointé sur un site potentiellement supprimé,
-- avec site_link_status='linked' incohérent.
--
-- En pratique, /api/buildings/[id]/unlink-site fait déjà le ménage
-- côté API (P1 commit a844e94). Cette migration aligne le trigger sur
-- le même contrat afin que toute mutation directe en SQL produise un
-- état cohérent.
-- ============================================

CREATE OR REPLACE FUNCTION public.apply_building_site_link()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_owner_profile_id UUID;
  v_owner_user_id UUID;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.buildings
    SET
      site_id = NEW.site_id,
      site_link_status = 'linked',
      site_linked_at = NOW(),
      owner_syndic_mode = 'managed_external',
      updated_at = NOW()
    WHERE id = NEW.building_id;

    SELECT b.owner_id INTO v_owner_profile_id
    FROM public.buildings b WHERE b.id = NEW.building_id;

    SELECT user_id INTO v_owner_user_id
    FROM public.profiles WHERE id = v_owner_profile_id;

    IF v_owner_user_id IS NOT NULL THEN
      INSERT INTO public.user_site_roles (user_id, site_id, role_code)
      VALUES (v_owner_user_id, NEW.site_id, 'coproprietaire_bailleur')
      ON CONFLICT DO NOTHING;
    END IF;

  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.buildings
    SET
      site_link_status = 'rejected',
      updated_at = NOW()
    WHERE id = NEW.building_id;

  ELSIF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    -- Fix : couvre TOUTES les transitions vers cancelled (depuis pending
    -- ou approved/linked) et réinitialise complètement le building.
    -- Avant : ne traitait que pending et oubliait site_id + owner_syndic_mode.
    UPDATE public.buildings
    SET
      site_id = NULL,
      site_link_status = 'unlinked',
      site_linked_at = NULL,
      owner_syndic_mode = 'none',
      updated_at = NOW()
    WHERE id = NEW.building_id
      AND site_link_status IN ('pending', 'linked');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.apply_building_site_link() IS
  'Trigger d''application des transitions de building_site_links sur '
  'buildings. Couvre approved/rejected/cancelled de manière idempotente.';
