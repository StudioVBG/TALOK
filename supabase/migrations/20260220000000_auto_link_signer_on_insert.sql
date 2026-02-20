-- =====================================================
-- MIGRATION: SOTA 2026 — Auto-link signer à l'INSERT
-- Date: 2026-02-20
--
-- OBJECTIF:
--   Quand un lease_signer est créé avec invited_email et profile_id NULL,
--   lier immédiatement au profil existant si l'email correspond (auth.users).
--   Couvre le cas "locataire déjà inscrit invité sur un nouveau bail".
--
-- CONTENU:
--   1. Fonction auto_link_signer_on_insert() — BEFORE INSERT sur lease_signers
--   2. RPC find_profile_by_email(target_email) — pour l'API invite
--   3. Fix rétroactif — lier les orphelins existants
--   4. Vérification finale
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-link à l'INSERT du signer
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_link_signer_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  found_profile_id UUID;
BEGIN
  IF NEW.profile_id IS NULL AND NEW.invited_email IS NOT NULL AND TRIM(NEW.invited_email) != '' THEN
    SELECT p.id INTO found_profile_id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(NEW.invited_email))
    LIMIT 1;

    IF found_profile_id IS NOT NULL THEN
      NEW.profile_id := found_profile_id;
      RAISE NOTICE '[auto_link_on_insert] Lien immédiat: % -> profil %', NEW.invited_email, found_profile_id;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_link_on_insert] Erreur non-bloquante: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_link_signer_on_insert() IS
'SOTA 2026: À l''INSERT d''un lease_signer avec invited_email et profile_id NULL, lie au profil existant si l''email matche auth.users. Ne bloque jamais l''INSERT.';

-- ============================================
-- 2. TRIGGER: Exécuter avant chaque INSERT sur lease_signers
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_link_signer_on_insert ON public.lease_signers;

CREATE TRIGGER trigger_auto_link_signer_on_insert
  BEFORE INSERT ON public.lease_signers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_signer_on_insert();

-- ============================================
-- 3. RPC: find_profile_by_email — pour l'API (remplace listUsers)
-- ============================================
CREATE OR REPLACE FUNCTION public.find_profile_by_email(target_email TEXT)
RETURNS TABLE(id UUID, user_id UUID, role TEXT) AS $$
BEGIN
  IF target_email IS NULL OR TRIM(target_email) = '' THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id, p.user_id, p.role::TEXT
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(target_email))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.find_profile_by_email(TEXT) IS
'SOTA 2026: Retourne (id, user_id, role) du profil dont l''email auth correspond. Utilisé par l''API invite pour éviter listUsers().';

-- ============================================
-- 4. FIX RÉTROACTIF: Lier les lease_signers orphelins existants
-- ============================================
DO $$
DECLARE
  linked_total INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT ls.id AS signer_id, p.id AS profile_id
    FROM public.lease_signers ls
    JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
    JOIN public.profiles p ON p.user_id = u.id
    WHERE ls.profile_id IS NULL
      AND ls.invited_email IS NOT NULL
      AND TRIM(ls.invited_email) != ''
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE lease_signers.id = rec.signer_id;
    linked_total := linked_total + 1;
  END LOOP;

  IF linked_total > 0 THEN
    RAISE NOTICE '[rétro-link] % lease_signers orphelins liés à un profil existant', linked_total;
  ELSE
    RAISE NOTICE '[rétro-link] Aucun lease_signer orphelin à lier';
  END IF;
END $$;

-- ============================================
-- 5. VÉRIFICATION: Compter les orphelins restants
-- ============================================
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*)::INT INTO orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND TRIM(invited_email) != ''
    AND invited_email NOT LIKE '%@a-definir%';

  IF orphan_count > 0 THEN
    RAISE NOTICE '⚠️  % lease_signers orphelins restants (email sans compte correspondant)', orphan_count;
  ELSE
    RAISE NOTICE '✅ Tous les signers avec email valide sont liés ou n''ont pas encore de compte';
  END IF;
END $$;

COMMIT;
