-- ============================================
-- RÉINITIALISER LA SIGNATURE DU LOCATAIRE
-- Exécuter dans Supabase SQL Editor
-- ============================================

-- 1. D'abord, ajouter la colonne signature_image si elle n'existe pas
ALTER TABLE lease_signers ADD COLUMN IF NOT EXISTS signature_image TEXT;

-- 2. Réinitialiser le signataire locataire pour le bail bb79e040-9fdf-4365-a4a5-6090d417ae97
UPDATE lease_signers
SET 
  signature_status = 'pending',
  signed_at = NULL,
  signature_image = NULL
WHERE lease_id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97'
  AND role = 'locataire_principal';

-- 3. Réinitialiser aussi le propriétaire s'il n'a pas encore signé
UPDATE lease_signers
SET 
  signature_status = 'pending',
  signed_at = NULL,
  signature_image = NULL
WHERE lease_id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97'
  AND role = 'proprietaire';

-- 4. Remettre le bail en statut "pending_signature"
UPDATE leases
SET statut = 'pending_signature'
WHERE id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97';

-- 5. Vérification - Afficher l'état actuel
SELECT 
  ls.role,
  ls.signature_status,
  ls.signed_at,
  ls.signature_image IS NOT NULL as has_signature_image,
  p.prenom,
  p.nom
FROM lease_signers ls
LEFT JOIN profiles p ON p.id = ls.profile_id
WHERE ls.lease_id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97';

-- 6. Vérifier le statut du bail
SELECT id, statut, type_bail 
FROM leases 
WHERE id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97';






