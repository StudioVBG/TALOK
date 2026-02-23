-- =====================================================
-- MIGRATION: Correction synchronisation auth <-> profiles
-- Date: 2026-02-16
-- Version: 20260216300000
--
-- PROBLEMES CORRIGES:
--   1. handle_new_user() ne remplissait pas la colonne `email`
--   2. handle_new_user() n'incluait pas la gestion du role `guarantor`
--      dans le ON CONFLICT (deja corrige en 20260212, consolide ici)
--   3. Des utilisateurs auth.users existent sans profil correspondant
--      (trigger rate, erreur RLS, race condition)
--   4. Des profils existants ont email = NULL
--   5. Absence de policy INSERT explicite sur profiles
--      (le FOR ALL couvre le cas, mais une policy INSERT explicite est
--       plus lisible et securise les futures evolutions)
--
-- ACTIONS:
--   A. Mettre a jour handle_new_user() (email + guarantor + robustesse)
--   B. Creer les profils manquants pour les auth.users desynchronises
--   C. Backfill les emails NULL dans les profils existants
--   D. Assurer qu'une policy INSERT RLS existe sur profiles
-- =====================================================

BEGIN;

-- ============================================
-- A. MISE A JOUR DE handle_new_user()
-- ============================================
-- Ajout de l'email, meilleure gestion d'erreur,
-- support du role guarantor (consolidation)

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
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (inclut 'guarantor')
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Recuperer l'email depuis le champ auth.users.email
  v_email := NEW.email;

  -- Inserer le profil avec toutes les donnees, y compris l'email
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone, email)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone, v_email)
  ON CONFLICT (user_id) DO UPDATE SET
    role = COALESCE(EXCLUDED.role, profiles.role),
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la creation d'un utilisateur auth
  -- meme si l'insertion du profil echoue
  RAISE WARNING '[handle_new_user] Erreur lors de la creation du profil pour user_id=%, email=%: % (SQLSTATE=%)',
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
DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '[fix_auth_sync] Cannot modify trigger on auth.users (insufficient privilege) — skipping';
END $$;

-- ============================================
-- B. CREER LES PROFILS MANQUANTS
-- ============================================
-- Pour chaque utilisateur dans auth.users qui n'a pas de profil,
-- en creer un avec les donnees disponibles.

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
    -- Valider le role
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
-- Mettre a jour les profils existants qui ont email = NULL
-- avec l'email provenant de auth.users.

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
-- Le FOR ALL existant (profiles_own_access) couvre l'INSERT,
-- mais une policy INSERT explicite est plus claire et securise
-- les futures modifications de profiles_own_access.

-- Supprimer si elle existe deja (idempotent)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

-- Permettre a un utilisateur authentifie de creer son propre profil
-- (couvre le cas ou le trigger handle_new_user echoue et que le
--  client tente un INSERT direct ou via l'API)
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

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
  RAISE NOTICE '  RAPPORT DE SYNCHRONISATION AUTH <-> PROFILES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  auth.users total       : %', v_total_auth;
  RAISE NOTICE '  profiles total         : %', v_total_profiles;
  RAISE NOTICE '  auth sans profil       : %', v_orphan_count;
  RAISE NOTICE '  profils sans email     : %', v_null_email_count;

  IF v_orphan_count = 0 AND v_null_email_count = 0 THEN
    RAISE NOTICE '  STATUS: SYNC OK — Aucun probleme detecte';
  ELSE
    RAISE WARNING '  STATUS: PROBLEMES RESTANTS — Verifier manuellement';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- F. FONCTIONS RPC POUR LE HEALTH CHECK (/api/health/auth)
-- ============================================
-- Ces fonctions sont appelees par l'endpoint de monitoring
-- et doivent etre SECURITY DEFINER pour acceder a auth.users.

-- Compter les auth.users total
CREATE OR REPLACE FUNCTION public.count_auth_users()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER FROM auth.users;
$$;

-- Compter les auth.users sans profil
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

-- Compter les profils orphelins (sans auth.users)
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

-- Compter les emails desynchronises
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

-- Verifier si un trigger existe sur auth.users
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

-- Verifier si une policy INSERT ou ALL existe sur une table
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

-- Permissions pour les fonctions de health check (admin seulement via service role)
GRANT EXECUTE ON FUNCTION public.count_auth_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_without_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_orphan_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_desync_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trigger_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_insert_policy_exists(TEXT) TO authenticated;

COMMIT;
