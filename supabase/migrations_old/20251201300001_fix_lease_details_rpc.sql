-- Corriger la RPC lease_details pour gérer les baux liés à des unités
-- et améliorer la récupération des données

CREATE OR REPLACE FUNCTION lease_details(p_lease_id UUID, p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease JSONB;
  v_property_id UUID;
  v_property JSONB;
  v_signers JSONB;
  v_payments JSONB;
  v_documents JSONB;
  v_result JSONB;
BEGIN
  -- 1. Récupérer les infos du bail
  SELECT to_jsonb(l), l.property_id, 
         CASE WHEN l.unit_id IS NOT NULL THEN 
           (SELECT u.property_id FROM units u WHERE u.id = l.unit_id)
         ELSE l.property_id END
  INTO v_lease, v_property_id, v_property_id
  FROM leases l
  WHERE l.id = p_lease_id;

  IF v_lease IS NULL THEN
    RAISE NOTICE 'lease_details: Bail introuvable pour id=%', p_lease_id;
    RETURN NULL;
  END IF;

  -- Récupérer le property_id (direct ou via unit)
  IF v_property_id IS NULL THEN
    SELECT u.property_id INTO v_property_id
    FROM units u
    WHERE u.id = (v_lease->>'unit_id')::UUID;
  END IF;

  IF v_property_id IS NULL THEN
    RAISE NOTICE 'lease_details: Pas de property_id trouvé pour lease=%', p_lease_id;
    RETURN NULL;
  END IF;

  -- 2. Vérifier que la propriété appartient au propriétaire
  IF NOT EXISTS (
    SELECT 1 FROM properties p 
    WHERE p.id = v_property_id AND p.owner_id = p_owner_id
  ) THEN
    RAISE NOTICE 'lease_details: Accès refusé - owner_id ne correspond pas pour property=%', v_property_id;
    RETURN NULL;
  END IF;

  -- 3. Récupérer la propriété liée (infos succinctes)
  SELECT jsonb_build_object(
    'id', p.id,
    'adresse_complete', COALESCE(p.adresse_complete, p.adresse, ''),
    'ville', COALESCE(p.ville, ''),
    'code_postal', COALESCE(p.code_postal, ''),
    'type', COALESCE(p.type, ''),
    'cover_url', (SELECT url FROM property_photos WHERE property_id = p.id AND is_main = true LIMIT 1)
  ) INTO v_property
  FROM properties p
  WHERE p.id = v_property_id;

  -- 4. Récupérer les signataires (locataires, garants)
  SELECT COALESCE(jsonb_agg(
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
  ), '[]'::jsonb) INTO v_signers
  FROM lease_signers ls
  JOIN profiles pr ON pr.id = ls.profile_id
  LEFT JOIN auth.users au ON au.id = pr.user_id
  WHERE ls.lease_id = p_lease_id;

  -- 5. Récupérer les derniers paiements (via les factures)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', pm.id,
      'date_paiement', pm.date_paiement,
      'montant', pm.montant,
      'statut', pm.statut,
      'periode', i.periode
    ) ORDER BY pm.date_paiement DESC
  ), '[]'::jsonb) INTO v_payments
  FROM payments pm
  JOIN invoices i ON i.id = pm.invoice_id
  WHERE i.lease_id = p_lease_id;

  -- 6. Récupérer les documents liés au bail
  SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb) INTO v_documents
  FROM documents d
  WHERE d.lease_id = p_lease_id;

  -- Assembler le résultat
  v_result := jsonb_build_object(
    'lease', v_lease,
    'property', v_property,
    'signers', v_signers,
    'payments', v_payments,
    'documents', v_documents
  );

  RETURN v_result;
END;
$$;

-- Ajouter un commentaire pour documentation
COMMENT ON FUNCTION lease_details(UUID, UUID) IS 'Récupère tous les détails d''un bail pour un propriétaire, incluant property via unit_id si nécessaire';

