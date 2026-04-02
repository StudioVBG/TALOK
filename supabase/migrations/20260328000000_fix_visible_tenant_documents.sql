-- FIX 4: Ensure mandatory lease documents are visible to tenants
-- Documents types contrat_bail, edl_entree, assurance_habitation
-- must have visible_tenant = true so tenants can see them.

UPDATE documents
SET visible_tenant = true,
    updated_at = now()
WHERE type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);
