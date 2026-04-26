-- ============================================
-- Migration : Schedule cron release-escrow (Sprint B work orders)
-- Date : 2026-04-26
--
-- Active la libération automatique des paiements work_order_payments en
-- escrow_status='held' dont le dispute_deadline est passé. Sans ce cron,
-- les soldes restent bloqués indéfiniment côté plateforme Talok.
--
-- Pattern : Supabase pg_cron + pg_net, identique aux autres crons Talok
-- (cf. 20260304100000_activate_pg_cron_schedules.sql).
--
-- Prérequis dashboard Supabase :
--   ALTER DATABASE postgres SET app.settings.app_url = 'https://...';
--   ALTER DATABASE postgres SET app.settings.cron_secret = '...';
-- (déjà configuré pour les autres crons Talok)
-- ============================================

-- Idempotent : retirer l'ancien job s'il existe déjà
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'release-escrow';

-- Quotidien à 3h00 UTC (heure creuse, après les éventuels paiements
-- nocturnes). Scanne les paiements WO en escrow held avec
-- dispute_deadline <= NOW() et déclenche les Stripe Transfers.
SELECT cron.schedule('release-escrow', '0 3 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/release-escrow',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);
