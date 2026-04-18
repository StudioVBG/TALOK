-- Migration: Cron quotidien de purge des demandes 2FA identité expirées
-- Date: 2026-04-17
--
-- Sprint 1 (monitoring + rétention) :
-- Les lignes de `identity_2fa_requests` sont insérées à chaque demande 2FA.
-- Sans purge, la table croît indéfiniment. On supprime les entrées dont
-- `expires_at` est > 1 jour dans le passé (OTP + token inutilisables).
--
-- Prérequis : pg_cron doit être activé (déjà fait par la migration
-- 20260304100000_activate_pg_cron_schedules.sql).

-- ============================================================
-- 1. Fonction de purge
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_identity_2fa()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.identity_2fa_requests
  WHERE expires_at < now() - interval '1 day';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_identity_2fa() IS
  'Supprime les demandes 2FA identité expirées depuis plus de 24h. '
  'Planifié quotidiennement à 3h UTC via pg_cron.';

REVOKE ALL ON FUNCTION public.cleanup_expired_identity_2fa() FROM public;
REVOKE ALL ON FUNCTION public.cleanup_expired_identity_2fa() FROM authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_identity_2fa() FROM anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_identity_2fa() TO service_role;

-- ============================================================
-- 2. Cron pg_cron (idempotent)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Drop ancien job s'il existe
    PERFORM cron.unschedule('cleanup-identity-2fa-expired')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cleanup-identity-2fa-expired'
    );

    -- Planifier quotidiennement à 3h UTC (entre 4h-5h Europe/Paris)
    PERFORM cron.schedule(
      'cleanup-identity-2fa-expired',
      '0 3 * * *',
      $cron$SELECT public.cleanup_expired_identity_2fa()$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron n''est pas activé : le cron de purge identity_2fa_requests ne sera pas planifié. Activer pg_cron puis ré-appliquer cette migration.';
  END IF;
END
$$;
