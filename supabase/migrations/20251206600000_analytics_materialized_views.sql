-- Migration: Materialized Views pour Analytics
-- Date: 2024-12-06
-- Description: Vues matérialisées pour dashboards et rapports performants

BEGIN;

-- ============================================
-- VUE: Statistiques mensuelles propriétaires
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_owner_monthly_stats AS
SELECT 
  p.id AS owner_id,
  DATE_TRUNC('month', i.created_at) AS month,
  COUNT(DISTINCT prop.id) AS properties_count,
  COUNT(DISTINCT l.id) AS active_leases_count,
  COUNT(DISTINCT i.id) AS invoices_count,
  COALESCE(SUM(i.montant_total), 0) AS total_invoiced,
  COALESCE(SUM(CASE WHEN i.statut = 'paid' THEN i.montant_total ELSE 0 END), 0) AS total_collected,
  COALESCE(SUM(CASE WHEN i.statut = 'late' THEN i.montant_total ELSE 0 END), 0) AS total_late,
  COUNT(CASE WHEN i.statut = 'paid' THEN 1 END) AS paid_invoices_count,
  COUNT(CASE WHEN i.statut = 'late' THEN 1 END) AS late_invoices_count,
  ROUND(
    CASE 
      WHEN COUNT(i.id) > 0 
      THEN COUNT(CASE WHEN i.statut = 'paid' THEN 1 END)::DECIMAL / COUNT(i.id) * 100 
      ELSE 0 
    END, 2
  ) AS collection_rate
