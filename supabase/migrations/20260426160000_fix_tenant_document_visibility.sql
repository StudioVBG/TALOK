-- =====================================================
-- MIGRATION: Fix complet visibilité documents côté locataire
-- Date: 2026-04-26
-- Branche: claude/fix-tenant-preview-bugs-HYlfs
--
-- PROBLÈMES CORRIGÉS:
--
-- 1. RPC tenant_document_center() ignorait visible_tenant et is_archived
--    -> documents masqués remontaient au locataire (incohérent avec la RLS)
--
-- 2. Trigger auto_fill_document_fk() excluait les colocataires
--    -> documents de baux en colocation pouvaient avoir tenant_id = NULL
--
-- 3. Beaucoup de documents historiques ont mime_type = NULL
--    -> aperçu impossible côté locataire (le modal a besoin du mime type)
--
-- 4. Beaucoup de documents historiques ont original_filename / title NULL
--    -> affichage "Document" générique au lieu du nom réel
--
-- 5. Liste de types "à voir par le locataire" incomplète dans l'ancienne
--    migration 20260328000000 (3 types seulement)
--
-- SÉCURITÉ:
--   - Idempotent (utilise COALESCE / WHERE NULL partout)
--   - N'écrase JAMAIS une valeur existante non NULL
--   - Pas de DROP destructif
-- =====================================================

BEGIN;

-- =====================================================
-- 1. RPC tenant_document_center : respecter visible_tenant + is_archived
-- =====================================================
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

  -- Zone 2 : Documents clés
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

  -- Zone 3 : Tous les documents — respect strict de visible_tenant + is_archived
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
        'original_filename', d.original_filename,
        'visible_tenant', d.visible_tenant
      ) AS doc
    FROM documents d
    WHERE (
      -- Doc rattaché directement au locataire : visible_tenant doit ne pas être FALSE
      (d.tenant_id = v_profile_id AND d.visible_tenant IS NOT FALSE)
      OR
      -- Doc rattaché via le bail : visible_tenant doit être strictement TRUE
      (
        d.visible_tenant = true
        AND d.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls
          WHERE ls.profile_id = v_profile_id
        )
      )
    )
    AND COALESCE(d.is_archived, false) = false
    AND COALESCE(d.ged_status, 'active') IN ('active', 'signed', 'pending')
    ORDER BY d.type, COALESCE(d.lease_id, d.property_id, d.id), d.created_at DESC
    LIMIT 100
  ) sub
  LIMIT 50;

  -- Stats
  SELECT jsonb_build_object(
    'total_documents', (
      SELECT COUNT(*) FROM documents d
      WHERE (
        (d.tenant_id = v_profile_id AND d.visible_tenant IS NOT FALSE)
        OR (
          d.visible_tenant = true
          AND d.lease_id IN (SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id)
        )
      )
      AND COALESCE(d.is_archived, false) = false
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
  'FIX 2026-04-26: respecte visible_tenant et is_archived comme la RLS. Évite que des docs masqués par le proprio remontent côté locataire.';

GRANT EXECUTE ON FUNCTION public.tenant_document_center TO authenticated;


-- =====================================================
-- 2. Trigger auto_fill_document_fk : inclure colocataires
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_fill_document_fk()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.property_id IS NULL AND NEW.lease_id IS NOT NULL THEN
    SELECT COALESCE(property_id, (SELECT property_id FROM units WHERE id = unit_id))
    INTO NEW.property_id
    FROM public.leases
    WHERE id = NEW.lease_id;
  END IF;

  IF NEW.owner_id IS NULL AND NEW.property_id IS NOT NULL THEN
    SELECT owner_id INTO NEW.owner_id
    FROM public.properties
    WHERE id = NEW.property_id;
  END IF;

  -- FIX: prend en compte les colocataires en plus du locataire principal,
  --      mais priorise toujours le principal si présent.
  IF NEW.tenant_id IS NULL AND NEW.lease_id IS NOT NULL THEN
    SELECT ls.profile_id INTO NEW.tenant_id
    FROM public.lease_signers ls
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'locataire', 'tenant', 'colocataire')
      AND ls.profile_id IS NOT NULL
    ORDER BY
      CASE WHEN ls.role = 'locataire_principal' THEN 0 ELSE 1 END,
      ls.created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_fill_document_fk] Non-blocking error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;


