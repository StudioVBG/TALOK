-- Migration : Support des baux multiples pour les locataires
-- Un locataire peut avoir plusieurs baux (ex: appartement + parking)

-- ============================================
-- 1. MISE À JOUR RPC TENANT_DASHBOARD
-- ============================================

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_leases JSONB;
  v_properties JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_stats JSONB;
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil à partir du user_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_tenant_user_id;

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Récupérer TOUS les baux actifs ou en attente (plus de LIMIT 1!)
  SELECT COALESCE(jsonb_agg(lease_data ORDER BY lease_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_leases
  FROM (
    SELECT jsonb_build_object(
      'id', l.id,
      'property_id', l.property_id,
      'type_bail', l.type_bail,
      'loyer', l.loyer,
      'charges_forfaitaires', l.charges_forfaitaires,
      'depot_de_garantie', l.depot_de_garantie,
      'date_debut', l.date_debut,
      'date_fin', l.date_fin,
      'statut', l.statut,
      'created_at', l.created_at,
      -- Infos propriété jointes
      'property', jsonb_build_object(
        'id', p.id,
        'adresse_complete', p.adresse_complete,
        'ville', p.ville,
        'code_postal', p.code_postal,
        'type', p.type,
        'surface', p.surface,
        'nb_pieces', p.nb_pieces,
        'parking_numero', p.parking_numero,
        'cover_url', p.cover_url
      ),
      -- Infos propriétaire
      'owner', jsonb_build_object(
        'id', owner_profile.id,
        'name', CONCAT(owner_profile.prenom, ' ', owner_profile.nom),
        'email', (SELECT email FROM auth.users WHERE id = owner_profile.user_id)
      )
    ) as lease_data
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner_profile ON owner_profile.id = p.owner_id
    WHERE ls.profile_id = v_profile_id
    AND l.statut IN ('active', 'pending_signature', 'fully_signed')
  ) sub;

  -- 3. Extraire les propriétés uniques (pour rétro-compatibilité)
  SELECT COALESCE(jsonb_agg(DISTINCT prop), '[]'::jsonb)
  INTO v_properties
  FROM (
    SELECT lease_item->'property' as prop
    FROM jsonb_array_elements(v_leases) as lease_item
  ) sub;

  -- 4. Récupérer les dernières factures (toutes propriétés confondues)
  SELECT COALESCE(jsonb_agg(invoice_data ORDER BY invoice_data->>'periode' DESC), '[]'::jsonb)
  INTO v_invoices
  FROM (
    SELECT jsonb_build_object(
      'id', i.id,
      'lease_id', i.lease_id,
      'periode', i.periode,
      'montant_total', i.montant_total,
      'montant_loyer', i.montant_loyer,
      'montant_charges', i.montant_charges,
      'statut', i.statut,
      'due_date', i.due_date,
      -- Info propriété pour identifier le bien
      'property_type', p.type,
      'property_address', p.adresse_complete
    ) as invoice_data
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN properties p ON p.id = l.property_id
    WHERE i.tenant_id = v_profile_id
    ORDER BY i.periode DESC
    LIMIT 10
  ) sub;

  -- 5. Récupérer les tickets récents (tous biens)
  SELECT COALESCE(jsonb_agg(ticket_data ORDER BY ticket_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_tickets
  FROM (
    SELECT jsonb_build_object(
      'id', t.id,
      'titre', t.titre,
      'description', t.description,
      'priorite', t.priorite,
      'statut', t.statut,
      'created_at', t.created_at,
      'property_id', t.property_id,
      'property_address', p.adresse_complete,
      'property_type', p.type
    ) as ticket_data
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 5
  ) sub;

  -- 6. Stats consolidées (tous baux)
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(montant_total), 0),
    'unpaid_count', COUNT(*),
    'total_monthly_rent', (
      SELECT COALESCE(SUM(l.loyer + l.charges_forfaitaires), 0)
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = v_profile_id
      AND l.statut = 'active'
    ),
    'active_leases_count', (
      SELECT COUNT(DISTINCT l.id)
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = v_profile_id
      AND l.statut = 'active'
    )
  ) INTO v_stats
  FROM invoices
  WHERE tenant_id = v_profile_id
  AND statut IN ('sent', 'late');

  -- Assembler le résultat (nouveau format + rétro-compatibilité)
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    -- NOUVEAU : tableau de baux
    'leases', v_leases,
    'properties', v_properties,
    -- RÉTRO-COMPATIBILITÉ : premier bail et propriété (pour code existant)
    'lease', CASE WHEN jsonb_array_length(v_leases) > 0 THEN v_leases->0 ELSE NULL END,
    'property', CASE WHEN jsonb_array_length(v_properties) > 0 THEN v_properties->0 ELSE NULL END,
    -- Données communes
    'invoices', v_invoices,
    'tickets', v_tickets,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- ============================================
-- 2. INDEX POUR PERFORMANCE
-- ============================================

-- Index sur lease_signers pour recherches par profil
CREATE INDEX IF NOT EXISTS idx_lease_signers_profile_lease 
ON lease_signers(profile_id, lease_id);

-- Index sur invoices pour recherches par tenant
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_statut 
ON invoices(tenant_id, statut);

-- ============================================
-- 3. COMMENTAIRES
-- ============================================

COMMENT ON FUNCTION tenant_dashboard(UUID) IS 
'Dashboard locataire avec support multi-baux.
Retourne:
- leases: tableau de tous les baux actifs/en attente
- properties: tableau des propriétés associées
- lease/property: premier bail/propriété (rétro-compatibilité)
- invoices: factures avec info propriété
- tickets: tickets avec info propriété
- stats: stats consolidées (loyer total, nb baux actifs, impayés)';

