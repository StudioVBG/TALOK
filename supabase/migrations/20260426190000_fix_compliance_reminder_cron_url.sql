-- ============================================================================
-- FIX : Cron provider-compliance-reminders avec URL hardcodée
-- ============================================================================
-- La migration 20260425130200 schedule le cron avec
-- 'https://app.talok.fr/api/cron/provider-compliance-reminders' en dur
-- (ligne 63). Cela rend le cron fragile : changement de domaine, instance
-- staging/preview, ou multi-environnement nécessitent un re-run manuel.
--
-- Cette migration aligne le cron sur le pattern Talok officiel utilisé par
-- 20260426150000_schedule_release_escrow_cron.sql :
--   - URL via current_setting('app.settings.app_url')
--   - Secret via current_setting('app.settings.cron_secret')
--
-- Prérequis dashboard Supabase (déjà configuré pour les autres crons Talok) :
--   ALTER DATABASE postgres SET app.settings.app_url = 'https://app.talok.fr';
--   ALTER DATABASE postgres SET app.settings.cron_secret = '<même valeur que CRON_SECRET côté Netlify>';
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_cron ou pg_net manquant — schedule ignore';
    RETURN;
  END IF;

  -- Idempotent : retire l'ancien schedule (URL hardcodée)
  BEGIN
    PERFORM cron.unschedule('provider-compliance-reminders');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Reschedule avec URL dynamique (pattern Talok)
  PERFORM cron.schedule(
    'provider-compliance-reminders',
    '0 9 * * *',
    $cron$
      SELECT net.http_post(
        url := current_setting('app.settings.app_url') || '/api/cron/provider-compliance-reminders',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      )
    $cron$
  );
END$$;

-- ============================================================================
-- VÉRIFICATION POST-MIGRATION (à exécuter manuellement)
-- ============================================================================
-- SELECT jobname, schedule, command FROM cron.job
-- WHERE jobname = 'provider-compliance-reminders';
-- -> doit afficher current_setting(...) au lieu de l'URL hardcodée
-- ============================================================================
