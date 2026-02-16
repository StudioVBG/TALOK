-- =====================================================
-- SCRIPT DE VALIDATION: Synchronisation auth <-> profiles
-- Date: 2026-02-16
--
-- USAGE: Executer dans le SQL Editor de Supabase
--        apres avoir applique la migration 20260216300000
--
-- Ce script produit un rapport de sante complet
-- sans modifier aucune donnee (lecture seule).
-- =====================================================

-- ============================================
-- 1. VUE D'ENSEMBLE
-- ============================================
DO $$
DECLARE
  v_total_auth INTEGER;
  v_total_profiles INTEGER;
  v_confirmed_auth INTEGER;
BEGIN
  SELECT count(*) INTO v_total_auth FROM auth.users;
  SELECT count(*) INTO v_total_profiles FROM public.profiles;
  SELECT count(*) INTO v_confirmed_auth
  FROM auth.users WHERE email_confirmed_at IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '   RAPPORT DE SANTE — SYNC AUTH <-> PROFILES';
  RAISE NOTICE '   Date: %', to_char(NOW(), 'YYYY-MM-DD HH24:MI');
  RAISE NOTICE '==================================================';
  RAISE NOTICE '  auth.users total          : %', lpad(v_total_auth::TEXT, 6);
  RAISE NOTICE '  auth.users confirmes      : %', lpad(v_confirmed_auth::TEXT, 6);
  RAISE NOTICE '  profiles total            : %', lpad(v_total_profiles::TEXT, 6);
  RAISE NOTICE '==================================================';
END $$;

-- ============================================
-- 2. AUTH.USERS SANS PROFIL (orphelins)
-- ============================================
DO $$
DECLARE
  v_count INTEGER;
  v_user RECORD;
BEGIN
  SELECT count(*) INTO v_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.id IS NULL;

  RAISE NOTICE '';
  RAISE NOTICE '-- CHECK 1: Auth.users sans profil --';

  IF v_count = 0 THEN
    RAISE NOTICE '   PASS — Tous les auth.users ont un profil correspondant';
  ELSE
    RAISE WARNING '   FAIL — % auth.users sans profil:', v_count;

    FOR v_user IN
      SELECT u.id, u.email, u.created_at,
             u.raw_user_meta_data->>'role' AS meta_role
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.user_id = u.id
      WHERE p.id IS NULL
      ORDER BY u.created_at DESC
      LIMIT 20
    LOOP
      RAISE WARNING '      - user_id=% email=% created=% meta_role=%',
        v_user.id, v_user.email, v_user.created_at::DATE, COALESCE(v_user.meta_role, 'N/A');
    END LOOP;

    IF v_count > 20 THEN
      RAISE WARNING '      ... et % de plus', v_count - 20;
    END IF;
  END IF;
END $$;

-- ============================================
-- 3. PROFILS SANS EMAIL
-- ============================================
DO $$
DECLARE
  v_count INTEGER;
  v_rec RECORD;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.profiles
  WHERE email IS NULL OR email = '';

  RAISE NOTICE '';
  RAISE NOTICE '-- CHECK 2: Profils sans email --';

  IF v_count = 0 THEN
    RAISE NOTICE '   PASS — Tous les profils ont un email renseigne';
  ELSE
    RAISE WARNING '   FAIL — % profils sans email:', v_count;

    FOR v_rec IN
      SELECT p.id, p.user_id, p.role, p.prenom, p.nom, u.email AS auth_email
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.user_id
      WHERE p.email IS NULL OR p.email = ''
      ORDER BY p.created_at DESC
      LIMIT 20
    LOOP
      RAISE WARNING '      - profile_id=% role=% nom=% auth_email=%',
        v_rec.id, v_rec.role, COALESCE(v_rec.nom, 'N/A'), COALESCE(v_rec.auth_email, 'N/A');
    END LOOP;
  END IF;
END $$;

-- ============================================
-- 4. PROFILS ORPHELINS (sans auth.users)
-- ============================================
DO $$
DECLARE
  v_count INTEGER;
  v_rec RECORD;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE u.id IS NULL
    AND p.user_id IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '-- CHECK 3: Profils orphelins (sans auth.users) --';

  IF v_count = 0 THEN
    RAISE NOTICE '   PASS — Tous les profils ont un auth.users correspondant';
  ELSE
    RAISE WARNING '   WARN — % profils sans auth.users correspondant:', v_count;

    FOR v_rec IN
      SELECT p.id, p.user_id, p.role, p.email, p.created_at
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.user_id
      WHERE u.id IS NULL AND p.user_id IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 10
    LOOP
      RAISE WARNING '      - profile_id=% user_id=% role=% email=%',
        v_rec.id, v_rec.user_id, v_rec.role, COALESCE(v_rec.email, 'N/A');
    END LOOP;
  END IF;
