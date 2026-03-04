-- ============================================
-- Migration : Activer pg_cron + pg_net et planifier tous les crons
-- Date : 2026-03-04
-- Description : Configure le scheduling automatique des API routes cron
--   via Supabase pg_cron + pg_net. Zéro service externe requis.
--
-- Prérequis (à configurer dans le dashboard Supabase > SQL Editor) :
--   ALTER DATABASE postgres SET app.settings.app_url = 'https://votre-site.netlify.app';
--   ALTER DATABASE postgres SET app.settings.cron_secret = 'votre-cron-secret';
-- ============================================

-- Activer les extensions (déjà disponibles sur Supabase Pro)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Supprimer les anciens jobs s'ils existent (idempotent)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'payment-reminders',
  'generate-monthly-invoices',
  'generate-invoices',
  'process-webhooks',
  'lease-expiry-alerts',
  'check-cni-expiry',
  'irl-indexation',
  'visit-reminders',
  'cleanup-exports',
  'cleanup-webhooks',
  'subscription-alerts',
  'notifications'
);

-- ===== CRONS CRITIQUES =====

-- Relances de paiement : quotidien à 8h UTC
SELECT cron.schedule('payment-reminders', '0 8 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/payment-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Génération factures mensuelles (route API) : 1er du mois à 6h
SELECT cron.schedule('generate-monthly-invoices', '0 6 1 * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/generate-monthly-invoices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Génération factures (RPC SQL) : 1er du mois à 6h30
SELECT cron.schedule('generate-invoices', '30 6 1 * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/generate-invoices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Process webhooks : toutes les 5 min
SELECT cron.schedule('process-webhooks', '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/process-webhooks',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ===== CRONS SECONDAIRES =====

-- Alertes fin de bail : lundi 8h
SELECT cron.schedule('lease-expiry-alerts', '0 8 * * 1',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/lease-expiry-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Vérif CNI expirées : quotidien 10h
SELECT cron.schedule('check-cni-expiry', '0 10 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/check-cni-expiry',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Alertes abonnements : quotidien 10h
SELECT cron.schedule('subscription-alerts', '0 10 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/subscription-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Indexation IRL : 1er du mois 7h
SELECT cron.schedule('irl-indexation', '0 7 1 * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/irl-indexation',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Rappels de visites : toutes les 30 min
SELECT cron.schedule('visit-reminders', '*/30 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/visit-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ===== NETTOYAGE =====

-- Nettoyage exports expirés : quotidien 3h
SELECT cron.schedule('cleanup-exports', '0 3 * * *',
  $$SELECT cleanup_expired_exports()$$
);

-- Nettoyage webhooks anciens : quotidien 4h
SELECT cron.schedule('cleanup-webhooks', '0 4 * * *',
  $$SELECT cleanup_old_webhooks()$$
);

COMMENT ON EXTENSION pg_cron IS 'Scheduling automatique des crons via Supabase pg_cron + pg_net';
