-- RPC pour les statistiques Admin
-- Récupère les KPIs globaux de la plateforme

CREATE OR REPLACE FUNCTION admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_users_stats JSONB;
  v_properties_stats JSONB;
  v_financial_stats JSONB;
  v_tickets_stats JSONB;
  v_result JSONB;
BEGIN
  -- 1. Vérifier que l'utilisateur est admin
  v_user_id := auth.uid();
  
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_user_id
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Accès refusé : réservé aux administrateurs';
  END IF;

  -- 2. Stats Utilisateurs
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'owners', COUNT(*) FILTER (WHERE role = 'owner'),
    'tenants', COUNT(*) FILTER (WHERE role = 'tenant'),
    'providers', COUNT(*) FILTER (WHERE role = 'provider')
  ) INTO v_users_stats
  FROM profiles;

  -- 3. Stats Propriétés
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE statut = 'active' OR statut = 'loue'),
    'vacant', COUNT(*) FILTER (WHERE statut = 'vacant' OR statut = 'published'), -- Ajuster selon enum réel
    'draft', COUNT(*) FILTER (WHERE statut = 'draft' OR statut = 'brouillon')
  ) INTO v_properties_stats
  FROM properties;

  -- 4. Stats Financières (Mois courant)
  -- Somme des factures payées ce mois-ci
  SELECT jsonb_build_object(
    'monthly_revenue', COALESCE(SUM(montant_total), 0),
    'pending_revenue', COALESCE(SUM(montant_total) FILTER (WHERE statut = 'sent'), 0)
  ) INTO v_financial_stats
  FROM invoices
  WHERE periode = to_char(now(), 'YYYY-MM'); -- Format YYYY-MM supposé

  -- 5. Stats Tickets
  SELECT jsonb_build_object(
    'open', COUNT(*) FILTER (WHERE statut = 'open'),
    'in_progress', COUNT(*) FILTER (WHERE statut = 'in_progress')
  ) INTO v_tickets_stats
  FROM tickets;

  -- Assembler le résultat
  v_result := jsonb_build_object(
    'users', v_users_stats,
    'properties', v_properties_stats,
    'financial', v_financial_stats,
    'tickets', v_tickets_stats
  );

  RETURN v_result;
END;
$$;

