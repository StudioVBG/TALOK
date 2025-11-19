-- RPC pour récupérer tous les détails d'une propriété en un seul appel
-- Optimise le chargement de la page détails propriété

CREATE OR REPLACE FUNCTION property_details(p_property_id UUID, p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property JSONB;
  v_units JSONB;
  v_leases JSONB;
  v_tickets JSONB;
  v_invoices JSONB;
  v_photos JSONB;
  v_result JSONB;
BEGIN
  -- 1. Récupérer les infos de la propriété (sécurisé par owner_id)
  SELECT to_jsonb(p) INTO v_property
  FROM properties p
  WHERE p.id = p_property_id AND p.owner_id = p_owner_id;

  IF v_property IS NULL THEN
    RETURN NULL; -- Propriété introuvable ou accès refusé
  END IF;

  -- 2. Récupérer les unités (si colocation/immeuble)
  SELECT jsonb_agg(to_jsonb(u)) INTO v_units
  FROM units u
  WHERE u.property_id = p_property_id;

  -- 3. Récupérer les baux avec leurs locataires
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'type_bail', l.type_bail,
      'statut', l.statut,
      'date_debut', l.date_debut,
      'date_fin', l.date_fin,
      'loyer', l.loyer,
      'charges', l.charges_forfaitaires,
      'unit_id', l.unit_id,
      'tenants', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pr.id,
            'prenom', pr.prenom,
            'nom', pr.nom,
            'email', au.email,
            'role', ls.role
          )
        )
        FROM lease_signers ls
        JOIN profiles pr ON pr.id = ls.profile_id
        LEFT JOIN auth.users au ON au.id = pr.user_id
        WHERE ls.lease_id = l.id AND ls.role IN ('locataire_principal', 'colocataire')
      )
    )
  ) INTO v_leases
  FROM leases l
  WHERE l.property_id = p_property_id
  AND l.statut IN ('active', 'pending_signature', 'draft');

  -- 4. Récupérer les tickets récents (ouverts ou en cours)
  SELECT jsonb_agg(to_jsonb(t)) INTO v_tickets
  FROM tickets t
  WHERE t.property_id = p_property_id
  AND t.statut IN ('open', 'in_progress')
  ORDER BY t.created_at DESC
  LIMIT 5;

  -- 5. Récupérer les dernières factures (3 dernières)
  SELECT jsonb_agg(to_jsonb(i)) INTO v_invoices
  FROM invoices i
  JOIN leases l ON l.id = i.lease_id
  WHERE l.property_id = p_property_id
  ORDER BY i.created_at DESC
  LIMIT 3;
  
  -- 6. Récupérer les photos
  SELECT jsonb_agg(to_jsonb(ph) ORDER BY ph.ordre ASC, ph.is_main DESC) INTO v_photos
  FROM property_photos ph
  WHERE ph.property_id = p_property_id;

  -- Assembler le résultat
  v_result := jsonb_build_object(
    'property', v_property,
    'units', COALESCE(v_units, '[]'::jsonb),
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'tickets', COALESCE(v_tickets, '[]'::jsonb),
    'invoices', COALESCE(v_invoices, '[]'::jsonb),
    'photos', COALESCE(v_photos, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- Ajouter un index composite pour accélérer les jointures fréquentes sur properties
CREATE INDEX IF NOT EXISTS idx_leases_property_status ON leases(property_id, statut);
CREATE INDEX IF NOT EXISTS idx_tickets_property_status ON tickets(property_id, statut);

