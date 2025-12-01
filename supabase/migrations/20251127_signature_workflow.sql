-- Migration: Workflow de signature électronique complet
-- Date: 27 Novembre 2025
-- Basé sur le processus: Préparation → Validation → Envoi → Signature → Archivage

BEGIN;

-- ============================================
-- TABLE: signature_requests
-- Représente une demande de signature (procédure)
-- ============================================
CREATE TABLE IF NOT EXISTS signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Métadonnées
  name TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'bail', 'avenant', 'edl_entree', 'edl_sortie', 'quittance',
    'caution', 'devis', 'facture', 'note_service', 'reglement_interieur', 'autre'
  )),
  related_entity_type TEXT CHECK (related_entity_type IN ('lease', 'inspection', 'quote', 'internal')),
  related_entity_id UUID,
  
  -- Workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_validation', 'validated', 'ongoing', 
    'done', 'expired', 'canceled', 'rejected'
  )),
  created_by UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Validation hiérarchique
  validation_required BOOLEAN DEFAULT false,
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMPTZ,
  validation_comment TEXT,
  
  -- Yousign
  yousign_procedure_id TEXT,
  yousign_webhook_subscription_id TEXT,
  
  -- Documents
  source_document_id UUID REFERENCES documents(id),
  signed_document_id UUID REFERENCES documents(id),
  proof_document_id UUID REFERENCES documents(id),
  
  -- Configuration
  ordered_signers BOOLEAN DEFAULT false,
  reminder_interval_days INTEGER DEFAULT 3,
  
  -- Dates
  deadline TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_signature_requests_owner ON signature_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_created_by ON signature_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_signature_requests_yousign ON signature_requests(yousign_procedure_id);

-- ============================================
-- TABLE: signature_request_signers
-- Signataires d'une demande de signature
-- ============================================
CREATE TABLE IF NOT EXISTS signature_request_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id UUID NOT NULL REFERENCES signature_requests(id) ON DELETE CASCADE,
  
  -- Identité
  profile_id UUID REFERENCES profiles(id), -- NULL si signataire externe
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  
  -- Rôle et ordre
  role TEXT NOT NULL DEFAULT 'autre' CHECK (role IN (
    'proprietaire', 'locataire_principal', 'colocataire', 
    'garant', 'representant_legal', 'temoin', 'autre'
  )),
  signing_order INTEGER DEFAULT 1,
  signature_level TEXT DEFAULT 'electronic_signature' CHECK (signature_level IN (
    'electronic_signature', 'advanced_electronic_signature', 'qualified_electronic_signature'
  )),
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'notified', 'opened', 'signed', 'refused', 'error'
  )),
  yousign_signer_id TEXT,
  
  -- Dates
  notified_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  refused_at TIMESTAMPTZ,
  refused_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(signature_request_id, email)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_signature_signers_request ON signature_request_signers(signature_request_id);
CREATE INDEX IF NOT EXISTS idx_signature_signers_profile ON signature_request_signers(profile_id);
CREATE INDEX IF NOT EXISTS idx_signature_signers_status ON signature_request_signers(status);

-- ============================================
-- TABLE: signature_validations
-- Historique des validations hiérarchiques
-- ============================================
CREATE TABLE IF NOT EXISTS signature_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id UUID NOT NULL REFERENCES signature_requests(id) ON DELETE CASCADE,
  
  -- Valideur
  validator_profile_id UUID NOT NULL REFERENCES profiles(id),
  validator_role TEXT NOT NULL CHECK (validator_role IN (
    'hierarchique', 'juridique', 'rh', 'finance', 'direction'
  )),
  
  -- Décision
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  comment TEXT,
  validated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(signature_request_id, validator_profile_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_signature_validations_request ON signature_validations(signature_request_id);

-- ============================================
-- TABLE: signature_audit_log
-- Journal complet des actions (traçabilité)
-- ============================================
CREATE TABLE IF NOT EXISTS signature_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id UUID NOT NULL REFERENCES signature_requests(id) ON DELETE CASCADE,
  
  -- Action
  action TEXT NOT NULL,
  actor_profile_id UUID REFERENCES profiles(id),
  actor_email TEXT,
  
  -- Détails
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_signature_audit_request ON signature_audit_log(signature_request_id);
CREATE INDEX IF NOT EXISTS idx_signature_audit_created ON signature_audit_log(created_at);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_request_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin peut tout voir
CREATE POLICY "signature_requests_admin"
  ON signature_requests FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Propriétaire peut voir ses demandes
CREATE POLICY "signature_requests_owner"
  ON signature_requests FOR SELECT
  TO authenticated
  USING (
    owner_id = public.user_profile_id()
    OR created_by = public.user_profile_id()
  );

-- Propriétaire peut créer des demandes
CREATE POLICY "signature_requests_owner_insert"
  ON signature_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = public.user_profile_id()
    AND owner_id = public.user_profile_id()
  );

-- Propriétaire peut modifier ses demandes (brouillon uniquement)
CREATE POLICY "signature_requests_owner_update"
  ON signature_requests FOR UPDATE
  TO authenticated
  USING (
    owner_id = public.user_profile_id()
    AND status IN ('draft', 'pending_validation')
  );

-- Signataires peuvent voir les demandes où ils sont impliqués
CREATE POLICY "signature_requests_signer"
  ON signature_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM signature_request_signers srs
      WHERE srs.signature_request_id = signature_requests.id
      AND srs.profile_id = public.user_profile_id()
    )
  );

-- Policies pour signers
CREATE POLICY "signature_signers_admin"
  ON signature_request_signers FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin');

CREATE POLICY "signature_signers_owner"
  ON signature_request_signers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM signature_requests sr
      WHERE sr.id = signature_request_signers.signature_request_id
      AND (sr.owner_id = public.user_profile_id() OR sr.created_by = public.user_profile_id())
    )
  );

CREATE POLICY "signature_signers_self"
  ON signature_request_signers FOR SELECT
  TO authenticated
  USING (profile_id = public.user_profile_id());

-- Policies pour validations
CREATE POLICY "signature_validations_admin"
  ON signature_validations FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin');

CREATE POLICY "signature_validations_owner"
  ON signature_validations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM signature_requests sr
      WHERE sr.id = signature_validations.signature_request_id
      AND sr.owner_id = public.user_profile_id()
    )
  );

-- Policies pour audit log
CREATE POLICY "signature_audit_admin"
  ON signature_audit_log FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin');

CREATE POLICY "signature_audit_owner"
  ON signature_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM signature_requests sr
      WHERE sr.id = signature_audit_log.signature_request_id
      AND sr.owner_id = public.user_profile_id()
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_signature_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_signature_request_updated
  BEFORE UPDATE ON signature_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_signature_request_timestamp();

CREATE TRIGGER trigger_signature_signer_updated
  BEFORE UPDATE ON signature_request_signers
  FOR EACH ROW
  EXECUTE FUNCTION update_signature_request_timestamp();

-- Audit automatique des changements de statut
CREATE OR REPLACE FUNCTION log_signature_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO signature_audit_log (signature_request_id, action, details)
    VALUES (
      NEW.id,
      'status_changed',
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_signature_status_audit
  AFTER UPDATE ON signature_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_signature_status_change();

COMMIT;

