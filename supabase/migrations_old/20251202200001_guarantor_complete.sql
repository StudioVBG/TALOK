-- =====================================================
-- MIGRATION: Module Garant complet
-- Description: Profils garants, documents, engagements
-- =====================================================

-- =====================================================
-- 1. TABLE: guarantor_profiles
-- =====================================================
CREATE TABLE IF NOT EXISTS guarantor_profiles (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Relation avec le locataire
  relation_to_tenant TEXT NOT NULL CHECK (relation_to_tenant IN (
    'parent', 'grand_parent', 'oncle_tante', 'frere_soeur',
    'employeur', 'ami', 'autre'
  )),
  relation_details TEXT, -- Précisions si "autre"
  
  -- Informations professionnelles
  situation_pro TEXT CHECK (situation_pro IN (
    'cdi', 'cdd', 'fonctionnaire', 'independant', 'retraite',
    'profession_liberale', 'chef_entreprise', 'autre'
  )),
  employeur_nom TEXT,
  employeur_adresse TEXT,
  anciennete_mois INTEGER,
  
  -- Informations financières
  revenus_mensuels_nets DECIMAL(10,2),
  revenus_fonciers DECIMAL(10,2) DEFAULT 0,
  autres_revenus DECIMAL(10,2) DEFAULT 0,
  charges_mensuelles DECIMAL(10,2) DEFAULT 0,
  credits_en_cours DECIMAL(10,2) DEFAULT 0,
  
  -- Patrimoine (optionnel)
  est_proprietaire BOOLEAN DEFAULT false,
  valeur_patrimoine_immobilier DECIMAL(15,2),
  
  -- Adresse
  adresse_complete TEXT,
  code_postal TEXT,
  ville TEXT,
  
  -- Statut vérification
  documents_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(id),
  verification_notes TEXT,
  
  -- Consentements
  consent_garant BOOLEAN DEFAULT false,
  consent_garant_at TIMESTAMPTZ,
  consent_data_processing BOOLEAN DEFAULT false,
  consent_data_processing_at TIMESTAMPTZ,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_guarantor_profiles_verified ON guarantor_profiles(documents_verified);
CREATE INDEX IF NOT EXISTS idx_guarantor_profiles_situation ON guarantor_profiles(situation_pro);

-- =====================================================
-- 2. TABLE: guarantor_engagements (cautions)
-- =====================================================
CREATE TABLE IF NOT EXISTS guarantor_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Liens
  guarantor_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Type de caution
  caution_type TEXT NOT NULL CHECK (caution_type IN (
    'simple', 'solidaire'
  )) DEFAULT 'solidaire',
  
  -- Montants
  montant_garanti DECIMAL(10,2), -- Montant max couvert (null = illimité dans la limite légale)
  duree_engagement_mois INTEGER, -- Null = durée du bail
  
  -- Statut
  status TEXT NOT NULL CHECK (status IN (
    'pending_signature', 'active', 'terminated', 'called', 'released'
  )) DEFAULT 'pending_signature',
  
  -- Signature
  signature_request_id TEXT, -- ID Yousign
  signed_at TIMESTAMPTZ,
  document_id UUID REFERENCES documents(id),
  
  -- Appel de la caution (si impayés)
  called_at TIMESTAMPTZ,
  called_amount DECIMAL(10,2),
  called_reason TEXT,
  
  -- Libération
  released_at TIMESTAMPTZ,
  released_reason TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Un garant ne peut avoir qu'un engagement actif par bail
  UNIQUE(guarantor_profile_id, lease_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_guarantor_engagements_guarantor ON guarantor_engagements(guarantor_profile_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_engagements_lease ON guarantor_engagements(lease_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_engagements_tenant ON guarantor_engagements(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_engagements_status ON guarantor_engagements(status);

-- =====================================================
-- 3. TABLE: guarantor_documents
-- =====================================================
CREATE TABLE IF NOT EXISTS guarantor_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guarantor_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Type de document
  document_type TEXT NOT NULL CHECK (document_type IN (
    'piece_identite',
    'justificatif_domicile',
    'avis_imposition',
    'bulletins_salaire', -- 3 derniers mois
    'contrat_travail',
    'attestation_employeur',
    'releve_bancaire',
    'titre_propriete',
    'acte_caution_signe',
    'autre'
  )),
  
  -- Stockage
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  file_size INTEGER,
  
  -- Vérification
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_guarantor_documents_profile ON guarantor_documents(guarantor_profile_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_documents_type ON guarantor_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_guarantor_documents_verified ON guarantor_documents(is_verified);

-- =====================================================
-- 4. TABLE: guarantor_payment_incidents
-- Historique des incidents de paiement notifiés au garant
-- =====================================================
CREATE TABLE IF NOT EXISTS guarantor_payment_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id UUID NOT NULL REFERENCES guarantor_engagements(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Détails
  incident_type TEXT NOT NULL CHECK (incident_type IN (
    'late_payment', 'unpaid', 'partial_payment', 'call_caution'
  )),
  amount_due DECIMAL(10,2) NOT NULL,
  days_late INTEGER,
  
  -- Notifications
  notified_at TIMESTAMPTZ,
  notification_method TEXT, -- 'email', 'sms', 'letter'
  
  -- Résolution
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT, -- 'tenant', 'guarantor', 'owner'
  resolution_notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_guarantor_incidents_engagement ON guarantor_payment_incidents(engagement_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_incidents_invoice ON guarantor_payment_incidents(invoice_id);

-- =====================================================
-- 5. FONCTIONS RPC
-- =====================================================

-- Fonction: Obtenir le dashboard garant
CREATE OR REPLACE FUNCTION guarantor_dashboard(p_guarantor_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_engagements JSONB;
  v_incidents JSONB;
  v_stats JSONB;
  v_result JSONB;
BEGIN
  -- Récupérer l'ID du profil
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_guarantor_user_id AND role = 'guarantor';

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Récupérer les engagements actifs
  SELECT COALESCE(jsonb_agg(engagement_data ORDER BY engagement_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_engagements
  FROM (
    SELECT jsonb_build_object(
      'id', ge.id,
      'lease_id', ge.lease_id,
      'caution_type', ge.caution_type,
      'montant_garanti', ge.montant_garanti,
      'status', ge.status,
      'signed_at', ge.signed_at,
      'created_at', ge.created_at,
      -- Infos locataire
      'tenant', jsonb_build_object(
        'id', tp.id,
        'name', CONCAT(tp.prenom, ' ', tp.nom)
      ),
      -- Infos propriété
      'property', jsonb_build_object(
        'id', p.id,
        'adresse', p.adresse_complete,
        'ville', p.ville
      ),
      -- Infos bail
      'lease', jsonb_build_object(
        'loyer', l.loyer,
        'charges', l.charges_forfaitaires,
        'date_debut', l.date_debut
      )
    ) as engagement_data
    FROM guarantor_engagements ge
    JOIN profiles tp ON tp.id = ge.tenant_profile_id
    JOIN leases l ON l.id = ge.lease_id
    JOIN properties p ON p.id = l.property_id
    WHERE ge.guarantor_profile_id = v_profile_id
    AND ge.status IN ('pending_signature', 'active')
  ) sub;

  -- Récupérer les incidents récents
  SELECT COALESCE(jsonb_agg(incident_data ORDER BY incident_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_incidents
  FROM (
    SELECT jsonb_build_object(
      'id', gpi.id,
      'incident_type', gpi.incident_type,
      'amount_due', gpi.amount_due,
      'days_late', gpi.days_late,
      'notified_at', gpi.notified_at,
      'resolved_at', gpi.resolved_at,
      'created_at', gpi.created_at
    ) as incident_data
    FROM guarantor_payment_incidents gpi
    JOIN guarantor_engagements ge ON ge.id = gpi.engagement_id
    WHERE ge.guarantor_profile_id = v_profile_id
    ORDER BY gpi.created_at DESC
    LIMIT 10
  ) sub;

  -- Calculer les stats
  SELECT jsonb_build_object(
    'total_engagements', COUNT(*) FILTER (WHERE status = 'active'),
    'pending_signatures', COUNT(*) FILTER (WHERE status = 'pending_signature'),
    'total_amount_guaranteed', COALESCE(SUM(montant_garanti) FILTER (WHERE status = 'active'), 0),
    'active_incidents', (
      SELECT COUNT(*)
      FROM guarantor_payment_incidents gpi
      JOIN guarantor_engagements ge ON ge.id = gpi.engagement_id
      WHERE ge.guarantor_profile_id = v_profile_id
      AND gpi.resolved_at IS NULL
    )
  ) INTO v_stats
  FROM guarantor_engagements
  WHERE guarantor_profile_id = v_profile_id;

  -- Assembler le résultat
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'engagements', v_engagements,
    'incidents', v_incidents,
    'stats', v_stats
  );

  RETURN v_result;
END;
$$;

-- Fonction: Vérifier éligibilité garant
CREATE OR REPLACE FUNCTION check_guarantor_eligibility(
  p_guarantor_profile_id UUID,
  p_lease_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guarantor guarantor_profiles%ROWTYPE;
  v_lease leases%ROWTYPE;
  v_total_rent DECIMAL(10,2);
  v_income_ratio DECIMAL(5,2);
  v_is_eligible BOOLEAN;
  v_reasons TEXT[];
BEGIN
  -- Récupérer le profil garant
  SELECT * INTO v_guarantor FROM guarantor_profiles WHERE profile_id = p_guarantor_profile_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reasons', ARRAY['Profil garant non trouvé']);
  END IF;

  -- Récupérer le bail
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reasons', ARRAY['Bail non trouvé']);
  END IF;

  -- Calculer le loyer total
  v_total_rent := v_lease.loyer + v_lease.charges_forfaitaires;
  
  -- Calculer le ratio revenus/loyer
  v_income_ratio := COALESCE(v_guarantor.revenus_mensuels_nets, 0) / NULLIF(v_total_rent, 0);
  
  v_is_eligible := true;
  v_reasons := ARRAY[]::TEXT[];

  -- Vérifications
  IF v_guarantor.revenus_mensuels_nets IS NULL OR v_guarantor.revenus_mensuels_nets <= 0 THEN
    v_is_eligible := false;
    v_reasons := array_append(v_reasons, 'Revenus non renseignés');
  ELSIF v_income_ratio < 3 THEN
    v_is_eligible := false;
    v_reasons := array_append(v_reasons, 'Revenus insuffisants (ratio < 3x le loyer)');
  END IF;

  IF NOT v_guarantor.documents_verified THEN
    v_is_eligible := false;
    v_reasons := array_append(v_reasons, 'Documents non vérifiés');
  END IF;

  IF NOT v_guarantor.consent_garant THEN
    v_is_eligible := false;
    v_reasons := array_append(v_reasons, 'Consentement de caution non donné');
  END IF;

  RETURN jsonb_build_object(
    'eligible', v_is_eligible,
    'income_ratio', ROUND(v_income_ratio, 2),
    'total_rent', v_total_rent,
    'guarantor_income', v_guarantor.revenus_mensuels_nets,
    'reasons', v_reasons
  );
END;
$$;

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

-- Activer RLS
ALTER TABLE guarantor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guarantor_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE guarantor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE guarantor_payment_incidents ENABLE ROW LEVEL SECURITY;

-- Policies guarantor_profiles
CREATE POLICY "Garants peuvent voir leur propre profil"
  ON guarantor_profiles FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Garants peuvent modifier leur propre profil"
  ON guarantor_profiles FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Garants peuvent créer leur profil"
  ON guarantor_profiles FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins ont accès complet aux profils garants"
  ON guarantor_profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Propriétaires peuvent voir les garants de leurs locataires
CREATE POLICY "Propriétaires peuvent voir les garants de leurs baux"
  ON guarantor_profiles FOR SELECT
  USING (
    profile_id IN (
      SELECT ge.guarantor_profile_id
      FROM guarantor_engagements ge
      JOIN leases l ON l.id = ge.lease_id
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Policies guarantor_engagements
CREATE POLICY "Garants peuvent voir leurs engagements"
  ON guarantor_engagements FOR SELECT
  USING (guarantor_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Propriétaires peuvent voir/créer les engagements de leurs baux"
  ON guarantor_engagements FOR ALL
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins ont accès complet aux engagements"
  ON guarantor_engagements FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies guarantor_documents
CREATE POLICY "Garants peuvent gérer leurs documents"
  ON guarantor_documents FOR ALL
  USING (guarantor_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins ont accès complet aux documents garants"
  ON guarantor_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies guarantor_payment_incidents
CREATE POLICY "Garants peuvent voir leurs incidents"
  ON guarantor_payment_incidents FOR SELECT
  USING (
    engagement_id IN (
      SELECT id FROM guarantor_engagements
      WHERE guarantor_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Propriétaires peuvent gérer les incidents"
  ON guarantor_payment_incidents FOR ALL
  USING (
    engagement_id IN (
      SELECT ge.id FROM guarantor_engagements ge
      JOIN leases l ON l.id = ge.lease_id
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins ont accès complet aux incidents"
  ON guarantor_payment_incidents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- =====================================================
-- 7. TRIGGERS
-- =====================================================

-- Trigger updated_at
CREATE TRIGGER trg_guarantor_profiles_updated_at
  BEFORE UPDATE ON guarantor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_guarantor_engagements_updated_at
  BEFORE UPDATE ON guarantor_engagements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_guarantor_documents_updated_at
  BEFORE UPDATE ON guarantor_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. COMMENTAIRES
-- =====================================================
COMMENT ON TABLE guarantor_profiles IS 'Profils complets des garants avec informations financières';
COMMENT ON TABLE guarantor_engagements IS 'Engagements de caution liant garants et baux';
COMMENT ON TABLE guarantor_documents IS 'Documents justificatifs des garants';
COMMENT ON TABLE guarantor_payment_incidents IS 'Historique des incidents de paiement notifiés aux garants';
COMMENT ON FUNCTION guarantor_dashboard(UUID) IS 'Dashboard complet pour le garant connecté';
COMMENT ON FUNCTION check_guarantor_eligibility(UUID, UUID) IS 'Vérifie si un garant est éligible pour un bail donné';







