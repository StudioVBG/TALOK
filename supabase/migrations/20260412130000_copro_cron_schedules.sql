-- ============================================================
-- Migration: Schedule copro cron jobs via pg_cron + pg_net
-- Date: 2026-04-12
-- Description: Schedules 5 copropriété cron jobs for automated
--   reminders, alerts, and compliance checks.
-- ============================================================

-- Unschedule existing jobs (idempotent)
SELECT cron.unschedule('copro-convocation-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-convocation-reminders'
);

SELECT cron.unschedule('copro-fund-call-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-fund-call-reminders'
);

SELECT cron.unschedule('copro-overdue-alerts')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-overdue-alerts'
);

SELECT cron.unschedule('copro-assembly-countdown')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-assembly-countdown'
);

SELECT cron.unschedule('copro-pv-distribution')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-pv-distribution'
);

-- ============================================================
-- 1. copro-convocation-reminders — daily 9h UTC
-- ============================================================
SELECT cron.schedule('copro-convocation-reminders', '0 9 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-convocation-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 2. copro-fund-call-reminders — daily 8h UTC
-- ============================================================
SELECT cron.schedule('copro-fund-call-reminders', '0 8 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-fund-call-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 3. copro-overdue-alerts — Monday 8h UTC
-- ============================================================
SELECT cron.schedule('copro-overdue-alerts', '0 8 * * 1',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-overdue-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 4. copro-assembly-countdown — daily 7h UTC
-- ============================================================
SELECT cron.schedule('copro-assembly-countdown', '0 7 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-assembly-countdown',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 5. copro-pv-distribution — daily 10h UTC
-- ============================================================
SELECT cron.schedule('copro-pv-distribution', '0 10 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-pv-distribution',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
COMMENT ON SCHEMA cron IS 'pg_cron schedules including 5 copro cron jobs: convocation-reminders (9h daily), fund-call-reminders (8h daily), overdue-alerts (8h Monday), assembly-countdown (7h daily), pv-distribution (10h daily)';
