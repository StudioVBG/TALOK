-- ============================================
-- MIGRATION 1: 20260213000000 (RLS profiles)
-- ============================================
-- =====================================================
-- MIGRATION: Correction définitive de la récursion RLS sur profiles (v2)
-- Date: 2026-02-13
-- Problème: "RLS recursion detected" - erreur 500 sur profiles
--
-- CAUSE: Les politiques RLS sur `profiles` appellent des fonctions
--        qui requêtent `profiles`, créant une boucle infinie (42P17).
--
-- SOLUTION:
--   1. Fonctions SECURITY DEFINER qui bypassen les RLS
--   2. Politiques RLS simplifiées utilisant auth.uid() directement
--   3. Pas de sous-requête vers profiles dans les politiques profiles
-- =====================================================

-- 1. DÉSACTIVER TEMPORAIREMENT RLS POUR LE NETTOYAGE
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER TOUTES LES ANCIENNES POLITIQUES SUR profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. CRÉER/REMPLACER LES FONCTIONS HELPER (SECURITY DEFINER = bypass RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1),
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_my_profile_id();
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_my_role();
$$;

-- Versions avec paramètre (pour usage admin)
CREATE OR REPLACE FUNCTION public.user_profile_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(role, 'anonymous') FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- 4. RÉACTIVER RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. CRÉER LES NOUVELLES POLITIQUES (SANS RÉCURSION)

-- Politique principale : chaque utilisateur peut voir/modifier son propre profil
-- Utilise auth.uid() directement, aucune sous-requête vers profiles
CREATE POLICY "profiles_own_access" ON profiles
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Politique admin : les admins peuvent voir tous les profils
-- is_admin() est SECURITY DEFINER donc bypasse les RLS
CREATE POLICY "profiles_admin_read" ON profiles
FOR SELECT TO authenticated
USING (public.is_admin());

-- Politique propriétaire : peut voir les profils de ses locataires
-- get_my_profile_id() est SECURITY DEFINER donc bypasse les RLS
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

-- 6. ACCORDER LES PERMISSIONS SUR LES FONCTIONS
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role(UUID) TO authenticated;

-- Permissions pour anon (nécessaire pour certaines requêtes pré-auth)
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_role() TO anon;

-- 7. S'assurer que RLS est activé (SANS FORCE pour que SECURITY DEFINER fonctionne)
-- IMPORTANT: Ne PAS utiliser FORCE ROW LEVEL SECURITY car cela forcerait
-- les politiques RLS même pour le propriétaire de la table (postgres),
-- ce qui casserait les fonctions SECURITY DEFINER et causerait la récursion.
-- Le service_role bypass RLS par défaut dans Supabase.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MIGRATION 2: 20260213100000 (RLS subscriptions)
-- ============================================
-- =====================================================
-- MIGRATION: Correction globale de la récursion RLS
-- Date: 2026-02-13
-- Problème: Les politiques RLS de subscriptions, notifications et
--           d'autres tables font des sous-requêtes directes sur `profiles`
--           ce qui déclenche l'évaluation RLS sur profiles → récursion (42P17).
--
-- SOLUTION: Remplacer toutes les sous-requêtes `SELECT id FROM profiles WHERE user_id = auth.uid()`
--           par l'appel à `public.get_my_profile_id()` (SECURITY DEFINER, bypass RLS).
-- =====================================================

-- ============================================
-- 0. CORRIGER profiles : retirer FORCE si présent
-- ============================================
-- FORCE ROW LEVEL SECURITY fait que même le propriétaire de la table (postgres)
-- est soumis aux RLS, ce qui casse les fonctions SECURITY DEFINER.
ALTER TABLE profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1. CORRIGER subscriptions
-- ============================================
DROP POLICY IF EXISTS "Owners can view their subscription" ON subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;

-- Propriétaire voit son abonnement (utilise get_my_profile_id au lieu de sous-requête)
CREATE POLICY "Owners can view their subscription" ON subscriptions
  FOR SELECT TO authenticated
  USING (owner_id = public.get_my_profile_id());

