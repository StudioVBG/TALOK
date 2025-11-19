-- RPC pour les statistiques Admin (Enrichie)
-- Récupère les KPIs détaillés pour le dashboard admin

CREATE OR REPLACE FUNCTION admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_total_users INT;
  v_users_by_role JSONB;
  v_total_properties INT;
  v_properties_by_type JSONB;
  v_total_leases INT;
  v_active_leases INT;
  v_leases_by_status JSONB;
  v_total_invoices INT;
  v_unpaid_invoices INT;
  v_invoices_by_status JSONB;
  v_total_tickets INT;
  v_open_tickets INT;
  v_tickets_by_status JSONB;
  v_total_documents INT;
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
  SELECT COUNT(*) INTO v_total_users FROM profiles;
  
  SELECT jsonb_build_object(
    'admin', COUNT(*) FILTER (WHERE role = 'admin'),
    'owner', COUNT(*) FILTER (WHERE role = 'owner'),
    'tenant', COUNT(*) FILTER (WHERE role = 'tenant'),
    'provider', COUNT(*) FILTER (WHERE role = 'provider')
  ) INTO v_users_by_role
  FROM profiles;

  -- 3. Stats Propriétés
  SELECT COUNT(*) INTO v_total_properties FROM properties;
  
  SELECT jsonb_build_object(
    'appartement', COUNT(*) FILTER (WHERE type = 'appartement'),
    'maison', COUNT(*) FILTER (WHERE type = 'maison'),
    'colocation', COUNT(*) FILTER (WHERE type = 'colocation'),
    'saisonnier', COUNT(*) FILTER (WHERE type = 'saisonnier')
  ) INTO v_properties_by_type
  FROM properties;

  -- 4. Stats Baux
  SELECT COUNT(*) INTO v_total_leases FROM leases;
  SELECT COUNT(*) INTO v_active_leases FROM leases WHERE statut = 'active';
  
  SELECT jsonb_build_object(
    'draft', COUNT(*) FILTER (WHERE statut = 'draft'),
    'pending_signature', COUNT(*) FILTER (WHERE statut = 'pending_signature'),
    'active', COUNT(*) FILTER (WHERE statut = 'active'),
    'terminated', COUNT(*) FILTER (WHERE statut = 'terminated')
  ) INTO v_leases_by_status
  FROM leases;

  -- 5. Stats Factures
  SELECT COUNT(*) INTO v_total_invoices FROM invoices;
  SELECT COUNT(*) INTO v_unpaid_invoices FROM invoices WHERE statut IN ('sent', 'late');
  
  SELECT jsonb_build_object(
    'draft', COUNT(*) FILTER (WHERE statut = 'draft'),
    'sent', COUNT(*) FILTER (WHERE statut = 'sent'),
    'paid', COUNT(*) FILTER (WHERE statut = 'paid'),
    'late', COUNT(*) FILTER (WHERE statut = 'late')
  ) INTO v_invoices_by_status
  FROM invoices;

  -- 6. Stats Tickets
  SELECT COUNT(*) INTO v_total_tickets FROM tickets;
  SELECT COUNT(*) INTO v_open_tickets FROM tickets WHERE statut = 'open';
  
  SELECT jsonb_build_object(
    'open', COUNT(*) FILTER (WHERE statut = 'open'),
    'in_progress', COUNT(*) FILTER (WHERE statut = 'in_progress'),
    'resolved', COUNT(*) FILTER (WHERE statut = 'resolved'),
    'closed', COUNT(*) FILTER (WHERE statut = 'closed')
  ) INTO v_tickets_by_status
  FROM tickets;

  -- 7. Stats Documents
  SELECT COUNT(*) INTO v_total_documents FROM documents;

  -- Assembler le résultat
  v_result := jsonb_build_object(
    'totalUsers', v_total_users,
    'usersByRole', v_users_by_role,
    'totalProperties', v_total_properties,
    'propertiesByType', v_properties_by_type,
    'totalLeases', v_total_leases,
    'activeLeases', v_active_leases,
    'leasesByStatus', v_leases_by_status,
    'totalInvoices', v_total_invoices,
    'unpaidInvoices', v_unpaid_invoices,
    'invoicesByStatus', v_invoices_by_status,
    'totalTickets', v_total_tickets,
    'openTickets', v_open_tickets,
    'ticketsByStatus', v_tickets_by_status,
    'totalDocuments', v_total_documents,
    'totalBlogPosts', 0, -- Placeholder si table blog_posts n'existe pas ou vide
    'publishedBlogPosts', 0,
    'recentActivity', '[]'::jsonb -- Placeholder pour l'instant
  );

  RETURN v_result;
END;
$$;

