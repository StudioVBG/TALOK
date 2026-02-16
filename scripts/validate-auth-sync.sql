-- ============================================================================
-- Post-Deployment Validation Script — Auth/Profile Synchronization
-- Run this in the Supabase SQL Editor after deploying the migration.
-- ============================================================================

DO $$
DECLARE
  _total_users INT;
  _total_profiles INT;
  _desync INT;
  _orphans INT;
  _no_role INT;
  _no_email INT;
  _trigger_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO _total_users FROM auth.users;
  SELECT COUNT(*) INTO _total_profiles FROM public.profiles;

  SELECT COUNT(*) INTO _desync
  FROM auth.users au LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL;

  SELECT COUNT(*) INTO _orphans
  FROM public.profiles p LEFT JOIN auth.users au ON p.user_id = au.id
  WHERE au.id IS NULL;

  SELECT COUNT(*) INTO _no_role
  FROM public.profiles WHERE role IS NULL OR role = '';

  SELECT COUNT(*) INTO _no_email
  FROM public.profiles WHERE email IS NULL OR email = '';

  SELECT EXISTS(
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'on_auth_user_created'
  ) INTO _trigger_exists;

  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '   RAPPORT SYNCHRONISATION AUTH/PROFILES';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Date : %', NOW();
  RAISE NOTICE '--------------------------------------------------';
  RAISE NOTICE 'Total users auth    : %', _total_users;
  RAISE NOTICE 'Total profiles      : %', _total_profiles;
  RAISE NOTICE 'Users sans profil   : % %', _desync,
    CASE WHEN _desync = 0 THEN '  OK' ELSE '  CRITIQUE' END;
  RAISE NOTICE 'Profils orphelins   : % %', _orphans,
    CASE WHEN _orphans = 0 THEN '  OK' ELSE '  A NETTOYER' END;
  RAISE NOTICE 'Profils sans role   : % %', _no_role,
    CASE WHEN _no_role = 0 THEN '  OK' ELSE '  A CORRIGER' END;
  RAISE NOTICE 'Profils sans email  : % %', _no_email,
    CASE WHEN _no_email = 0 THEN '  OK' ELSE '  A CORRIGER' END;
  RAISE NOTICE 'Trigger actif       : % %', _trigger_exists,
    CASE WHEN _trigger_exists THEN '  OK' ELSE '  MANQUANT' END;
  RAISE NOTICE '--------------------------------------------------';
  RAISE NOTICE 'Sync ratio          : %/%', _total_profiles, _total_users;
  RAISE NOTICE 'Sante globale       : %',
    CASE WHEN _desync = 0 AND _orphans = 0 AND _no_role = 0
              AND _no_email = 0 AND _trigger_exists
      THEN 'HEALTHY'
      ELSE 'NEEDS ATTENTION'
    END;
  RAISE NOTICE '==================================================';
END $$;
