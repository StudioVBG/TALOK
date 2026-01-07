-- ============================================================
-- SCRIPT DE DIAGNOSTIC ET CORRECTION DES IMAGES DE SIGNATURE
-- À exécuter dans Supabase Studio > SQL Editor
-- ============================================================

-- 1. DIAGNOSTIC : Voir l'état actuel des signatures
SELECT 
  ls.id as signer_id,
  ls.lease_id,
  ls.role,
  ls.signature_status,
  ls.signed_at,
  ls.signature_image_path,
  ls.proof_id,
  ls.profile_id,
  p.prenom,
  p.nom,
  p.user_id
FROM lease_signers ls
LEFT JOIN profiles p ON p.id = ls.profile_id
WHERE ls.lease_id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97';

-- 2. Voir les fichiers de signature existants dans le bucket "documents"
-- (Exécuter cette requête via l'API ou vérifier manuellement dans Storage)

-- 3. CORRECTION : Si vous connaissez les chemins des images
-- Remplacez les valeurs ci-dessous par les vrais chemins
-- Format: signatures/{leaseId}/{userId}_{timestamp}.png

-- Pour le propriétaire (Marie-Line VOLBERG)
UPDATE lease_signers 
SET signature_image_path = 'signatures/bb79e040-9fdf-4365-a4a5-6090d417ae97/OWNER_USER_ID_TIMESTAMP.png'
WHERE lease_id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97'
AND role = 'proprietaire'
AND signature_status = 'signed'
AND signature_image_path IS NULL;

-- Pour le locataire (Thomas VOLBERG)
UPDATE lease_signers 
SET signature_image_path = 'signatures/bb79e040-9fdf-4365-a4a5-6090d417ae97/TENANT_USER_ID_TIMESTAMP.png'
WHERE lease_id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97'
AND role = 'locataire_principal'
AND signature_status = 'signed'
AND signature_image_path IS NULL;

-- 4. ALTERNATIVE : Mettre à jour avec les vrais chemins si vous les connaissez
-- Listez d'abord le contenu du bucket dans Supabase Dashboard > Storage > documents > signatures > {leaseId}

