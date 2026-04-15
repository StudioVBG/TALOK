-- ============================================================================
-- Migration : RPC transactionnelle upsert_building_with_units
--
-- Encapsule en une seule transaction SQL l'ensemble des opérations de
-- création/mise à jour d'un immeuble et de ses lots :
--   1. UPSERT du record buildings
--   2. Garde baux actifs (via building_active_lease_units)
--   3. UPSERT des properties lots (préserve les IDs existants via floor-position)
--   4. DELETE + INSERT des building_units (atomiquement dans la même fonction)
--
-- Items de l'audit adressés :
--   #4  — Transaction SQL pour POST /building-units
--   #8  — Garde baux actifs avant DELETE
--   #10 — UPDATE du `name` dans UPSERT (pas figé à la création)
--   #24 — Supprime le hardcode `meuble = studio||local_commercial`
--   #6  — Propagation loyer/charges/depot_garantie vers properties lots
--         (y compris depot_garantie qui manquait)
-- ============================================================================

-- ============================================================================
-- 1. Fonction utilitaire permanente : génération de unique_code property
--    Format : PROP-XXXX-XXXX (8 caractères random, charset alphanum majuscule)
--    Identique à lib/helpers/code-generator.ts côté app.
-- ============================================================================
CREATE OR REPLACE FUNCTION public._gen_prop_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  charset TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT;
  i INT;
  max_attempts INT := 20;
  attempt INT := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    result := 'PROP-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM properties WHERE unique_code = result);
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'gen_prop_code_max_attempts_exceeded';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public._gen_prop_code() IS
  'Génère un unique_code PROP-XXXX-XXXX unique dans la table properties.';

