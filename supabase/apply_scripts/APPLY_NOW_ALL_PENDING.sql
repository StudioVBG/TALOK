-- =====================================================
-- SCRIPT UNIQUE D'APPLICATION — Toutes les migrations en attente
-- Date: 2026-02-16
-- 
-- INSTRUCTIONS:
-- 1. Ouvrir Supabase Dashboard → SQL Editor
-- 2. Créer un "New Query"
-- 3. Coller CE FICHIER ENTIER
-- 4. Cliquer "Run"
-- 5. Vérifier les NOTICES dans l'onglet "Messages" en bas
--
-- CONTENU (4 migrations):
-- A. Sécurité RLS (20260216100000)
-- B. Auto-link lease_signers trigger (20260216200000)
-- C. Fix synchronisation auth ↔ profiles (20260216300000)
-- D. Index de performance RLS (20260216400000)
-- =====================================================


-- ======================================================
-- A. SÉCURITÉ RLS — Correctifs P0 Audit BIC2026
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
  FROM pg_policies WHERE tablename = 'leases' AND schemaname = 'public';
  IF policy_count = 0 THEN
    RAISE EXCEPTION 'ERREUR CRITIQUE: Table leases sans policy RLS après nettoyage.';
  END IF;
  RAISE NOTICE '[A.1] leases: % policies RLS actives', policy_count;
END $$;

-- 2. NOTIFICATIONS: Restreindre l'INSERT
DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_own_or_service" ON notifications;

CREATE POLICY "notifications_insert_own_or_service" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- 3. DOCUMENT_GED_AUDIT_LOG
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'document_ged_audit_log' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert audit logs" ON document_ged_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "audit_log_insert_own" ON document_ged_audit_log';
    EXECUTE '
      CREATE POLICY "audit_log_insert_own" ON document_ged_audit_log
        FOR INSERT TO authenticated
        WITH CHECK (actor_id = public.get_my_profile_id() OR actor_id IS NULL)
    ';
    RAISE NOTICE '[A.3] document_ged_audit_log: policy INSERT corrigée';
  END IF;
END $$;

-- 4. PROFESSIONAL_ORDERS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'professional_orders' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "professional_orders_select_policy" ON professional_orders';
    EXECUTE 'DROP POLICY IF EXISTS "professional_orders_select_scoped" ON professional_orders';
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
    RAISE NOTICE '[A.4] professional_orders: policy SELECT corrigée';
  END IF;
END $$;

RAISE NOTICE '[A] ✅ Sécurité RLS terminée';

COMMIT;


-- ======================================================
-- B. AUTO-LINK LEASE_SIGNERS — Trigger + Fix rétroactif
-- ======================================================

BEGIN;

-- 1. Fonction trigger: auto-link lease_signers à la création d'un profil
CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
  IF user_email IS NULL OR user_email = '' THEN RETURN NEW; END IF;

  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email) AND profile_id IS NULL;
  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil %', linked_count, NEW.id;
  END IF;

  UPDATE public.invitations
  SET used_by = NEW.id, used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email) AND used_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger
DROP TRIGGER IF EXISTS trigger_auto_link_lease_signers ON public.profiles;
CREATE TRIGGER trigger_auto_link_lease_signers
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_created();

RAISE NOTICE '[B] ✅ Trigger auto_link_lease_signers créé';

COMMIT;


-- ======================================================
-- C. FIX SYNCHRONISATION AUTH ↔ PROFILES
-- ======================================================

BEGIN;

-- 1. Mise à jour handle_new_user() (email + guarantor + robustesse)
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
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'tenant');
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
    v_role := 'tenant';
  END IF;
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';
  v_email := NEW.email;

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
  RAISE WARNING '[handle_new_user] Erreur pour user_id=%, email=%: %',
    NEW.id, NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. S'assurer que le trigger auth existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Créer les profils manquants pour TOUS les auth.users
DO $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT u.id, u.email,
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
      VALUES (v_user.id, v_user.role, v_user.email, v_user.prenom, v_user.nom, v_user.telephone)
      ON CONFLICT (user_id) DO NOTHING;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[fix_sync] Erreur profil user_id=%: %', v_user.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE '[C.3] % profil(s) manquant(s) créé(s)', v_count;
END $$;

-- 4. Backfill les emails NULL
DO $$
DECLARE v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET email = u.email, updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND (p.email IS NULL OR p.email = '')
    AND u.email IS NOT NULL AND u.email != '';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '[C.4] % profil(s) mis à jour avec email', v_updated;
END $$;

-- 5. Policy INSERT explicite sur profiles
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 6. Lier rétroactivement TOUS les lease_signers orphelins
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
    WHERE LOWER(invited_email) = LOWER(rec.user_email) AND profile_id IS NULL;
    linked_total := linked_total + 1;
  END LOOP;
  RAISE NOTICE '[C.6] % profils avec lease_signers orphelins liés', linked_total;