FROM profiles p
LEFT JOIN properties prop ON prop.owner_id = p.id
LEFT JOIN leases l ON l.property_id = prop.id AND l.statut = 'active'
LEFT JOIN invoices i ON i.owner_id = p.id
WHERE p.role = 'owner'
GROUP BY p.id, DATE_TRUNC('month', i.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_owner_monthly_stats 
  ON mv_owner_monthly_stats(owner_id, month);

-- ============================================
-- VUE: KPIs globaux plateforme
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_kpis AS
SELECT 
  DATE_TRUNC('day', NOW()) AS snapshot_date,
  
  -- Utilisateurs
  (SELECT COUNT(*) FROM profiles WHERE role = 'owner') AS total_owners,
  (SELECT COUNT(*) FROM profiles WHERE role = 'tenant') AS total_tenants,
  (SELECT COUNT(*) FROM profiles WHERE role = 'provider') AS total_providers,
  (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
  
  -- Propriétés (etat au lieu de status)
  (SELECT COUNT(*) FROM properties WHERE etat = 'published') AS active_properties,
  (SELECT COUNT(*) FROM properties WHERE created_at > NOW() - INTERVAL '30 days') AS new_properties_30d,
  
  -- Baux (statut au lieu de status)
  (SELECT COUNT(*) FROM leases WHERE statut = 'active') AS active_leases,
  (SELECT COUNT(*) FROM leases WHERE created_at > NOW() - INTERVAL '30 days') AS new_leases_30d,
  
  -- Facturation (statut au lieu de status)
  (SELECT COALESCE(SUM(montant_total), 0) FROM invoices WHERE statut = 'paid' AND created_at > NOW() - INTERVAL '30 days') AS revenue_30d,
  (SELECT COALESCE(SUM(montant_total), 0) FROM invoices WHERE statut = 'late') AS total_late_amount,
  
  -- Abonnements
  (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') AS active_subscriptions,
  (SELECT COALESCE(SUM(sp.price_monthly), 0) FROM subscriptions s 
   JOIN subscription_plans sp ON s.plan_id = sp.id 
   WHERE s.status = 'active') AS mrr_estimate,
  
  -- Tickets (statut au lieu de status)
  (SELECT COUNT(*) FROM tickets WHERE statut = 'open') AS open_tickets,
  (SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) 
   FROM tickets WHERE statut = 'resolved' AND updated_at > NOW() - INTERVAL '30 days') AS avg_resolution_hours;

-- Index unique sur la date de snapshot
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_kpis_date 
  ON mv_platform_kpis(snapshot_date);

-- ============================================
-- VUE: Analyse des paiements
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_payment_analytics AS
SELECT 
  DATE_TRUNC('month', p.created_at) AS month,
  p.moyen AS payment_method,
  COUNT(*) AS transaction_count,
  SUM(p.montant) AS total_amount,
  AVG(p.montant) AS avg_amount,
  COUNT(CASE WHEN p.statut = 'succeeded' THEN 1 END) AS successful_count,
  COUNT(CASE WHEN p.statut = 'failed' THEN 1 END) AS failed_count,
  ROUND(
    COUNT(CASE WHEN p.statut = 'succeeded' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2
  ) AS success_rate
FROM payments p
WHERE p.created_at > NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', p.created_at), p.moyen
ORDER BY month DESC, payment_method;

CREATE INDEX IF NOT EXISTS idx_mv_payment_analytics_month 
  ON mv_payment_analytics(month);

-- ============================================
-- VUE: Taux d'occupation par propriété
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_property_occupancy AS
SELECT 
  prop.id AS property_id,
  prop.owner_id,
  prop.type AS property_type,
  prop.ville AS city,
  COUNT(DISTINCT l.id) AS total_leases,
  COUNT(DISTINCT CASE WHEN l.statut = 'active' THEN l.id END) AS active_leases,
  COALESCE(
    EXTRACT(DAY FROM (
      SELECT SUM(
        LEAST(COALESCE(l2.date_fin, NOW()), NOW()) - 
        GREATEST(l2.date_debut, NOW() - INTERVAL '12 months')
      )
      FROM leases l2 
      WHERE l2.property_id = prop.id 
      AND l2.date_debut < NOW()
      AND (l2.date_fin IS NULL OR l2.date_fin > NOW() - INTERVAL '12 months')
    )) / 365 * 100, 0
  )::INTEGER AS occupancy_rate_12m,
  (SELECT COALESCE(SUM(i.montant_total), 0) 
   FROM invoices i 
   JOIN leases l3 ON i.lease_id = l3.id 
   WHERE l3.property_id = prop.id 
   AND i.statut = 'paid' 
   AND i.created_at > NOW() - INTERVAL '12 months'
  ) AS revenue_12m
FROM properties prop
LEFT JOIN leases l ON l.property_id = prop.id
WHERE prop.etat = 'published'
GROUP BY prop.id, prop.owner_id, prop.type, prop.ville;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_property_occupancy 
  ON mv_property_occupancy(property_id);

-- ============================================
-- VUE: Retards de paiement par locataire
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_payment_history AS
SELECT 
  tp.profile_id AS tenant_id,
  p.prenom || ' ' || p.nom AS tenant_name,
  COUNT(DISTINCT i.id) AS total_invoices,
  COUNT(DISTINCT CASE WHEN i.statut = 'paid' THEN i.id END) AS paid_invoices,
  COUNT(DISTINCT CASE WHEN i.statut = 'late' THEN i.id END) AS late_invoices,
  ROUND(
    COUNT(DISTINCT CASE WHEN i.statut = 'paid' THEN i.id END)::DECIMAL / 
    NULLIF(COUNT(DISTINCT i.id), 0) * 100, 2
  ) AS payment_rate,
  COALESCE(SUM(CASE WHEN i.statut = 'late' THEN i.montant_total ELSE 0 END), 0) AS current_late_amount
FROM tenant_profiles tp
JOIN profiles p ON p.id = tp.profile_id
LEFT JOIN invoices i ON i.tenant_id = tp.profile_id
GROUP BY tp.profile_id, p.prenom, p.nom;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_payment_history 
  ON mv_tenant_payment_history(tenant_id);

-- ============================================
-- FONCTION: Rafraîchir toutes les vues
-- ============================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_kpis;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_owner_monthly_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_payment_analytics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_occupancy;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_payment_history;
  
  RAISE NOTICE 'Toutes les vues analytics ont été rafraîchies à %', NOW();
END;
$$;

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON MATERIALIZED VIEW mv_platform_kpis IS 
  'KPIs globaux de la plateforme - rafraîchir quotidiennement';
COMMENT ON MATERIALIZED VIEW mv_owner_monthly_stats IS 
  'Statistiques mensuelles par propriétaire - rafraîchir quotidiennement';
COMMENT ON MATERIALIZED VIEW mv_payment_analytics IS 
  'Analyse des paiements par méthode et mois - rafraîchir quotidiennement';
COMMENT ON MATERIALIZED VIEW mv_property_occupancy IS 
  'Taux d''occupation par propriété - rafraîchir hebdomadairement';
COMMENT ON MATERIALIZED VIEW mv_tenant_payment_history IS 
  'Historique de paiement des locataires - rafraîchir quotidiennement';

COMMIT;

