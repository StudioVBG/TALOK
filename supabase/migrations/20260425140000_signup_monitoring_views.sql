-- ============================================
-- Migration : Vues de monitoring pour le pipeline d'inscription
-- Date : 2026-04-25
--
-- Crée 4 vues SECURITY INVOKER (donc soumises au RLS de l'appelant) qui
-- agrègent les signaux clés du parcours d'inscription :
--   v_signup_funnel       : entonnoir signup → email confirmé → onboardé, par jour et par rôle
--   v_reminder_pipeline   : état de la file de rappels onboarding
--   v_email_confirmation  : détecte enable_confirmations OFF (auto-confirm < 5s)
--   v_onboarding_dropoff  : utilisateurs bloqués depuis >= 24h sans onboarding fini
--
-- Ces vues sont en lecture seule, idempotentes (CREATE OR REPLACE), et
-- réservées aux service_role (à n'utiliser que dans Studio ou via API admin).
-- ============================================

-- ============================================
-- 1. v_signup_funnel — entonnoir 30 jours par rôle
-- ============================================
CREATE OR REPLACE VIEW public.v_signup_funnel AS
SELECT
  DATE(p.created_at)            AS signup_day,
  p.role,
  COUNT(*)                      AS signups,
  COUNT(u.email_confirmed_at)   AS email_confirmed,
  COUNT(p.onboarding_completed_at) AS onboarding_completed,
  ROUND(
    100.0 * COUNT(u.email_confirmed_at)::numeric
    / NULLIF(COUNT(*), 0),
    1
  )                             AS confirm_rate_pct,
  ROUND(
    100.0 * COUNT(p.onboarding_completed_at)::numeric
    / NULLIF(COUNT(*), 0),
    1
  )                             AS completion_rate_pct
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE p.created_at > NOW() - INTERVAL '30 days'
GROUP BY signup_day, p.role
ORDER BY signup_day DESC, p.role;

COMMENT ON VIEW public.v_signup_funnel IS
  'Entonnoir d''inscription par jour et par rôle sur les 30 derniers jours. Signups → email confirmé → onboarding terminé. Sert à détecter une régression du flux signup ou des emails de confirmation.';

-- ============================================
-- 2. v_reminder_pipeline — santé de la file des rappels
-- ============================================
CREATE OR REPLACE VIEW public.v_reminder_pipeline AS
SELECT
  reminder_type,
  status,
  COUNT(*)                                      AS total,
  MIN(scheduled_at) FILTER (WHERE status = 'pending')  AS next_send,
  MAX(sent_at)                                  AS last_sent,
  COUNT(*) FILTER (WHERE status = 'pending'
    AND scheduled_at < NOW() - INTERVAL '2 hours')      AS overdue
FROM public.onboarding_reminders
GROUP BY reminder_type, status
ORDER BY reminder_type, status;

COMMENT ON VIEW public.v_reminder_pipeline IS
  'État de la file des rappels onboarding. La colonne overdue compte les rappels pending dont le scheduled_at est dépassé de plus de 2h — signe que le cron /api/cron/onboarding-reminders ne tourne plus.';

-- ============================================
-- 3. v_email_confirmation_health — détecte enable_confirmations OFF
-- ============================================
CREATE OR REPLACE VIEW public.v_email_confirmation_health AS
SELECT
  COUNT(*) FILTER (WHERE email_confirmed_at IS NULL)   AS pending_confirmation,
  COUNT(*) FILTER (
    WHERE email_confirmed_at IS NOT NULL
      AND email_confirmed_at - created_at < INTERVAL '5 seconds'
  )                                                    AS auto_confirmed_suspect,
  COUNT(*) FILTER (
    WHERE email_confirmed_at IS NOT NULL
      AND email_confirmed_at - created_at >= INTERVAL '5 seconds'
  )                                                    AS user_confirmed,
  COUNT(*)                                             AS total_30d
FROM auth.users
WHERE created_at > NOW() - INTERVAL '30 days';

COMMENT ON VIEW public.v_email_confirmation_health IS
  'Si auto_confirmed_suspect > 0, enable_confirmations est OFF au Dashboard Supabase et les utilisateurs sont marqués confirmés sans recevoir d''email — faille de validation d''identité.';

-- ============================================
-- 4. v_onboarding_dropoff — users bloqués
-- ============================================
CREATE OR REPLACE VIEW public.v_onboarding_dropoff AS
SELECT
  p.id                          AS profile_id,
  p.user_id,
  p.email,
  p.role,
  p.created_at,
  EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400 AS days_since_signup,
  u.email_confirmed_at,
  COUNT(r.id) FILTER (WHERE r.status = 'sent')      AS reminders_sent,
  COUNT(r.id) FILTER (WHERE r.status = 'pending')   AS reminders_pending,
  MAX(r.sent_at)                                    AS last_reminder_at
FROM public.profiles p
LEFT JOIN auth.users u                  ON u.id = p.user_id
LEFT JOIN public.onboarding_reminders r ON r.user_id = p.user_id
WHERE p.onboarding_completed_at IS NULL
  AND p.created_at < NOW() - INTERVAL '24 hours'
  AND p.created_at > NOW() - INTERVAL '60 days'
GROUP BY p.id, p.user_id, p.email, p.role, p.created_at, u.email_confirmed_at
ORDER BY p.created_at DESC;

COMMENT ON VIEW public.v_onboarding_dropoff IS
  'Utilisateurs inscrits depuis plus de 24h qui n''ont pas terminé l''onboarding, avec compte des rappels reçus. Sert à identifier les profils à relancer manuellement et à mesurer l''efficacité des rappels automatiques.';

-- ============================================
-- Permissions : seul service_role peut lire (les vues exposent des données
-- agrégées mais aussi des emails dans v_onboarding_dropoff)
-- ============================================
REVOKE ALL ON public.v_signup_funnel              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_reminder_pipeline          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_email_confirmation_health  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_onboarding_dropoff         FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.v_signup_funnel              TO service_role;
GRANT SELECT ON public.v_reminder_pipeline          TO service_role;
GRANT SELECT ON public.v_email_confirmation_health  TO service_role;
GRANT SELECT ON public.v_onboarding_dropoff         TO service_role;
