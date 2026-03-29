-- Migration: Ensure key lease documents are visible to tenants
-- Fixes: Documents created before visible_tenant was properly set

-- Set visible_tenant = true for all tenant-relevant document types
UPDATE documents
SET visible_tenant = true
WHERE type IN ('bail', 'contrat_bail', 'EDL_entree', 'EDL_sortie', 'edl_entree', 'edl_sortie', 'quittance', 'attestation_remise_cles', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

-- Corriger les documents obligatoires du bail test da2eb9da
UPDATE documents
SET visible_tenant = true, updated_at = now()
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
  AND type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

-- Set default visible_tenant = true for new documents via column default
ALTER TABLE documents ALTER COLUMN visible_tenant SET DEFAULT true;
