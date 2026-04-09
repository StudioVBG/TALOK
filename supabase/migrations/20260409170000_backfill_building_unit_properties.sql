-- ============================================
-- Migration : Backfill lots d'immeubles existants
-- Crée les properties individuelles pour les building_units
-- qui n'ont pas encore de property_id (immeubles créés avant Sprint 1)
-- ============================================

-- Fonction utilitaire pour générer un unique_code au format PROP-XXXX-XXXX
CREATE OR REPLACE FUNCTION generate_property_unique_code()
RETURNS TEXT AS $$
DECLARE
  charset TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT := 'PROP-';
  i INT;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
  END LOOP;
  -- Vérifier l'unicité, re-générer si collision
  WHILE EXISTS (SELECT 1 FROM properties WHERE unique_code = result) LOOP
    result := 'PROP-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Backfill : créer une property par lot sans property_id
-- ============================================
DO $$
DECLARE
  rec RECORD;
  new_property_id UUID;
  new_code TEXT;
  parent_prop RECORD;
  lot_address TEXT;
  floor_label TEXT;
  is_meuble BOOLEAN;
BEGIN
  -- Parcourir tous les building_units sans property_id
  FOR rec IN
    SELECT
      bu.id AS unit_id,
      bu.building_id,
      bu.floor,
      bu.position,
      bu.type,
      bu.surface,
      bu.nb_pieces,
      bu.loyer_hc,
      bu.charges,
      bu.depot_garantie,
      bu.status,
      b.property_id AS parent_property_id,
      b.has_ascenseur
    FROM building_units bu
    JOIN buildings b ON b.id = bu.building_id
    WHERE bu.property_id IS NULL
      AND b.property_id IS NOT NULL
  LOOP
    -- Récupérer les infos de la property parent (immeuble)
    SELECT
      p.owner_id,
      p.legal_entity_id,
      p.adresse_complete,
      p.code_postal,
      p.ville,
      p.departement,
      p.etat
    INTO parent_prop
    FROM properties p
    WHERE p.id = rec.parent_property_id;

    -- Skip si la property parent n'existe pas
    IF parent_prop IS NULL THEN
      RAISE NOTICE 'Skipping unit % — parent property % not found',
        rec.unit_id, rec.parent_property_id;
      CONTINUE;
    END IF;

    -- Construire le label d'étage
    IF rec.floor < 0 THEN
      floor_label := 'SS' || abs(rec.floor);
    ELSIF rec.floor = 0 THEN
      floor_label := 'RDC';
    ELSE
      floor_label := 'Étage ' || rec.floor;
    END IF;

    -- Construire l'adresse du lot
    lot_address := COALESCE(parent_prop.adresse_complete, '') ||
      ' - Lot ' || rec.position || ', ' || floor_label;

    -- Déterminer si meublé
    is_meuble := rec.type IN ('studio', 'local_commercial');

    -- Générer un unique_code
    new_code := generate_property_unique_code();

    -- Créer la property indépendante pour ce lot
    INSERT INTO properties (
      owner_id,
      legal_entity_id,
      parent_property_id,
      type,
      etat,
      unique_code,
      adresse_complete,
      code_postal,
      ville,
      departement,
      surface,
      nb_pieces,
      nb_chambres,
      ascenseur,
      meuble,
      loyer_hc,
      charges_mensuelles
    ) VALUES (
      parent_prop.owner_id,
      parent_prop.legal_entity_id,
      rec.parent_property_id,
      rec.type,
      CASE WHEN parent_prop.etat = 'published' THEN 'published' ELSE 'draft' END,
      new_code,
      lot_address,
      COALESCE(parent_prop.code_postal, ''),
      COALESCE(parent_prop.ville, ''),
      COALESCE(parent_prop.departement, ''),
      rec.surface,
      rec.nb_pieces,
      0,
      COALESCE(rec.has_ascenseur, false),
      is_meuble,
      COALESCE(rec.loyer_hc, 0),
      COALESCE(rec.charges, 0)
    )
    RETURNING id INTO new_property_id;

    -- Lier le building_unit à la nouvelle property
    UPDATE building_units
    SET property_id = new_property_id
    WHERE id = rec.unit_id;

    RAISE NOTICE 'Created property % for unit % (Lot %, %)',
      new_property_id, rec.unit_id, rec.position, floor_label;
  END LOOP;

  -- ============================================
  -- Backfill parent_property_id pour lots existants
  -- (cas où des properties lots existent déjà via building_units.property_id
  --  mais n'ont pas encore parent_property_id)
  -- ============================================
  UPDATE properties p
  SET parent_property_id = b.property_id
  FROM building_units bu
  JOIN buildings b ON b.id = bu.building_id
  WHERE bu.property_id = p.id
    AND p.parent_property_id IS NULL
    AND b.property_id IS NOT NULL
    AND b.property_id != p.id;

  RAISE NOTICE 'Backfill terminé.';
END;
$$;

-- Nettoyage : supprimer la fonction utilitaire
DROP FUNCTION IF EXISTS generate_property_unique_code();
