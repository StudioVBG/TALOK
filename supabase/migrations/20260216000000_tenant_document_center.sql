-- =============================================================================
-- Migration : Tenant Document Center
-- Date      : 2026-02-16
-- Auteur    : Audit UX/UI — Refonte gestion documentaire locataire
--
-- Objectif  : Supporter le Document Center unifié côté locataire avec :
--   1. RPC tenant_document_center() — endpoint unique pour les 3 zones
--   2. Vue v_tenant_key_documents — 4 documents clés par locataire
--   3. Vue v_tenant_pending_actions — actions en attente agrégées
--   4. Index composite optimisé pour les requêtes du Document Center
--   5. RPC tenant_documents_search() — recherche full-text améliorée
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. INDEX COMPOSITE pour les requêtes Document Center
--    Optimise : SELECT * FROM documents WHERE tenant_id = ? ORDER BY created_at DESC
--    et       : SELECT * FROM documents WHERE tenant_id = ? AND type = ?
-- =============================================================================

-- Index composite tenant_id + type + created_at (DESC) pour la zone "Tous les documents"
CREATE INDEX IF NOT EXISTS idx_documents_tenant_type_date
  ON documents (tenant_id, type, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Index composite lease_id + type + created_at (DESC) pour les docs liés au bail
CREATE INDEX IF NOT EXISTS idx_documents_lease_type_date
  ON documents (lease_id, type, created_at DESC)
  WHERE lease_id IS NOT NULL;


-- =============================================================================
-- 2. VUE : v_tenant_key_documents
--    Retourne les 4 documents clés les plus récents par locataire :
--    bail, quittance, EDL d'entrée, attestation d'assurance
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
    -- Catégorie normalisée pour les 4 slots
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
        -- Prioriser les documents "final" et "signed"
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
  'Documents clés par locataire (bail, dernière quittance, EDL entrée, assurance). Retourne le plus récent/pertinent pour chaque slot.';


-- =============================================================================
-- 3. VUE : v_tenant_pending_actions
--    Agrège les actions en attente pour un locataire :
--    - Bail à signer
--    - EDL à signer
--    - Attestation d'assurance manquante
-- =============================================================================

CREATE OR REPLACE VIEW v_tenant_pending_actions AS

-- Action : Bail à signer
SELECT
  ls.profile_id AS tenant_profile_id,
  'sign_lease' AS action_type,
  l.id AS entity_id,
  'Signer mon bail' AS action_label,
  'Votre bail est prêt et attend votre signature.' AS action_description,
  '/tenant/onboarding/sign' AS action_href,
  'high' AS priority,
  l.created_at AS action_created_at
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE ls.signature_status = 'pending'
  AND ls.signed_at IS NULL
  AND l.statut IN ('pending_signature', 'partially_signed')
  AND ls.role IN ('locataire_principal', 'colocataire')

UNION ALL

-- Action : EDL à signer (via le système de signature unifié)
SELECT
  sp.profile_id AS tenant_profile_id,
  'sign_edl' AS action_type,
  ss.entity_id AS entity_id,
  'Signer l''état des lieux' AS action_label,
  'Un état des lieux est en attente de votre signature.' AS action_description,
  '/tenant/documents' AS action_href,
  'high' AS priority,
  ss.created_at AS action_created_at
FROM signature_participants sp
JOIN signature_sessions ss ON ss.id = sp.session_id
WHERE sp.status IN ('pending', 'notified')
  AND ss.status IN ('pending', 'ongoing')
  AND ss.entity_type = 'edl'
  AND sp.role IN ('locataire_principal', 'colocataire')

UNION ALL

-- Action : Attestation d'assurance manquante
SELECT
  ls.profile_id AS tenant_profile_id,
  'upload_insurance' AS action_type,
  l.property_id AS entity_id,
  'Déposer l''attestation d''assurance' AS action_label,
  'Obligatoire pour activer votre bail.' AS action_description,
  '/tenant/documents' AS action_href,
  'medium' AS priority,
  l.created_at AS action_created_at
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND l.statut IN ('active', 'pending_signature', 'partially_signed', 'fully_signed')
  AND NOT EXISTS (
    SELECT 1 FROM documents d
    WHERE d.tenant_id = ls.profile_id
      AND d.property_id = l.property_id
      AND d.type IN ('attestation_assurance', 'assurance_pno')
      AND (d.verification_status IS NULL OR d.verification_status != 'rejected')
  );

COMMENT ON VIEW v_tenant_pending_actions IS
  'Actions en attente par locataire : baux à signer, EDL à signer, documents manquants. Utilisé par la zone "À faire" du Document Center.';


-- =============================================================================
-- 4. RPC : tenant_document_center()
--    Endpoint unique qui retourne toutes les données pour les 3 zones
--    du Document Center en un seul appel.
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
  -- Résoudre le profile_id (paramètre ou utilisateur courant)
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

  -- Zone 1 : Actions en attente
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

  -- Zone 2 : Documents clés (4 slots)
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

  -- Zone 3 : Tous les documents (les 50 plus récents, dédoublonnés)
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
    WHERE (d.tenant_id = v_profile_id
      OR d.lease_id IN (
        SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
      )
    )
    ORDER BY d.type, COALESCE(d.lease_id, d.property_id, d.id), d.created_at DESC
    LIMIT 100
  ) sub
  LIMIT 50;

  -- Stats rapides
  SELECT jsonb_build_object(
    'total_documents', (
      SELECT COUNT(*) FROM documents d
      WHERE d.tenant_id = v_profile_id
        OR d.lease_id IN (SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id)
    ),
    'pending_actions_count', jsonb_array_length(v_pending_actions),
    'has_bail', v_key_documents ? 'bail',
    'has_quittance', v_key_documents ? 'quittance',
    'has_edl', v_key_documents ? 'edl',
    'has_assurance', v_key_documents ? 'assurance'
  ) INTO v_stats;

  -- Résultat final
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
  'Endpoint unique pour le Document Center locataire. Retourne : pending_actions, key_documents (4 slots), documents (tous, dédoublonnés), stats.';

