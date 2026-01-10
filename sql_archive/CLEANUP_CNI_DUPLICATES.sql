-- ============================================
-- NETTOYAGE DES DOUBLONS CNI
-- Exécuter dans Supabase SQL Editor
-- ============================================

-- 1. Voir les doublons avant nettoyage
SELECT 
  lease_id,
  type,
  COUNT(*) as total,
  STRING_AGG(id::text, ', ') as document_ids
FROM documents
WHERE type IN ('cni_recto', 'cni_verso')
  AND is_archived = false
GROUP BY lease_id, type
HAVING COUNT(*) > 1;

-- 2. Archiver les doublons (garder le plus récent)
WITH ranked_docs AS (
  SELECT 
    id,
    lease_id,
    type,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY lease_id, type 
      ORDER BY created_at DESC
    ) as rn
  FROM documents
  WHERE type IN ('cni_recto', 'cni_verso')
    AND is_archived = false
)
UPDATE documents d
SET 
  is_archived = true,
  updated_at = NOW()
FROM ranked_docs r
WHERE d.id = r.id
  AND r.rn > 1;

-- 3. Mettre à jour les liens replaced_by
WITH latest_docs AS (
  SELECT 
    id,
    lease_id,
    type
  FROM documents
  WHERE type IN ('cni_recto', 'cni_verso')
    AND is_archived = false
)
UPDATE documents d_old
SET replaced_by = ld.id
FROM latest_docs ld
WHERE d_old.lease_id = ld.lease_id
  AND d_old.type = ld.type
  AND d_old.is_archived = true
  AND d_old.replaced_by IS NULL;

-- 4. Vérifier le résultat
SELECT 
  type, 
  COUNT(*) as total,
  SUM(CASE WHEN is_archived THEN 1 ELSE 0 END) as archives,
  SUM(CASE WHEN NOT is_archived THEN 1 ELSE 0 END) as actifs
FROM documents
WHERE type IN ('cni_recto', 'cni_verso')
GROUP BY type;

-- 5. Voir les documents actifs restants
SELECT 
  id,
  type,
  lease_id,
  created_at,
  is_archived
FROM documents
WHERE type IN ('cni_recto', 'cni_verso')
  AND is_archived = false
ORDER BY lease_id, type, created_at DESC;