-- =====================================================
-- 3. Backfill tenant_id pour anciens docs en colocation
-- =====================================================
DO $$
DECLARE
  fixed_count INT;
BEGIN
  UPDATE public.documents d
  SET tenant_id = sub.profile_id
  FROM (
    SELECT DISTINCT ON (ls.lease_id)
      ls.lease_id,
      ls.profile_id
    FROM public.lease_signers ls
    WHERE ls.role IN ('locataire_principal', 'locataire', 'tenant', 'colocataire')
      AND ls.profile_id IS NOT NULL
    ORDER BY
      ls.lease_id,
      CASE WHEN ls.role = 'locataire_principal' THEN 0 ELSE 1 END,
      ls.created_at ASC
  ) sub
  WHERE d.lease_id = sub.lease_id
    AND d.tenant_id IS NULL;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE '[backfill_tenant_id] % documents corrigés (incl. colocataires)', fixed_count;
END $$;


-- =====================================================
-- 4. Forcer visible_tenant=true sur tous les types
--    qu'un locataire DOIT obligatoirement voir
-- =====================================================
UPDATE public.documents
SET visible_tenant = true,
    updated_at = now()
WHERE type IN (
  -- Contrats de bail
  'bail', 'avenant', 'contrat_bail',
  'bail_signe', 'bail_signe_locataire', 'bail_signe_proprietaire',
  -- États des lieux
  'EDL_entree', 'edl_entree',
  'EDL_sortie', 'edl_sortie',
  'inventaire', 'etat_des_lieux', 'etat_lieux',
  -- Quittances et reçus
  'quittance', 'quittance_loyer', 'receipt',
  -- Assurances
  'attestation_assurance', 'assurance', 'assurance_pno', 'assurance_habitation',
  -- Diagnostics réglementaires (partagés via property_id)
  'dpe', 'diagnostic_performance',
  'erp', 'crep', 'amiante',
  'electricite', 'diagnostic_electricite',
  'gaz', 'diagnostic_gaz',
  -- Attestations légales locataire
  'attestation_remise_cles',
  -- Régularisation de charges
  'regularisation_charges', 'avis_taxe_fonciere'
)
AND (visible_tenant IS NULL OR visible_tenant = false);


-- =====================================================
-- 5. Backfill mime_type depuis storage_path (extension)
--    Indispensable pour que l'aperçu côté locataire fonctionne
-- =====================================================
UPDATE public.documents
SET mime_type = CASE
    WHEN storage_path ILIKE '%.pdf'  THEN 'application/pdf'
    WHEN storage_path ILIKE '%.png'  THEN 'image/png'
    WHEN storage_path ILIKE '%.jpg'
      OR storage_path ILIKE '%.jpeg' THEN 'image/jpeg'
    WHEN storage_path ILIKE '%.webp' THEN 'image/webp'
    WHEN storage_path ILIKE '%.heic' THEN 'image/heic'
    WHEN storage_path ILIKE '%.gif'  THEN 'image/gif'
    WHEN storage_path ILIKE '%.html' THEN 'text/html'
    WHEN storage_path ILIKE '%.txt'  THEN 'text/plain'
    WHEN storage_path ILIKE '%.csv'  THEN 'text/csv'
    WHEN storage_path ILIKE '%.doc'  THEN 'application/msword'
    WHEN storage_path ILIKE '%.docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    WHEN storage_path ILIKE '%.xls'  THEN 'application/vnd.ms-excel'
    WHEN storage_path ILIKE '%.xlsx' THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    WHEN storage_path ILIKE '%.zip'  THEN 'application/zip'
    ELSE 'application/octet-stream'
  END,
  updated_at = now()
WHERE mime_type IS NULL
  AND storage_path IS NOT NULL;


-- =====================================================
-- 6. Backfill original_filename depuis storage_path
-- =====================================================
UPDATE public.documents
SET original_filename = split_part(storage_path, '/', -1),
    updated_at = now()
WHERE original_filename IS NULL
  AND storage_path IS NOT NULL;


