-- ============================================
-- SCRIPT DE CORRECTION : Liaison Profils Locataires
-- ============================================
-- Ce script lie les profils créés lors de la signature (sans user_id)
-- aux comptes utilisateurs existants dans auth.users
-- ============================================

-- 1. DIAGNOSTIC : Voir les profils locataires sans user_id
SELECT 
  p.id as profile_id,
  p.user_id,
  p.email as profile_email,
  p.nom,
  p.prenom,
  p.role,
  p.created_at,
  u.id as auth_user_id,
  u.email as auth_email
FROM profiles p
LEFT JOIN auth.users u ON p.email = u.email
WHERE p.role = 'tenant'
  AND p.user_id IS NULL
  AND u.id IS NOT NULL;

-- 2. CORRECTION AUTOMATIQUE : Lier les profils aux comptes auth
-- Cette requête met à jour tous les profils tenant qui ont un email
-- correspondant à un compte auth.users mais pas encore de user_id
UPDATE profiles p
SET user_id = u.id
FROM auth.users u
WHERE p.email = u.email
  AND p.role = 'tenant'
  AND p.user_id IS NULL;

-- 3. VÉRIFICATION : Voir les profils maintenant liés
SELECT 
  id,
  user_id,
  email,
  nom,
  prenom,
  role,
  created_at
FROM profiles
WHERE role = 'tenant'
  AND user_id IS NOT NULL
ORDER BY created_at DESC;

-- 4. VÉRIFICATION DES BAUX : Voir les baux signés par ces profils
SELECT 
  l.id as lease_id,
  l.statut,
  l.loyer,
  l.date_debut,
  p.nom,
  p.prenom,
  p.email,
  ls.signature_status,
  ls.signed_at,
  prop.adresse_complete
FROM leases l
JOIN lease_signers ls ON ls.lease_id = l.id
JOIN profiles p ON ls.profile_id = p.id
LEFT JOIN properties prop ON l.property_id = prop.id
WHERE ls.role = 'locataire_principal'
ORDER BY l.created_at DESC;

-- 5. OPTIONNEL : Si vous connaissez l'email exact à corriger
-- Décommentez et modifiez les lignes ci-dessous :

-- UPDATE profiles 
-- SET user_id = (SELECT id FROM auth.users WHERE email = 'volberg.thomas@hotmail.fr')
-- WHERE email = 'volberg.thomas@hotmail.fr' 
--   AND role = 'tenant'
--   AND user_id IS NULL;

-- ============================================
-- FIN DU SCRIPT
-- ============================================

