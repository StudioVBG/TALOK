-- Migration: Rendre les documents de bail visibles aux locataires
-- Contexte: Le route /seal ne définissait pas visible_tenant=true sur les documents de bail
-- Impact: Les locataires ne voyaient pas leur bail dans /tenant/documents

-- S'assurer que tous les documents bail liés à un lease ont visible_tenant=true
UPDATE documents
SET
  visible_tenant = true,
  title = CASE
    WHEN title = 'Bail de location signé' THEN 'Contrat de bail signé'
    ELSE title
  END,
  original_filename = COALESCE(
    original_filename,
    'bail_signe_' || lease_id::text || '.html'
  ),
  updated_at = now()
WHERE
  type = 'bail'
  AND lease_id IS NOT NULL
  AND (visible_tenant IS NULL OR visible_tenant = false);
