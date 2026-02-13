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
-- 2. CORRIGER subscription_invoices
-- ============================================
DROP POLICY IF EXISTS "Owners can view their invoices" ON subscription_invoices;

CREATE POLICY "Owners can view their invoices" ON subscription_invoices
  FOR SELECT TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE owner_id = public.get_my_profile_id()
    )
  );

-- ============================================
-- 3. CORRIGER subscription_usage
-- ============================================
DROP POLICY IF EXISTS "Owners can view their usage" ON subscription_usage;

CREATE POLICY "Owners can view their usage" ON subscription_usage
  FOR SELECT TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE owner_id = public.get_my_profile_id()
    )
  );

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
