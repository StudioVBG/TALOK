-- =============================================================================
-- Nettoyage des "documents fantomes" visibles cote locataire
--
-- Contexte : 3 entrees "Document" sans titre apparaissent dans l'espace
-- locataire pour le bail da2eb9da-1ff1-4020-8682-5f993aa6fde7.
--
-- Le composant app/tenant/documents/page.tsx:268-274 filtre deja type='autre'
-- et type null cote client ; ces rows passent quand meme -> elles ont
-- vraisemblablement title NULL ou title = 'Document' avec un type valide
-- mais mal renseigne, ou un storage_path orphelin.
--
-- Usage : ouvrir Supabase SQL Editor, inspecter avec SELECT puis ARCHIVER.
-- =============================================================================

-- 1. Identifier les candidats (a executer en premier, sans rien modifier)
SELECT
  id,
  type,
  title,
  original_filename,
  storage_path,
  mime_type,
  visible_tenant,
  ged_status,
  is_generated,
  tenant_id,
  lease_id,
  created_at
FROM documents
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
  AND (
    title IS NULL
    OR trim(title) = ''
    OR title = 'Document'
  )
ORDER BY created_at DESC;


-- 2. Verification storage : le fichier existe-t-il reellement dans le bucket ?
-- (si storage_path pointe vers un fichier valide on peut recuperer le doc,
--  sinon c'est un orphelin qu'il vaut mieux archiver)
-- -> verification manuelle dans le dashboard Supabase > Storage > documents


-- 3. Archivage soft des fantomes sans renommer ni supprimer.
-- ged_status = 'archived' les retire de l'affichage tenant sans perdre
-- la trace d'audit (pas de DELETE, car certaines rows ont peut-etre un
-- fichier storage rattache legitimement).
--
-- DECOMMENTER pour executer apres avoir valide la liste du point 1.

-- UPDATE documents
-- SET ged_status = 'archived', updated_at = NOW()
-- WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
--   AND (
--     title IS NULL
--     OR trim(title) = ''
--     OR title = 'Document'
--   )
--   AND ged_status = 'active';


-- 4. Option complementaire : retomber sur un title propre depuis original_filename
-- (si les rows sont legitimes et qu'on veut juste afficher quelque chose)
--
-- UPDATE documents
-- SET title = COALESCE(NULLIF(trim(original_filename), ''), 'Document sans titre'),
--     updated_at = NOW()
-- WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
--   AND (title IS NULL OR trim(title) = '' OR title = 'Document');


-- =============================================================================
-- Fix longue duree : bloquer l'insertion de documents sans title via trigger
-- =============================================================================
-- Si ces fantomes reapparaissent, il faut blinder /api/documents/upload
-- (deja fait : route ligne 214 utilise getDisplayName). Mais l'import batch
-- ou un autre flux peut contourner. Un CHECK constraint pourrait aider :
--
-- ALTER TABLE documents
--   ADD CONSTRAINT documents_title_not_empty
--   CHECK (title IS NOT NULL AND trim(title) <> '');
--
-- A deployer uniquement apres nettoyage complet des rows existantes.
