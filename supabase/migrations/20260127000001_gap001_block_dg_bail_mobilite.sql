-- ============================================
-- GAP-001: Bloquer dépôt de garantie pour bail mobilité
-- Article 25-13 de la Loi ELAN (2018)
-- ============================================
--
-- Cette migration ajoute une contrainte CHECK au niveau base de données
-- pour garantir qu'aucun bail mobilité ne puisse avoir un dépôt de garantie.
--
-- Référence légale:
-- "Le contrat de bail mobilité ne peut pas prévoir le versement d'un dépôt de garantie"
-- - Article 25-13 de la loi n° 2018-1021 du 23 novembre 2018 (Loi ELAN)

-- Ajouter la contrainte CHECK sur la table leases
ALTER TABLE leases
ADD CONSTRAINT chk_bail_mobilite_no_deposit
CHECK (
  type_bail != 'bail_mobilite' OR depot_de_garantie IS NULL OR depot_de_garantie = 0
);

-- Commentaire explicatif sur la contrainte
COMMENT ON CONSTRAINT chk_bail_mobilite_no_deposit ON leases IS
'Article 25-13 Loi ELAN: Le bail mobilité ne peut pas comporter de dépôt de garantie';

-- Mettre à jour les baux mobilité existants qui auraient un dépôt (correction des données)
UPDATE leases
SET depot_de_garantie = 0
WHERE type_bail = 'bail_mobilite' AND depot_de_garantie > 0;
