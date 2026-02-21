-- =====================================================
-- MIGRATION SOTA 2026: Vues d'accès documents optimisées
-- Date: 2026-02-23
--
-- PROBLÈME CORRIGÉ:
--   Le hook use-documents.ts fait 3 requêtes séparées pour le locataire
--   (directDocs, leaseDocs, propertyDocs) + déduplication côté client.
--   Le propriétaire fait 2 requêtes (ownerDocs, propertyDocs).
--   C'est lent, fragile, et source de bugs de visibilité.
--
-- FIX:
--   Deux vues read-only qui unifient la logique de visibilité :
--   - v_tenant_accessible_documents : tout ce qu'un locataire peut voir
--   - v_owner_accessible_documents : tout ce qu'un propriétaire peut voir
--
-- SÉCURITÉ:
--   - Vues read-only (SELECT uniquement)
--   - Utilisent user_profile_id() SECURITY DEFINER (déjà existant et testé)
--   - Additives : aucun impact sur INSERT/UPDATE/DELETE des documents
--   - RLS hérité de la table documents (les vues ne contournent pas RLS)
-- =====================================================

BEGIN;

-- ============================================
-- 1. VUE LOCATAIRE : Documents accessibles
-- ============================================
CREATE OR REPLACE VIEW public.v_tenant_accessible_documents AS
SELECT DISTINCT ON (d.id) d.*
FROM public.documents d
WHERE
  -- Documents directement liés au locataire
  d.tenant_id = public.user_profile_id()
  -- Documents liés aux baux du locataire
  OR d.lease_id IN (
    SELECT ls.lease_id
    FROM public.lease_signers ls
    WHERE ls.profile_id = public.user_profile_id()
  )
  -- Documents partagés de la propriété (diagnostics, EDL, etc.)
  OR (
    d.property_id IN (
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
  'SOTA 2026: Vue unifiée de tous les documents accessibles par le locataire connecté (via tenant_id, lease_id, ou property_id pour les types partagés).';

-- ============================================
-- 2. VUE PROPRIÉTAIRE : Documents accessibles
-- ============================================
CREATE OR REPLACE VIEW public.v_owner_accessible_documents AS
SELECT DISTINCT ON (d.id) d.*
FROM public.documents d
WHERE
  -- Documents directement liés au propriétaire
  d.owner_id = public.user_profile_id()
  -- Documents liés à ses propriétés (y compris ceux uploadés par les locataires)
  OR d.property_id IN (
    SELECT p.id
    FROM public.properties p
    WHERE p.owner_id = public.user_profile_id()
  );

COMMENT ON VIEW public.v_owner_accessible_documents IS
  'SOTA 2026: Vue unifiée de tous les documents accessibles par le propriétaire connecté (via owner_id ou property_id).';

-- ============================================
-- 3. GRANTS pour les rôles authentifiés
-- ============================================
GRANT SELECT ON public.v_tenant_accessible_documents TO authenticated;
GRANT SELECT ON public.v_owner_accessible_documents TO authenticated;

COMMIT;
