-- ============================================================================
-- Schedule cron : rappels expiration documents compliance prestataire
-- ============================================================================
-- Quotidien a 9h UTC (10h Paris hiver / 11h Paris ete).
-- Cron pg_cron + pg_net (pattern existant Talok, voir 20260304100000).
--
-- Idempotence cote application : la cle Resend est `compliance-reminder/
-- <provider>/<label>/<window>` ce qui dedupplique sur 24h.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) AND EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    -- Drop si deja schedule (idempotent)
    BEGIN
      PERFORM cron.unschedule('provider-compliance-reminders');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

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
  END IF;
END$$;
