-- Migration: Ajouter les colonnes pour les documents d'identité des locataires
-- Stockage sécurisé des CNI/passeports pour la fiche locataire

-- ============================================
-- EXTENSIONS DES PROFILS LOCATAIRES
-- ============================================

-- Ajouter les colonnes d'identité à tenant_profiles
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_recto_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verso_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_number TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_expiry_date DATE;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verified_at TIMESTAMPTZ;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verification_method TEXT; -- 'ocr_scan', 'france_identite', 'manual'

-- Données extraites de la CNI (OCR)
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS identity_data JSONB DEFAULT '{}';
-- Contient: { "nom": "...", "prenom": "...", "date_naissance": "...", "lieu_naissance": "...", "sexe": "...", "nationalite": "..." }

-- Photo selfie pour vérification faciale (optionnel)
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS selfie_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS selfie_verified_at TIMESTAMPTZ;

-- Données professionnelles enrichies
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS employeur TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS type_contrat TEXT; -- 'cdi', 'cdd', 'fonctionnaire', 'independant', 'etudiant', 'retraite', 'autre'
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS date_debut_emploi DATE;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS justificatif_revenus_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS attestation_employeur_path TEXT;

-- Données de contact supplémentaires
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS telephone_fixe TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS contact_urgence_nom TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS contact_urgence_telephone TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS contact_urgence_lien TEXT;

-- Adresse précédente (pour historique)
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS adresse_precedente TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS code_postal_precedent TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS ville_precedente TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS duree_occupation_precedente TEXT;

-- ============================================
-- TYPES DE DOCUMENTS LOCATAIRE
-- ============================================

-- Créer un type enum pour les documents d'identité
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_document_type') THEN
    CREATE TYPE tenant_document_type AS ENUM (
      'cni_recto',
      'cni_verso',
      'passeport',
      'titre_sejour',
      'selfie_verification',
      'justificatif_domicile',
      'justificatif_revenus',
      'avis_imposition',
      'attestation_employeur',
      'contrat_travail',
      'bulletin_salaire',
      'attestation_caf',
      'garant_cni',
      'garant_revenus',
      'autre'
    );
  END IF;
END $$;

-- ============================================
-- TABLE DOCUMENTS LOCATAIRE
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_profile_id UUID NOT NULL REFERENCES tenant_profiles(profile_id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- utilise les valeurs de tenant_document_type
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Métadonnées
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(id),
  
  -- OCR / extraction
  extracted_data JSONB,
  ocr_confidence NUMERIC(5,2), -- pourcentage de confiance 0-100
  
  -- Validité
  is_valid BOOLEAN DEFAULT TRUE,
  expiry_date DATE,
  rejection_reason TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_tenant_documents_profile ON tenant_documents(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_tenant_documents_type ON tenant_documents(document_type);

-- ============================================
-- BUCKET STORAGE POUR LES DOCUMENTS
-- ============================================

-- Créer le bucket pour les documents d'identité (à faire via l'interface Supabase ou API)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('tenant-documents', 'tenant-documents', false)
-- ON CONFLICT DO NOTHING;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Activer RLS sur tenant_documents
ALTER TABLE tenant_documents ENABLE ROW LEVEL SECURITY;

-- Le locataire peut voir ses propres documents
CREATE POLICY "tenant_view_own_documents" ON tenant_documents
  FOR SELECT USING (
    tenant_profile_id IN (
      SELECT profile_id FROM tenant_profiles WHERE profile_id = auth.uid()
    )
  );

-- Le locataire peut uploader ses documents
CREATE POLICY "tenant_insert_own_documents" ON tenant_documents
  FOR INSERT WITH CHECK (
    tenant_profile_id IN (
      SELECT profile_id FROM tenant_profiles WHERE profile_id = auth.uid()
    )
  );

-- Le propriétaire peut voir les documents de ses locataires
CREATE POLICY "owner_view_tenant_documents" ON tenant_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM roommates r
      JOIN leases l ON r.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE r.profile_id = tenant_documents.tenant_profile_id
        AND pr.user_id = auth.uid()
    )
  );

-- L'admin peut tout voir
CREATE POLICY "admin_view_all_tenant_documents" ON tenant_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admin_manage_all_tenant_documents" ON tenant_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- FONCTION POUR RÉCUPÉRER LA FICHE LOCATAIRE COMPLÈTE
-- ============================================

CREATE OR REPLACE FUNCTION get_tenant_profile_full(p_tenant_profile_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'user_id', p.user_id,
      'email', p.email,
      'prenom', p.prenom,
      'nom', p.nom,
      'telephone', p.telephone,
      'avatar_url', p.avatar_url,
      'date_naissance', p.date_naissance,
      'created_at', p.created_at
    ),
    'tenant_details', jsonb_build_object(
      'situation_pro', tp.situation_pro,
      'revenus_mensuels', tp.revenus_mensuels,
      'nb_adultes', tp.nb_adultes,
      'nb_enfants', tp.nb_enfants,
      'employeur', tp.employeur,
      'type_contrat', tp.type_contrat,
      'adresse_precedente', tp.adresse_precedente,
      'ville_precedente', tp.ville_precedente
    ),
    'identity', jsonb_build_object(
      'cni_verified', tp.cni_verified_at IS NOT NULL,
      'cni_verified_at', tp.cni_verified_at,
      'cni_verification_method', tp.cni_verification_method,
      'cni_number', tp.cni_number,
      'identity_data', tp.identity_data,
      'cni_recto_path', tp.cni_recto_path,
      'cni_verso_path', tp.cni_verso_path
    ),
    'documents', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', td.id,
        'type', td.document_type,
        'file_name', td.file_name,
        'file_path', td.file_path,
        'uploaded_at', td.uploaded_at,
        'verified_at', td.verified_at,
        'is_valid', td.is_valid
      )), '[]'::jsonb)
      FROM tenant_documents td
      WHERE td.tenant_profile_id = p_tenant_profile_id
    ),
    'leases', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'lease_id', l.id,
        'property_address', pr.adresse_complete,
        'property_city', pr.ville,
        'type_bail', l.type_bail,
        'date_debut', l.date_debut,
        'date_fin', l.date_fin,
        'loyer', l.loyer,
        'statut', l.statut
      )), '[]'::jsonb)
      FROM roommates r
      JOIN leases l ON r.lease_id = l.id
      JOIN properties pr ON l.property_id = pr.id
      WHERE r.profile_id = p_tenant_profile_id
    )
  ) INTO result
  FROM profiles p
  LEFT JOIN tenant_profiles tp ON tp.profile_id = p.id
  WHERE p.id = p_tenant_profile_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION get_tenant_profile_full(UUID) TO authenticated;

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON TABLE tenant_documents IS 'Documents justificatifs des locataires (CNI, revenus, etc.)';
COMMENT ON COLUMN tenant_profiles.cni_recto_path IS 'Chemin vers la photo recto de la CNI';
COMMENT ON COLUMN tenant_profiles.cni_verso_path IS 'Chemin vers la photo verso de la CNI';
COMMENT ON COLUMN tenant_profiles.identity_data IS 'Données extraites par OCR de la CNI';
COMMENT ON COLUMN tenant_profiles.cni_verification_method IS 'Méthode de vérification: ocr_scan, france_identite, manual';

