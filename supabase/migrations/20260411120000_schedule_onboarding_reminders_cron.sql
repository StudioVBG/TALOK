-- ============================================
-- Migration : Planifier le cron onboarding-reminders
-- Date : 2026-04-11
-- Description : Ajoute la planification pg_cron pour la route
--   /api/cron/onboarding-reminders. Cette route envoie les relances
--   d'onboarding (24h, 72h, 7 jours) aux utilisateurs n'ayant pas
--   terminé leur parcours. Elle existait dans le code mais n'était
--   jamais déclenchée en production faute d'entrée dans cron.job.
--
-- Prérequis (déjà configurés par 20260304100000_activate_pg_cron_schedules.sql) :
--   - Extensions pg_cron + pg_net actives
--   - app.settings.app_url défini
--   - app.settings.cron_secret défini
-- ============================================

-- Idempotence : supprimer un éventuel job existant
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'onboarding-reminders') THEN
    PERFORM cron.unschedule('onboarding-reminders');
  END IF;
END $$;

-- Planifier le cron : toutes les heures, pile (cf. commentaire dans
-- app/api/cron/onboarding-reminders/route.ts : "exécuter toutes les heures")
SELECT cron.schedule('onboarding-reminders', '0 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/onboarding-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);
