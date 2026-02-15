-- =====================================================
-- MIGRATION: Auto-link lease_signers + fix profil orphelin
-- Date: 2026-02-16
--
-- PROBLÈMES CORRIGÉS:
-- 1. Trigger DB: quand un profil est créé, lier automatiquement 
--    les lease_signers orphelins (invited_email match, profile_id NULL)
-- 2. Trigger DB: quand un profil est créé, marquer les invitations
--    correspondantes comme utilisées
-- 3. Fix immédiat: créer le profil manquant pour user 6337af52-...
-- 4. Fix rétroactif: lier tous les lease_signers orphelins existants
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-link lease_signers au moment de la création d'un profil
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  -- Récupérer l'email de l'utilisateur auth
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Lier tous les lease_signers orphelins avec cet email
  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)', 
      linked_count, NEW.id, user_email;
  END IF;

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. TRIGGER: Exécuter auto-link après chaque INSERT sur profiles
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_link_lease_signers ON public.profiles;

CREATE TRIGGER trigger_auto_link_lease_signers
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_created();

-- ============================================
-- 3. FIX IMMÉDIAT: Créer le profil manquant pour l'utilisateur signalé
-- ============================================
DO $$
DECLARE
  target_user_id UUID := '6337af52-2fb7-41d7-b620-d9ddd689d294';
  user_email TEXT;
  user_role TEXT;
  new_profile_id UUID;
BEGIN
  -- Vérifier si le user existe dans auth.users
  SELECT email, COALESCE(raw_user_meta_data->>'role', 'tenant')
  INTO user_email, user_role
  FROM auth.users
  WHERE id = target_user_id;

  IF user_email IS NULL THEN
    RAISE NOTICE 'User % non trouvé dans auth.users — skip', target_user_id;
    RETURN;
  END IF;

  -- Vérifier si le profil existe déjà
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id) THEN
    RAISE NOTICE 'Profil déjà existant pour user % — skip', target_user_id;
    RETURN;
  END IF;

  -- Créer le profil manquant
  INSERT INTO public.profiles (user_id, role, email)
  VALUES (target_user_id, user_role, user_email)
  RETURNING id INTO new_profile_id;

  RAISE NOTICE 'Profil créé: id=%, user_id=%, email=%, role=%', 
    new_profile_id, target_user_id, user_email, user_role;

  -- Le trigger auto_link_lease_signers se chargera de lier les lease_signers
END $$;

-- ============================================
-- 4. FIX RÉTROACTIF: Lier tous les lease_signers orphelins existants
-- ============================================
-- Pour tous les profils existants dont l'email matche un lease_signer orphelin
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

-- ============================================
-- 5. VÉRIFICATION: Compter les lease_signers encore orphelins
-- ============================================
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING '⚠️  % lease_signers orphelins restants (email sans compte correspondant)', orphan_count;
  ELSE
    RAISE NOTICE '✅ Aucun lease_signer orphelin — tous les comptes sont liés';
  END IF;
END $$;

COMMIT;
