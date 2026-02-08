
-- ========== 20251205200000_provider_compliance_sota.sql ==========
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



-- ========== 20251205300000_work_order_reports.sql ==========
-- =====================================================
-- MIGRATION: Rapports d'intervention SOTA 2025
-- Photos avant/après, checklists techniques, time tracking
-- =====================================================

-- =====================================================
-- 1. TABLE: checklist_templates
-- Templates de checklists par type d'intervention
-- =====================================================

CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Catégorisation
  service_type TEXT NOT NULL, -- plomberie, electricite, etc.
  intervention_type TEXT, -- depannage, installation, entretien, diagnostic
  name TEXT NOT NULL,
  description TEXT,
  
  -- Structure des items
  items JSONB NOT NULL DEFAULT '[]',
  -- Format: [
  --   {
  --     "id": "1",
  --     "label": "Texte de la question",
  --     "type": "checkbox" | "text" | "number" | "photo" | "select" | "rating",
  --     "required": true | false,
  --     "options": ["option1", "option2"] (pour select),
  --     "min": 0, "max": 10 (pour number/rating),
  --     "category": "sécurité" | "qualité" | "conformité"
  --   }
  -- ]
  
  -- Score de conformité
  min_score_required INTEGER DEFAULT 0, -- Score minimum pour valider
  
  -- Versioning
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_checklist_templates_service ON checklist_templates(service_type);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_active ON checklist_templates(is_active);

-- =====================================================
-- 2. TABLE: work_order_reports
-- Rapports d'intervention avec photos et checklists
-- =====================================================

CREATE TABLE IF NOT EXISTS work_order_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  -- Type de rapport
  report_type TEXT NOT NULL CHECK (report_type IN (
    'arrival',      -- Arrivée sur site (check-in)
    'before',       -- État avant intervention
    'during',       -- Pendant (pour longs chantiers)
    'after',        -- État après intervention
    'completion'    -- Rapport final de fin
  )),
  
  -- Horodatage précis
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Géolocalisation
  gps_latitude DECIMAL(10, 8),
  gps_longitude DECIMAL(11, 8),
  gps_accuracy DECIMAL(6, 2), -- Précision en mètres
  gps_address TEXT, -- Adresse reverse-geocodée
  
  -- Photos/Vidéos
  media_items JSONB DEFAULT '[]',
  -- Format: [
  --   {
  --     "id": "uuid",
  --     "type": "photo" | "video",
  --     "storage_path": "path/to/file",
  --     "thumbnail_path": "path/to/thumb",
  --     "caption": "Description",
  --     "taken_at": "2024-01-01T10:00:00Z",
  --     "ai_analysis": { ... } (optionnel)
  --   }
  -- ]
  
  -- Checklist technique
  checklist_template_id UUID REFERENCES checklist_templates(id),
  checklist_responses JSONB DEFAULT '{}',
  -- Format: { "item_id": "response_value", ... }
  checklist_score DECIMAL(5,2), -- Score de conformité calculé (0-100)
  
  -- Notes et observations
  technician_notes TEXT,
  anomalies_detected TEXT[], -- Liste des anomalies
  recommendations TEXT[], -- Recommandations pour le client
  
  -- Signature client (optionnel)
  client_signature_url TEXT,
  client_signed_at TIMESTAMPTZ,
  client_name TEXT,
  client_feedback TEXT,
  client_satisfaction INTEGER CHECK (client_satisfaction BETWEEN 1 AND 5),
  
  -- Métadonnées techniques
  device_info JSONB, -- Infos sur l'appareil utilisé
  app_version TEXT,
  
  -- Créateur
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_work_order_reports_work_order ON work_order_reports(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_reports_type ON work_order_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_work_order_reports_created_at ON work_order_reports(created_at);

-- Contrainte: un seul rapport par type par work_order (sauf 'during')
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_order_reports_unique_type 
  ON work_order_reports(work_order_id, report_type) 
  WHERE report_type != 'during';

-- =====================================================
-- 3. EXTENSION: work_orders pour time tracking
-- =====================================================

-- Planification avancée
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;

-- Time tracking réel
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMPTZ;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS actual_end_at TIMESTAMPTZ;

-- Acceptation
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Rapport final
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS completion_notes TEXT;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS final_report_id UUID REFERENCES work_order_reports(id);

-- Qualité et satisfaction
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS quality_score DECIMAL(5,2);

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS client_satisfaction INTEGER CHECK (client_satisfaction BETWEEN 1 AND 5);

-- =====================================================
-- 4. TABLE: work_order_time_entries
-- Entrées de temps détaillées (pour les interventions longues)
-- =====================================================

CREATE TABLE IF NOT EXISTS work_order_time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  -- Type d'entrée
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'travel',       -- Trajet
    'work',         -- Travail sur site
    'break',        -- Pause
    'waiting'       -- Attente (pièces, client, etc.)
  )),
  
  -- Temps
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER, -- Calculé automatiquement
  
  -- Notes
  description TEXT,
  
  -- GPS au démarrage
  start_latitude DECIMAL(10, 8),
  start_longitude DECIMAL(11, 8),
  
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_time_entries_work_order ON work_order_time_entries(work_order_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_type ON work_order_time_entries(entry_type);

-- =====================================================
-- 5. FONCTIONS
-- =====================================================

-- Fonction pour calculer le score d'une checklist
CREATE OR REPLACE FUNCTION calculate_checklist_score(
  p_template_id UUID,
  p_responses JSONB
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
  v_template RECORD;
  v_items JSONB;
  v_total_points DECIMAL := 0;
  v_earned_points DECIMAL := 0;
  v_item JSONB;
  v_response TEXT;
BEGIN
  -- Récupérer le template
  SELECT items INTO v_items
  FROM checklist_templates
  WHERE id = p_template_id;
  
  IF v_items IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Parcourir les items
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    -- Chaque item vaut 1 point s'il est required
    IF (v_item->>'required')::boolean = true THEN
      v_total_points := v_total_points + 1;
      
      -- Vérifier la réponse
      v_response := p_responses->>v_item->>'id';
      
      IF v_response IS NOT NULL AND v_response != '' AND v_response != 'false' THEN
        v_earned_points := v_earned_points + 1;
      END IF;
    END IF;
  END LOOP;
  
  -- Calculer le score (0-100)
  IF v_total_points > 0 THEN
    RETURN ROUND((v_earned_points / v_total_points) * 100, 2);
  ELSE
    RETURN 100; -- Pas d'items requis = 100%
  END IF;
END;
$$;

-- Fonction pour générer un résumé de rapport d'intervention
CREATE OR REPLACE FUNCTION get_work_order_report_summary(p_work_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'work_order_id', wo.id,
    'status', wo.statut,
    'scheduled', jsonb_build_object(
      'start', wo.scheduled_start_at,
      'end', wo.scheduled_end_at,
      'duration_minutes', wo.estimated_duration_minutes
    ),
    'actual', jsonb_build_object(
      'start', wo.actual_start_at,
      'end', wo.actual_end_at,
      'duration_minutes', EXTRACT(EPOCH FROM (wo.actual_end_at - wo.actual_start_at)) / 60
    ),
    'punctuality_minutes', EXTRACT(EPOCH FROM (wo.actual_start_at - wo.scheduled_start_at)) / 60,
    'reports', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', wor.id,
        'type', wor.report_type,
        'reported_at', wor.reported_at,
        'photos_count', jsonb_array_length(COALESCE(wor.media_items, '[]')),
        'checklist_score', wor.checklist_score,
        'has_anomalies', array_length(wor.anomalies_detected, 1) > 0
      ) ORDER BY wor.reported_at)
      FROM work_order_reports wor
      WHERE wor.work_order_id = wo.id
    ),
    'time_entries', (
      SELECT jsonb_agg(jsonb_build_object(
        'type', wte.entry_type,
        'duration_minutes', wte.duration_minutes
      ))
      FROM work_order_time_entries wte
      WHERE wte.work_order_id = wo.id
    ),
    'total_work_time_minutes', (
      SELECT SUM(duration_minutes)
      FROM work_order_time_entries
      WHERE work_order_id = wo.id AND entry_type = 'work'
    ),
    'quality_score', wo.quality_score,
    'client_satisfaction', wo.client_satisfaction,
    'completion_notes', wo.completion_notes
  ) INTO v_result
  FROM work_orders wo
  WHERE wo.id = p_work_order_id;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Trigger pour calculer la durée des entrées de temps
CREATE OR REPLACE FUNCTION trigger_calculate_time_entry_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_time_entry_duration ON work_order_time_entries;
CREATE TRIGGER trg_time_entry_duration
  BEFORE INSERT OR UPDATE OF ended_at ON work_order_time_entries
  FOR EACH ROW EXECUTE FUNCTION trigger_calculate_time_entry_duration();

-- Trigger pour mettre à jour le score de checklist
CREATE OR REPLACE FUNCTION trigger_update_checklist_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.checklist_template_id IS NOT NULL AND NEW.checklist_responses IS NOT NULL THEN
    NEW.checklist_score := calculate_checklist_score(NEW.checklist_template_id, NEW.checklist_responses);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_checklist_score ON work_order_reports;
CREATE TRIGGER trg_update_checklist_score
  BEFORE INSERT OR UPDATE OF checklist_responses ON work_order_reports
  FOR EACH ROW EXECUTE FUNCTION trigger_update_checklist_score();

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_work_order_reports_updated_at ON work_order_reports;
CREATE TRIGGER trg_work_order_reports_updated_at
  BEFORE UPDATE ON work_order_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_checklist_templates_updated_at ON checklist_templates;
CREATE TRIGGER trg_checklist_templates_updated_at
  BEFORE UPDATE ON checklist_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

ALTER TABLE work_order_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

-- Policies pour work_order_reports

-- Les prestataires peuvent voir et créer des rapports pour leurs interventions
DROP POLICY IF EXISTS "Providers can manage own work order reports" ON work_order_reports;
CREATE POLICY "Providers can manage own work order reports"
  ON work_order_reports FOR ALL
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Les propriétaires peuvent voir les rapports de leurs propriétés
DROP POLICY IF EXISTS "Owners can view work order reports" ON work_order_reports;
CREATE POLICY "Owners can view work order reports"
  ON work_order_reports FOR SELECT
  USING (
    work_order_id IN (
      SELECT wo.id FROM work_orders wo
      JOIN tickets t ON t.id = wo.ticket_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Les admins peuvent tout voir
DROP POLICY IF EXISTS "Admins can view all reports" ON work_order_reports;
CREATE POLICY "Admins can view all reports"
  ON work_order_reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Policies pour work_order_time_entries
DROP POLICY IF EXISTS "Providers can manage own time entries" ON work_order_time_entries;
CREATE POLICY "Providers can manage own time entries"
  ON work_order_time_entries FOR ALL
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can view time entries" ON work_order_time_entries;
CREATE POLICY "Owners can view time entries"
  ON work_order_time_entries FOR SELECT
  USING (
    work_order_id IN (
      SELECT wo.id FROM work_orders wo
      JOIN tickets t ON t.id = wo.ticket_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Policies pour checklist_templates (lecture pour tous les authentifiés)
DROP POLICY IF EXISTS "Authenticated users can view templates" ON checklist_templates;
CREATE POLICY "Authenticated users can view templates"
  ON checklist_templates FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage templates" ON checklist_templates;
CREATE POLICY "Admins can manage templates"
  ON checklist_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- 8. DONNÉES INITIALES: Templates de checklists
-- =====================================================

INSERT INTO checklist_templates (service_type, intervention_type, name, description, items) VALUES
(
  'plomberie',
  'depannage',
  'Intervention fuite standard',
  'Checklist pour les interventions de réparation de fuite',
  '[
    {"id": "1", "label": "État général de la tuyauterie visible", "type": "select", "required": true, "options": ["Bon", "Usé", "Critique"], "category": "diagnostic"},
    {"id": "2", "label": "Photo de la zone de fuite AVANT", "type": "photo", "required": true, "category": "documentation"},
    {"id": "3", "label": "Origine de la fuite identifiée", "type": "text", "required": true, "category": "diagnostic"},
    {"id": "4", "label": "Joint remplacé", "type": "checkbox", "required": false, "category": "travaux"},
    {"id": "5", "label": "Pièces remplacées (détail)", "type": "text", "required": false, "category": "travaux"},
    {"id": "6", "label": "Test d''étanchéité effectué", "type": "checkbox", "required": true, "category": "qualité"},
    {"id": "7", "label": "Pression eau vérifiée (bar)", "type": "number", "required": false, "min": 0, "max": 10, "category": "qualité"},
    {"id": "8", "label": "Photo de la zone APRÈS réparation", "type": "photo", "required": true, "category": "documentation"},
    {"id": "9", "label": "Zone nettoyée et séchée", "type": "checkbox", "required": true, "category": "finition"},
    {"id": "10", "label": "Recommandations pour le client", "type": "text", "required": false, "category": "conseil"}
  ]'
),
(
  'electricite',
  'depannage',
  'Intervention électrique standard',
  'Checklist pour les interventions électriques de dépannage',
  '[
    {"id": "1", "label": "Coupure du courant effectuée", "type": "checkbox", "required": true, "category": "sécurité"},
    {"id": "2", "label": "Photo du tableau électrique", "type": "photo", "required": true, "category": "documentation"},
    {"id": "3", "label": "Disjoncteur concerné identifié", "type": "text", "required": true, "category": "diagnostic"},
    {"id": "4", "label": "Cause de la panne identifiée", "type": "text", "required": true, "category": "diagnostic"},
    {"id": "5", "label": "Test d''isolation effectué", "type": "checkbox", "required": true, "category": "qualité"},
    {"id": "6", "label": "Remplacement de pièce effectué", "type": "checkbox", "required": false, "category": "travaux"},
    {"id": "7", "label": "Détail des travaux réalisés", "type": "text", "required": true, "category": "travaux"},
    {"id": "8", "label": "Test de fonctionnement OK", "type": "checkbox", "required": true, "category": "qualité"},
    {"id": "9", "label": "Photo finale du tableau", "type": "photo", "required": true, "category": "documentation"},
    {"id": "10", "label": "Conformité NF C 15-100 vérifiée", "type": "checkbox", "required": true, "category": "conformité"}
  ]'
),
(
  'chauffage',
  'entretien',
  'Entretien chaudière annuel',
  'Checklist pour l''entretien annuel obligatoire de chaudière',
  '[
    {"id": "1", "label": "Marque et modèle de la chaudière", "type": "text", "required": true, "category": "identification"},
    {"id": "2", "label": "Photo de la plaque signalétique", "type": "photo", "required": true, "category": "documentation"},
    {"id": "3", "label": "Nettoyage du corps de chauffe effectué", "type": "checkbox", "required": true, "category": "travaux"},
    {"id": "4", "label": "Vérification du brûleur", "type": "checkbox", "required": true, "category": "travaux"},
    {"id": "5", "label": "Réglage de la combustion effectué", "type": "checkbox", "required": true, "category": "travaux"},
    {"id": "6", "label": "Taux de CO mesuré (ppm)", "type": "number", "required": true, "min": 0, "max": 1000, "category": "sécurité"},
    {"id": "7", "label": "Tirage conduit vérifié", "type": "checkbox", "required": true, "category": "sécurité"},
    {"id": "8", "label": "Pression circuit (bar)", "type": "number", "required": true, "min": 0, "max": 5, "category": "qualité"},
    {"id": "9", "label": "Vase d''expansion vérifié", "type": "checkbox", "required": true, "category": "travaux"},
    {"id": "10", "label": "Attestation d''entretien remise", "type": "checkbox", "required": true, "category": "documentation"}
  ]'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 9. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE work_order_reports IS 'Rapports d''intervention avec photos, checklists et time tracking';
COMMENT ON TABLE work_order_time_entries IS 'Entrées de temps détaillées pour les interventions';
COMMENT ON TABLE checklist_templates IS 'Templates de checklists par type d''intervention';
COMMENT ON FUNCTION calculate_checklist_score IS 'Calcule le score de conformité d''une checklist (0-100)';
COMMENT ON FUNCTION get_work_order_report_summary IS 'Génère un résumé complet d''un rapport d''intervention';



-- ========== 20251205400000_provider_analytics_dashboard.sql ==========
-- =====================================================
-- MIGRATION: Analytics Prestataire SOTA 2025
-- Dashboard enrichi avec KPIs avancés
-- =====================================================

-- D'abord, ajouter les colonnes manquantes à work_orders si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'accepted_at') THEN
    ALTER TABLE work_orders ADD COLUMN accepted_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'scheduled_start_at') THEN
    ALTER TABLE work_orders ADD COLUMN scheduled_start_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'actual_start_at') THEN
    ALTER TABLE work_orders ADD COLUMN actual_start_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'actual_end_at') THEN
    ALTER TABLE work_orders ADD COLUMN actual_end_at TIMESTAMPTZ;
  END IF;
END$$;

-- =====================================================
-- 1. FONCTION: Dashboard Analytics Prestataire Simplifié
-- =====================================================

CREATE OR REPLACE FUNCTION provider_analytics_dashboard(
  p_user_id UUID,
  p_period_start DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_period_end DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  -- Récupérer le profil prestataire
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id AND role = 'provider';
  
  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Assembler le résultat simplifié
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'period', jsonb_build_object(
      'start', p_period_start,
      'end', p_period_end
    ),
    'financial', (
      SELECT jsonb_build_object(
        'revenue_period', COALESCE(SUM(CASE WHEN statut = 'done' AND date_intervention_reelle BETWEEN p_period_start AND p_period_end THEN cout_final ELSE 0 END), 0),
        'revenue_pending', COALESCE(SUM(CASE WHEN statut IN ('assigned', 'scheduled') THEN cout_estime ELSE 0 END), 0),
        'invoices_count', COUNT(CASE WHEN statut = 'done' AND date_intervention_reelle BETWEEN p_period_start AND p_period_end THEN 1 END)
      )
      FROM work_orders
      WHERE provider_id = v_profile_id
    ),
    'missions', (
      SELECT jsonb_build_object(
        'total_assigned', COUNT(CASE WHEN created_at::DATE BETWEEN p_period_start AND p_period_end THEN 1 END),
        'completed', COUNT(CASE WHEN statut = 'done' AND date_intervention_reelle BETWEEN p_period_start AND p_period_end THEN 1 END),
        'cancelled', COUNT(CASE WHEN statut = 'cancelled' AND created_at::DATE BETWEEN p_period_start AND p_period_end THEN 1 END),
        'in_progress', COUNT(CASE WHEN statut IN ('assigned', 'scheduled') THEN 1 END)
      )
      FROM work_orders
      WHERE provider_id = v_profile_id
    ),
    'generated_at', NOW()
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- 2. INDEX pour les performances
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_work_orders_date_intervention 
  ON work_orders(date_intervention_reelle);

CREATE INDEX IF NOT EXISTS idx_work_orders_provider_status 
  ON work_orders(provider_id, statut);

-- =====================================================
-- 3. COMMENTAIRES
-- =====================================================

COMMENT ON FUNCTION provider_analytics_dashboard IS 'Dashboard analytics pour un prestataire avec KPIs financiers et missions';


-- ========== 20251205500000_invoicing_professional.sql ==========
-- =====================================================
-- MIGRATION: Facturation Professionnelle SOTA 2025
-- Factures conformes avec mentions légales obligatoires
-- Acomptes, avoirs, pénalités de retard
-- =====================================================

-- =====================================================
-- 1. TABLE: provider_invoices (refonte complète)
-- =====================================================

-- Supprimer l'ancienne table si elle existe et la recréer
DROP TABLE IF EXISTS provider_invoice_items CASCADE;
DROP TABLE IF EXISTS provider_invoice_payments CASCADE;

-- Recréer provider_invoices avec tous les champs requis
CREATE TABLE IF NOT EXISTS provider_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Numérotation unique et séquentielle (obligatoire légalement)
  invoice_number TEXT UNIQUE NOT NULL,
  
  -- Parties
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID REFERENCES profiles(id),
  property_id UUID REFERENCES properties(id),
  work_order_id UUID REFERENCES work_orders(id),
  
  -- Type de document
  document_type TEXT NOT NULL DEFAULT 'invoice' CHECK (document_type IN (
    'invoice',    -- Facture
    'quote',      -- Devis
    'credit_note' -- Avoir
  )),
  
  -- Référence (pour avoirs)
  related_invoice_id UUID REFERENCES provider_invoices(id),
  
  -- Informations générales
  title TEXT NOT NULL,
  description TEXT,
  
  -- Dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,
  
  -- Conditions de paiement
  payment_terms_days INTEGER DEFAULT 30,
  
  -- Montants
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Pénalités de retard (Article L441-10 Code Commerce)
  late_payment_rate DECIMAL(5,2) DEFAULT 10.00, -- Taux annuel
  fixed_recovery_fee DECIMAL(10,2) DEFAULT 40.00, -- Indemnité forfaitaire
  late_fees_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Escompte
  early_payment_discount_rate DECIMAL(5,2), -- % escompte paiement anticipé
  early_payment_discount_days INTEGER, -- Délai pour bénéficier de l'escompte
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',      -- Brouillon
    'sent',       -- Envoyée
    'viewed',     -- Vue par le client
    'partial',    -- Partiellement payée
    'paid',       -- Payée
    'overdue',    -- En retard
    'disputed',   -- Contestée
    'cancelled',  -- Annulée
    'credited'    -- Avoir émis
  )),
  
  -- Envoi
  sent_at TIMESTAMPTZ,
  sent_to_email TEXT,
  viewed_at TIMESTAMPTZ,
  
  -- Rappels
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  
  -- PDF
  pdf_storage_path TEXT,
  pdf_generated_at TIMESTAMPTZ,
  
  -- Mentions légales personnalisées
  custom_legal_mentions TEXT,
  custom_payment_info TEXT,
  
  -- Notes internes
  internal_notes TEXT,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajouter les colonnes manquantes si la table existe déjà
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'provider_profile_id') THEN
    ALTER TABLE provider_invoices ADD COLUMN provider_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    -- Copier les données de provider_id si elle existe
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'provider_id') THEN
      UPDATE provider_invoices SET provider_profile_id = provider_id WHERE provider_profile_id IS NULL;
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'owner_profile_id') THEN
    ALTER TABLE provider_invoices ADD COLUMN owner_profile_id UUID REFERENCES profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'property_id') THEN
    ALTER TABLE provider_invoices ADD COLUMN property_id UUID REFERENCES properties(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'work_order_id') THEN
    ALTER TABLE provider_invoices ADD COLUMN work_order_id UUID REFERENCES work_orders(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'invoice_number') THEN
    ALTER TABLE provider_invoices ADD COLUMN invoice_number TEXT UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'title') THEN
    ALTER TABLE provider_invoices ADD COLUMN title TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'description') THEN
    ALTER TABLE provider_invoices ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'subtotal') THEN
    ALTER TABLE provider_invoices ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'tax_rate') THEN
    ALTER TABLE provider_invoices ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 20.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'tax_amount') THEN
    ALTER TABLE provider_invoices ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'total_amount') THEN
    ALTER TABLE provider_invoices ADD COLUMN total_amount DECIMAL(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'document_type') THEN
    ALTER TABLE provider_invoices ADD COLUMN document_type TEXT DEFAULT 'invoice';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'due_date') THEN
    ALTER TABLE provider_invoices ADD COLUMN due_date DATE;
  END IF;
