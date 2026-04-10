-- =============================================================================
-- Migration : Fix protected document visibility for tenants
-- Date      : 2026-04-10
-- Bug       : Tenants hit 403 when downloading quittances from /tenant/documents
--
-- Root cause : The RPC `tenant_document_center()` and the view
--   `v_tenant_key_documents` return documents regardless of `visible_tenant`,
--   but `/api/documents/[id]/signed-url` enforces `visible_tenant != false`
--   (consistent with the `documents` table RLS). So a quittance with
--   visible_tenant = false shows up in the UI and then 403s on download.
--
-- Additionally, quittances (and other legally-mandatory documents like
-- bail, EDL, attestation de remise des cles) must always be visible to
-- tenants per Art. 21 Loi du 6 juillet 1989. The existing trigger
-- `force_visible_tenant_on_generated` only protects docs with
-- is_generated = true, which quittances from /api/payments/[pid]/receipt
-- are not.
--
-- Fix (4 parts in one migration):
--   1. Backfill visible_tenant = true for all protected document types
--   2. Harden trigger: force visible_tenant = true for protected types too
--   3. Patch view v_tenant_key_documents to filter visible_tenant
--   4. Patch RPCs tenant_document_center() and tenant_documents_search()
--      to filter visible_tenant (exception: tenant always sees their own
--      uploads via uploaded_by).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. BACKFILL : Force visible_tenant = true for protected document types
-- =============================================================================

UPDATE documents
SET visible_tenant = true, updated_at = now()
WHERE type IN (
  'quittance',
  'bail', 'contrat', 'avenant',
  'bail_signe_locataire', 'bail_signe_proprietaire',
  'EDL_entree', 'edl_entree', 'EDL_sortie', 'edl_sortie',
  'attestation_remise_cles'
)
AND visible_tenant IS DISTINCT FROM true;


-- =============================================================================
-- 2. HARDEN TRIGGER : force visible_tenant on generated docs AND protected types
-- =============================================================================

CREATE OR REPLACE FUNCTION public.force_visible_tenant_on_generated()
RETURNS TRIGGER AS $$
BEGIN
    -- Generated documents are always visible to tenants
    IF NEW.is_generated = true THEN
        NEW.visible_tenant := true;
    END IF;

    -- Legally-mandatory document types must always be visible to tenants
    -- (quittances, bail, EDL, attestation de remise des cles)
    IF NEW.type IN (
        'quittance',
        'bail', 'contrat', 'avenant',
        'bail_signe_locataire', 'bail_signe_proprietaire',
        'EDL_entree', 'edl_entree', 'EDL_sortie', 'edl_sortie',
        'attestation_remise_cles'
    ) THEN
        NEW.visible_tenant := true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.force_visible_tenant_on_generated() IS
  'Coerces visible_tenant = true for (a) any is_generated=true document and '
  '(b) legally-mandatory document types (quittance, bail, EDL, attestation '
  'de remise des cles) regardless of is_generated. Prevents owners from '
  'accidentally hiding documents tenants have a legal right to access.';

-- Recreate trigger (same name, same timing) to pick up the new function body
DROP TRIGGER IF EXISTS trg_force_visible_tenant_on_generated ON documents;
CREATE TRIGGER trg_force_visible_tenant_on_generated
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION public.force_visible_tenant_on_generated();


-- =============================================================================
-- 3. PATCH VIEW : v_tenant_key_documents — filter visible_tenant
-- =============================================================================

CREATE OR REPLACE VIEW v_tenant_key_documents AS
WITH ranked_docs AS (
  SELECT
    d.id,
    d.type,
    d.title,
    d.storage_path,
    d.created_at,
    d.tenant_id,
    d.lease_id,
    d.property_id,
    d.metadata,
    d.verification_status,
    d.ged_status,
    CASE
      WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
      WHEN d.type IN ('quittance') THEN 'quittance'
      WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
      WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
      ELSE NULL
    END AS slot_key,
    ROW_NUMBER() OVER (
      PARTITION BY
        d.tenant_id,
        CASE
          WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
          WHEN d.type IN ('quittance') THEN 'quittance'
          WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
          WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
        END
      ORDER BY
        CASE WHEN (d.metadata->>'final')::boolean = true THEN 0 ELSE 1 END,
        CASE WHEN d.ged_status = 'signed' THEN 0 WHEN d.ged_status = 'active' THEN 1 ELSE 2 END,
        d.created_at DESC
    ) AS rn
  FROM documents d
  WHERE d.tenant_id IS NOT NULL
    AND d.type IN (
      'bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire',
      'quittance',
      'EDL_entree', 'edl_entree', 'inventaire',
      'attestation_assurance', 'assurance_pno'
    )
    -- Only surface documents the tenant can actually download.
    -- Tenant always sees their own uploads (uploaded_by match).
    AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = d.tenant_id)
)
SELECT
  id,
  type,
  title,
  storage_path,
  created_at,
  tenant_id,
  lease_id,
  property_id,
  metadata,
  verification_status,
  ged_status,
  slot_key
