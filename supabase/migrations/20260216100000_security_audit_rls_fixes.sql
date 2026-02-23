-- =====================================================
-- MIGRATION: Correctifs sécurité P0 — Audit BIC2026
-- Date: 2026-02-16
--
-- PROBLÈMES CORRIGÉS:
-- 1. Table `leases`: suppression des policies USING(true) résiduelles
--    (créées par 20241130000004, normalement supprimées par 20251228230000
--     mais cette migration assure la sécurité même en cas de re-application)
-- 2. Table `notifications`: policy INSERT trop permissive (WITH CHECK(true))
-- 3. Table `document_ged_audit_log`: policy INSERT trop permissive
-- 4. Table `professional_orders`: policy SELECT trop permissive
-- =====================================================

BEGIN;

-- ============================================
-- 1. LEASES: Supprimer les policies permissives résiduelles
-- ============================================
-- Ces policies permettaient à tout utilisateur authentifié de lire/modifier tous les baux.
-- Les bonnes policies (leases_admin_all, leases_owner_all, leases_tenant_select)
-- ont été créées dans 20251228230000_definitive_rls_fix.sql

DROP POLICY IF EXISTS "authenticated_users_view_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_insert_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_update_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_delete_leases" ON leases;

-- Vérifier que les bonnes policies existent
DO $$
DECLARE
  policy_count INT;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'leases' AND schemaname = 'public';

  IF policy_count = 0 THEN
    RAISE EXCEPTION 'ERREUR CRITIQUE: Table leases n''a aucune policy RLS après nettoyage. '
                     'Les policies sécurisées de 20251228230000 doivent être présentes.';
  END IF;

  RAISE NOTICE 'leases: % policies RLS actives après nettoyage', policy_count;
END $$;

-- ============================================
-- 2. NOTIFICATIONS: Restreindre l'INSERT
-- ============================================
-- Avant: WITH CHECK(true) → tout authentifié peut insérer pour n'importe qui
-- Après: Seul le service_role ou l'utilisateur peut insérer ses propres notifs

DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;

-- Le service_role bypass RLS par défaut, donc cette policy est pour les
-- appels authentifiés qui insèrent des notifications pour eux-mêmes.
-- Les Edge Functions (service_role) ne sont pas affectées par cette restriction.
CREATE POLICY "notifications_insert_own_or_service" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    -- L'utilisateur ne peut insérer que des notifications qui le concernent
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- ============================================
-- 3. DOCUMENT_GED_AUDIT_LOG: Restreindre l'INSERT
-- ============================================
-- Avant: WITH CHECK(true) → tout authentifié peut insérer des logs d'audit
-- Après: Seuls les utilisateurs authentifiés peuvent insérer leurs propres logs

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'document_ged_audit_log' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert audit logs" ON document_ged_audit_log';

    -- Restreindre aux logs créés par l'utilisateur authentifié
    EXECUTE '
      CREATE POLICY "audit_log_insert_own" ON document_ged_audit_log
        FOR INSERT TO authenticated
        WITH CHECK (
          performed_by = auth.uid()
          OR performed_by IS NULL
        )
    ';

    RAISE NOTICE 'document_ged_audit_log: policy INSERT corrigée';
  ELSE
    RAISE NOTICE 'document_ged_audit_log: table non existante, skip';
  END IF;
END $$;

-- ============================================
-- 4. PROFESSIONAL_ORDERS: Restreindre le SELECT
-- ============================================
-- Avant: USING(TRUE) → tout authentifié voit toutes les commandes
-- Après: ownership check

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'professional_orders' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "professional_orders_select_policy" ON professional_orders';

    -- Les commandes sont visibles par le propriétaire du bail lié ou l'admin
    EXECUTE '
      CREATE POLICY "professional_orders_select_scoped" ON professional_orders
        FOR SELECT TO authenticated
        USING (
          public.user_role() = ''admin''
          OR EXISTS (
            SELECT 1 FROM leases l
            JOIN properties p ON p.id = l.property_id
            WHERE l.id = professional_orders.lease_id
            AND p.owner_id = public.get_my_profile_id()
          )
        )
    ';

    RAISE NOTICE 'professional_orders: policy SELECT corrigée';
  ELSE
    RAISE NOTICE 'professional_orders: table non existante, skip';
  END IF;
END $$;

-- ============================================
-- 5. VÉRIFICATION FINALE
-- ============================================
DO $$
DECLARE
  dangerous_count INT;
BEGIN
  -- Compter les policies qui ont encore USING(true) ou WITH CHECK(true)
  -- sur les tables critiques (hors reference tables et service_role policies)
  SELECT count(*) INTO dangerous_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('leases', 'profiles', 'properties', 'invoices', 'payments', 'documents', 'tickets')
    AND (qual = 'true' OR with_check = 'true')
    AND policyname NOT LIKE '%service%'
    AND policyname NOT LIKE '%admin%';

  IF dangerous_count > 0 THEN
    RAISE WARNING 'ATTENTION: % policies avec USING(true)/WITH CHECK(true) restantes sur les tables critiques', dangerous_count;
  ELSE
    RAISE NOTICE 'OK: Aucune policy USING(true) dangereuse sur les tables critiques';
  END IF;
END $$;

COMMIT;
