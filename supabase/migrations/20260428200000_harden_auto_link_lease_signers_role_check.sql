-- =====================================================
-- MIGRATION: Durcissement du trigger auto_link_lease_signers
-- Date: 2026-04-28
--
-- PROBLÈME CORRIGÉ:
-- Le trigger précédent (20260216200000) liait tous les lease_signers
-- orphelins matchant l'email du profil créé, sans vérifier la cohérence
-- de rôle. Risque : un user qui crée un compte `tenant` était lié
-- automatiquement à un lease_signers.role = 'garant' s'il en existait
-- un avec le même email (cas rare mais possible).
--
-- SOLUTION:
-- - Ne lier que les lease_signers dont le rôle FR est cohérent avec
--   le rôle applicatif EN du profil créé (mapping côté DB :
--   tenant → locataire_principal/colocataire, guarantor → garant,
--   owner → proprietaire).
-- - Idem pour la consommation des `invitations` (même mapping).
-- - Logger en WARNING les emails matchés mais aux rôles incohérents
--   pour identifier les invitations mal configurées.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
  mismatch_count INT;
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Lier les lease_signers orphelins en exigeant la cohérence de rôle.
  UPDATE public.lease_signers ls
  SET profile_id = NEW.id
  WHERE LOWER(ls.invited_email) = LOWER(user_email)
    AND ls.profile_id IS NULL
    AND (
      (NEW.role = 'tenant'    AND ls.role IN ('locataire_principal', 'colocataire'))
      OR (NEW.role = 'guarantor' AND ls.role = 'garant')
      OR (NEW.role = 'owner'     AND ls.role = 'proprietaire')
    );

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  -- Compter les lease_signers dont l'email matche mais dont le rôle est
  -- incohérent : log warning pour traçabilité (invitation mal configurée,
  -- ou tentative de détournement bloquée).
  SELECT COUNT(*) INTO mismatch_count
  FROM public.lease_signers ls
  WHERE LOWER(ls.invited_email) = LOWER(user_email)
    AND ls.profile_id IS NULL
    AND NOT (
      (NEW.role = 'tenant'    AND ls.role IN ('locataire_principal', 'colocataire'))
      OR (NEW.role = 'guarantor' AND ls.role = 'garant')
      OR (NEW.role = 'owner'     AND ls.role = 'proprietaire')
    );

  IF mismatch_count > 0 THEN
    RAISE WARNING '[auto_link] % lease_signers non liés (email: %, profile.role: %) — rôles incohérents',
      mismatch_count, user_email, NEW.role;
  END IF;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %, role: %)',
      linked_count, NEW.id, user_email, NEW.role;
  END IF;

  -- Consommation des invitations bail avec la même règle de cohérence.
  -- (La table invitations.role utilise les libellés FR : locataire_principal,
  -- colocataire, garant.)
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL
    AND (
      (NEW.role = 'tenant'    AND role IN ('locataire_principal', 'colocataire'))
      OR (NEW.role = 'guarantor' AND role = 'garant')
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_link_lease_signers_on_profile_created() IS
  'Lie les lease_signers orphelins à un profil nouvellement créé, en exigeant la cohérence entre profile.role (EN) et lease_signers.role / invitations.role (FR). Cf. migration 20260428200000.';

COMMIT;
