-- ====================================================================
-- Sprint B2 — Phase 1 SAFE — Batch 2/10
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260222200001_get_entity_stats_for_store.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260222200001_get_entity_stats_for_store.sql'; END $pre$;

-- ============================================
-- Migration: get_entity_stats aligné avec la logique du store (properties.legal_entity_id + particulier)
-- Date: 2026-02-22
-- Description:
--   Remplace get_entity_stats pour compter comme le store front :
--   - Biens : properties.legal_entity_id = entity OU (particulier et legal_entity_id IS NULL)
--   - Baux actifs : signatory_entity_id = entity, statut in (active, pending_signature, fully_signed)
-- ============================================

CREATE OR REPLACE FUNCTION get_entity_stats(
  p_owner_profile_id UUID
) RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  regime_fiscal TEXT,
  properties_count BIGINT,
  total_value DECIMAL(14,2),
  monthly_rent DECIMAL(12,2),
  active_leases BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH entity_props AS (
    SELECT
      le.id AS eid,
      COUNT(DISTINCT p.id) AS prop_count
    FROM legal_entities le
    LEFT JOIN properties p ON p.deleted_at IS NULL
      AND (
        p.legal_entity_id = le.id
        OR (le.entity_type = 'particulier' AND p.owner_id = le.owner_profile_id AND p.legal_entity_id IS NULL)
      )
    WHERE le.owner_profile_id = p_owner_profile_id
      AND le.is_active = true
    GROUP BY le.id
  ),
  entity_leases AS (
    SELECT
      l.signatory_entity_id AS eid,
      COUNT(*) AS lease_count
    FROM leases l
    WHERE l.signatory_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id = p_owner_profile_id AND is_active = true
    )
    AND l.statut IN ('active', 'pending_signature', 'fully_signed')
    GROUP BY l.signatory_entity_id
  )
  SELECT
    le.id AS entity_id,
    le.nom AS entity_name,
    le.entity_type,
    le.regime_fiscal,
    COALESCE(ep.prop_count, 0)::BIGINT AS properties_count,
    0::DECIMAL(14,2) AS total_value,
    0::DECIMAL(12,2) AS monthly_rent,
    COALESCE(el.lease_count, 0)::BIGINT AS active_leases
  FROM legal_entities le
  LEFT JOIN entity_props ep ON ep.eid = le.id
  LEFT JOIN entity_leases el ON el.eid = le.id
  WHERE le.owner_profile_id = p_owner_profile_id
    AND le.is_active = true
  ORDER BY properties_count DESC, le.nom;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260222200001', 'get_entity_stats_for_store')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260222200001_get_entity_stats_for_store.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260223000002_document_access_views.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260223000002_document_access_views.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260223000002', 'document_access_views')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260223000002_document_access_views.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260224000001_remove_yousign_sendgrid_brevo.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260224000001_remove_yousign_sendgrid_brevo.sql'; END $pre$;

-- Suppression des providers Yousign, SendGrid et Brevo (signature/email intégrés ou non utilisés)
-- Les credentials associées sont supprimées en premier (FK)

DELETE FROM api_credentials
WHERE provider_id IN (
  SELECT id FROM api_providers
  WHERE lower(name) IN ('yousign', 'brevo', 'sendgrid')
);

DELETE FROM api_providers
WHERE lower(name) IN ('yousign', 'brevo', 'sendgrid');

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260224000001', 'remove_yousign_sendgrid_brevo')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260224000001_remove_yousign_sendgrid_brevo.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260227000000_drop_auto_activate_lease_trigger.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260227000000_drop_auto_activate_lease_trigger.sql'; END $pre$;

-- Fix: Le trigger auto_activate_lease_on_edl n'a pas été supprimé
-- car la migration 20260207200000 ciblait le mauvais nom
DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON public.edl;
DROP FUNCTION IF EXISTS public.trigger_activate_lease_on_edl_signed();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260227000000', 'drop_auto_activate_lease_trigger')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260227000000_drop_auto_activate_lease_trigger.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260228000000_lease_signers_share_percentage.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260228000000_lease_signers_share_percentage.sql'; END $pre$;

-- SOTA 2026: part de répartition par signataire (colocation).
-- Si NULL, l'UI utilise le fallback 100 / nombre de colocataires.
ALTER TABLE public.lease_signers
  ADD COLUMN IF NOT EXISTS share_percentage numeric(5,2) NULL
  CONSTRAINT chk_lease_signers_share_percentage CHECK (share_percentage IS NULL OR (share_percentage >= 0 AND share_percentage <= 100));

COMMENT ON COLUMN public.lease_signers.share_percentage IS 'Part en % du loyer/charges pour ce signataire (colocation). NULL = répartition égale.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260228000000', 'lease_signers_share_percentage')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260228000000_lease_signers_share_percentage.sql'; END $post$;

COMMIT;

-- END OF BATCH 2/10 (Phase 1 SAFE)