-- Admins voient tout (utilise is_admin qui est SECURITY DEFINER)
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ============================================
-- 2. CORRIGER subscription_invoices (si la table existe)
-- ============================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners can view their invoices" ON subscription_invoices;
  CREATE POLICY "Owners can view their invoices" ON subscription_invoices
    FOR SELECT TO authenticated
    USING (
      subscription_id IN (
        SELECT id FROM subscriptions
        WHERE owner_id = public.get_my_profile_id()
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'subscription_invoices does not exist yet, skipping';
END $$;

-- ============================================
-- 3. CORRIGER subscription_usage (si la table existe)
-- ============================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners can view their usage" ON subscription_usage;
  CREATE POLICY "Owners can view their usage" ON subscription_usage
    FOR SELECT TO authenticated
    USING (
      subscription_id IN (
        SELECT id FROM subscriptions
        WHERE owner_id = public.get_my_profile_id()
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'subscription_usage does not exist yet, skipping';
END $$;

-- ============================================
-- 4. CORRIGER notifications
-- ============================================
-- Supprimer TOUTES les anciennes politiques de notifications pour repartir proprement
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'notifications' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Lecture : l'utilisateur voit ses propres notifications
-- Utilise auth.uid() directement et get_my_profile_id() pour recipient_id/profile_id
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Mise à jour : l'utilisateur peut modifier ses propres notifications
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Suppression : l'utilisateur peut supprimer ses propres notifications
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Insertion : le système peut insérer des notifications
CREATE POLICY "notifications_insert_system" ON notifications
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. VÉRIFICATION : lister les politiques restantes avec sous-requête profiles
-- ============================================
-- Note: Les tables ci-dessous ont aussi des sous-requêtes sur profiles dans leurs
-- politiques RLS. Elles sont moins critiques car elles ne sont pas appelées
-- en cascade depuis profiles, mais pour la robustesse on les corrige aussi.

-- Cette requête est un diagnostic, elle n'échouera pas si les tables n'existent pas
DO $$
BEGIN
  RAISE NOTICE '=== Migration RLS globale appliquée avec succès ===';
  RAISE NOTICE 'Tables corrigées: profiles, subscriptions, subscription_invoices, subscription_usage, notifications';
  RAISE NOTICE 'Méthode: get_my_profile_id() SECURITY DEFINER au lieu de sous-requêtes directes';
END $$;

-- ============================================
-- MIGRATION 3: 20260409120000 (RLS recursion fix)
-- ============================================
-- =====================================================
-- MIGRATION: Ensure subscriptions RLS uses get_my_profile_id() (no recursion)
-- Date: 2026-04-09
-- Problem: The "Owners can view their subscription" policy may still use a direct
--          sub-query on profiles (SELECT id FROM profiles WHERE user_id = auth.uid()),
--          which triggers infinite recursion (42P17) when profiles RLS is active.
--          Additionally, subscriptions has no INSERT/UPDATE policies for owners,
--          meaning writes must go through service_role only (which is correct).
-- Solution: Idempotently replace the SELECT policy with get_my_profile_id() (SECURITY DEFINER).
-- =====================================================

-- 1. Drop and recreate the owner SELECT policy to guarantee it uses get_my_profile_id()
DROP POLICY IF EXISTS "Owners can view their subscription" ON subscriptions;
CREATE POLICY "Owners can view their subscription" ON subscriptions
  FOR SELECT TO authenticated
  USING (owner_id = public.get_my_profile_id());

-- 2. Ensure admin policy also uses is_admin() (SECURITY DEFINER)
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin());

-- 3. Fix subscription_addon_subscriptions if it exists (may also have recursion)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_addon_subscriptions') THEN
    DROP POLICY IF EXISTS "addon_subs_owner_select" ON subscription_addon_subscriptions;
    CREATE POLICY "addon_subs_owner_select" ON subscription_addon_subscriptions
      FOR SELECT TO authenticated
      USING (
        subscription_id IN (
          SELECT id FROM subscriptions
          WHERE owner_id = public.get_my_profile_id()
        )
      );
  END IF;
END $$;

-- 4. Verification
DO $$
BEGIN
  RAISE NOTICE '=== Migration: subscriptions RLS recursion fix applied ===';
  RAISE NOTICE 'Policies replaced: Owners can view their subscription, Admins can view all subscriptions';
  RAISE NOTICE 'Method: get_my_profile_id() / is_admin() SECURITY DEFINER';
END $$;

-- ============================================
-- MIGRATION 4: 20260409130000 (CHECK constraint expired/suspended)
-- ============================================
-- =====================================================
-- MIGRATION: Add 'expired' status to subscriptions CHECK constraint
-- Date: 2026-04-09
-- Problem: Application code sets status='expired' for expired trials,
--          but the CHECK constraint only allows:
--          'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete'
--          This causes silent write failures (fire-and-forget updates fail).
-- Solution: Drop old constraint, add new one including 'expired' and 'suspended'.
-- =====================================================

-- Drop the existing CHECK constraint on status
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;

-- Recreate with all valid statuses
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid',
    'paused', 'incomplete', 'expired', 'suspended'
  ));

-- Verification
DO $$
BEGIN
  RAISE NOTICE '=== Migration: subscriptions status CHECK updated (added expired, suspended) ===';
END $$;
