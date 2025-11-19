-- Migration : Corriger les owner_id des propriétés existantes
-- Problème : Certaines propriétés peuvent avoir owner_id = profiles.user_id au lieu de profiles.id
-- Solution : Mettre à jour les propriétés pour utiliser profiles.id

BEGIN;

-- ✅ ÉTAPE 1 : Diagnostic - Vérifier l'impact avant correction
-- Cette requête montre les propriétés qui ont un owner_id incorrect
DO $$
DECLARE
  incorrect_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO incorrect_count
  FROM properties p
  JOIN profiles pr ON p.owner_id = pr.user_id
  WHERE p.owner_id != pr.id;
  
  RAISE NOTICE 'Nombre de propriétés avec owner_id incorrect (devrait être profile.id mais est profile.user_id): %', incorrect_count;
  
  IF incorrect_count > 0 THEN
    RAISE NOTICE 'Ces propriétés seront corrigées automatiquement';
  ELSE
    RAISE NOTICE 'Aucune propriété à corriger - toutes les propriétés ont déjà owner_id = profile.id';
  END IF;
END $$;

-- ✅ ÉTAPE 2 : Correction - Mettre à jour les propriétés avec owner_id incorrect
-- Cette requête met à jour les propriétés où owner_id = profiles.user_id
-- pour utiliser profiles.id à la place
UPDATE properties p
SET owner_id = pr.id
FROM profiles pr
WHERE p.owner_id = pr.user_id
  AND p.owner_id != pr.id;

-- ✅ ÉTAPE 3 : Vérification - S'assurer que toutes les propriétés ont maintenant le bon owner_id
DO $$
DECLARE
  remaining_incorrect INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_incorrect
  FROM properties p
  JOIN profiles pr ON p.owner_id = pr.user_id
  WHERE p.owner_id != pr.id;
  
  IF remaining_incorrect > 0 THEN
    RAISE WARNING 'Il reste % propriétés avec owner_id incorrect après la correction', remaining_incorrect;
  ELSE
    RAISE NOTICE '✅ Toutes les propriétés ont maintenant owner_id = profile.id';
  END IF;
END $$;

-- ✅ ÉTAPE 4 : Vérifier qu'il n'y a pas de propriétés orphelines (owner_id qui ne correspond à aucun profil)
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM properties p
  WHERE NOT EXISTS (
    SELECT 1 FROM profiles pr WHERE pr.id = p.owner_id
  );
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'Il y a % propriétés orphelines (owner_id ne correspond à aucun profil)', orphan_count;
  ELSE
    RAISE NOTICE '✅ Toutes les propriétés ont un owner_id valide';
  END IF;
END $$;

COMMIT;

-- ✅ NOTE : Cette migration est idempotente
-- Si owner_id est déjà correct (profiles.id), la sous-requête ne trouvera pas de correspondance
-- et la ligne ne sera pas mise à jour.

