-- Migration: Unifier tenant_documents dans la table documents
-- Les CNI et autres pieces d'identite locataire sont dans tenant_documents
-- mais invisibles dans le systeme unifie. Cette migration les copie.

DO $$
DECLARE
  migrated_count INT := 0;
BEGIN
  -- Verifier que tenant_documents existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'tenant_documents'
  ) THEN
    RAISE NOTICE 'Table tenant_documents absente, rien a migrer';
    RETURN;
  END IF;

  -- Copier les documents qui ne sont pas deja dans documents (par storage_path)
  INSERT INTO documents (
    type, category, title, original_filename,
    tenant_id, owner_id,
    storage_path, file_size, mime_type,
    uploaded_by, is_generated, ged_status,
    visible_tenant, verification_status,
    metadata, created_at, updated_at
  )
  SELECT
    CASE
      WHEN td.document_type ILIKE '%recto%' OR td.document_type = 'cni_recto' THEN 'cni_recto'
      WHEN td.document_type ILIKE '%verso%' OR td.document_type = 'cni_verso' THEN 'cni_verso'
      WHEN td.document_type = 'passeport' THEN 'passeport'
      WHEN td.document_type = 'titre_sejour' THEN 'titre_sejour'
      WHEN td.document_type ILIKE '%identit%' THEN 'piece_identite'
      ELSE COALESCE(td.document_type, 'autre')
    END AS type,
    'identite' AS category,
    CASE
      WHEN td.document_type ILIKE '%recto%' OR td.document_type = 'cni_recto'
        THEN 'Carte d''identite (recto)'
      WHEN td.document_type ILIKE '%verso%' OR td.document_type = 'cni_verso'
        THEN 'Carte d''identite (verso)'
      WHEN td.document_type = 'passeport' THEN 'Passeport'
      WHEN td.document_type = 'titre_sejour' THEN 'Titre de sejour'
      ELSE COALESCE(td.file_name, 'Document identite')
    END AS title,
    td.file_name AS original_filename,
    td.tenant_profile_id AS tenant_id,
    NULL AS owner_id,
    td.file_path AS storage_path,
    td.file_size,
    td.mime_type,
    td.uploaded_by,
    false AS is_generated,
    'active' AS ged_status,
    true AS visible_tenant,
    CASE WHEN td.is_valid = true THEN 'verified' ELSE 'pending' END AS verification_status,
    jsonb_build_object(
      'migrated_from', 'tenant_documents',
      'original_id', td.id,
      'ocr_confidence', td.ocr_confidence,
      'extracted_data', td.extracted_data
    ) AS metadata,
    td.created_at,
    COALESCE(td.updated_at, td.created_at)
  FROM tenant_documents td
  WHERE NOT EXISTS (
    SELECT 1 FROM documents d
    WHERE d.storage_path = td.file_path
  )
  AND td.file_path IS NOT NULL
  AND td.file_path != '';

  GET DIAGNOSTICS migrated_count = ROW_COUNT;

  RAISE NOTICE 'Migration tenant_documents: % documents copies vers documents', migrated_count;

  -- Le trigger auto_fill_document_fk completera owner_id et property_id
  -- via lease_signers si disponible
END $$;
