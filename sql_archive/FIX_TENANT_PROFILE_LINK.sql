-- ============================================
-- SCRIPT DE CORRECTION: Liaison Profil Locataire
-- ============================================
-- Ce script corrige le problème où le profil créé lors de la signature
-- n'est pas lié au compte utilisateur du locataire.
-- 
-- EXÉCUTEZ CE SCRIPT DANS SUPABASE STUDIO > SQL EDITOR
-- ============================================

-- ÉTAPE 1: Identifier les données existantes
-- ============================================

-- Voir tous les utilisateurs auth avec email contenant "volberg"
SELECT 
  id as auth_user_id, 
  email, 
  created_at,
  last_sign_in_at
FROM auth.users 
WHERE email ILIKE '%volberg%'
ORDER BY created_at DESC;

-- Voir tous les profils liés à cet email
SELECT 
  id as profile_id, 
  user_id, 
  email, 
  nom, 
  prenom, 
  role,
  telephone,
  created_at
FROM profiles 
WHERE email ILIKE '%volberg%' 
   OR nom ILIKE '%VOLBERG%'
   OR nom ILIKE '%VBG%'
ORDER BY created_at DESC;

-- Voir les lease_signers et leurs profils
SELECT 
  ls.id as signer_id,
  ls.lease_id,
  ls.role as signer_role,
  ls.signature_status,
  ls.signed_at,
  p.id as profile_id,
  p.user_id,
  p.nom,
  p.prenom,
  p.email as profile_email
FROM lease_signers ls
JOIN profiles p ON ls.profile_id = p.id
WHERE ls.role = 'locataire_principal'
ORDER BY ls.created_at DESC;

-- ============================================
-- ÉTAPE 2: CORRECTION AUTOMATIQUE
-- ============================================

-- Cette requête lie automatiquement les profils aux comptes auth
-- en utilisant l'email comme clé de correspondance
DO $$
DECLARE
  r RECORD;
  auth_id UUID;
BEGIN
  -- Parcourir tous les profils sans user_id mais avec un email
  FOR r IN 
    SELECT id, email 
    FROM profiles 
    WHERE user_id IS NULL 
      AND email IS NOT NULL
      AND email != ''
  LOOP
    -- Chercher l'utilisateur auth correspondant
    SELECT id INTO auth_id 
    FROM auth.users 
    WHERE email = r.email
    LIMIT 1;
    
    IF auth_id IS NOT NULL THEN
      -- Lier le profil au compte auth
      UPDATE profiles 
      SET user_id = auth_id
      WHERE id = r.id;
      
      RAISE NOTICE 'Profil % lié au compte auth %', r.id, auth_id;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- ÉTAPE 3: VÉRIFICATION APRÈS CORRECTION
-- ============================================

-- Vérifier les profils locataires maintenant liés
SELECT 
  p.id as profile_id,
  p.user_id,
  p.nom,
  p.prenom,
  p.email,
  p.role,
  u.email as auth_email,
  CASE WHEN p.user_id IS NOT NULL THEN '✓ Lié' ELSE '✗ Non lié' END as status
FROM profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.role = 'tenant'
ORDER BY p.created_at DESC;

-- Vérifier les baux et leurs signataires
SELECT 
  l.id as lease_id,
  l.type_bail,
  l.statut as lease_status,
  l.loyer,
  pr.adresse_complete,
  ls.role as signer_role,
  ls.signature_status,
  p.nom,
  p.prenom,
  p.user_id,
  CASE WHEN p.user_id IS NOT NULL THEN '✓' ELSE '✗' END as linked
FROM leases l
JOIN properties pr ON l.property_id = pr.id
LEFT JOIN lease_signers ls ON ls.lease_id = l.id
LEFT JOIN profiles p ON ls.profile_id = p.id
ORDER BY l.created_at DESC;

-- ============================================
-- ÉTAPE 4: CORRECTION MANUELLE (SI NÉCESSAIRE)
-- ============================================

-- Si la correction automatique n'a pas fonctionné,
-- utilisez ces requêtes en remplaçant les IDs:

/*
-- Trouver l'auth user_id
SELECT id FROM auth.users WHERE email = 'volberg.thomas@hotmail.fr';
-- Exemple de résultat: 6337af52-2fb7-41d7-b620-d9ddd689d294

-- Trouver le profile_id créé lors de la signature  
SELECT id FROM profiles WHERE nom ILIKE '%VOLBERG%' AND user_id IS NULL;
-- Exemple de résultat: 7a1f85cb-b27c-4882-9b9a-42f520dce88b

-- Lier manuellement
UPDATE profiles 
SET user_id = '6337af52-2fb7-41d7-b620-d9ddd689d294'  -- REMPLACER
WHERE id = '7a1f85cb-b27c-4882-9b9a-42f520dce88b';    -- REMPLACER
*/

-- ============================================
-- BONUS: Voir les documents du locataire
-- ============================================

SELECT 
  d.id,
  d.type,
  d.storage_path,
  d.tenant_id,
  d.lease_id,
  d.created_at,
  p.nom as tenant_nom
FROM documents d
LEFT JOIN profiles p ON d.tenant_id = p.id
WHERE d.type IN ('cni', 'bail_signe_locataire', 'bail')
ORDER BY d.created_at DESC;

-- ============================================
-- FIN DU SCRIPT
-- ============================================
-- Après exécution:
-- 1. Reconnectez-vous avec le compte locataire
-- 2. Allez sur /app/tenant/lease 
-- 3. Le bail devrait maintenant s'afficher !
-- ============================================

