-- Migration : Fonctions RPC pour optimiser les requêtes Owner
-- Réduit les appels API en batchant les requêtes

-- ============================================
-- 1. Fonction owner_dashboard
-- ============================================
-- Retourne toutes les données nécessaires pour le dashboard owner en une seule requête

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
          'ref', p.ref,
          'adresse', p.adresse,
          'statut', p.statut,
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
        'active', COUNT(*) FILTER (WHERE statut = 'active'),
        'draft', COUNT(*) FILTER (WHERE statut = 'draft')
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
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- Commentaire
COMMENT ON FUNCTION owner_dashboard(UUID) IS 
'Retourne toutes les données du dashboard owner en une seule requête. Réduit les appels API de ~10 à 1.';

-- ============================================
-- 2. Fonction property_details
-- ============================================
-- Retourne une propriété avec toutes ses relations

CREATE OR REPLACE FUNCTION property_details(p_property_id UUID, p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Vérifier que la propriété appartient au propriétaire
  IF NOT EXISTS (
    SELECT 1 FROM properties 
    WHERE id = p_property_id 
    AND owner_id = p_owner_id
  ) THEN
    RAISE EXCEPTION 'Propriété non trouvée ou accès non autorisé';
  END IF;

  SELECT jsonb_build_object(
    'property', (
      SELECT row_to_json(p.*)
      FROM properties p
      WHERE p.id = p_property_id
    ),
    'leases', (
      SELECT jsonb_agg(row_to_json(l.*))
      FROM leases l
      WHERE l.property_id = p_property_id
    ),
    'tickets', (
      SELECT jsonb_agg(row_to_json(t.*))
      FROM tickets t
      WHERE t.property_id = p_property_id
      ORDER BY t.created_at DESC
    ),
    'documents', (
      SELECT jsonb_agg(row_to_json(d.*))
      FROM documents d
      WHERE d.property_id = p_property_id
      ORDER BY d.created_at DESC
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION property_details(UUID, UUID) IS 
'Retourne une propriété avec toutes ses relations (baux, tickets, documents) en une seule requête.';

-- ============================================
-- 3. Indexes pour optimiser les performances
-- ============================================

-- Index sur owner_id pour properties (si pas déjà présent)
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_statut ON properties(statut);

-- Index sur property_id pour leases (si pas déjà présent)
CREATE INDEX IF NOT EXISTS idx_leases_property_id ON leases(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_statut ON leases(statut);

-- Index sur owner_id pour invoices (si pas déjà présent)
CREATE INDEX IF NOT EXISTS idx_invoices_owner_id ON invoices(owner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_statut ON invoices(statut);

-- Index sur property_id pour tickets (si pas déjà présent)
CREATE INDEX IF NOT EXISTS idx_tickets_property_id ON tickets(property_id);
CREATE INDEX IF NOT EXISTS idx_tickets_statut ON tickets(statut);