END $$;

-- ============================================
-- 5. EMAILS DESYNCHRONISES (profil != auth)
-- ============================================
DO $$
DECLARE
  v_count INTEGER;
  v_rec RECORD;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.email IS DISTINCT FROM u.email
    AND p.email IS NOT NULL
    AND u.email IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '-- CHECK 4: Emails desynchronises (profil != auth) --';

  IF v_count = 0 THEN
    RAISE NOTICE '   PASS — Tous les emails sont synchronises';
  ELSE
    RAISE WARNING '   WARN — % profils avec email different de auth.users:', v_count;

    FOR v_rec IN
      SELECT p.id, p.email AS profile_email, u.email AS auth_email, p.role
      FROM public.profiles p
      INNER JOIN auth.users u ON u.id = p.user_id
      WHERE p.email IS DISTINCT FROM u.email
        AND p.email IS NOT NULL
        AND u.email IS NOT NULL
      LIMIT 10
    LOOP
      RAISE WARNING '      - profile_id=% role=% profil_email=% auth_email=%',
        v_rec.id, v_rec.role, v_rec.profile_email, v_rec.auth_email;
    END LOOP;
  END IF;
END $$;

-- ============================================
-- 6. VERIFICATION DU TRIGGER handle_new_user
-- ============================================
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_func_source TEXT;
  v_has_email BOOLEAN;
  v_has_guarantor BOOLEAN;
  v_has_exception BOOLEAN;
BEGIN
  -- Verifier que le trigger existe
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) INTO v_trigger_exists;

  -- Recuperer le code source de la fonction
  SELECT prosrc INTO v_func_source
  FROM pg_proc
  WHERE proname = 'handle_new_user'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  v_has_email := v_func_source ILIKE '%email%';
  v_has_guarantor := v_func_source ILIKE '%guarantor%';
  v_has_exception := v_func_source ILIKE '%EXCEPTION%';

  RAISE NOTICE '';
  RAISE NOTICE '-- CHECK 5: Trigger handle_new_user --';

  IF NOT v_trigger_exists THEN
    RAISE WARNING '   FAIL — Le trigger on_auth_user_created N''EXISTE PAS sur auth.users';
  ELSE
    RAISE NOTICE '   Trigger on_auth_user_created existe';
  END IF;

  IF v_func_source IS NULL THEN
    RAISE WARNING '   FAIL — La fonction handle_new_user() n''existe pas';
  ELSE
    IF v_has_email THEN
      RAISE NOTICE '   handle_new_user() inclut la gestion de l''email';
    ELSE
      RAISE WARNING '   FAIL — handle_new_user() ne gere PAS l''email';
    END IF;

    IF v_has_guarantor THEN
      RAISE NOTICE '   handle_new_user() supporte le role guarantor';
    ELSE
      RAISE WARNING '   WARN — handle_new_user() ne supporte pas le role guarantor';
    END IF;

    IF v_has_exception THEN
      RAISE NOTICE '   handle_new_user() a un EXCEPTION handler (ne bloque pas auth)';
    ELSE
      RAISE WARNING '   WARN — handle_new_user() n''a pas d''EXCEPTION handler';
    END IF;
  END IF;
END $$;

-- ============================================
-- 7. VERIFICATION DES POLICIES RLS SUR PROFILES
-- ============================================
DO $$
DECLARE
  v_rls_enabled BOOLEAN;
  v_policy_count INTEGER;
  v_has_insert_policy BOOLEAN;
  v_has_own_access BOOLEAN;
  v_rec RECORD;
