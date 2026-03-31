-- ============================================
-- SCRIPT DE CORRECTION DES DOCUMENTS EXISTANTS
-- ============================================
-- Ce script corrige les documents qui n'ont pas de owner_id ou property_id
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Corriger les documents liés à un bail
UPDATE documents d
SET 
  property_id = COALESCE(d.property_id, l.property_id),
  owner_id = COALESCE(d.owner_id, p.owner_id)
FROM leases l
JOIN properties p ON l.property_id = p.id
WHERE d.lease_id = l.id
  AND (d.property_id IS NULL OR d.owner_id IS NULL);

-- 2. Corriger les documents liés directement à une propriété
UPDATE documents d
SET owner_id = p.owner_id
FROM properties p
WHERE d.property_id = p.id
  AND d.owner_id IS NULL;

-- 3. Vérifier les résultats
SELECT 
  type,
  COUNT(*) AS total,
  COUNT(owner_id) AS avec_owner,
  COUNT(property_id) AS avec_property,
  COUNT(lease_id) AS avec_bail
FROM documents
GROUP BY type
ORDER BY total DESC;

