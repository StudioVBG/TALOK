-- ============================================
-- SCRIPT DE DIAGNOSTIC COMPLET - Propriétés non visibles
-- ============================================
-- Exécuter dans Supabase SQL Editor
-- ============================================

-- 1. Vérifier l'utilisateur connecté et son profil
SELECT 
  '=== 1. UTILISATEUR CONNECTÉ ===' as section,
  auth.uid() as current_user_id,
  public.user_profile_id() as profile_id_from_function;

-- 2. Vérifier le profil de l'utilisateur connecté
SELECT 
  '=== 2. PROFIL UTILISATEUR ===' as section,
  p.id as profile_id,
  p.role,
  p.user_id,
  u.email,
  u.created_at as user_created_at
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE p.user_id = auth.uid();

-- 3. Vérifier TOUTES les propriétés en base (sans filtre RLS)
--    Note: Cette requête nécessite les droits admin ou service_role
SELECT 
  '=== 3. TOUTES LES PROPRIÉTÉS EN BASE (5 dernières) ===' as section,
  id, 
  owner_id, 
  adresse_complete, 
  type,
  type_bien,
  etat,
  created_at
FROM properties 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Tester la requête exacte utilisée par fetchProperties (avec RLS)
SELECT 
  '=== 4. PROPRIÉTÉS VISIBLES AVEC RLS (requête fetchProperties) ===' as section,
  id, 
  owner_id, 
  type, 
  adresse_complete, 
  code_postal, 
  ville, 
  surface, 
  nb_pieces, 
  loyer_base, 
  created_at, 
  etat
FROM properties
WHERE owner_id = public.user_profile_id()
ORDER BY created_at DESC
LIMIT 50;

-- 5. Comparer owner_id des propriétés avec profile_id de l'utilisateur
SELECT 
  '=== 5. COMPARAISON owner_id vs profile_id ===' as section,
  p.id as property_id,
  p.owner_id,
  p.adresse_complete,
  prof.id as current_profile_id,
  CASE 
    WHEN p.owner_id = prof.id THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as match_status
FROM properties p
CROSS JOIN (
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
) prof
ORDER BY p.created_at DESC
LIMIT 10;

-- 6. Vérifier les politiques RLS actives sur properties
SELECT 
  '=== 6. POLITIQUES RLS ACTIVES ===' as section,
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'properties'
ORDER BY policyname;

-- 7. Vérifier si la fonction user_profile_id() fonctionne correctement
SELECT 
  '=== 7. TEST FONCTION user_profile_id() ===' as section,
  public.user_profile_id() as function_result,
  (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1) as direct_query_result,
  CASE 
    WHEN public.user_profile_id() = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1) 
    THEN '✅ FONCTION OK'
    ELSE '❌ FONCTION ERREUR'
  END as function_status;

-- 8. Vérifier les unités créées avec les propriétés
SELECT 
  '=== 8. UNITÉS CRÉÉES ===' as section,
  u.id as unit_id,
  u.property_id,
  u.nom,
  p.owner_id,
  p.adresse_complete
FROM units u
JOIN properties p ON p.id = u.property_id
ORDER BY u.created_at DESC
LIMIT 10;

-- 9. Statistiques générales
SELECT 
  '=== 9. STATISTIQUES ===' as section,
  COUNT(*) FILTER (WHERE owner_id = public.user_profile_id()) as mes_proprietes,
  COUNT(*) as total_proprietes,
  COUNT(DISTINCT owner_id) as nombre_proprietaires
FROM properties;

