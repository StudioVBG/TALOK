-- RPC pour récupérer tous les détails d'un bail en un seul appel

CREATE OR REPLACE FUNCTION lease_details(p_lease_id UUID, p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease JSONB;
  v_property JSONB;
  v_signers JSONB;
  v_payments JSONB;
  v_documents JSONB;
  v_result JSONB;
BEGIN
  -- 1. Récupérer les infos du bail
  -- On vérifie indirectement que le user est bien le propriétaire via la propriété
  SELECT to_jsonb(l) INTO v_lease
  FROM leases l
  JOIN properties p ON p.id = l.property_id
  WHERE l.id = p_lease_id AND p.owner_id = p_owner_id;

  IF v_lease IS NULL THEN
    RETURN NULL; -- Bail introuvable ou accès refusé
  END IF;

  -- 2. Récupérer la propriété liée (infos succinctes)
  SELECT jsonb_build_object(
    'id', p.id,
    'adresse_complete', p.adresse_complete,
    'ville', p.ville,
    'code_postal', p.code_postal,
    'type', p.type,
    'cover_url', (SELECT url FROM property_photos WHERE property_id = p.id AND is_main = true LIMIT 1)
  ) INTO v_property
  FROM properties p
  WHERE p.id = (v_lease->>'property_id')::UUID;

  -- 3. Récupérer les signataires (locataires, garants)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ls.id,
      'role', ls.role,
      'signature_status', ls.signature_status,
      'signed_at', ls.signed_at,
      'profile', jsonb_build_object(
        'id', pr.id,
        'prenom', pr.prenom,
        'nom', pr.nom,
        'email', au.email,
        'telephone', pr.telephone,
        'avatar_url', pr.avatar_url
      )
    )
  ) INTO v_signers
  FROM lease_signers ls
  JOIN profiles pr ON pr.id = ls.profile_id
  LEFT JOIN auth.users au ON au.id = pr.user_id
  WHERE ls.lease_id = p_lease_id;

  -- 4. Récupérer les derniers paiements (via les factures)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pm.id,
      'date_paiement', pm.date_paiement,
      'montant', pm.montant,
      'statut', pm.statut,
      'periode', i.periode
    ) ORDER BY pm.date_paiement DESC
  ) INTO v_payments
  FROM payments pm
  JOIN invoices i ON i.id = pm.invoice_id
  WHERE i.lease_id = p_lease_id
  LIMIT 12;

  -- 5. Récupérer les documents liés au bail
  SELECT jsonb_agg(to_jsonb(d)) INTO v_documents
  FROM documents d
  WHERE d.lease_id = p_lease_id;

  -- Assembler le résultat
  v_result := jsonb_build_object(
    'lease', v_lease,
    'property', v_property,
    'signers', COALESCE(v_signers, '[]'::jsonb),
    'payments', COALESCE(v_payments, '[]'::jsonb),
    'documents', COALESCE(v_documents, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