BEGIN
  -- Verifier si RLS est active
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'profiles'
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  -- Compter les policies
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'profiles' AND schemaname = 'public';

  -- Verifier si une policy INSERT existe
  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
      AND (cmd = 'INSERT' OR cmd = '*')
  ) INTO v_has_insert_policy;

  -- Verifier si profiles_own_access existe
  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
      AND policyname = 'profiles_own_access'
  ) INTO v_has_own_access;

  RAISE NOTICE '';
  RAISE NOTICE '-- CHECK 6: Policies RLS sur profiles --';

  IF v_rls_enabled THEN
    RAISE NOTICE '   RLS est active sur profiles';
  ELSE
    RAISE WARNING '   FAIL — RLS n''est PAS active sur profiles';
  END IF;

  RAISE NOTICE '   % policies trouvees:', v_policy_count;

  FOR v_rec IN
    SELECT policyname, cmd, permissive
    FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
    ORDER BY policyname
  LOOP
    RAISE NOTICE '      - % (cmd=%, permissive=%)',
      v_rec.policyname, v_rec.cmd, v_rec.permissive;
  END LOOP;

  IF v_has_insert_policy THEN
    RAISE NOTICE '   Une policy INSERT (ou ALL) existe';
  ELSE
    RAISE WARNING '   FAIL — Aucune policy INSERT sur profiles';
  END IF;

  IF v_has_own_access THEN
    RAISE NOTICE '   Policy profiles_own_access existe';
  ELSE
    RAISE WARNING '   WARN — Policy profiles_own_access manquante';
  END IF;
END $$;

-- ============================================
-- 8. DISTRIBUTION DES ROLES
-- ============================================
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '-- CHECK 7: Distribution des roles --';

  FOR v_rec IN
    SELECT role, count(*) AS cnt
    FROM public.profiles
    GROUP BY role
    ORDER BY cnt DESC
  LOOP
    RAISE NOTICE '   %-12s : %', v_rec.role, v_rec.cnt;
  END LOOP;
END $$;

-- ============================================
-- 9. RESUME FINAL
-- ============================================
DO $$
DECLARE
  v_orphan_auth INTEGER;
  v_null_emails INTEGER;
  v_orphan_profiles INTEGER;
  v_desync_emails INTEGER;
  v_trigger_ok BOOLEAN;
  v_insert_policy_ok BOOLEAN;
  v_score INTEGER := 0;
  v_max_score INTEGER := 6;
BEGIN
  -- Calculer les metriques
  SELECT count(*) INTO v_orphan_auth
  FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id WHERE p.id IS NULL;

  SELECT count(*) INTO v_null_emails
  FROM public.profiles WHERE email IS NULL OR email = '';

  SELECT count(*) INTO v_orphan_profiles
  FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE u.id IS NULL AND p.user_id IS NOT NULL;

  SELECT count(*) INTO v_desync_emails
  FROM public.profiles p INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.email IS DISTINCT FROM u.email AND p.email IS NOT NULL AND u.email IS NOT NULL;

  SELECT EXISTS(
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_created' AND n.nspname = 'auth' AND c.relname = 'users'
  ) INTO v_trigger_ok;

  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
      AND (cmd = 'INSERT' OR cmd = '*')
  ) INTO v_insert_policy_ok;

  -- Calculer le score
  IF v_orphan_auth = 0 THEN v_score := v_score + 1; END IF;
  IF v_null_emails = 0 THEN v_score := v_score + 1; END IF;
  IF v_orphan_profiles = 0 THEN v_score := v_score + 1; END IF;
  IF v_desync_emails = 0 THEN v_score := v_score + 1; END IF;
  IF v_trigger_ok THEN v_score := v_score + 1; END IF;
  IF v_insert_policy_ok THEN v_score := v_score + 1; END IF;

  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '            RESUME DE SYNCHRONISATION';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '  Auth sans profil      : %', lpad(v_orphan_auth::TEXT, 6);
  RAISE NOTICE '  Profils sans email    : %', lpad(v_null_emails::TEXT, 6);
  RAISE NOTICE '  Profils orphelins     : %', lpad(v_orphan_profiles::TEXT, 6);
  RAISE NOTICE '  Emails desynchronises : %', lpad(v_desync_emails::TEXT, 6);
  RAISE NOTICE '  Trigger OK            : %', CASE WHEN v_trigger_ok THEN '   OUI' ELSE '   NON' END;
  RAISE NOTICE '  Policy INSERT OK      : %', CASE WHEN v_insert_policy_ok THEN '   OUI' ELSE '   NON' END;
  RAISE NOTICE '==================================================';

  IF v_score = v_max_score THEN
    RAISE NOTICE '  SCORE: %/% — TOUT EST SYNCHRONISE', v_score, v_max_score;
  ELSIF v_score >= 4 THEN
    RAISE NOTICE '  SCORE: %/% — PROBLEMES MINEURS', v_score, v_max_score;
  ELSE
    RAISE NOTICE '  SCORE: %/% — PROBLEMES CRITIQUES', v_score, v_max_score;
  END IF;

  RAISE NOTICE '==================================================';
END $$;
