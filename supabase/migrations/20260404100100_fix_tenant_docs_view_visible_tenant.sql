-- =====================================================
-- MIGRATION: Ajouter filtre visible_tenant à la vue v_tenant_accessible_documents
-- Date: 2026-04-04
--
-- PROBLÈME: La vue a été créée le 2026-02-23 (migration 20260223000002)
-- AVANT l'ajout de la colonne visible_tenant (migration 20260306000000).
-- Résultat : la vue ne filtre pas visible_tenant, donc un propriétaire
-- qui cache un document au locataire n'est pas respecté via cette vue.
--
-- FIX: Recréer la vue avec le filtre visible_tenant.
-- Logique : le tenant voit le document SI :
--   - visible_tenant = true (le proprio l'a rendu visible) OU
--   - tenant_id = user_profile_id() (c'est un doc uploadé par le tenant lui-même)
-- =====================================================

CREATE OR REPLACE VIEW public.v_tenant_accessible_documents AS
SELECT DISTINCT ON (d.id) d.*
FROM public.documents d
WHERE
  -- Documents directement liés au locataire (uploadés par lui)
  d.tenant_id = public.user_profile_id()
  -- Documents liés aux baux du locataire (visible_tenant requis)
  OR (
    d.visible_tenant = true
    AND d.lease_id IN (
      SELECT ls.lease_id
      FROM public.lease_signers ls
      WHERE ls.profile_id = public.user_profile_id()
    )
  )
  -- Documents partagés de la propriété (diagnostics, EDL, etc.) — visible_tenant requis
  OR (
    d.visible_tenant = true
    AND d.property_id IN (
      SELECT l.property_id
      FROM public.leases l
      JOIN public.lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = public.user_profile_id()
        AND l.property_id IS NOT NULL
    )
    AND d.type IN (
      'diagnostic_performance', 'dpe', 'erp', 'crep', 'amiante',
      'electricite', 'gaz', 'reglement_copro', 'notice_information',
      'EDL_entree', 'EDL_sortie', 'edl', 'edl_entree', 'edl_sortie'
    )
  );

COMMENT ON VIEW public.v_tenant_accessible_documents IS
  'SOTA 2026: Vue unifiée des documents accessibles par le locataire. Filtre visible_tenant=true sauf pour les documents uploadés par le tenant lui-même.';
