-- ============================================
-- Audit log des changements de rôle sur profiles
-- ============================================
-- Suite à l'incident "owner -> syndic muté silencieusement" (P0
-- migration 20260503100000), on installe une trace forensique sur
-- TOUTE mutation du champ profiles.role afin de détecter rapidement
-- tout futur dérapage du même genre.
--
-- Réutilise la table audit_log existante (migration
-- 20251231000010_export_system.sql) :
--   audit_log(user_id, action, entity_type, entity_id, metadata, created_at)
--
-- Le trigger reste léger (un seul INSERT, pas de SELECT additionnel) et
-- ne bloque jamais la mutation d'origine en cas d'erreur (EXCEPTION OTHERS).
-- ============================================

CREATE OR REPLACE FUNCTION public.log_profile_role_change()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- N'enregistre QUE les changements effectifs de rôle.
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      NEW.user_id,
      'profile.role_change',
      'profiles',
      NEW.id,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'auth_uid', auth.uid(),
        -- Détecte les transitions sensibles. owner -> syndic est désormais
        -- bloqué par trg_prevent_silent_owner_to_syndic mais on garde
        -- la trace au cas où un admin la fasse intentionnellement par RPC.
        'sensitive', (
          (OLD.role = 'owner' AND NEW.role = 'syndic') OR
          (OLD.role = 'tenant' AND NEW.role <> 'tenant') OR
          (OLD.role = 'guarantor' AND NEW.role <> 'guarantor')
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- L'audit ne doit JAMAIS bloquer une mutation légitime (ex: lors d'un
    -- onboarding initial où l'utilisateur n'est pas encore lié à auth.users).
    RAISE WARNING 'audit_log insert failed for profile %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_profile_role_change ON public.profiles;
CREATE TRIGGER trg_log_profile_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_role_change();

COMMENT ON FUNCTION public.log_profile_role_change() IS
  'Trace toute modification de profiles.role dans audit_log. '
  'Permet de détecter les mutations silencieuses similaires à l''incident '
  '20260503 (routes activate-as-syndic et syndic-invite).';

-- Index utile pour la recherche forensique côté admin
CREATE INDEX IF NOT EXISTS idx_audit_log_role_changes
  ON public.audit_log (created_at DESC)
  WHERE action = 'profile.role_change';
