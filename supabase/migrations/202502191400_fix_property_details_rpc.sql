-- Migration: Création de la fonction RPC property_details pour le dashboard propriétaire
-- Cette fonction agrège toutes les données d'une propriété en un seul appel pour la performance

BEGIN;

CREATE OR REPLACE FUNCTION property_details(p_property_id UUID, p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_property JSONB;
  v_units JSONB;
  v_leases JSONB;
  v_tickets JSONB;
  v_invoices JSONB;
  v_photos JSONB;
BEGIN
  -- 1. Vérifier l'appartenance et récupérer la propriété
  SELECT to_jsonb(p) INTO v_property
  FROM properties p
  WHERE p.id = p_property_id AND p.owner_id = p_owner_id;

  IF v_property IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Récupérer les unités (si colocation/multi)
  SELECT jsonb_agg(to_jsonb(u)) INTO v_units
  FROM units u
  WHERE u.property_id = p_property_id;

  -- 3. Récupérer les baux avec les locataires
  SELECT jsonb_agg(
    to_jsonb(l) || jsonb_build_object(
      'tenants', (
        SELECT jsonb_agg(to_jsonb(prof))
        FROM lease_signers ls
        JOIN profiles prof ON prof.id = ls.profile_id
        WHERE ls.lease_id = l.id AND ls.role IN ('locataire_principal', 'colocataire')
      )
    )
  ) INTO v_leases
  FROM leases l
  WHERE l.property_id = p_property_id;

  -- 4. Récupérer les tickets
  SELECT jsonb_agg(to_jsonb(t)) INTO v_tickets
  FROM tickets t
  WHERE t.property_id = p_property_id
  ORDER BY t.created_at DESC
  LIMIT 10;

  -- 5. Récupérer les dernières factures (via les baux)
  SELECT jsonb_agg(to_jsonb(i)) INTO v_invoices
  FROM invoices i
  WHERE i.lease_id IN (SELECT id FROM leases WHERE property_id = p_property_id)
  ORDER BY i.created_at DESC
  LIMIT 10;

  -- 6. Récupérer les photos
  SELECT jsonb_agg(to_jsonb(ph)) INTO v_photos
  FROM photos ph
  WHERE ph.property_id = p_property_id
  ORDER BY ph.is_main DESC, ph.ordre ASC;

  -- Construire la réponse finale
  RETURN jsonb_build_object(
    'property', v_property,
    'units', COALESCE(v_units, '[]'::jsonb),
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'tickets', COALESCE(v_tickets, '[]'::jsonb),
    'invoices', COALESCE(v_invoices, '[]'::jsonb),
    'photos', COALESCE(v_photos, '[]'::jsonb)
  );
END;
$$;

COMMIT;

