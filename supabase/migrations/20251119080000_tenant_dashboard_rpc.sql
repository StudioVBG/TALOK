-- RPC pour le dashboard locataire
-- Récupère toutes les infos essentielles en un appel

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_lease JSONB;
  v_property JSONB;
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

  -- 2. Récupérer le bail actif (ou le plus récent)
  SELECT to_jsonb(l) INTO v_lease
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = v_profile_id
  AND l.statut IN ('active', 'pending_signature')
  ORDER BY l.created_at DESC
  LIMIT 1;

  -- 3. Si bail trouvé, récupérer la propriété
  IF v_lease IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', p.id,
      'adresse_complete', p.adresse_complete,
      'ville', p.ville,
      'code_postal', p.code_postal,
      'type', p.type,
      'cover_url', (SELECT url FROM property_photos WHERE property_id = p.id AND is_main = true LIMIT 1),
      'owner_name', (SELECT concat(pr.prenom, ' ', pr.nom) FROM profiles pr WHERE pr.id = p.owner_id)
    ) INTO v_property
    FROM properties p
    WHERE p.id = (v_lease->>'property_id')::UUID;
  END IF;

  -- 4. Récupérer les dernières factures (3 dernières)
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.periode DESC) INTO v_invoices
  FROM invoices i
  WHERE i.tenant_id = v_profile_id
  LIMIT 3;

  -- 5. Récupérer les tickets récents
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) INTO v_tickets
  FROM tickets t
  WHERE t.created_by_profile_id = v_profile_id
  LIMIT 3;

  -- 6. Stats rapides (solde dû)
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(montant_total), 0),
    'unpaid_count', COUNT(*)
  ) INTO v_stats
  FROM invoices
  WHERE tenant_id = v_profile_id
  AND statut IN ('sent', 'late');

  -- Assembler le résultat
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'lease', v_lease,
    'property', v_property,
    'invoices', COALESCE(v_invoices, '[]'::jsonb),
    'tickets', COALESCE(v_tickets, '[]'::jsonb),
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

