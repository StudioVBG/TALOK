-- ============================================
-- Migration : Cleanup automatique des comptes auth.users zombies
-- Date : 2026-04-25
--
-- Un compte zombie est une ligne `auth.users` qui :
--   - a été créée il y a plus de 30 jours
--   - n'a jamais confirmé son email
--   - n'a jamais confirmé son téléphone
--   - n'a aucun contenu rattaché (pas de profile complet, ni bail, ni propriété, ni facture)
--
-- Ces comptes apparaissent quand un utilisateur démarre l'inscription puis
-- abandonne sans cliquer le lien de confirmation, ou quand un admin teste
-- le flux phone signup via Supabase Studio sans valider l'OTP.
--
-- Cette migration livre :
--   - une vue v_zombie_auth_users qui liste les candidats à suppression
--   - une fonction cleanup_zombie_auth_users(dry_run) qui supprime ou simule
--   - un job pg_cron commenté (à activer manuellement après audit)
--
-- La fonction est SECURITY DEFINER, propriétaire postgres, accessible
-- uniquement au service_role. Le DELETE sur auth.users cascade naturellement
-- sur profiles (FK ON DELETE CASCADE) et toutes les tables filles.
-- ============================================

-- ============================================
-- 1. Vue v_zombie_auth_users — candidats à suppression
-- ============================================
CREATE OR REPLACE VIEW public.v_zombie_auth_users AS
SELECT
  u.id                        AS user_id,
  u.email,
  u.phone,
  u.created_at,
  u.confirmation_sent_at,
  u.invited_at,
  u.raw_app_meta_data->>'provider' AS auth_provider,
  EXTRACT(EPOCH FROM (NOW() - u.created_at)) / 86400 AS days_since_signup
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.created_at < NOW() - INTERVAL '30 days'
  AND u.email_confirmed_at IS NULL
  AND COALESCE((u.raw_user_meta_data->>'phone_verified')::boolean, false) = false
  -- Pas de profil avec contenu
  AND (
    p.id IS NULL
    OR (
      p.onboarding_completed_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.leases    WHERE tenant_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.properties WHERE owner_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.invoices  WHERE tenant_id = p.id)
    )
  )
ORDER BY u.created_at;

COMMENT ON VIEW public.v_zombie_auth_users IS
  'Candidats à suppression : auth.users non confirmés depuis plus de 30 jours, sans profil ou avec profil vide. À auditer avant chaque exécution de cleanup_zombie_auth_users(false).';

-- ============================================
-- 2. Fonction cleanup_zombie_auth_users(dry_run)
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_zombie_auth_users(p_dry_run BOOLEAN DEFAULT TRUE)
RETURNS TABLE (
  affected      INTEGER,
  dry_run       BOOLEAN,
  earliest_age  NUMERIC,
  latest_age    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count    INTEGER := 0;
  v_min_age  NUMERIC;
  v_max_age  NUMERIC;
BEGIN
  -- Agrégats sur la fenêtre cible (avant éventuelle suppression)
  SELECT
    COUNT(*),
    MIN(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400),
    MAX(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)
  INTO v_count, v_min_age, v_max_age
  FROM public.v_zombie_auth_users;

  IF v_count = 0 THEN
    RETURN QUERY SELECT 0, p_dry_run, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  IF NOT p_dry_run THEN
    -- DELETE cascade sur profiles via FK ON DELETE CASCADE.
    DELETE FROM auth.users
    WHERE id IN (SELECT user_id FROM public.v_zombie_auth_users);

    RAISE NOTICE 'cleanup_zombie_auth_users: % zombie(s) supprimé(s)', v_count;
  ELSE
    RAISE NOTICE 'cleanup_zombie_auth_users (dry_run): % zombie(s) à supprimer', v_count;
  END IF;

  RETURN QUERY SELECT v_count, p_dry_run, v_min_age, v_max_age;
END;
$$;

COMMENT ON FUNCTION public.cleanup_zombie_auth_users(BOOLEAN) IS
  'Supprime les comptes auth.users zombies (non confirmés > 30j, sans contenu). Par défaut en dry_run = TRUE pour audit. Appeler avec FALSE pour réellement supprimer.';

-- ============================================
-- 3. Permissions — service_role uniquement
-- ============================================
REVOKE ALL ON public.v_zombie_auth_users        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_zombie_auth_users(BOOLEAN) FROM PUBLIC, anon, authenticated;

GRANT SELECT  ON public.v_zombie_auth_users        TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_zombie_auth_users(BOOLEAN) TO service_role;

-- ============================================
-- 4. Cron pg_cron — DÉSACTIVÉ par défaut
--
-- Pour activer le cleanup mensuel automatique (1er du mois à 03:00 UTC) :
--   1. Faire tourner SELECT * FROM cleanup_zombie_auth_users(TRUE); pour
--      auditer le nombre de comptes qui seraient supprimés.
--   2. Si le nombre est cohérent, décommenter le bloc ci-dessous et
--      l'exécuter manuellement dans le SQL Editor.
-- ============================================

-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-zombie-auth-users') THEN
--     PERFORM cron.schedule(
--       'cleanup-zombie-auth-users',
--       '0 3 1 * *',
--       'SELECT public.cleanup_zombie_auth_users(FALSE);'
--     );
--   END IF;
-- END $$;