END $$;

-- 7. Fonctions RPC pour health check
CREATE OR REPLACE FUNCTION public.count_auth_users()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT count(*)::INTEGER FROM auth.users; $$;

CREATE OR REPLACE FUNCTION public.check_auth_without_profile()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT count(*)::INTEGER FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id WHERE p.id IS NULL; $$;

CREATE OR REPLACE FUNCTION public.check_orphan_profiles()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT count(*)::INTEGER FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.user_id WHERE u.id IS NULL AND p.user_id IS NOT NULL; $$;

CREATE OR REPLACE FUNCTION public.check_desync_emails()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT count(*)::INTEGER FROM public.profiles p INNER JOIN auth.users u ON u.id = p.user_id WHERE p.email IS DISTINCT FROM u.email AND p.email IS NOT NULL AND u.email IS NOT NULL; $$;

CREATE OR REPLACE FUNCTION public.check_trigger_exists(p_trigger_name TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE t.tgname = p_trigger_name AND n.nspname = 'auth' AND c.relname = 'users'); $$;

CREATE OR REPLACE FUNCTION public.check_insert_policy_exists(p_table_name TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM pg_policies WHERE tablename = p_table_name AND schemaname = 'public' AND (cmd = 'INSERT' OR cmd = '*')); $$;

GRANT EXECUTE ON FUNCTION public.count_auth_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_without_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_orphan_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_desync_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trigger_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_insert_policy_exists(TEXT) TO authenticated;

COMMIT;


-- ======================================================
-- VÉRIFICATION FINALE
-- ======================================================
DO $$
DECLARE
  v_total_auth INT;
  v_total_profiles INT;
  v_orphan_auth INT;
  v_orphan_signers INT;
  v_null_emails INT;
BEGIN
  SELECT count(*) INTO v_total_auth FROM auth.users;
  SELECT count(*) INTO v_total_profiles FROM public.profiles;
  SELECT count(*) INTO v_orphan_auth FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id WHERE p.id IS NULL;
  SELECT count(*) INTO v_orphan_signers FROM public.lease_signers WHERE profile_id IS NULL AND invited_email IS NOT NULL;
  SELECT count(*) INTO v_null_emails FROM public.profiles WHERE email IS NULL OR email = '';

  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '  RAPPORT FINAL — TOUTES MIGRATIONS APPLIQUÉES';
  RAISE NOTICE '================================================';
  RAISE NOTICE '  auth.users total          : %', v_total_auth;
  RAISE NOTICE '  profiles total            : %', v_total_profiles;
  RAISE NOTICE '  auth sans profil          : %', v_orphan_auth;
  RAISE NOTICE '  lease_signers orphelins   : %', v_orphan_signers;
  RAISE NOTICE '  profils sans email        : %', v_null_emails;
  RAISE NOTICE '';
  IF v_orphan_auth = 0 AND v_null_emails = 0 THEN
    RAISE NOTICE '  ✅ STATUS: TOUT EST SYNCHRONISÉ';
  ELSE
    RAISE WARNING '  ⚠️  STATUS: Des problèmes restent — vérifier manuellement';
  END IF;
  RAISE NOTICE '================================================';
END $$;


-- ======================================================
-- D. INDEX DE PERFORMANCE POUR LES POLICIES RLS
-- (20260216400000_performance_indexes_rls.sql)
-- ======================================================

BEGIN;

-- lease_signers: index pour lookup par profile_id, email, composite
CREATE INDEX IF NOT EXISTS idx_lease_signers_profile_id
  ON public.lease_signers (profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email_lower
  ON public.lease_signers (LOWER(invited_email)) WHERE invited_email IS NOT NULL AND profile_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_lease_signers_lease_profile
  ON public.lease_signers (lease_id, profile_id) WHERE profile_id IS NOT NULL;

-- documents: index colonnes RLS
CREATE INDEX IF NOT EXISTS idx_documents_property_id ON public.documents (property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_lease_id ON public.documents (lease_id) WHERE lease_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON public.documents (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON public.documents (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON public.documents (storage_path) WHERE storage_path IS NOT NULL;

-- leases, properties, invoices, tickets: index FK
CREATE INDEX IF NOT EXISTS idx_leases_property_id ON public.leases (property_id);
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON public.properties (owner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_owner_id ON public.invoices (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON public.invoices (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_lease_id ON public.invoices (lease_id);
CREATE INDEX IF NOT EXISTS idx_tickets_property_id ON public.tickets (property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON public.tickets (created_by_profile_id) WHERE created_by_profile_id IS NOT NULL;

-- profiles: index user_id
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

DO $$
DECLARE idx_count INT;
BEGIN
  SELECT count(*) INTO idx_count FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
  RAISE NOTICE '✅ % index de performance créés/vérifiés', idx_count;
END $$;

COMMIT;