END$$;

-- Index conditionnels
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'provider_profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_provider_invoices_provider ON provider_invoices(provider_profile_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'owner_profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_provider_invoices_owner ON provider_invoices(owner_profile_id);
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_provider_invoices_status ON provider_invoices(status);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'invoice_date') THEN
    CREATE INDEX IF NOT EXISTS idx_provider_invoices_date ON provider_invoices(invoice_date);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'due_date') THEN
    CREATE INDEX IF NOT EXISTS idx_provider_invoices_due_date ON provider_invoices(due_date);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'invoice_number') THEN
    CREATE INDEX IF NOT EXISTS idx_provider_invoices_number ON provider_invoices(invoice_number);
  END IF;
END$$;

-- =====================================================
-- 2. TABLE: provider_invoice_items (lignes de facture)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES provider_invoices(id) ON DELETE CASCADE,
  
  -- Description
  description TEXT NOT NULL,
  
  -- Quantité et prix
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'unité', -- unité, heure, m², kg, etc.
  unit_price DECIMAL(10,2) NOT NULL,
  
  -- TVA par ligne (peut varier)
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  
  -- Montants calculés
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  tax_amount DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price * tax_rate / 100) STORED,
  total DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price * (1 + tax_rate / 100)) STORED,
  
  -- Remise par ligne
  discount_percent DECIMAL(5,2) DEFAULT 0,
  
  -- Ordre d'affichage
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON provider_invoice_items(invoice_id);

-- =====================================================
-- 3. TABLE: provider_invoice_payments (paiements)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES provider_invoices(id) ON DELETE CASCADE,
  
  -- Montant
  amount DECIMAL(10,2) NOT NULL,
  
  -- Type de paiement
  payment_type TEXT NOT NULL CHECK (payment_type IN (
    'deposit',    -- Acompte
    'partial',    -- Paiement partiel
    'final',      -- Solde
    'refund'      -- Remboursement
  )),
  
  -- Méthode
  payment_method TEXT CHECK (payment_method IN (
    'card',       -- Carte bancaire
    'transfer',   -- Virement
    'check',      -- Chèque
    'cash',       -- Espèces
    'platform'    -- Via la plateforme
  )),
  
  -- Références
  transaction_id TEXT,
  stripe_payment_intent_id TEXT,
  check_number TEXT,
  
  -- Date
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Notes
  notes TEXT,
  
  -- Reçu
  receipt_number TEXT,
  receipt_pdf_path TEXT,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON provider_invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON provider_invoice_payments(paid_at);

-- =====================================================
-- 4. TABLE: invoice_number_sequences (séquences)
-- =====================================================

CREATE TABLE IF NOT EXISTS invoice_number_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  prefix TEXT DEFAULT 'FAC',
  
  UNIQUE(provider_profile_id, year)
);

-- =====================================================
-- 5. FONCTIONS
-- =====================================================

