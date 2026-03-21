-- ============================================
-- Migration corrective : SOTA 2026 post-refactoring
-- Date : 2026-03-21
-- Description :
--   1. Supprime le job generate-monthly-invoices (route supprimee en P3)
--   2. Ajoute le job process-outbox pour le processeur outbox asynchrone
-- ============================================

-- 1. Supprimer le job pointant vers la route supprimee
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'generate-monthly-invoices';

-- 2. Ajouter le processeur outbox (toutes les 5 minutes)
SELECT cron.schedule('process-outbox', '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/process-outbox',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);
