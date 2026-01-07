-- Migration : Documents SOTA 2025
-- Date : 2025-12-28
-- 
-- Fonctionnalités :
-- 1. Unification des tables de documents
-- 2. Correction des owner_id/property_id manquants
-- 3. Index full-text pour la recherche
-- 4. Types de documents étendus

BEGIN;

-- ============================================
-- 1. EXTENSION DES TYPES DE DOCUMENTS
-- ============================================

-- Supprimer l'ancienne contrainte
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

-- Ajouter les nouveaux types
ALTER TABLE documents ADD CONSTRAINT documents_type_check CHECK (
  type IN (
    -- Contrats
    'bail', 'avenant', 'engagement_garant', 'bail_signe_locataire', 'bail_signe_proprietaire',
    -- Identité
    'piece_identite', 'cni_recto', 'cni_verso', 'passeport', 'titre_sejour',
    -- Finance
    'quittance', 'facture', 'rib', 'avis_imposition', 'bulletin_paie', 'attestation_loyer',
    -- Assurance
    'attestation_assurance', 'assurance_pno',
    -- Diagnostics
    'diagnostic', 'dpe', 'diagnostic_gaz', 'diagnostic_electricite', 
    'diagnostic_plomb', 'diagnostic_amiante', 'diagnostic_termites', 'erp',
    -- États des lieux
    'EDL_entree', 'EDL_sortie', 'inventaire',
    -- Candidature (migrés depuis application_files)
    'candidature_identite', 'candidature_revenus', 'candidature_domicile', 'candidature_garantie',
    -- Garant (migrés depuis guarantor_documents)
    'garant_identite', 'garant_revenus', 'garant_domicile', 'garant_engagement',
    -- Prestataire
    'devis', 'ordre_mission', 'rapport_intervention',
    -- Copropriété
    'taxe_fonciere', 'taxe_sejour', 'copropriete', 'proces_verbal', 'appel_fonds',
    -- Divers
    'consentement', 'courrier', 'photo', 'justificatif_revenus', 'autre'
  )
);

-- ============================================
-- 2. AJOUT DE COLONNES MANQUANTES
-- ============================================

-- Catégorie pour le filtrage
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT;

-- Application ID (pour les documents de candidature)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES tenant_applications(id) ON DELETE SET NULL;

-- Garant ID (pour les documents de garant)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS guarantor_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Nom original du fichier
ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Hash SHA256 pour déduplication
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sha256 TEXT;

-- Taille du fichier
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Type MIME
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Index de recherche full-text
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- ============================================
-- 3. CORRECTION DES DOCUMENTS EXISTANTS
-- ============================================

-- Mettre à jour les documents liés à un bail qui n'ont pas de owner_id/property_id
UPDATE documents d
SET 
  property_id = COALESCE(d.property_id, l.property_id),
  owner_id = COALESCE(d.owner_id, p.owner_id)
FROM leases l
JOIN properties p ON l.property_id = p.id
WHERE d.lease_id = l.id
  AND (d.property_id IS NULL OR d.owner_id IS NULL);

