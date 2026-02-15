-- =====================================================
-- BATCH PENDING 04: Sécurité RLS + Auto-link lease_signers
-- Date: 2026-02-16
-- 
-- Contient:
-- 1. 20260216100000_security_audit_rls_fixes.sql
--    - Suppression policies USING(true) sur leases
--    - Restriction INSERT notifications
--    - Restriction INSERT document_ged_audit_log  
--    - Restriction SELECT professional_orders
--
-- 2. 20260216200000_auto_link_lease_signers_trigger.sql
--    - Trigger auto-link lease_signers à la création de profil
--    - Fix profil manquant user 6337af52-...
--    - Fix rétroactif lease_signers orphelins
--
-- INSTRUCTIONS:
-- 1. Ouvrir Supabase Dashboard → SQL Editor
-- 2. Coller ce fichier entier
-- 3. Cliquer "Run"
-- =====================================================


-- ======================================================
-- PARTIE 1: Correctifs sécurité P0 — Audit BIC2026
-- ======================================================

BEGIN;

-- 1. LEASES: Supprimer les policies permissives résiduelles
DROP POLICY IF EXISTS "authenticated_users_view_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_insert_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_update_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_delete_leases" ON leases;

DO $$
DECLARE
  policy_count INT;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'leases' AND schemaname = 'public';

  IF policy_count = 0 THEN
    RAISE EXCEPTION 'ERREUR CRITIQUE: Table leases n''a aucune policy RLS après nettoyage.';
  END IF;
  RAISE NOTICE 'leases: % policies RLS actives après nettoyage', policy_count;
END $$;

-- 2. NOTIFICATIONS: Restreindre l'INSERT
DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;

CREATE POLICY "notifications_insert_own_or_service" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- 3. DOCUMENT_GED_AUDIT_LOG: Restreindre l'INSERT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'document_ged_audit_log' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert audit logs" ON document_ged_audit_log';
    EXECUTE '
      CREATE POLICY "audit_log_insert_own" ON document_ged_audit_log
        FOR INSERT TO authenticated
        WITH CHECK (
          actor_id = public.get_my_profile_id()
          OR actor_id IS NULL
        )
    ';
    RAISE NOTICE 'document_ged_audit_log: policy INSERT corrigée';
  ELSE
    RAISE NOTICE 'document_ged_audit_log: table non existante, skip';
  END IF;
END $$;

-- 4. PROFESSIONAL_ORDERS: Restreindre le SELECT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'professional_orders' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "professional_orders_select_policy" ON professional_orders';
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

-- 5. Vérification finale sécurité
DO $$
DECLARE
  dangerous_count INT;
BEGIN
  SELECT count(*) INTO dangerous_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('leases', 'profiles', 'properties', 'invoices', 'payments', 'documents', 'tickets')
    AND (qual = 'true' OR with_check = 'true')
    AND policyname NOT LIKE '%service%'
    AND policyname NOT LIKE '%admin%';

  IF dangerous_count > 0 THEN
    RAISE WARNING 'ATTENTION: % policies avec USING(true)/WITH CHECK(true) restantes', dangerous_count;
  ELSE
    RAISE NOTICE 'OK: Aucune policy USING(true) dangereuse sur les tables critiques';
  END IF;
END $$;

COMMIT;


-- ======================================================
-- PARTIE 2: Auto-link lease_signers + fix profil orphelin
-- ======================================================

BEGIN;

-- 1. FONCTION: Auto-link lease_signers au moment de la création d'un profil
CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)', 
      linked_count, NEW.id, user_email;
  END IF;

  UPDATE public.invitations
  SET used_by = NEW.id, used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER
DROP TRIGGER IF EXISTS trigger_auto_link_lease_signers ON public.profiles;

CREATE TRIGGER trigger_auto_link_lease_signers
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_created();

-- 3. FIX: Créer le profil manquant pour user 6337af52-...
DO $$
DECLARE
  target_user_id UUID := '6337af52-2fb7-41d7-b620-d9ddd689d294';
  user_email TEXT;
  user_role TEXT;
  new_profile_id UUID;
BEGIN
  SELECT email, COALESCE(raw_user_meta_data->>'role', 'tenant')
  INTO user_email, user_role
  FROM auth.users
  WHERE id = target_user_id;

  IF user_email IS NULL THEN
    RAISE NOTICE 'User % non trouvé dans auth.users — skip', target_user_id;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id) THEN
    RAISE NOTICE 'Profil déjà existant pour user % — skip', target_user_id;
    RETURN;
  END IF;

  INSERT INTO public.profiles (user_id, role, email)
  VALUES (target_user_id, user_role, user_email)
  RETURNING id INTO new_profile_id;

  RAISE NOTICE 'Profil créé: id=%, user_id=%, email=%, role=%', 
    new_profile_id, target_user_id, user_email, user_role;
END $$;

-- 4. FIX RÉTROACTIF: Lier tous les lease_signers orphelins existants
DO $$
DECLARE
  linked_total INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.id AS profile_id, u.email AS user_email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE u.email IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.lease_signers ls
        WHERE LOWER(ls.invited_email) = LOWER(u.email)
          AND ls.profile_id IS NULL
      )
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE LOWER(invited_email) = LOWER(rec.user_email)
      AND profile_id IS NULL;

    linked_total := linked_total + 1;
  END LOOP;

  IF linked_total > 0 THEN
    RAISE NOTICE '[rétro-link] % profils avec des lease_signers orphelins ont été liés', linked_total;
  ELSE
    RAISE NOTICE '[rétro-link] Aucun lease_signer orphelin trouvé — tout est déjà lié';
  END IF;
END $$;

-- 5. VÉRIFICATION
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING '⚠️  % lease_signers orphelins restants (email sans compte)', orphan_count;
  ELSE
    RAISE NOTICE '✅ Aucun lease_signer orphelin — tous les comptes sont liés';
  END IF;
END $$;

COMMIT;

-- =====================================================
-- FIN DU BATCH — Résumé des actions:
-- ✅ 4 policies RLS corrigées (leases, notifications, audit_log, professional_orders)
-- ✅ Trigger auto_link_lease_signers créé (profils futurs)
-- ✅ Profil manquant user 6337af52-... créé (si le user existe)
-- ✅ Tous les lease_signers orphelins rétro-liés
-- =====================================================
