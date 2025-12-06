-- =====================================================
-- MIGRATION: Compliance Prestataire SOTA 2025
-- Système complet de KYC, documents légaux et validation
-- =====================================================

-- =====================================================
-- 1. TABLE: provider_compliance_documents
-- Documents légaux avec gestion expiration
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_compliance_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Type de document
  document_type TEXT NOT NULL CHECK (document_type IN (
    'rc_pro',           -- Responsabilité Civile Pro
    'decennale',        -- Garantie décennale (BTP)
    'kbis',             -- Extrait Kbis
    'id_card_recto',    -- Pièce d'identité gérant (recto)
    'id_card_verso',    -- Pièce d'identité gérant (verso)
    'rib',              -- RIB/IBAN
    'urssaf',           -- Attestation URSSAF
    'qualification',    -- Certifications (RGE, QualiPV, etc.)
    'insurance_other',  -- Autre assurance
    'other'             -- Autre document
  )),
  
  -- Fichier
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Validité
  issue_date DATE,
  expiration_date DATE,
  
  -- Vérification
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN (
    'pending',    -- En attente de vérification
    'verified',   -- Vérifié et validé
    'rejected',   -- Rejeté
    'expired'     -- Expiré
  )),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  
  -- OCR / IA extraction (pour future implémentation)
  extracted_data JSONB DEFAULT '{}',
  ocr_confidence DECIMAL(5,2),
  
  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_compliance_docs_provider ON provider_compliance_documents(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_type ON provider_compliance_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_status ON provider_compliance_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_expiration ON provider_compliance_documents(expiration_date) 
  WHERE verification_status = 'verified';

-- =====================================================
-- 2. TABLE: provider_payout_accounts
-- Comptes de paiement prestataire (données bancaires)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_payout_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Coordonnées bancaires
  iban TEXT NOT NULL,
  bic TEXT,
  bank_name TEXT,
  account_holder_name TEXT NOT NULL,
  
  -- Stripe Connect (optionnel)
  stripe_account_id TEXT,
  stripe_account_status TEXT CHECK (stripe_account_status IN (
    'pending', 'enabled', 'restricted', 'disabled'
  )),
  stripe_capabilities JSONB DEFAULT '{}',
  
  -- Vérification
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  
  -- Statut
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_payout_accounts_provider ON provider_payout_accounts(provider_profile_id);

-- Contrainte: un seul compte par défaut par prestataire
CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_accounts_default 
  ON provider_payout_accounts(provider_profile_id) 
  WHERE is_default = true;

-- =====================================================
-- 3. EXTENSION: provider_profiles pour KYC avancé
-- =====================================================

-- Ajouter les colonnes KYC si elles n'existent pas
ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'incomplete' 
    CHECK (kyc_status IN (
      'incomplete',      -- Documents manquants
      'pending_review',  -- En attente validation admin
      'verified',        -- Tous documents vérifiés
      'suspended',       -- Suspendu (doc expiré ou problème)
      'rejected'         -- Rejeté définitivement
    ));

ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS kyc_completed_at TIMESTAMPTZ;

ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS suspension_until TIMESTAMPTZ;

-- Type de prestataire (pour déterminer les documents requis)
ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'independant' 
    CHECK (provider_type IN ('independant', 'entreprise', 'btp'));

-- Informations entreprise
ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS raison_sociale TEXT;

ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS siren TEXT;

ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS siret TEXT;

ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS tva_intra TEXT;

ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS adresse TEXT;

ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS code_postal TEXT;

ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS ville TEXT;

-- Score de conformité (calculé)
ALTER TABLE provider_profiles 
  ADD COLUMN IF NOT EXISTS compliance_score INTEGER DEFAULT 0;

-- Index pour les statuts KYC
CREATE INDEX IF NOT EXISTS idx_provider_profiles_kyc ON provider_profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_type ON provider_profiles(provider_type);

-- =====================================================
-- 4. TABLE: provider_kyc_requirements
-- Documents requis par type de prestataire
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_kyc_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_type TEXT NOT NULL CHECK (provider_type IN ('independant', 'entreprise', 'btp')),
  document_type TEXT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  has_expiration BOOLEAN DEFAULT false,
  max_age_months INTEGER, -- Pour les documents avec date de validité max (ex: Kbis < 3 mois)
  description TEXT,
  help_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Données de référence
INSERT INTO provider_kyc_requirements (provider_type, document_type, is_required, has_expiration, max_age_months, description, help_text) VALUES
-- Indépendant
('independant', 'rc_pro', true, true, NULL, 'Responsabilité Civile Professionnelle', 'Attestation RC Pro en cours de validité'),
('independant', 'id_card_recto', true, true, NULL, 'Pièce d''identité (recto)', 'CNI, passeport ou titre de séjour'),
('independant', 'rib', true, false, NULL, 'RIB', 'Relevé d''Identité Bancaire'),
('independant', 'urssaf', true, true, 6, 'Attestation URSSAF', 'Attestation de moins de 6 mois'),

-- Entreprise
('entreprise', 'rc_pro', true, true, NULL, 'Responsabilité Civile Professionnelle', 'Attestation RC Pro en cours de validité'),
('entreprise', 'kbis', true, true, 3, 'Extrait Kbis', 'Kbis de moins de 3 mois'),
('entreprise', 'id_card_recto', true, true, NULL, 'Pièce d''identité du gérant (recto)', 'CNI, passeport ou titre de séjour du représentant légal'),
('entreprise', 'rib', true, false, NULL, 'RIB', 'Relevé d''Identité Bancaire de l''entreprise'),
('entreprise', 'urssaf', true, true, 6, 'Attestation URSSAF', 'Attestation de moins de 6 mois'),

-- BTP (inclut entreprise + décennale)
('btp', 'rc_pro', true, true, NULL, 'Responsabilité Civile Professionnelle', 'Attestation RC Pro en cours de validité'),
('btp', 'decennale', true, true, NULL, 'Garantie décennale', 'Attestation de garantie décennale en cours de validité'),
('btp', 'kbis', true, true, 3, 'Extrait Kbis', 'Kbis de moins de 3 mois'),
('btp', 'id_card_recto', true, true, NULL, 'Pièce d''identité du gérant (recto)', 'CNI, passeport ou titre de séjour'),
('btp', 'rib', true, false, NULL, 'RIB', 'Relevé d''Identité Bancaire'),
('btp', 'urssaf', true, true, 6, 'Attestation URSSAF', 'Attestation de moins de 6 mois'),
('btp', 'qualification', false, false, NULL, 'Qualification professionnelle', 'RGE, Qualibat, QualiPV, etc.')

ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. FONCTIONS: Calcul compliance et alertes
-- =====================================================

-- Fonction pour calculer le score de compliance d'un prestataire
CREATE OR REPLACE FUNCTION calculate_provider_compliance_score(p_provider_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider_type TEXT;
  v_total_required INTEGER;
  v_total_verified INTEGER;
  v_score INTEGER;
BEGIN
  -- Récupérer le type de prestataire
  SELECT provider_type INTO v_provider_type
  FROM provider_profiles
  WHERE profile_id = p_provider_profile_id;
  
  IF v_provider_type IS NULL THEN
    v_provider_type := 'independant';
  END IF;
  
  -- Compter les documents requis
  SELECT COUNT(*) INTO v_total_required
  FROM provider_kyc_requirements
  WHERE provider_type = v_provider_type
  AND is_required = true;
  
  -- Compter les documents vérifiés et non expirés
  SELECT COUNT(*) INTO v_total_verified
  FROM provider_compliance_documents pcd
  JOIN provider_kyc_requirements pkr ON pkr.document_type = pcd.document_type AND pkr.provider_type = v_provider_type
  WHERE pcd.provider_profile_id = p_provider_profile_id
  AND pcd.verification_status = 'verified'
  AND (pcd.expiration_date IS NULL OR pcd.expiration_date > CURRENT_DATE)
  AND pkr.is_required = true;
  
  -- Calculer le score (0-100)
  IF v_total_required > 0 THEN
    v_score := (v_total_verified::DECIMAL / v_total_required * 100)::INTEGER;
  ELSE
    v_score := 100;
  END IF;
  
  -- Mettre à jour le score dans le profil
  UPDATE provider_profiles
  SET compliance_score = v_score,
      updated_at = NOW()
  WHERE profile_id = p_provider_profile_id;
  
  RETURN v_score;
END;
$$;

-- Fonction pour déterminer le statut KYC
CREATE OR REPLACE FUNCTION update_provider_kyc_status(p_provider_profile_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider_type TEXT;
  v_score INTEGER;
  v_has_expired BOOLEAN;
  v_has_pending BOOLEAN;
  v_new_status TEXT;
BEGIN
  -- Récupérer le type de prestataire
  SELECT COALESCE(provider_type, 'independant') INTO v_provider_type
  FROM provider_profiles
  WHERE profile_id = p_provider_profile_id;
  
  -- Calculer le score
  v_score := calculate_provider_compliance_score(p_provider_profile_id);
  
  -- Vérifier s'il y a des documents expirés
  SELECT EXISTS (
    SELECT 1 FROM provider_compliance_documents pcd
    JOIN provider_kyc_requirements pkr ON pkr.document_type = pcd.document_type AND pkr.provider_type = v_provider_type
    WHERE pcd.provider_profile_id = p_provider_profile_id
    AND pkr.is_required = true
    AND pcd.expiration_date IS NOT NULL
    AND pcd.expiration_date < CURRENT_DATE
  ) INTO v_has_expired;
  
  -- Vérifier s'il y a des documents en attente
  SELECT EXISTS (
    SELECT 1 FROM provider_compliance_documents
    WHERE provider_profile_id = p_provider_profile_id
    AND verification_status = 'pending'
  ) INTO v_has_pending;
  
  -- Déterminer le nouveau statut
  IF v_has_expired THEN
    v_new_status := 'suspended';
  ELSIF v_score = 100 AND NOT v_has_pending THEN
    v_new_status := 'verified';
  ELSIF v_has_pending OR v_score > 0 THEN
    v_new_status := 'pending_review';
  ELSE
    v_new_status := 'incomplete';
  END IF;
  
  -- Mettre à jour le statut
  UPDATE provider_profiles
  SET 
    kyc_status = v_new_status,
    kyc_completed_at = CASE WHEN v_new_status = 'verified' THEN NOW() ELSE kyc_completed_at END,
    suspension_reason = CASE WHEN v_new_status = 'suspended' THEN 'Document expiré' ELSE NULL END,
    updated_at = NOW()
  WHERE profile_id = p_provider_profile_id;
  
  RETURN v_new_status;
END;
$$;

-- Fonction pour obtenir les documents manquants
CREATE OR REPLACE FUNCTION get_provider_missing_documents(p_provider_profile_id UUID)
RETURNS TABLE (
  document_type TEXT,
  description TEXT,
  help_text TEXT,
  is_required BOOLEAN,
  has_expiration BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider_type TEXT;
BEGIN
  SELECT COALESCE(provider_type, 'independant') INTO v_provider_type
  FROM provider_profiles
  WHERE profile_id = p_provider_profile_id;
  
  RETURN QUERY
  SELECT 
    pkr.document_type,
    pkr.description,
    pkr.help_text,
    pkr.is_required,
    pkr.has_expiration
  FROM provider_kyc_requirements pkr
  WHERE pkr.provider_type = v_provider_type
  AND NOT EXISTS (
    SELECT 1 FROM provider_compliance_documents pcd
    WHERE pcd.provider_profile_id = p_provider_profile_id
    AND pcd.document_type = pkr.document_type
    AND pcd.verification_status IN ('pending', 'verified')
    AND (pcd.expiration_date IS NULL OR pcd.expiration_date > CURRENT_DATE)
  );
END;
$$;

-- Fonction pour lister les documents qui expirent bientôt
CREATE OR REPLACE FUNCTION get_expiring_provider_documents(p_days_ahead INTEGER DEFAULT 30)
RETURNS TABLE (
  provider_profile_id UUID,
  provider_name TEXT,
  provider_email TEXT,
  document_type TEXT,
  document_id UUID,
  expiration_date DATE,
  days_until_expiry INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pcd.provider_profile_id,
    COALESCE(p.prenom || ' ' || p.nom, 'Prestataire') AS provider_name,
    u.email AS provider_email,
    pcd.document_type,
    pcd.id AS document_id,
    pcd.expiration_date,
    (pcd.expiration_date - CURRENT_DATE)::INTEGER AS days_until_expiry
  FROM provider_compliance_documents pcd
  JOIN profiles p ON p.id = pcd.provider_profile_id
  JOIN auth.users u ON u.id = p.user_id
  WHERE pcd.verification_status = 'verified'
  AND pcd.expiration_date IS NOT NULL
  AND pcd.expiration_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL)
  ORDER BY pcd.expiration_date ASC;
END;
$$;

-- =====================================================
-- 6. TRIGGERS: Mise à jour automatique des statuts
-- =====================================================

-- Trigger après modification d'un document
CREATE OR REPLACE FUNCTION trigger_update_provider_compliance()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculer le statut KYC du prestataire
  PERFORM update_provider_kyc_status(COALESCE(NEW.provider_profile_id, OLD.provider_profile_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_provider_compliance_update ON provider_compliance_documents;
CREATE TRIGGER trg_provider_compliance_update
  AFTER INSERT OR UPDATE OR DELETE ON provider_compliance_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_update_provider_compliance();

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compliance_docs_updated_at ON provider_compliance_documents;
CREATE TRIGGER trg_compliance_docs_updated_at
  BEFORE UPDATE ON provider_compliance_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payout_accounts_updated_at ON provider_payout_accounts;
CREATE TRIGGER trg_payout_accounts_updated_at
  BEFORE UPDATE ON provider_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

-- Activer RLS
ALTER TABLE provider_compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_kyc_requirements ENABLE ROW LEVEL SECURITY;

-- Policies pour provider_compliance_documents

-- Les prestataires peuvent voir leurs propres documents
DROP POLICY IF EXISTS "Providers can view own documents" ON provider_compliance_documents;
CREATE POLICY "Providers can view own documents"
  ON provider_compliance_documents FOR SELECT
  USING (
    provider_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Les prestataires peuvent insérer leurs documents
DROP POLICY IF EXISTS "Providers can insert own documents" ON provider_compliance_documents;
CREATE POLICY "Providers can insert own documents"
  ON provider_compliance_documents FOR INSERT
  WITH CHECK (
    provider_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Les prestataires peuvent mettre à jour leurs documents non vérifiés
DROP POLICY IF EXISTS "Providers can update pending documents" ON provider_compliance_documents;
CREATE POLICY "Providers can update pending documents"
  ON provider_compliance_documents FOR UPDATE
  USING (
    provider_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    AND verification_status = 'pending'
  )
  WITH CHECK (
    provider_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Les admins peuvent tout voir
DROP POLICY IF EXISTS "Admins can view all documents" ON provider_compliance_documents;
CREATE POLICY "Admins can view all documents"
  ON provider_compliance_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Les admins peuvent tout modifier
DROP POLICY IF EXISTS "Admins can manage all documents" ON provider_compliance_documents;
CREATE POLICY "Admins can manage all documents"
  ON provider_compliance_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policies pour provider_payout_accounts

-- Les prestataires peuvent gérer leurs comptes de paiement
DROP POLICY IF EXISTS "Providers can manage own payout accounts" ON provider_payout_accounts;
CREATE POLICY "Providers can manage own payout accounts"
  ON provider_payout_accounts FOR ALL
  USING (
    provider_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Les admins peuvent voir tous les comptes
DROP POLICY IF EXISTS "Admins can view all payout accounts" ON provider_payout_accounts;
CREATE POLICY "Admins can view all payout accounts"
  ON provider_payout_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policies pour provider_kyc_requirements (lecture seule pour tous)
DROP POLICY IF EXISTS "Everyone can view kyc requirements" ON provider_kyc_requirements;
CREATE POLICY "Everyone can view kyc requirements"
  ON provider_kyc_requirements FOR SELECT
  USING (true);

-- =====================================================
-- 8. VUE: Statut compliance complet
-- =====================================================

CREATE OR REPLACE VIEW provider_compliance_status AS
SELECT 
  pp.profile_id,
  p.prenom || ' ' || p.nom AS provider_name,
  pp.provider_type,
  pp.raison_sociale,
  pp.siret,
  pp.status AS approval_status,
  pp.kyc_status,
  pp.compliance_score,
  pp.kyc_completed_at,
  pp.suspension_reason,
  pp.suspension_until,
  -- Statut des documents
  (
    SELECT jsonb_agg(jsonb_build_object(
      'type', pcd.document_type,
      'status', pcd.verification_status,
      'expiration_date', pcd.expiration_date,
      'is_expired', pcd.expiration_date IS NOT NULL AND pcd.expiration_date < CURRENT_DATE,
      'expires_soon', pcd.expiration_date IS NOT NULL AND pcd.expiration_date < (CURRENT_DATE + INTERVAL '30 days')
    ))
    FROM provider_compliance_documents pcd
    WHERE pcd.provider_profile_id = pp.profile_id
  ) AS documents,
  -- Documents manquants
  (
    SELECT array_agg(pkr.document_type)
    FROM provider_kyc_requirements pkr
    WHERE pkr.provider_type = COALESCE(pp.provider_type, 'independant')
    AND pkr.is_required = true
    AND NOT EXISTS (
      SELECT 1 FROM provider_compliance_documents pcd
      WHERE pcd.provider_profile_id = pp.profile_id
      AND pcd.document_type = pkr.document_type
      AND pcd.verification_status IN ('pending', 'verified')
    )
  ) AS missing_documents,
  -- Peut recevoir des missions
  (pp.status = 'approved' AND pp.kyc_status = 'verified') AS can_receive_missions,
  pp.created_at,
  pp.updated_at
FROM provider_profiles pp
JOIN profiles p ON p.id = pp.profile_id;

-- =====================================================
-- 9. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE provider_compliance_documents IS 'Documents légaux des prestataires avec gestion des expirations';
COMMENT ON TABLE provider_payout_accounts IS 'Comptes bancaires pour les paiements aux prestataires';
COMMENT ON TABLE provider_kyc_requirements IS 'Référentiel des documents requis par type de prestataire';
COMMENT ON FUNCTION calculate_provider_compliance_score IS 'Calcule le score de conformité d''un prestataire (0-100)';
COMMENT ON FUNCTION update_provider_kyc_status IS 'Met à jour le statut KYC d''un prestataire';
COMMENT ON FUNCTION get_provider_missing_documents IS 'Retourne la liste des documents manquants pour un prestataire';
COMMENT ON FUNCTION get_expiring_provider_documents IS 'Liste les documents qui expirent dans les N prochains jours';

