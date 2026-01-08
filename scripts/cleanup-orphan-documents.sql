-- ============================================
-- SCRIPT DE NETTOYAGE DES DOCUMENTS ORPHELINS
-- ============================================
-- À exécuter dans Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/poeijjosocmqlhgsacud/sql/new
-- ============================================

-- ÉTAPE 1: Voir les documents orphelins (sans supprimer)
SELECT 
  d.id,
  d.title,
  d.type,
  d.lease_id,
  d.property_id,
  d.tenant_id,
  d.created_at
FROM documents d
WHERE 
  -- Documents de bail sans lease_id
  (d.lease_id IS NULL AND d.type IN ('bail', 'lease', 'quittance'))
  OR
  -- Documents avec lease_id invalide
  (d.lease_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leases WHERE id = d.lease_id));

-- ============================================
-- ÉTAPE 2: SUPPRIMER les documents orphelins
-- Décommentez les lignes suivantes pour exécuter
-- ============================================

-- DELETE FROM documents
-- WHERE 
--   (lease_id IS NULL AND type IN ('bail', 'lease', 'quittance'))
--   OR
--   (lease_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leases WHERE id = lease_id));

-- ============================================
-- ALTERNATIVE PLUS SIMPLE: Supprimer TOUS les documents
-- orphelins (sans bail lié) - Utilisez si la requête ci-dessus échoue
-- ============================================

-- DELETE FROM documents WHERE lease_id IS NULL;

