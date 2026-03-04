-- =====================================================
-- MIGRATION: Backfill uploaded_by pour documents existants
-- Date: 2026-03-03
--
-- PROBLÈME:
--   - /api/documents/upload ne renseignait pas uploaded_by
--   - /api/documents/upload-batch ne le faisait que pour les galeries
--   => Les documents existants n'ont pas uploaded_by, ce qui empêche
--      la détection de source inter-compte (locataire vs propriétaire).
--
-- FIX:
--   Backfill uploaded_by en se basant sur le type de document et les FK.
--   Heuristique :
--     1. Types locataire (assurance, CNI, etc.) → uploaded_by = tenant_id
--     2. Types propriétaire (bail, quittance, etc.) → uploaded_by = owner_id
--     3. Documents avec owner_id seul (sans tenant) → uploaded_by = owner_id
--
-- SÉCURITÉ:
--   - UPDATE conditionnel (WHERE uploaded_by IS NULL)
--   - Ne touche pas aux documents déjà renseignés
--   - Non-bloquant : si aucune ligne à MAJ, pas d'effet
-- =====================================================

BEGIN;

-- 1. Documents typiquement uploadés par le locataire
UPDATE public.documents
SET uploaded_by = tenant_id
WHERE uploaded_by IS NULL
  AND tenant_id IS NOT NULL
  AND type IN (
    'attestation_assurance', 'cni_recto', 'cni_verso', 'piece_identite',
    'passeport', 'justificatif_revenus', 'avis_imposition', 'bulletin_paie',
    'rib', 'titre_sejour', 'cni', 'justificatif_domicile'
  );

-- 2. Documents typiquement générés/uploadés par le propriétaire
UPDATE public.documents
SET uploaded_by = owner_id
WHERE uploaded_by IS NULL
  AND owner_id IS NOT NULL
  AND type IN (
    'bail', 'quittance', 'avenant', 'appel_loyer', 'releve_charges',
    'dpe', 'erp', 'crep', 'amiante', 'electricite', 'gaz',
    'diagnostic', 'diagnostic_gaz', 'diagnostic_electricite',
    'diagnostic_plomb', 'diagnostic_amiante', 'diagnostic_termites',
    'diagnostic_performance', 'reglement_copro', 'notice_information',
    'EDL_entree', 'EDL_sortie', 'edl', 'edl_entree', 'edl_sortie',
    'assurance_pno', 'facture', 'contrat', 'engagement_garant'
  );

-- 3. Restant : documents owner sans tenant → attribuer au propriétaire
UPDATE public.documents
SET uploaded_by = owner_id
WHERE uploaded_by IS NULL
  AND owner_id IS NOT NULL
  AND tenant_id IS NULL;

-- 4. Restant : documents avec tenant et owner mais type inconnu → attribuer au tenant
--    (hypothèse : si un tenant est lié, c'est probablement lui qui a uploadé)
UPDATE public.documents
SET uploaded_by = tenant_id
WHERE uploaded_by IS NULL
  AND tenant_id IS NOT NULL
  AND owner_id IS NOT NULL;

COMMIT;
