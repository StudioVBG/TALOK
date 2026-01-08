-- ============================================
-- MIGRATION: Correction automatique des dépôts de garantie
-- ============================================
-- Cette migration recalcule les dépôts de garantie pour tous les baux
-- où le dépôt dépasse le maximum légal.
--
-- Règles légales:
-- - Bail nu: max 1 mois de loyer
-- - Bail meublé/colocation: max 2 mois de loyer
-- - Bail mobilité: 0€ (interdit)
-- ============================================

-- 1. Corriger les baux nus avec dépôt > 1 mois
UPDATE leases
SET depot_de_garantie = loyer
WHERE type_bail = 'nu'
  AND depot_de_garantie > loyer
  AND loyer > 0;

-- 2. Corriger les baux meublés avec dépôt > 2 mois
UPDATE leases
SET depot_de_garantie = loyer * 2
WHERE type_bail IN ('meuble', 'colocation', 'saisonnier')
  AND depot_de_garantie > (loyer * 2)
  AND loyer > 0;

-- 3. Corriger les baux mobilité avec dépôt > 0
UPDATE leases
SET depot_de_garantie = 0
WHERE type_bail = 'mobilite'
  AND depot_de_garantie > 0;

-- 4. Log du résultat
DO $$
DECLARE
  total_fixed INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_fixed FROM leases;
  RAISE NOTICE 'Migration terminée. Baux vérifiés: %', total_fixed;
END $$;

-- 5. Vérification finale: aucun dépôt ne doit dépasser le max légal
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM leases
  WHERE 
    (type_bail = 'nu' AND depot_de_garantie > loyer AND loyer > 0)
    OR (type_bail IN ('meuble', 'colocation', 'saisonnier') AND depot_de_garantie > loyer * 2 AND loyer > 0)
    OR (type_bail = 'mobilite' AND depot_de_garantie > 0);
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'ATTENTION: % baux ont encore un dépôt invalide', invalid_count;
  ELSE
    RAISE NOTICE '✅ Tous les dépôts sont conformes au maximum légal';
  END IF;
END $$;