FROM ranked_docs
WHERE rn = 1 AND slot_key IS NOT NULL;

COMMENT ON VIEW v_tenant_key_documents IS
  'Documents cles par locataire (bail, derniere quittance, EDL entree, assurance). '
  'Filtre visible_tenant pour ne retourner que les documents effectivement '
  'telechargeables par le locataire (alignement avec /api/documents/[id]/signed-url).';


-- =============================================================================
-- 4. PATCH RPC : tenant_document_center() — filter visible_tenant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_document_center(p_profile_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_pending_actions JSONB;
  v_key_documents JSONB;
  v_all_documents JSONB;
  v_stats JSONB;
BEGIN
  -- Resolve profile_id (parameter or current user)
  IF p_profile_id IS NOT NULL THEN
    v_profile_id := p_profile_id;
  ELSE
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  -- Zone 1 : Pending actions
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'action_type', action_type,
      'entity_id', entity_id,
      'label', action_label,
      'description', action_description,
      'href', action_href,
      'priority', priority,
      'created_at', action_created_at
    ) ORDER BY
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      action_created_at DESC
  ), '[]'::jsonb)
  INTO v_pending_actions
  FROM v_tenant_pending_actions
  WHERE tenant_profile_id = v_profile_id;

  -- Zone 2 : Key documents (4 slots) — view already filters visible_tenant
  SELECT COALESCE(jsonb_object_agg(
    slot_key,
    jsonb_build_object(
      'id', id,
      'type', type,
      'title', title,
      'storage_path', storage_path,
      'created_at', created_at,
      'lease_id', lease_id,
      'property_id', property_id,
      'metadata', COALESCE(metadata, '{}'::jsonb),
      'verification_status', verification_status,
      'ged_status', ged_status
    )
  ), '{}'::jsonb)
  INTO v_key_documents
  FROM v_tenant_key_documents
  WHERE tenant_id = v_profile_id;

  -- Zone 3 : All documents (50 most recent, deduplicated, visible only)
  SELECT COALESCE(jsonb_agg(doc ORDER BY doc->>'created_at' DESC), '[]'::jsonb)
  INTO v_all_documents
  FROM (
    SELECT DISTINCT ON (d.type, COALESCE(d.lease_id, d.property_id, d.id))
      jsonb_build_object(
        'id', d.id,
        'type', d.type,
        'title', d.title,
        'storage_path', d.storage_path,
        'created_at', d.created_at,
        'tenant_id', d.tenant_id,
        'lease_id', d.lease_id,
        'property_id', d.property_id,
        'metadata', COALESCE(d.metadata, '{}'::jsonb),
        'verification_status', d.verification_status,
        'ged_status', d.ged_status,
        'file_size', d.file_size,
        'mime_type', d.mime_type,
        'original_filename', d.original_filename
      ) AS doc
    FROM documents d
    WHERE (
        d.tenant_id = v_profile_id
        OR d.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
        )
      )
      -- Align with /api/documents/[id]/signed-url permission check:
      -- tenant always sees their own uploads; owner-shared docs require
      -- visible_tenant IS NOT FALSE.
      AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = v_profile_id)
    ORDER BY d.type, COALESCE(d.lease_id, d.property_id, d.id), d.created_at DESC
    LIMIT 100
  ) sub
  LIMIT 50;

  -- Stats (must use the same filter to stay consistent with the list)
  SELECT jsonb_build_object(
    'total_documents', (
      SELECT COUNT(*) FROM documents d
      WHERE (
          d.tenant_id = v_profile_id
          OR d.lease_id IN (SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id)
        )
        AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = v_profile_id)
    ),
    'pending_actions_count', jsonb_array_length(v_pending_actions),
    'has_bail', v_key_documents ? 'bail',
    'has_quittance', v_key_documents ? 'quittance',
    'has_edl', v_key_documents ? 'edl',
    'has_assurance', v_key_documents ? 'assurance'
  ) INTO v_stats;

  v_result := jsonb_build_object(
    'pending_actions', v_pending_actions,
    'key_documents', v_key_documents,
    'documents', v_all_documents,
    'stats', v_stats
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.tenant_document_center IS
  'Endpoint unique pour le Document Center locataire. Retourne : pending_actions, '
  'key_documents (4 slots), documents (tous, dedoublonnes), stats. '
  'Filtre visible_tenant pour ne retourner que les documents effectivement '
  'telechargeables par le locataire (alignement avec /api/documents/[id]/signed-url).';

GRANT EXECUTE ON FUNCTION public.tenant_document_center TO authenticated;


-- =============================================================================
-- 5. PATCH RPC : tenant_documents_search() — filter visible_tenant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_documents_search(
  p_query TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_period TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'date_desc',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_period_start TIMESTAMPTZ;
BEGIN
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found', 'documents', '[]'::jsonb);
  END IF;

  v_period_start := CASE p_period
    WHEN '1m' THEN NOW() - INTERVAL '1 month'
    WHEN '3m' THEN NOW() - INTERVAL '3 months'
    WHEN '6m' THEN NOW() - INTERVAL '6 months'
    WHEN '1y' THEN NOW() - INTERVAL '1 year'
    ELSE NULL
  END;

  SELECT jsonb_build_object(
    'documents', COALESCE(jsonb_agg(doc), '[]'::jsonb),
    'total', COUNT(*) OVER()
  )
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', d.id,
      'type', d.type,
      'title', d.title,
      'storage_path', d.storage_path,
      'created_at', d.created_at,
      'tenant_id', d.tenant_id,
      'lease_id', d.lease_id,
      'property_id', d.property_id,
      'metadata', COALESCE(d.metadata, '{}'::jsonb),
      'verification_status', d.verification_status,
      'ged_status', d.ged_status,
      'file_size', d.file_size,
      'mime_type', d.mime_type,
      'original_filename', d.original_filename,
      'is_recent', (d.created_at > NOW() - INTERVAL '7 days')
    ) AS doc,
    d.created_at,
    d.type
    FROM documents d
    WHERE (
      d.tenant_id = v_profile_id
      OR d.lease_id IN (
        SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
      )
    )
    -- Align with signed-url permission check (see tenant_document_center)
    AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = v_profile_id)
    AND (p_query IS NULL OR p_query = '' OR
      d.search_vector @@ plainto_tsquery('french', p_query)
      OR d.title ILIKE '%' || p_query || '%'
      OR d.type ILIKE '%' || p_query || '%'
    )
    AND (p_type IS NULL OR p_type = 'all' OR d.type = p_type)
    AND (v_period_start IS NULL OR d.created_at >= v_period_start)
    ORDER BY
      CASE WHEN p_sort = 'date_desc' THEN d.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'date_asc'  THEN d.created_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'type'      THEN d.type END ASC,
      d.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) sub;

  RETURN COALESCE(v_result, jsonb_build_object('documents', '[]'::jsonb, 'total', 0));
END;
$$;

COMMENT ON FUNCTION public.tenant_documents_search IS
  'Recherche full-text dans les documents du locataire avec filtres (type, periode) et tri. '
  'Filtre visible_tenant pour ne retourner que les documents effectivement '
  'telechargeables par le locataire.';

GRANT EXECUTE ON FUNCTION public.tenant_documents_search TO authenticated;


COMMIT;

-- =============================================================================
-- Rollback notes :
--   1. Restore previous trigger body (force only on is_generated = true)
--   2. Restore v_tenant_key_documents without visible_tenant filter
--   3. Restore tenant_document_center() and tenant_documents_search() without
--      visible_tenant filter
--   (See migration 20260216000000_tenant_document_center.sql and
--    20260329190000_force_visible_tenant_generated_docs.sql for original bodies)
-- =============================================================================
