-- Migration: Ensure key lease documents are visible to tenants
-- Fixes: Documents created before visible_tenant was properly set

-- Set visible_tenant = true for bail, EDL, and assurance documents
UPDATE documents
SET visible_tenant = true
WHERE type IN ('bail', 'contrat_bail', 'EDL_entree', 'EDL_sortie', 'edl_entree', 'edl_sortie', 'quittance', 'attestation_remise_cles', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

-- Set default visible_tenant = true for new documents via column default
ALTER TABLE documents ALTER COLUMN visible_tenant SET DEFAULT true;