-- Mettre à jour la catégorie automatiquement
UPDATE documents SET category = CASE
  WHEN type IN ('bail', 'avenant', 'engagement_garant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'contrat'
  WHEN type IN ('piece_identite', 'cni_recto', 'cni_verso', 'passeport', 'titre_sejour') THEN 'identite'
  WHEN type IN ('quittance', 'facture', 'rib', 'avis_imposition', 'bulletin_paie', 'attestation_loyer') THEN 'finance'
  WHEN type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
  WHEN type LIKE 'diagnostic%' OR type IN ('dpe', 'erp') THEN 'diagnostic'
  WHEN type IN ('EDL_entree', 'EDL_sortie', 'inventaire') THEN 'edl'
  WHEN type LIKE 'candidature%' THEN 'candidature'
  WHEN type LIKE 'garant%' THEN 'garant'
  WHEN type IN ('devis', 'ordre_mission', 'rapport_intervention') THEN 'prestataire'
  ELSE 'autre'
END
WHERE category IS NULL;

-- ============================================
-- 4. INDEX FULL-TEXT POUR RECHERCHE
-- ============================================

-- Créer la fonction de mise à jour du vecteur de recherche
CREATE OR REPLACE FUNCTION documents_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('french', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.type, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.original_filename, '')), 'C') ||
    setweight(to_tsvector('french', COALESCE(NEW.metadata->>'nom', '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.metadata->>'prenom', '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mise à jour automatique
DROP TRIGGER IF EXISTS trg_documents_search_vector ON documents;
CREATE TRIGGER trg_documents_search_vector
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION documents_search_vector_update();

-- Mettre à jour les documents existants
UPDATE documents SET search_vector = 
  setweight(to_tsvector('french', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('french', COALESCE(type, '')), 'B') ||
  setweight(to_tsvector('french', COALESCE(original_filename, '')), 'C') ||
  setweight(to_tsvector('french', COALESCE(metadata->>'nom', '')), 'B') ||
  setweight(to_tsvector('french', COALESCE(metadata->>'prenom', '')), 'B');

-- Index GIN pour la recherche full-text
CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON documents USING gin(search_vector);

-- Index sur la catégorie
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);

-- Index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_documents_owner_property ON documents(owner_id, property_id);

-- ============================================
-- 5. MIGRATION DES DONNÉES (application_files → documents)
-- ============================================

-- Ne migrer que si la table source existe et n'est pas vide
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'application_files') THEN
    -- Migrer les fichiers de candidature vers documents
    INSERT INTO documents (
      type,
      application_id,
      tenant_id,
      storage_path,
      original_filename,
      sha256,
      file_size,
      mime_type,
      metadata,
      created_at,
      category
    )
    SELECT 
      CASE af.kind
        WHEN 'identity' THEN 'candidature_identite'
        WHEN 'income' THEN 'candidature_revenus'
        WHEN 'address' THEN 'candidature_domicile'
        WHEN 'guarantee' THEN 'candidature_garantie'
        ELSE 'autre'
      END,
      af.application_id,
      ta.tenant_profile_id,
      af.storage_path,
      af.file_name,
      af.sha256,
      af.size_bytes,
      af.mime_type,
      jsonb_build_object(
        'ocr_provider', af.ocr_provider,
        'ocr_result', af.ocr_result,
        'confidence', af.confidence,
        'migrated_from', 'application_files',
        'original_id', af.id
      ),
      af.uploaded_at,
      'candidature'
    FROM application_files af
    JOIN tenant_applications ta ON ta.id = af.application_id
    WHERE NOT EXISTS (
      SELECT 1 FROM documents d 
      WHERE d.metadata->>'original_id' = af.id::text
        AND d.metadata->>'migrated_from' = 'application_files'
    );
    
    RAISE NOTICE 'Migration application_files terminée';
  END IF;
END $$;

-- ============================================
-- 6. MIGRATION DES DONNÉES (guarantor_documents → documents)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guarantor_documents') THEN
    -- Migrer les documents garant vers documents
    INSERT INTO documents (
      type,
      guarantor_profile_id,
      storage_path,
      original_filename,
      file_size,
      mime_type,
      metadata,
      created_at,
      category
    )
    SELECT 
      CASE gd.document_type
        WHEN 'identity' THEN 'garant_identite'
        WHEN 'income' THEN 'garant_revenus'
        WHEN 'address' THEN 'garant_domicile'
        WHEN 'engagement' THEN 'garant_engagement'
        ELSE 'garant_' || COALESCE(gd.document_type, 'autre')
      END,
      gd.guarantor_profile_id,
      gd.storage_path,
      gd.original_filename,
      gd.file_size,
      gd.mime_type,
      jsonb_build_object(
        'verification_status', gd.verification_status,
        'verified_at', gd.verified_at,
        'verified_by', gd.verified_by,
        'migrated_from', 'guarantor_documents',
        'original_id', gd.id
      ),
      gd.created_at,
      'garant'
    FROM guarantor_documents gd
    WHERE NOT EXISTS (
      SELECT 1 FROM documents d 
      WHERE d.metadata->>'original_id' = gd.id::text
        AND d.metadata->>'migrated_from' = 'guarantor_documents'
    );
    
    RAISE NOTICE 'Migration guarantor_documents terminée';
  END IF;
END $$;

-- ============================================
-- 7. VUE ENRICHIE POUR LES REQUÊTES
-- ============================================

CREATE OR REPLACE VIEW documents_enriched AS
SELECT 
  d.*,
  -- Infos du locataire
  COALESCE(tp.prenom || ' ' || tp.nom, 'Non défini') AS tenant_name,
  tp.prenom AS tenant_prenom,
  tp.nom AS tenant_nom,
  -- Infos du propriétaire
  op.prenom || ' ' || op.nom AS owner_name,
  -- Infos du bien
  p.adresse_complete AS property_address,
  p.ville AS property_ville,
  -- Infos du bail
  l.type_bail,
  l.statut AS lease_status,
  l.date_debut AS lease_start,
  -- Catégorie calculée
  COALESCE(d.category, 
    CASE 
      WHEN d.type IN ('bail', 'avenant', 'engagement_garant') THEN 'contrat'
      WHEN d.type IN ('cni_recto', 'cni_verso', 'passeport', 'piece_identite') THEN 'identite'
      WHEN d.type IN ('quittance', 'facture') THEN 'finance'
      WHEN d.type LIKE 'diagnostic%' OR d.type IN ('dpe', 'erp') THEN 'diagnostic'
      WHEN d.type IN ('EDL_entree', 'EDL_sortie') THEN 'edl'
      ELSE 'autre'
    END
  ) AS computed_category
FROM documents d
LEFT JOIN profiles tp ON d.tenant_id = tp.id
LEFT JOIN profiles op ON d.owner_id = op.id
LEFT JOIN properties p ON d.property_id = p.id
LEFT JOIN leases l ON d.lease_id = l.id;

-- ============================================
-- 8. FONCTION DE RECHERCHE
-- ============================================

CREATE OR REPLACE FUNCTION search_documents(
  search_query TEXT,
  p_owner_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_property_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  tenant_name TEXT,
  property_address TEXT,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.type,
    d.title,
    COALESCE(tp.prenom || ' ' || tp.nom, 'Non défini') AS tenant_name,
    p.adresse_complete AS property_address,
    d.created_at,
    ts_rank(d.search_vector, plainto_tsquery('french', search_query)) AS rank
  FROM documents d
  LEFT JOIN profiles tp ON d.tenant_id = tp.id
  LEFT JOIN properties p ON d.property_id = p.id
  WHERE 
    d.search_vector @@ plainto_tsquery('french', search_query)
    AND (p_owner_id IS NULL OR d.owner_id = p_owner_id)
    AND (p_tenant_id IS NULL OR d.tenant_id = p_tenant_id)
    AND (p_property_id IS NULL OR d.property_id = p_property_id)
    AND (p_category IS NULL OR d.category = p_category)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. COMMENTAIRES
-- ============================================

COMMENT ON COLUMN documents.category IS 'Catégorie du document : contrat, identite, finance, assurance, diagnostic, edl, candidature, garant, prestataire, autre';
COMMENT ON COLUMN documents.search_vector IS 'Vecteur de recherche full-text pour recherche rapide';
COMMENT ON COLUMN documents.application_id IS 'ID de la candidature associée (migré depuis application_files)';
COMMENT ON COLUMN documents.guarantor_profile_id IS 'ID du profil garant (migré depuis guarantor_documents)';
COMMENT ON VIEW documents_enriched IS 'Vue enrichie des documents avec informations locataire/propriétaire/bien';
COMMENT ON FUNCTION search_documents IS 'Recherche full-text dans les documents avec filtres';

COMMIT;

