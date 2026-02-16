-- =====================================================
-- FIX CRITIQUE: Policies RLS sur la table "profiles"
-- Date: 2026-02-16
-- 
-- PROBLÈME: Les utilisateurs ne peuvent pas lire leur 
-- propre profil via le client browser Supabase.
-- Le warning "[Auth] Profile not found via direct query"
-- apparaît car la policy SELECT est manquante.
--
-- CE SCRIPT:
-- 1. Supprime TOUTES les policies existantes sur profiles
-- 2. Recrée les 4 policies correctes
-- 3. Recrée les fonctions helper SECURITY DEFINER
-- 4. S'assure que NO FORCE ROW LEVEL SECURITY est actif
--
-- INSTRUCTIONS:
-- 1. Ouvrir Supabase Dashboard → SQL Editor
-- 2. Créer un "New Query"
-- 3. Coller CE FICHIER ENTIER
-- 4. Cliquer "Run"
-- 5. Vérifier les NOTICES dans l'onglet "Messages"
-- 6. Tester en se connectant sur l'app
-- =====================================================

BEGIN;

-- ══════════════════════════════════════════════════════
-- ÉTAPE 1: Diagnostic avant correction
-- ══════════════════════════════════════════════════════
DO $$
DECLARE
  policy_count INT;
  has_own_access BOOLEAN;
  has_force BOOLEAN;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public';

  SELECT EXISTS(
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND schemaname = 'public' 
    AND policyname = 'profiles_own_access'
  ) INTO has_own_access;

  SELECT relforcerowsecurity INTO has_force
  FROM pg_class WHERE relname = 'profiles';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '  DIAGNOSTIC AVANT CORRECTION';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '  Policies actuelles sur profiles : %', policy_count;
  RAISE NOTICE '  profiles_own_access existe      : %', has_own_access;
  RAISE NOTICE '  FORCE ROW LEVEL SECURITY        : %', has_force;
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ══════════════════════════════════════════════════════
-- ÉTAPE 2: Nettoyage complet des policies existantes
-- ══════════════════════════════════════════════════════
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
  dropped INT := 0;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
    dropped := dropped + 1;
  END LOOP;
  RAISE NOTICE '[ÉTAPE 2] % policy(ies) supprimée(s) sur profiles', dropped;
END $$;

-- ══════════════════════════════════════════════════════
-- ÉTAPE 3: Fonctions helper SECURITY DEFINER
-- (Ces fonctions bypass RLS car elles s'exécutent avec
-- les privilèges du propriétaire de la table, pas de
-- l'utilisateur courant. Cela évite la récursion.)
-- ══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'admin' 
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1),
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT public.get_my_profile_id();
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT public.get_my_role();
$$;

CREATE OR REPLACE FUNCTION public.user_profile_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COALESCE(role, 'anonymous') FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

DO $$ BEGIN RAISE NOTICE '[ÉTAPE 3] Fonctions helper créées/mises à jour'; END $$;

-- ══════════════════════════════════════════════════════
-- ÉTAPE 4: Réactiver RLS (sans FORCE)
-- ══════════════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles NO FORCE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════
-- ÉTAPE 5: Créer les 4 policies RLS
-- ══════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────┐
-- │ POLICY 1: profiles_own_access (LA PLUS IMPORTANTE) │
-- │ Chaque utilisateur peut LIRE et MODIFIER son profil │
-- │ Condition: user_id = auth.uid()                     │
-- │ Pas de sous-requête → Pas de récursion              │
-- └─────────────────────────────────────────────────────┘
CREATE POLICY "profiles_own_access" ON profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ┌─────────────────────────────────────────────────────┐
-- │ POLICY 2: profiles_admin_read                       │
-- │ Les admins peuvent LIRE tous les profils            │
-- │ is_admin() est SECURITY DEFINER → bypass RLS        │
-- └─────────────────────────────────────────────────────┘
CREATE POLICY "profiles_admin_read" ON profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ┌─────────────────────────────────────────────────────┐
-- │ POLICY 3: profiles_owner_read_tenants               │
-- │ Les propriétaires peuvent LIRE les profils de leurs │
-- │ locataires (via lease_signers)                      │
-- └─────────────────────────────────────────────────────┘
CREATE POLICY "profiles_owner_read_tenants" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM lease_signers ls
      INNER JOIN leases l ON l.id = ls.lease_id
      INNER JOIN properties p ON p.id = l.property_id
      WHERE ls.profile_id = profiles.id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

-- ┌─────────────────────────────────────────────────────┐
-- │ POLICY 4: profiles_insert_own                       │
-- │ Un utilisateur peut créer son propre profil         │
-- │ (nécessaire pour le trigger handle_new_user)        │
-- └─────────────────────────────────────────────────────┘
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ══════════════════════════════════════════════════════
-- ÉTAPE 6: Permissions (GRANT)
-- ══════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_role() TO anon;

-- ══════════════════════════════════════════════════════
-- ÉTAPE 7: Vérification finale
-- ══════════════════════════════════════════════════════
DO $$
DECLARE
  policy_count INT;
  has_own BOOLEAN;
  has_admin BOOLEAN;
  has_owner BOOLEAN;
  has_insert BOOLEAN;
  has_force BOOLEAN;
  total_profiles INT;
  total_auth INT;
  orphan_count INT;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public';

  SELECT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_own_access') INTO has_own;
  SELECT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_admin_read') INTO has_admin;
  SELECT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_owner_read_tenants') INTO has_owner;
  SELECT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_insert_own') INTO has_insert;

  SELECT relforcerowsecurity INTO has_force FROM pg_class WHERE relname = 'profiles';

  SELECT count(*) INTO total_profiles FROM public.profiles;
  SELECT count(*) INTO total_auth FROM auth.users;
  SELECT count(*) INTO orphan_count 
  FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id WHERE p.id IS NULL;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '  ✅ VÉRIFICATION FINALE — PROFILES RLS FIX';
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '  Policies total                  : %', policy_count;
  RAISE NOTICE '  profiles_own_access (CRITIQUE)  : %', has_own;
  RAISE NOTICE '  profiles_admin_read             : %', has_admin;
  RAISE NOTICE '  profiles_owner_read_tenants     : %', has_owner;
  RAISE NOTICE '  profiles_insert_own             : %', has_insert;
  RAISE NOTICE '  FORCE ROW LEVEL SECURITY        : %', has_force;
  RAISE NOTICE '  ────────────────────────────────────────────';
  RAISE NOTICE '  auth.users total                : %', total_auth;
  RAISE NOTICE '  profiles total                  : %', total_profiles;
  RAISE NOTICE '  auth.users sans profil          : %', orphan_count;
  RAISE NOTICE '════════════════════════════════════════════════';
  
  IF has_own AND NOT has_force AND orphan_count = 0 THEN
    RAISE NOTICE '  🎉 STATUS: TOUT EST OK — Le bug sera résolu';
  ELSIF NOT has_own THEN
    RAISE WARNING '  ❌ ERREUR: profiles_own_access manquant !';
  ELSIF has_force THEN
    RAISE WARNING '  ❌ ERREUR: FORCE ROW LEVEL SECURITY est actif !';
  ELSIF orphan_count > 0 THEN
    RAISE WARNING '  ⚠️  % auth.users sans profil', orphan_count;
  END IF;
  RAISE NOTICE '════════════════════════════════════════════════';
END $$;

COMMIT;
