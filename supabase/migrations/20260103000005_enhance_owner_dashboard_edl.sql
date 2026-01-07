-- Enhance owner_dashboard RPC to include EDL stats and pending signatures for the owner

CREATE OR REPLACE FUNCTION owner_dashboard(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Vérifier que l'utilisateur est bien le propriétaire
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_owner_id 
    AND role = 'owner'
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  SELECT jsonb_build_object(
    'properties', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'ref', p.unique_code,
          'adresse', p.adresse_complete,
          'statut', p.etat,
          'type', p.type,
          'surface', p.surface,
          'nb_pieces', p.nb_pieces,
          'created_at', p.created_at,
          'updated_at', p.updated_at
        )
      )
      FROM properties p
      WHERE p.owner_id = p_owner_id
    ),
    'properties_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE etat = 'published'),
        'draft', COUNT(*) FILTER (WHERE etat = 'draft')
      )
      FROM properties
      WHERE owner_id = p_owner_id
    ),
    'leases', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'property_id', l.property_id,
          'type_bail', l.type_bail,
          'loyer', l.loyer,
          'date_debut', l.date_debut,
          'date_fin', l.date_fin,
          'statut', l.statut,
          'created_at', l.created_at
        )
      )
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'leases_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE l.statut = 'active'),
        'pending', COUNT(*) FILTER (WHERE l.statut = 'pending_signature')
      )
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'edl_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending_owner_signature', COUNT(*) FILTER (
          WHERE e.status = 'completed' AND NOT EXISTS (
            SELECT 1 FROM edl_signatures es 
            WHERE es.edl_id = e.id 
            AND es.signer_role = 'owner' 
            AND es.signed_at IS NOT NULL
          )
        )
      )
      FROM edl e
      INNER JOIN leases l ON l.id = e.lease_id
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'invoices', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'lease_id', i.lease_id,
          'periode', i.periode,
          'montant_total', i.montant_total,
          'statut', i.statut,
          'created_at', i.created_at
        )
      )
      FROM invoices i
      WHERE i.owner_id = p_owner_id
      ORDER BY i.created_at DESC
      LIMIT 10
    ),
    'invoices_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'paid', COUNT(*) FILTER (WHERE statut = 'paid'),
        'pending', COUNT(*) FILTER (WHERE statut = 'sent'),
        'late', COUNT(*) FILTER (WHERE statut = 'late')
      )
      FROM invoices
      WHERE owner_id = p_owner_id
    ),
    'tickets', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'property_id', t.property_id,
          'titre', t.titre,
          'priorite', t.priorite,
          'statut', t.statut,
          'created_at', t.created_at
        )
      )
      FROM tickets t
      INNER JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
      ORDER BY t.created_at DESC
      LIMIT 10
    ),
    'tickets_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'open', COUNT(*) FILTER (WHERE t.statut = 'open'),
        'in_progress', COUNT(*) FILTER (WHERE t.statut = 'in_progress')
      )
      FROM tickets t
      INNER JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'recentActivity', (
      SELECT jsonb_agg(act) FROM (
        -- Nouvelles factures
        SELECT 'invoice' as type, 'Facture générée - ' || i.periode as title, i.created_at::text as date
        FROM invoices i WHERE i.owner_id = p_owner_id
        UNION ALL
        -- Nouveaux tickets
        SELECT 'ticket' as type, 'Nouveau ticket: ' || t.titre as title, t.created_at::text as date
        FROM tickets t INNER JOIN properties p ON p.id = t.property_id WHERE p.owner_id = p_owner_id
        UNION ALL
        -- Nouvelles signatures
        SELECT 'signature' as type, 'Bail signé - ' || p.adresse_complete as title, l.updated_at::text as date
        FROM leases l INNER JOIN properties p ON p.id = l.property_id WHERE p.owner_id = p_owner_id AND l.statut = 'active'
        ORDER BY date DESC
        LIMIT 10
      ) act
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