-- Fonction pour générer un numéro de facture unique
CREATE OR REPLACE FUNCTION generate_invoice_number(p_provider_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER;
  v_next_number INTEGER;
  v_prefix TEXT;
  v_invoice_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Récupérer ou créer la séquence
  INSERT INTO invoice_number_sequences (provider_profile_id, year, last_number, prefix)
  VALUES (p_provider_id, v_year, 0, 'FAC')
  ON CONFLICT (provider_profile_id, year) DO NOTHING;
  
  -- Incrémenter et récupérer le numéro
  UPDATE invoice_number_sequences
  SET last_number = last_number + 1
  WHERE provider_profile_id = p_provider_id AND year = v_year
  RETURNING last_number, prefix INTO v_next_number, v_prefix;
  
  -- Formater le numéro: FAC-2024-000001
  v_invoice_number := v_prefix || '-' || v_year || '-' || LPAD(v_next_number::TEXT, 6, '0');
  
  RETURN v_invoice_number;
END;
$$;

-- Fonction pour calculer les totaux d'une facture
CREATE OR REPLACE FUNCTION calculate_invoice_totals(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_subtotal DECIMAL(10,2);
  v_discount_amount DECIMAL(10,2);
  v_tax_amount DECIMAL(10,2);
  v_total_amount DECIMAL(10,2);
  v_discount_percent DECIMAL(5,2);
BEGIN
  -- Récupérer le pourcentage de remise
  SELECT discount_percent INTO v_discount_percent
  FROM provider_invoices WHERE id = p_invoice_id;
  
  -- Calculer le sous-total
  SELECT COALESCE(SUM(quantity * unit_price * (1 - COALESCE(discount_percent, 0) / 100)), 0)
  INTO v_subtotal
  FROM provider_invoice_items
  WHERE invoice_id = p_invoice_id;
  
  -- Appliquer la remise globale
  v_discount_amount := v_subtotal * COALESCE(v_discount_percent, 0) / 100;
  v_subtotal := v_subtotal - v_discount_amount;
  
  -- Calculer la TVA
  SELECT COALESCE(SUM(
    (quantity * unit_price * (1 - COALESCE(discount_percent, 0) / 100)) * tax_rate / 100
  ), 0)
  INTO v_tax_amount
  FROM provider_invoice_items
  WHERE invoice_id = p_invoice_id;
  
  -- Ajuster la TVA avec la remise globale
  v_tax_amount := v_tax_amount * (1 - COALESCE(v_discount_percent, 0) / 100);
  
  -- Total
  v_total_amount := v_subtotal + v_tax_amount;
  
  -- Mettre à jour la facture
  UPDATE provider_invoices
  SET 
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = v_tax_amount,
    total_amount = v_total_amount,
    updated_at = NOW()
  WHERE id = p_invoice_id;
END;
$$;

-- Fonction pour calculer le solde dû d'une facture
CREATE OR REPLACE FUNCTION get_invoice_balance(p_invoice_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total DECIMAL(10,2);
  v_paid DECIMAL(10,2);
BEGIN
  SELECT total_amount INTO v_total
  FROM provider_invoices WHERE id = p_invoice_id;
  
  SELECT COALESCE(SUM(
    CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END
  ), 0) INTO v_paid
  FROM provider_invoice_payments WHERE invoice_id = p_invoice_id;
  
  RETURN v_total - v_paid;
END;
$$;

-- Fonction pour calculer les pénalités de retard
CREATE OR REPLACE FUNCTION calculate_late_fees(p_invoice_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice RECORD;
  v_balance DECIMAL(10,2);
  v_days_late INTEGER;
  v_late_fees DECIMAL(10,2);
BEGIN
  SELECT * INTO v_invoice
  FROM provider_invoices WHERE id = p_invoice_id;
  
  IF v_invoice.due_date IS NULL OR v_invoice.due_date >= CURRENT_DATE THEN
    RETURN 0;
  END IF;
  
  v_balance := get_invoice_balance(p_invoice_id);
  IF v_balance <= 0 THEN
    RETURN 0;
  END IF;
  
  v_days_late := CURRENT_DATE - v_invoice.due_date;
  
  -- Pénalités = (solde * taux annuel / 365 * jours de retard) + indemnité forfaitaire
  v_late_fees := (v_balance * v_invoice.late_payment_rate / 100 / 365 * v_days_late) + v_invoice.fixed_recovery_fee;
  
  -- Mettre à jour la facture
  UPDATE provider_invoices
  SET late_fees_amount = v_late_fees
  WHERE id = p_invoice_id;
  
  RETURN v_late_fees;
END;
$$;

-- Fonction pour générer les données du PDF
CREATE OR REPLACE FUNCTION get_invoice_pdf_data(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'invoice', jsonb_build_object(
      'number', pi.invoice_number,
      'date', pi.invoice_date,
      'due_date', pi.due_date,
      'type', pi.document_type,
      'title', pi.title,
      'description', pi.description,
      'subtotal', pi.subtotal,
      'discount_percent', pi.discount_percent,
      'discount_amount', pi.discount_amount,
      'tax_rate', pi.tax_rate,
      'tax_amount', pi.tax_amount,
      'total_amount', pi.total_amount,
      'late_payment_rate', pi.late_payment_rate,
      'fixed_recovery_fee', pi.fixed_recovery_fee,
      'early_payment_discount_rate', pi.early_payment_discount_rate,
      'custom_legal_mentions', pi.custom_legal_mentions,
      'custom_payment_info', pi.custom_payment_info
    ),
    'provider', jsonb_build_object(
      'name', COALESCE(pp.raison_sociale, p_prov.prenom || ' ' || p_prov.nom),
      'siret', pp.siret,
      'tva_intra', pp.tva_intra,
      'address', pp.adresse,
      'postal_code', pp.code_postal,
      'city', pp.ville,
      'phone', p_prov.telephone,
      'email', (SELECT email FROM auth.users WHERE id = p_prov.user_id)
    ),
    'client', jsonb_build_object(
      'name', p_own.prenom || ' ' || p_own.nom,
      'address', prop.adresse_complete,
      'postal_code', prop.code_postal,
      'city', prop.ville
    ),
    'items', (
      SELECT jsonb_agg(jsonb_build_object(
        'description', pii.description,
        'quantity', pii.quantity,
        'unit', pii.unit,
        'unit_price', pii.unit_price,
        'tax_rate', pii.tax_rate,
        'subtotal', pii.subtotal,
        'total', pii.total
      ) ORDER BY pii.sort_order)
      FROM provider_invoice_items pii
      WHERE pii.invoice_id = pi.id
    ),
    'payments', (
      SELECT jsonb_agg(jsonb_build_object(
        'amount', pip.amount,
        'type', pip.payment_type,
        'method', pip.payment_method,
        'date', pip.paid_at
      ) ORDER BY pip.paid_at)
      FROM provider_invoice_payments pip
      WHERE pip.invoice_id = pi.id
    ),
    'balance', get_invoice_balance(pi.id),
    'legal_mentions', jsonb_build_object(
      'late_payment_text', 'En cas de retard de paiement, une pénalité de ' || pi.late_payment_rate || '% annuel sera appliquée.',
      'recovery_fee_text', 'Indemnité forfaitaire pour frais de recouvrement: ' || pi.fixed_recovery_fee || '€ (Article L441-10 du Code de Commerce).',
      'early_discount_text', CASE WHEN pi.early_payment_discount_rate IS NOT NULL 
        THEN 'Escompte de ' || pi.early_payment_discount_rate || '% pour paiement sous ' || pi.early_payment_discount_days || ' jours.'
        ELSE 'Pas d''escompte pour paiement anticipé.'
      END
    )
  ) INTO v_result
  FROM provider_invoices pi
  JOIN profiles p_prov ON p_prov.id = pi.provider_profile_id
  LEFT JOIN provider_profiles pp ON pp.profile_id = pi.provider_profile_id
  LEFT JOIN profiles p_own ON p_own.id = pi.owner_profile_id
  LEFT JOIN properties prop ON prop.id = pi.property_id
  WHERE pi.id = p_invoice_id;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Trigger pour générer le numéro de facture
CREATE OR REPLACE FUNCTION trigger_generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number(NEW.provider_profile_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_invoice_number ON provider_invoices;
CREATE TRIGGER trg_generate_invoice_number
  BEFORE INSERT ON provider_invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_generate_invoice_number();

-- Trigger pour recalculer les totaux après modification des items
CREATE OR REPLACE FUNCTION trigger_recalculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_invoice_totals(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalculate_invoice_totals ON provider_invoice_items;
CREATE TRIGGER trg_recalculate_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON provider_invoice_items
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_invoice_totals();

-- Trigger pour mettre à jour le statut de la facture après paiement
CREATE OR REPLACE FUNCTION trigger_update_invoice_status_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_balance DECIMAL(10,2);
  v_new_status TEXT;
BEGIN
  v_balance := get_invoice_balance(NEW.invoice_id);
  
  IF v_balance <= 0 THEN
    v_new_status := 'paid';
  ELSIF v_balance < (SELECT total_amount FROM provider_invoices WHERE id = NEW.invoice_id) THEN
    v_new_status := 'partial';
  ELSE
    -- Garder le statut actuel
    RETURN NEW;
  END IF;
  
  UPDATE provider_invoices
  SET 
    status = v_new_status,
    paid_date = CASE WHEN v_new_status = 'paid' THEN CURRENT_DATE ELSE paid_date END,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_invoice_status_on_payment ON provider_invoice_payments;
CREATE TRIGGER trg_update_invoice_status_on_payment
  AFTER INSERT ON provider_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION trigger_update_invoice_status_on_payment();

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_provider_invoices_updated_at ON provider_invoices;
CREATE TRIGGER trg_provider_invoices_updated_at
  BEFORE UPDATE ON provider_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

ALTER TABLE provider_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_number_sequences ENABLE ROW LEVEL SECURITY;

-- Policies provider_invoices
DROP POLICY IF EXISTS "Providers can manage own invoices" ON provider_invoices;
CREATE POLICY "Providers can manage own invoices"
  ON provider_invoices FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view invoices addressed to them" ON provider_invoices;
CREATE POLICY "Owners can view invoices addressed to them"
  ON provider_invoices FOR SELECT
  USING (owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view all invoices" ON provider_invoices;
CREATE POLICY "Admins can view all invoices"
  ON provider_invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies provider_invoice_items
DROP POLICY IF EXISTS "Users can manage invoice items" ON provider_invoice_items;
CREATE POLICY "Users can manage invoice items"
  ON provider_invoice_items FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM provider_invoices 
      WHERE provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can view invoice items" ON provider_invoice_items;
CREATE POLICY "Owners can view invoice items"
  ON provider_invoice_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM provider_invoices 
      WHERE owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Policies provider_invoice_payments
DROP POLICY IF EXISTS "Providers can manage payments" ON provider_invoice_payments;
CREATE POLICY "Providers can manage payments"
  ON provider_invoice_payments FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM provider_invoices 
      WHERE provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can view payments" ON provider_invoice_payments;
CREATE POLICY "Owners can view payments"
  ON provider_invoice_payments FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM provider_invoices 
      WHERE owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Policies sequences
DROP POLICY IF EXISTS "Providers can manage own sequences" ON invoice_number_sequences;
CREATE POLICY "Providers can manage own sequences"
  ON invoice_number_sequences FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- =====================================================
-- 8. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE provider_invoices IS 'Factures prestataires conformes aux obligations légales françaises';
COMMENT ON TABLE provider_invoice_items IS 'Lignes de facture avec TVA par ligne';
COMMENT ON TABLE provider_invoice_payments IS 'Paiements et acomptes sur factures';
COMMENT ON FUNCTION generate_invoice_number IS 'Génère un numéro de facture unique et séquentiel';
COMMENT ON FUNCTION calculate_invoice_totals IS 'Recalcule les totaux d''une facture';
COMMENT ON FUNCTION get_invoice_balance IS 'Retourne le solde dû d''une facture';
COMMENT ON FUNCTION calculate_late_fees IS 'Calcule les pénalités de retard selon l''Article L441-10';
COMMENT ON FUNCTION get_invoice_pdf_data IS 'Génère les données structurées pour la génération du PDF';



-- ========== 20251205600000_notifications_centralized.sql ==========
-- =====================================================
-- MIGRATION: Notifications Centralisées (version simplifiée)
-- =====================================================

-- Ajouter les colonnes manquantes à notifications si nécessaire
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'profile_id') THEN
    ALTER TABLE notifications ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'priority') THEN
    ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'normal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'action_url') THEN
    ALTER TABLE notifications ADD COLUMN action_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'channels_status') THEN
    ALTER TABLE notifications ADD COLUMN channels_status JSONB DEFAULT '{}';
  END IF;
END$$;

-- Index conditionnels
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications(profile_id);
  END IF;
END$$;

-- Table de préférences de notifications
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Canaux activés
  in_app_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT false,
  
  -- Plages horaires (ne pas déranger)
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  -- Fréquence des digests email
  email_digest_frequency TEXT DEFAULT 'instant',
  
  -- Templates désactivés
  disabled_templates TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_profile ON notification_preferences(profile_id);

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their notification preferences" ON notification_preferences;
CREATE POLICY "Users can manage their notification preferences"
  ON notification_preferences FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

COMMENT ON TABLE notification_preferences IS 'Préférences de notification par utilisateur';


-- ========== 20251205700000_provider_missing_tables.sql ==========
-- =====================================================
-- MIGRATION: Tables et fonctions manquantes prestataire
-- Corrige les erreurs critiques du module prestataire
-- =====================================================

-- =====================================================
-- 1. TABLE: provider_reviews (avis clients)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relations
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  
  -- Notes (1-5)
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_punctuality INTEGER CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_quality INTEGER CHECK (rating_quality BETWEEN 1 AND 5),
  rating_communication INTEGER CHECK (rating_communication BETWEEN 1 AND 5),
  rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5),
  
  -- Contenu
  title TEXT,
  comment TEXT,
  would_recommend BOOLEAN DEFAULT true,
  
  -- Réponse du prestataire
  provider_response TEXT,
  provider_response_at TIMESTAMPTZ,
  
  -- Modération
  is_published BOOLEAN DEFAULT true,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES profiles(id),
  
  -- Métadonnées
  helpful_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_reviews_provider ON provider_reviews(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_reviewer ON provider_reviews(reviewer_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_rating ON provider_reviews(rating_overall);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_published ON provider_reviews(is_published) WHERE is_published = true;

-- RLS
ALTER TABLE provider_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published reviews" ON provider_reviews;
CREATE POLICY "Anyone can read published reviews"
  ON provider_reviews FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Providers can read own reviews" ON provider_reviews;
CREATE POLICY "Providers can read own reviews"
  ON provider_reviews FOR SELECT
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can create reviews" ON provider_reviews;
CREATE POLICY "Owners can create reviews"
  ON provider_reviews FOR INSERT
  WITH CHECK (reviewer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS "Providers can respond to reviews" ON provider_reviews;
CREATE POLICY "Providers can respond to reviews"
  ON provider_reviews FOR UPDATE
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- =====================================================
-- 2. TABLE: provider_availability (disponibilités)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Type de créneau
  type TEXT NOT NULL CHECK (type IN ('available', 'busy', 'vacation')),
  
  -- Récurrence ou date unique
  is_recurring BOOLEAN DEFAULT false,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = dimanche
  
  -- Horaires
  start_time TIME,
  end_time TIME,
  
  -- Pour les dates uniques
  specific_date DATE,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_availability_provider ON provider_availability(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_availability_date ON provider_availability(specific_date);
CREATE INDEX IF NOT EXISTS idx_provider_availability_day ON provider_availability(day_of_week);

-- RLS
ALTER TABLE provider_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can manage own availability" ON provider_availability;
CREATE POLICY "Providers can manage own availability"
  ON provider_availability FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view provider availability" ON provider_availability;
CREATE POLICY "Owners can view provider availability"
  ON provider_availability FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner'));

-- =====================================================
-- 3. TABLE: provider_quotes (devis)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Numérotation
  reference TEXT UNIQUE NOT NULL,
  
  -- Relations
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID REFERENCES profiles(id),
  property_id UUID REFERENCES properties(id),
  ticket_id UUID REFERENCES tickets(id),
  
  -- Contenu
  title TEXT NOT NULL,
  description TEXT,
  
  -- Montants
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Validité
  valid_until DATE,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted')),
  
  -- Dates
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Conversion en facture
  converted_invoice_id UUID,
  
  -- Notes
  internal_notes TEXT,
  terms_and_conditions TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_quotes_provider ON provider_quotes(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_quotes_owner ON provider_quotes(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_quotes_status ON provider_quotes(status);
CREATE INDEX IF NOT EXISTS idx_provider_quotes_reference ON provider_quotes(reference);

-- RLS
ALTER TABLE provider_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can manage own quotes" ON provider_quotes;
CREATE POLICY "Providers can manage own quotes"
  ON provider_quotes FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view quotes addressed to them" ON provider_quotes;
CREATE POLICY "Owners can view quotes addressed to them"
  ON provider_quotes FOR SELECT
  USING (owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- =====================================================
-- 4. TABLE: provider_quote_items (lignes de devis)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES provider_quotes(id) ON DELETE CASCADE,
  
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'unité',
  unit_price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20,
  
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_quote_items_quote ON provider_quote_items(quote_id);

-- RLS
ALTER TABLE provider_quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage quote items via quotes" ON provider_quote_items;
CREATE POLICY "Users can manage quote items via quotes"
  ON provider_quote_items FOR ALL
  USING (
    quote_id IN (
      SELECT id FROM provider_quotes 
      WHERE provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- =====================================================
-- 5. FONCTION: provider_dashboard (dashboard principal)
-- =====================================================

CREATE OR REPLACE FUNCTION provider_dashboard(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_stats JSONB;
  v_pending_orders JSONB;
  v_recent_reviews JSONB;
BEGIN
  -- Récupérer le profil prestataire
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id AND role = 'provider';
  
  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Statistiques
  SELECT jsonb_build_object(
    'total_interventions', COUNT(*),
    'completed_interventions', COUNT(*) FILTER (WHERE statut = 'done'),
    'pending_interventions', COUNT(*) FILTER (WHERE statut IN ('assigned', 'scheduled')),
    'in_progress_interventions', COUNT(*) FILTER (WHERE statut = 'in_progress'),
    'total_revenue', COALESCE(SUM(cout_final) FILTER (WHERE statut = 'done'), 0),
    'avg_rating', (
      SELECT ROUND(AVG(rating_overall)::NUMERIC, 1)
      FROM provider_reviews
      WHERE provider_profile_id = v_profile_id AND is_published = true
    ),
    'total_reviews', (
      SELECT COUNT(*) FROM provider_reviews
      WHERE provider_profile_id = v_profile_id AND is_published = true
    )
  ) INTO v_stats
  FROM work_orders
  WHERE provider_id = v_profile_id;
  
  -- Interventions en attente (avec détails)
  SELECT COALESCE(jsonb_agg(order_data ORDER BY order_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_pending_orders
  FROM (
    SELECT jsonb_build_object(
      'id', wo.id,
      'ticket_id', wo.ticket_id,
      'statut', wo.statut,
      'cout_estime', wo.cout_estime,
      'date_intervention_prevue', wo.date_intervention_prevue,
      'created_at', wo.created_at,
      'ticket', jsonb_build_object(
        'titre', t.titre,
        'priorite', t.priorite
      ),
      'property', jsonb_build_object(
        'adresse', p.adresse_complete,
        'ville', p.ville
      )
    ) as order_data
    FROM work_orders wo
    JOIN tickets t ON t.id = wo.ticket_id
    JOIN properties p ON p.id = t.property_id
    WHERE wo.provider_id = v_profile_id
    AND wo.statut IN ('assigned', 'scheduled', 'in_progress')
    ORDER BY wo.created_at DESC
    LIMIT 10
  ) sub;
  
  -- Avis récents
  SELECT COALESCE(jsonb_agg(review_data ORDER BY review_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_recent_reviews
  FROM (
    SELECT jsonb_build_object(
      'id', pr.id,
      'rating_overall', pr.rating_overall,
      'comment', pr.comment,
      'created_at', pr.created_at,
      'reviewer', jsonb_build_object(
        'prenom', prof.prenom,
        'nom', LEFT(prof.nom, 1) || '.'
      )
    ) as review_data
    FROM provider_reviews pr
    JOIN profiles prof ON prof.id = pr.reviewer_profile_id
    WHERE pr.provider_profile_id = v_profile_id
    AND pr.is_published = true
    ORDER BY pr.created_at DESC
    LIMIT 5
  ) sub;
  
  -- Construire le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'stats', v_stats,
    'pending_orders', v_pending_orders,
    'recent_reviews', v_recent_reviews
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 6. FONCTION: Génération numéro de devis
-- =====================================================

CREATE OR REPLACE FUNCTION generate_quote_reference(p_provider_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER;
  v_count INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM provider_quotes
  WHERE provider_profile_id = p_provider_id
  AND EXTRACT(YEAR FROM created_at) = v_year;
  
  RETURN 'DEV-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- Trigger pour générer automatiquement la référence
CREATE OR REPLACE FUNCTION trigger_generate_quote_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := generate_quote_reference(NEW.provider_profile_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_quote_reference ON provider_quotes;
CREATE TRIGGER trg_generate_quote_reference
  BEFORE INSERT ON provider_quotes
  FOR EACH ROW EXECUTE FUNCTION trigger_generate_quote_reference();

-- =====================================================
-- 7. TRIGGER: Calcul automatique des totaux de devis
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(10,2);
  v_tax_amount DECIMAL(10,2);
BEGIN
  SELECT 
    COALESCE(SUM(quantity * unit_price), 0),
    COALESCE(SUM(quantity * unit_price * tax_rate / 100), 0)
  INTO v_subtotal, v_tax_amount
  FROM provider_quote_items
  WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  UPDATE provider_quotes
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_subtotal + v_tax_amount,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_quote_totals ON provider_quote_items;
CREATE TRIGGER trg_calculate_quote_totals
  AFTER INSERT OR UPDATE OR DELETE ON provider_quote_items
  FOR EACH ROW EXECUTE FUNCTION calculate_quote_totals();

-- =====================================================
-- 8. TRIGGERS: updated_at
-- =====================================================

DROP TRIGGER IF EXISTS trg_provider_reviews_updated_at ON provider_reviews;
CREATE TRIGGER trg_provider_reviews_updated_at
  BEFORE UPDATE ON provider_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_provider_availability_updated_at ON provider_availability;
CREATE TRIGGER trg_provider_availability_updated_at
  BEFORE UPDATE ON provider_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_provider_quotes_updated_at ON provider_quotes;
CREATE TRIGGER trg_provider_quotes_updated_at
  BEFORE UPDATE ON provider_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE provider_reviews IS 'Avis clients sur les prestataires';
COMMENT ON TABLE provider_availability IS 'Disponibilités et créneaux des prestataires';
COMMENT ON TABLE provider_quotes IS 'Devis des prestataires';
COMMENT ON TABLE provider_quote_items IS 'Lignes de devis';
COMMENT ON FUNCTION provider_dashboard IS 'Dashboard principal du prestataire avec stats et interventions';



-- ========== 20251205800000_intervention_flow_complete.sql ==========
-- =====================================================
-- MIGRATION: Flux Intervention Complet SOTA 2025
-- Cycle: Visite → Devis → Acompte → Travaux → Solde
-- Frais transparents: 2.4% + 0.75€ (payés par prestataire)
-- =====================================================

-- =====================================================
-- 1. EXTENSION: work_orders - Nouveaux statuts
-- =====================================================

-- Supprimer l'ancienne contrainte
ALTER TABLE work_orders 
  DROP CONSTRAINT IF EXISTS work_orders_statut_check;

-- Ajouter les nouveaux statuts
ALTER TABLE work_orders 
  ADD CONSTRAINT work_orders_statut_check 
  CHECK (statut IN (
    -- Flux initial
    'assigned',           -- Assigné, en attente acceptation prestataire
    'accepted',           -- Accepté, en attente prise de RDV visite
    'refused',            -- Refusé par le prestataire
    
    -- Phase visite
    'visit_scheduled',    -- RDV visite planifié
    'visit_completed',    -- Visite effectuée, en attente devis
    
    -- Phase devis
    'quote_sent',         -- Devis envoyé
    'quote_accepted',     -- Devis accepté, en attente acompte
    'quote_refused',      -- Devis refusé
    
    -- Phase paiement acompte
    'deposit_pending',    -- Acompte en attente de paiement
    'deposit_paid',       -- Acompte payé (2/3), fonds en escrow
    
    -- Phase travaux
    'work_scheduled',     -- Travaux planifiés
    'in_progress',        -- Travaux en cours
    'work_completed',     -- Travaux terminés
    
    -- Phase solde
    'balance_pending',    -- Solde en attente de paiement
    'fully_paid',         -- Entièrement payé
    
    -- Clôture
    'pending_review',     -- En attente d'avis
    'closed',             -- Clôturé
    
    -- Cas particuliers
    'cancelled',          -- Annulé
    'disputed'            -- Litige en cours
  ));

-- Nouveaux champs pour le flux complet
ALTER TABLE work_orders
  -- Dates clés
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refusal_reason TEXT,
  ADD COLUMN IF NOT EXISTS visit_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_notes TEXT,
  ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_report TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  
  -- Lien avec le devis accepté
  ADD COLUMN IF NOT EXISTS accepted_quote_id UUID,
  
  -- Photos
  ADD COLUMN IF NOT EXISTS visit_photos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS before_photos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS after_photos JSONB DEFAULT '[]';

-- =====================================================
-- 2. TABLE: payment_fee_config
-- Configuration des frais de paiement
-- =====================================================

CREATE TABLE IF NOT EXISTS payment_fee_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identifiant unique de la config
  config_key TEXT UNIQUE NOT NULL DEFAULT 'default',
  
  -- Frais Stripe (incompressibles)
  stripe_percent DECIMAL(5,4) NOT NULL DEFAULT 0.014,    -- 1.4%
  stripe_fixed DECIMAL(10,2) NOT NULL DEFAULT 0.25,      -- 0.25€
  
  -- Marge plateforme
  platform_percent DECIMAL(5,4) NOT NULL DEFAULT 0.01,   -- 1.0%
  platform_fixed DECIMAL(10,2) NOT NULL DEFAULT 0.50,    -- 0.50€
  
  -- Qui paie les frais
  fee_payer TEXT NOT NULL DEFAULT 'provider' CHECK (fee_payer IN ('provider', 'owner', 'split')),
  
  -- Acompte
  deposit_percent DECIMAL(5,2) NOT NULL DEFAULT 66.67,   -- 2/3
  
  -- Actif
  is_active BOOLEAN DEFAULT true,
  
  -- Dates
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer la configuration par défaut
INSERT INTO payment_fee_config (config_key, stripe_percent, stripe_fixed, platform_percent, platform_fixed, fee_payer, deposit_percent)
VALUES ('default', 0.014, 0.25, 0.01, 0.50, 'provider', 66.67)
ON CONFLICT (config_key) DO NOTHING;

-- =====================================================
-- 3. TABLE: work_order_payments
-- Paiements d'intervention (acompte + solde)
-- =====================================================

CREATE TABLE IF NOT EXISTS work_order_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relations
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES provider_quotes(id),
  payer_profile_id UUID NOT NULL REFERENCES profiles(id),       -- Propriétaire qui paie
  payee_profile_id UUID NOT NULL REFERENCES profiles(id),       -- Prestataire qui reçoit
  
  -- Type de paiement
  payment_type TEXT NOT NULL CHECK (payment_type IN (
    'deposit',     -- Acompte (2/3)
    'balance',     -- Solde (1/3)
    'full',        -- Paiement intégral
    'refund'       -- Remboursement
  )),
  
  -- Montants bruts
  gross_amount DECIMAL(10,2) NOT NULL CHECK (gross_amount > 0),  -- Montant payé par propriétaire
  percentage_of_total DECIMAL(5,2),                               -- 66.67 ou 33.33
  
  -- Frais détaillés
  stripe_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Montant net pour le prestataire
  net_amount DECIMAL(10,2) NOT NULL,
  
  -- Méthode de paiement
  payment_method TEXT CHECK (payment_method IN ('card', 'sepa_debit', 'bank_transfer', 'direct')),
  
  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,          -- Transfer vers le compte Connect du prestataire
  
  -- Escrow (séquestre)
  escrow_status TEXT DEFAULT 'none' CHECK (escrow_status IN (
    'none',       -- Pas d'escrow (paiement direct)
    'pending',    -- En attente de paiement
    'held',       -- Fonds bloqués sur la plateforme
    'released',   -- Libéré vers prestataire
    'refunded',   -- Remboursé au propriétaire
    'disputed'    -- En litige
  )),
  escrow_held_at TIMESTAMPTZ,
  escrow_released_at TIMESTAMPTZ,
  escrow_release_reason TEXT,
  
  -- Statut global
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- En attente
    'processing',   -- En cours de traitement
    'succeeded',    -- Réussi
    'failed',       -- Échoué
    'cancelled',    -- Annulé
    'refunded',     -- Remboursé
    'disputed'      -- Contesté
  )),
  
  -- Dates
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  failure_code TEXT,
  
  -- Facture de frais générée
  fee_invoice_id UUID,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_wo_payments_work_order ON work_order_payments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_payments_payer ON work_order_payments(payer_profile_id);
CREATE INDEX IF NOT EXISTS idx_wo_payments_payee ON work_order_payments(payee_profile_id);
CREATE INDEX IF NOT EXISTS idx_wo_payments_status ON work_order_payments(status);
CREATE INDEX IF NOT EXISTS idx_wo_payments_escrow ON work_order_payments(escrow_status);
CREATE INDEX IF NOT EXISTS idx_wo_payments_type ON work_order_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_wo_payments_stripe ON work_order_payments(stripe_payment_intent_id);

-- =====================================================
-- 4. TABLE: work_order_timeline
-- Historique complet des étapes
-- =====================================================

CREATE TABLE IF NOT EXISTS work_order_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  -- Événement
  event_type TEXT NOT NULL CHECK (event_type IN (
    -- Création et assignation
    'created', 'assigned', 'accepted', 'refused',
    
    -- Visite
    'visit_proposed', 'visit_scheduled', 'visit_rescheduled', 'visit_completed', 'visit_cancelled',
    
    -- Devis
    'quote_created', 'quote_sent', 'quote_viewed', 'quote_accepted', 'quote_refused', 'quote_expired',
    
    -- Paiements
    'deposit_requested', 'deposit_paid', 'deposit_failed',
    'balance_requested', 'balance_paid', 'balance_failed',
    'payment_refunded',
    
    -- Travaux
    'work_scheduled', 'work_started', 'work_paused', 'work_resumed', 'work_completed',
    
    -- Clôture
    'review_requested', 'review_submitted', 'review_responded',
    'closed',
    
    -- Incidents
    'cancelled', 'dispute_opened', 'dispute_resolved',
    
    -- Communication
    'message_sent', 'photo_added', 'document_added',
    
    -- Système
    'reminder_sent', 'status_changed', 'auto_action'
  )),
  
  -- Acteur
  actor_profile_id UUID REFERENCES profiles(id),
  actor_role TEXT CHECK (actor_role IN ('owner', 'provider', 'tenant', 'admin', 'system')),
  
  -- Changement de statut
  old_status TEXT,
  new_status TEXT,
  
  -- Données de l'événement
  event_data JSONB DEFAULT '{}',
  
  -- Commentaire/description
  description TEXT,
  
  -- Visibilité
  is_internal BOOLEAN DEFAULT false,  -- Si true, visible uniquement par admin
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_wo_timeline_work_order ON work_order_timeline(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_timeline_event ON work_order_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_wo_timeline_created ON work_order_timeline(created_at);
CREATE INDEX IF NOT EXISTS idx_wo_timeline_actor ON work_order_timeline(actor_profile_id);

-- =====================================================
-- 5. FONCTION: Calcul des frais de paiement
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_payment_fees(
  p_amount DECIMAL(10,2),
  p_config_key TEXT DEFAULT 'default'
)
RETURNS TABLE (
  gross_amount DECIMAL(10,2),
  stripe_fee DECIMAL(10,2),
  platform_fee DECIMAL(10,2),
  total_fees DECIMAL(10,2),
  net_amount DECIMAL(10,2),
  effective_rate DECIMAL(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_config payment_fee_config%ROWTYPE;
  v_stripe_fee DECIMAL(10,2);
  v_platform_fee DECIMAL(10,2);
  v_total_fees DECIMAL(10,2);
  v_net_amount DECIMAL(10,2);
BEGIN
  -- Récupérer la configuration
  SELECT * INTO v_config
  FROM payment_fee_config
  WHERE config_key = p_config_key AND is_active = true
  LIMIT 1;
  
  IF v_config IS NULL THEN
    -- Config par défaut si non trouvée
    v_stripe_fee := (p_amount * 0.014) + 0.25;
    v_platform_fee := (p_amount * 0.01) + 0.50;
  ELSE
    v_stripe_fee := (p_amount * v_config.stripe_percent) + v_config.stripe_fixed;
    v_platform_fee := (p_amount * v_config.platform_percent) + v_config.platform_fixed;
  END IF;
  
  -- Arrondir à 2 décimales
  v_stripe_fee := ROUND(v_stripe_fee, 2);
  v_platform_fee := ROUND(v_platform_fee, 2);
  v_total_fees := v_stripe_fee + v_platform_fee;
  v_net_amount := p_amount - v_total_fees;
  
  RETURN QUERY SELECT 
    p_amount,
    v_stripe_fee,
    v_platform_fee,
    v_total_fees,
    v_net_amount,
    ROUND((v_total_fees / p_amount * 100)::DECIMAL, 2);
END;
$$;

-- =====================================================
-- 6. FONCTION: Calcul acompte et solde
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_deposit_and_balance(
  p_total_amount DECIMAL(10,2),
  p_config_key TEXT DEFAULT 'default'
)
RETURNS TABLE (
  total_amount DECIMAL(10,2),
  deposit_percent DECIMAL(5,2),
  deposit_amount DECIMAL(10,2),
  deposit_fees DECIMAL(10,2),
  deposit_net DECIMAL(10,2),
  balance_percent DECIMAL(5,2),
  balance_amount DECIMAL(10,2),
  balance_fees DECIMAL(10,2),
  balance_net DECIMAL(10,2),
  total_fees DECIMAL(10,2),
  total_net DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_config payment_fee_config%ROWTYPE;
  v_deposit_pct DECIMAL(5,2);
  v_deposit_amt DECIMAL(10,2);
  v_balance_amt DECIMAL(10,2);
  v_deposit_fees RECORD;
  v_balance_fees RECORD;
BEGIN
  -- Récupérer la configuration
  SELECT * INTO v_config
  FROM payment_fee_config
  WHERE config_key = p_config_key AND is_active = true
  LIMIT 1;
  
  v_deposit_pct := COALESCE(v_config.deposit_percent, 66.67);
  v_deposit_amt := ROUND(p_total_amount * v_deposit_pct / 100, 2);
  v_balance_amt := p_total_amount - v_deposit_amt;
  
  -- Calculer les frais pour chaque paiement
  SELECT * INTO v_deposit_fees FROM calculate_payment_fees(v_deposit_amt, p_config_key);
  SELECT * INTO v_balance_fees FROM calculate_payment_fees(v_balance_amt, p_config_key);
  
  RETURN QUERY SELECT 
    p_total_amount,
    v_deposit_pct,
    v_deposit_amt,
    v_deposit_fees.total_fees,
    v_deposit_fees.net_amount,
    (100 - v_deposit_pct),
    v_balance_amt,
    v_balance_fees.total_fees,
    v_balance_fees.net_amount,
    (v_deposit_fees.total_fees + v_balance_fees.total_fees),
    (v_deposit_fees.net_amount + v_balance_fees.net_amount);
END;
$$;

-- =====================================================
-- 7. FONCTION: Ajouter un événement au timeline
-- =====================================================

CREATE OR REPLACE FUNCTION add_work_order_event(
  p_work_order_id UUID,
  p_event_type TEXT,
  p_actor_profile_id UUID DEFAULT NULL,
  p_actor_role TEXT DEFAULT 'system',
  p_old_status TEXT DEFAULT NULL,
  p_new_status TEXT DEFAULT NULL,
  p_event_data JSONB DEFAULT '{}',
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO work_order_timeline (
    work_order_id,
    event_type,
    actor_profile_id,
    actor_role,
    old_status,
    new_status,
    event_data,
    description
  ) VALUES (
    p_work_order_id,
    p_event_type,
    p_actor_profile_id,
    p_actor_role,
    p_old_status,
    p_new_status,
    p_event_data,
    p_description
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- =====================================================
-- 8. TRIGGER: Log automatique des changements de statut
-- =====================================================

CREATE OR REPLACE FUNCTION log_work_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    PERFORM add_work_order_event(
      NEW.id,
      'status_changed',
      NULL,
      'system',
      OLD.statut,
      NEW.statut,
      jsonb_build_object(
        'changed_at', NOW(),
        'trigger', 'auto'
      ),
      'Statut changé de ' || COALESCE(OLD.statut, 'null') || ' à ' || NEW.statut
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_work_order_status ON work_orders;
CREATE TRIGGER trg_log_work_order_status
  AFTER UPDATE OF statut ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_work_order_status_change();

-- =====================================================
-- 9. RLS POLICIES
-- =====================================================

ALTER TABLE payment_fee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_timeline ENABLE ROW LEVEL SECURITY;

-- payment_fee_config: lecture publique
CREATE POLICY "Anyone can read fee config"
  ON payment_fee_config FOR SELECT
  USING (is_active = true);

-- Admins peuvent modifier la config
CREATE POLICY "Admins can manage fee config"
  ON payment_fee_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- work_order_payments: visible par payer et payee
DROP POLICY IF EXISTS "Payment parties can view" ON work_order_payments;
CREATE POLICY "Payment parties can view"
  ON work_order_payments FOR SELECT
  USING (
    payer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR payee_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Seul le système/admin peut créer des paiements
CREATE POLICY "System can create payments"
  ON work_order_payments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- work_order_timeline: visible par les parties de l'intervention
DROP POLICY IF EXISTS "Work order parties can view timeline" ON work_order_timeline;
CREATE POLICY "Work order parties can view timeline"
  ON work_order_timeline FOR SELECT
  USING (
    work_order_id IN (
      SELECT wo.id FROM work_orders wo
      JOIN tickets t ON t.id = wo.ticket_id
      JOIN properties p ON p.id = t.property_id
      WHERE wo.provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
         OR p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- 10. EXTENSION: provider_quotes pour acompte
-- =====================================================

ALTER TABLE provider_quotes
  ADD COLUMN IF NOT EXISTS requires_deposit BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS deposit_percent DECIMAL(5,2) DEFAULT 66.67,
  ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS balance_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS requires_visit BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS visit_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS visit_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_notes TEXT;

-- =====================================================
-- 11. VUE: Résumé intervention avec paiements
-- =====================================================

CREATE OR REPLACE VIEW v_work_order_payment_summary AS
SELECT 
  wo.id AS work_order_id,
  wo.ticket_id,
  wo.provider_id,
  wo.statut,
  wo.created_at,
  
  -- Devis accepté
  pq.id AS quote_id,
  pq.total_amount AS quote_amount,
  pq.deposit_percent,
  pq.deposit_amount,
  pq.balance_amount,
  
  -- Paiement acompte
  dep.id AS deposit_payment_id,
  dep.status AS deposit_status,
  dep.gross_amount AS deposit_paid,
  dep.paid_at AS deposit_paid_at,
  dep.escrow_status AS deposit_escrow,
  
  -- Paiement solde
  bal.id AS balance_payment_id,
  bal.status AS balance_status,
  bal.gross_amount AS balance_paid,
  bal.paid_at AS balance_paid_at,
  
  -- Totaux
  COALESCE(dep.gross_amount, 0) + COALESCE(bal.gross_amount, 0) AS total_paid,
  COALESCE(dep.total_fees, 0) + COALESCE(bal.total_fees, 0) AS total_fees,
  COALESCE(dep.net_amount, 0) + COALESCE(bal.net_amount, 0) AS total_net_provider

FROM work_orders wo
LEFT JOIN provider_quotes pq ON pq.id = wo.accepted_quote_id
LEFT JOIN work_order_payments dep ON dep.work_order_id = wo.id AND dep.payment_type = 'deposit'
LEFT JOIN work_order_payments bal ON bal.work_order_id = wo.id AND bal.payment_type = 'balance';

-- =====================================================
-- 12. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE payment_fee_config IS 'Configuration des frais de paiement (Stripe + plateforme)';
COMMENT ON TABLE work_order_payments IS 'Paiements d''intervention (acompte 2/3 + solde 1/3)';
COMMENT ON TABLE work_order_timeline IS 'Historique complet des événements d''une intervention';
COMMENT ON FUNCTION calculate_payment_fees IS 'Calcule les frais pour un montant donné';
COMMENT ON FUNCTION calculate_deposit_and_balance IS 'Calcule l''acompte (2/3) et le solde (1/3) avec frais';



-- ========== 20251206100000_vigilance_audit_log.sql ==========
-- =====================================================
-- MIGRATION: Log d'audit des vérifications de vigilance
-- Conformité Article L.8222-1 du Code du travail
-- =====================================================

-- =====================================================
-- 1. TABLE: vigilance_audit_log
-- Historique des vérifications de vigilance
-- =====================================================

CREATE TABLE IF NOT EXISTS vigilance_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Acteurs
  owner_profile_id UUID NOT NULL REFERENCES profiles(id),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Contexte
  quote_id UUID REFERENCES quotes(id),
  work_order_id UUID REFERENCES work_orders(id),
  
  -- Montants
  amount_ht DECIMAL(10,2) NOT NULL,
  threshold_ht DECIMAL(10,2) NOT NULL DEFAULT 5000,
  yearly_total_ht DECIMAL(10,2), -- Cumul annuel
  
  -- Résultat de la vérification
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_compliant BOOLEAN NOT NULL,
  
  -- Documents
  missing_documents TEXT[] DEFAULT '{}',
  expired_documents TEXT[] DEFAULT '{}',
  valid_documents TEXT[] DEFAULT '{}',
  
  -- Action prise
  action_taken TEXT NOT NULL CHECK (action_taken IN (
    'approved',   -- Accepté (conforme)
    'blocked',    -- Bloqué (non conforme)
    'override'    -- Passé outre (avec justification)
  )),
  override_reason TEXT, -- Obligatoire si action_taken = 'override'
  
  -- Métadonnées
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_vigilance_audit_owner ON vigilance_audit_log(owner_profile_id);
CREATE INDEX idx_vigilance_audit_provider ON vigilance_audit_log(provider_profile_id);
CREATE INDEX idx_vigilance_audit_date ON vigilance_audit_log(created_at);
CREATE INDEX idx_vigilance_audit_action ON vigilance_audit_log(action_taken);

-- =====================================================
-- 2. VUE: Cumul annuel par couple propriétaire/prestataire
-- =====================================================

CREATE OR REPLACE VIEW vigilance_yearly_totals AS
SELECT 
  owner_profile_id,
  provider_profile_id,
  EXTRACT(YEAR FROM created_at) AS year,
  SUM(amount_ht) AS total_amount_ht,
  COUNT(*) AS transaction_count,
  BOOL_OR(NOT is_compliant) AS had_compliance_issues
FROM vigilance_audit_log
WHERE action_taken IN ('approved', 'override')
GROUP BY owner_profile_id, provider_profile_id, EXTRACT(YEAR FROM created_at);

-- =====================================================
-- 3. FONCTION: Vérifier le cumul annuel
-- =====================================================

CREATE OR REPLACE FUNCTION get_vigilance_yearly_total(
  p_owner_id UUID,
  p_provider_id UUID,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(amount_ht), 0) INTO v_total
  FROM vigilance_audit_log
  WHERE owner_profile_id = p_owner_id
    AND provider_profile_id = p_provider_id
    AND EXTRACT(YEAR FROM created_at) = p_year
    AND action_taken IN ('approved', 'override');
  
  RETURN v_total;
END;
$$;

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

ALTER TABLE vigilance_audit_log ENABLE ROW LEVEL SECURITY;

-- Les propriétaires peuvent voir leurs propres logs
DROP POLICY IF EXISTS "Owners can view own vigilance logs" ON vigilance_audit_log;
CREATE POLICY "Owners can view own vigilance logs"
  ON vigilance_audit_log FOR SELECT
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Les prestataires peuvent voir les logs les concernant
DROP POLICY IF EXISTS "Providers can view own vigilance logs" ON vigilance_audit_log;
CREATE POLICY "Providers can view own vigilance logs"
  ON vigilance_audit_log FOR SELECT
  USING (
    provider_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Les admins peuvent tout voir
DROP POLICY IF EXISTS "Admins can view all vigilance logs" ON vigilance_audit_log;
CREATE POLICY "Admins can view all vigilance logs"
  ON vigilance_audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Insertion uniquement par le système (service role)
DROP POLICY IF EXISTS "System can insert vigilance logs" ON vigilance_audit_log;
CREATE POLICY "System can insert vigilance logs"
  ON vigilance_audit_log FOR INSERT
  WITH CHECK (true); -- Contrôlé par le backend

-- =====================================================
-- 5. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE vigilance_audit_log IS 'Log d''audit des vérifications de vigilance (Article L.8222-1)';
COMMENT ON FUNCTION get_vigilance_yearly_total IS 'Calcule le cumul annuel des prestations entre un propriétaire et un prestataire';



-- ========== 20251206200000_provider_portfolio.sql ==========
-- =====================================================
-- MIGRATION: Portfolio prestataire
-- Photos avant/après des réalisations
-- =====================================================

-- =====================================================
-- 1. TABLE: provider_portfolio_items
-- Réalisations des prestataires avec photos avant/après
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_portfolio_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Source (optionnel, si issu d'une intervention)
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  
  -- Catégorie
  service_type TEXT NOT NULL,
  intervention_type TEXT, -- depannage, installation, renovation, entretien
  
  -- Titre et description
  title TEXT NOT NULL,
  description TEXT,
  
  -- Photos AVANT / APRÈS
  before_photo_url TEXT,
  before_photo_caption TEXT,
  after_photo_url TEXT NOT NULL,
  after_photo_caption TEXT,
  
  -- Photos supplémentaires (JSONB array)
  additional_photos JSONB DEFAULT '[]',
  -- Format: [{ "url": "...", "caption": "...", "type": "before|after|during" }]
  
  -- Contexte
  location_type TEXT CHECK (location_type IN ('appartement', 'maison', 'commerce', 'bureau', 'autre')),
  location_city TEXT,
  location_department TEXT,
  completed_at DATE,
  duration_hours DECIMAL(5,2),
  
  -- Coût (optionnel, pour référence)
  total_cost DECIMAL(10,2),
  
  -- Visibilité
  is_public BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  
  -- Modération
  moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN (
    'pending',    -- En attente de modération
    'approved',   -- Approuvé et visible
    'rejected'    -- Rejeté
  )),
  moderated_by UUID REFERENCES auth.users(id),
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  
  -- Métadonnées
  tags TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_portfolio_provider ON provider_portfolio_items(provider_profile_id);
CREATE INDEX idx_portfolio_service ON provider_portfolio_items(service_type);
CREATE INDEX idx_portfolio_public ON provider_portfolio_items(is_public, moderation_status) 
  WHERE is_public = true AND moderation_status = 'approved';
CREATE INDEX idx_portfolio_featured ON provider_portfolio_items(provider_profile_id, is_featured)
  WHERE is_featured = true;
CREATE INDEX idx_portfolio_moderation ON provider_portfolio_items(moderation_status)
  WHERE moderation_status = 'pending';

-- Contrainte: max 3 items en vedette par prestataire
CREATE OR REPLACE FUNCTION check_max_featured_items()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_featured = true THEN
    IF (SELECT COUNT(*) FROM provider_portfolio_items 
        WHERE provider_profile_id = NEW.provider_profile_id 
        AND is_featured = true 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)) >= 3 THEN
      RAISE EXCEPTION 'Maximum 3 items en vedette par prestataire';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_max_featured ON provider_portfolio_items;
CREATE TRIGGER trg_check_max_featured
  BEFORE INSERT OR UPDATE OF is_featured ON provider_portfolio_items
  FOR EACH ROW EXECUTE FUNCTION check_max_featured_items();

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_portfolio_items_updated_at ON provider_portfolio_items;
CREATE TRIGGER trg_portfolio_items_updated_at
  BEFORE UPDATE ON provider_portfolio_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. VUE: Portfolio public avec stats prestataire
-- =====================================================

-- Vue simplifiée sans dépendance à provider_reviews
CREATE OR REPLACE VIEW provider_portfolio_public AS
SELECT 
  ppi.*,
  p.prenom || ' ' || p.nom AS provider_name,
  pp.type_services,
  pp.certifications
FROM provider_portfolio_items ppi
JOIN profiles p ON p.id = ppi.provider_profile_id
LEFT JOIN provider_profiles pp ON pp.profile_id = ppi.provider_profile_id
WHERE ppi.is_public = true 
  AND ppi.moderation_status = 'approved';

-- =====================================================
-- 3. FONCTION: Obtenir le portfolio d'un prestataire
-- =====================================================

CREATE OR REPLACE FUNCTION get_provider_portfolio(
  p_provider_id UUID,
  p_include_private BOOLEAN DEFAULT false
)
RETURNS SETOF provider_portfolio_items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM provider_portfolio_items
  WHERE provider_profile_id = p_provider_id
    AND (p_include_private OR (is_public = true AND moderation_status = 'approved'))
  ORDER BY is_featured DESC, display_order ASC, created_at DESC;
END;
$$;

-- =====================================================
-- 4. FONCTION: Importer depuis une intervention
-- =====================================================

CREATE OR REPLACE FUNCTION import_portfolio_from_work_order(
  p_work_order_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_order RECORD;
  v_ticket RECORD;
  v_portfolio_id UUID;
BEGIN
  -- Récupérer les infos de l'intervention
  SELECT * INTO v_work_order 
  FROM work_orders 
  WHERE id = p_work_order_id;
  
  IF v_work_order IS NULL THEN
    RAISE EXCEPTION 'Work order non trouvé';
  END IF;
  
  -- Récupérer le ticket associé
  SELECT t.*, p.type AS property_type, p.ville, p.code_postal
  INTO v_ticket
  FROM tickets t
  JOIN properties p ON p.id = t.property_id
  WHERE t.id = v_work_order.ticket_id;
  
  -- Créer l'item de portfolio
  INSERT INTO provider_portfolio_items (
    provider_profile_id,
    work_order_id,
    service_type,
    title,
    description,
    before_photo_url,
    after_photo_url,
    location_type,
    location_city,
    completed_at,
    total_cost
  ) VALUES (
    v_work_order.provider_id,
    p_work_order_id,
    COALESCE(v_ticket.categorie, 'autre'),
    p_title,
    COALESCE(p_description, v_work_order.completion_report),
    (v_work_order.before_photos->0->>'url')::TEXT,
    (v_work_order.after_photos->0->>'url')::TEXT,
    v_ticket.property_type,
    v_ticket.ville,
    v_work_order.work_completed_at::DATE,
    v_work_order.cout_final
  )
  RETURNING id INTO v_portfolio_id;
  
  RETURN v_portfolio_id;
END;
$$;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

ALTER TABLE provider_portfolio_items ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les portfolios publics approuvés
DROP POLICY IF EXISTS "Anyone can view public portfolios" ON provider_portfolio_items;
CREATE POLICY "Anyone can view public portfolios"
  ON provider_portfolio_items FOR SELECT
  USING (is_public = true AND moderation_status = 'approved');

-- Les prestataires peuvent gérer leur propre portfolio
DROP POLICY IF EXISTS "Providers can manage own portfolio" ON provider_portfolio_items;
CREATE POLICY "Providers can manage own portfolio"
  ON provider_portfolio_items FOR ALL
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

-- Les admins peuvent tout voir et modérer
DROP POLICY IF EXISTS "Admins can manage all portfolios" ON provider_portfolio_items;
CREATE POLICY "Admins can manage all portfolios"
  ON provider_portfolio_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- 6. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE provider_portfolio_items IS 'Portfolio des réalisations prestataires avec photos avant/après';
COMMENT ON FUNCTION get_provider_portfolio IS 'Récupère le portfolio d''un prestataire (public ou complet)';
COMMENT ON FUNCTION import_portfolio_from_work_order IS 'Importe une intervention terminée dans le portfolio';



-- ========== 20251206300000_enterprise_tiers.sql ==========
-- Migration: Grille tarifaire Enterprise optimisée
-- Date: 2024-12-06
-- Description: Ajoute les 4 tiers Enterprise avec tarification par volume
--
-- NOUVELLE GRILLE ENTERPRISE (3 options combinées):
--   - enterprise_s: 199€/mois (50-100 biens) - 20 signatures incluses
--   - enterprise_m: 299€/mois (100-200 biens) - 30 signatures + White label basic
--   - enterprise_l: 449€/mois (200-500 biens) - 50 signatures + AM partagé ⭐
--   - enterprise_xl: 699€/mois (500+ biens) - Signatures illimitées + AM dédié
--
-- MISE À JOUR DES PLANS EXISTANTS:
--   - gratuit: 0€ (1 bien) - Nouveau plan d'acquisition
--   - starter: 9€/mois - 0 signature incluse, paiement en ligne
--   - confort: 29€/mois - 1 signature/mois incluse (au lieu de 5)
--   - pro: 59€/mois - 5 signatures/mois (au lieu de illimité)

BEGIN;

-- ============================================
-- ÉTAPE 1: Ajouter le plan GRATUIT
-- ============================================

INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'gratuit',
  'Gratuit',
  'Découvrez Talok et simplifiez la gestion de votre premier bien',
  0, 0,  -- Gratuit
  1, 1, 2, 0.1,  -- 1 bien, 100 Mo
  '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "signature_price": 590,
    "open_banking": false,
    "bank_reconciliation": false,
    "auto_reminders": false,
    "auto_reminders_sms": false,
    "irl_revision": false,
    "tenant_portal": "basic",
    "tenant_payment_online": false,
    "payment_fees_cb": 0,
    "payment_fees_sepa": 0,
    "lease_generation": true,
    "colocation": false,
    "multi_users": false,
    "work_orders": false,
    "providers_management": false,
    "owner_reports": false,
    "api_access": false,
    "scoring_tenant": false,
    "edl_digital": false,
    "gli_discount": 0,
    "included_properties": 1,
    "extra_property_price": 0
  }'::jsonb,
  true, false, -1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================
-- ÉTAPE 2: Mettre à jour STARTER avec paiements
-- ============================================

UPDATE subscription_plans SET
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "signature_price": 490,
    "open_banking": false,
    "bank_reconciliation": false,
    "auto_reminders": "email_basic",
    "auto_reminders_sms": false,
    "irl_revision": false,
    "tenant_portal": "basic",
    "tenant_payment_online": true,
    "payment_fees_cb": 220,
    "payment_fees_sepa": 50,
    "lease_generation": true,
    "colocation": false,
    "multi_users": false,
    "work_orders": false,
    "providers_management": false,
    "owner_reports": false,
    "api_access": false,
    "scoring_tenant": false,
    "edl_digital": false,
    "gli_discount": 0,
    "included_properties": 3,
    "extra_property_price": 300
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'starter';

-- ============================================
-- ÉTAPE 3: Mettre à jour CONFORT (1 signature/mois)
-- ============================================

UPDATE subscription_plans SET
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 1,
    "signature_price": 390,
    "open_banking": true,
    "open_banking_level": "basic",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": false,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "advanced",
    "tenant_payment_online": true,
    "payment_fees_cb": 220,
    "payment_fees_sepa": 50,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": false,
    "work_orders": true,
    "providers_management": false,
    "owner_reports": true,
    "api_access": false,
    "scoring_tenant": true,
    "edl_digital": true,
    "gli_discount": 10,
    "included_properties": 10,
    "extra_property_price": 250
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'confort';

-- ============================================
-- ÉTAPE 4: Mettre à jour PRO (5 signatures/mois)
-- ============================================

UPDATE subscription_plans SET
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 5,
    "signature_price": 290,
    "open_banking": true,
    "open_banking_level": "advanced",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 220,
    "payment_fees_sepa": 50,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 5,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "api_access": true,
    "api_access_level": "read",
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "gli_discount": 15,
    "included_properties": 50,
    "extra_property_price": 200
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'pro';

-- ============================================
-- ÉTAPE 5: Créer ENTERPRISE S (199€/mois)
-- ============================================

INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_s',
  'Enterprise S',
  'Pour les gestionnaires de 50 à 100 biens',
  19900, 199000,  -- 199€/mois, 1990€/an
  100, -1, -1, 50,
  '{
    "signatures": true,
    "signatures_monthly_quota": 20,
    "signature_price": 150,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 35,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": false,
    "sla_guarantee": false,
    "gli_discount": 20,
    "included_properties": 100,
    "extra_property_price": 0,
    "tier_min_properties": 50,
    "tier_max_properties": 100
  }'::jsonb,
  true, false, 4
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================
-- ÉTAPE 6: Créer ENTERPRISE M (299€/mois)
-- ============================================

INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_m',
  'Enterprise M',
  'Pour les gestionnaires de 100 à 200 biens',
  29900, 299000,  -- 299€/mois, 2990€/an
  200, -1, -1, 100,
  '{
    "signatures": true,
    "signatures_monthly_quota": 30,
    "signature_price": 150,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 35,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "white_label_level": "basic",
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": false,
    "sla_guarantee": false,
    "gli_discount": 20,
    "included_properties": 200,
    "extra_property_price": 0,
    "tier_min_properties": 100,
    "tier_max_properties": 200
  }'::jsonb,
  true, false, 5
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================
-- ÉTAPE 7: Créer ENTERPRISE L (449€/mois) ⭐
-- ============================================

INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_l',
  'Enterprise L',
  'Pour les gestionnaires de 200 à 500 biens',
  44900, 449000,  -- 449€/mois, 4490€/an
  500, -1, -1, 200,
  '{
    "signatures": true,
    "signatures_monthly_quota": 50,
    "signature_price": 150,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 35,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "white_label_level": "full",
    "custom_domain": true,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "account_manager_type": "shared",
    "sla_guarantee": true,
    "sla_percent": 99.5,
    "gli_discount": 20,
    "included_properties": 500,
    "extra_property_price": 0,
    "tier_min_properties": 200,
    "tier_max_properties": 500
  }'::jsonb,
  true, true, 6  -- is_popular = true (Le plus choisi Enterprise)
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================
-- ÉTAPE 8: Créer ENTERPRISE XL (699€/mois)
-- ============================================

INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_xl',
  'Enterprise XL',
  'Solution sur-mesure pour +500 biens',
  69900, 699000,  -- 699€/mois, 6990€/an
  -1, -1, -1, -1,  -- Tout illimité
  '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "signature_price": 0,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 35,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "white_label_level": "full",
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "account_manager_type": "dedicated",
    "sla_guarantee": true,
    "sla_percent": 99.5,
    "gli_discount": 20,
    "included_properties": -1,
    "extra_property_price": 0,
    "tier_min_properties": 500,
    "tier_max_properties": -1
  }'::jsonb,
  true, false, 7
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================
-- ÉTAPE 9: Mettre à jour le plan ENTERPRISE legacy
-- ============================================

-- Garder le plan "enterprise" pour rétrocompatibilité mais le rediriger
-- Note: price_monthly = 0 au lieu de NULL car la colonne a une contrainte NOT NULL
UPDATE subscription_plans SET
  description = 'Solution Enterprise - Contactez-nous pour choisir votre taille',
  price_monthly = 0,  -- Sur devis (0 = contact)
  price_yearly = 0,
  features = features || '{
    "legacy": true,
    "redirect_to": "enterprise_s",
    "contact_required": true
  }'::jsonb,
  display_order = 99,  -- Masquer en bas
  updated_at = NOW()
WHERE slug = 'enterprise';

-- ============================================
-- ÉTAPE 10: Mettre à jour le trigger auto-subscription
-- Pour utiliser "gratuit" au lieu de "starter"
-- ============================================

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Seulement pour les propriétaires
  IF NEW.role = 'owner' THEN
    -- Récupérer l'ID du plan gratuit (nouveau défaut)
    SELECT id INTO v_plan_id 
    FROM subscription_plans 
    WHERE slug = 'gratuit' 
    LIMIT 1;
    
    -- Fallback sur starter si gratuit n'existe pas
    IF v_plan_id IS NULL THEN
      SELECT id INTO v_plan_id 
      FROM subscription_plans 
      WHERE slug = 'starter' 
      LIMIT 1;
    END IF;
    
    -- Créer l'abonnement si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id, 
        plan_id, 
        status, 
        billing_cycle, 
        current_period_start,
        current_period_end,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'active',  -- Actif immédiatement (plan gratuit)
        'monthly',
        NOW(),
        NOW() + INTERVAL '1 month',
        0,
        0
      )
      ON CONFLICT (owner_id) DO NOTHING;
      
      RAISE NOTICE 'Abonnement Talok Gratuit créé pour le propriétaire %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ÉTAPE 11: Fonction pour recommander le tier Enterprise
-- ============================================

CREATE OR REPLACE FUNCTION get_recommended_enterprise_tier(property_count INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF property_count >= 500 THEN
    RETURN 'enterprise_xl';
  ELSIF property_count >= 200 THEN
    RETURN 'enterprise_l';
  ELSIF property_count >= 100 THEN
    RETURN 'enterprise_m';
  ELSIF property_count >= 50 THEN
    RETURN 'enterprise_s';
  ELSE
    RETURN 'pro';  -- Pas besoin d'Enterprise
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- ÉTAPE 12: Vue récapitulative des plans
-- ============================================

CREATE OR REPLACE VIEW v_subscription_plans_summary AS
SELECT 
  slug,
  name,
  price_monthly,
  price_yearly,
  max_properties,
  features->>'signatures_monthly_quota' as signatures_quota,
  features->>'signature_price' as signature_extra_price,
  features->>'payment_fees_cb' as cb_fee_bps,
  features->>'payment_fees_sepa' as sepa_fee_cents,
  features->>'gli_discount' as gli_discount_percent,
  features->>'included_properties' as included_properties,
  is_popular,
  display_order
FROM subscription_plans
WHERE is_active = true
ORDER BY display_order;

-- ============================================
-- VÉRIFICATION
-- ============================================

DO $$
DECLARE
  v_count INTEGER;
  v_plan_info TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM subscription_plans WHERE is_active = true;
  RAISE NOTICE 'Migration terminée. % plans actifs', v_count;
  
  -- Afficher le résumé
  FOR v_plan_info IN 
    SELECT slug || ': ' || COALESCE(price_monthly::text, '0') || ' centimes/mois'
    FROM subscription_plans 
    WHERE is_active = true 
    ORDER BY display_order
  LOOP
    RAISE NOTICE '%', v_plan_info;
  END LOOP;
END $$;

COMMIT;



-- ========== 20251206400000_pricing_option_b.sql ==========
-- Migration: Grille tarifaire Option B (Aggressive)
-- Date: 2024-12-06
-- Description: Optimisation des prix pour maximiser les revenus
--
-- CHANGEMENTS PRINCIPAUX :
-- - Confort : 29€ → 35€, 1 → 2 signatures, 2 utilisateurs
-- - Pro : 59€ → 69€, 5 → 10 signatures, API lecture+écriture
-- - Enterprise S : 199€ → 249€, AM partagé inclus
-- - Enterprise M : 299€ → 349€, AM partagé inclus
-- - Enterprise L : 449€ → 499€, AM dédié
-- - Enterprise XL : 699€ → 799€, formations incluses, SLA 99.9%
-- - Réduction annuelle : 17% → 20%
-- - Signatures Enterprise : 1,50€ → 1,90€
-- - SEPA Enterprise : 0,35€ → 0,40€
-- - GLI différenciés par tier

BEGIN;

-- ============================================
-- MISE À JOUR STARTER (GLI ajouté)
-- ============================================

UPDATE subscription_plans SET
  features = features || '{
    "gli_discount": 5,
    "payment_fees_cb": 220,
    "payment_fees_sepa": 50
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'starter';

-- ============================================
-- MISE À JOUR CONFORT : 29€ → 35€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 3500, -- 35€
  price_yearly = 33600, -- 336€ (28€/mois, -20%)
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 2,
    "signature_price": 390,
    "open_banking": true,
    "open_banking_level": "basic",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": false,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "advanced",
    "tenant_payment_online": true,
    "payment_fees_cb": 220,
    "payment_fees_sepa": 50,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 2,
    "work_orders": true,
    "providers_management": false,
    "owner_reports": true,
    "api_access": false,
    "scoring_tenant": true,
    "edl_digital": true,
    "gli_discount": 10,
    "included_properties": 10,
    "extra_property_price": 250
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'confort';

-- ============================================
-- MISE À JOUR PRO : 59€ → 69€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 6900, -- 69€
  price_yearly = 66200, -- 662€ (55€/mois, -20%)
  max_documents_gb = 30, -- Augmenté
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 10,
    "signature_price": 250,
    "open_banking": true,
    "open_banking_level": "advanced",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 220,
    "payment_fees_sepa": 50,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 5,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "api_access": true,
    "api_access_level": "read_write",
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "gli_discount": 15,
    "included_properties": 50,
    "extra_property_price": 200
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'pro';

-- ============================================
-- MISE À JOUR ENTERPRISE S : 199€ → 249€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 24900, -- 249€
  price_yearly = 239000, -- 2390€ (199€/mois, -20%)
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 25,
    "signature_price": 190,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 40,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": true,
    "account_manager_type": "shared",
    "sla_guarantee": true,
    "sla_percent": 99,
    "gli_discount": 18,
    "included_properties": 100,
    "extra_property_price": 0,
    "tier_min_properties": 50,
    "tier_max_properties": 100
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'enterprise_s';

-- ============================================
-- MISE À JOUR ENTERPRISE M : 299€ → 349€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 34900, -- 349€
  price_yearly = 335000, -- 3350€ (279€/mois, -20%)
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 40,
    "signature_price": 190,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 40,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "white_label_level": "basic",
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": true,
    "account_manager_type": "shared",
    "sla_guarantee": true,
    "sla_percent": 99,
    "gli_discount": 20,
    "included_properties": 200,
    "extra_property_price": 0,
    "tier_min_properties": 100,
    "tier_max_properties": 200
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'enterprise_m';

-- ============================================
-- MISE À JOUR ENTERPRISE L : 449€ → 499€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 49900, -- 499€
  price_yearly = 479000, -- 4790€ (399€/mois, -20%)
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 60,
    "signature_price": 190,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 40,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "white_label_level": "full",
    "custom_domain": true,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "account_manager_type": "dedicated",
    "sla_guarantee": true,
    "sla_percent": 99.5,
    "gli_discount": 22,
    "included_properties": 500,
    "extra_property_price": 0,
    "tier_min_properties": 200,
    "tier_max_properties": 500
  }'::jsonb,
  is_popular = true,
  updated_at = NOW()
WHERE slug = 'enterprise_l';

-- ============================================
-- MISE À JOUR ENTERPRISE XL : 699€ → 799€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 79900, -- 799€
  price_yearly = 767000, -- 7670€ (639€/mois, -20%)
  features = '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "signature_price": 0,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 40,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "white_label_level": "full",
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "account_manager_type": "dedicated",
    "onboarding_included": true,
    "training_hours": 10,
    "sla_guarantee": true,
    "sla_percent": 99.9,
    "gli_discount": 25,
    "included_properties": -1,
    "extra_property_price": 0,
    "tier_min_properties": 500,
    "tier_max_properties": -1
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'enterprise_xl';

-- ============================================
-- VÉRIFICATION
-- ============================================

DO $$
DECLARE
  v_record RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'GRILLE TARIFAIRE OPTION B APPLIQUÉE';
  RAISE NOTICE '========================================';
  
  FOR v_record IN 
    SELECT 
      slug,
      price_monthly / 100 as prix_mensuel,
      price_yearly / 100 as prix_annuel,
      features->>'signatures_monthly_quota' as signatures,
      features->>'gli_discount' as gli_discount
    FROM subscription_plans 
    WHERE is_active = true 
    ORDER BY display_order
  LOOP
    RAISE NOTICE '% : %€/mois, %€/an, % sign., GLI -%', 
      v_record.slug, 
      v_record.prix_mensuel, 
      v_record.prix_annuel,
      COALESCE(v_record.signatures, '0'),
      COALESCE(v_record.gli_discount, '0') || '%';
  END LOOP;
END $$;

COMMIT;



-- ========== 20251206500000_fix_lease_end_processes.sql ==========
-- ============================================
-- Migration: Unifier lease_end_processes et end_of_lease_processes
-- Date: 2025-12-06
-- Problème: Incohérence de nommage entre tables et APIs
-- ============================================

-- ============================================
-- 1. CRÉER LA TABLE lease_end_processes (nom utilisé par l'API)
-- ============================================
CREATE TABLE IF NOT EXISTS lease_end_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  created_by UUID REFERENCES profiles(id),
  
  -- Status & Progress
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'triggered', 'edl_scheduled', 'edl_in_progress', 'edl_completed',
    'damages_assessed', 'dg_calculated', 'renovation_planned', 'renovation_in_progress',
    'ready_to_rent', 'completed', 'cancelled'
  )),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  
  -- Dates importantes
  lease_end_date DATE NOT NULL,
  trigger_date DATE,
  edl_sortie_scheduled_date DATE,
  edl_sortie_completed_date DATE,
  ready_to_rent_date DATE,
  completed_date DATE,
  
  -- Dépôt de garantie
  dg_amount DECIMAL(10,2) DEFAULT 0,
  dg_retention_amount DECIMAL(10,2) DEFAULT 0,
  dg_refund_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Coûts calculés
  tenant_damage_cost DECIMAL(10,2) DEFAULT 0,
  vetusty_cost DECIMAL(10,2) DEFAULT 0,
  renovation_cost DECIMAL(10,2) DEFAULT 0,
  total_budget DECIMAL(10,2) DEFAULT 0,
  
  -- Références EDL
  edl_entree_id UUID REFERENCES edl(id),
  edl_sortie_id UUID REFERENCES edl(id),
  
  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contraintes
  UNIQUE(lease_id)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_status ON lease_end_processes(status);
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_lease ON lease_end_processes(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_property ON lease_end_processes(property_id);
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_created_by ON lease_end_processes(created_by);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_lease_end_processes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lease_end_processes_updated_at ON lease_end_processes;
CREATE TRIGGER trg_lease_end_processes_updated_at
  BEFORE UPDATE ON lease_end_processes
  FOR EACH ROW EXECUTE FUNCTION update_lease_end_processes_updated_at();

-- ============================================
-- 2. RLS POLICIES pour lease_end_processes
-- ============================================
ALTER TABLE lease_end_processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_end_owner_select" ON lease_end_processes;
DROP POLICY IF EXISTS "lease_end_owner_all" ON lease_end_processes;
DROP POLICY IF EXISTS "lease_end_admin_all" ON lease_end_processes;

-- Owners can view their processes (via property ownership)
CREATE POLICY "lease_end_owner_select" ON lease_end_processes FOR SELECT TO authenticated
USING (
  property_id IN (SELECT id FROM properties WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- Owners can manage their processes
CREATE POLICY "lease_end_owner_all" ON lease_end_processes FOR ALL TO authenticated
USING (
  property_id IN (SELECT id FROM properties WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
)
WITH CHECK (
  property_id IN (SELECT id FROM properties WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- Admin full access
CREATE POLICY "lease_end_admin_all" ON lease_end_processes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- ============================================
-- 3. TABLES DE SUPPORT
-- ============================================

-- Items d'inspection EDL sortie
CREATE TABLE IF NOT EXISTS edl_inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_end_process_id UUID NOT NULL REFERENCES lease_end_processes(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'murs', 'sols', 'plafonds', 'salle_de_bain', 'cuisine', 
    'fenetres_portes', 'electricite_plomberie', 'meubles', 'exterieur', 'autre'
  )),
  item_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  condition_entree TEXT,
  condition_sortie TEXT,
  damage_type TEXT CHECK (damage_type IN ('none', 'normal_wear', 'tenant_damage', 'pre_existing')),
  damage_description TEXT,
  photo_urls TEXT[], -- Array of storage paths
  estimated_cost DECIMAL(10,2) DEFAULT 0,
  vetusty_rate DECIMAL(5,2) DEFAULT 0, -- Taux de vétusté (0-100)
  tenant_responsibility DECIMAL(5,2) DEFAULT 0, -- Part locataire (0-100)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_items_process ON edl_inspection_items(lease_end_process_id);
CREATE INDEX IF NOT EXISTS idx_edl_items_category ON edl_inspection_items(category);

-- RLS pour edl_inspection_items
ALTER TABLE edl_inspection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "edl_items_via_process" ON edl_inspection_items;
CREATE POLICY "edl_items_via_process" ON edl_inspection_items FOR ALL TO authenticated
USING (
  lease_end_process_id IN (SELECT id FROM lease_end_processes)
);

-- Items de rénovation
CREATE TABLE IF NOT EXISTS renovation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_end_process_id UUID NOT NULL REFERENCES lease_end_processes(id) ON DELETE CASCADE,
  work_type TEXT NOT NULL,
  description TEXT,
  room TEXT,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  estimated_cost DECIMAL(10,2) DEFAULT 0,
  vetusty_deduction DECIMAL(10,2) DEFAULT 0,
  tenant_share DECIMAL(10,2) DEFAULT 0,
  owner_share DECIMAL(10,2) DEFAULT 0,
  payer TEXT CHECK (payer IN ('tenant', 'owner', 'shared')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'approved', 'in_progress', 'completed', 'cancelled')),
  scheduled_date DATE,
  completed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renovation_items_process ON renovation_items(lease_end_process_id);

-- RLS
ALTER TABLE renovation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "renovation_items_via_process" ON renovation_items;
CREATE POLICY "renovation_items_via_process" ON renovation_items FOR ALL TO authenticated
USING (
  lease_end_process_id IN (SELECT id FROM lease_end_processes)
);

-- Timeline des actions
CREATE TABLE IF NOT EXISTS lease_end_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_end_process_id UUID NOT NULL REFERENCES lease_end_processes(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  description TEXT,
  day_offset INTEGER NOT NULL, -- Nombre de jours avant/après la date de fin
  scheduled_date DATE,
  completed_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  assigned_to UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_process ON lease_end_timeline(lease_end_process_id);

-- RLS
ALTER TABLE lease_end_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timeline_via_process" ON lease_end_timeline;
CREATE POLICY "timeline_via_process" ON lease_end_timeline FOR ALL TO authenticated
USING (
  lease_end_process_id IN (SELECT id FROM lease_end_processes)
);

-- ============================================
-- 4. FONCTION RPC CORRIGÉE
-- ============================================
DROP FUNCTION IF EXISTS public.get_owner_lease_end_processes(UUID);
CREATE OR REPLACE FUNCTION public.get_owner_lease_end_processes(p_owner_id UUID)
RETURNS TABLE (
  id UUID,
  lease_id UUID,
  property_id UUID,
  status TEXT,
  progress_percentage INTEGER,
  lease_end_date DATE,
  trigger_date DATE,
  dg_amount DECIMAL,
  dg_retention_amount DECIMAL,
  dg_refund_amount DECIMAL,
  tenant_damage_cost DECIMAL,
  vetusty_cost DECIMAL,
  renovation_cost DECIMAL,
  total_budget DECIMAL,
  created_at TIMESTAMPTZ,
  -- Données jointes
  property JSONB,
  lease JSONB,
  tenant JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lep.id,
    lep.lease_id,
    lep.property_id,
    lep.status,
    lep.progress_percentage,
    lep.lease_end_date,
    lep.trigger_date,
    lep.dg_amount,
    lep.dg_retention_amount,
    lep.dg_refund_amount,
    lep.tenant_damage_cost,
    lep.vetusty_cost,
    lep.renovation_cost,
    lep.total_budget,
    lep.created_at,
    -- Property info
    jsonb_build_object(
      'id', p.id,
      'adresse_complete', p.adresse_complete,
      'ville', p.ville,
      'code_postal', p.code_postal,
      'type', p.type
    ) AS property,
    -- Lease info
    jsonb_build_object(
      'id', l.id,
      'type_bail', l.type_bail,
      'loyer', l.loyer,
      'charges_forfaitaires', l.charges_forfaitaires,
      'depot_de_garantie', l.depot_de_garantie,
      'date_debut', l.date_debut,
      'date_fin', l.date_fin
    ) AS lease,
    -- Tenant info (first tenant signer)
    COALESCE(
      (
        SELECT jsonb_build_object(
          'id', pr.id,
          'prenom', pr.prenom,
          'nom', pr.nom,
          'email', u.email
        )
        FROM lease_signers ls
        JOIN profiles pr ON pr.id = ls.profile_id
        LEFT JOIN auth.users u ON u.id = pr.user_id
        WHERE ls.lease_id = l.id 
          AND ls.role IN ('locataire_principal', 'locataire')
        LIMIT 1
      ),
      '{}'::jsonb
    ) AS tenant
  FROM lease_end_processes lep
  JOIN properties p ON p.id = lep.property_id
  JOIN leases l ON l.id = lep.lease_id
  WHERE p.owner_id = p_owner_id
  ORDER BY lep.lease_end_date ASC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_lease_end_processes(UUID) TO authenticated;

-- ============================================
-- 5. VUE POUR LES BAUX À SURVEILLER (trigger)
-- ============================================
CREATE OR REPLACE VIEW v_upcoming_lease_ends AS
SELECT 
  l.id AS lease_id,
  l.property_id,
  l.type_bail,
  l.loyer,
  l.date_fin,
  p.owner_id,
  p.adresse_complete,
  p.ville,
  CASE l.type_bail
    WHEN 'nu' THEN 90
    WHEN 'meuble' THEN 30
    WHEN 'colocation' THEN 30
    WHEN 'saisonnier' THEN 0
    WHEN 'mobilite' THEN 15
    WHEN 'etudiant' THEN 30
    WHEN 'commercial' THEN 180
    ELSE 30
  END AS trigger_days,
  (l.date_fin::DATE - CURRENT_DATE) AS days_until_end,
  (l.date_fin::DATE - CURRENT_DATE - 
    CASE l.type_bail
      WHEN 'nu' THEN 90
      WHEN 'meuble' THEN 30
      WHEN 'colocation' THEN 30
      WHEN 'saisonnier' THEN 0
      WHEN 'mobilite' THEN 15
      WHEN 'etudiant' THEN 30
      WHEN 'commercial' THEN 180
      ELSE 30
    END
  ) AS days_until_trigger,
  CASE 
    WHEN (l.date_fin::DATE - CURRENT_DATE - 
      CASE l.type_bail
        WHEN 'nu' THEN 90
        WHEN 'meuble' THEN 30
        WHEN 'colocation' THEN 30
        WHEN 'saisonnier' THEN 0
        WHEN 'mobilite' THEN 15
        WHEN 'etudiant' THEN 30
        WHEN 'commercial' THEN 180
        ELSE 30
      END) <= 0 THEN true
    ELSE false
  END AS will_trigger_soon
FROM leases l
JOIN properties p ON p.id = l.property_id
WHERE l.statut IN ('active', 'pending_signature')
  AND l.date_fin IS NOT NULL
  AND l.date_fin >= CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM lease_end_processes lep 
    WHERE lep.lease_id = l.id AND lep.status NOT IN ('completed', 'cancelled')
  );

-- ============================================
-- 6. GRILLES DE RÉFÉRENCE
-- ============================================

-- Grille de vétusté (si n'existe pas)
CREATE TABLE IF NOT EXISTS vetusty_grid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  lifespan_years INTEGER NOT NULL,
  yearly_depreciation DECIMAL(5,2) NOT NULL,
  min_residual_value DECIMAL(5,2) DEFAULT 10, -- Valeur résiduelle minimum en %
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, item)
);

-- Grille des coûts de réparation (si n'existe pas)
CREATE TABLE IF NOT EXISTS repair_cost_grid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL, -- 'm2', 'unite', 'ml' (mètre linéaire)
  cost_min DECIMAL(10,2) NOT NULL,
  cost_max DECIMAL(10,2) NOT NULL,
  cost_avg DECIMAL(10,2) NOT NULL,
  region TEXT DEFAULT 'france', -- Pour différencier les coûts par région
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(work_type, region)
);

-- Données de base pour la grille de vétusté
INSERT INTO vetusty_grid (category, item, lifespan_years, yearly_depreciation, min_residual_value) VALUES
  ('sols', 'moquette', 7, 14.28, 0),
  ('sols', 'parquet_massif', 25, 4, 20),
  ('sols', 'parquet_stratifie', 15, 6.67, 10),
  ('sols', 'carrelage', 30, 3.33, 20),
  ('sols', 'lino_pvc', 10, 10, 10),
  ('murs', 'peinture', 7, 14.28, 0),
  ('murs', 'papier_peint', 9, 11.11, 0),
  ('murs', 'faience', 30, 3.33, 20),
  ('plafonds', 'peinture', 10, 10, 0),
  ('plafonds', 'lambris', 20, 5, 10),
  ('equipements', 'robinetterie', 15, 6.67, 10),
  ('equipements', 'sanitaires', 25, 4, 15),
  ('equipements', 'chauffe_eau', 15, 6.67, 10),
  ('equipements', 'chaudiere', 20, 5, 15),
  ('menuiseries', 'portes_interieures', 25, 4, 15),
  ('menuiseries', 'fenetres_pvc', 30, 3.33, 20),
  ('menuiseries', 'volets', 25, 4, 15),
  ('electricite', 'prises_interrupteurs', 25, 4, 15),
  ('electricite', 'tableau_electrique', 30, 3.33, 20)
ON CONFLICT (category, item) DO NOTHING;

-- Données de base pour les coûts de réparation
INSERT INTO repair_cost_grid (work_type, description, unit, cost_min, cost_max, cost_avg) VALUES
  ('peinture_murs', 'Peinture des murs (préparation + 2 couches)', 'm2', 15, 35, 25),
  ('peinture_plafond', 'Peinture du plafond', 'm2', 18, 40, 28),
  ('parquet_stratifie', 'Pose de parquet stratifié', 'm2', 25, 50, 38),
  ('carrelage', 'Pose de carrelage', 'm2', 35, 80, 55),
  ('moquette', 'Pose de moquette', 'm2', 15, 40, 25),
  ('rebouchage_trous', 'Rebouchage de trous', 'unite', 5, 20, 12),
  ('porte_interieure', 'Remplacement porte intérieure', 'unite', 150, 400, 250),
  ('robinetterie', 'Remplacement robinetterie', 'unite', 80, 200, 130),
  ('prise_electrique', 'Remplacement prise électrique', 'unite', 25, 60, 40),
  ('interrupteur', 'Remplacement interrupteur', 'unite', 20, 50, 35),
  ('nettoyage_profond', 'Nettoyage profond complet', 'unite', 100, 300, 180),
  ('desinfection', 'Désinfection locaux', 'm2', 5, 15, 9)
ON CONFLICT (work_type, region) DO NOTHING;

-- ============================================
-- DONE
-- ============================================
COMMENT ON TABLE lease_end_processes IS 'Processus de fin de bail avec suivi EDL, rénovation et restitution DG';
COMMENT ON TABLE edl_inspection_items IS 'Items d''inspection pour l''EDL de sortie';
COMMENT ON TABLE renovation_items IS 'Travaux de rénovation planifiés';
COMMENT ON TABLE lease_end_timeline IS 'Timeline des actions de fin de bail';
COMMENT ON TABLE vetusty_grid IS 'Grille de vétusté officielle pour calcul de la part locataire';
COMMENT ON TABLE repair_cost_grid IS 'Grille de référence des coûts de réparation';



-- ========== 20251206550000_impersonation_sessions.sql ==========
-- Migration: Table de tracking des sessions d'impersonation
-- Date: 2024-12-06
-- Description: Stocke l'historique des sessions d'impersonation admin

BEGIN;

-- ============================================
-- TABLE: impersonation_sessions
-- ============================================

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired')),
  actions_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT different_users CHECK (admin_id != target_user_id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_impersonation_admin 
  ON impersonation_sessions(admin_id, status);
  
CREATE INDEX IF NOT EXISTS idx_impersonation_target 
  ON impersonation_sessions(target_user_id);
  
CREATE INDEX IF NOT EXISTS idx_impersonation_active 
  ON impersonation_sessions(status) WHERE status = 'active';

-- ============================================
-- RLS: Seuls les admins peuvent voir les sessions
-- ============================================

ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Politique: Admin peut voir toutes les sessions
CREATE POLICY "admin_view_impersonation_sessions" ON impersonation_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Politique: Admin peut insérer ses propres sessions
CREATE POLICY "admin_insert_impersonation_sessions" ON impersonation_sessions
  FOR INSERT
  WITH CHECK (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Politique: Admin peut mettre à jour ses propres sessions
CREATE POLICY "admin_update_impersonation_sessions" ON impersonation_sessions
  FOR UPDATE
  USING (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- FUNCTION: Expirer les sessions automatiquement
-- ============================================

CREATE OR REPLACE FUNCTION expire_impersonation_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE impersonation_sessions
  SET 
    status = 'expired',
    ended_at = NOW()
  WHERE 
    status = 'active' 
    AND expires_at < NOW();
END;
$$;

-- Commentaires
COMMENT ON TABLE impersonation_sessions IS 
  'Historique des sessions d''impersonation admin pour audit et sécurité';
COMMENT ON COLUMN impersonation_sessions.reason IS 
  'Raison de l''impersonation (obligatoire pour audit)';
COMMENT ON COLUMN impersonation_sessions.actions_count IS 
  'Nombre d''actions effectuées pendant la session';

COMMIT;



-- ========== 20251206600000_analytics_materialized_views.sql ==========
-- Migration: Materialized Views pour Analytics
-- Date: 2024-12-06
-- Description: Vues matérialisées pour dashboards et rapports performants

BEGIN;

-- ============================================
-- VUE: Statistiques mensuelles propriétaires
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_owner_monthly_stats AS
SELECT 
  p.id AS owner_id,
  DATE_TRUNC('month', i.created_at) AS month,
  COUNT(DISTINCT prop.id) AS properties_count,
  COUNT(DISTINCT l.id) AS active_leases_count,
  COUNT(DISTINCT i.id) AS invoices_count,
  COALESCE(SUM(i.montant_total), 0) AS total_invoiced,
  COALESCE(SUM(CASE WHEN i.statut = 'paid' THEN i.montant_total ELSE 0 END), 0) AS total_collected,
  COALESCE(SUM(CASE WHEN i.statut = 'late' THEN i.montant_total ELSE 0 END), 0) AS total_late,
  COUNT(CASE WHEN i.statut = 'paid' THEN 1 END) AS paid_invoices_count,
  COUNT(CASE WHEN i.statut = 'late' THEN 1 END) AS late_invoices_count,
  ROUND(
    CASE 
      WHEN COUNT(i.id) > 0 
      THEN COUNT(CASE WHEN i.statut = 'paid' THEN 1 END)::DECIMAL / COUNT(i.id) * 100 
      ELSE 0 
    END, 2
  ) AS collection_rate
FROM profiles p
LEFT JOIN properties prop ON prop.owner_id = p.id
LEFT JOIN leases l ON l.property_id = prop.id AND l.statut = 'active'
LEFT JOIN invoices i ON i.owner_id = p.id
WHERE p.role = 'owner'
GROUP BY p.id, DATE_TRUNC('month', i.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_owner_monthly_stats 
  ON mv_owner_monthly_stats(owner_id, month);

-- ============================================
-- VUE: KPIs globaux plateforme
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_kpis AS
SELECT 
  DATE_TRUNC('day', NOW()) AS snapshot_date,
  
  -- Utilisateurs
  (SELECT COUNT(*) FROM profiles WHERE role = 'owner') AS total_owners,
  (SELECT COUNT(*) FROM profiles WHERE role = 'tenant') AS total_tenants,
  (SELECT COUNT(*) FROM profiles WHERE role = 'provider') AS total_providers,
  (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
  
  -- Propriétés (etat au lieu de status)
  (SELECT COUNT(*) FROM properties WHERE etat = 'published') AS active_properties,
  (SELECT COUNT(*) FROM properties WHERE created_at > NOW() - INTERVAL '30 days') AS new_properties_30d,
  
  -- Baux (statut au lieu de status)
  (SELECT COUNT(*) FROM leases WHERE statut = 'active') AS active_leases,
  (SELECT COUNT(*) FROM leases WHERE created_at > NOW() - INTERVAL '30 days') AS new_leases_30d,
  
  -- Facturation (statut au lieu de status)
  (SELECT COALESCE(SUM(montant_total), 0) FROM invoices WHERE statut = 'paid' AND created_at > NOW() - INTERVAL '30 days') AS revenue_30d,
  (SELECT COALESCE(SUM(montant_total), 0) FROM invoices WHERE statut = 'late') AS total_late_amount,
  
  -- Abonnements
  (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') AS active_subscriptions,
  (SELECT COALESCE(SUM(sp.price_monthly), 0) FROM subscriptions s 
   JOIN subscription_plans sp ON s.plan_id = sp.id 
   WHERE s.status = 'active') AS mrr_estimate,
  
  -- Tickets (statut au lieu de status)
  (SELECT COUNT(*) FROM tickets WHERE statut = 'open') AS open_tickets,
  (SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) 
   FROM tickets WHERE statut = 'resolved' AND updated_at > NOW() - INTERVAL '30 days') AS avg_resolution_hours;

-- Index unique sur la date de snapshot
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_kpis_date 
  ON mv_platform_kpis(snapshot_date);

-- ============================================
-- VUE: Analyse des paiements
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_payment_analytics AS
SELECT 
  DATE_TRUNC('month', p.created_at) AS month,
  p.moyen AS payment_method,
  COUNT(*) AS transaction_count,
  SUM(p.montant) AS total_amount,
  AVG(p.montant) AS avg_amount,
  COUNT(CASE WHEN p.statut = 'succeeded' THEN 1 END) AS successful_count,
  COUNT(CASE WHEN p.statut = 'failed' THEN 1 END) AS failed_count,
  ROUND(
    COUNT(CASE WHEN p.statut = 'succeeded' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2
  ) AS success_rate
FROM payments p
WHERE p.created_at > NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', p.created_at), p.moyen
ORDER BY month DESC, payment_method;

CREATE INDEX IF NOT EXISTS idx_mv_payment_analytics_month 
  ON mv_payment_analytics(month);

-- ============================================
-- VUE: Taux d'occupation par propriété
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_property_occupancy AS
SELECT 
  prop.id AS property_id,
  prop.owner_id,
  prop.type AS property_type,
  prop.ville AS city,
  COUNT(DISTINCT l.id) AS total_leases,
  COUNT(DISTINCT CASE WHEN l.statut = 'active' THEN l.id END) AS active_leases,
  COALESCE(
    EXTRACT(DAY FROM (
      SELECT SUM(
        LEAST(COALESCE(l2.date_fin, NOW()), NOW()) - 
        GREATEST(l2.date_debut, NOW() - INTERVAL '12 months')
      )
      FROM leases l2 
      WHERE l2.property_id = prop.id 
      AND l2.date_debut < NOW()
      AND (l2.date_fin IS NULL OR l2.date_fin > NOW() - INTERVAL '12 months')
    )) / 365 * 100, 0
  )::INTEGER AS occupancy_rate_12m,
  (SELECT COALESCE(SUM(i.montant_total), 0) 
   FROM invoices i 
   JOIN leases l3 ON i.lease_id = l3.id 
   WHERE l3.property_id = prop.id 
   AND i.statut = 'paid' 
   AND i.created_at > NOW() - INTERVAL '12 months'
  ) AS revenue_12m
FROM properties prop
LEFT JOIN leases l ON l.property_id = prop.id
WHERE prop.etat = 'published'
GROUP BY prop.id, prop.owner_id, prop.type, prop.ville;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_property_occupancy 
  ON mv_property_occupancy(property_id);

-- ============================================
-- VUE: Retards de paiement par locataire
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_payment_history AS
SELECT 
  tp.profile_id AS tenant_id,
  p.prenom || ' ' || p.nom AS tenant_name,
  COUNT(DISTINCT i.id) AS total_invoices,
  COUNT(DISTINCT CASE WHEN i.statut = 'paid' THEN i.id END) AS paid_invoices,
  COUNT(DISTINCT CASE WHEN i.statut = 'late' THEN i.id END) AS late_invoices,
  ROUND(
    COUNT(DISTINCT CASE WHEN i.statut = 'paid' THEN i.id END)::DECIMAL / 
    NULLIF(COUNT(DISTINCT i.id), 0) * 100, 2
  ) AS payment_rate,
  COALESCE(SUM(CASE WHEN i.statut = 'late' THEN i.montant_total ELSE 0 END), 0) AS current_late_amount
FROM tenant_profiles tp
JOIN profiles p ON p.id = tp.profile_id
LEFT JOIN invoices i ON i.tenant_id = tp.profile_id
GROUP BY tp.profile_id, p.prenom, p.nom;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_payment_history 
  ON mv_tenant_payment_history(tenant_id);

-- ============================================
-- FONCTION: Rafraîchir toutes les vues
-- ============================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_kpis;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_owner_monthly_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_payment_analytics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_occupancy;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_payment_history;
  
  RAISE NOTICE 'Toutes les vues analytics ont été rafraîchies à %', NOW();
END;
$$;

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON MATERIALIZED VIEW mv_platform_kpis IS 
  'KPIs globaux de la plateforme - rafraîchir quotidiennement';
COMMENT ON MATERIALIZED VIEW mv_owner_monthly_stats IS 
  'Statistiques mensuelles par propriétaire - rafraîchir quotidiennement';
COMMENT ON MATERIALIZED VIEW mv_payment_analytics IS 
  'Analyse des paiements par méthode et mois - rafraîchir quotidiennement';
COMMENT ON MATERIALIZED VIEW mv_property_occupancy IS 
  'Taux d''occupation par propriété - rafraîchir hebdomadairement';
COMMENT ON MATERIALIZED VIEW mv_tenant_payment_history IS 
  'Historique de paiement des locataires - rafraîchir quotidiennement';

COMMIT;



-- ========== 20251206700000_agency_module.sql ==========
-- Migration : Module Agence / Conciergerie
-- Ajoute le support pour les agences immobilières et conciergeries

-- ============================================
-- 1. Ajouter le rôle "agency" dans profiles
-- ============================================

-- Modifier la contrainte de rôle pour inclure "agency"
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'owner', 'tenant', 'provider', 'agency'));

-- ============================================
-- 2. Ajouter raison_sociale à owner_profiles
-- ============================================

ALTER TABLE owner_profiles 
ADD COLUMN IF NOT EXISTS raison_sociale TEXT;

ALTER TABLE owner_profiles 
ADD COLUMN IF NOT EXISTS adresse_siege TEXT;

ALTER TABLE owner_profiles 
ADD COLUMN IF NOT EXISTS forme_juridique TEXT 
CHECK (forme_juridique IN ('SARL', 'SAS', 'SASU', 'SCI', 'EURL', 'EI', 'SA', 'SCPI', 'autre'));

COMMENT ON COLUMN owner_profiles.raison_sociale IS 'Raison sociale pour les sociétés';
COMMENT ON COLUMN owner_profiles.adresse_siege IS 'Adresse du siège social';
COMMENT ON COLUMN owner_profiles.forme_juridique IS 'Forme juridique de la société';

-- ============================================
-- 3. Table des profils agence
-- ============================================

CREATE TABLE IF NOT EXISTS agency_profiles (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  raison_sociale TEXT NOT NULL,
  forme_juridique TEXT CHECK (forme_juridique IN ('SARL', 'SAS', 'SASU', 'SCI', 'EURL', 'EI', 'SA', 'autre')),
  siret TEXT,
  numero_carte_pro TEXT, -- Carte professionnelle immobilier
  carte_pro_delivree_par TEXT, -- CCI délivrant la carte
  carte_pro_validite DATE, -- Date de validité
  garantie_financiere_montant DECIMAL(12, 2), -- Montant de la garantie
  garantie_financiere_organisme TEXT, -- Organisme garantissant
  assurance_rcp TEXT, -- Numéro police RCP
  assurance_rcp_organisme TEXT, -- Assureur RCP
  adresse_siege TEXT,
  logo_url TEXT,
  website TEXT,
  description TEXT,
  zones_intervention TEXT[], -- Départements/villes d'intervention
  services_proposes TEXT[] DEFAULT ARRAY['gestion_locative'], -- Types de services
  commission_gestion_defaut DECIMAL(4, 2) DEFAULT 7.0, -- Commission par défaut en %
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_profiles_siret ON agency_profiles(siret);

COMMENT ON TABLE agency_profiles IS 'Profils des agences immobilières et conciergeries';

-- ============================================
-- 4. Table des mandats de gestion
-- ============================================

CREATE TABLE IF NOT EXISTS mandates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_profile_id UUID NOT NULL REFERENCES agency_profiles(profile_id) ON DELETE CASCADE,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Informations du mandat
  numero_mandat TEXT, -- Numéro de mandat unique
  type_mandat TEXT NOT NULL DEFAULT 'gestion' CHECK (type_mandat IN ('gestion', 'location', 'vente', 'syndic')),
  date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
  date_fin DATE, -- NULL = durée indéterminée
  duree_mois INTEGER, -- Durée en mois si déterminée
  tacite_reconduction BOOLEAN DEFAULT true,
  preavis_resiliation_mois INTEGER DEFAULT 3,
  
  -- Étendue du mandat
  properties_ids UUID[] DEFAULT '{}', -- Liste des biens concernés, vide = tous
  inclut_tous_biens BOOLEAN DEFAULT true, -- Si true, tous les biens du propriétaire
  
  -- Commission et rémunération
  commission_pourcentage DECIMAL(4, 2) NOT NULL DEFAULT 7.0, -- % sur loyers encaissés
  commission_fixe_mensuelle DECIMAL(10, 2), -- Alternative : montant fixe
  honoraires_mise_en_location DECIMAL(10, 2), -- Honoraires pour trouver un locataire
  honoraires_edl DECIMAL(10, 2), -- Honoraires état des lieux
  
  -- Statut
  statut TEXT NOT NULL DEFAULT 'draft' CHECK (statut IN ('draft', 'pending_signature', 'active', 'suspended', 'terminated')),
  date_signature DATE,
  document_mandat_url TEXT, -- URL du document signé
  
  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(agency_profile_id, owner_profile_id, type_mandat)
);

CREATE INDEX IF NOT EXISTS idx_mandates_agency ON mandates(agency_profile_id);
CREATE INDEX IF NOT EXISTS idx_mandates_owner ON mandates(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_mandates_statut ON mandates(statut);

COMMENT ON TABLE mandates IS 'Mandats de gestion entre agences et propriétaires';

-- ============================================
-- 5. Table des gestionnaires (employés agence)
-- ============================================

CREATE TABLE IF NOT EXISTS agency_managers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_profile_id UUID NOT NULL REFERENCES agency_profiles(profile_id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  role_agence TEXT NOT NULL DEFAULT 'gestionnaire' CHECK (role_agence IN ('directeur', 'gestionnaire', 'assistant', 'comptable')),
  properties_assigned UUID[] DEFAULT '{}', -- Biens assignés à ce gestionnaire
  can_sign_documents BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(agency_profile_id, user_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_managers_agency ON agency_managers(agency_profile_id);
CREATE INDEX IF NOT EXISTS idx_agency_managers_user ON agency_managers(user_profile_id);

COMMENT ON TABLE agency_managers IS 'Gestionnaires employés par une agence';

-- ============================================
-- 6. Table des commissions générées
-- ============================================

CREATE TABLE IF NOT EXISTS agency_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mandate_id UUID NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  
  periode TEXT NOT NULL, -- Format YYYY-MM
  loyer_encaisse DECIMAL(10, 2) NOT NULL,
  taux_commission DECIMAL(4, 2) NOT NULL,
  montant_commission DECIMAL(10, 2) NOT NULL,
  montant_tva DECIMAL(10, 2) DEFAULT 0,
  montant_total_ttc DECIMAL(10, 2) NOT NULL,
  
  statut TEXT NOT NULL DEFAULT 'pending' CHECK (statut IN ('pending', 'invoiced', 'paid')),
  date_paiement DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_commissions_mandate ON agency_commissions(mandate_id);
CREATE INDEX IF NOT EXISTS idx_agency_commissions_periode ON agency_commissions(periode);
CREATE INDEX IF NOT EXISTS idx_agency_commissions_statut ON agency_commissions(statut);

COMMENT ON TABLE agency_commissions IS 'Commissions générées pour les agences';

-- ============================================
-- 7. RLS Policies
-- ============================================

-- Agency profiles
ALTER TABLE agency_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency_profiles_select_own" ON agency_profiles
  FOR SELECT USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "agency_profiles_insert_own" ON agency_profiles
  FOR INSERT WITH CHECK (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "agency_profiles_update_own" ON agency_profiles
  FOR UPDATE USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Mandates
ALTER TABLE mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mandates_select_agency" ON mandates
  FOR SELECT USING (
    agency_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "mandates_insert_agency" ON mandates
  FOR INSERT WITH CHECK (
    agency_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency')
  );

CREATE POLICY "mandates_update_agency" ON mandates
  FOR UPDATE USING (
    agency_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Agency managers
ALTER TABLE agency_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency_managers_select" ON agency_managers
  FOR SELECT USING (
    agency_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR user_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "agency_managers_manage" ON agency_managers
  FOR ALL USING (
    agency_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Agency commissions
ALTER TABLE agency_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency_commissions_select" ON agency_commissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM mandates m 
      WHERE m.id = mandate_id 
      AND (
        m.agency_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR m.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================
-- 8. Fonction pour calculer les commissions
-- ============================================

CREATE OR REPLACE FUNCTION calculate_agency_commission(
  p_mandate_id UUID,
  p_periode TEXT,
  p_loyer_encaisse DECIMAL
)
RETURNS TABLE(
  montant_commission DECIMAL,
  montant_tva DECIMAL,
  montant_total_ttc DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_taux_commission DECIMAL;
  v_commission DECIMAL;
  v_tva DECIMAL;
  v_total DECIMAL;
BEGIN
  -- Récupérer le taux de commission du mandat
  SELECT commission_pourcentage INTO v_taux_commission
  FROM mandates
  WHERE id = p_mandate_id;
  
  IF v_taux_commission IS NULL THEN
    RAISE EXCEPTION 'Mandat non trouvé';
  END IF;
  
  -- Calculer la commission HT
  v_commission := p_loyer_encaisse * (v_taux_commission / 100);
  
  -- Calculer la TVA (20%)
  v_tva := v_commission * 0.20;
  
  -- Total TTC
  v_total := v_commission + v_tva;
  
  RETURN QUERY SELECT v_commission, v_tva, v_total;
END;
$$;

-- ============================================
-- 9. Vue pour le dashboard agence
-- ============================================

CREATE OR REPLACE VIEW agency_dashboard_stats AS
SELECT 
  ap.profile_id as agency_id,
  COUNT(DISTINCT m.id) as total_mandats,
  COUNT(DISTINCT m.id) FILTER (WHERE m.statut = 'active') as mandats_actifs,
  COUNT(DISTINCT m.owner_profile_id) as total_proprietaires,
  (
    SELECT COUNT(*) FROM properties p
    INNER JOIN profiles pr ON p.owner_id = pr.id
    INNER JOIN mandates m2 ON m2.owner_profile_id = pr.id AND m2.agency_profile_id = ap.profile_id
    WHERE m2.statut = 'active' AND (m2.inclut_tous_biens = true OR p.id = ANY(m2.properties_ids))
  ) as total_biens_geres,
  COALESCE(SUM(ac.montant_commission) FILTER (WHERE ac.statut = 'paid'), 0) as commissions_encaissees,
  COALESCE(SUM(ac.montant_commission) FILTER (WHERE ac.statut = 'pending'), 0) as commissions_en_attente
FROM agency_profiles ap
LEFT JOIN mandates m ON m.agency_profile_id = ap.profile_id
LEFT JOIN agency_commissions ac ON ac.mandate_id = m.id
GROUP BY ap.profile_id;

-- ============================================
-- 10. Triggers pour updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_agency_profiles_updated_at ON agency_profiles;
CREATE TRIGGER update_agency_profiles_updated_at
  BEFORE UPDATE ON agency_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mandates_updated_at ON mandates;
CREATE TRIGGER update_mandates_updated_at
  BEFORE UPDATE ON mandates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agency_managers_updated_at ON agency_managers;
CREATE TRIGGER update_agency_managers_updated_at
  BEFORE UPDATE ON agency_managers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agency_commissions_updated_at ON agency_commissions;
CREATE TRIGGER update_agency_commissions_updated_at
  BEFORE UPDATE ON agency_commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. Grants
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON agency_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mandates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON agency_managers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON agency_commissions TO authenticated;
GRANT SELECT ON agency_dashboard_stats TO authenticated;

-- ============================================
-- 12. Commentaires
-- ============================================

COMMENT ON COLUMN agency_profiles.numero_carte_pro IS 'Numéro de la carte professionnelle immobilier obligatoire';
COMMENT ON COLUMN mandates.commission_pourcentage IS 'Pourcentage de commission sur les loyers encaissés (généralement 5-10%)';
COMMENT ON COLUMN agency_commissions.periode IS 'Période de facturation au format YYYY-MM';



-- ========== 20251206750000_fix_all_missing_tables.sql ==========
-- =====================================================
-- MIGRATION CONSOLIDÉE : Toutes les tables et fonctions manquantes
-- Résout les erreurs API 500 du module prestataire et notifications
-- =====================================================

-- =====================================================
-- 1. TABLE NOTIFICATIONS - Adaptation pour profile_id
-- =====================================================

-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  related_id UUID,
  related_type TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  action_url TEXT,
  action_label TEXT,
  channels_status JSONB DEFAULT '{"in_app": "pending"}',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajouter les colonnes manquantes si la table existe
DO $$
BEGIN
  -- Ajouter profile_id si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  
  -- Ajouter is_read si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;
  
  -- Ajouter priority si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'priority'
  ) THEN
    ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'normal';
  END IF;
  
  -- Ajouter action_url si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'action_url'
  ) THEN
    ALTER TABLE notifications ADD COLUMN action_url TEXT;
  END IF;
  
  -- Ajouter action_label si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'action_label'
  ) THEN
    ALTER TABLE notifications ADD COLUMN action_label TEXT;
  END IF;
END $$;

-- Index pour notifications
CREATE INDEX IF NOT EXISTS idx_notifications_profile_id ON notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- RLS pour notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications by profile" ON notifications;
CREATE POLICY "Users can view own notifications by profile"
  ON notifications FOR SELECT
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 2. FONCTIONS RPC NOTIFICATIONS
-- =====================================================

-- Fonction pour récupérer les notifications récentes
CREATE OR REPLACE FUNCTION get_recent_notifications(
  p_profile_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_unread_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  link TEXT,
  data JSONB,
  is_read BOOLEAN,
  read_at TIMESTAMPTZ,
  priority TEXT,
  action_url TEXT,
  action_label TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.type,
    n.title,
    n.message,
    n.link,
    n.data,
    COALESCE(n.is_read, false),
    n.read_at,
    COALESCE(n.priority, 'normal'),
    n.action_url,
    n.action_label,
    n.created_at
  FROM notifications n
  WHERE n.profile_id = p_profile_id
    AND (NOT p_unread_only OR COALESCE(n.is_read, false) = false)
  ORDER BY n.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Fonction pour compter les notifications non lues
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM notifications
  WHERE profile_id = p_profile_id
    AND COALESCE(is_read, false) = false;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Fonction pour marquer une notification comme lue
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
  SET is_read = true, read_at = NOW(), updated_at = NOW()
  WHERE id = p_notification_id
    AND profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid());
  
  RETURN FOUND;
END;
$$;

-- Fonction pour marquer toutes les notifications comme lues
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE notifications
    SET is_read = true, read_at = NOW(), updated_at = NOW()
    WHERE profile_id = p_profile_id
      AND COALESCE(is_read, false) = false
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM updated;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- =====================================================
-- 3. TABLES PRESTATAIRE - DEVIS
-- =====================================================

-- Table provider_quotes
CREATE TABLE IF NOT EXISTS provider_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE,
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID REFERENCES profiles(id),
  property_id UUID REFERENCES properties(id),
  ticket_id UUID REFERENCES tickets(id),
  title TEXT NOT NULL,
  description TEXT,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted')),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  converted_invoice_id UUID,
  internal_notes TEXT,
  terms_and_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour provider_quotes
CREATE INDEX IF NOT EXISTS idx_provider_quotes_provider ON provider_quotes(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_quotes_owner ON provider_quotes(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_quotes_status ON provider_quotes(status);

-- RLS pour provider_quotes
ALTER TABLE provider_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can manage own quotes" ON provider_quotes;
CREATE POLICY "Providers can manage own quotes"
  ON provider_quotes FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view quotes addressed to them" ON provider_quotes;
CREATE POLICY "Owners can view quotes addressed to them"
  ON provider_quotes FOR SELECT
  USING (owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Table provider_quote_items
CREATE TABLE IF NOT EXISTS provider_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES provider_quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'unité',
  unit_price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour provider_quote_items
CREATE INDEX IF NOT EXISTS idx_provider_quote_items_quote ON provider_quote_items(quote_id);

-- RLS pour provider_quote_items
ALTER TABLE provider_quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage quote items via quotes" ON provider_quote_items;
CREATE POLICY "Users can manage quote items via quotes"
  ON provider_quote_items FOR ALL
  USING (
    quote_id IN (
      SELECT id FROM provider_quotes 
      WHERE provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- =====================================================
-- 4. TABLES PRESTATAIRE - FACTURES
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE,
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID REFERENCES profiles(id),
  property_id UUID REFERENCES properties(id),
  work_order_id UUID REFERENCES work_orders(id),
  quote_id UUID REFERENCES provider_quotes(id),
  title TEXT NOT NULL,
  description TEXT,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT,
  payment_reference TEXT,
  sent_at TIMESTAMPTZ,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour provider_invoices
CREATE INDEX IF NOT EXISTS idx_provider_invoices_provider ON provider_invoices(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_owner ON provider_invoices(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_status ON provider_invoices(status);

-- RLS pour provider_invoices
ALTER TABLE provider_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can manage own invoices" ON provider_invoices;
CREATE POLICY "Providers can manage own invoices"
  ON provider_invoices FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view invoices addressed to them" ON provider_invoices;
CREATE POLICY "Owners can view invoices addressed to them"
  ON provider_invoices FOR SELECT
  USING (owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- =====================================================
-- 5. TABLES PRESTATAIRE - AVIS
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_punctuality INTEGER CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_quality INTEGER CHECK (rating_quality BETWEEN 1 AND 5),
  rating_communication INTEGER CHECK (rating_communication BETWEEN 1 AND 5),
  rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5),
  title TEXT,
  comment TEXT,
  would_recommend BOOLEAN DEFAULT true,
  provider_response TEXT,
  provider_response_at TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT true,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES profiles(id),
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour provider_reviews
CREATE INDEX IF NOT EXISTS idx_provider_reviews_provider ON provider_reviews(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_reviewer ON provider_reviews(reviewer_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_published ON provider_reviews(is_published) WHERE is_published = true;

-- RLS pour provider_reviews
ALTER TABLE provider_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published reviews" ON provider_reviews;
CREATE POLICY "Anyone can read published reviews"
  ON provider_reviews FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Providers can read own reviews" ON provider_reviews;
CREATE POLICY "Providers can read own reviews"
  ON provider_reviews FOR SELECT
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can create reviews" ON provider_reviews;
CREATE POLICY "Owners can create reviews"
  ON provider_reviews FOR INSERT
  WITH CHECK (reviewer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'owner'));

-- =====================================================
-- 6. FONCTION RPC DASHBOARD PRESTATAIRE
-- =====================================================

CREATE OR REPLACE FUNCTION provider_dashboard(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_stats JSONB;
  v_pending_orders JSONB;
  v_recent_reviews JSONB;
  v_provider_info JSONB;
BEGIN
  -- Récupérer le profil prestataire
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id AND role = 'provider';
  
  IF v_profile_id IS NULL THEN
    -- Retourner un objet vide si pas de profil prestataire
    RETURN jsonb_build_object(
      'error', 'Profil prestataire non trouvé',
      'profile_id', NULL
    );
  END IF;
  
  -- Informations du profil prestataire
  SELECT jsonb_build_object(
    'status', COALESCE(pp.status, 'pending'),
    'kyc_status', COALESCE(pp.kyc_status, 'incomplete'),
    'compliance_score', COALESCE(pp.compliance_score, 0),
    'type_services', COALESCE(pp.type_services, ARRAY[]::TEXT[]),
    'raison_sociale', pp.raison_sociale
  ) INTO v_provider_info
  FROM provider_profiles pp
  WHERE pp.profile_id = v_profile_id;
  
  -- Statistiques des work_orders
  SELECT jsonb_build_object(
    'total_interventions', COUNT(*),
    'completed_interventions', COUNT(*) FILTER (WHERE statut = 'done'),
    'pending_interventions', COUNT(*) FILTER (WHERE statut IN ('assigned', 'scheduled')),
    'in_progress_interventions', COUNT(*) FILTER (WHERE statut = 'in_progress'),
    'total_revenue', COALESCE(SUM(cout_final) FILTER (WHERE statut = 'done'), 0),
    'avg_rating', (
      SELECT ROUND(AVG(rating_overall)::NUMERIC, 1)
      FROM provider_reviews
      WHERE provider_profile_id = v_profile_id AND is_published = true
    ),
    'total_reviews', (
      SELECT COUNT(*) FROM provider_reviews
      WHERE provider_profile_id = v_profile_id AND is_published = true
    )
  ) INTO v_stats
  FROM work_orders
  WHERE provider_id = v_profile_id;
  
  -- Si pas de stats, créer des valeurs par défaut
  IF v_stats IS NULL THEN
    v_stats := jsonb_build_object(
      'total_interventions', 0,
      'completed_interventions', 0,
      'pending_interventions', 0,
      'in_progress_interventions', 0,
      'total_revenue', 0,
      'avg_rating', NULL,
      'total_reviews', 0
    );
  END IF;
  
  -- Interventions en attente
  SELECT COALESCE(jsonb_agg(order_data ORDER BY order_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_pending_orders
  FROM (
    SELECT jsonb_build_object(
      'id', wo.id,
      'ticket_id', wo.ticket_id,
      'statut', wo.statut,
      'cout_estime', wo.cout_estime,
      'date_intervention_prevue', wo.date_intervention_prevue,
      'created_at', wo.created_at,
      'ticket', CASE WHEN t.id IS NOT NULL THEN jsonb_build_object(
        'titre', t.titre,
        'priorite', t.priorite
      ) ELSE NULL END,
      'property', CASE WHEN p.id IS NOT NULL THEN jsonb_build_object(
        'adresse', p.adresse_complete,
        'ville', p.ville
      ) ELSE NULL END
    ) as order_data
    FROM work_orders wo
    LEFT JOIN tickets t ON t.id = wo.ticket_id
    LEFT JOIN properties p ON p.id = t.property_id
    WHERE wo.provider_id = v_profile_id
    AND wo.statut IN ('assigned', 'scheduled', 'in_progress')
    ORDER BY wo.created_at DESC
    LIMIT 10
  ) sub;
  
  -- Avis récents
  SELECT COALESCE(jsonb_agg(review_data ORDER BY review_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_recent_reviews
  FROM (
    SELECT jsonb_build_object(
      'id', pr.id,
      'rating_overall', pr.rating_overall,
      'comment', pr.comment,
      'created_at', pr.created_at,
      'reviewer', jsonb_build_object(
        'prenom', COALESCE(prof.prenom, 'Utilisateur'),
        'nom', CASE WHEN prof.nom IS NOT NULL THEN LEFT(prof.nom, 1) || '.' ELSE '' END
      )
    ) as review_data
    FROM provider_reviews pr
    LEFT JOIN profiles prof ON prof.id = pr.reviewer_profile_id
    WHERE pr.provider_profile_id = v_profile_id
    AND pr.is_published = true
    ORDER BY pr.created_at DESC
    LIMIT 5
  ) sub;
  
  -- Construire le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'provider', COALESCE(v_provider_info, jsonb_build_object('status', 'pending', 'kyc_status', 'incomplete', 'compliance_score', 0)),
    'stats', v_stats,
    'pending_orders', COALESCE(v_pending_orders, '[]'::jsonb),
    'recent_reviews', COALESCE(v_recent_reviews, '[]'::jsonb)
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 7. FONCTIONS UTILITAIRES
-- =====================================================

-- Génération numéro de devis
CREATE OR REPLACE FUNCTION generate_quote_reference(p_provider_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER;
  v_count INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM provider_quotes
  WHERE provider_profile_id = p_provider_id
  AND EXTRACT(YEAR FROM created_at) = v_year;
  
  RETURN 'DEV-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- Génération numéro de facture
CREATE OR REPLACE FUNCTION generate_invoice_reference(p_provider_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER;
  v_count INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM provider_invoices
  WHERE provider_profile_id = p_provider_id
  AND EXTRACT(YEAR FROM created_at) = v_year;
  
  RETURN 'FAC-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- Trigger pour générer automatiquement la référence des devis
CREATE OR REPLACE FUNCTION trigger_generate_quote_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := generate_quote_reference(NEW.provider_profile_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_quote_reference ON provider_quotes;
CREATE TRIGGER trg_generate_quote_reference
  BEFORE INSERT ON provider_quotes
  FOR EACH ROW EXECUTE FUNCTION trigger_generate_quote_reference();

-- Trigger pour générer automatiquement la référence des factures
CREATE OR REPLACE FUNCTION trigger_generate_invoice_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := generate_invoice_reference(NEW.provider_profile_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_invoice_reference ON provider_invoices;
CREATE TRIGGER trg_generate_invoice_reference
  BEFORE INSERT ON provider_invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_generate_invoice_reference();

-- =====================================================
-- 8. TRIGGER: Calcul automatique des totaux de devis
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(10,2);
  v_tax_amount DECIMAL(10,2);
  v_quote_id UUID;
BEGIN
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
  
  SELECT 
    COALESCE(SUM(quantity * unit_price), 0),
    COALESCE(SUM(quantity * unit_price * tax_rate / 100), 0)
  INTO v_subtotal, v_tax_amount
  FROM provider_quote_items
  WHERE quote_id = v_quote_id;
  
  UPDATE provider_quotes
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_subtotal + v_tax_amount,
    updated_at = NOW()
  WHERE id = v_quote_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_quote_totals ON provider_quote_items;
CREATE TRIGGER trg_calculate_quote_totals
  AFTER INSERT OR UPDATE OR DELETE ON provider_quote_items
  FOR EACH ROW EXECUTE FUNCTION calculate_quote_totals();

-- =====================================================
-- 9. ASSURER QUE work_orders A provider_id
-- =====================================================

DO $$
BEGIN
  -- Vérifier si la colonne provider_id existe dans work_orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'provider_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN provider_id UUID REFERENCES profiles(id);
    CREATE INDEX IF NOT EXISTS idx_work_orders_provider ON work_orders(provider_id);
  END IF;
END $$;

-- =====================================================
-- 10. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE notifications IS 'Notifications utilisateurs centralisées';
COMMENT ON TABLE provider_quotes IS 'Devis des prestataires';
COMMENT ON TABLE provider_quote_items IS 'Lignes de devis prestataires';
COMMENT ON TABLE provider_invoices IS 'Factures des prestataires';
COMMENT ON TABLE provider_reviews IS 'Avis clients sur les prestataires';
COMMENT ON FUNCTION provider_dashboard IS 'Dashboard principal du prestataire avec stats et interventions';
COMMENT ON FUNCTION get_recent_notifications IS 'Récupère les notifications récentes d''un profil';
COMMENT ON FUNCTION get_unread_notification_count IS 'Compte les notifications non lues';

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
SELECT 'Migration tables/fonctions manquantes appliquée avec succès!' as result;



-- ========== 20251206800000_assistant_ai_tables.sql ==========
-- ============================================
-- Migration: Tables pour l'Assistant IA
-- SOTA Décembre 2025 - GPT-5.1 + LangGraph
-- ============================================

-- ============================================
-- TABLE: assistant_threads
-- Stocke les conversations avec l'assistant
-- ============================================

CREATE TABLE IF NOT EXISTS assistant_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Nouvelle conversation',
  last_message TEXT,
  message_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour la performance
CREATE INDEX IF NOT EXISTS idx_assistant_threads_profile_id ON assistant_threads(profile_id);
CREATE INDEX IF NOT EXISTS idx_assistant_threads_user_id ON assistant_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_threads_updated_at ON assistant_threads(updated_at DESC);

-- ============================================
-- TABLE: assistant_messages
-- Stocke les messages des conversations
-- ============================================

CREATE TABLE IF NOT EXISTS assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES assistant_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tools_used TEXT[] DEFAULT '{}',
  tool_results JSONB,
  tokens_used INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour la performance
CREATE INDEX IF NOT EXISTS idx_assistant_messages_thread_id ON assistant_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_created_at ON assistant_messages(created_at);

-- ============================================
-- FUNCTION: increment_message_count
-- Incrémente le compteur de messages d'un thread
-- ============================================

CREATE OR REPLACE FUNCTION increment_message_count(thread_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE assistant_threads 
  SET message_count = message_count + 1
  WHERE id = thread_id_param
  RETURNING message_count INTO new_count;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: update_thread_updated_at
-- Met à jour updated_at quand un message est ajouté
-- ============================================

CREATE OR REPLACE FUNCTION update_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE assistant_threads 
  SET updated_at = NOW(),
      message_count = message_count + 1
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thread_on_message ON assistant_messages;
CREATE TRIGGER trigger_update_thread_on_message
AFTER INSERT ON assistant_messages
FOR EACH ROW
EXECUTE FUNCTION update_thread_timestamp();

-- ============================================
-- RLS: Row Level Security
-- ============================================

-- Enable RLS
ALTER TABLE assistant_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;

-- Policies pour assistant_threads
DROP POLICY IF EXISTS "Users can view their own threads" ON assistant_threads;
CREATE POLICY "Users can view their own threads"
  ON assistant_threads FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own threads" ON assistant_threads;
CREATE POLICY "Users can create their own threads"
  ON assistant_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own threads" ON assistant_threads;
CREATE POLICY "Users can update their own threads"
  ON assistant_threads FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own threads" ON assistant_threads;
CREATE POLICY "Users can delete their own threads"
  ON assistant_threads FOR DELETE
  USING (auth.uid() = user_id);

-- Policies pour assistant_messages
DROP POLICY IF EXISTS "Users can view messages in their threads" ON assistant_messages;
CREATE POLICY "Users can view messages in their threads"
  ON assistant_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assistant_threads 
      WHERE assistant_threads.id = assistant_messages.thread_id 
      AND assistant_threads.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create messages in their threads" ON assistant_messages;
CREATE POLICY "Users can create messages in their threads"
  ON assistant_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assistant_threads 
      WHERE assistant_threads.id = thread_id 
      AND assistant_threads.user_id = auth.uid()
    )
  );

-- ============================================
-- TABLE: assistant_usage_stats (optionnel)
-- Pour le suivi des coûts et de l'utilisation
-- ============================================

CREATE TABLE IF NOT EXISTS assistant_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_sent INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  tools_called INTEGER DEFAULT 0,
  estimated_cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_assistant_usage_stats_profile_date 
  ON assistant_usage_stats(profile_id, date);

-- Policy pour assistant_usage_stats
ALTER TABLE assistant_usage_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own stats" ON assistant_usage_stats;
CREATE POLICY "Users can view their own stats"
  ON assistant_usage_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = assistant_usage_stats.profile_id 
      AND profiles.user_id = auth.uid()
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE assistant_threads IS 'Conversations avec l''assistant IA LangGraph';
COMMENT ON TABLE assistant_messages IS 'Messages des conversations assistant';
COMMENT ON TABLE assistant_usage_stats IS 'Statistiques d''utilisation pour le suivi des coûts';

COMMENT ON COLUMN assistant_threads.metadata IS 'Données additionnelles (contexte, préférences)';
COMMENT ON COLUMN assistant_messages.tools_used IS 'Liste des tools appelés pendant la génération';
COMMENT ON COLUMN assistant_messages.tool_results IS 'Résultats des tools pour debugging';



-- ========== 20251207000000_colocation_advanced.sql ==========
-- ============================================
-- Migration: Colocation Avancée - SOTA 2025
-- Gestion complète des colocations avec recalcul des parts
-- ============================================

-- ============================================
-- 1. CONFIGURATION COLOCATION SUR LE BAIL
-- ============================================

-- Ajouter la configuration colocation au bail
ALTER TABLE leases ADD COLUMN IF NOT EXISTS coloc_config JSONB DEFAULT NULL;
-- Structure: {
--   nb_places: number,
--   bail_type: 'unique' | 'individuel',
--   solidarite: boolean,
--   solidarite_duration_months: number (max 6),
--   split_mode: 'equal' | 'custom' | 'by_room',
--   solidarite_end_date: date
-- }

COMMENT ON COLUMN leases.coloc_config IS 'Configuration colocation: nb_places, type bail, solidarité, mode de split';

-- ============================================
-- 2. TABLE: DEPOSIT_SHARES (Parts de dépôt de garantie)
-- ============================================

CREATE TABLE IF NOT EXISTS deposit_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  roommate_id UUID NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  
  -- Montants
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'partial', 'paid', 'refund_pending', 'refunded', 'retained')),
  
  -- Restitution
  refund_amount NUMERIC(10,2) DEFAULT NULL,
  retention_amount NUMERIC(10,2) DEFAULT NULL,
  retention_reason TEXT,
  refunded_at TIMESTAMPTZ,
  
  -- Dates
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(lease_id, roommate_id)
);

CREATE INDEX idx_deposit_shares_lease_id ON deposit_shares(lease_id);
CREATE INDEX idx_deposit_shares_roommate_id ON deposit_shares(roommate_id);
CREATE INDEX idx_deposit_shares_status ON deposit_shares(status);

COMMENT ON TABLE deposit_shares IS 'Parts de dépôt de garantie par colocataire';

-- ============================================
-- 3. TABLE: PAYMENT_ADJUSTMENTS (Ajustements de paiement)
-- ============================================

CREATE TABLE IF NOT EXISTS payment_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- Premier jour du mois (YYYY-MM-01)
  roommate_id UUID NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  
  -- Montants
  original_amount NUMERIC(10,2) NOT NULL,
  adjusted_amount NUMERIC(10,2) NOT NULL,
  difference NUMERIC(10,2) GENERATED ALWAYS AS (adjusted_amount - original_amount) STORED,
  
  -- Raison du changement
  reason TEXT NOT NULL CHECK (reason IN (
    'new_roommate',      -- Nouveau colocataire arrivé
    'roommate_left',     -- Colocataire parti
    'weight_change',     -- Changement de répartition
    'rent_revision',     -- Révision du loyer
    'prorata_entry',     -- Prorata entrée en cours de mois
    'prorata_exit',      -- Prorata sortie en cours de mois
    'manual'             -- Ajustement manuel
  )),
  triggered_by_roommate_id UUID REFERENCES roommates(id), -- Qui a causé le changement
  
  -- Traitement du crédit/débit
  credit_type TEXT CHECK (credit_type IN (
    'next_month',    -- Reporté sur le mois suivant
    'refund',        -- Remboursement
    'redistribute',  -- Redistribué aux autres
    'pending'        -- En attente de décision
  )),
  credit_applied BOOLEAN DEFAULT false,
  credit_applied_to_month DATE,
  
  -- Notes
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_adjustments_lease_id ON payment_adjustments(lease_id);
CREATE INDEX idx_payment_adjustments_month ON payment_adjustments(month);
CREATE INDEX idx_payment_adjustments_roommate_id ON payment_adjustments(roommate_id);
CREATE INDEX idx_payment_adjustments_reason ON payment_adjustments(reason);

COMMENT ON TABLE payment_adjustments IS 'Historique des ajustements de parts de paiement';

-- ============================================
-- 4. TABLE: PAYMENT_CREDITS (Crédits de paiement)
-- ============================================

CREATE TABLE IF NOT EXISTS payment_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roommate_id UUID NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  
  -- Montant (positif = crédit, négatif = débit)
  amount NUMERIC(10,2) NOT NULL,
  
  -- Origine
  reason TEXT NOT NULL,
  adjustment_id UUID REFERENCES payment_adjustments(id),
  source_month DATE, -- Mois d'où provient le crédit
  
  -- Utilisation
  status TEXT NOT NULL DEFAULT 'available' 
    CHECK (status IN ('available', 'applied', 'refunded', 'expired', 'cancelled')),
  applied_to_month DATE,
  applied_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  expires_at DATE, -- Date d'expiration du crédit
  
  -- Traçabilité
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_credits_roommate_id ON payment_credits(roommate_id);
CREATE INDEX idx_payment_credits_lease_id ON payment_credits(lease_id);
CREATE INDEX idx_payment_credits_status ON payment_credits(status);

COMMENT ON TABLE payment_credits IS 'Crédits de paiement (trop-perçus, avoirs)';

-- ============================================
-- 5. TABLE: ROOMMATE_HISTORY (Historique des changements)
-- ============================================

CREATE TABLE IF NOT EXISTS roommate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  roommate_id UUID NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  
  -- Type d'événement
  event_type TEXT NOT NULL CHECK (event_type IN (
    'joined',           -- Arrivée
    'left',             -- Départ
    'weight_changed',   -- Changement de part
    'role_changed',     -- Changement de rôle
    'guarantor_added',  -- Garant ajouté
    'guarantor_removed' -- Garant retiré
  )),
  
  -- Valeurs avant/après
  old_value JSONB,
  new_value JSONB,
  
  -- Contexte
  effective_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roommate_history_lease_id ON roommate_history(lease_id);
CREATE INDEX idx_roommate_history_roommate_id ON roommate_history(roommate_id);
CREATE INDEX idx_roommate_history_event_type ON roommate_history(event_type);
CREATE INDEX idx_roommate_history_effective_date ON roommate_history(effective_date);

COMMENT ON TABLE roommate_history IS 'Historique complet des changements de colocataires (audit trail)';

-- ============================================
-- 6. AJOUTER CHAMPS MANQUANTS À ROOMMATES
-- ============================================

-- Lien vers la chambre (pour baux individuels ou répartition par chambre)
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);

-- Garants multiples (JSON array de profile_ids)
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS guarantor_ids UUID[] DEFAULT '{}';

-- Date effective pour le calcul des parts
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS effective_from DATE;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS effective_until DATE;

-- Email d'invitation (avant création du compte)
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS invited_email TEXT;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'pending'
  CHECK (invitation_status IN ('pending', 'sent', 'accepted', 'declined', 'expired'));

COMMENT ON COLUMN roommates.room_id IS 'Chambre attribuée au colocataire';
COMMENT ON COLUMN roommates.guarantor_ids IS 'Liste des garants (profile_ids)';
COMMENT ON COLUMN roommates.invited_email IS 'Email utilisé pour l''invitation';

-- ============================================
-- 7. FONCTION: RECALCUL DES PARTS AVEC PRORATA
-- ============================================

CREATE OR REPLACE FUNCTION recalculate_payment_shares(
  p_lease_id UUID,
  p_month DATE,
  p_trigger_type TEXT DEFAULT 'manual',
  p_triggered_by UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_lease RECORD;
  v_total_rent NUMERIC;
  v_days_in_month INTEGER;
  v_roommate RECORD;
  v_old_share RECORD;
  v_new_amount NUMERIC;
  v_total_weight NUMERIC;
  v_prorata_days INTEGER;
  v_result JSONB := '{"adjustments": [], "created": [], "updated": []}'::JSONB;
BEGIN
  -- Récupérer le bail et le loyer total
  SELECT l.*, 
         COALESCE(l.loyer, 0) + COALESCE(l.charges_forfaitaires, 0) as total_rent
  INTO v_lease
  FROM leases l 
  WHERE l.id = p_lease_id;
  
  IF v_lease IS NULL THEN
    RAISE EXCEPTION 'Bail non trouvé: %', p_lease_id;
  END IF;
  
  v_total_rent := v_lease.total_rent;
  
  -- Nombre de jours dans le mois
  v_days_in_month := EXTRACT(DAY FROM (
    (p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day'
  ))::INTEGER;
  
  -- Calculer le poids total des colocataires actifs ce mois
  SELECT COALESCE(SUM(
    r.weight * (
      LEAST(
        COALESCE(r.left_on, (p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day'),
        (p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day'
      ) - 
      GREATEST(r.joined_on, p_month) + 1
    )::NUMERIC / v_days_in_month
  ), 0)
  INTO v_total_weight
  FROM roommates r
  WHERE r.lease_id = p_lease_id
    AND r.joined_on <= ((p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day')
    AND (r.left_on IS NULL OR r.left_on >= p_month)
    AND r.role IN ('principal', 'tenant');
  
  -- Si aucun colocataire, ne rien faire
  IF v_total_weight = 0 THEN
    RETURN v_result;
  END IF;
  
  -- Pour chaque colocataire actif pendant ce mois
  FOR v_roommate IN
    SELECT r.*,
           GREATEST(r.joined_on, p_month) as period_start,
           LEAST(
             COALESCE(r.left_on, (p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day'),
             (p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day'
           ) as period_end
    FROM roommates r
    WHERE r.lease_id = p_lease_id
      AND r.joined_on <= ((p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day')
      AND (r.left_on IS NULL OR r.left_on >= p_month)
      AND r.role IN ('principal', 'tenant')
  LOOP
    -- Calculer le prorata de jours
    v_prorata_days := (v_roommate.period_end - v_roommate.period_start + 1)::INTEGER;
    
    -- Calculer le nouveau montant dû
    v_new_amount := ROUND(
      v_total_rent * v_roommate.weight * v_prorata_days::NUMERIC / v_days_in_month,
      2
    );
    
    -- Récupérer l'ancienne part si elle existe
    SELECT * INTO v_old_share
    FROM payment_shares
    WHERE lease_id = p_lease_id 
      AND month = p_month 
      AND roommate_id = v_roommate.id;
    
    -- Créer ou mettre à jour la part
    IF v_old_share IS NULL THEN
      -- Créer nouvelle part
      INSERT INTO payment_shares (lease_id, month, roommate_id, due_amount)
      VALUES (p_lease_id, p_month, v_roommate.id, v_new_amount);
      
      v_result := jsonb_set(
        v_result, 
        '{created}', 
        v_result->'created' || jsonb_build_object(
          'roommate_id', v_roommate.id,
          'amount', v_new_amount
        )
      );
    ELSE
      -- Mettre à jour si le montant a changé
      IF v_old_share.due_amount != v_new_amount THEN
        UPDATE payment_shares 
        SET due_amount = v_new_amount, updated_at = NOW()
        WHERE id = v_old_share.id;
        
        -- Créer un ajustement
        INSERT INTO payment_adjustments (
          lease_id, month, roommate_id,
          original_amount, adjusted_amount,
          reason, triggered_by_roommate_id, created_by,
          credit_type
        ) VALUES (
          p_lease_id, p_month, v_roommate.id,
          v_old_share.due_amount, v_new_amount,
          p_trigger_type, p_triggered_by, p_created_by,
          CASE 
            WHEN v_old_share.amount_paid > v_new_amount THEN 'pending'
            ELSE NULL
          END
        );
        
        -- Si trop payé, créer un crédit
        IF v_old_share.amount_paid > v_new_amount THEN
          INSERT INTO payment_credits (
            roommate_id, lease_id, amount, reason,
            source_month, created_by
          ) VALUES (
            v_roommate.id, p_lease_id, 
            v_old_share.amount_paid - v_new_amount,
            'Ajustement ' || p_trigger_type || ' - ' || to_char(p_month, 'MM/YYYY'),
            p_month, p_created_by
          );
        END IF;
        
        v_result := jsonb_set(
          v_result, 
          '{adjustments}', 
          v_result->'adjustments' || jsonb_build_object(
            'roommate_id', v_roommate.id,
            'old_amount', v_old_share.due_amount,
            'new_amount', v_new_amount,
            'difference', v_new_amount - v_old_share.due_amount
          )
        );
      END IF;
    END IF;
  END LOOP;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_payment_shares IS 'Recalcule les parts de paiement avec prorata temporis';

-- ============================================
-- 8. FONCTION: CALCULER LES PARTS POUR UN NOUVEAU MOIS
-- ============================================

CREATE OR REPLACE FUNCTION generate_monthly_shares(
  p_lease_id UUID,
  p_month DATE
) RETURNS JSONB AS $$
BEGIN
  RETURN recalculate_payment_shares(p_lease_id, p_month, 'manual', NULL, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. TRIGGER: HISTORIQUE DES CHANGEMENTS DE ROOMMATES
-- ============================================

CREATE OR REPLACE FUNCTION log_roommate_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO roommate_history (
      lease_id, roommate_id, event_type, 
      new_value, effective_date
    ) VALUES (
      NEW.lease_id, NEW.id, 'joined',
      jsonb_build_object(
        'role', NEW.role,
        'weight', NEW.weight,
        'joined_on', NEW.joined_on
      ),
      NEW.joined_on
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Départ
    IF OLD.left_on IS NULL AND NEW.left_on IS NOT NULL THEN
      INSERT INTO roommate_history (
        lease_id, roommate_id, event_type,
        old_value, new_value, effective_date
      ) VALUES (
        NEW.lease_id, NEW.id, 'left',
        jsonb_build_object('left_on', OLD.left_on),
        jsonb_build_object('left_on', NEW.left_on),
        NEW.left_on
      );
    END IF;
    
    -- Changement de poids
    IF OLD.weight != NEW.weight THEN
      INSERT INTO roommate_history (
        lease_id, roommate_id, event_type,
        old_value, new_value, effective_date
      ) VALUES (
        NEW.lease_id, NEW.id, 'weight_changed',
        jsonb_build_object('weight', OLD.weight),
        jsonb_build_object('weight', NEW.weight),
        CURRENT_DATE
      );
    END IF;
    
    -- Changement de rôle
    IF OLD.role != NEW.role THEN
      INSERT INTO roommate_history (
        lease_id, roommate_id, event_type,
        old_value, new_value, effective_date
      ) VALUES (
        NEW.lease_id, NEW.id, 'role_changed',
        jsonb_build_object('role', OLD.role),
        jsonb_build_object('role', NEW.role),
        CURRENT_DATE
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS roommate_history_trigger ON roommates;
CREATE TRIGGER roommate_history_trigger
  AFTER INSERT OR UPDATE ON roommates
  FOR EACH ROW
  EXECUTE FUNCTION log_roommate_changes();

-- ============================================
-- 10. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE deposit_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommate_history ENABLE ROW LEVEL SECURITY;

-- Policies pour deposit_shares
CREATE POLICY "Owners can manage deposit shares"
  ON deposit_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE l.id = deposit_shares.lease_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY "Roommates can view their deposit share"
  ON deposit_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roommates r
      WHERE r.id = deposit_shares.roommate_id
        AND r.user_id = auth.uid()
    )
  );

-- Policies pour payment_adjustments
CREATE POLICY "Owners can manage payment adjustments"
  ON payment_adjustments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE l.id = payment_adjustments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY "Roommates can view their adjustments"
  ON payment_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roommates r
      WHERE r.id = payment_adjustments.roommate_id
        AND r.user_id = auth.uid()
    )
  );

-- Policies pour payment_credits
CREATE POLICY "Owners can manage payment credits"
  ON payment_credits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE l.id = payment_credits.lease_id
        AND pr.user_id = auth.uid()
    )
  );

