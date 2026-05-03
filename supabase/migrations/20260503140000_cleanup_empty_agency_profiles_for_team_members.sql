-- ============================================
-- Cleanup : supprimer les agency_profiles vides des team members
-- ============================================
-- Bug historique : /api/v1/auth/register créait un agency_profiles
-- (vide) pour tout user inscrit avec role='agency', y compris les
-- team members invités via agency_invitations. Ces rows parasitaient
-- l'affichage du header dans /agency/layout.tsx (qui faisait .single()
-- sur le profile_id de l'utilisateur courant au lieu de l'agence parent).
--
-- Le fix de la route + le fix du layout sont désormais en place. Cette
-- migration nettoie les rows historiques pour éviter qu'elles ne soient
-- réutilisées par mégarde si un développeur ajoute un nouveau code-path
-- qui requête agency_profiles par profile_id.
--
-- Critère strict :
--   - Le profile_id existe dans agency_managers.user_profile_id
--   - Et la row agency_profiles est "vide" (pas de raison_sociale,
--     pas de SIRET, pas d'email pro renseigné)
-- ============================================

DO $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  WITH deleted AS (
    DELETE FROM public.agency_profiles ap
    WHERE
      ap.profile_id IN (
        SELECT DISTINCT am.user_profile_id
        FROM public.agency_managers am
        WHERE am.is_active = true
      )
      AND ap.profile_id NOT IN (
        -- Sauf si quelqu'un est ENCORE l'agence parente (paranoia)
        SELECT DISTINCT am.agency_profile_id
        FROM public.agency_managers am
      )
      AND COALESCE(ap.raison_sociale, '') = ''
      AND COALESCE(ap.siret, '') = ''
      AND COALESCE(ap.numero_carte_pro, '') = ''
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  IF v_deleted > 0 THEN
    RAISE NOTICE 'Agency cleanup: % empty agency_profiles row(s) deleted (team members)', v_deleted;
  ELSE
    RAISE NOTICE 'Agency cleanup: no empty agency_profiles to delete';
  END IF;
END $$;
