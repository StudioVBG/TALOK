-- Migration : ajout du type de bail étudiant
-- Le bail étudiant (9 mois) est une variante du bail meublé pour les étudiants

BEGIN;

-- Mettre à jour la contrainte des types de bail pour inclure 'etudiant'
ALTER TABLE leases
  DROP CONSTRAINT IF EXISTS leases_type_bail_check;

ALTER TABLE leases
  ADD CONSTRAINT leases_type_bail_check
  CHECK (
    type_bail IN (
      'nu',
      'meuble',
      'colocation',
      'saisonnier',
      'bail_mobilite',
      'commercial_3_6_9',
      'commercial_derogatoire',
      'professionnel',
      'contrat_parking',
      'location_gerance',
      'etudiant'  -- Nouveau : bail étudiant (9 mois, meublé)
    )
  );

-- Ajout d'un index pour améliorer les requêtes par type de bail
CREATE INDEX IF NOT EXISTS idx_leases_type_bail ON leases(type_bail);

COMMIT;

