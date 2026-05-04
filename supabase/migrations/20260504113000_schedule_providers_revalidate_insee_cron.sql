-- =====================================================
-- MIGRATION: Schedule du cron mensuel de revalidation INSEE
-- des prestataires.
--
-- Appelle /api/cron/providers-revalidate-insee le 1er de chaque mois
-- à 5h UTC (heure creuse, en amont des relances quotidiennes).
--
-- Pré-requis (déjà en place via 20260304100000_activate_pg_cron_schedules) :
--   - extensions pg_cron, pg_net actives
--   - settings : app.settings.app_url, app.settings.cron_secret
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Idempotent : on retire l'éventuel job précédent puis on replanifie
    PERFORM cron.unschedule('providers-revalidate-insee')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'providers-revalidate-insee'
    );

    PERFORM cron.schedule(
      'providers-revalidate-insee',
      '0 5 1 * *',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.settings.app_url') || '/api/cron/providers-revalidate-insee',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'),
            'Content-Type', 'application/json'
          ),
          body := '{}'::jsonb
        )
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron non activé : le cron providers-revalidate-insee ne sera pas planifié automatiquement. Activez l''extension puis rejouez cette migration.';
  END IF;
END $$;

COMMENT ON EXTENSION pg_cron IS 'pg_cron — utilisé pour planifier les routes /api/cron/*';
