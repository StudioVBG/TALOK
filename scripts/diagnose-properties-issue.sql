-- Script de diagnostic pour vérifier pourquoi les propriétés n'apparaissent pas
-- À exécuter dans Supabase SQL Editor avec l'utilisateur connecté

-- 1. Vérifier que user_profile_id() fonctionne
SELECT 
  auth.uid() as current_user_id,
  public.user_profile_id() as profile_id_from_function,
  p.id as profile_id_direct,
  p.role as profile_role
FROM profiles p
WHERE p.user_id = auth.uid()
LIMIT 1;

-- 2. Vérifier les propriétés existantes pour ce propriétaire
SELECT 
  pr.id,
  pr.owner_id,
  pr.adresse_complete,
  pr.type,
  pr.etat,
  pr.created_at,
  -- Vérifier si la politique RLS permet l'accès
  CASE 
    WHEN pr.owner_id = public.user_profile_id() THEN '✅ Accessible via RLS'
    ELSE '❌ Bloqué par RLS'
  END as rls_status
FROM properties pr
WHERE pr.owner_id = public.user_profile_id()
ORDER BY pr.created_at DESC
LIMIT 10;

-- 3. Vérifier toutes les propriétés (pour debug, nécessite droits admin)
-- SELECT COUNT(*) as total_properties FROM properties;

-- 4. Vérifier les politiques RLS actives sur properties
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'properties'
ORDER BY policyname;

-- 5. Tester la requête exacte utilisée par fetchProperties
SELECT 
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

