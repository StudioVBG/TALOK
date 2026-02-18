-- =====================================================
-- MIGRATION: Synchronisation des changements d'email auth -> profiles
-- Date: 2026-02-18
-- Version: 20260218100000
--
-- PROBLEME:
--   Quand un utilisateur change son email via Supabase Auth
--   (confirmation d'email, changement d'email, etc.),
--   la colonne profiles.email n'est PAS mise a jour automatiquement.
--   Cela cause une desynchronisation entre auth.users.email
--   et profiles.email.
--
-- SOLUTION:
--   A. Trigger AFTER UPDATE sur auth.users qui met a jour
--      profiles.email quand auth.users.email change.
--   B. Backfill immediat des emails desynchronises.
--
-- SECURITE:
--   La fonction utilise SECURITY DEFINER pour bypasser les RLS
--   et mettre a jour le profil sans restrictions.
--   SET search_path = public pour eviter les injections de schema.
-- =====================================================

BEGIN;

-- ============================================
-- A. FONCTION DE SYNCHRONISATION EMAIL
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne rien faire si l'email n'a pas change
  IF NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;

  -- Mettre a jour l'email dans le profil
  UPDATE public.profiles
  SET
    email = NEW.email,
    updated_at = NOW()
  WHERE user_id = NEW.id;

  IF NOT FOUND THEN
    -- Le profil n'existe pas encore (race condition possible)
    -- handle_new_user() le creera avec le bon email
    RAISE WARNING '[handle_user_email_change] Profil introuvable pour user_id=%, email non synchronise', NEW.id;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la modification d'un utilisateur auth
  RAISE WARNING '[handle_user_email_change] Erreur sync email pour user_id=%: % (SQLSTATE=%)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_user_email_change() IS
'Synchronise automatiquement profiles.email quand auth.users.email change.
SECURITY DEFINER pour bypasser les RLS.
Ne bloque jamais la modification auth (EXCEPTION handler).';

-- ============================================
-- B. TRIGGER SUR auth.users (UPDATE)
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;

CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.handle_user_email_change();

-- ============================================
-- C. BACKFILL DES EMAILS DESYNCHRONISES
-- ============================================
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND p.email IS DISTINCT FROM u.email
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[email_sync] % profil(s) resynchronise(s) avec l''email de auth.users', v_updated;
  ELSE
    RAISE NOTICE '[email_sync] Tous les emails sont deja synchronises';
  END IF;
END $$;

-- ============================================
-- D. VERIFICATION
-- ============================================
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_desync_count INTEGER;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_email_changed'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) INTO v_trigger_exists;

  SELECT count(*) INTO v_desync_count
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.email IS DISTINCT FROM u.email
    AND u.email IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE '  VERIFICATION EMAIL SYNC TRIGGER';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  Trigger on_auth_user_email_changed : %',
    CASE WHEN v_trigger_exists THEN 'ACTIF' ELSE 'MANQUANT' END;
  RAISE NOTICE '  Emails desynchronises restants     : %', v_desync_count;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
