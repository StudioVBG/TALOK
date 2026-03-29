-- FIX 4: Ensure mandatory lease documents are visible to tenants
-- Documents obligatoires (contrat, EDL entrée, assurance) doivent être
-- visibles par le locataire pour que le dashboard tenant fonctionne.

-- Vérification diagnostique (à exécuter manuellement si besoin) :
-- SELECT id, type, title, visible_tenant
-- FROM documents
-- WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
-- ORDER BY created_at;

-- Corriger les documents obligatoires du bail test
UPDATE documents
SET visible_tenant = true, updated_at = now()
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
  AND type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

-- Règle générale : tous les contrats de bail, EDL et assurances
-- devraient être visibles par les locataires par défaut
UPDATE documents
SET visible_tenant = true, updated_at = now()
WHERE type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);