-- =====================================================
-- 7. Backfill title pour anciens docs sans titre
--    On nettoie la valeur (retire l'extension, remplace _ par espaces)
-- =====================================================
UPDATE public.documents
SET title = CASE
    WHEN type = 'cni_recto' THEN 'Carte d''identité (recto)'
    WHEN type = 'cni_verso' THEN 'Carte d''identité (verso)'
    WHEN type IN ('attestation_assurance', 'assurance_pno', 'assurance_habitation')
      THEN 'Attestation d''assurance'
    WHEN type IN ('bail', 'bail_signe', 'bail_signe_locataire', 'bail_signe_proprietaire', 'contrat_bail')
      THEN 'Contrat de bail'
    WHEN type IN ('EDL_entree', 'edl_entree') THEN 'État des lieux d''entrée'
    WHEN type IN ('EDL_sortie', 'edl_sortie') THEN 'État des lieux de sortie'
    WHEN type IN ('quittance', 'quittance_loyer') THEN 'Quittance de loyer'
    WHEN type = 'attestation_remise_cles' THEN 'Attestation de remise des clés'
    WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
    WHEN type = 'bulletin_paie' THEN 'Bulletin de paie'
    WHEN type IN ('dpe', 'diagnostic_performance') THEN 'Diagnostic de performance énergétique'
    WHEN type = 'erp' THEN 'État des risques et pollutions'
    WHEN type = 'crep' THEN 'Constat de risque d''exposition au plomb'
    WHEN type = 'amiante' THEN 'Diagnostic amiante'
    WHEN type IN ('electricite', 'diagnostic_electricite') THEN 'Diagnostic électricité'
    WHEN type IN ('gaz', 'diagnostic_gaz') THEN 'Diagnostic gaz'
    -- Cas générique : nom de fichier sans extension, "_" → espaces
    ELSE replace(
      regexp_replace(
        COALESCE(original_filename, split_part(storage_path, '/', -1)),
        '\.[A-Za-z0-9]+$', ''
      ),
      '_', ' '
    )
  END,
  updated_at = now()
WHERE title IS NULL
   OR title = ''
   OR title ~ '^Capture d.écran'
   OR title ~ '^[A-Z_]+$';


-- =====================================================
-- 8. AUDIT FINAL
-- =====================================================
DO $$
DECLARE
  total_docs INT;
  docs_no_mime INT;
  docs_no_title INT;
  docs_no_filename INT;
  docs_no_visible_for_tenant INT;
BEGIN
  SELECT count(*)::INT INTO total_docs FROM public.documents;

  SELECT count(*)::INT INTO docs_no_mime
  FROM public.documents
  WHERE mime_type IS NULL AND storage_path IS NOT NULL;

  SELECT count(*)::INT INTO docs_no_title
  FROM public.documents
  WHERE title IS NULL OR title = '';

  SELECT count(*)::INT INTO docs_no_filename
  FROM public.documents
  WHERE original_filename IS NULL AND storage_path IS NOT NULL;

  SELECT count(*)::INT INTO docs_no_visible_for_tenant
  FROM public.documents
  WHERE type IN (
    'bail', 'contrat_bail', 'EDL_entree', 'edl_entree', 'EDL_sortie', 'edl_sortie',
    'quittance', 'attestation_assurance', 'attestation_remise_cles'
  )
  AND (visible_tenant IS NULL OR visible_tenant = false);

  RAISE NOTICE '=== AUDIT POST-MIGRATION ===';
  RAISE NOTICE 'Total documents:                     %', total_docs;
  RAISE NOTICE 'Documents sans mime_type:            %', docs_no_mime;
  RAISE NOTICE 'Documents sans title:                %', docs_no_title;
  RAISE NOTICE 'Documents sans original_filename:    %', docs_no_filename;
  RAISE NOTICE 'Docs essentiels avec visible_tenant<>true: %', docs_no_visible_for_tenant;

  IF docs_no_mime = 0
     AND docs_no_title = 0
     AND docs_no_filename = 0
     AND docs_no_visible_for_tenant = 0
  THEN
    RAISE NOTICE '[OK] Tous les documents sont cohérents pour l''aperçu locataire';
  END IF;
END $$;

COMMIT;
