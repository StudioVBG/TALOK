-- ============================================================================
-- Migration: Admin Dashboard RPCs
-- Date: 2026-03-12
-- Description: Crée les RPCs manquantes pour le dashboard admin V2
--   - admin_monthly_revenue : revenus mensuels sur 12 mois
--   - admin_subscription_stats : stats abonnements
--   - admin_daily_trends : tendances 7 derniers jours
-- ============================================================================

-- 1. RPC: admin_monthly_revenue
-- Retourne les revenus attendus vs encaissés sur les 12 derniers mois
CREATE OR REPLACE FUNCTION admin_monthly_revenue()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      to_char(month_start, 'Mon') AS month,
      COALESCE(SUM(montant_total), 0)::numeric AS attendu,
      COALESCE(SUM(CASE WHEN statut = 'paid' THEN montant_total ELSE 0 END), 0)::numeric AS encaisse
    FROM generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS month_start
    LEFT JOIN invoices ON date_trunc('month', invoices.created_at) = month_start
    GROUP BY month_start
    ORDER BY month_start
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 2. RPC: admin_subscription_stats
-- Retourne les statistiques d'abonnements
CREATE OR REPLACE FUNCTION admin_subscription_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*)::int,
    'active', COUNT(*) FILTER (WHERE status = 'active')::int,
    'trial', COUNT(*) FILTER (WHERE status = 'trialing' OR (trial_end IS NOT NULL AND trial_end > now()))::int,
    'churned', COUNT(*) FILTER (WHERE status IN ('canceled', 'expired'))::int
  )
  INTO result
  FROM subscriptions;

  RETURN COALESCE(result, json_build_object('total', 0, 'active', 0, 'trial', 0, 'churned', 0));
END;
$$;

-- 3. RPC: admin_daily_trends
-- Retourne les tendances des 7 derniers jours (nouveaux users, properties, leases)
CREATE OR REPLACE FUNCTION admin_daily_trends()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  users_arr int[];
  properties_arr int[];
  leases_arr int[];
  d date;
BEGIN
  users_arr := ARRAY[]::int[];
  properties_arr := ARRAY[]::int[];
  leases_arr := ARRAY[]::int[];

  FOR d IN SELECT generate_series(
    (current_date - interval '6 days')::date,
    current_date,
    interval '1 day'
  )::date
  LOOP
    users_arr := users_arr || COALESCE(
      (SELECT COUNT(*)::int FROM profiles WHERE created_at::date = d), 0
    );
    properties_arr := properties_arr || COALESCE(
      (SELECT COUNT(*)::int FROM properties WHERE created_at::date = d), 0
    );
    leases_arr := leases_arr || COALESCE(
      (SELECT COUNT(*)::int FROM leases WHERE created_at::date = d), 0
    );
  END LOOP;

  RETURN json_build_object(
    'users', to_json(users_arr),
    'properties', to_json(properties_arr),
    'leases', to_json(leases_arr)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_monthly_revenue() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_subscription_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_daily_trends() TO authenticated;
