-- Script de diagnostic rapide : Vérifier l'état actuel des owner_id
-- À exécuter AVANT la migration de correction pour voir l'impact

-- ✅ 1. Voir les profils propriétaires et leurs propriétés
SELECT 
  p.id as profile_id,
  p.user_id as auth_user_id,
  p.role,
  COUNT(pr.id) as properties_count,
  CASE 
    WHEN COUNT(pr.id) = 0 THEN '❌ Aucune propriété'
    ELSE '✅ ' || COUNT(pr.id) || ' propriétés'
  END as status
FROM profiles p
LEFT JOIN properties pr ON pr.owner_id = p.id
WHERE p.role = 'owner'
GROUP BY p.id, p.user_id, p.role
ORDER BY properties_count DESC;

-- ✅ 2. Vérifier les propriétés avec owner_id incorrect (owner_id = user_id au lieu de profile.id)
SELECT 
  pr.id as property_id,
  pr.owner_id as current_owner_id,
  pr.adresse_complete,
  pr.etat,
  pr.created_at,
  p.id as correct_profile_id,
  p.user_id as profile_user_id,
  CASE 
    WHEN pr.owner_id = p.id THEN '✅ CORRECT (owner_id = profile.id)'
    WHEN pr.owner_id = p.user_id THEN '❌ INCORRECT (owner_id = user_id, doit être profile.id)'
    ELSE '❌ AUCUN MATCH'
  END as match_status
FROM properties pr
LEFT JOIN profiles p ON pr.owner_id = p.id OR pr.owner_id = p.user_id
ORDER BY pr.created_at DESC
LIMIT 20;

-- ✅ 3. Compter les propriétés avec owner_id incorrect
SELECT 
  COUNT(*) as incorrect_count,
  'Propriétés avec owner_id = user_id (doit être profile.id)' as description
FROM properties pr
JOIN profiles p ON pr.owner_id = p.user_id
WHERE pr.owner_id != p.id;

-- ✅ 4. Vérifier les propriétés orphelines (owner_id ne correspond à aucun profil)
SELECT 
  COUNT(*) as orphan_count,
  'Propriétés orphelines (owner_id invalide)' as description
FROM properties pr
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = pr.owner_id OR p.user_id = pr.owner_id
);

