-- Migration : Corriger les propriétés avec owner_id = profiles.user_id au lieu de profiles.id
-- 
-- ⚠️ ATTENTION : Cette migration corrige les données existantes si elles ont un mauvais owner_id
-- Ne l'exécuter QUE si le diagnostic montre que des propriétés ont owner_id = user_id au lieu de profile.id
--
-- Pour vérifier avant d'exécuter :
-- SELECT COUNT(*) FROM properties pr INNER JOIN profiles p ON pr.owner_id = p.user_id WHERE p.role = 'owner';

-- Étape 1 : Vérifier s'il y a des propriétés à corriger
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM properties pr
  INNER JOIN profiles p ON pr.owner_id = p.user_id
  WHERE p.role = 'owner';
  
  IF mismatch_count > 0 THEN
    RAISE NOTICE 'Trouvé % propriétés avec owner_id incorrect (owner_id = user_id au lieu de profile.id)', mismatch_count;
  ELSE
    RAISE NOTICE 'Aucune propriété à corriger - toutes les propriétés ont déjà owner_id = profile.id';
  END IF;
END $$;

-- Étape 2 : Corriger les propriétés avec owner_id = user_id → owner_id = profile.id
UPDATE properties pr
SET owner_id = p.id
FROM profiles p
WHERE pr.owner_id = p.user_id  -- Trouver les propriétés où owner_id = user_id
  AND p.role = 'owner'         -- Uniquement pour les propriétaires
  AND p.id != pr.owner_id;     -- Éviter les mises à jour inutiles

-- Étape 3 : Vérifier le résultat
SELECT 
  'Après correction' as status,
  COUNT(*) as properties_with_correct_owner_id
FROM properties pr
INNER JOIN profiles p ON pr.owner_id = p.id
WHERE p.role = 'owner';

