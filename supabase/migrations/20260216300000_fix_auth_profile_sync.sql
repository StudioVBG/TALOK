-- =====================================================
-- MIGRATION: Correction synchronisation auth <-> profiles
-- Date: 2026-02-16
-- Version: 20260216300000
--
-- PROBLEMES CORRIGES:
--   1. handle_new_user() ne remplissait pas la colonne email
--   2. handle_new_user() n'incluait pas la gestion du role guarantor
--   3. Des utilisateurs auth.users existent sans profil correspondant
--   4. Des profils existants ont email = NULL
--   5. Absence de policy INSERT explicite sur profiles
--
-- ACTIONS:
--   A. Mettre a jour handle_new_user() (email + guarantor + robustesse)
--   B. Creer les profils manquants pour les auth.users desynchronises
--   C. Backfill les emails NULL dans les profils existants
--   D. Assurer qu'une policy INSERT RLS existe sur profiles
--   E. Verification finale
--   F. Fonctions RPC pour le health check
-- =====================================================

BEGIN;

-- ============================================
-- A. MISE A JOUR DE handle_new_user()
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
  v_email TEXT;
BEGIN
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data ->> 'role',
    'tenant'
  );

  -- Valider le role (inclut 'guarantor')
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data ->> 'prenom';
  v_nom := NEW.raw_user_meta_data ->> 'nom';
  v_telephone := NEW.raw_user_meta_data ->> 'telephone';
  v_email := NEW.email;

  -- Inserer le profil avec toutes les donnees, y compris l'email
  INSERT INTO public.profiles (user_id, email, role, prenom, nom, telephone, created_at, updated_at)
  VALUES (NEW.id, v_email, v_role, v_prenom, v_nom, v_telephone, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    role = COALESCE(EXCLUDED.role, profiles.role),
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la creation d'un utilisateur auth
  -- meme si l'insertion du profil echoue
  RAISE WARNING '[handle_new_user] Erreur creation profil pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur auth.
Lit le role et les informations personnelles depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
Supporte les roles: admin, owner, tenant, provider, guarantor.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.
Ne bloque jamais la creation auth meme en cas d''erreur (EXCEPTION handler).';

-- S'assurer que le trigger existe (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- B. CREER LES PROFILS MANQUANTS
-- ============================================
DO $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT
      u.id,
      u.email,
      COALESCE(u.raw_user_meta_data->>'role', 'tenant') AS role,
      u.raw_user_meta_data->>'prenom' AS prenom,
      u.raw_user_meta_data->>'nom' AS nom,
      u.raw_user_meta_data->>'telephone' AS telephone
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.id IS NULL
  LOOP
    IF v_user.role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
      v_user.role := 'tenant';
    END IF;

    BEGIN
      INSERT INTO public.profiles (user_id, role, email, prenom, nom, telephone)
      VALUES (
        v_user.id,
        v_user.role,
        v_user.email,
        v_user.prenom,
        v_user.nom,
        v_user.telephone
      )
      ON CONFLICT (user_id) DO NOTHING;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[fix_auth_sync] Impossible de creer le profil pour user_id=%: %',
        v_user.id, SQLERRM;
    END;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE '[fix_auth_sync] % profil(s) manquant(s) cree(s)', v_count;
  ELSE
    RAISE NOTICE '[fix_auth_sync] Aucun profil manquant — tous les auth.users ont un profil';
  END IF;
END $$;

-- ============================================
-- C. BACKFILL DES EMAILS NULL
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
    AND (p.email IS NULL OR p.email = '')
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[fix_auth_sync] % profil(s) mis a jour avec l''email depuis auth.users', v_updated;
  ELSE
    RAISE NOTICE '[fix_auth_sync] Tous les profils ont deja un email renseigne';
  END IF;
END $$;

-- ============================================
-- D. POLICY INSERT EXPLICITE SUR PROFILES
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY "profiles_insert_own"
      ON profiles FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ============================================
-- E. VERIFICATION FINALE
-- ============================================
DO $$
DECLARE
  v_total_auth INTEGER;
  v_total_profiles INTEGER;
  v_orphan_count INTEGER;
  v_null_email_count INTEGER;
BEGIN
  SELECT count(*) INTO v_total_auth FROM auth.users;
  SELECT count(*) INTO v_total_profiles FROM public.profiles;

  SELECT count(*) INTO v_orphan_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.id IS NULL;

  SELECT count(*) INTO v_null_email_count
  FROM public.profiles
  WHERE email IS NULL OR email = '';

  RAISE NOTICE '========================================';
  RAISE NOTICE '  RAPPORT DE SYNCHRONISATION AUTH / PROFILES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  auth.users total       : %', v_total_auth;
  RAISE NOTICE '  profiles total         : %', v_total_profiles;
  RAISE NOTICE '  auth sans profil       : %', v_orphan_count;
  RAISE NOTICE '  profils sans email     : %', v_null_email_count;

  IF v_orphan_count = 0 AND v_null_email_count = 0 THEN
    RAISE NOTICE '  STATUS: SYNC OK';
  ELSE
    RAISE WARNING '  STATUS: PROBLEMES RESTANTS';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- F. FONCTIONS RPC POUR LE HEALTH CHECK (/api/health/auth)
-- ============================================

CREATE OR REPLACE FUNCTION public.count_auth_users()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER FROM auth.users;
$$;

CREATE OR REPLACE FUNCTION public.check_auth_without_profile()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.id IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.check_orphan_profiles()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE u.id IS NULL AND p.user_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.check_desync_emails()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.email IS DISTINCT FROM u.email
    AND p.email IS NOT NULL
    AND u.email IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.check_trigger_exists(p_trigger_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = p_trigger_name
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_insert_policy_exists(p_table_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = p_table_name
      AND schemaname = 'public'
      AND (cmd = 'INSERT' OR cmd = '*')
  );
$$;

GRANT EXECUTE ON FUNCTION public.count_auth_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_without_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_orphan_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_desync_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trigger_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_insert_policy_exists(TEXT) TO authenticated;

COMMIT;
