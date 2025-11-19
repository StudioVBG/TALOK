-- Migration de diagnostic : Vérifier l'alignement owner_id entre création et lecture
-- 
-- Cette migration ne modifie RIEN, elle sert uniquement à diagnostiquer le problème
-- Exécuter ces requêtes dans Supabase SQL Editor pour vérifier les données

-- 1. Vérifier les profils et leurs user_id
SELECT 
  p.id as profile_id,
  p.user_id as auth_user_id,
  p.role,
  p.created_at
FROM profiles p
WHERE p.role = 'owner'
ORDER BY p.created_at DESC
LIMIT 10;

-- 2. Vérifier les propriétés et leurs owner_id
SELECT 
  pr.id as property_id,
  pr.owner_id,
  pr.type_bien,
  pr.adresse_complete,
  pr.etat,
  pr.created_at,
  -- Vérifier si owner_id correspond à un profiles.id
  CASE 
    WHEN EXISTS (SELECT 1 FROM profiles WHERE id = pr.owner_id) THEN '✅ owner_id = profiles.id'
    WHEN EXISTS (SELECT 1 FROM profiles WHERE user_id = pr.owner_id) THEN '❌ owner_id = profiles.user_id (MAUVAIS)'
    ELSE '❌ owner_id ne correspond à aucun profil'
  END as owner_id_status
FROM properties pr
ORDER BY pr.created_at DESC
LIMIT 20;

-- 3. Vérifier le mapping owner_id → profiles
SELECT 
  pr.id as property_id,
  pr.owner_id as property_owner_id,
  p.id as profile_id,
  p.user_id as profile_user_id,
  p.role,
  CASE 
    WHEN pr.owner_id = p.id THEN '✅ CORRECT (owner_id = profiles.id)'
    WHEN pr.owner_id = p.user_id THEN '❌ INCORRECT (owner_id = profiles.user_id)'
    ELSE '❌ AUCUN MATCH'
  END as match_status
FROM properties pr
LEFT JOIN profiles p ON pr.owner_id = p.id OR pr.owner_id = p.user_id
ORDER BY pr.created_at DESC
LIMIT 20;

-- 4. Compter les propriétés par propriétaire (en utilisant profiles.id)
SELECT 
  p.id as profile_id,
  p.user_id as auth_user_id,
  COUNT(pr.id) as properties_count
FROM profiles p
LEFT JOIN properties pr ON pr.owner_id = p.id
WHERE p.role = 'owner'
GROUP BY p.id, p.user_id
ORDER BY properties_count DESC;

-- 5. Trouver les propriétés avec un owner_id incorrect (si owner_id = user_id au lieu de profile.id)
SELECT 
  pr.id as property_id,
  pr.owner_id,
  pr.adresse_complete,
  pr.created_at,
  p.id as correct_profile_id,
  p.user_id as auth_user_id
FROM properties pr
INNER JOIN profiles p ON pr.owner_id = p.user_id  -- Trouver les propriétés où owner_id = user_id
WHERE p.role = 'owner'
ORDER BY pr.created_at DESC;