-- Accès pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.tenant_document_center TO authenticated;


-- =============================================================================
-- 5. RPC : tenant_documents_search()
--    Recherche full-text améliorée dans les documents du locataire
--    avec filtres par type, période et tri.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_documents_search(
  p_query TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_period TEXT DEFAULT NULL,        -- '1m', '3m', '6m', '1y', 'all'
  p_sort TEXT DEFAULT 'date_desc',   -- 'date_desc', 'date_asc', 'type'
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
  -- Résoudre le profile_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found', 'documents', '[]'::jsonb);
  END IF;

  -- Calculer la date de début de période
  v_period_start := CASE p_period
    WHEN '1m' THEN NOW() - INTERVAL '1 month'
    WHEN '3m' THEN NOW() - INTERVAL '3 months'
    WHEN '6m' THEN NOW() - INTERVAL '6 months'
    WHEN '1y' THEN NOW() - INTERVAL '1 year'
    ELSE NULL -- Pas de filtre de date
  END;

  -- Requête avec filtres dynamiques
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
    -- Filtre full-text
    AND (p_query IS NULL OR p_query = '' OR
      d.search_vector @@ plainto_tsquery('french', p_query)
      OR d.title ILIKE '%' || p_query || '%'
      OR d.type ILIKE '%' || p_query || '%'
    )
    -- Filtre par type
    AND (p_type IS NULL OR p_type = 'all' OR d.type = p_type)
    -- Filtre par période
    AND (v_period_start IS NULL OR d.created_at >= v_period_start)
    -- Tri
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
  'Recherche full-text dans les documents du locataire avec filtres (type, période) et tri. Utilisé par la zone "Tous les documents" du Document Center.';

GRANT EXECUTE ON FUNCTION public.tenant_documents_search TO authenticated;


-- =============================================================================
-- 6. RLS : Politiques pour les vues (sécurité)
--    Les vues utilisent SECURITY DEFINER dans les RPC, mais on ajoute
--    des politiques de sécurité sur les tables sous-jacentes pour les accès directs.
-- =============================================================================

-- S'assurer que les lease_signers sont accessibles pour les vues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lease_signers' AND policyname = 'lease_signers_tenant_view_for_doc_center'
  ) THEN
    CREATE POLICY "lease_signers_tenant_view_for_doc_center"
      ON lease_signers
      FOR SELECT
      TO authenticated
      USING (
        profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      );
  END IF;
END $$;


-- =============================================================================
-- 7. TRIGGER : Mettre à jour search_vector lors de l'insertion/modification
--    pour supporter la recherche full-text améliorée
-- =============================================================================

CREATE OR REPLACE FUNCTION update_document_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('french', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.type, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.original_filename, '')), 'C') ||
    setweight(to_tsvector('french', COALESCE(NEW.metadata->>'description', '')), 'D');
  RETURN NEW;
END;
$$;

-- Le trigger peut déjà exister, on le recrée proprement
DROP TRIGGER IF EXISTS trg_documents_search_vector ON documents;
CREATE TRIGGER trg_documents_search_vector
  BEFORE INSERT OR UPDATE OF title, type, original_filename, metadata
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_search_vector();


-- =============================================================================
-- 8. BACKFILL : Recalculer search_vector pour les documents existants
--    qui n'ont pas encore de vecteur de recherche
-- =============================================================================

UPDATE documents
SET search_vector = 
  setweight(to_tsvector('french', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('french', COALESCE(type, '')), 'B') ||
  setweight(to_tsvector('french', COALESCE(original_filename, '')), 'C') ||
  setweight(to_tsvector('french', COALESCE(metadata->>'description', '')), 'D')
WHERE search_vector IS NULL;


COMMIT;

-- =============================================================================
-- Notes de migration :
--
-- Usage côté frontend (React Query) :
--
--   // Charger le Document Center complet en 1 appel
--   const { data } = await supabase.rpc('tenant_document_center');
--   // data.pending_actions → Zone "À faire"
--   // data.key_documents   → Zone "Documents clés" (bail, quittance, edl, assurance)
--   // data.documents       → Zone "Tous les documents"
--   // data.stats           → Compteurs et flags
--
--   // Recherche avec filtres
--   const { data } = await supabase.rpc('tenant_documents_search', {
--     p_query: 'bail',
--     p_type: 'quittance',
--     p_period: '3m',
--     p_sort: 'date_desc',
--   });
--
-- Rollback :
--   DROP FUNCTION IF EXISTS public.tenant_document_center;
--   DROP FUNCTION IF EXISTS public.tenant_documents_search;
--   DROP VIEW IF EXISTS v_tenant_key_documents;
--   DROP VIEW IF EXISTS v_tenant_pending_actions;
--   DROP INDEX IF EXISTS idx_documents_tenant_type_date;
--   DROP INDEX IF EXISTS idx_documents_lease_type_date;
-- =============================================================================
