-- Migration : ajout des types de propriété studio et box
-- Studio : petit logement d'une pièce (type appartement)
-- Box : garage fermé / box de stockage

BEGIN;

-- Mettre à jour la contrainte des types de propriété
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_type_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_type_check
  CHECK (
    type IN (
      'appartement',
      'maison',
      'studio',           -- Nouveau : petit logement une pièce
      'colocation',
      'saisonnier',
      'local_commercial',
      'bureaux',
      'entrepot',
      'parking',
      'box',              -- Nouveau : garage fermé / box de stockage
      'fonds_de_commerce'
    )
  );

-- Mettre à jour la contrainte usage_principal pour inclure box
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_usage_principal_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_usage_principal_check
  CHECK (
    usage_principal IS NULL
    OR usage_principal IN (
      'habitation',
      'local_commercial',
      'bureaux',
      'entrepot',
      'parking',
      'box',
      'fonds_de_commerce'
    )
  );

COMMIT;