-- ============================================================================
-- 2. RPC transactionnelle : upsert_building_with_units
--    Signature :
--      upsert_building_with_units(
--        p_property_id UUID,          -- property wrapper (type='immeuble')
--        p_building_data JSONB,       -- champs building (tous optionnels)
--        p_units JSONB                -- array des lots (obligatoire)
--      ) RETURNS JSONB
--
--    Retour :
--      { "building_id": UUID, "unit_count": INT, "lot_property_ids": [UUID] }
--
--    Exceptions :
--      P0001 'property_not_found'      — property parent introuvable
--      P0002 'active_leases_blocking:<list>' — baux actifs bloquent le remplacement
--      23505 (unique_violation)        — contrainte UNIQUE violée (collision floor/position)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_building_with_units(
  p_property_id UUID,
  p_building_data JSONB,
  p_units JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_legal_entity_id UUID;
  v_adresse TEXT;
  v_cp TEXT;
  v_ville TEXT;
  v_dept TEXT;
  v_building_id UUID;
  v_active_count INTEGER;
  v_active_list TEXT;
  v_existing_prop_map JSONB := '{}'::JSONB;
  v_unit JSONB;
  v_key TEXT;
  v_lot_prop_id UUID;
  v_lot_prop_ids UUID[] := ARRAY[]::UUID[];
  v_new_code TEXT;
  v_floor_label TEXT;
  v_floor INTEGER;
  v_pos TEXT;
  v_type TEXT;
  v_template TEXT;
  v_unit_count INTEGER := 0;
  v_has_ascenseur BOOLEAN;
BEGIN
  -- ─── 1. Valider la property parent ────────────────────────────────────────
  SELECT owner_id, legal_entity_id, adresse_complete, code_postal, ville, departement
    INTO v_owner_id, v_legal_entity_id, v_adresse, v_cp, v_ville, v_dept
    FROM properties
   WHERE id = p_property_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'property_not_found' USING ERRCODE = 'P0001';
  END IF;

  v_has_ascenseur := COALESCE((p_building_data->>'has_ascenseur')::BOOLEAN, false);

  -- ─── 2. Upsert building ───────────────────────────────────────────────────
  SELECT id INTO v_building_id
    FROM buildings
   WHERE property_id = p_property_id
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_building_id IS NOT NULL THEN
    -- Garde baux actifs avant tout replacement
    SELECT COUNT(*), string_agg('Lot ' || "position" || ' (étage ' || floor || ')', ', ')
      INTO v_active_count, v_active_list
      FROM public.building_active_lease_units(v_building_id);

    IF v_active_count > 0 THEN
      RAISE EXCEPTION 'active_leases_blocking:%', v_active_list
        USING ERRCODE = 'P0002';
    END IF;

    -- UPDATE building (COALESCE pour ne pas écraser avec NULL si non fourni)
    UPDATE buildings SET
      name = COALESCE(NULLIF(p_building_data->>'name', ''), name),
      floors = COALESCE((p_building_data->>'floors')::INTEGER, floors),
      has_ascenseur = COALESCE((p_building_data->>'has_ascenseur')::BOOLEAN, has_ascenseur),
      has_gardien = COALESCE((p_building_data->>'has_gardien')::BOOLEAN, has_gardien),
      has_interphone = COALESCE((p_building_data->>'has_interphone')::BOOLEAN, has_interphone),
      has_digicode = COALESCE((p_building_data->>'has_digicode')::BOOLEAN, has_digicode),
      has_local_velo = COALESCE((p_building_data->>'has_local_velo')::BOOLEAN, has_local_velo),
      has_local_poubelles = COALESCE((p_building_data->>'has_local_poubelles')::BOOLEAN, has_local_poubelles),
      has_parking_commun = COALESCE((p_building_data->>'has_parking_commun')::BOOLEAN, has_parking_commun),
      has_jardin_commun = COALESCE((p_building_data->>'has_jardin_commun')::BOOLEAN, has_jardin_commun),
      ownership_type = COALESCE(NULLIF(p_building_data->>'ownership_type', ''), ownership_type),
      total_lots_in_building = CASE
        WHEN p_building_data ? 'total_lots_in_building'
             AND p_building_data->>'total_lots_in_building' IS NOT NULL
          THEN (p_building_data->>'total_lots_in_building')::INTEGER
        ELSE total_lots_in_building
      END,
      construction_year = CASE
        WHEN p_building_data ? 'construction_year'
             AND p_building_data->>'construction_year' IS NOT NULL
          THEN (p_building_data->>'construction_year')::INTEGER
        ELSE construction_year
      END,
      surface_totale = CASE
        WHEN p_building_data ? 'surface_totale'
             AND p_building_data->>'surface_totale' IS NOT NULL
          THEN (p_building_data->>'surface_totale')::DECIMAL
        ELSE surface_totale
      END,
      notes = COALESCE(p_building_data->>'notes', notes),
      updated_at = NOW()
    WHERE id = v_building_id;
  ELSE
    -- INSERT building
    INSERT INTO buildings (
      owner_id, property_id, name,
      adresse_complete, code_postal, ville, departement,
      floors,
      has_ascenseur, has_gardien, has_interphone, has_digicode,
      has_local_velo, has_local_poubelles, has_parking_commun, has_jardin_commun,
      ownership_type, total_lots_in_building,
      construction_year, surface_totale, notes
    ) VALUES (
      v_owner_id, p_property_id,
      COALESCE(NULLIF(p_building_data->>'name', ''), LEFT(COALESCE(v_adresse, 'Immeuble'), 200)),
      v_adresse, v_cp, v_ville, v_dept,
      COALESCE((p_building_data->>'floors')::INTEGER, 1),
      COALESCE((p_building_data->>'has_ascenseur')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_gardien')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_interphone')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_digicode')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_local_velo')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_local_poubelles')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_parking_commun')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_jardin_commun')::BOOLEAN, false),
      COALESCE(NULLIF(p_building_data->>'ownership_type', ''), 'full'),
      NULLIF(p_building_data->>'total_lots_in_building', '')::INTEGER,
      NULLIF(p_building_data->>'construction_year', '')::INTEGER,
      NULLIF(p_building_data->>'surface_totale', '')::DECIMAL,
      NULLIF(p_building_data->>'notes', '')
    )
    RETURNING id INTO v_building_id;
  END IF;

  -- ─── 3. Map des property_id existantes par floor-position ─────────────────
  SELECT COALESCE(
           jsonb_object_agg(floor::TEXT || '-' || position, property_id),
           '{}'::JSONB
         )
    INTO v_existing_prop_map
    FROM building_units
   WHERE building_id = v_building_id
     AND property_id IS NOT NULL
     AND deleted_at IS NULL;

  -- ─── 4. DELETE des building_units (les properties lots restent) ───────────
  DELETE FROM building_units WHERE building_id = v_building_id;

  -- ─── 5. Pour chaque unit du payload : upsert property lot + insert unit ───
  FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units) LOOP
    v_floor := (v_unit->>'floor')::INTEGER;
    v_pos := v_unit->>'position';
    v_type := v_unit->>'type';
    v_template := NULLIF(lower(COALESCE(v_unit->>'template', '')), '');
    v_key := v_floor::TEXT || '-' || v_pos;

    -- Label étage
    IF v_floor < 0 THEN v_floor_label := 'SS' || abs(v_floor);
    ELSIF v_floor = 0 THEN v_floor_label := 'RDC';
    ELSE v_floor_label := 'Étage ' || v_floor;
    END IF;

    v_lot_prop_id := NULL;
    IF v_existing_prop_map ? v_key THEN
      v_lot_prop_id := (v_existing_prop_map->>v_key)::UUID;

      -- UPDATE property lot existante
      -- meuble : on respecte le payload si fourni, sinon on garde la valeur actuelle
      UPDATE properties SET
        type = v_type,
        surface = (v_unit->>'surface')::DECIMAL,
        nb_pieces = (v_unit->>'nb_pieces')::INTEGER,
        loyer_hc = (v_unit->>'loyer_hc')::DECIMAL,
        charges_mensuelles = (v_unit->>'charges')::DECIMAL,
        depot_garantie = (v_unit->>'depot_garantie')::DECIMAL,
        meuble = CASE
          WHEN v_unit ? 'meuble' AND v_unit->>'meuble' IS NOT NULL
            THEN (v_unit->>'meuble')::BOOLEAN
          ELSE meuble
        END,
        ascenseur = v_has_ascenseur,
        adresse_complete = COALESCE(v_adresse, '')
                           || ' - Lot ' || v_pos
                           || ', ' || v_floor_label,
        updated_at = NOW()
      WHERE id = v_lot_prop_id;
    ELSE
      -- INSERT property lot
      v_new_code := public._gen_prop_code();

      INSERT INTO properties (
        owner_id, legal_entity_id, parent_property_id,
        type, etat, unique_code,
        adresse_complete, code_postal, ville, departement,
        surface, nb_pieces, nb_chambres,
        ascenseur, meuble,
        loyer_hc, charges_mensuelles, depot_garantie
      ) VALUES (
        v_owner_id, v_legal_entity_id, p_property_id,
        v_type, 'published', v_new_code,
        COALESCE(v_adresse, '') || ' - Lot ' || v_pos || ', ' || v_floor_label,
        COALESCE(v_cp, ''), COALESCE(v_ville, ''), COALESCE(v_dept, ''),
        (v_unit->>'surface')::DECIMAL,
        (v_unit->>'nb_pieces')::INTEGER,
        0,
        v_has_ascenseur,
        COALESCE((v_unit->>'meuble')::BOOLEAN, false),
        (v_unit->>'loyer_hc')::DECIMAL,
        (v_unit->>'charges')::DECIMAL,
        (v_unit->>'depot_garantie')::DECIMAL
      )
      RETURNING id INTO v_lot_prop_id;
    END IF;

    -- INSERT building_unit
    INSERT INTO building_units (
      building_id, floor, position, type, template,
      surface, nb_pieces,
      loyer_hc, charges, depot_garantie,
      status, property_id
    ) VALUES (
      v_building_id, v_floor, v_pos, v_type, v_template,
      (v_unit->>'surface')::DECIMAL,
      (v_unit->>'nb_pieces')::INTEGER,
      (v_unit->>'loyer_hc')::DECIMAL,
      (v_unit->>'charges')::DECIMAL,
      (v_unit->>'depot_garantie')::DECIMAL,
      COALESCE(NULLIF(v_unit->>'status', ''), 'vacant'),
      v_lot_prop_id
    );

    v_lot_prop_ids := array_append(v_lot_prop_ids, v_lot_prop_id);
    v_unit_count := v_unit_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'building_id', v_building_id,
    'unit_count', v_unit_count,
    'lot_property_ids', to_jsonb(v_lot_prop_ids)
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_building_with_units(UUID, JSONB, JSONB) IS
  'Upsert atomique d''un immeuble + lots + properties lots. Refuse si au moins un lot a un bail bloquant. Renvoie { building_id, unit_count, lot_property_ids }.';
