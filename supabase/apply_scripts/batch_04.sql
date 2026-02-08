RETURNS TABLE (
  organization_id UUID,
  organization_name VARCHAR,
  white_label_level white_label_level,
  branding JSONB,
  primary_domain VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id AS organization_id,
    o.name AS organization_name,
    o.white_label_level,
    CASE
      WHEN ob.id IS NOT NULL THEN
        jsonb_build_object(
          'company_name', COALESCE(ob.company_name, o.name),
          'tagline', ob.tagline,
          'logo_url', ob.logo_url,
          'logo_dark_url', ob.logo_dark_url,
          'favicon_url', ob.favicon_url,
          'primary_color', COALESCE(ob.primary_color, '#2563eb'),
          'secondary_color', ob.secondary_color,
          'accent_color', ob.accent_color,
          'email_from_name', ob.email_from_name,
          'email_from_address', ob.email_from_address,
          'email_logo_url', ob.email_logo_url,
          'email_footer_html', ob.email_footer_html,
          'email_primary_color', ob.email_primary_color,
          'remove_powered_by', ob.remove_powered_by,
          'custom_css', ob.custom_css,
          'sso_enabled', ob.sso_enabled,
          'sso_provider', ob.sso_provider
        )
      ELSE
        jsonb_build_object(
          'company_name', o.name,
          'primary_color', '#2563eb'
        )
    END AS branding,
    cd.domain AS primary_domain
  FROM organizations o
  LEFT JOIN organization_branding ob ON ob.organization_id = o.id
  LEFT JOIN custom_domains cd ON cd.organization_id = o.id AND cd.is_primary = true AND cd.verified = true
  WHERE o.id = p_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir l'organisation par domaine
CREATE OR REPLACE FUNCTION get_organization_by_domain(p_domain VARCHAR)
RETURNS TABLE (
  organization_id UUID,
  organization_slug VARCHAR,
  white_label_level white_label_level
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id AS organization_id,
    o.slug AS organization_slug,
    o.white_label_level
  FROM organizations o
  INNER JOIN custom_domains cd ON cd.organization_id = o.id
  WHERE cd.domain = p_domain
    AND cd.verified = true
    AND cd.is_active = true
    AND o.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si une feature white-label est disponible
CREATE OR REPLACE FUNCTION check_white_label_feature(
  p_organization_id UUID,
  p_feature VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_level white_label_level;
  v_basic_features VARCHAR[] := ARRAY['custom_logo', 'primary_color', 'company_name', 'custom_email_from', 'custom_email_logo'];
  v_full_features VARCHAR[] := ARRAY['custom_favicon', 'secondary_color', 'accent_color', 'custom_email_footer', 'custom_email_colors', 'branded_login_page', 'remove_powered_by', 'custom_domain'];
  v_premium_features VARCHAR[] := ARRAY['custom_css', 'sso_saml', 'sso_oidc', 'multi_organizations', 'branding_api'];
BEGIN
  -- Récupérer le niveau
  SELECT white_label_level INTO v_level
  FROM organizations
  WHERE id = p_organization_id;

  IF v_level IS NULL THEN
    RETURN false;
  END IF;

  -- Vérifier selon le niveau
  CASE v_level
    WHEN 'none' THEN
      RETURN false;
    WHEN 'basic' THEN
      RETURN p_feature = ANY(v_basic_features);
    WHEN 'full' THEN
      RETURN p_feature = ANY(v_basic_features) OR p_feature = ANY(v_full_features);
    WHEN 'premium' THEN
      RETURN true; -- Toutes les features
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger pour updated_at sur organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour updated_at sur organization_members
CREATE TRIGGER update_org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour updated_at sur organization_branding
CREATE TRIGGER update_org_branding_updated_at
  BEFORE UPDATE ON organization_branding
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour updated_at sur custom_domains
CREATE TRIGGER update_custom_domains_updated_at
  BEFORE UPDATE ON custom_domains
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour créer automatiquement le branding quand une organisation est créée
CREATE OR REPLACE FUNCTION create_default_branding()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_branding (organization_id, company_name)
  VALUES (NEW.id, NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_org_branding_on_create
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_branding();

-- Trigger pour s'assurer qu'il n'y a qu'un seul domaine primaire par organisation
CREATE OR REPLACE FUNCTION ensure_single_primary_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE custom_domains
    SET is_primary = false
    WHERE organization_id = NEW.organization_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_domain_trigger
  BEFORE INSERT OR UPDATE ON custom_domains
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_domain();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_assets ENABLE ROW LEVEL SECURITY;

-- Policies pour organizations
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Owners can update their organizations"
  ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their organizations"
  ON organizations FOR DELETE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Policies pour organization_members
CREATE POLICY "Members can view their organization members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Org owners can manage members"
  ON organization_members FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Policies pour organization_branding
CREATE POLICY "Members can view branding"
  ON organization_branding FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Org owners/admins can update branding"
  ON organization_branding FOR UPDATE
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Policies pour custom_domains
CREATE POLICY "Members can view domains"
  ON custom_domains FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Org owners/admins can manage domains"
  ON custom_domains FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Policies pour branding_assets
CREATE POLICY "Members can view assets"
  ON branding_assets FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Org owners/admins can manage assets"
  ON branding_assets FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- ============================================
-- AJOUT COLONNE organization_id à profiles
-- ============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles(organization_id);

-- ============================================
-- STORAGE BUCKET pour les assets
-- ============================================

-- Créer le bucket pour les assets de branding (à exécuter manuellement ou via API)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('branding-assets', 'branding-assets', true)
-- ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE organizations IS 'Organisations utilisant le white-label';
COMMENT ON TABLE organization_branding IS 'Configuration du branding par organisation';
COMMENT ON TABLE custom_domains IS 'Domaines personnalisés pour le white-label';
COMMENT ON TABLE branding_assets IS 'Assets uploadés (logos, images)';


-- ========== 20260115000001_add_performance_indexes.sql ==========
-- Migration: Add performance indexes for frequent queries
-- Date: 2026-01-15
-- Purpose: Improve query performance on commonly accessed columns

-- ============================================
-- 1. Index on leases.tenant_id
-- Purpose: Optimize frequent tenant lookup queries
-- Used for: Dashboard views, tenant-specific lease retrieval
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id_perf
ON leases(tenant_id);

COMMENT ON INDEX idx_leases_tenant_id_perf IS
'Performance index for frequent tenant lookup queries on leases';

-- ============================================
-- 2. Index on documents.verified_by
-- Purpose: Speed up document verification queries
-- Used for: Admin verification workflows, audit trails
-- ============================================
CREATE INDEX IF NOT EXISTS idx_documents_verified_by
ON documents(verified_by);

COMMENT ON INDEX idx_documents_verified_by IS
'Performance index for document verification lookups and audit queries';

-- ============================================
-- 3. Composite index on payments(invoice_id, statut)
-- Purpose: Optimize payment tracking and status queries
-- Used for: Payment status reports, invoice reconciliation
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payments_invoice_statut
ON payments(invoice_id, statut);

COMMENT ON INDEX idx_payments_invoice_statut IS
'Composite index for efficient payment tracking by invoice and status';

-- ============================================
-- 4. Composite index on invoices(owner_id, periode)
-- Purpose: Speed up financial summary queries per owner
-- Used for: Owner dashboards, monthly/yearly financial reports
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invoices_owner_periode
ON invoices(owner_id, periode);

COMMENT ON INDEX idx_invoices_owner_periode IS
'Composite index for owner financial summaries grouped by period';

-- ============================================
-- 5. Composite index on payment_adjustments(month, roommate_id)
-- Purpose: Optimize tenant payment adjustment reports
-- Used for: Colocation billing, roommate payment history
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payment_adjustments_month_roommate
ON payment_adjustments(month, roommate_id);

COMMENT ON INDEX idx_payment_adjustments_month_roommate IS
'Composite index for tenant payment adjustment reports by month and roommate';


-- ========== 20260115000001_fix_edl_meter_readings_nullable.sql ==========
-- Migration: Rendre photo_path nullable dans edl_meter_readings
-- Date: 2026-01-05
-- Raison: Permettre l'enregistrement de relevés de compteurs sans photo (saisie manuelle)

-- 1. Supprimer la contrainte NOT NULL sur photo_path
ALTER TABLE edl_meter_readings ALTER COLUMN photo_path DROP NOT NULL;

-- 2. Ajouter les colonnes OCR et validation si elles n'existent pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'ocr_value') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN ocr_value NUMERIC;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'ocr_confidence') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN ocr_confidence INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'ocr_provider') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN ocr_provider TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'ocr_raw_text') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN ocr_raw_text TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'is_validated') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN is_validated BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'validated_by') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN validated_by UUID REFERENCES auth.users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'validated_at') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN validated_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'validation_comment') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN validation_comment TEXT;
    END IF;
END $$;

-- 3. Commentaires
COMMENT ON COLUMN edl_meter_readings.photo_path IS 'Chemin vers la photo du compteur (optionnel)';
COMMENT ON COLUMN edl_meter_readings.ocr_value IS 'Valeur détectée par OCR';
COMMENT ON COLUMN edl_meter_readings.ocr_confidence IS 'Niveau de confiance de l''OCR (0-100)';
COMMENT ON COLUMN edl_meter_readings.is_validated IS 'Indique si le relevé a été validé manuellement';



-- ========== 20260119000000_fix_edl_meter_readings_rls.sql ==========
-- Migration: Corriger les RLS policies pour edl_meter_readings
-- Date: 2026-01-19
-- Raison: Les jointures utilisaient owner_profiles.id qui n'existe pas
--         properties.owner_id référence profiles(id) directement

-- Recréer les policies avec la bonne jointure (profiles.id = properties.owner_id)

-- 1. Policy: Les propriétaires voient les relevés de leurs biens
DROP POLICY IF EXISTS "edl_meter_readings_owner_select" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_select" ON edl_meter_readings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN profiles ON profiles.id = properties.owner_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- 2. Policy: Les propriétaires peuvent créer des relevés
DROP POLICY IF EXISTS "edl_meter_readings_owner_insert" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_insert" ON edl_meter_readings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN profiles ON profiles.id = properties.owner_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- 3. Policy: Les propriétaires peuvent modifier les relevés
DROP POLICY IF EXISTS "edl_meter_readings_owner_update" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_update" ON edl_meter_readings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN profiles ON profiles.id = properties.owner_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- 4. Policy: Les propriétaires peuvent supprimer les relevés
DROP POLICY IF EXISTS "edl_meter_readings_owner_delete" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_delete" ON edl_meter_readings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN profiles ON profiles.id = properties.owner_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Note: Les policies pour les locataires et admins restent inchangées
-- car elles n'utilisaient pas la jointure owner_profiles incorrecte


-- ========== 20260121000001_unified_signature_system.sql ==========
-- ============================================================================
-- MIGRATION: Unified Signature System (SOTA 2026)
-- ============================================================================
--
-- Cette migration crée un système de signature unifié qui remplace progressivement:
-- - lease_signers (utilisé pour baux)
-- - signatures (eIDAS avancé)
-- - edl_signatures (états des lieux)
-- - signature_requests/signature_request_signers (demandes génériques)
--
-- Architecture:
-- 1. signature_sessions - Contexte et workflow de signature
-- 2. signature_participants - Signataires (flexibles: profile ou invitation)
-- 3. signature_proofs - Preuves cryptographiques eIDAS
-- 4. signature_audit_log - Journal d'audit immutable
--
-- IMPORTANT: Cette migration est NON-DESTRUCTIVE
-- Les anciennes tables restent fonctionnelles pendant la transition
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

-- Type de document signable
CREATE TYPE signature_document_type AS ENUM (
  'bail',
  'avenant',
  'edl_entree',
  'edl_sortie',
  'quittance',
  'caution',
  'devis',
  'facture',
  'note_service',
  'reglement_interieur',
  'autre'
);

-- Type d'entité liée
CREATE TYPE signature_entity_type AS ENUM (
  'lease',
  'edl',
  'quote',
  'invoice',
  'internal'
);

-- Statut de la session
CREATE TYPE signature_session_status AS ENUM (
  'draft',           -- Brouillon, pas encore envoyé
  'pending',         -- Prêt à être envoyé
  'ongoing',         -- En cours de signature
  'done',            -- Toutes signatures complètes
  'rejected',        -- Au moins un refus
  'expired',         -- Deadline dépassée
  'canceled'         -- Annulée manuellement
);

-- Statut du participant
CREATE TYPE signature_participant_status AS ENUM (
  'pending',         -- En attente de notification
  'notified',        -- Notifié (email envoyé)
  'opened',          -- A ouvert le document
  'signed',          -- A signé
  'refused',         -- A refusé
  'error'            -- Erreur technique
);

-- Rôle du signataire
CREATE TYPE signature_role AS ENUM (
  'proprietaire',
  'locataire_principal',
  'colocataire',
  'garant',
  'representant_legal',
  'temoin',
  'autre'
);

-- Niveau eIDAS
CREATE TYPE signature_level AS ENUM (
  'SES',  -- Simple Electronic Signature
  'AES',  -- Advanced Electronic Signature
  'QES'   -- Qualified Electronic Signature
);

-- Actions d'audit
CREATE TYPE signature_audit_action AS ENUM (
  'session_created',
  'session_sent',
  'session_completed',
  'session_rejected',
  'session_expired',
  'session_canceled',
  'participant_added',
  'participant_notified',
  'participant_opened',
  'participant_signed',
  'participant_refused',
  'proof_generated',
  'proof_verified'
);

-- ============================================================================
-- 2. TABLE: signature_sessions
-- ============================================================================

CREATE TABLE signature_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- CONTEXTE
  document_type signature_document_type NOT NULL,
  entity_type signature_entity_type NOT NULL,
  entity_id UUID NOT NULL,  -- ID du bail, EDL, devis, etc.

  -- DOCUMENTS
  source_document_id UUID,  -- Document à signer (dans documents table)
  signed_document_id UUID,  -- Document signé final
  proof_document_id UUID,   -- PDF de preuve consolidé

  -- METADATA
  name TEXT NOT NULL,
  description TEXT,

  -- WORKFLOW
  status signature_session_status NOT NULL DEFAULT 'draft',
  signature_level signature_level NOT NULL DEFAULT 'SES',
  is_ordered_signatures BOOLEAN DEFAULT false,  -- Signatures dans l'ordre
  otp_required BOOLEAN DEFAULT false,           -- OTP obligatoire

  -- OWNERSHIP
  created_by UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),

  -- DATES
  deadline TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche par entité
CREATE INDEX idx_signature_sessions_entity
ON signature_sessions(entity_type, entity_id);

-- Index pour recherche par statut et propriétaire
CREATE INDEX idx_signature_sessions_status_owner
ON signature_sessions(status, owner_id);

-- Index pour sessions actives
CREATE INDEX idx_signature_sessions_active
ON signature_sessions(status)
WHERE status IN ('pending', 'ongoing');

-- Commentaires
COMMENT ON TABLE signature_sessions IS 'Sessions de signature unifiées (SOTA 2026)';
COMMENT ON COLUMN signature_sessions.entity_id IS 'UUID de l''entité liée (lease.id, edl.id, etc.)';
COMMENT ON COLUMN signature_sessions.signature_level IS 'Niveau eIDAS: SES (simple), AES (avancé), QES (qualifié)';

-- ============================================================================
-- 3. TABLE: signature_participants
-- ============================================================================

CREATE TABLE signature_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- LIEN SESSION
  session_id UUID NOT NULL REFERENCES signature_sessions(id) ON DELETE CASCADE,

  -- IDENTITÉ (flexible: profil existant OU invitation)
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,

  -- RÔLE ET ORDRE
  role signature_role NOT NULL,
  signing_order INT,  -- NULL = pas d'ordre, sinon 1,2,3...

  -- STATUT
  status signature_participant_status NOT NULL DEFAULT 'pending',

  -- SIGNATURE
  signature_image_path TEXT,        -- Chemin storage (pas de base64!)
  signature_timestamp TIMESTAMPTZ,
  signature_ip INET,
  signature_user_agent TEXT,

  -- OTP (si requis)
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_verified BOOLEAN DEFAULT false,

  -- REFUS
  refused_reason TEXT,
  refused_at TIMESTAMPTZ,

  -- INVITATION
  invitation_token TEXT UNIQUE,
  invitation_token_expires_at TIMESTAMPTZ,
  invitation_sent_at TIMESTAMPTZ,

  -- TRACKING
  notified_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,

  -- DATES
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index unique partiel pour profiles
CREATE UNIQUE INDEX idx_signature_participants_session_profile
ON signature_participants(session_id, profile_id)
WHERE profile_id IS NOT NULL;

-- Index unique partiel pour emails (invitations)
CREATE UNIQUE INDEX idx_signature_participants_session_email
ON signature_participants(session_id, email)
WHERE profile_id IS NULL;

-- Index pour recherche par token
CREATE INDEX idx_signature_participants_token
ON signature_participants(invitation_token)
WHERE invitation_token IS NOT NULL;

-- Index pour recherche par email
CREATE INDEX idx_signature_participants_email
ON signature_participants(email);

-- Index pour statut
CREATE INDEX idx_signature_participants_status
ON signature_participants(status);

-- Index pour ordre de signature
CREATE INDEX idx_signature_participants_order
ON signature_participants(session_id, signing_order)
WHERE signing_order IS NOT NULL;

-- Commentaires
COMMENT ON TABLE signature_participants IS 'Participants aux sessions de signature';
COMMENT ON COLUMN signature_participants.profile_id IS 'NULL si invitation email (pas encore inscrit)';
COMMENT ON COLUMN signature_participants.signature_image_path IS 'Chemin Supabase Storage - jamais de base64!';

-- ============================================================================
-- 4. TABLE: signature_proofs
-- ============================================================================

CREATE TABLE signature_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- LIENS
  participant_id UUID NOT NULL REFERENCES signature_participants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES signature_sessions(id) ON DELETE CASCADE,

  -- IDENTIFIANT UNIQUE DE PREUVE
  proof_id TEXT UNIQUE NOT NULL,  -- Format: SIG-[timestamp]-[random]

  -- HASHES CRYPTOGRAPHIQUES (SHA-256)
  document_hash TEXT NOT NULL,    -- Hash du document signé
  signature_hash TEXT NOT NULL,   -- Hash de l'image de signature
  proof_hash TEXT NOT NULL,       -- Hash de toute la preuve

  -- MÉTADONNÉES COMPLÈTES (conforme eIDAS)
  metadata JSONB NOT NULL,
  /*
    Structure metadata:
    {
      "signer": {
        "name": "Jean Dupont",
        "email": "jean@example.com",
        "profileId": "uuid",
        "identityVerified": true,
        "identityMethod": "cni_scan"
      },
      "document": {
        "type": "bail",
        "id": "uuid",
        "name": "Bail appartement 123",
        "hash": "sha256..."
      },
      "signature": {
        "type": "draw" | "text",
        "imageData": "sha256...",
        "timestamp": "2026-01-21T10:00:00Z"
      },
      "technical": {
        "ipAddress": "1.2.3.4",
        "userAgent": "...",
        "screenSize": "1920x1080",
        "touchDevice": false,
        "geolocation": { "lat": 48.8, "lng": 2.3 }
      },
      "integrity": {
        "algorithm": "SHA-256",
        "proofHash": "sha256..."
      }
    }
  */

  -- VÉRIFICATION
  verified_at TIMESTAMPTZ,
  verification_errors TEXT[],  -- Erreurs si échec

  -- DATES
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche par proof_id
CREATE INDEX idx_signature_proofs_proof_id
ON signature_proofs(proof_id);

-- Index pour recherche par session
CREATE INDEX idx_signature_proofs_session
ON signature_proofs(session_id);

-- Index pour recherche par participant
CREATE INDEX idx_signature_proofs_participant
ON signature_proofs(participant_id);

-- Commentaires
COMMENT ON TABLE signature_proofs IS 'Preuves cryptographiques de signature (eIDAS)';
COMMENT ON COLUMN signature_proofs.proof_id IS 'Format: SIG-YYYYMMDD-HHMMSS-RANDOM';
COMMENT ON COLUMN signature_proofs.metadata IS 'Métadonnées complètes conformes eIDAS';

-- ============================================================================
-- 5. TABLE: signature_audit_log (IMMUTABLE)
-- ============================================================================

CREATE TABLE signature_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- RÉFÉRENCES
  session_id UUID NOT NULL REFERENCES signature_sessions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES signature_participants(id) ON DELETE SET NULL,

  -- ACTION
  action signature_audit_action NOT NULL,

  -- CONTEXTE
  actor_id UUID REFERENCES profiles(id),  -- Qui a effectué l'action
  ip_address INET,
  user_agent TEXT,

  -- DONNÉES SUPPLÉMENTAIRES
  metadata JSONB,

  -- TIMESTAMP (immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche par session
CREATE INDEX idx_signature_audit_session
ON signature_audit_log(session_id);

-- Index pour recherche par action
CREATE INDEX idx_signature_audit_action
ON signature_audit_log(action);

-- Index pour recherche temporelle
CREATE INDEX idx_signature_audit_created
ON signature_audit_log(created_at);

-- RÈGLES D'IMMUTABILITÉ
CREATE RULE signature_audit_log_no_update
AS ON UPDATE TO signature_audit_log DO INSTEAD NOTHING;

CREATE RULE signature_audit_log_no_delete
AS ON DELETE TO signature_audit_log DO INSTEAD NOTHING;

-- Commentaires
COMMENT ON TABLE signature_audit_log IS 'Journal d''audit immutable des signatures';

-- ============================================================================
-- 6. TRIGGERS: Auto-update et workflow
-- ============================================================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_signature_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur signature_sessions
CREATE TRIGGER tr_signature_sessions_updated
BEFORE UPDATE ON signature_sessions
FOR EACH ROW
EXECUTE FUNCTION update_signature_timestamp();

-- Trigger sur signature_participants
CREATE TRIGGER tr_signature_participants_updated
BEFORE UPDATE ON signature_participants
FOR EACH ROW
EXECUTE FUNCTION update_signature_timestamp();

-- ============================================================================
-- 7. FONCTION: Vérifier si session complète
-- ============================================================================

CREATE OR REPLACE FUNCTION check_signature_session_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id UUID;
  v_total_participants INT;
  v_signed_participants INT;
  v_refused_participants INT;
BEGIN
  -- Récupérer session_id
  v_session_id := NEW.session_id;

  -- Compter les participants
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'signed'),
    COUNT(*) FILTER (WHERE status = 'refused')
  INTO v_total_participants, v_signed_participants, v_refused_participants
  FROM signature_participants
  WHERE session_id = v_session_id;

  -- Mettre à jour le statut de la session
  IF v_refused_participants > 0 THEN
    -- Au moins un refus
    UPDATE signature_sessions
    SET status = 'rejected', updated_at = NOW()
    WHERE id = v_session_id AND status NOT IN ('rejected', 'canceled');

  ELSIF v_signed_participants = v_total_participants THEN
    -- Tous ont signé
    UPDATE signature_sessions
    SET status = 'done', completed_at = NOW(), updated_at = NOW()
    WHERE id = v_session_id AND status = 'ongoing';

  ELSIF v_signed_participants > 0 THEN
    -- Au moins un a signé (mais pas tous)
    UPDATE signature_sessions
    SET status = 'ongoing', updated_at = NOW()
    WHERE id = v_session_id AND status IN ('pending', 'draft');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour vérifier completion
CREATE TRIGGER tr_check_signature_session_completion
AFTER UPDATE OF status ON signature_participants
FOR EACH ROW
WHEN (NEW.status IN ('signed', 'refused'))
EXECUTE FUNCTION check_signature_session_completion();

-- ============================================================================
-- 8. FONCTION: Synchroniser avec entités liées (lease, edl)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_signature_session_to_entity()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand une session est complète (done)
  IF NEW.status = 'done' AND OLD.status != 'done' THEN

    -- Synchroniser avec bail
    IF NEW.entity_type = 'lease' THEN
      UPDATE leases
      SET
        statut = CASE
          WHEN NEW.document_type = 'bail' THEN 'fully_signed'
          ELSE statut
        END,
        signature_completed_at = NOW(),
        updated_at = NOW()
      WHERE id = NEW.entity_id;

    -- Synchroniser avec EDL
    ELSIF NEW.entity_type = 'edl' THEN
      UPDATE edl
      SET
        status = 'signed',
        updated_at = NOW()
      WHERE id = NEW.entity_id;

      -- Si EDL d'entrée signé, activer le bail
      UPDATE leases l
      SET statut = 'active', updated_at = NOW()
      FROM edl e
      WHERE e.id = NEW.entity_id
        AND e.lease_id = l.id
        AND e.type = 'entree'
        AND l.statut = 'fully_signed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour synchronisation
CREATE TRIGGER tr_sync_signature_to_entity
AFTER UPDATE OF status ON signature_sessions
FOR EACH ROW
EXECUTE FUNCTION sync_signature_session_to_entity();

-- ============================================================================
-- 9. FONCTION: Générer token d'invitation
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_signature_invitation_token()
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Générer un token unique de 32 caractères
  v_token := encode(gen_random_bytes(24), 'base64');
  -- Remplacer caractères problématiques pour URL
  v_token := replace(replace(v_token, '+', '-'), '/', '_');
  RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. RLS POLICIES
-- ============================================================================

-- Activer RLS
ALTER TABLE signature_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role a accès total
CREATE POLICY "service_all_signature_sessions" ON signature_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_signature_participants" ON signature_participants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_signature_proofs" ON signature_proofs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_signature_audit_log" ON signature_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Propriétaires voient leurs sessions
CREATE POLICY "owner_select_signature_sessions" ON signature_sessions
  FOR SELECT TO authenticated
  USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Participants voient leurs sessions
CREATE POLICY "participant_select_signature_sessions" ON signature_sessions
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT session_id FROM signature_participants
    WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ));

-- Participants voient leurs propres données
CREATE POLICY "participant_select_own" ON signature_participants
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Participants peuvent mettre à jour leur signature
CREATE POLICY "participant_update_own" ON signature_participants
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Preuves visibles par participants de la session
CREATE POLICY "participant_select_proofs" ON signature_proofs
  FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT session_id FROM signature_participants
    WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ));

-- Audit visible par propriétaire
CREATE POLICY "owner_select_audit" ON signature_audit_log
  FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT id FROM signature_sessions
    WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ));

-- ============================================================================
-- 11. VUES UTILITAIRES
-- ============================================================================

-- Vue des sessions avec compteurs
CREATE OR REPLACE VIEW v_signature_sessions_summary AS
SELECT
  s.*,
  COUNT(p.id) AS total_participants,
  COUNT(p.id) FILTER (WHERE p.status = 'signed') AS signed_count,
  COUNT(p.id) FILTER (WHERE p.status = 'refused') AS refused_count,
  COUNT(p.id) FILTER (WHERE p.status = 'pending') AS pending_count
FROM signature_sessions s
LEFT JOIN signature_participants p ON p.session_id = s.id
GROUP BY s.id;

-- Vue des signatures en attente par utilisateur
CREATE OR REPLACE VIEW v_pending_signatures AS
SELECT
  p.*,
  s.name AS session_name,
  s.document_type,
  s.entity_type,
  s.entity_id,
  s.deadline,
  s.signature_level
FROM signature_participants p
JOIN signature_sessions s ON s.id = p.session_id
WHERE p.status IN ('pending', 'notified', 'opened')
  AND s.status IN ('pending', 'ongoing');

COMMENT ON VIEW v_signature_sessions_summary IS 'Sessions avec compteurs de participants';
COMMENT ON VIEW v_pending_signatures IS 'Signatures en attente par utilisateur';

-- ============================================================================
-- 12. DEPRECATION: Colonnes obsolètes
-- ============================================================================

-- Marquer colonnes Yousign comme obsolètes (ne pas supprimer pour compatibilité)
COMMENT ON COLUMN leases.yousign_signature_request_id IS
  'DEPRECATED (SOTA 2026): Utiliser signature_sessions.id à la place';
COMMENT ON COLUMN leases.yousign_document_id IS
  'DEPRECATED (SOTA 2026): Utiliser signature_sessions.source_document_id';
COMMENT ON COLUMN leases.signature_started_at IS
  'DEPRECATED (SOTA 2026): Utiliser signature_sessions.sent_at';
COMMENT ON COLUMN leases.signature_completed_at IS
  'DEPRECATED (SOTA 2026): Utiliser signature_sessions.completed_at';

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- PROCHAINES ÉTAPES (à faire dans migrations séparées):
--
-- 1. Migration des données existantes:
--    - lease_signers → signature_sessions + signature_participants
--    - signatures → signature_proofs
--    - edl_signatures → signature_sessions + signature_participants
--    - signature_requests → signature_sessions
--
-- 2. Mise à jour du code application:
--    - Services: lib/signatures/service.ts
--    - Routes API: app/api/signature/**
--    - Types: lib/supabase/database.types.ts
--
-- 3. Tests de régression:
--    - Flux signature bail
--    - Flux signature EDL
--    - Activation automatique bail après EDL
--
-- 4. Suppression anciennes tables (après période de transition):
--    - DROP TABLE signatures CASCADE;
--    - DROP TABLE signature_requests CASCADE;
--    - DROP TABLE signature_request_signers CASCADE;
--    - ALTER TABLE leases DROP COLUMN yousign_*;
-- ============================================================================


-- ========== 20260121000002_naming_normalization_fr_to_en.sql ==========
-- ============================================================================
-- P2: NORMALISATION DU NOMMAGE FR → EN (SOTA 2026)
-- ============================================================================
-- Date: 2026-01-21
-- Description: Migration progressive du nommage français vers anglais
-- Strategy: Add English aliases via views, keep original columns for backward compatibility
-- ============================================================================

-- ============================================================================
-- PHASE 1: CREATE VIEWS WITH ENGLISH COLUMN NAMES
-- These views provide English-named access without breaking existing code
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 PROPERTIES VIEW (biens)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_properties_en AS
SELECT
  id,
  owner_id,
  unique_code,
  type,
  -- Address fields
  adresse_complete AS full_address,
  code_postal AS postal_code,
  ville AS city,
  departement AS department_code,
  pays AS country,
  -- Property details
  surface AS area_sqm,
  nb_pieces AS room_count,
  etage AS floor_number,
  ascenseur AS has_elevator,
  meuble AS is_furnished,
  -- Financial
  loyer_base AS base_rent,
  loyer_hc AS rent_excluding_charges,
  charges_mensuelles AS monthly_charges,
  depot_garantie AS security_deposit,
  -- Energy
  energie AS energy_class,
  ges AS ghg_class,
  dpe_classe_energie AS dpe_energy_class,
  dpe_classe_climat AS dpe_climate_class,
  dpe_date AS dpe_date,
  dpe_numero AS dpe_number,
  -- Rent control
  zone_encadrement AS rent_control_zone,
  loyer_reference AS reference_rent,
  loyer_reference_majore AS max_reference_rent,
  complement_loyer AS rent_supplement,
  encadrement_applicable AS rent_control_applicable,
  -- Building
  annee_construction AS construction_year,
  nom_residence AS residence_name,
  batiment AS building,
  escalier AS staircase,
  numero_lot AS lot_number,
  -- Syndic
  syndic_name AS property_manager_name,
  syndic_email AS property_manager_email,
  syndic_phone AS property_manager_phone,
  -- Status
  etat AS status,
  deleted_at,
  created_at,
  updated_at
FROM properties;

COMMENT ON VIEW v_properties_en IS 'English-named view for properties table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.2 PROFILES VIEW (utilisateurs)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_profiles_en AS
SELECT
  id,
  user_id,
  role,
  -- Identity
  prenom AS first_name,
  nom AS last_name,
  email,
  telephone AS phone,
  -- Birth info
  date_naissance AS birth_date,
  lieu_naissance AS birth_place,
  nationalite AS nationality,
  -- Address
  adresse AS address,
  adresse_complement AS address_line2,
  code_postal AS postal_code,
  ville AS city,
  pays AS country,
  -- Professional
  siret,
  raison_sociale AS company_name,
  -- Account
  avatar_url,
  account_status,
  two_factor_enabled,
  suspended_at,
  suspended_reason,
  -- Timestamps
  created_at,
  updated_at
FROM profiles;

COMMENT ON VIEW v_profiles_en IS 'English-named view for profiles table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.3 LEASES VIEW (baux)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_leases_en AS
SELECT
  id,
  property_id,
  unit_id,
  -- Type
  type_bail AS lease_type,
  -- Financial
  loyer AS rent_amount,
  charges_forfaitaires AS fixed_charges,
  charges_type AS charges_type,
  depot_de_garantie AS security_deposit,
  prorata_first_month AS first_month_prorata,
  -- Dates
  date_debut AS start_date,
  date_fin AS end_date,
  date_signature AS signature_date,
  -- Status
  statut AS status,
  -- Indexation
  indexation_enabled AS indexation_enabled,
  dernier_indice_ref AS last_reference_index,
  date_derniere_revision AS last_revision_date,
  -- Rent control
  encadrement_applicable AS rent_control_applicable,
  loyer_reference_majore AS max_reference_rent,
  complement_loyer AS rent_supplement,
  justification_complement AS supplement_justification,
  -- Documents
  pdf_url AS lease_pdf_url,
  pdf_signed_url AS signed_lease_pdf_url,
  -- Colocation
  coloc_config AS shared_housing_config,
  -- Invitation
  invite_token,
  invite_token_expires_at,
  tenant_email_pending AS pending_tenant_email,
  tenant_name_pending AS pending_tenant_name,
  -- Identity verification
  tenant_identity_verified,
  tenant_identity_method,
  tenant_identity_data,
  -- Yousign integration
  yousign_signature_request_id,
  yousign_document_id,
  signature_started_at,
  signature_completed_at,
  signature_status,
  -- Timestamps
  created_at,
  updated_at
FROM leases;

COMMENT ON VIEW v_leases_en IS 'English-named view for leases table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.4 INVOICES VIEW (factures)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_invoices_en AS
SELECT
  id,
  lease_id,
  owner_id,
  tenant_id,
  -- Period
  periode AS period,
  -- Amounts
  montant_loyer AS rent_amount,
  montant_charges AS charges_amount,
  montant_tva AS vat_amount,
  tva_taux AS vat_rate,
  montant_total AS total_amount,
  -- Status
  statut AS status,
  -- Dates
  date_echeance AS due_date,
  date_paiement AS payment_date,
  date_envoi AS sent_date,
  -- Reference
  invoice_number,
  -- Timestamps
  created_at,
  updated_at
FROM invoices;

COMMENT ON VIEW v_invoices_en IS 'English-named view for invoices table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.5 PAYMENTS VIEW (paiements)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_payments_en AS
SELECT
  id,
  invoice_id,
  -- Amount
  montant AS amount,
  -- Method
  moyen AS payment_method,
  -- Status
  statut AS status,
  -- Provider
  provider_ref AS provider_reference,
  -- Dates
  date_paiement AS payment_date,
  -- Reference
  reference,
  -- Timestamps
  created_at
FROM payments;

COMMENT ON VIEW v_payments_en IS 'English-named view for payments table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.6 CHARGES VIEW (charges récurrentes)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_charges_en AS
SELECT
  id,
  property_id,
  -- Type and description
  type,
  libelle AS label,
  description,
  -- Amount
  montant AS amount,
  -- Frequency
  periodicite AS frequency,
  jour_prelevement AS billing_day,
  -- Tenant recharge
  refacturable_locataire AS rechargeable_to_tenant,
  pourcentage_refacturable AS rechargeable_percentage,
  -- Dates
  date_debut AS start_date,
  date_fin AS end_date,
  -- Status
  is_active,
  -- Timestamps
  created_at,
  updated_at
FROM charges;

COMMENT ON VIEW v_charges_en IS 'English-named view for charges table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.7 TICKETS VIEW (interventions)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tickets_en AS
SELECT
  id,
  property_id,
  lease_id,
  created_by,
  assigned_to,
  -- Content
  titre AS title,
  description,
  -- Priority and status
  priorite AS priority,
  statut AS status,
  -- Category
  categorie AS category,
  sous_categorie AS subcategory,
  -- Location
  localisation AS location,
  -- Resolution
  date_resolution AS resolution_date,
  resolution_notes,
  -- Timestamps
  created_at,
  updated_at
FROM tickets;

COMMENT ON VIEW v_tickets_en IS 'English-named view for tickets table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.8 EDL VIEW (états des lieux)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inspections_en AS
SELECT
  id,
  lease_id,
  -- Type
  type,
  -- Status
  status,
  -- Dates
  scheduled_date,
  completed_date AS completion_date,
  -- Creator
  created_by,
  -- Timestamps
  created_at,
  updated_at
FROM edl;

COMMENT ON VIEW v_inspections_en IS 'English-named view for edl (inspections) table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.9 EDL_ITEMS VIEW (éléments d'état des lieux)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inspection_items_en AS
SELECT
  id,
  edl_id AS inspection_id,
  -- Location
  room_name,
  item_name,
  -- Assessment
  condition,
  notes AS comments,
  -- Timestamps
  created_at
FROM edl_items;

COMMENT ON VIEW v_inspection_items_en IS 'English-named view for edl_items (inspection_items) table (P2 SOTA 2026)';

-- ============================================================================
-- PHASE 2: CREATE TRANSLATION FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Status translation function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION translate_status_fr_to_en(status_fr TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE status_fr
    -- Lease statuses
    WHEN 'brouillon' THEN 'draft'
    WHEN 'en_attente_signature' THEN 'pending_signature'
    WHEN 'partiellement_signe' THEN 'partially_signed'
    WHEN 'signe' THEN 'fully_signed'
    WHEN 'actif' THEN 'active'
    WHEN 'conge_donne' THEN 'notice_given'
    WHEN 'termine' THEN 'terminated'
    WHEN 'archive' THEN 'archived'
    -- Invoice statuses
    WHEN 'envoyee' THEN 'sent'
    WHEN 'payee' THEN 'paid'
    WHEN 'en_retard' THEN 'overdue'
    WHEN 'annulee' THEN 'cancelled'
    -- Payment statuses
    WHEN 'en_attente' THEN 'pending'
    WHEN 'reussi' THEN 'succeeded'
    WHEN 'echoue' THEN 'failed'
    WHEN 'rembourse' THEN 'refunded'
    -- Ticket statuses
    WHEN 'ouvert' THEN 'open'
    WHEN 'en_cours' THEN 'in_progress'
    WHEN 'en_pause' THEN 'paused'
    WHEN 'resolu' THEN 'resolved'
    WHEN 'ferme' THEN 'closed'
    -- Default: return original
    ELSE status_fr
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION translate_status_fr_to_en IS 'Translates French status values to English (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 2.2 Property type translation function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION translate_property_type_fr_to_en(type_fr TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE type_fr
    WHEN 'appartement' THEN 'apartment'
    WHEN 'maison' THEN 'house'
    WHEN 'studio' THEN 'studio'
    WHEN 'colocation' THEN 'shared_housing'
    WHEN 'saisonnier' THEN 'seasonal'
    WHEN 'local_commercial' THEN 'commercial'
    WHEN 'bureaux' THEN 'office'
    WHEN 'parking' THEN 'parking'
    WHEN 'cave' THEN 'cellar'
    WHEN 'garage' THEN 'garage'
    ELSE type_fr
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION translate_property_type_fr_to_en IS 'Translates French property types to English (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 2.3 Lease type translation function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION translate_lease_type_fr_to_en(type_fr TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE type_fr
    WHEN 'nu' THEN 'unfurnished'
    WHEN 'meuble' THEN 'furnished'
    WHEN 'colocation' THEN 'shared'
    WHEN 'saisonnier' THEN 'seasonal'
    WHEN 'bail_mobilite' THEN 'mobility'
    WHEN 'etudiant' THEN 'student'
    WHEN 'commercial_3_6_9' THEN 'commercial'
    ELSE type_fr
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION translate_lease_type_fr_to_en IS 'Translates French lease types to English (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 2.4 Charge type translation function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION translate_charge_type_fr_to_en(type_fr TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE type_fr
    WHEN 'eau' THEN 'water'
    WHEN 'electricite' THEN 'electricity'
    WHEN 'gaz' THEN 'gas'
    WHEN 'copro' THEN 'condo_fees'
    WHEN 'taxe' THEN 'tax'
    WHEN 'ordures' THEN 'waste'
    WHEN 'assurance' THEN 'insurance'
    WHEN 'travaux' THEN 'repairs'
    WHEN 'entretien' THEN 'maintenance'
    WHEN 'autre' THEN 'other'
    ELSE type_fr
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION translate_charge_type_fr_to_en IS 'Translates French charge types to English (P2 SOTA 2026)';

-- ============================================================================
-- PHASE 3: CREATE MAPPING TABLE FOR DOCUMENTATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS _schema_translations (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_fr TEXT NOT NULL,
  column_en TEXT NOT NULL,
  data_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(table_name, column_fr)
);

COMMENT ON TABLE _schema_translations IS 'Documentation of FR→EN column name translations (P2 SOTA 2026)';

-- Insert translation mappings
INSERT INTO _schema_translations (table_name, column_fr, column_en, data_type, description) VALUES
  -- Properties
  ('properties', 'adresse_complete', 'full_address', 'TEXT', 'Complete street address'),
  ('properties', 'code_postal', 'postal_code', 'VARCHAR(5)', 'Postal/ZIP code'),
  ('properties', 'ville', 'city', 'TEXT', 'City name'),
  ('properties', 'departement', 'department_code', 'VARCHAR(3)', 'French department code'),
  ('properties', 'surface', 'area_sqm', 'NUMERIC', 'Area in square meters'),
  ('properties', 'nb_pieces', 'room_count', 'INTEGER', 'Number of rooms'),
  ('properties', 'etage', 'floor_number', 'INTEGER', 'Floor number'),
  ('properties', 'ascenseur', 'has_elevator', 'BOOLEAN', 'Building has elevator'),
  ('properties', 'meuble', 'is_furnished', 'BOOLEAN', 'Property is furnished'),
  ('properties', 'loyer_base', 'base_rent', 'NUMERIC', 'Base rent amount'),
  ('properties', 'charges_mensuelles', 'monthly_charges', 'NUMERIC', 'Monthly charges'),
  ('properties', 'depot_garantie', 'security_deposit', 'NUMERIC', 'Security deposit'),
  ('properties', 'etat', 'status', 'TEXT', 'Property status'),
  -- Profiles
  ('profiles', 'prenom', 'first_name', 'TEXT', 'First name'),
  ('profiles', 'nom', 'last_name', 'TEXT', 'Last name'),
  ('profiles', 'telephone', 'phone', 'TEXT', 'Phone number'),
  ('profiles', 'date_naissance', 'birth_date', 'DATE', 'Date of birth'),
  ('profiles', 'lieu_naissance', 'birth_place', 'VARCHAR(255)', 'Place of birth'),
  ('profiles', 'nationalite', 'nationality', 'VARCHAR(100)', 'Nationality'),
  ('profiles', 'adresse', 'address', 'TEXT', 'Street address'),
  ('profiles', 'raison_sociale', 'company_name', 'TEXT', 'Company name'),
  -- Leases
  ('leases', 'type_bail', 'lease_type', 'TEXT', 'Type of lease'),
  ('leases', 'loyer', 'rent_amount', 'NUMERIC', 'Rent amount'),
  ('leases', 'charges_forfaitaires', 'fixed_charges', 'NUMERIC', 'Fixed charges'),
  ('leases', 'depot_de_garantie', 'security_deposit', 'NUMERIC', 'Security deposit'),
  ('leases', 'date_debut', 'start_date', 'DATE', 'Lease start date'),
  ('leases', 'date_fin', 'end_date', 'DATE', 'Lease end date'),
  ('leases', 'statut', 'status', 'TEXT', 'Lease status'),
  -- Invoices
  ('invoices', 'periode', 'period', 'VARCHAR(7)', 'Billing period (YYYY-MM)'),
  ('invoices', 'montant_loyer', 'rent_amount', 'NUMERIC', 'Rent portion'),
  ('invoices', 'montant_charges', 'charges_amount', 'NUMERIC', 'Charges portion'),
  ('invoices', 'montant_total', 'total_amount', 'NUMERIC', 'Total amount'),
  ('invoices', 'statut', 'status', 'TEXT', 'Invoice status'),
  ('invoices', 'date_echeance', 'due_date', 'DATE', 'Payment due date'),
  -- Payments
  ('payments', 'montant', 'amount', 'NUMERIC', 'Payment amount'),
  ('payments', 'moyen', 'payment_method', 'TEXT', 'Payment method'),
  ('payments', 'statut', 'status', 'TEXT', 'Payment status'),
  ('payments', 'date_paiement', 'payment_date', 'TIMESTAMPTZ', 'Payment date'),
  -- Charges
  ('charges', 'libelle', 'label', 'TEXT', 'Charge label'),
  ('charges', 'montant', 'amount', 'NUMERIC', 'Charge amount'),
  ('charges', 'periodicite', 'frequency', 'TEXT', 'Billing frequency'),
  ('charges', 'refacturable_locataire', 'rechargeable_to_tenant', 'BOOLEAN', 'Can be charged to tenant'),
  -- Tickets
  ('tickets', 'titre', 'title', 'TEXT', 'Ticket title'),
  ('tickets', 'priorite', 'priority', 'TEXT', 'Priority level'),
  ('tickets', 'statut', 'status', 'TEXT', 'Ticket status'),
  ('tickets', 'categorie', 'category', 'TEXT', 'Category'),
  ('tickets', 'localisation', 'location', 'TEXT', 'Location in property')
ON CONFLICT (table_name, column_fr) DO NOTHING;

-- ============================================================================
-- PHASE 4: CREATE TYPE MAPPING FOR TYPESCRIPT GENERATION
-- ============================================================================

-- Create a function to generate TypeScript interface from view
CREATE OR REPLACE FUNCTION generate_typescript_interface(view_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
  col RECORD;
  ts_type TEXT;
BEGIN
  result := 'export interface ' || initcap(replace(view_name, 'v_', '')) || 'Row {' || E'\n';

  FOR col IN
    SELECT
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = view_name
    ORDER BY ordinal_position
  LOOP
    -- Map SQL types to TypeScript
    ts_type := CASE
      WHEN col.data_type IN ('uuid', 'text', 'character varying', 'varchar', 'char') THEN 'string'
      WHEN col.data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'decimal', 'real', 'double precision') THEN 'number'
      WHEN col.data_type = 'boolean' THEN 'boolean'
      WHEN col.data_type IN ('timestamp with time zone', 'timestamp without time zone', 'date', 'time') THEN 'string'
      WHEN col.data_type = 'jsonb' OR col.data_type = 'json' THEN 'Record<string, unknown>'
      WHEN col.data_type = 'inet' THEN 'string'
      ELSE 'unknown'
    END;

    -- Add nullable marker
    IF col.is_nullable = 'YES' THEN
      ts_type := ts_type || ' | null';
    END IF;

    result := result || '  ' || col.column_name || ': ' || ts_type || ';' || E'\n';
  END LOOP;

  result := result || '}';

  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_typescript_interface IS 'Generates TypeScript interface from view definition (P2 SOTA 2026)';

-- ============================================================================
-- PHASE 5: GRANTS FOR VIEWS
-- ============================================================================

-- Grant select on all views to authenticated users
GRANT SELECT ON v_properties_en TO authenticated;
GRANT SELECT ON v_profiles_en TO authenticated;
GRANT SELECT ON v_leases_en TO authenticated;
GRANT SELECT ON v_invoices_en TO authenticated;
GRANT SELECT ON v_payments_en TO authenticated;
GRANT SELECT ON v_charges_en TO authenticated;
GRANT SELECT ON v_tickets_en TO authenticated;
GRANT SELECT ON v_inspections_en TO authenticated;
GRANT SELECT ON v_inspection_items_en TO authenticated;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON SCHEMA public IS 'P2 SOTA 2026: Added English-named views for all major tables.
Use v_*_en views for English column names while maintaining backward compatibility with original tables.

Views available:
- v_properties_en
- v_profiles_en
- v_leases_en
- v_invoices_en
- v_payments_en
- v_charges_en
- v_tickets_en
- v_inspections_en
- v_inspection_items_en

Translation functions:
- translate_status_fr_to_en(status)
- translate_property_type_fr_to_en(type)
- translate_lease_type_fr_to_en(type)
- translate_charge_type_fr_to_en(type)

See _schema_translations table for complete column mappings.';


-- ========== 20260121000003_event_sourcing_audit_system.sql ==========
-- ============================================================================
-- P4: EVENT SOURCING & AUDIT SYSTEM (SOTA 2026)
-- ============================================================================
-- Date: 2026-01-21
-- Description: Complete event sourcing implementation with immutable audit trail
-- Features:
--   - Partitioned audit_events table for performance
--   - Automatic event capture via triggers
--   - Actor tracking (user, system, webhook, cron)
--   - Full payload capture with before/after states
--   - Compliance-ready (GDPR, legal retention)
-- ============================================================================

-- ============================================================================
-- PHASE 1: ENUM TYPES
-- ============================================================================

-- Actor types (who performed the action)
CREATE TYPE audit_actor_type AS ENUM (
  'user',           -- Authenticated user action
  'system',         -- System/application action
  'webhook',        -- External webhook callback
  'cron',           -- Scheduled job
  'migration',      -- Database migration
  'admin',          -- Admin override
  'anonymous'       -- Unauthenticated action
);

-- Event categories for grouping
CREATE TYPE audit_event_category AS ENUM (
  'auth',           -- Authentication events
  'property',       -- Property management
  'lease',          -- Lease lifecycle
  'signature',      -- Signature events
  'inspection',     -- EDL events
  'financial',      -- Invoices, payments
  'tenant',         -- Tenant management
  'ticket',         -- Support tickets
  'document',       -- Document operations
  'communication',  -- Messages, notifications
  'admin',          -- Admin operations
  'gdpr',           -- Privacy/GDPR events
  'system'          -- System events
);

-- ============================================================================
-- PHASE 2: MAIN AUDIT_EVENTS TABLE (PARTITIONED BY MONTH)
-- ============================================================================

CREATE TABLE audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Event identification
  event_type TEXT NOT NULL,              -- e.g., 'lease.created', 'payment.received'
  event_category audit_event_category NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,

  -- Actor information
  actor_type audit_actor_type NOT NULL DEFAULT 'user',
  actor_id UUID,                          -- Profile ID if user
  actor_email TEXT,                       -- For audit trail
  actor_role TEXT,                        -- Role at time of action

  -- Target entity
  entity_type TEXT NOT NULL,              -- e.g., 'lease', 'invoice', 'property'
  entity_id UUID NOT NULL,
  entity_name TEXT,                       -- Human-readable identifier

  -- Parent entity (for nested resources)
  parent_entity_type TEXT,
  parent_entity_id UUID,

  -- Payload
  payload JSONB NOT NULL DEFAULT '{}',
  old_values JSONB,                       -- Previous state (for updates)
  new_values JSONB,                       -- New state (for creates/updates)

  -- Context
  request_id UUID,                        -- Correlation ID
  session_id UUID,                        -- User session
  ip_address INET,
  user_agent TEXT,
  origin TEXT,                            -- 'web', 'mobile', 'api'

  -- Geolocation (optional)
  geo_country TEXT,
  geo_city TEXT,

  -- Timestamps (immutable)
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_time TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Partition key
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create comment
COMMENT ON TABLE audit_events IS 'Immutable event log for complete audit trail (P4 SOTA 2026). Partitioned by month for performance.';

-- ============================================================================
-- PHASE 3: CREATE PARTITIONS (2025-2027)
-- ============================================================================

-- 2025 partitions
CREATE TABLE audit_events_2025_01 PARTITION OF audit_events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE audit_events_2025_02 PARTITION OF audit_events
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE audit_events_2025_03 PARTITION OF audit_events
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE audit_events_2025_04 PARTITION OF audit_events
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE audit_events_2025_05 PARTITION OF audit_events
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE audit_events_2025_06 PARTITION OF audit_events
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE audit_events_2025_07 PARTITION OF audit_events
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE audit_events_2025_08 PARTITION OF audit_events
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE audit_events_2025_09 PARTITION OF audit_events
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE audit_events_2025_10 PARTITION OF audit_events
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE audit_events_2025_11 PARTITION OF audit_events
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE audit_events_2025_12 PARTITION OF audit_events
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- 2026 partitions
CREATE TABLE audit_events_2026_01 PARTITION OF audit_events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_events_2026_02 PARTITION OF audit_events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE audit_events_2026_03 PARTITION OF audit_events
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_events_2026_04 PARTITION OF audit_events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_events_2026_05 PARTITION OF audit_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit_events_2026_06 PARTITION OF audit_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_events_2026_07 PARTITION OF audit_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE audit_events_2026_08 PARTITION OF audit_events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE audit_events_2026_09 PARTITION OF audit_events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE audit_events_2026_10 PARTITION OF audit_events
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE audit_events_2026_11 PARTITION OF audit_events
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE audit_events_2026_12 PARTITION OF audit_events
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- 2027 partitions (first half)
CREATE TABLE audit_events_2027_01 PARTITION OF audit_events
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE audit_events_2027_02 PARTITION OF audit_events
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE audit_events_2027_03 PARTITION OF audit_events
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE audit_events_2027_04 PARTITION OF audit_events
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE audit_events_2027_05 PARTITION OF audit_events
  FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');
CREATE TABLE audit_events_2027_06 PARTITION OF audit_events
  FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

-- Default partition for future dates
CREATE TABLE audit_events_future PARTITION OF audit_events
  FOR VALUES FROM ('2027-07-01') TO (MAXVALUE);

-- ============================================================================
-- PHASE 4: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX idx_audit_events_entity ON audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_events_actor ON audit_events (actor_id, created_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_events_type ON audit_events (event_type, created_at DESC);
CREATE INDEX idx_audit_events_category ON audit_events (event_category, created_at DESC);

-- Time-based indexes
CREATE INDEX idx_audit_events_occurred ON audit_events (occurred_at DESC);
CREATE INDEX idx_audit_events_request ON audit_events (request_id) WHERE request_id IS NOT NULL;

-- Full-text search on payload
CREATE INDEX idx_audit_events_payload_gin ON audit_events USING gin (payload jsonb_path_ops);

-- ============================================================================
-- PHASE 5: IMMUTABILITY RULES
-- ============================================================================

-- Prevent updates
CREATE RULE audit_events_no_update AS ON UPDATE TO audit_events
DO INSTEAD NOTHING;

-- Prevent deletes (except for GDPR compliance - admin only)
CREATE OR REPLACE FUNCTION check_audit_delete_permission()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow delete via explicit GDPR erasure function
  IF current_setting('app.audit_gdpr_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Direct deletion of audit_events is prohibited. Use gdpr_erase_user_data() function.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_events_prevent_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION check_audit_delete_permission();

-- ============================================================================
-- PHASE 6: HELPER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 Record audit event (main function)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_audit_event(
  p_event_type TEXT,
  p_event_category audit_event_category,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_payload JSONB DEFAULT '{}',
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_parent_entity_type TEXT DEFAULT NULL,
  p_parent_entity_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_event_id UUID;
BEGIN
  -- Get current user context
  v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
  v_actor_email := current_setting('app.current_user_email', true);
  v_actor_role := current_setting('app.current_user_role', true);

  INSERT INTO audit_events (
    event_type,
    event_category,
    actor_type,
    actor_id,
    actor_email,
    actor_role,
    entity_type,
    entity_id,
    entity_name,
    parent_entity_type,
    parent_entity_id,
    payload,
    old_values,
    new_values,
    request_id,
    ip_address,
    user_agent
  ) VALUES (
    p_event_type,
    p_event_category,
    CASE
      WHEN v_actor_id IS NOT NULL THEN 'user'::audit_actor_type
      WHEN current_setting('app.cron_job', true) = 'true' THEN 'cron'::audit_actor_type
      WHEN current_setting('app.webhook', true) = 'true' THEN 'webhook'::audit_actor_type
      ELSE 'system'::audit_actor_type
    END,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_parent_entity_type,
    p_parent_entity_id,
    p_payload,
    p_old_values,
    p_new_values,
    NULLIF(current_setting('app.request_id', true), '')::UUID,
    NULLIF(current_setting('app.ip_address', true), '')::INET,
    current_setting('app.user_agent', true)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_audit_event IS 'Records an audit event with full context (P4 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 6.2 Get entity history
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_entity_history(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  event_id UUID,
  event_type TEXT,
  event_category audit_event_category,
  actor_email TEXT,
  actor_role TEXT,
  payload JSONB,
  old_values JSONB,
  new_values JSONB,
  occurred_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    ae.event_type,
    ae.event_category,
    ae.actor_email,
    ae.actor_role,
    ae.payload,
    ae.old_values,
    ae.new_values,
    ae.occurred_at
  FROM audit_events ae
  WHERE ae.entity_type = p_entity_type
    AND ae.entity_id = p_entity_id
  ORDER BY ae.occurred_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_entity_history IS 'Retrieves audit history for a specific entity (P4 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 6.3 Get user activity
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_activity(
  p_user_id UUID,
  p_from_date TIMESTAMPTZ DEFAULT now() - interval '30 days',
  p_to_date TIMESTAMPTZ DEFAULT now(),
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  event_id UUID,
  event_type TEXT,
  event_category audit_event_category,
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  occurred_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    ae.event_type,
    ae.event_category,
    ae.entity_type,
    ae.entity_id,
    ae.entity_name,
    ae.occurred_at
  FROM audit_events ae
  WHERE ae.actor_id = p_user_id
    AND ae.occurred_at BETWEEN p_from_date AND p_to_date
  ORDER BY ae.occurred_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_user_activity IS 'Retrieves audit activity for a specific user (P4 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 6.4 GDPR data export
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gdpr_export_user_audit_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'exported_at', now(),
    'events', COALESCE(jsonb_agg(
      jsonb_build_object(
        'event_type', event_type,
        'entity_type', entity_type,
        'entity_id', entity_id,
        'payload', payload,
        'occurred_at', occurred_at
      ) ORDER BY occurred_at
    ), '[]'::jsonb)
  ) INTO v_result
  FROM audit_events
  WHERE actor_id = p_user_id;

  -- Record the export itself
  PERFORM record_audit_event(
    'gdpr.data_exported',
    'gdpr',
    'profile',
    p_user_id,
    jsonb_build_object('event_count', (v_result->'events')::jsonb)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION gdpr_export_user_audit_data IS 'Exports all audit data for a user (GDPR compliance)';

-- ----------------------------------------------------------------------------
-- 6.5 GDPR data erasure (pseudonymization)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gdpr_erase_user_data(p_user_id UUID, p_reason TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Enable delete permission
  PERFORM set_config('app.audit_gdpr_delete', 'true', true);

  -- Pseudonymize actor information in audit events
  UPDATE audit_events
  SET
    actor_email = 'GDPR_ERASED_' || substring(actor_id::text, 1, 8),
    actor_role = 'erased',
    payload = payload - 'email' - 'name' - 'phone' - 'address',
    ip_address = NULL,
    user_agent = NULL
  WHERE actor_id = p_user_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Record the erasure
  PERFORM record_audit_event(
    'gdpr.data_erased',
    'gdpr',
    'profile',
    p_user_id,
    jsonb_build_object(
      'reason', p_reason,
      'events_affected', v_count
    )
  );

  -- Reset delete permission
  PERFORM set_config('app.audit_gdpr_delete', 'false', true);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION gdpr_erase_user_data IS 'Pseudonymizes user data in audit events (GDPR compliance)';

-- ============================================================================
-- PHASE 7: AUTOMATIC AUDIT TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7.1 Generic audit trigger function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_category audit_event_category;
  v_entity_name TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Determine event type
  v_event_type := TG_TABLE_NAME || '.' || lower(TG_OP);

  -- Determine category based on table
  v_category := CASE TG_TABLE_NAME
    WHEN 'profiles' THEN 'auth'
    WHEN 'properties' THEN 'property'
    WHEN 'leases' THEN 'lease'
    WHEN 'signature_sessions' THEN 'signature'
    WHEN 'signature_participants' THEN 'signature'
    WHEN 'edl' THEN 'inspection'
    WHEN 'invoices' THEN 'financial'
    WHEN 'payments' THEN 'financial'
    WHEN 'tickets' THEN 'ticket'
    WHEN 'documents' THEN 'document'
    WHEN 'chat_messages' THEN 'communication'
    ELSE 'system'
  END;

  -- Build values based on operation
  IF TG_OP = 'DELETE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
    v_entity_name := COALESCE(
      OLD.name,
      OLD.titre,
      OLD.title,
      OLD.email,
      OLD.id::TEXT
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    v_entity_name := COALESCE(
      NEW.name,
      NEW.titre,
      NEW.title,
      NEW.email,
      NEW.id::TEXT
    );
  ELSE -- INSERT
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
    v_entity_name := COALESCE(
      NEW.name,
      NEW.titre,
      NEW.title,
      NEW.email,
      NEW.id::TEXT
    );
  END IF;

  -- Record the event
  PERFORM record_audit_event(
    v_event_type,
    v_category,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object('trigger', TG_NAME, 'operation', TG_OP),
    v_old_values,
    v_new_values,
    v_entity_name
  );

  -- Return appropriate row
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_trigger_function IS 'Generic trigger function for automatic audit logging (P4 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 7.2 Create audit triggers for main tables
-- ----------------------------------------------------------------------------

-- Properties
DROP TRIGGER IF EXISTS trg_audit_properties ON properties;
CREATE TRIGGER trg_audit_properties
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Leases
DROP TRIGGER IF EXISTS trg_audit_leases ON leases;
CREATE TRIGGER trg_audit_leases
  AFTER INSERT OR UPDATE OR DELETE ON leases
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Invoices
DROP TRIGGER IF EXISTS trg_audit_invoices ON invoices;
CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Payments
DROP TRIGGER IF EXISTS trg_audit_payments ON payments;
CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Signature sessions (P1)
DROP TRIGGER IF EXISTS trg_audit_signature_sessions ON signature_sessions;
CREATE TRIGGER trg_audit_signature_sessions
  AFTER INSERT OR UPDATE OR DELETE ON signature_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- EDL
DROP TRIGGER IF EXISTS trg_audit_edl ON edl;
CREATE TRIGGER trg_audit_edl
  AFTER INSERT OR UPDATE OR DELETE ON edl
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Tickets
DROP TRIGGER IF EXISTS trg_audit_tickets ON tickets;
CREATE TRIGGER trg_audit_tickets
  AFTER INSERT OR UPDATE OR DELETE ON tickets
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- PHASE 8: STATISTICS VIEWS
-- ============================================================================

-- Daily event summary
CREATE OR REPLACE VIEW v_audit_daily_stats AS
SELECT
  date_trunc('day', occurred_at) AS day,
  event_category,
  count(*) AS event_count,
  count(DISTINCT actor_id) AS unique_actors,
  count(DISTINCT entity_id) AS unique_entities
FROM audit_events
WHERE occurred_at > now() - interval '90 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

COMMENT ON VIEW v_audit_daily_stats IS 'Daily audit event statistics (P4 SOTA 2026)';

-- Event type distribution
CREATE OR REPLACE VIEW v_audit_event_distribution AS
SELECT
  event_type,
  event_category,
  count(*) AS total_count,
  count(*) FILTER (WHERE occurred_at > now() - interval '7 days') AS last_7_days,
  count(*) FILTER (WHERE occurred_at > now() - interval '30 days') AS last_30_days
FROM audit_events
GROUP BY event_type, event_category
ORDER BY total_count DESC;

COMMENT ON VIEW v_audit_event_distribution IS 'Audit event type distribution (P4 SOTA 2026)';

-- Recent high-impact events
CREATE OR REPLACE VIEW v_audit_recent_important AS
SELECT
  id,
  event_type,
  event_category,
  actor_email,
  entity_type,
  entity_id,
  entity_name,
  occurred_at
FROM audit_events
WHERE event_type IN (
  'lease.created',
  'lease.deleted',
  'payment.created',
  'signature_sessions.updated',
  'gdpr.data_exported',
  'gdpr.data_erased'
)
ORDER BY occurred_at DESC
LIMIT 100;

COMMENT ON VIEW v_audit_recent_important IS 'Recent high-impact audit events (P4 SOTA 2026)';

-- ============================================================================
-- PHASE 9: RLS POLICIES
-- ============================================================================

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Admins can see all events
CREATE POLICY audit_events_admin_all ON audit_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can see events they created
CREATE POLICY audit_events_own_events ON audit_events
  FOR SELECT
  TO authenticated
  USING (
    actor_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Users can see events for entities they own
CREATE POLICY audit_events_owned_entities ON audit_events
  FOR SELECT
  TO authenticated
  USING (
    -- Properties they own
    (entity_type = 'properties' AND entity_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    ))
    OR
    -- Leases they're part of
    (entity_type = 'leases' AND entity_id IN (
      SELECT id FROM leases WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    ))
  );

-- ============================================================================
-- PHASE 10: GRANTS
-- ============================================================================

-- Statistics views
GRANT SELECT ON v_audit_daily_stats TO authenticated;
GRANT SELECT ON v_audit_event_distribution TO authenticated;
GRANT SELECT ON v_audit_recent_important TO authenticated;

-- Functions
GRANT EXECUTE ON FUNCTION record_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION get_entity_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity TO authenticated;

-- GDPR functions (admin only)
REVOKE ALL ON FUNCTION gdpr_export_user_audit_data FROM PUBLIC;
REVOKE ALL ON FUNCTION gdpr_erase_user_data FROM PUBLIC;
-- Admin grant would be done separately

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE audit_events IS 'P4 SOTA 2026: Immutable event sourcing audit trail.

Features:
- Partitioned by month for performance
- Automatic event capture via triggers
- Full before/after state capture
- GDPR-compliant with export/erasure functions
- RLS policies for access control

Usage:
- Direct: INSERT into audit_events or use record_audit_event()
- Automatic: Triggers on main tables (properties, leases, invoices, etc.)
- Query: Use get_entity_history() or get_user_activity()
- Admin: v_audit_daily_stats, v_audit_event_distribution views

Event naming convention: {table}.{operation}
Examples: lease.created, payment.updated, signature_sessions.deleted';


-- ========== 20260122000000_receipt_performance_indexes.sql ==========
-- ============================================
-- MIGRATION: Performance Indexes for Receipts & Invoices
-- SOTA 2026 - Optimisation des requêtes quittances
-- ============================================

-- Index composite pour les recherches de factures par bail et période
-- Utilisé par: InvoicesService.getInvoicesByLease(), filtres période
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_lease_periode
  ON invoices(lease_id, periode DESC);

-- Index composite pour les recherches par propriétaire
-- Utilisé par: InvoicesService.getInvoicesByOwner(), dashboard propriétaire
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_owner_periode
  ON invoices(owner_id, periode DESC);

-- Index composite pour les recherches par locataire
-- Utilisé par: InvoicesService.getInvoicesByTenant(), dashboard locataire
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_tenant_periode
  ON invoices(tenant_id, periode DESC);

-- Index pour les factures impayées (filtre très fréquent)
-- Utilisé par: InvoicesService.getUnpaidInvoicesByLease(), relances
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_lease_unpaid
  ON invoices(lease_id, periode DESC)
  WHERE statut IN ('draft', 'sent', 'partial');

-- Index composite pour les paiements par facture et statut
-- Utilisé par: vérification des paiements réussis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_invoice_succeeded
  ON payments(invoice_id, statut)
  WHERE statut = 'succeeded';

-- Index composite pour les reçus espèces par propriétaire
-- Utilisé par: GET /api/payments/cash-receipt (liste propriétaire)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_receipts_owner_created
  ON cash_receipts(owner_id, created_at DESC);

-- Index composite pour les reçus espèces par locataire
-- Utilisé par: GET /api/payments/cash-receipt (liste locataire)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_receipts_tenant_created
  ON cash_receipts(tenant_id, created_at DESC);

-- Index pour les reçus par période (reporting mensuel)
-- Utilisé par: rapports et statistiques
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_receipts_periode
  ON cash_receipts(periode DESC, created_at DESC);

-- Index pour la recherche de numéro de reçu (unicité + recherche rapide)
-- Utilisé par: recherche par numéro de quittance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_receipts_receipt_number
  ON cash_receipts(receipt_number)
  WHERE receipt_number IS NOT NULL;

-- ============================================
-- COMMENTAIRES SUR LES INDEX
-- ============================================
COMMENT ON INDEX idx_invoices_lease_periode IS
  'SOTA 2026: Optimise getInvoicesByLease() - O(log n) vs O(n) scan';

COMMENT ON INDEX idx_invoices_owner_periode IS
  'SOTA 2026: Optimise dashboard propriétaire - filtres période';

COMMENT ON INDEX idx_invoices_tenant_periode IS
  'SOTA 2026: Optimise dashboard locataire - filtres période';

COMMENT ON INDEX idx_invoices_lease_unpaid IS
  'SOTA 2026: Partial index pour factures impayées - relances automatiques';

COMMENT ON INDEX idx_payments_invoice_succeeded IS
  'SOTA 2026: Partial index pour paiements réussis - calcul totaux';

COMMENT ON INDEX idx_cash_receipts_owner_created IS
  'SOTA 2026: Optimise liste reçus propriétaire - pagination';

COMMENT ON INDEX idx_cash_receipts_tenant_created IS
  'SOTA 2026: Optimise liste reçus locataire - pagination';


-- ========== 20260127000000_lease_types_and_inventory.sql ==========
-- ============================================
-- Migration: Types de baux complets + Inventaire mobilier
-- Date: 2026-01-27
-- Description: Ajout des types de baux manquants et de l'inventaire mobilier pour EDL
-- Conformité: Décret 2015-981, Loi ELAN, Code commerce, Code rural
-- ============================================

BEGIN;

-- ============================================
-- 1. MISE À JOUR DE LA CONTRAINTE TYPE_BAIL
-- ============================================

ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_type_bail_check;

ALTER TABLE leases ADD CONSTRAINT leases_type_bail_check
  CHECK (
    type_bail IN (
      -- Habitation
      'nu',
      'meuble',
      'colocation',
      'saisonnier',
      'bail_mobilite',
      'etudiant',
      'bail_mixte',
      -- Commercial
      'commercial_3_6_9',
      'commercial_derogatoire',
      'professionnel',
      'location_gerance',
      -- Stationnement
      'contrat_parking',
      -- Agricole
      'bail_rural'
    )
  );

COMMENT ON CONSTRAINT leases_type_bail_check ON leases IS
  'Types de baux légaux français - SSOT 2026 - Conforme ALUR, ELAN, Code commerce, Code rural';

-- ============================================
-- 2. TABLE INVENTAIRE MOBILIER (Décret 2015-981)
-- ============================================

CREATE TABLE IF NOT EXISTS edl_furniture_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_id UUID NOT NULL REFERENCES edl(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'signed')),
  completed_at TIMESTAMPTZ,

  -- Signatures
  signed_by_owner BOOLEAN DEFAULT FALSE,
  signed_by_tenant BOOLEAN DEFAULT FALSE,
  owner_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_edl_furniture_inventory_edl_id ON edl_furniture_inventory(edl_id);
CREATE INDEX IF NOT EXISTS idx_edl_furniture_inventory_lease_id ON edl_furniture_inventory(lease_id);

COMMENT ON TABLE edl_furniture_inventory IS
  'Inventaire mobilier pour baux meublés - Décret n°2015-981 du 31 juillet 2015';

-- ============================================
-- 3. ÉLÉMENTS OBLIGATOIRES DU MOBILIER
-- ============================================

CREATE TABLE IF NOT EXISTS edl_mandatory_furniture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES edl_furniture_inventory(id) ON DELETE CASCADE,

  -- Clé de l'élément obligatoire (conforme au décret)
  item_key TEXT NOT NULL CHECK (
    item_key IN (
      'literie_couette_couverture',
      'volets_rideaux_chambres',
      'plaques_cuisson',
      'four_ou_micro_ondes',
      'refrigerateur_congelateur',
      'vaisselle_ustensiles',
      'table_sieges',
      'rangements',
      'luminaires',
      'materiel_entretien'
    )
  ),

  -- État de l'élément
  present BOOLEAN NOT NULL DEFAULT FALSE,
  quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
  condition TEXT CHECK (condition IN ('neuf', 'bon_etat', 'usage', 'mauvais_etat')),
  notes TEXT,
  photo_url TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(inventory_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_edl_mandatory_furniture_inventory_id ON edl_mandatory_furniture(inventory_id);

COMMENT ON TABLE edl_mandatory_furniture IS
  'Éléments obligatoires selon Article 25-4 de la loi du 6 juillet 1989';

-- ============================================
-- 4. MOBILIER SUPPLÉMENTAIRE
-- ============================================

CREATE TABLE IF NOT EXISTS edl_additional_furniture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES edl_furniture_inventory(id) ON DELETE CASCADE,

  -- Description
  designation TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  condition TEXT NOT NULL CHECK (condition IN ('neuf', 'bon_etat', 'usage', 'mauvais_etat')),
  room TEXT,
  notes TEXT,
  photo_url TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_additional_furniture_inventory_id ON edl_additional_furniture(inventory_id);

COMMENT ON TABLE edl_additional_furniture IS
  'Mobilier supplémentaire au-delà des éléments obligatoires';

-- ============================================
-- 5. DIAGNOSTICS DOM-TOM
-- ============================================

-- Table pour les diagnostics termites (obligatoire en DOM-TOM)
CREATE TABLE IF NOT EXISTS property_diagnostic_termites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Informations diagnostiqueur
  diagnostiqueur_nom TEXT NOT NULL,
  diagnostiqueur_certification TEXT,

  -- Dates
  date_realisation DATE NOT NULL,
  date_validite DATE NOT NULL, -- 6 mois de validité

  -- Résultats
  presence_termites BOOLEAN NOT NULL DEFAULT FALSE,
  zones_infestees JSONB, -- Liste des zones affectées
  traitement_realise BOOLEAN DEFAULT FALSE,
  date_traitement DATE,
  type_traitement TEXT,

  -- Localisation
  departement TEXT NOT NULL, -- Code département (971, 972, 973, 974, 976)

  -- Document
  document_url TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_diagnostic_termites_property_id ON property_diagnostic_termites(property_id);
CREATE INDEX IF NOT EXISTS idx_property_diagnostic_termites_departement ON property_diagnostic_termites(departement);

COMMENT ON TABLE property_diagnostic_termites IS
  'Diagnostic termites obligatoire en DOM-TOM et zones infestées métropole';

-- Table pour les risques naturels spécifiques DOM-TOM
CREATE TABLE IF NOT EXISTS property_risques_naturels_domtom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Dates
  date_realisation DATE NOT NULL,

  -- Risque cyclonique
  zone_cyclonique TEXT CHECK (zone_cyclonique IN ('forte', 'moyenne', 'faible')),
  construction_paracyclonique BOOLEAN,

  -- Risque sismique (zones 3, 4, 5 pour DOM-TOM)
  zone_sismique TEXT CHECK (zone_sismique IN ('3', '4', '5')),
  norme_parasismique BOOLEAN,

  -- Risque volcanique
  zone_volcanique BOOLEAN DEFAULT FALSE,
  proximite_volcan_actif BOOLEAN DEFAULT FALSE,

  -- Risque tsunami
  zone_tsunami BOOLEAN DEFAULT FALSE,

  -- Mouvements de terrain
  zone_mouvement_terrain BOOLEAN DEFAULT FALSE,
  type_mouvement TEXT CHECK (type_mouvement IN ('glissement', 'eboulement', 'affaissement')),

  -- Inondations
  zone_inondation BOOLEAN DEFAULT FALSE,
  niveau_risque_inondation TEXT CHECK (niveau_risque_inondation IN ('fort', 'moyen', 'faible')),

  -- Document
  document_url TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_risques_naturels_domtom_property_id ON property_risques_naturels_domtom(property_id);

COMMENT ON TABLE property_risques_naturels_domtom IS
  'Risques naturels spécifiques aux DOM-TOM (cyclones, séismes, volcans, tsunamis)';

-- ============================================
-- 6. FONCTION POUR INITIALISER L'INVENTAIRE
-- ============================================

CREATE OR REPLACE FUNCTION initialize_furniture_inventory(p_edl_id UUID, p_lease_id UUID)
RETURNS UUID AS $$
DECLARE
  v_inventory_id UUID;
  v_item_key TEXT;
BEGIN
  -- Créer l'inventaire
  INSERT INTO edl_furniture_inventory (edl_id, lease_id)
  VALUES (p_edl_id, p_lease_id)
  ON CONFLICT (edl_id) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_inventory_id;

  -- Initialiser les éléments obligatoires
  FOR v_item_key IN
    SELECT unnest(ARRAY[
      'literie_couette_couverture',
      'volets_rideaux_chambres',
      'plaques_cuisson',
      'four_ou_micro_ondes',
      'refrigerateur_congelateur',
      'vaisselle_ustensiles',
      'table_sieges',
      'rangements',
      'luminaires',
      'materiel_entretien'
    ])
  LOOP
    INSERT INTO edl_mandatory_furniture (inventory_id, item_key, present, quantity, condition)
    VALUES (v_inventory_id, v_item_key, FALSE, 1, 'bon_etat')
    ON CONFLICT (inventory_id, item_key) DO NOTHING;
  END LOOP;

  RETURN v_inventory_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initialize_furniture_inventory IS
  'Initialise un inventaire mobilier avec les 10 éléments obligatoires du décret 2015-981';

-- ============================================
-- 7. TRIGGER POUR MISE À JOUR AUTOMATIQUE
-- ============================================

CREATE OR REPLACE FUNCTION update_furniture_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_edl_furniture_inventory_updated ON edl_furniture_inventory;
CREATE TRIGGER trg_edl_furniture_inventory_updated
  BEFORE UPDATE ON edl_furniture_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_furniture_inventory_timestamp();

DROP TRIGGER IF EXISTS trg_edl_mandatory_furniture_updated ON edl_mandatory_furniture;
CREATE TRIGGER trg_edl_mandatory_furniture_updated
  BEFORE UPDATE ON edl_mandatory_furniture
  FOR EACH ROW
  EXECUTE FUNCTION update_furniture_inventory_timestamp();

DROP TRIGGER IF EXISTS trg_edl_additional_furniture_updated ON edl_additional_furniture;
CREATE TRIGGER trg_edl_additional_furniture_updated
  BEFORE UPDATE ON edl_additional_furniture
  FOR EACH ROW
  EXECUTE FUNCTION update_furniture_inventory_timestamp();

-- ============================================
-- 8. RLS POLICIES
-- ============================================

ALTER TABLE edl_furniture_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_mandatory_furniture ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_additional_furniture ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_diagnostic_termites ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_risques_naturels_domtom ENABLE ROW LEVEL SECURITY;

-- Policies pour edl_furniture_inventory
CREATE POLICY "Owners can manage furniture inventory for their leases" ON edl_furniture_inventory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = edl_furniture_inventory.lease_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view furniture inventory for their leases" ON edl_furniture_inventory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lease_signers ls
      WHERE ls.lease_id = edl_furniture_inventory.lease_id
      AND ls.profile_id = auth.uid()
    )
  );

-- Policies pour edl_mandatory_furniture
CREATE POLICY "Users can manage mandatory furniture via inventory" ON edl_mandatory_furniture
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM edl_furniture_inventory fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE fi.id = edl_mandatory_furniture.inventory_id
      AND (p.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id AND ls.profile_id = auth.uid()
      ))
    )
  );

-- Policies pour edl_additional_furniture
CREATE POLICY "Users can manage additional furniture via inventory" ON edl_additional_furniture
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM edl_furniture_inventory fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE fi.id = edl_additional_furniture.inventory_id
      AND (p.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id AND ls.profile_id = auth.uid()
      ))
    )
  );

-- Policies pour diagnostics termites
CREATE POLICY "Owners can manage termites diagnostics" ON property_diagnostic_termites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_diagnostic_termites.property_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view termites diagnostics" ON property_diagnostic_termites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON l.id = ls.lease_id
      WHERE l.property_id = property_diagnostic_termites.property_id
      AND ls.profile_id = auth.uid()
    )
  );

-- Policies pour risques naturels DOM-TOM
CREATE POLICY "Owners can manage risques naturels domtom" ON property_risques_naturels_domtom
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_risques_naturels_domtom.property_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view risques naturels domtom" ON property_risques_naturels_domtom
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON l.id = ls.lease_id
      WHERE l.property_id = property_risques_naturels_domtom.property_id
      AND ls.profile_id = auth.uid()
    )
  );

-- ============================================
-- 9. VÉRIFICATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260127000000_lease_types_and_inventory completed successfully';
  RAISE NOTICE 'New lease types: etudiant, bail_mixte, bail_rural added';
  RAISE NOTICE 'Furniture inventory tables created (Décret 2015-981)';
  RAISE NOTICE 'DOM-TOM diagnostics tables created (termites, risques naturels)';
END $$;

COMMIT;


-- ========== 20260127000000_stripe_connect_accounts.sql ==========
-- Migration: Stripe Connect pour les reversements aux propriétaires
-- Date: 2026-01-27
-- Description: Ajoute le support de Stripe Connect Express pour les paiements directs aux propriétaires

-- Table des comptes Stripe Connect
CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'express' CHECK (account_type IN ('express', 'standard', 'custom')),

  -- Statut du compte
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  details_submitted BOOLEAN DEFAULT FALSE,

  -- Informations KYC
  requirements_currently_due JSONB DEFAULT '[]',
  requirements_eventually_due JSONB DEFAULT '[]',
  requirements_past_due JSONB DEFAULT '[]',
  requirements_disabled_reason TEXT,

  -- Informations bancaires (masquées)
  bank_account_last4 TEXT,
  bank_account_bank_name TEXT,
  default_currency TEXT DEFAULT 'eur',

  -- Métadonnées
  business_type TEXT CHECK (business_type IN ('individual', 'company')),
  country TEXT DEFAULT 'FR',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  onboarding_completed_at TIMESTAMPTZ,

  CONSTRAINT unique_profile_connect UNIQUE (profile_id)
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_stripe_connect_profile ON stripe_connect_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_stripe_id ON stripe_connect_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_charges_enabled ON stripe_connect_accounts(charges_enabled) WHERE charges_enabled = TRUE;

-- Table des transferts vers les propriétaires
CREATE TABLE IF NOT EXISTS stripe_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connect_account_id UUID NOT NULL REFERENCES stripe_connect_accounts(id),
  payment_id UUID REFERENCES payments(id),
  invoice_id UUID REFERENCES invoices(id),

  -- Identifiants Stripe
  stripe_transfer_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,

  -- Montants
  amount INTEGER NOT NULL, -- en centimes
  currency TEXT DEFAULT 'eur',
  platform_fee INTEGER DEFAULT 0, -- commission Talok en centimes
  stripe_fee INTEGER DEFAULT 0, -- frais Stripe en centimes
  net_amount INTEGER NOT NULL, -- montant net pour le propriétaire

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'reversed')),
  failure_reason TEXT,

  -- Métadonnées
  description TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  CONSTRAINT positive_amounts CHECK (amount > 0 AND net_amount > 0)
);

-- Index pour les transferts
CREATE INDEX IF NOT EXISTS idx_transfers_connect ON stripe_transfers(connect_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_payment ON stripe_transfers(payment_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON stripe_transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_created ON stripe_transfers(created_at DESC);

-- RLS Policies
ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_transfers ENABLE ROW LEVEL SECURITY;

-- Propriétaires peuvent voir leur propre compte Connect
CREATE POLICY "Owners can view own connect account" ON stripe_connect_accounts
  FOR SELECT USING (profile_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Propriétaires peuvent créer leur compte Connect
CREATE POLICY "Owners can create own connect account" ON stripe_connect_accounts
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Service role peut tout faire
CREATE POLICY "Service role full access connect" ON stripe_connect_accounts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Propriétaires peuvent voir leurs transferts
CREATE POLICY "Owners can view own transfers" ON stripe_transfers
  FOR SELECT USING (
    connect_account_id IN (
      SELECT id FROM stripe_connect_accounts WHERE profile_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role peut tout faire sur les transferts
CREATE POLICY "Service role full access transfers" ON stripe_transfers
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger pour updated_at
CREATE TRIGGER update_stripe_connect_timestamp
  BEFORE UPDATE ON stripe_connect_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour obtenir le compte Connect d'un propriétaire par property_id
CREATE OR REPLACE FUNCTION get_property_owner_connect_account(property_id UUID)
RETURNS TABLE (
  connect_account_id UUID,
  stripe_account_id TEXT,
  charges_enabled BOOLEAN,
  payouts_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sca.id,
    sca.stripe_account_id,
    sca.charges_enabled,
    sca.payouts_enabled
  FROM stripe_connect_accounts sca
  JOIN properties p ON p.owner_id = sca.profile_id
  WHERE p.id = property_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires
COMMENT ON TABLE stripe_connect_accounts IS 'Comptes Stripe Connect des propriétaires pour les reversements directs';
COMMENT ON TABLE stripe_transfers IS 'Historique des transferts vers les propriétaires via Stripe Connect';
COMMENT ON FUNCTION get_property_owner_connect_account IS 'Récupère le compte Connect du propriétaire d''une propriété';


-- ========== 20260127000001_gap001_block_dg_bail_mobilite.sql ==========
-- ============================================
-- GAP-001: Bloquer dépôt de garantie pour bail mobilité
-- Article 25-13 de la Loi ELAN (2018)
-- ============================================
--
-- Cette migration ajoute une contrainte CHECK au niveau base de données
-- pour garantir qu'aucun bail mobilité ne puisse avoir un dépôt de garantie.
--
-- Référence légale:
-- "Le contrat de bail mobilité ne peut pas prévoir le versement d'un dépôt de garantie"
-- - Article 25-13 de la loi n° 2018-1021 du 23 novembre 2018 (Loi ELAN)

-- Ajouter la contrainte CHECK sur la table leases
ALTER TABLE leases
ADD CONSTRAINT chk_bail_mobilite_no_deposit
CHECK (
  type_bail != 'bail_mobilite' OR depot_de_garantie IS NULL OR depot_de_garantie = 0
);

-- Commentaire explicatif sur la contrainte
COMMENT ON CONSTRAINT chk_bail_mobilite_no_deposit ON leases IS
'Article 25-13 Loi ELAN: Le bail mobilité ne peut pas comporter de dépôt de garantie';

-- Mettre à jour les baux mobilité existants qui auraient un dépôt (correction des données)
UPDATE leases
SET depot_de_garantie = 0
WHERE type_bail = 'bail_mobilite' AND depot_de_garantie > 0;


-- ========== 20260127000002_gap002_furniture_inventory.sql ==========
-- ============================================
-- GAP-002: Inventaire meublé pour EDL
-- Décret n°2015-981 du 31/07/2015
-- ============================================
--
-- Cette migration crée la table pour stocker l'inventaire du mobilier
-- lors des états des lieux pour les baux meublés et mobilité.
--
-- Référence légale:
-- "L'état des lieux doit être accompagné d'un inventaire détaillé du mobilier"
-- - Décret n°2015-981 du 31 juillet 2015

-- Type enum pour les catégories de mobilier
CREATE TYPE furniture_category AS ENUM (
  'literie',
  'occultation',
  'cuisine',
  'rangement',
  'luminaire',
  'vaisselle',
  'entretien'
);

-- Type enum pour l'état du mobilier
CREATE TYPE furniture_condition AS ENUM (
  'neuf',
  'tres_bon',
  'bon',
  'usage',
  'mauvais',
  'absent'
);

-- Table principale des inventaires de mobilier
CREATE TABLE IF NOT EXISTS furniture_inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_id UUID NOT NULL REFERENCES etats_des_lieux(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  is_complete BOOLEAN DEFAULT FALSE,
  total_items INTEGER DEFAULT 0,
  items_present INTEGER DEFAULT 0,
  items_missing INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_id) -- Un seul inventaire par EDL
);

-- Table des items de mobilier
CREATE TABLE IF NOT EXISTS furniture_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES furniture_inventories(id) ON DELETE CASCADE,
  category furniture_category NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  legal_requirement TEXT, -- Référence légale (ex: "Décret 2015-981 Art.2 - 1°")
  is_mandatory BOOLEAN DEFAULT FALSE,
  quantity INTEGER DEFAULT 1,
  condition furniture_condition NOT NULL DEFAULT 'bon',
  notes TEXT,
  photos TEXT[], -- URLs des photos
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_furniture_inventories_edl_id ON furniture_inventories(edl_id);
CREATE INDEX idx_furniture_inventories_lease_id ON furniture_inventories(lease_id);
CREATE INDEX idx_furniture_items_inventory_id ON furniture_items(inventory_id);
CREATE INDEX idx_furniture_items_category ON furniture_items(category);
CREATE INDEX idx_furniture_items_condition ON furniture_items(condition);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_furniture_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_furniture_inventories_updated_at
  BEFORE UPDATE ON furniture_inventories
  FOR EACH ROW
  EXECUTE FUNCTION update_furniture_inventory_updated_at();

CREATE TRIGGER trigger_furniture_items_updated_at
  BEFORE UPDATE ON furniture_items
  FOR EACH ROW
  EXECUTE FUNCTION update_furniture_inventory_updated_at();

-- Trigger pour calculer automatiquement les compteurs de l'inventaire
CREATE OR REPLACE FUNCTION update_inventory_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE furniture_inventories
  SET
    total_items = (
      SELECT COUNT(*) FROM furniture_items WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
    ),
    items_present = (
      SELECT COUNT(*) FROM furniture_items
      WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
      AND condition != 'absent'
    ),
    items_missing = (
      SELECT COUNT(*) FROM furniture_items
      WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
      AND condition = 'absent'
      AND is_mandatory = TRUE
    ),
    is_complete = (
      SELECT NOT EXISTS (
        SELECT 1 FROM furniture_items
        WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
        AND condition = 'absent'
        AND is_mandatory = TRUE
      )
    )
  WHERE id = COALESCE(NEW.inventory_id, OLD.inventory_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_counts_insert
  AFTER INSERT ON furniture_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_counts();

CREATE TRIGGER trigger_update_inventory_counts_update
  AFTER UPDATE ON furniture_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_counts();

CREATE TRIGGER trigger_update_inventory_counts_delete
  AFTER DELETE ON furniture_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_counts();

-- RLS Policies
ALTER TABLE furniture_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE furniture_items ENABLE ROW LEVEL SECURITY;

-- Policy: Les propriétaires peuvent gérer les inventaires de leurs baux
CREATE POLICY furniture_inventories_owner_policy ON furniture_inventories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = furniture_inventories.lease_id
      AND p.owner_id = auth.uid()
    )
  );

-- Policy: Les locataires peuvent voir les inventaires de leurs baux
CREATE POLICY furniture_inventories_tenant_policy ON furniture_inventories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      WHERE l.id = furniture_inventories.lease_id
      AND l.tenant_id = auth.uid()
    )
  );

-- Policy: Les propriétaires peuvent gérer les items de leurs inventaires
CREATE POLICY furniture_items_owner_policy ON furniture_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE fi.id = furniture_items.inventory_id
      AND p.owner_id = auth.uid()
    )
  );

-- Policy: Les locataires peuvent voir les items de leurs inventaires
CREATE POLICY furniture_items_tenant_policy ON furniture_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      WHERE fi.id = furniture_items.inventory_id
      AND l.tenant_id = auth.uid()
    )
  );

-- Commentaires
COMMENT ON TABLE furniture_inventories IS 'Inventaires de mobilier pour EDL (Décret 2015-981)';
COMMENT ON TABLE furniture_items IS 'Items de mobilier dans les inventaires';
COMMENT ON COLUMN furniture_items.legal_requirement IS 'Référence légale de l''obligation (ex: Décret 2015-981 Art.2)';
COMMENT ON COLUMN furniture_items.is_mandatory IS 'Si true, l''item est obligatoire selon le décret';


-- ========== 20260127000002_vetusty_grid_tables.sql ==========
-- ============================================================================
-- MIGRATION: Tables pour la grille de vétusté (GAP-002)
-- Date: 2026-01-27
-- Description: Implémentation de la grille de vétusté pour le calcul des
--              retenues sur dépôt de garantie conformément aux accords collectifs
-- ============================================================================

-- 1. Table des rapports de vétusté
-- Un rapport par fin de bail, liant EDL entrée et sortie
CREATE TABLE IF NOT EXISTS vetusty_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  edl_entry_id UUID REFERENCES edl(id) ON DELETE SET NULL,
  edl_exit_id UUID REFERENCES edl(id) ON DELETE SET NULL,
  settlement_id UUID REFERENCES dg_settlements(id) ON DELETE SET NULL,

  -- Dates de référence
  edl_entry_date DATE NOT NULL,
  edl_exit_date DATE NOT NULL,
  lease_duration_years DECIMAL(4, 1) NOT NULL,

  -- Résumé financier
  total_items INTEGER NOT NULL DEFAULT 0,
  total_repair_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_owner_share DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_tenant_share DECIMAL(10, 2) NOT NULL DEFAULT 0,
  average_vetusty_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,

  -- Métadonnées
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'contested', 'final')),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES profiles(id),
  contested_at TIMESTAMPTZ,
  contest_reason TEXT,
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_vetusty_reports_lease_id ON vetusty_reports(lease_id);
CREATE INDEX IF NOT EXISTS idx_vetusty_reports_settlement_id ON vetusty_reports(settlement_id);
CREATE INDEX IF NOT EXISTS idx_vetusty_reports_status ON vetusty_reports(status);

-- 2. Table des éléments de vétusté calculés
-- Détail de chaque élément avec le calcul
CREATE TABLE IF NOT EXISTS vetusty_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES vetusty_reports(id) ON DELETE CASCADE,

  -- Référence à l'élément de la grille
  vetusty_grid_item_id TEXT NOT NULL, -- ID de l'élément dans VETUSTY_GRID
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,

  -- Données pour le calcul
  age_years DECIMAL(4, 1) NOT NULL,
  lifespan_years INTEGER NOT NULL,
  franchise_years INTEGER NOT NULL,

  -- Résultat du calcul
  vetusty_rate DECIMAL(5, 2) NOT NULL, -- Taux de vétusté (0-100)
  repair_cost DECIMAL(10, 2) NOT NULL,
  owner_share DECIMAL(10, 2) NOT NULL,
  tenant_share DECIMAL(10, 2) NOT NULL,

  -- Lien avec EDL si applicable
  edl_entry_item_id UUID, -- Référence à l'item EDL d'entrée
  edl_exit_item_id UUID,  -- Référence à l'item EDL de sortie
  room_name TEXT,

  -- Justificatifs
  is_degradation BOOLEAN NOT NULL DEFAULT true, -- Dégradation vs usure normale
  notes TEXT,
  photo_urls TEXT[], -- URLs des photos justificatives
  invoice_url TEXT, -- URL du devis/facture

  -- Contestation
  is_contested BOOLEAN NOT NULL DEFAULT false,
  contest_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_vetusty_items_report_id ON vetusty_items(report_id);
CREATE INDEX IF NOT EXISTS idx_vetusty_items_category ON vetusty_items(category);
CREATE INDEX IF NOT EXISTS idx_vetusty_items_is_contested ON vetusty_items(is_contested);

-- 3. Table historique des grilles de vétusté utilisées
-- Pour traçabilité en cas de mise à jour de la grille
CREATE TABLE IF NOT EXISTS vetusty_grid_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version TEXT NOT NULL UNIQUE,
  effective_date DATE NOT NULL,
  description TEXT,
  grid_data JSONB NOT NULL, -- Snapshot de la grille
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer la version actuelle de la grille
INSERT INTO vetusty_grid_versions (version, effective_date, description, grid_data, is_current)
VALUES (
  '2026.1',
  '2026-01-27',
  'Grille de vétusté initiale basée sur les accords collectifs ANIL/FNAIM/UNPI',
  '{"source": "accords_collectifs", "items_count": 55}'::jsonb,
  true
) ON CONFLICT (version) DO NOTHING;

-- 4. Trigger pour mettre à jour updated_at
CREATE TRIGGER update_vetusty_reports_updated_at
  BEFORE UPDATE ON vetusty_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vetusty_items_updated_at
  BEFORE UPDATE ON vetusty_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Fonction pour calculer automatiquement les totaux du rapport
CREATE OR REPLACE FUNCTION update_vetusty_report_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vetusty_reports
  SET
    total_items = (SELECT COUNT(*) FROM vetusty_items WHERE report_id = COALESCE(NEW.report_id, OLD.report_id)),
    total_repair_cost = (SELECT COALESCE(SUM(repair_cost), 0) FROM vetusty_items WHERE report_id = COALESCE(NEW.report_id, OLD.report_id)),
    total_owner_share = (SELECT COALESCE(SUM(owner_share), 0) FROM vetusty_items WHERE report_id = COALESCE(NEW.report_id, OLD.report_id)),
    total_tenant_share = (SELECT COALESCE(SUM(tenant_share), 0) FROM vetusty_items WHERE report_id = COALESCE(NEW.report_id, OLD.report_id)),
    average_vetusty_rate = (
      SELECT CASE
        WHEN SUM(repair_cost) > 0
        THEN SUM(vetusty_rate * repair_cost) / SUM(repair_cost)
        ELSE 0
      END
      FROM vetusty_items
      WHERE report_id = COALESCE(NEW.report_id, OLD.report_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.report_id, OLD.report_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vetusty_report_totals_insert
  AFTER INSERT ON vetusty_items
  FOR EACH ROW EXECUTE FUNCTION update_vetusty_report_totals();

CREATE TRIGGER trigger_update_vetusty_report_totals_update
  AFTER UPDATE ON vetusty_items
  FOR EACH ROW EXECUTE FUNCTION update_vetusty_report_totals();

CREATE TRIGGER trigger_update_vetusty_report_totals_delete
  AFTER DELETE ON vetusty_items
  FOR EACH ROW EXECUTE FUNCTION update_vetusty_report_totals();

-- 6. RLS Policies
ALTER TABLE vetusty_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vetusty_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vetusty_grid_versions ENABLE ROW LEVEL SECURITY;

-- Lecture des rapports : propriétaire du bien ou locataire concerné
CREATE POLICY "vetusty_reports_select_policy" ON vetusty_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = vetusty_reports.lease_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          WHERE ls.lease_id = l.id
          AND ls.profile_id = auth.uid()
        )
      )
    )
  );

-- Création/modification : propriétaire uniquement
CREATE POLICY "vetusty_reports_insert_policy" ON vetusty_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = vetusty_reports.lease_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "vetusty_reports_update_policy" ON vetusty_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = vetusty_reports.lease_id
      AND p.owner_id = auth.uid()
    )
  );

-- Items de vétusté : mêmes règles via le rapport
CREATE POLICY "vetusty_items_select_policy" ON vetusty_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE vr.id = vetusty_items.report_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          WHERE ls.lease_id = l.id
          AND ls.profile_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "vetusty_items_insert_policy" ON vetusty_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE vr.id = vetusty_items.report_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "vetusty_items_update_policy" ON vetusty_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE vr.id = vetusty_items.report_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "vetusty_items_delete_policy" ON vetusty_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE vr.id = vetusty_items.report_id
      AND p.owner_id = auth.uid()
      AND vr.status = 'draft'
    )
  );

-- Grille de vétusté : lecture publique
CREATE POLICY "vetusty_grid_versions_select_policy" ON vetusty_grid_versions
  FOR SELECT USING (true);

-- 7. Commentaires
COMMENT ON TABLE vetusty_reports IS 'Rapports de calcul de vétusté pour les fins de bail';
COMMENT ON TABLE vetusty_items IS 'Éléments individuels du calcul de vétusté';
COMMENT ON TABLE vetusty_grid_versions IS 'Historique des versions de la grille de vétusté';

COMMENT ON COLUMN vetusty_items.vetusty_rate IS 'Taux de vétusté calculé (0-100%), représente la part d''usure normale';
COMMENT ON COLUMN vetusty_items.owner_share IS 'Part du coût à charge du propriétaire (vétusté/usure normale)';
COMMENT ON COLUMN vetusty_items.tenant_share IS 'Part du coût à charge du locataire (dégradations anormales)';


-- ========== 20260127000003_commercial_lease_types.sql ==========
-- Migration: Ajout des types de baux commerciaux
-- GAP-003: Support des baux commerciaux (3/6/9 et dérogatoire)
-- Conforme au Code de commerce (Articles L145-1 à L145-60)

-- =============================================================================
-- 1. EXTENSION DU TYPE ENUM lease_type
-- =============================================================================

-- Ajouter les nouveaux types de bail si pas déjà présents
DO $$
BEGIN
  -- Bail commercial 3/6/9
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'commercial'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lease_type')
  ) THEN
    ALTER TYPE lease_type ADD VALUE IF NOT EXISTS 'commercial';
  END IF;

  -- Bail dérogatoire (précaire)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'commercial_derogatoire'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lease_type')
  ) THEN
    ALTER TYPE lease_type ADD VALUE IF NOT EXISTS 'commercial_derogatoire';
  END IF;

  -- Bail professionnel (pour les professions libérales)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'professionnel'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lease_type')
  ) THEN
    ALTER TYPE lease_type ADD VALUE IF NOT EXISTS 'professionnel';
  END IF;
END$$;

-- =============================================================================
-- 2. TABLE: commercial_lease_details
-- Détails spécifiques aux baux commerciaux
-- =============================================================================

CREATE TABLE IF NOT EXISTS commercial_lease_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Destination des locaux (Article L145-47)
  destination_clause TEXT NOT NULL,
  activite_principale TEXT NOT NULL,
  activites_connexes TEXT,
  clause_tous_commerces BOOLEAN DEFAULT FALSE,
  despecialisation_partielle_autorisee BOOLEAN DEFAULT TRUE,
  code_ape VARCHAR(10),

  -- Durée et périodes triennales
  duree_ferme_mois INTEGER, -- Pour bail dérogatoire: durée ferme
  renonciation_triennale BOOLEAN DEFAULT FALSE,
  renonciation_motif TEXT,

  -- Loyer et indexation
  loyer_annuel_ht DECIMAL(12,2) NOT NULL,
  tva_applicable BOOLEAN DEFAULT TRUE,
  tva_taux DECIMAL(5,2) DEFAULT 20.00,
  indice_type VARCHAR(10) DEFAULT 'ILC', -- ILC, ILAT, ICC
  indice_base DECIMAL(10,2),
  indice_trimestre_base VARCHAR(20),
  plafonnement_revision BOOLEAN DEFAULT TRUE,

  -- Pas-de-porte / Droit d'entrée
  pas_de_porte_montant DECIMAL(12,2),
  pas_de_porte_nature VARCHAR(50), -- 'supplement_loyer', 'indemnite'
  pas_de_porte_tva DECIMAL(12,2),

  -- Droit au bail
  droit_au_bail_valeur DECIMAL(12,2),

  -- Garanties spécifiques
  garantie_bancaire_type VARCHAR(50),
  garantie_bancaire_montant DECIMAL(12,2),
  garantie_bancaire_banque VARCHAR(255),
  garantie_bancaire_duree_mois INTEGER,

  -- Caution solidaire
  caution_solidaire BOOLEAN DEFAULT FALSE,
  caution_nom VARCHAR(255),
  caution_siret VARCHAR(14),
  caution_adresse TEXT,
  caution_montant_engagement DECIMAL(12,2),
  caution_duree_mois INTEGER,

  -- Cession et sous-location
  cession_libre BOOLEAN DEFAULT FALSE,
  droit_preemption_bailleur BOOLEAN DEFAULT FALSE,
  sous_location_autorisee BOOLEAN DEFAULT FALSE,
  garantie_solidaire_cedant BOOLEAN DEFAULT TRUE,
  garantie_cedant_duree_mois INTEGER DEFAULT 36,

  -- Charges (répartition Loi Pinel)
  taxe_fonciere_preneur BOOLEAN DEFAULT FALSE,
  taxe_bureaux_preneur BOOLEAN DEFAULT FALSE,
  charges_copro_fonct_preneur BOOLEAN DEFAULT TRUE,

  -- Travaux
  accession_ameliorations BOOLEAN DEFAULT TRUE,
  travaux_bailleur_liste TEXT,

  -- Clause résolutoire
  clause_resolutoire_delai_jours INTEGER DEFAULT 30,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lease_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_commercial_lease_details_lease_id
  ON commercial_lease_details(lease_id);

-- =============================================================================
-- 3. TABLE: commercial_lease_triennial_periods
-- Historique des périodes triennales
-- =============================================================================

CREATE TABLE IF NOT EXISTS commercial_lease_triennial_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  period_number INTEGER NOT NULL, -- 1, 2, 3
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  resignation_deadline DATE NOT NULL, -- Date limite pour donner congé

  -- Statut de la période
  resignation_given BOOLEAN DEFAULT FALSE,
  resignation_date DATE,
  resignation_by VARCHAR(20), -- 'preneur', 'bailleur'

  -- Loyer applicable pendant cette période
  loyer_annuel_ht DECIMAL(12,2),
  indice_revision DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lease_id, period_number)
);

CREATE INDEX IF NOT EXISTS idx_commercial_triennial_lease_id
  ON commercial_lease_triennial_periods(lease_id);

-- =============================================================================
-- 4. TABLE: derogatoire_lease_history
-- Historique des baux dérogatoires successifs (contrôle des 3 ans max)
-- =============================================================================

CREATE TABLE IF NOT EXISTS derogatoire_lease_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Preneur (peut être différent pour chaque bail)
  preneur_type VARCHAR(20) NOT NULL, -- 'personne_physique', 'personne_morale'
  preneur_nom VARCHAR(255) NOT NULL,
  preneur_siret VARCHAR(14),

  -- Période du bail
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  duree_mois INTEGER NOT NULL,

  -- Pour vérification de la limite des 3 ans
  duree_cumulee_avant_mois INTEGER DEFAULT 0,
  duree_cumulee_apres_mois INTEGER NOT NULL,

  -- Alerte si proche de la limite
  alerte_limite_3_ans BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT check_duree_max CHECK (duree_cumulee_apres_mois <= 36)
);

CREATE INDEX IF NOT EXISTS idx_derogatoire_history_property
  ON derogatoire_lease_history(property_id);

-- =============================================================================
-- 5. FONCTION: Calcul automatique des périodes triennales
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_triennial_periods()
RETURNS TRIGGER AS $$
DECLARE
  v_start_date DATE;
  v_period_start DATE;
  v_period_end DATE;
  v_resignation_deadline DATE;
  v_loyer DECIMAL(12,2);
BEGIN
  -- Seulement pour les baux commerciaux 3/6/9
  IF NEW.type != 'commercial' THEN
    RETURN NEW;
  END IF;

  -- Récupérer la date de début et le loyer
  v_start_date := NEW.start_date;

  SELECT loyer_annuel_ht INTO v_loyer
  FROM commercial_lease_details
  WHERE lease_id = NEW.id;

  -- Générer les 3 périodes triennales
  FOR i IN 1..3 LOOP
    v_period_start := v_start_date + ((i-1) * INTERVAL '3 years');
    v_period_end := v_start_date + (i * INTERVAL '3 years') - INTERVAL '1 day';
    v_resignation_deadline := v_period_end - INTERVAL '6 months';

    INSERT INTO commercial_lease_triennial_periods (
      lease_id,
      period_number,
      start_date,
      end_date,
      resignation_deadline,
      loyer_annuel_ht
    ) VALUES (
      NEW.id,
      i,
      v_period_start,
      v_period_end,
      v_resignation_deadline,
      v_loyer
    )
    ON CONFLICT (lease_id, period_number)
    DO UPDATE SET
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      resignation_deadline = EXCLUDED.resignation_deadline;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour générer les périodes triennales
DROP TRIGGER IF EXISTS trigger_generate_triennial_periods ON leases;
CREATE TRIGGER trigger_generate_triennial_periods
  AFTER INSERT OR UPDATE OF start_date, type ON leases
  FOR EACH ROW
  WHEN (NEW.type = 'commercial')
  EXECUTE FUNCTION generate_triennial_periods();

-- =============================================================================
-- 6. FONCTION: Vérification durée cumulative bail dérogatoire
-- =============================================================================

CREATE OR REPLACE FUNCTION check_derogatoire_duration()
RETURNS TRIGGER AS $$
DECLARE
  v_cumul_mois INTEGER;
  v_new_total INTEGER;
BEGIN
  -- Calculer la durée cumulée des baux dérogatoires sur ce bien
  SELECT COALESCE(SUM(duree_mois), 0) INTO v_cumul_mois
  FROM derogatoire_lease_history
  WHERE property_id = NEW.property_id
    AND id != NEW.id;

  v_new_total := v_cumul_mois + NEW.duree_mois;

  -- Mettre à jour les valeurs
  NEW.duree_cumulee_avant_mois := v_cumul_mois;
  NEW.duree_cumulee_apres_mois := v_new_total;

  -- Alerte si on approche de la limite
  IF v_new_total > 30 THEN
    NEW.alerte_limite_3_ans := TRUE;
  END IF;

  -- Erreur si dépassement
  IF v_new_total > 36 THEN
    RAISE EXCEPTION 'La durée cumulée des baux dérogatoires ne peut excéder 36 mois (3 ans). Durée actuelle: % mois', v_new_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_derogatoire_duration ON derogatoire_lease_history;
CREATE TRIGGER trigger_check_derogatoire_duration
  BEFORE INSERT OR UPDATE ON derogatoire_lease_history
  FOR EACH ROW
  EXECUTE FUNCTION check_derogatoire_duration();

-- =============================================================================
-- 7. FONCTION: RPC pour obtenir l'historique dérogatoire d'un bien
-- =============================================================================

CREATE OR REPLACE FUNCTION get_derogatoire_history(p_property_id UUID)
RETURNS TABLE (
  id UUID,
  preneur_nom VARCHAR,
  date_debut DATE,
  date_fin DATE,
  duree_mois INTEGER,
  duree_cumulee_apres_mois INTEGER,
  mois_restants INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id,
    h.preneur_nom,
    h.date_debut,
    h.date_fin,
    h.duree_mois,
    h.duree_cumulee_apres_mois,
    (36 - h.duree_cumulee_apres_mois) as mois_restants
  FROM derogatoire_lease_history h
  WHERE h.property_id = p_property_id
  ORDER BY h.date_debut;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 8. FONCTION: RPC pour calculer la révision de loyer ILC/ILAT
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_commercial_rent_revision(
  p_lease_id UUID,
  p_new_indice DECIMAL
)
RETURNS TABLE (
  ancien_loyer DECIMAL,
  nouveau_loyer DECIMAL,
  variation_pct DECIMAL,
  indice_base DECIMAL,
  nouvel_indice DECIMAL
) AS $$
DECLARE
  v_loyer DECIMAL;
  v_indice_base DECIMAL;
  v_nouveau_loyer DECIMAL;
  v_variation DECIMAL;
BEGIN
  -- Récupérer les données du bail
  SELECT
    cld.loyer_annuel_ht,
    cld.indice_base
  INTO v_loyer, v_indice_base
  FROM commercial_lease_details cld
  WHERE cld.lease_id = p_lease_id;

  IF v_loyer IS NULL OR v_indice_base IS NULL THEN
    RAISE EXCEPTION 'Bail commercial non trouvé ou indice de base manquant';
  END IF;

  -- Calcul du nouveau loyer
  v_nouveau_loyer := v_loyer * (p_new_indice / v_indice_base);
  v_variation := ((p_new_indice - v_indice_base) / v_indice_base) * 100;

  RETURN QUERY
  SELECT
    v_loyer as ancien_loyer,
    ROUND(v_nouveau_loyer, 2) as nouveau_loyer,
    ROUND(v_variation, 2) as variation_pct,
    v_indice_base as indice_base,
    p_new_indice as nouvel_indice;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 9. RLS POLICIES
-- =============================================================================

-- Activer RLS
ALTER TABLE commercial_lease_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_lease_triennial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE derogatoire_lease_history ENABLE ROW LEVEL SECURITY;

-- Policies pour commercial_lease_details
CREATE POLICY "commercial_lease_details_select_policy" ON commercial_lease_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = commercial_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "commercial_lease_details_insert_policy" ON commercial_lease_details
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = commercial_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "commercial_lease_details_update_policy" ON commercial_lease_details
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = commercial_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "commercial_lease_details_delete_policy" ON commercial_lease_details
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = commercial_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

-- Policies pour commercial_lease_triennial_periods
CREATE POLICY "triennial_periods_select_policy" ON commercial_lease_triennial_periods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = commercial_lease_triennial_periods.lease_id
        AND p.owner_id = auth.uid()
    )
  );

-- Policies pour derogatoire_lease_history
CREATE POLICY "derogatoire_history_select_policy" ON derogatoire_lease_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = derogatoire_lease_history.property_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "derogatoire_history_insert_policy" ON derogatoire_lease_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = derogatoire_lease_history.property_id
        AND p.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- 10. TRIGGER: Mise à jour automatique updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_commercial_lease_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_commercial_lease_timestamp ON commercial_lease_details;
CREATE TRIGGER trigger_update_commercial_lease_timestamp
  BEFORE UPDATE ON commercial_lease_details
  FOR EACH ROW
  EXECUTE FUNCTION update_commercial_lease_timestamp();

-- =============================================================================
-- 11. COMMENTAIRES
-- =============================================================================

COMMENT ON TABLE commercial_lease_details IS
  'Détails spécifiques aux baux commerciaux (3/6/9 et dérogatoire) - Code de commerce L145';

COMMENT ON TABLE commercial_lease_triennial_periods IS
  'Périodes triennales pour les baux commerciaux 3/6/9 avec dates de résiliation';

COMMENT ON TABLE derogatoire_lease_history IS
  'Historique des baux dérogatoires par bien pour contrôle de la limite de 3 ans (L145-5)';

COMMENT ON COLUMN commercial_lease_details.indice_type IS
  'Type d''indice: ILC (commerces), ILAT (bureaux/activités tertiaires), ICC (obsolète)';

COMMENT ON COLUMN commercial_lease_details.pas_de_porte_nature IS
  'supplement_loyer = pris en compte pour renouvellement, indemnite = non pris en compte';


-- ========== 20260127000004_professional_lease_types.sql ==========
-- Migration: Ajout du bail professionnel
-- GAP-004: Support des baux professionnels (professions libérales)
-- Conforme à l'article 57 A de la loi n°86-1290 du 23 décembre 1986

-- =============================================================================
-- 1. EXTENSION DU TYPE ENUM lease_type (si pas déjà fait)
-- =============================================================================

-- Le type 'professionnel' a déjà été ajouté dans la migration précédente
-- Cette section est conservée pour idempotence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'professionnel'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lease_type')
  ) THEN
    ALTER TYPE lease_type ADD VALUE IF NOT EXISTS 'professionnel';
  END IF;
END$$;

-- =============================================================================
-- 2. TABLE: professional_lease_details
-- Détails spécifiques aux baux professionnels
-- =============================================================================

CREATE TABLE IF NOT EXISTS professional_lease_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Preneur - Profession
  profession_category VARCHAR(50) NOT NULL, -- sante, juridique, technique, comptable, conseil, artistique, autre
  profession_type VARCHAR(50) NOT NULL,     -- medecin_generaliste, avocat, architecte, etc.
  profession_libelle VARCHAR(255) NOT NULL, -- Libellé exact de la profession
  forme_juridique VARCHAR(50) NOT NULL,     -- exercice_individuel, scp, scm, sel, selarl, etc.

  -- Inscription ordinale
  ordre_professionnel VARCHAR(255),
  numero_ordinal VARCHAR(50),
  departement_inscription VARCHAR(3),

  -- Identification fiscale
  regime_fiscal VARCHAR(20) DEFAULT 'bnc', -- bnc, is, micro_bnc
  numero_tva_intra VARCHAR(20),

  -- Assurance RCP
  assurance_rcp BOOLEAN DEFAULT TRUE,
  assurance_rcp_compagnie VARCHAR(255),
  assurance_rcp_numero VARCHAR(100),

  -- Locaux
  surface_totale_m2 DECIMAL(10,2) NOT NULL,
  nb_bureaux INTEGER DEFAULT 1,
  nb_salles_attente INTEGER DEFAULT 1,
  nb_salles_examen INTEGER DEFAULT 0,
  accessibilite_pmr BOOLEAN DEFAULT FALSE,
  usage_exclusif_professionnel BOOLEAN DEFAULT TRUE,
  reception_clientele BOOLEAN DEFAULT TRUE,

  -- Financier
  loyer_annuel_hc DECIMAL(12,2) NOT NULL,
  tva_applicable BOOLEAN DEFAULT FALSE, -- Généralement pas de TVA
  tva_taux DECIMAL(5,2),
  charges_type VARCHAR(20) DEFAULT 'provisions', -- forfait, provisions, reel
  charges_montant_mensuel DECIMAL(10,2),

  -- Indexation (ILAT par défaut)
  indice_reference VARCHAR(10) DEFAULT 'ILAT',
  indice_base DECIMAL(10,2),
  indice_base_trimestre VARCHAR(20),
  date_revision_annuelle VARCHAR(5) DEFAULT '01-01', -- Format MM-DD

  -- Résiliation
  preavis_locataire_mois INTEGER DEFAULT 6,
  preavis_bailleur_mois INTEGER DEFAULT 6,

  -- Options
  sous_location_autorisee BOOLEAN DEFAULT FALSE,
  cession_autorisee BOOLEAN DEFAULT TRUE,
  cession_agrement_bailleur BOOLEAN DEFAULT TRUE,

  -- Clause résolutoire
  clause_resolutoire_active BOOLEAN DEFAULT TRUE,
  clause_resolutoire_delai_jours INTEGER DEFAULT 30,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lease_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_professional_lease_details_lease_id
  ON professional_lease_details(lease_id);

CREATE INDEX IF NOT EXISTS idx_professional_lease_profession_type
  ON professional_lease_details(profession_type);

CREATE INDEX IF NOT EXISTS idx_professional_lease_profession_category
  ON professional_lease_details(profession_category);

-- =============================================================================
-- 3. TABLE: professional_orders
-- Référentiel des ordres professionnels
-- =============================================================================

CREATE TABLE IF NOT EXISTS professional_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  professions VARCHAR(255)[], -- Liste des professions concernées

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertion des ordres professionnels
INSERT INTO professional_orders (code, name, website, professions) VALUES
  ('medecins', 'Ordre national des médecins', 'https://www.conseil-national.medecin.fr', ARRAY['medecin_generaliste', 'medecin_specialiste']),
  ('pharmaciens', 'Ordre national des pharmaciens', 'https://www.ordre.pharmacien.fr', ARRAY['pharmacien']),
  ('dentistes', 'Ordre national des chirurgiens-dentistes', 'https://www.ordre-chirurgiens-dentistes.fr', ARRAY['chirurgien_dentiste']),
  ('sages_femmes', 'Ordre national des sages-femmes', 'https://www.ordre-sages-femmes.fr', ARRAY['sage_femme']),
  ('infirmiers', 'Ordre national des infirmiers', 'https://www.ordre-infirmiers.fr', ARRAY['infirmier']),
  ('kinesitherapeutes', 'Ordre des masseurs-kinésithérapeutes', 'https://www.ordremk.fr', ARRAY['kinesitherapeute']),
  ('avocats', 'Conseil national des barreaux', 'https://www.cnb.avocat.fr', ARRAY['avocat']),
  ('notaires', 'Conseil supérieur du notariat', 'https://www.notaires.fr', ARRAY['notaire']),
  ('huissiers', 'Chambre nationale des commissaires de justice', 'https://www.cnhj.fr', ARRAY['huissier']),
  ('architectes', 'Ordre des architectes', 'https://www.architectes.org', ARRAY['architecte']),
  ('geometres_experts', 'Ordre des géomètres-experts', 'https://www.geometre-expert.fr', ARRAY['geometre_expert']),
  ('experts_comptables', 'Ordre des experts-comptables', 'https://www.experts-comptables.fr', ARRAY['expert_comptable', 'commissaire_aux_comptes']),
  ('veterinaires', 'Ordre national des vétérinaires', 'https://www.veterinaire.fr', ARRAY['veterinaire'])
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 4. FONCTION: Validation de la durée minimale bail professionnel
-- =============================================================================

CREATE OR REPLACE FUNCTION check_professional_lease_duration()
RETURNS TRIGGER AS $$
DECLARE
  v_lease_type TEXT;
  v_start_date DATE;
  v_end_date DATE;
  v_duration_months INTEGER;
BEGIN
  -- Récupérer le type de bail
  SELECT type, start_date, end_date
  INTO v_lease_type, v_start_date, v_end_date
  FROM leases
  WHERE id = NEW.lease_id;

  -- Vérifier seulement pour les baux professionnels
  IF v_lease_type = 'professionnel' AND v_end_date IS NOT NULL THEN
    -- Calculer la durée en mois
    v_duration_months := (
      EXTRACT(YEAR FROM v_end_date) - EXTRACT(YEAR FROM v_start_date)
    ) * 12 + (
      EXTRACT(MONTH FROM v_end_date) - EXTRACT(MONTH FROM v_start_date)
    );

    -- Durée minimale : 6 ans = 72 mois
    IF v_duration_months < 72 THEN
      RAISE EXCEPTION 'La durée minimale d''un bail professionnel est de 6 ans (72 mois). Durée actuelle: % mois', v_duration_months;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour vérifier la durée
DROP TRIGGER IF EXISTS trigger_check_professional_lease_duration ON professional_lease_details;
CREATE TRIGGER trigger_check_professional_lease_duration
  BEFORE INSERT OR UPDATE ON professional_lease_details
  FOR EACH ROW
  EXECUTE FUNCTION check_professional_lease_duration();

-- =============================================================================
-- 5. FONCTION: RPC pour obtenir les détails d'un bail professionnel
-- =============================================================================

CREATE OR REPLACE FUNCTION get_professional_lease_details(p_lease_id UUID)
RETURNS TABLE (
  lease_id UUID,
  profession_category VARCHAR,
  profession_type VARCHAR,
  profession_libelle VARCHAR,
  forme_juridique VARCHAR,
  ordre_professionnel VARCHAR,
  numero_ordinal VARCHAR,
  assurance_rcp BOOLEAN,
  surface_totale_m2 DECIMAL,
  loyer_annuel_hc DECIMAL,
  indice_reference VARCHAR,
  preavis_locataire_mois INTEGER,
  preavis_bailleur_mois INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pld.lease_id,
    pld.profession_category,
    pld.profession_type,
    pld.profession_libelle,
    pld.forme_juridique,
    pld.ordre_professionnel,
    pld.numero_ordinal,
    pld.assurance_rcp,
    pld.surface_totale_m2,
    pld.loyer_annuel_hc,
    pld.indice_reference,
    pld.preavis_locataire_mois,
    pld.preavis_bailleur_mois
  FROM professional_lease_details pld
  WHERE pld.lease_id = p_lease_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. FONCTION: Calcul de la révision ILAT
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_ilat_revision(
  p_current_rent DECIMAL,
  p_base_index DECIMAL,
  p_new_index DECIMAL
)
RETURNS TABLE (
  ancien_loyer DECIMAL,
  nouveau_loyer DECIMAL,
  variation_pct DECIMAL
) AS $$
DECLARE
  v_new_rent DECIMAL;
  v_variation DECIMAL;
BEGIN
  -- Calcul du nouveau loyer
  v_new_rent := p_current_rent * (p_new_index / p_base_index);
  v_variation := ((p_new_index - p_base_index) / p_base_index) * 100;

  RETURN QUERY
  SELECT
    p_current_rent as ancien_loyer,
    ROUND(v_new_rent, 2) as nouveau_loyer,
    ROUND(v_variation, 2) as variation_pct;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. RLS POLICIES
-- =============================================================================

-- Activer RLS
ALTER TABLE professional_lease_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_orders ENABLE ROW LEVEL SECURITY;

-- Policies pour professional_lease_details
CREATE POLICY "professional_lease_details_select_policy" ON professional_lease_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = professional_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "professional_lease_details_insert_policy" ON professional_lease_details
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = professional_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "professional_lease_details_update_policy" ON professional_lease_details
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = professional_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "professional_lease_details_delete_policy" ON professional_lease_details
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = professional_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

-- Policies pour professional_orders (lecture seule pour tous)
CREATE POLICY "professional_orders_select_policy" ON professional_orders
  FOR SELECT USING (TRUE);

-- =============================================================================
-- 8. TRIGGER: Mise à jour automatique updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_professional_lease_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_professional_lease_timestamp ON professional_lease_details;
CREATE TRIGGER trigger_update_professional_lease_timestamp
  BEFORE UPDATE ON professional_lease_details
  FOR EACH ROW
  EXECUTE FUNCTION update_professional_lease_timestamp();

-- =============================================================================
-- 9. COMMENTAIRES
-- =============================================================================

COMMENT ON TABLE professional_lease_details IS
  'Détails spécifiques aux baux professionnels (article 57 A loi 86-1290) - Professions libérales';

COMMENT ON TABLE professional_orders IS
  'Référentiel des ordres professionnels français';

COMMENT ON COLUMN professional_lease_details.indice_reference IS
  'Indice de révision du loyer - ILAT recommandé pour les baux professionnels';

COMMENT ON COLUMN professional_lease_details.assurance_rcp IS
  'Assurance Responsabilité Civile Professionnelle - Obligatoire pour la plupart des professions réglementées';


-- ========== 20260127000005_edl_commercial.sql ==========
-- Migration: État des lieux commercial et professionnel
-- GAP-007: EDL spécifique pour les locaux commerciaux et professionnels
-- Date: 2026-01-27

-- =============================================================================
-- 1. TABLE: edl_commercial
-- État des lieux principal pour locaux commerciaux/professionnels
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Type d'EDL
  type_edl VARCHAR(10) NOT NULL CHECK (type_edl IN ('entree', 'sortie')),
  type_local VARCHAR(50) NOT NULL,
  type_bail VARCHAR(50) NOT NULL CHECK (type_bail IN ('commercial', 'commercial_derogatoire', 'professionnel')),

  -- Dates et heures
  date_edl DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME,

  -- Surfaces
  surface_totale_m2 DECIMAL(10,2) NOT NULL,
  surface_vente_m2 DECIMAL(10,2),
  surface_reserve_m2 DECIMAL(10,2),
  surface_bureaux_m2 DECIMAL(10,2),
  surface_annexes_m2 DECIMAL(10,2),

  -- Représentant bailleur
  bailleur_nom VARCHAR(100) NOT NULL,
  bailleur_prenom VARCHAR(100) NOT NULL,
  bailleur_qualite VARCHAR(100) NOT NULL,
  bailleur_signature TEXT,
  bailleur_signature_date TIMESTAMPTZ,

  -- Représentant preneur
  preneur_nom VARCHAR(100) NOT NULL,
  preneur_prenom VARCHAR(100) NOT NULL,
  preneur_qualite VARCHAR(100) NOT NULL,
  preneur_raison_sociale VARCHAR(255),
  preneur_signature TEXT,
  preneur_signature_date TIMESTAMPTZ,

  -- Observations
  observations_generales TEXT,
  reserves_preneur TEXT,
  reserves_bailleur TEXT,

  -- État global
  etat_general VARCHAR(20) DEFAULT 'bon',
  conformite_globale VARCHAR(20) DEFAULT 'conforme',

  -- Référence EDL entrée (pour sortie)
  edl_entree_id UUID REFERENCES edl_commercial(id) ON DELETE SET NULL,

  -- Statut et validation
  status VARCHAR(20) DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'en_cours', 'a_valider', 'valide', 'conteste')),

  -- Génération PDF
  pdf_generated BOOLEAN DEFAULT FALSE,
  pdf_path VARCHAR(500),

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE(lease_id, type_edl)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_edl_commercial_lease_id ON edl_commercial(lease_id);
CREATE INDEX IF NOT EXISTS idx_edl_commercial_property_id ON edl_commercial(property_id);
CREATE INDEX IF NOT EXISTS idx_edl_commercial_type_bail ON edl_commercial(type_bail);
CREATE INDEX IF NOT EXISTS idx_edl_commercial_status ON edl_commercial(status);

-- =============================================================================
-- 2. TABLE: edl_commercial_securite_incendie
-- Conformité ERP et sécurité incendie
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_securite_incendie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Classification ERP
  erp_categorie VARCHAR(10), -- 1, 2, 3, 4, 5, non_erp
  erp_type VARCHAR(10), -- M, N, O, W, J, U
  erp_capacite_max INTEGER,

  -- Extincteurs
  extincteurs_presents BOOLEAN DEFAULT FALSE,
  extincteurs_nombre INTEGER DEFAULT 0,
  extincteurs_types TEXT[], -- eau, co2, poudre, mousse
  extincteurs_date_verification DATE,
  extincteurs_conformes BOOLEAN,

  -- Alarme incendie
  alarme_incendie_presente BOOLEAN DEFAULT FALSE,
  alarme_incendie_type VARCHAR(20), -- type_1, type_2a, type_2b, type_3, type_4
  alarme_incendie_centrale BOOLEAN DEFAULT FALSE,
  alarme_incendie_nb_detecteurs INTEGER DEFAULT 0,
  alarme_incendie_date_verification DATE,

  -- Issues de secours
  issues_secours_nombre INTEGER DEFAULT 0,
  issues_secours_conformes BOOLEAN DEFAULT FALSE,
  issues_secours_eclairage_securite BOOLEAN DEFAULT FALSE,
  issues_secours_balisage BOOLEAN DEFAULT FALSE,

  -- Désenfumage
  desenfumage_present BOOLEAN DEFAULT FALSE,
  desenfumage_type VARCHAR(20), -- naturel, mecanique
  desenfumage_conforme BOOLEAN,

  -- Documents et contrôles
  registre_securite_present BOOLEAN DEFAULT FALSE,
  registre_securite_a_jour BOOLEAN DEFAULT FALSE,
  dernier_controle_commission DATE,
  avis_commission VARCHAR(20), -- favorable, defavorable, sursis

  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 3. TABLE: edl_commercial_accessibilite_pmr
-- Conformité accessibilité PMR
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_accessibilite_pmr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Attestation/Ad'AP
  ad_ap_presente BOOLEAN DEFAULT FALSE,
  ad_ap_date DATE,
  ad_ap_reference VARCHAR(100),

  -- Accès extérieur
  acces_plain_pied BOOLEAN DEFAULT FALSE,
  rampe_acces_presente BOOLEAN,
  rampe_acces_conforme BOOLEAN,
  rampe_pente_pct DECIMAL(5,2),
  largeur_porte_entree_cm INTEGER,

  -- Circulation intérieure
  circulation_largeur_min_cm INTEGER,
  circulation_libre BOOLEAN DEFAULT FALSE,
  escalier_present BOOLEAN DEFAULT FALSE,
  ascenseur_present BOOLEAN,
  ascenseur_conforme_pmr BOOLEAN,

  -- Sanitaires PMR
  sanitaire_pmr_present BOOLEAN DEFAULT FALSE,
  sanitaire_pmr_conforme BOOLEAN,
  sanitaire_pmr_dimensions VARCHAR(50),

  -- Stationnement
  place_pmr_presente BOOLEAN DEFAULT FALSE,
  place_pmr_signalee BOOLEAN,

  -- Signalétique
  signaletique_pmr_presente BOOLEAN DEFAULT FALSE,
  bande_guidage_presente BOOLEAN,

  conformite_globale VARCHAR(20) DEFAULT 'a_verifier', -- conforme, non_conforme, a_verifier, derogation
  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 4. TABLE: edl_commercial_facade_vitrine
-- Inspection façade et vitrine (commerces)
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_facade_vitrine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Vitrine
  vitrine_etat VARCHAR(20) DEFAULT 'bon',
  vitrine_type VARCHAR(20), -- simple, double, securit, autre
  vitrine_surface_m2 DECIMAL(10,2),
  vitrine_film_adhesif BOOLEAN DEFAULT FALSE,
  vitrine_observations TEXT,

  -- Façade
  facade_etat VARCHAR(20) DEFAULT 'bon',
  facade_materiau VARCHAR(100),
  facade_peinture_date DATE,
  facade_observations TEXT,

  -- Store/Banne
  store_present BOOLEAN DEFAULT FALSE,
  store_type VARCHAR(20), -- banne, venitien, roulant, autre
  store_motorise BOOLEAN,
  store_etat VARCHAR(20),
  store_observations TEXT,

  -- Porte d'entrée
  porte_entree_etat VARCHAR(20) DEFAULT 'bon',
  porte_entree_type VARCHAR(20), -- vitree, pleine, rideau_metallique, autre
  porte_entree_serrure_type VARCHAR(50),
  porte_entree_nb_cles INTEGER DEFAULT 0,

  -- Rideau métallique
  rideau_metallique_present BOOLEAN DEFAULT FALSE,
  rideau_metallique_etat VARCHAR(20),
  rideau_metallique_motorise BOOLEAN,
  rideau_metallique_observations TEXT,

  photos JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 5. TABLE: edl_commercial_enseigne
-- Inspection enseigne et signalétique
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_enseigne (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Enseigne principale
  enseigne_presente BOOLEAN DEFAULT FALSE,
  enseigne_type VARCHAR(30), -- bandeau, caisson, lettres_decoupees, drapeau, autre
  enseigne_eclairee BOOLEAN,
  enseigne_etat VARCHAR(20),
  enseigne_dimensions VARCHAR(50),
  enseigne_autorisation_mairie BOOLEAN,
  enseigne_observations TEXT,

  -- Signalétique intérieure
  signaletique_interieure BOOLEAN DEFAULT FALSE,
  signaletique_sortie_secours BOOLEAN DEFAULT FALSE,
  signaletique_sanitaires BOOLEAN DEFAULT FALSE,
  signaletique_accessibilite BOOLEAN DEFAULT FALSE,
  signaletique_observations TEXT,

  photos JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 6. TABLE: edl_commercial_installations_techniques
-- Installations techniques (clim, chauffage, électricité, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_installations_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Climatisation
  climatisation_presente BOOLEAN DEFAULT FALSE,
  climatisation_type VARCHAR(30), -- split, centralisee, vmc_double_flux, autre
  climatisation_marque VARCHAR(100),
  climatisation_puissance_kw DECIMAL(10,2),
  climatisation_date_entretien DATE,
  climatisation_etat VARCHAR(20),
  climatisation_observations TEXT,

  -- Chauffage
  chauffage_type VARCHAR(30), -- electrique, gaz, fioul, pompe_chaleur, autre
  chauffage_equipements TEXT[],
  chauffage_etat VARCHAR(20),
  chauffage_date_entretien DATE,
  chauffage_observations TEXT,

  -- Ventilation
  ventilation_type VARCHAR(30), -- naturelle, vmc_simple, vmc_double, extraction
  ventilation_etat VARCHAR(20),
  ventilation_observations TEXT,

  -- Électricité
  electricite_puissance_kva DECIMAL(10,2),
  electricite_tableau_conforme BOOLEAN DEFAULT FALSE,
  electricite_differentiel_present BOOLEAN DEFAULT FALSE,
  electricite_nb_prises INTEGER,
  electricite_nb_circuits INTEGER,
  electricite_date_diagnostic DATE,
  electricite_observations TEXT,

  -- Plomberie
  plomberie_arrivee_eau BOOLEAN DEFAULT TRUE,
  plomberie_evacuation BOOLEAN DEFAULT TRUE,
  plomberie_chauffe_eau_type VARCHAR(50),
  plomberie_chauffe_eau_capacite_l INTEGER,
  plomberie_etat VARCHAR(20),
  plomberie_observations TEXT,

  -- Télécom/IT
  telecom_lignes_telephoniques INTEGER DEFAULT 0,
  telecom_fibre_optique BOOLEAN DEFAULT FALSE,
  telecom_prises_rj45 INTEGER DEFAULT 0,
  telecom_baie_brassage BOOLEAN DEFAULT FALSE,
  telecom_observations TEXT,

  photos JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 7. TABLE: edl_commercial_compteurs
-- Relevés des compteurs
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_compteurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Compteur électrique
  compteur_elec_numero VARCHAR(50),
  compteur_elec_index DECIMAL(15,2),
  compteur_elec_type VARCHAR(30), -- linky, electronique, mecanique
  compteur_elec_puissance_kva DECIMAL(10,2),
  compteur_elec_photo TEXT,

  -- Compteur gaz
  compteur_gaz_present BOOLEAN DEFAULT FALSE,
  compteur_gaz_numero VARCHAR(50),
  compteur_gaz_index_m3 DECIMAL(15,2),
  compteur_gaz_photo TEXT,

  -- Compteur eau
  compteur_eau_numero VARCHAR(50),
  compteur_eau_index_m3 DECIMAL(15,2),
  compteur_eau_divisionnaire BOOLEAN DEFAULT FALSE,
  compteur_eau_photo TEXT,

  -- Télécom
  ligne_telephonique_numero VARCHAR(50),
  acces_internet_type VARCHAR(20), -- adsl, fibre, cable, autre
  debit_internet_mbps INTEGER,

  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 8. TABLE: edl_commercial_zones
-- Zones/Pièces du local
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Identification
  categorie VARCHAR(50) NOT NULL, -- facade_vitrine, zone_accueil, zone_vente, etc.
  nom VARCHAR(100) NOT NULL,
  surface_m2 DECIMAL(10,2),

  -- État
  etat_general VARCHAR(20) DEFAULT 'bon',
  conformite VARCHAR(20) DEFAULT 'conforme',

  -- Détails
  observations TEXT,

  -- Ordre d'affichage
  ordre INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_zones_edl_id ON edl_commercial_zones(edl_commercial_id);

-- =============================================================================
-- 9. TABLE: edl_commercial_items
-- Éléments d'inspection détaillés
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES edl_commercial_zones(id) ON DELETE CASCADE,

  -- Identification
  categorie VARCHAR(50) NOT NULL,
  sous_categorie VARCHAR(50),
  nom VARCHAR(255) NOT NULL,
  description TEXT,

  -- État
  etat VARCHAR(20) DEFAULT 'bon',
  conformite VARCHAR(20),
  quantite INTEGER DEFAULT 1,

  -- Dimensions (optionnel)
  longueur_m DECIMAL(10,2),
  largeur_m DECIMAL(10,2),
  hauteur_m DECIMAL(10,2),
  surface_m2 DECIMAL(10,2),

  -- Observations
  observations TEXT,
  defauts TEXT[],
  action_requise TEXT,
  estimation_reparation DECIMAL(12,2),

  -- Photos
  photos JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_items_edl_id ON edl_commercial_items(edl_commercial_id);
CREATE INDEX IF NOT EXISTS idx_edl_commercial_items_zone_id ON edl_commercial_items(zone_id);
CREATE INDEX IF NOT EXISTS idx_edl_commercial_items_categorie ON edl_commercial_items(categorie);

-- =============================================================================
-- 10. TABLE: edl_commercial_equipements
-- Équipements fournis par le bailleur
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_equipements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  categorie VARCHAR(100) NOT NULL,
  designation VARCHAR(255) NOT NULL,
  marque VARCHAR(100),
  modele VARCHAR(100),
  numero_serie VARCHAR(100),
  date_installation DATE,
  etat VARCHAR(20) DEFAULT 'bon',
  valeur_estimee DECIMAL(12,2),
  photo TEXT,
  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_equipements_edl_id ON edl_commercial_equipements(edl_commercial_id);

-- =============================================================================
-- 11. TABLE: edl_commercial_cles
-- Clés et badges remis
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_cles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  type_cle VARCHAR(50) NOT NULL, -- porte_principale, porte_service, rideau_metallique, etc.
  description VARCHAR(255),
  quantite INTEGER DEFAULT 1,
  numero_badge VARCHAR(50),
  photo TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_cles_edl_id ON edl_commercial_cles(edl_commercial_id);

-- =============================================================================
-- 12. TABLE: edl_commercial_documents
-- Documents annexés
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  type_document VARCHAR(50) NOT NULL, -- diagnostic, attestation, photo, plan, facture, autre
  nom VARCHAR(255) NOT NULL,
  description TEXT,
  chemin_fichier VARCHAR(500) NOT NULL,
  date_document DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_documents_edl_id ON edl_commercial_documents(edl_commercial_id);

-- =============================================================================
-- 13. TABLE: edl_commercial_differences
-- Différences constatées (EDL sortie)
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_differences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  categorie VARCHAR(50) NOT NULL,
  element VARCHAR(255) NOT NULL,
  etat_entree VARCHAR(20),
  etat_sortie VARCHAR(20),
  description_degradation TEXT,
  photos_entree JSONB DEFAULT '[]'::jsonb,
  photos_sortie JSONB DEFAULT '[]'::jsonb,
  imputable_preneur BOOLEAN DEFAULT FALSE,
  estimation_reparation DECIMAL(12,2),
  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_differences_edl_id ON edl_commercial_differences(edl_commercial_id);

-- =============================================================================
-- 14. TRIGGERS: Mise à jour automatique updated_at
-- =============================================================================

-- Fonction générique
CREATE OR REPLACE FUNCTION update_edl_commercial_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour toutes les tables
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'edl_commercial',
    'edl_commercial_securite_incendie',
    'edl_commercial_accessibilite_pmr',
    'edl_commercial_facade_vitrine',
    'edl_commercial_enseigne',
    'edl_commercial_installations_techniques',
    'edl_commercial_compteurs',
    'edl_commercial_zones',
    'edl_commercial_items',
    'edl_commercial_equipements',
    'edl_commercial_differences'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_update_%s_timestamp ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trigger_update_%s_timestamp
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_edl_commercial_timestamp()', t, t);
  END LOOP;
END $$;

-- =============================================================================
-- 15. RLS POLICIES
-- =============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE edl_commercial ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_securite_incendie ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_accessibilite_pmr ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_facade_vitrine ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_enseigne ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_installations_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_compteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_equipements ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_cles ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_differences ENABLE ROW LEVEL SECURITY;

-- Policies pour edl_commercial (table principale)
CREATE POLICY "edl_commercial_select_policy" ON edl_commercial
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = edl_commercial.property_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "edl_commercial_insert_policy" ON edl_commercial
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = edl_commercial.property_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "edl_commercial_update_policy" ON edl_commercial
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = edl_commercial.property_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "edl_commercial_delete_policy" ON edl_commercial
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = edl_commercial.property_id
        AND p.owner_id = auth.uid()
    )
    AND status = 'brouillon' -- Seuls les brouillons peuvent être supprimés
  );

-- Macro pour créer les policies des tables liées
DO $$
DECLARE
  child_tables TEXT[] := ARRAY[
    'edl_commercial_securite_incendie',
    'edl_commercial_accessibilite_pmr',
    'edl_commercial_facade_vitrine',
    'edl_commercial_enseigne',
    'edl_commercial_installations_techniques',
    'edl_commercial_compteurs',
    'edl_commercial_zones',
    'edl_commercial_items',
    'edl_commercial_equipements',
    'edl_commercial_cles',
    'edl_commercial_documents',
    'edl_commercial_differences'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY child_tables LOOP
    -- Policy SELECT
    EXECUTE format('CREATE POLICY "%s_select_policy" ON %I
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM edl_commercial ec
          JOIN properties p ON ec.property_id = p.id
          WHERE ec.id = %I.edl_commercial_id
            AND p.owner_id = auth.uid()
        )
      )', t, t, t);

    -- Policy INSERT
    EXECUTE format('CREATE POLICY "%s_insert_policy" ON %I
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM edl_commercial ec
          JOIN properties p ON ec.property_id = p.id
          WHERE ec.id = %I.edl_commercial_id
            AND p.owner_id = auth.uid()
        )
      )', t, t, t);

    -- Policy UPDATE
    EXECUTE format('CREATE POLICY "%s_update_policy" ON %I
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM edl_commercial ec
          JOIN properties p ON ec.property_id = p.id
          WHERE ec.id = %I.edl_commercial_id
            AND p.owner_id = auth.uid()
        )
      )', t, t, t);

    -- Policy DELETE
    EXECUTE format('CREATE POLICY "%s_delete_policy" ON %I
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM edl_commercial ec
          JOIN properties p ON ec.property_id = p.id
          WHERE ec.id = %I.edl_commercial_id
            AND p.owner_id = auth.uid()
            AND ec.status = ''brouillon''
        )
      )', t, t, t);
  END LOOP;
END $$;

-- =============================================================================
-- 16. FONCTION RPC: Obtenir un EDL commercial complet
-- =============================================================================

CREATE OR REPLACE FUNCTION get_edl_commercial_complet(p_edl_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'edl', row_to_json(ec.*),
    'securite_incendie', (SELECT row_to_json(s.*) FROM edl_commercial_securite_incendie s WHERE s.edl_commercial_id = ec.id),
    'accessibilite_pmr', (SELECT row_to_json(a.*) FROM edl_commercial_accessibilite_pmr a WHERE a.edl_commercial_id = ec.id),
    'facade_vitrine', (SELECT row_to_json(f.*) FROM edl_commercial_facade_vitrine f WHERE f.edl_commercial_id = ec.id),
    'enseigne', (SELECT row_to_json(e.*) FROM edl_commercial_enseigne e WHERE e.edl_commercial_id = ec.id),
    'installations_techniques', (SELECT row_to_json(i.*) FROM edl_commercial_installations_techniques i WHERE i.edl_commercial_id = ec.id),
    'compteurs', (SELECT row_to_json(c.*) FROM edl_commercial_compteurs c WHERE c.edl_commercial_id = ec.id),
    'zones', (SELECT COALESCE(jsonb_agg(row_to_json(z.*) ORDER BY z.ordre), '[]'::jsonb) FROM edl_commercial_zones z WHERE z.edl_commercial_id = ec.id),
    'items', (SELECT COALESCE(jsonb_agg(row_to_json(it.*)), '[]'::jsonb) FROM edl_commercial_items it WHERE it.edl_commercial_id = ec.id),
    'equipements', (SELECT COALESCE(jsonb_agg(row_to_json(eq.*)), '[]'::jsonb) FROM edl_commercial_equipements eq WHERE eq.edl_commercial_id = ec.id),
    'cles', (SELECT COALESCE(jsonb_agg(row_to_json(cl.*)), '[]'::jsonb) FROM edl_commercial_cles cl WHERE cl.edl_commercial_id = ec.id),
    'documents', (SELECT COALESCE(jsonb_agg(row_to_json(d.*)), '[]'::jsonb) FROM edl_commercial_documents d WHERE d.edl_commercial_id = ec.id),
    'differences', (SELECT COALESCE(jsonb_agg(row_to_json(df.*)), '[]'::jsonb) FROM edl_commercial_differences df WHERE df.edl_commercial_id = ec.id)
  ) INTO v_result
  FROM edl_commercial ec
  WHERE ec.id = p_edl_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 17. FONCTION RPC: Comparer EDL entrée/sortie
-- =============================================================================

CREATE OR REPLACE FUNCTION compare_edl_commercial(p_edl_sortie_id UUID)
RETURNS TABLE (
  categorie VARCHAR,
  element VARCHAR,
  etat_entree VARCHAR,
  etat_sortie VARCHAR,
  changement BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH edl_sortie AS (
    SELECT ec.id, ec.edl_entree_id
    FROM edl_commercial ec
    WHERE ec.id = p_edl_sortie_id AND ec.type_edl = 'sortie'
  ),
  items_entree AS (
    SELECT categorie, nom, etat
    FROM edl_commercial_items
    WHERE edl_commercial_id = (SELECT edl_entree_id FROM edl_sortie)
  ),
  items_sortie AS (
    SELECT categorie, nom, etat
    FROM edl_commercial_items
    WHERE edl_commercial_id = p_edl_sortie_id
  )
  SELECT
    COALESCE(ie.categorie, is_.categorie)::VARCHAR AS categorie,
    COALESCE(ie.nom, is_.nom)::VARCHAR AS element,
    ie.etat::VARCHAR AS etat_entree,
    is_.etat::VARCHAR AS etat_sortie,
    (ie.etat IS DISTINCT FROM is_.etat) AS changement
  FROM items_entree ie
  FULL OUTER JOIN items_sortie is_ ON ie.categorie = is_.categorie AND ie.nom = is_.nom
  WHERE ie.etat IS DISTINCT FROM is_.etat;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 18. VUE: EDL commerciaux en cours
-- =============================================================================

CREATE OR REPLACE VIEW v_edl_commercial_en_cours AS
SELECT
  ec.id,
  ec.lease_id,
  ec.property_id,
  ec.type_edl,
  ec.type_local,
  ec.type_bail,
  ec.date_edl,
  ec.status,
  ec.surface_totale_m2,
  ec.preneur_raison_sociale,
  p.adresse_complete,
  p.ville,
  l.date_debut AS bail_date_debut,
  ec.created_at,
  ec.updated_at
FROM edl_commercial ec
JOIN properties p ON ec.property_id = p.id
JOIN leases l ON ec.lease_id = l.id
WHERE ec.status IN ('brouillon', 'en_cours', 'a_valider')
ORDER BY ec.date_edl DESC;

-- =============================================================================
-- 19. COMMENTAIRES
-- =============================================================================

COMMENT ON TABLE edl_commercial IS 'État des lieux pour locaux commerciaux et professionnels - GAP-007';
COMMENT ON TABLE edl_commercial_securite_incendie IS 'Conformité ERP et sécurité incendie';
COMMENT ON TABLE edl_commercial_accessibilite_pmr IS 'Conformité accessibilité PMR';
COMMENT ON TABLE edl_commercial_facade_vitrine IS 'Inspection façade et vitrine (commerces)';
COMMENT ON TABLE edl_commercial_enseigne IS 'Inspection enseigne et signalétique';
COMMENT ON TABLE edl_commercial_installations_techniques IS 'Installations techniques (clim, chauffage, électricité, etc.)';
COMMENT ON TABLE edl_commercial_compteurs IS 'Relevés des compteurs';
COMMENT ON TABLE edl_commercial_zones IS 'Zones/Pièces du local';
COMMENT ON TABLE edl_commercial_items IS 'Éléments d''inspection détaillés';
COMMENT ON TABLE edl_commercial_equipements IS 'Équipements fournis par le bailleur';
COMMENT ON TABLE edl_commercial_cles IS 'Clés et badges remis';
COMMENT ON TABLE edl_commercial_documents IS 'Documents annexés à l''EDL';
COMMENT ON TABLE edl_commercial_differences IS 'Différences constatées entre EDL entrée et sortie';


-- ========== 20260127000006_location_gerance.sql ==========
-- Migration: Location-Gérance (Gérance Libre de Fonds de Commerce)
-- GAP-005: Support des contrats de location-gérance
-- Cadre légal: Articles L144-1 à L144-13 du Code de commerce
-- Date: 2026-01-27

-- =============================================================================
-- 1. EXTENSION DU TYPE ENUM lease_type
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'location_gerance'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lease_type')
  ) THEN
    ALTER TYPE lease_type ADD VALUE IF NOT EXISTS 'location_gerance';
  END IF;
END$$;

-- =============================================================================
-- 2. TABLE: fonds_commerce
-- Référentiel des fonds de commerce
-- =============================================================================

CREATE TABLE IF NOT EXISTS fonds_commerce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identification
  nom_commercial VARCHAR(255) NOT NULL,
  enseigne VARCHAR(255),
  type_fonds VARCHAR(50) NOT NULL, -- commerce_detail, restaurant, hotel, etc.
  activite_principale VARCHAR(255) NOT NULL,
  activites_secondaires TEXT[],
  code_ape VARCHAR(10),

  -- Localisation
  adresse_exploitation VARCHAR(500) NOT NULL,
  code_postal VARCHAR(10) NOT NULL,
  ville VARCHAR(100) NOT NULL,
  local_surface_m2 DECIMAL(10,2),

  -- Bail commercial sous-jacent
  bail_commercial_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  bail_commercial_reference VARCHAR(100),
  bail_date_fin DATE,
  bailleur_local_nom VARCHAR(255),

  -- Éléments incorporels
  clientele BOOLEAN DEFAULT TRUE,
  achalandage BOOLEAN DEFAULT TRUE,
  nom_commercial_inclus BOOLEAN DEFAULT TRUE,
  enseigne_incluse BOOLEAN DEFAULT TRUE,
  droit_au_bail BOOLEAN DEFAULT TRUE,
  brevets TEXT[],
  marques TEXT[],
  contrats_exclusivite TEXT[],

  -- Valeur
  valeur_estimee DECIMAL(15,2),
  date_evaluation DATE,
  methode_evaluation VARCHAR(100),

  -- Historique
  date_creation_fonds DATE,
  origine_fonds VARCHAR(50), -- creation, acquisition, heritage, autre
  chiffre_affaires_dernier_exercice DECIMAL(15,2),
  resultat_dernier_exercice DECIMAL(15,2),

  -- Statut
  en_location_gerance BOOLEAN DEFAULT FALSE,
  location_gerance_id UUID, -- Référence au contrat actif

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fonds_commerce_owner_id ON fonds_commerce(owner_id);
CREATE INDEX IF NOT EXISTS idx_fonds_commerce_type_fonds ON fonds_commerce(type_fonds);
CREATE INDEX IF NOT EXISTS idx_fonds_commerce_ville ON fonds_commerce(ville);

-- =============================================================================
-- 3. TABLE: fonds_commerce_licences
-- Licences et autorisations du fonds
-- =============================================================================

CREATE TABLE IF NOT EXISTS fonds_commerce_licences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonds_id UUID NOT NULL REFERENCES fonds_commerce(id) ON DELETE CASCADE,

  type_licence VARCHAR(50) NOT NULL, -- licence_4, licence_3, debit_tabac, pharmacie, etc.
  numero VARCHAR(100),
  date_obtention DATE,
  date_expiration DATE,
  transferable BOOLEAN DEFAULT TRUE,
  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fonds_licences_fonds_id ON fonds_commerce_licences(fonds_id);

-- =============================================================================
-- 4. TABLE: fonds_commerce_equipements
-- Matériel et équipements du fonds
-- =============================================================================

CREATE TABLE IF NOT EXISTS fonds_commerce_equipements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonds_id UUID NOT NULL REFERENCES fonds_commerce(id) ON DELETE CASCADE,

  designation VARCHAR(255) NOT NULL,
  marque VARCHAR(100),
  modele VARCHAR(100),
  numero_serie VARCHAR(100),
  annee_acquisition INTEGER,
  valeur_acquisition DECIMAL(12,2),
  valeur_actuelle DECIMAL(12,2),
  etat VARCHAR(20) DEFAULT 'bon', -- neuf, bon, usage, a_remplacer
  inclus_dans_gerance BOOLEAN DEFAULT TRUE,
  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fonds_equipements_fonds_id ON fonds_commerce_equipements(fonds_id);

-- =============================================================================
-- 5. TABLE: location_gerance_contracts
-- Contrats de location-gérance
-- =============================================================================

CREATE TABLE IF NOT EXISTS location_gerance_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(50) UNIQUE NOT NULL,
  version INTEGER DEFAULT 1,

  -- Fonds de commerce
  fonds_id UUID NOT NULL REFERENCES fonds_commerce(id) ON DELETE RESTRICT,

  -- Loueur (propriétaire du fonds)
  loueur_type VARCHAR(20) NOT NULL, -- personne_physique, personne_morale
  loueur_civilite VARCHAR(20),
  loueur_nom VARCHAR(100),
  loueur_prenom VARCHAR(100),
  loueur_date_naissance DATE,
  loueur_lieu_naissance VARCHAR(100),
  loueur_nationalite VARCHAR(50),
  loueur_raison_sociale VARCHAR(255),
  loueur_forme_juridique VARCHAR(50),
  loueur_capital DECIMAL(15,2),
  loueur_siret VARCHAR(20),
  loueur_rcs VARCHAR(100),
  loueur_representant_nom VARCHAR(100),
  loueur_representant_qualite VARCHAR(100),
  loueur_adresse VARCHAR(500) NOT NULL,
  loueur_code_postal VARCHAR(10) NOT NULL,
  loueur_ville VARCHAR(100) NOT NULL,
  loueur_telephone VARCHAR(20),
  loueur_email VARCHAR(255),
  loueur_regime_fiscal VARCHAR(10),
  loueur_tva_assujetti BOOLEAN DEFAULT FALSE,
  loueur_numero_tva VARCHAR(20),

  -- Gérant (locataire-gérant)
  gerant_type VARCHAR(20) NOT NULL,
  gerant_civilite VARCHAR(20),
  gerant_nom VARCHAR(100),
  gerant_prenom VARCHAR(100),
  gerant_date_naissance DATE,
  gerant_lieu_naissance VARCHAR(100),
  gerant_nationalite VARCHAR(50),
  gerant_raison_sociale VARCHAR(255),
  gerant_forme_juridique VARCHAR(50),
  gerant_capital DECIMAL(15,2),
  gerant_siret VARCHAR(20),
  gerant_rcs VARCHAR(100),
  gerant_rcs_date DATE,
  gerant_rm_numero VARCHAR(100),
  gerant_rm_ville VARCHAR(100),
  gerant_representant_nom VARCHAR(100),
  gerant_representant_qualite VARCHAR(100),
  gerant_adresse VARCHAR(500) NOT NULL,
  gerant_code_postal VARCHAR(10) NOT NULL,
  gerant_ville VARCHAR(100) NOT NULL,
  gerant_telephone VARCHAR(20),
  gerant_email VARCHAR(255),
  gerant_assurance_rc BOOLEAN DEFAULT TRUE,
  gerant_assurance_rc_compagnie VARCHAR(255),
  gerant_assurance_rc_numero VARCHAR(100),
  gerant_assurance_multirisque BOOLEAN DEFAULT FALSE,
  gerant_assurance_multirisque_compagnie VARCHAR(255),

  -- Durée
  duree_type VARCHAR(20) NOT NULL, -- determinee, indeterminee
  duree_mois INTEGER,
  date_debut DATE NOT NULL,
  date_fin DATE,
  tacite_reconduction BOOLEAN DEFAULT TRUE,
  preavis_non_reconduction_mois INTEGER DEFAULT 6,

  -- Redevance
  redevance_type VARCHAR(20) NOT NULL, -- fixe, pourcentage_ca, mixte, progressive
  redevance_montant_fixe_mensuel DECIMAL(12,2),
  redevance_pourcentage_ca DECIMAL(5,2),
  redevance_minimum_garanti DECIMAL(12,2),
  redevance_paliers JSONB, -- Pour type progressive
  redevance_indexation BOOLEAN DEFAULT TRUE,
  redevance_indice VARCHAR(10) DEFAULT 'ILC',
  redevance_indice_base DECIMAL(10,2),
  redevance_indice_trimestre VARCHAR(20),
  redevance_date_revision VARCHAR(5) DEFAULT '01-01',
  redevance_tva_applicable BOOLEAN DEFAULT TRUE,
  redevance_tva_taux DECIMAL(5,2) DEFAULT 20,
  redevance_echeance_jour INTEGER DEFAULT 1,
  redevance_mode_paiement VARCHAR(20) DEFAULT 'virement',

  -- Cautionnement
  cautionnement_type VARCHAR(30), -- depot_especes, garantie_bancaire, caution_solidaire
  cautionnement_montant DECIMAL(12,2),
  cautionnement_banque_nom VARCHAR(255),
  cautionnement_numero VARCHAR(100),
  cautionnement_date_emission DATE,
  cautionnement_caution_nom VARCHAR(255),
  cautionnement_caution_adresse VARCHAR(500),

  -- Stock
  reprise_stock BOOLEAN DEFAULT FALSE,
  stock_valeur_entree DECIMAL(12,2),
  stock_mode_evaluation VARCHAR(50),
  stock_taux_minoration DECIMAL(5,2),
  stock_inventaire_date DATE,

  -- Charges
  charges_locatives_gerant BOOLEAN DEFAULT TRUE,
  taxe_fonciere_gerant BOOLEAN DEFAULT FALSE,
  cfe_gerant BOOLEAN DEFAULT TRUE,
  assurances_gerant TEXT[],

  -- Obligations
  obligation_exploitation_personnelle BOOLEAN DEFAULT TRUE,
  obligation_continuation_activite BOOLEAN DEFAULT TRUE,
  interdiction_sous_location BOOLEAN DEFAULT TRUE,
  interdiction_cession BOOLEAN DEFAULT TRUE,
  obligation_non_concurrence_loueur BOOLEAN DEFAULT TRUE,

  -- Clause non-concurrence gérant
  non_concurrence_active BOOLEAN DEFAULT FALSE,
  non_concurrence_duree_mois INTEGER,
  non_concurrence_perimetre_km INTEGER,
  non_concurrence_activites TEXT[],

  -- Fin de contrat
  clause_resiliation_anticipee BOOLEAN DEFAULT TRUE,
  preavis_resiliation_mois INTEGER DEFAULT 3,
  indemnite_resiliation DECIMAL(12,2),
  conditions_restitution TEXT,

  -- Solidarité (Art. L144-7)
  solidarite_duree_mois INTEGER DEFAULT 6,

  -- Publication JAL
  publication_journal_nom VARCHAR(255),
  publication_date DATE,
  publication_reference VARCHAR(100),

  -- Statut
  status VARCHAR(30) DEFAULT 'draft', -- draft, pending_publication, published, active, suspended, terminated, expired

  -- Signatures
  signed_at TIMESTAMPTZ,
  loueur_signature TEXT,
  loueur_signature_date TIMESTAMPTZ,
  gerant_signature TEXT,
  gerant_signature_date TIMESTAMPTZ,

  -- PDF
  pdf_generated BOOLEAN DEFAULT FALSE,
  pdf_path VARCHAR(500),

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_location_gerance_fonds_id ON location_gerance_contracts(fonds_id);
CREATE INDEX IF NOT EXISTS idx_location_gerance_status ON location_gerance_contracts(status);
CREATE INDEX IF NOT EXISTS idx_location_gerance_date_debut ON location_gerance_contracts(date_debut);
CREATE INDEX IF NOT EXISTS idx_location_gerance_date_fin ON location_gerance_contracts(date_fin);

-- =============================================================================
-- 6. TABLE: location_gerance_redevances
-- Historique des paiements de redevance
-- =============================================================================

CREATE TABLE IF NOT EXISTS location_gerance_redevances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES location_gerance_contracts(id) ON DELETE CASCADE,

  periode VARCHAR(7) NOT NULL, -- Format YYYY-MM
  date_echeance DATE NOT NULL,
  montant_base_ht DECIMAL(12,2) NOT NULL,
  montant_tva DECIMAL(12,2) DEFAULT 0,
  montant_ttc DECIMAL(12,2) NOT NULL,

  -- Si pourcentage CA
  chiffre_affaires_mois DECIMAL(15,2),
  montant_variable DECIMAL(12,2),

  -- Indexation
  indice_applique DECIMAL(10,2),
  coefficient_revision DECIMAL(8,4),

  -- Paiement
  date_paiement DATE,
  mode_paiement VARCHAR(20),
  reference_paiement VARCHAR(100),
  statut VARCHAR(20) DEFAULT 'pending', -- pending, paid, late, partial

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_redevances_contract ON location_gerance_redevances(contract_id);
CREATE INDEX IF NOT EXISTS idx_lg_redevances_periode ON location_gerance_redevances(periode);
CREATE INDEX IF NOT EXISTS idx_lg_redevances_statut ON location_gerance_redevances(statut);

-- =============================================================================
-- 7. TABLE: location_gerance_publications
-- Historique des publications JAL
-- =============================================================================

CREATE TABLE IF NOT EXISTS location_gerance_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES location_gerance_contracts(id) ON DELETE CASCADE,

  type_publication VARCHAR(20) NOT NULL, -- debut, modification, fin
  journal_nom VARCHAR(255) NOT NULL,
  date_publication DATE NOT NULL,
  reference VARCHAR(100),
  texte_publication TEXT,
  document_path VARCHAR(500),
  cout DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_publications_contract ON location_gerance_publications(contract_id);

-- =============================================================================
-- 8. TABLE: location_gerance_documents
-- Documents du contrat
-- =============================================================================

CREATE TABLE IF NOT EXISTS location_gerance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES location_gerance_contracts(id) ON DELETE CASCADE,

  type_document VARCHAR(50) NOT NULL, -- contrat_signe, publication_jal, kbis_gerant, inventaire, etc.
  nom VARCHAR(255) NOT NULL,
  description TEXT,
  chemin_fichier VARCHAR(500) NOT NULL,
  obligatoire BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_documents_contract ON location_gerance_documents(contract_id);

-- =============================================================================
-- 9. TRIGGERS
-- =============================================================================

-- Trigger mise à jour updated_at
CREATE OR REPLACE FUNCTION update_location_gerance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer aux tables
DROP TRIGGER IF EXISTS trigger_update_fonds_commerce_timestamp ON fonds_commerce;
CREATE TRIGGER trigger_update_fonds_commerce_timestamp
  BEFORE UPDATE ON fonds_commerce
  FOR EACH ROW
  EXECUTE FUNCTION update_location_gerance_timestamp();

DROP TRIGGER IF EXISTS trigger_update_lg_contracts_timestamp ON location_gerance_contracts;
CREATE TRIGGER trigger_update_lg_contracts_timestamp
  BEFORE UPDATE ON location_gerance_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_location_gerance_timestamp();

DROP TRIGGER IF EXISTS trigger_update_lg_redevances_timestamp ON location_gerance_redevances;
CREATE TRIGGER trigger_update_lg_redevances_timestamp
  BEFORE UPDATE ON location_gerance_redevances
  FOR EACH ROW
  EXECUTE FUNCTION update_location_gerance_timestamp();

-- Trigger: Mettre à jour le statut du fonds quand un contrat devient actif
CREATE OR REPLACE FUNCTION update_fonds_location_gerance_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le contrat passe à "active"
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    UPDATE fonds_commerce
    SET en_location_gerance = TRUE, location_gerance_id = NEW.id
    WHERE id = NEW.fonds_id;
  END IF;

  -- Si le contrat n'est plus actif
  IF NEW.status IN ('terminated', 'expired') AND OLD.status = 'active' THEN
    UPDATE fonds_commerce
    SET en_location_gerance = FALSE, location_gerance_id = NULL
    WHERE id = NEW.fonds_id AND location_gerance_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fonds_lg_status ON location_gerance_contracts;
CREATE TRIGGER trigger_update_fonds_lg_status
  AFTER UPDATE ON location_gerance_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_fonds_location_gerance_status();

-- =============================================================================
-- 10. RLS POLICIES
-- =============================================================================

-- Activer RLS
ALTER TABLE fonds_commerce ENABLE ROW LEVEL SECURITY;
ALTER TABLE fonds_commerce_licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE fonds_commerce_equipements ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_gerance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_gerance_redevances ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_gerance_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_gerance_documents ENABLE ROW LEVEL SECURITY;

-- Policies pour fonds_commerce
CREATE POLICY "fonds_commerce_select_policy" ON fonds_commerce
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "fonds_commerce_insert_policy" ON fonds_commerce
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "fonds_commerce_update_policy" ON fonds_commerce
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "fonds_commerce_delete_policy" ON fonds_commerce
  FOR DELETE USING (owner_id = auth.uid() AND NOT en_location_gerance);

-- Policies pour location_gerance_contracts (accès via fonds)
CREATE POLICY "lg_contracts_select_policy" ON location_gerance_contracts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = location_gerance_contracts.fonds_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_contracts_insert_policy" ON location_gerance_contracts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = location_gerance_contracts.fonds_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_contracts_update_policy" ON location_gerance_contracts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = location_gerance_contracts.fonds_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_contracts_delete_policy" ON location_gerance_contracts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = location_gerance_contracts.fonds_id
        AND f.owner_id = auth.uid()
    )
    AND status = 'draft'
  );

-- Policies pour tables liées (via contrat)
CREATE POLICY "fonds_licences_policy" ON fonds_commerce_licences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = fonds_commerce_licences.fonds_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "fonds_equipements_policy" ON fonds_commerce_equipements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = fonds_commerce_equipements.fonds_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_redevances_policy" ON location_gerance_redevances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM location_gerance_contracts c
      JOIN fonds_commerce f ON c.fonds_id = f.id
      WHERE c.id = location_gerance_redevances.contract_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_publications_policy" ON location_gerance_publications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM location_gerance_contracts c
      JOIN fonds_commerce f ON c.fonds_id = f.id
      WHERE c.id = location_gerance_publications.contract_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_documents_policy" ON location_gerance_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM location_gerance_contracts c
      JOIN fonds_commerce f ON c.fonds_id = f.id
      WHERE c.id = location_gerance_documents.contract_id
        AND f.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- 11. FONCTIONS RPC
-- =============================================================================

-- Générer référence contrat
CREATE OR REPLACE FUNCTION generate_location_gerance_reference()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
  v_ref TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COUNT(*) + 1 INTO v_count
  FROM location_gerance_contracts
  WHERE reference LIKE 'LG-' || v_year || '-%';

  v_ref := 'LG-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');

  RETURN v_ref;
END;
$$ LANGUAGE plpgsql;

-- Calcul de la redevance avec indexation
CREATE OR REPLACE FUNCTION calculate_location_gerance_redevance(
  p_contract_id UUID,
  p_periode VARCHAR(7),
  p_chiffre_affaires DECIMAL DEFAULT NULL
)
RETURNS TABLE (
  montant_base_ht DECIMAL,
  montant_variable DECIMAL,
  montant_total_ht DECIMAL,
  montant_tva DECIMAL,
  montant_ttc DECIMAL,
  indice_applique DECIMAL,
  coefficient_revision DECIMAL
) AS $$
DECLARE
  v_contract location_gerance_contracts%ROWTYPE;
  v_base DECIMAL;
  v_variable DECIMAL := 0;
  v_total_ht DECIMAL;
  v_tva DECIMAL;
  v_coef DECIMAL := 1;
BEGIN
  -- Récupérer le contrat
  SELECT * INTO v_contract
  FROM location_gerance_contracts
  WHERE id = p_contract_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrat non trouvé';
  END IF;

  -- Calcul du montant de base selon le type
  CASE v_contract.redevance_type
    WHEN 'fixe' THEN
      v_base := v_contract.redevance_montant_fixe_mensuel;

    WHEN 'pourcentage_ca' THEN
      IF p_chiffre_affaires IS NULL THEN
        RAISE EXCEPTION 'Chiffre d''affaires requis pour ce type de redevance';
      END IF;
      v_base := 0;
      v_variable := p_chiffre_affaires * (v_contract.redevance_pourcentage_ca / 100);

    WHEN 'mixte' THEN
      v_base := COALESCE(v_contract.redevance_minimum_garanti, 0);
      IF p_chiffre_affaires IS NOT NULL THEN
        v_variable := GREATEST(0, p_chiffre_affaires * (v_contract.redevance_pourcentage_ca / 100) - v_base);
      END IF;

    ELSE
      v_base := v_contract.redevance_montant_fixe_mensuel;
  END CASE;

  -- TODO: Appliquer l'indexation si activée
  -- (Nécessite une table des indices INSEE)

  v_total_ht := v_base + v_variable;

  -- Calcul TVA
  IF v_contract.redevance_tva_applicable THEN
    v_tva := v_total_ht * (v_contract.redevance_tva_taux / 100);
  ELSE
    v_tva := 0;
  END IF;

  RETURN QUERY SELECT
    v_base AS montant_base_ht,
    v_variable AS montant_variable,
    v_total_ht AS montant_total_ht,
    v_tva AS montant_tva,
    (v_total_ht + v_tva) AS montant_ttc,
    v_contract.redevance_indice_base AS indice_applique,
    v_coef AS coefficient_revision;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtenir contrat complet avec fonds
CREATE OR REPLACE FUNCTION get_location_gerance_complet(p_contract_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'contrat', row_to_json(c.*),
    'fonds', row_to_json(f.*),
    'licences', (
      SELECT COALESCE(jsonb_agg(row_to_json(l.*)), '[]'::jsonb)
      FROM fonds_commerce_licences l WHERE l.fonds_id = c.fonds_id
    ),
    'equipements', (
      SELECT COALESCE(jsonb_agg(row_to_json(e.*)), '[]'::jsonb)
      FROM fonds_commerce_equipements e WHERE e.fonds_id = c.fonds_id
    ),
    'redevances', (
      SELECT COALESCE(jsonb_agg(row_to_json(r.*) ORDER BY r.periode DESC), '[]'::jsonb)
      FROM location_gerance_redevances r WHERE r.contract_id = c.id
    ),
    'publications', (
      SELECT COALESCE(jsonb_agg(row_to_json(p.*) ORDER BY p.date_publication), '[]'::jsonb)
      FROM location_gerance_publications p WHERE p.contract_id = c.id
    ),
    'documents', (
      SELECT COALESCE(jsonb_agg(row_to_json(d.*)), '[]'::jsonb)
      FROM location_gerance_documents d WHERE d.contract_id = c.id
    )
  ) INTO v_result
  FROM location_gerance_contracts c
  JOIN fonds_commerce f ON c.fonds_id = f.id
  WHERE c.id = p_contract_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 12. VUES
-- =============================================================================

-- Vue des contrats de location-gérance actifs
CREATE OR REPLACE VIEW v_location_gerance_actifs AS
SELECT
  c.id,
  c.reference,
  c.status,
  c.date_debut,
  c.date_fin,
  c.duree_type,
  c.redevance_type,
  c.redevance_montant_fixe_mensuel,
  c.redevance_pourcentage_ca,
  f.nom_commercial,
  f.enseigne,
  f.type_fonds,
  f.activite_principale,
  f.adresse_exploitation,
  f.ville,
  CASE c.gerant_type
    WHEN 'personne_physique' THEN c.gerant_nom || ' ' || c.gerant_prenom
    ELSE c.gerant_raison_sociale
  END AS gerant_nom_complet,
  c.gerant_email,
  c.created_at,
  c.updated_at
FROM location_gerance_contracts c
JOIN fonds_commerce f ON c.fonds_id = f.id
WHERE c.status IN ('published', 'active')
ORDER BY c.date_debut DESC;

-- Vue des redevances en retard
CREATE OR REPLACE VIEW v_location_gerance_redevances_retard AS
SELECT
  r.*,
  c.reference AS contrat_reference,
  f.nom_commercial,
  CASE c.gerant_type
    WHEN 'personne_physique' THEN c.gerant_nom || ' ' || c.gerant_prenom
    ELSE c.gerant_raison_sociale
  END AS gerant_nom,
  c.gerant_email,
  CURRENT_DATE - r.date_echeance AS jours_retard
FROM location_gerance_redevances r
JOIN location_gerance_contracts c ON r.contract_id = c.id
JOIN fonds_commerce f ON c.fonds_id = f.id
WHERE r.statut IN ('pending', 'late')
  AND r.date_echeance < CURRENT_DATE
ORDER BY r.date_echeance;

-- =============================================================================
-- 13. COMMENTAIRES
-- =============================================================================

COMMENT ON TABLE fonds_commerce IS
  'Fonds de commerce - Articles L141-1 et suivants du Code de commerce';

COMMENT ON TABLE location_gerance_contracts IS
  'Contrats de location-gérance - Articles L144-1 à L144-13 du Code de commerce';

COMMENT ON COLUMN location_gerance_contracts.solidarite_duree_mois IS
  'Durée de solidarité fiscale et sociale du loueur (Art. L144-7) - 6 mois par défaut après publication';

COMMENT ON TABLE location_gerance_publications IS
  'Publications JAL obligatoires - Art. L144-6 du Code de commerce';


-- ========== 20260127000007_taxe_sejour.sql ==========
-- ============================================
-- Migration: Taxe de Séjour - GAP-006 SOTA 2026
-- ============================================
-- Conformité:
-- - Article L2333-26 à L2333-47 du CGCT
-- - Décret n°2019-1062 (taux plafonds)
-- - Loi de finances 2024 (taxe additionnelle)
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

-- Types d'hébergement touristique
CREATE TYPE hebergement_touristique_type AS ENUM (
  'palace',
  'hotel_5_etoiles',
  'hotel_4_etoiles',
  'hotel_3_etoiles',
  'hotel_2_etoiles',
  'hotel_1_etoile',
  'hotel_non_classe',
  'residence_tourisme_5',
  'residence_tourisme_4',
  'residence_tourisme_3',
  'residence_tourisme_2',
  'residence_tourisme_1',
  'residence_tourisme_nc',
  'meuble_tourisme_5',
  'meuble_tourisme_4',
  'meuble_tourisme_3',
  'meuble_tourisme_2',
  'meuble_tourisme_1',
  'meuble_tourisme_nc',
  'chambre_hotes',
  'camping_5_etoiles',
  'camping_4_etoiles',
  'camping_3_etoiles',
  'camping_2_etoiles',
  'camping_1_etoile',
  'camping_non_classe',
  'village_vacances_4_5',
  'village_vacances_1_2_3',
  'auberge_jeunesse',
  'port_plaisance',
  'aire_camping_car',
  'autre_hebergement'
);

-- Mode de perception
CREATE TYPE mode_perception_taxe AS ENUM (
  'au_reel',
  'au_forfait'
);

-- Statut de déclaration
CREATE TYPE declaration_taxe_status AS ENUM (
  'brouillon',
  'a_declarer',
  'declaree',
  'validee',
  'payee',
  'annulee'
);

-- Motifs d'exonération
CREATE TYPE motif_exoneration_taxe AS ENUM (
  'mineur',
  'intermediaire_agence',
  'travailleur_saisonnier',
  'logement_urgence',
  'resident_secondaire_taxe'
);

-- ============================================
-- TABLE: taxe_sejour_communes
-- Configuration par commune
-- ============================================
CREATE TABLE taxe_sejour_communes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification commune
  code_insee VARCHAR(5) NOT NULL UNIQUE,
  nom_commune VARCHAR(255) NOT NULL,
  code_postal VARCHAR(5) NOT NULL,
  departement VARCHAR(3) NOT NULL,

  -- Configuration taxe
  taxe_active BOOLEAN NOT NULL DEFAULT true,
  mode_perception mode_perception_taxe NOT NULL DEFAULT 'au_reel',

  -- Tarifs par type (€/personne/nuit) - NULL = tarif plafond par défaut
  tarifs JSONB NOT NULL DEFAULT '{}',

  -- Taxe additionnelle départementale (max 10%)
  taxe_additionnelle_departementale NUMERIC(5,2) NOT NULL DEFAULT 10.00
    CHECK (taxe_additionnelle_departementale >= 0 AND taxe_additionnelle_departementale <= 10),

  -- Déclaration
  portail_declaration_url TEXT,
  periodicite_declaration VARCHAR(20) NOT NULL DEFAULT 'trimestrielle'
    CHECK (periodicite_declaration IN ('mensuelle', 'trimestrielle', 'annuelle')),
  jour_limite_declaration INTEGER NOT NULL DEFAULT 15
    CHECK (jour_limite_declaration >= 1 AND jour_limite_declaration <= 28),

  -- Métadonnées
  observations TEXT,
  date_debut_validite DATE NOT NULL DEFAULT CURRENT_DATE,
  date_fin_validite DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche par code postal / département
CREATE INDEX idx_taxe_sejour_communes_code_postal ON taxe_sejour_communes(code_postal);
CREATE INDEX idx_taxe_sejour_communes_departement ON taxe_sejour_communes(departement);

-- ============================================
-- TABLE: sejours_touristiques
-- Séjours soumis à taxe de séjour
-- ============================================
CREATE TABLE sejours_touristiques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commune_config_id UUID REFERENCES taxe_sejour_communes(id),

  -- Classification hébergement
  type_hebergement hebergement_touristique_type NOT NULL DEFAULT 'meuble_tourisme_nc',
  numero_enregistrement VARCHAR(50), -- Obligatoire dans certaines villes

  -- Dates du séjour
  date_arrivee DATE NOT NULL,
  date_depart DATE NOT NULL,
  nombre_nuitees INTEGER NOT NULL GENERATED ALWAYS AS (date_depart - date_arrivee) STORED,

  -- Occupants (JSONB array)
  occupants JSONB NOT NULL DEFAULT '[]',
  nombre_occupants_total INTEGER NOT NULL DEFAULT 0,
  nombre_occupants_assujettis INTEGER NOT NULL DEFAULT 0,

  -- Calcul de la taxe
  taux_applique NUMERIC(10,2) NOT NULL DEFAULT 0,
  taux_additionnel_departemental NUMERIC(5,2) NOT NULL DEFAULT 0,
  montant_taxe_collectee NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_taxe_additionnelle NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_total NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Collecte
  taxe_collectee BOOLEAN NOT NULL DEFAULT false,
  date_collecte DATE,
  moyen_paiement_taxe VARCHAR(20)
    CHECK (moyen_paiement_taxe IN ('especes', 'cb', 'virement', 'inclus_loyer')),

  -- Lien vers déclaration
  declaration_id UUID REFERENCES declarations_taxe_sejour(id),

  -- Métadonnées
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT dates_sejour_valides CHECK (date_depart > date_arrivee),
  CONSTRAINT nuitees_max CHECK (nombre_nuitees <= 90) -- Max location saisonnière
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_sejours_touristiques_lease ON sejours_touristiques(lease_id);
CREATE INDEX idx_sejours_touristiques_property ON sejours_touristiques(property_id);
CREATE INDEX idx_sejours_touristiques_owner ON sejours_touristiques(owner_id);
CREATE INDEX idx_sejours_touristiques_dates ON sejours_touristiques(date_arrivee, date_depart);
CREATE INDEX idx_sejours_touristiques_non_collectes ON sejours_touristiques(owner_id)
  WHERE NOT taxe_collectee;
CREATE INDEX idx_sejours_touristiques_non_declares ON sejours_touristiques(owner_id)
  WHERE declaration_id IS NULL AND taxe_collectee;

-- ============================================
-- TABLE: declarations_taxe_sejour
-- Déclarations périodiques à la commune
-- ============================================
CREATE TABLE declarations_taxe_sejour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commune_config_id UUID NOT NULL REFERENCES taxe_sejour_communes(id),

  -- Période
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,
  annee_fiscale INTEGER NOT NULL,
  periode_reference VARCHAR(10) NOT NULL, -- "2026-Q1" ou "2026-01"

  -- Statut
  statut declaration_taxe_status NOT NULL DEFAULT 'brouillon',

  -- Totaux calculés
  total_nuitees INTEGER NOT NULL DEFAULT 0,
  total_personnes_assujetties INTEGER NOT NULL DEFAULT 0,
  montant_taxe_totale NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_taxe_additionnelle NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_total_a_reverser NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Échéances
  date_limite DATE NOT NULL,
  date_declaration DATE,
  reference_declaration VARCHAR(100),

  -- Paiement
  date_paiement DATE,
  reference_paiement VARCHAR(100),
  moyen_paiement VARCHAR(20)
    CHECK (moyen_paiement IN ('virement', 'prelevement', 'cheque', 'telepaiement')),

  -- Documents
  justificatif_id UUID REFERENCES documents(id),

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT periode_declaration_valide CHECK (periode_fin >= periode_debut)
);

-- Ajouter la foreign key maintenant que la table existe
ALTER TABLE sejours_touristiques
  ADD CONSTRAINT fk_sejours_declaration
  FOREIGN KEY (declaration_id) REFERENCES declarations_taxe_sejour(id) ON DELETE SET NULL;

-- Index
CREATE INDEX idx_declarations_taxe_owner ON declarations_taxe_sejour(owner_id);
CREATE INDEX idx_declarations_taxe_commune ON declarations_taxe_sejour(commune_config_id);
CREATE INDEX idx_declarations_taxe_periode ON declarations_taxe_sejour(annee_fiscale, periode_reference);
CREATE INDEX idx_declarations_taxe_statut ON declarations_taxe_sejour(statut);
CREATE INDEX idx_declarations_taxe_en_retard ON declarations_taxe_sejour(owner_id, date_limite)
  WHERE statut IN ('brouillon', 'a_declarer');

-- ============================================
-- TABLE: tarifs_plafonds_taxe_sejour
-- Référentiel des tarifs plafonds légaux
-- ============================================
CREATE TABLE tarifs_plafonds_taxe_sejour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  type_hebergement hebergement_touristique_type NOT NULL UNIQUE,
  tarif_plafond NUMERIC(10,2) NOT NULL,
  annee_reference INTEGER NOT NULL DEFAULT 2024,

  -- Source légale
  reference_legale TEXT NOT NULL DEFAULT 'Article L2333-30 CGCT',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer les tarifs plafonds 2024
INSERT INTO tarifs_plafonds_taxe_sejour (type_hebergement, tarif_plafond, annee_reference) VALUES
  ('palace', 15.00, 2024),
  ('hotel_5_etoiles', 5.00, 2024),
  ('hotel_4_etoiles', 2.88, 2024),
  ('hotel_3_etoiles', 1.70, 2024),
  ('hotel_2_etoiles', 1.00, 2024),
  ('hotel_1_etoile', 0.90, 2024),
  ('hotel_non_classe', 0.90, 2024),
  ('residence_tourisme_5', 5.00, 2024),
  ('residence_tourisme_4', 2.88, 2024),
  ('residence_tourisme_3', 1.70, 2024),
  ('residence_tourisme_2', 1.00, 2024),
  ('residence_tourisme_1', 0.90, 2024),
  ('residence_tourisme_nc', 0.90, 2024),
  ('meuble_tourisme_5', 5.00, 2024),
  ('meuble_tourisme_4', 2.88, 2024),
  ('meuble_tourisme_3', 1.70, 2024),
  ('meuble_tourisme_2', 1.00, 2024),
  ('meuble_tourisme_1', 0.90, 2024),
  ('meuble_tourisme_nc', 0.90, 2024),
  ('chambre_hotes', 0.90, 2024),
  ('camping_5_etoiles', 0.70, 2024),
  ('camping_4_etoiles', 0.60, 2024),
  ('camping_3_etoiles', 0.55, 2024),
  ('camping_2_etoiles', 0.33, 2024),
  ('camping_1_etoile', 0.25, 2024),
  ('camping_non_classe', 0.25, 2024),
  ('village_vacances_4_5', 1.00, 2024),
  ('village_vacances_1_2_3', 0.90, 2024),
  ('auberge_jeunesse', 0.25, 2024),
  ('port_plaisance', 0.25, 2024),
  ('aire_camping_car', 0.25, 2024),
  ('autre_hebergement', 0.90, 2024);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE taxe_sejour_communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sejours_touristiques ENABLE ROW LEVEL SECURITY;
ALTER TABLE declarations_taxe_sejour ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifs_plafonds_taxe_sejour ENABLE ROW LEVEL SECURITY;

-- Communes: lecture publique (référentiel)
CREATE POLICY "Communes lisibles par tous" ON taxe_sejour_communes
  FOR SELECT USING (true);

-- Tarifs plafonds: lecture publique
CREATE POLICY "Tarifs plafonds lisibles par tous" ON tarifs_plafonds_taxe_sejour
  FOR SELECT USING (true);

-- Séjours: accès propriétaire uniquement
CREATE POLICY "Séjours visibles par propriétaire" ON sejours_touristiques
  FOR SELECT USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Séjours créables par propriétaire" ON sejours_touristiques
  FOR INSERT WITH CHECK (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Séjours modifiables par propriétaire" ON sejours_touristiques
  FOR UPDATE USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Séjours supprimables par propriétaire" ON sejours_touristiques
  FOR DELETE USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND declaration_id IS NULL -- Ne pas supprimer si déjà déclaré
  );

-- Déclarations: accès propriétaire uniquement
CREATE POLICY "Déclarations visibles par propriétaire" ON declarations_taxe_sejour
  FOR SELECT USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Déclarations créables par propriétaire" ON declarations_taxe_sejour
  FOR INSERT WITH CHECK (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Déclarations modifiables par propriétaire" ON declarations_taxe_sejour
  FOR UPDATE USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND statut NOT IN ('payee', 'validee') -- Pas de modification après paiement
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger updated_at
CREATE TRIGGER set_updated_at_taxe_sejour_communes
  BEFORE UPDATE ON taxe_sejour_communes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_sejours_touristiques
  BEFORE UPDATE ON sejours_touristiques
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_declarations_taxe_sejour
  BEFORE UPDATE ON declarations_taxe_sejour
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================
-- FONCTIONS RPC
-- ============================================

-- Calculer la taxe pour un séjour
CREATE OR REPLACE FUNCTION calculate_taxe_sejour(
  p_nuitees INTEGER,
  p_occupants JSONB,
  p_type_hebergement hebergement_touristique_type,
  p_code_insee VARCHAR(5) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_taux_unitaire NUMERIC(10,2);
  v_taux_additionnel NUMERIC(5,2) := 10.00;
  v_occupants_assujettis INTEGER := 0;
  v_occupants_exoneres INTEGER := 0;
  v_taxe_base NUMERIC(10,2);
  v_taxe_additionnelle NUMERIC(10,2);
  v_total NUMERIC(10,2);
  v_occupant JSONB;
BEGIN
  -- Récupérer le taux plafond par défaut
  SELECT tarif_plafond INTO v_taux_unitaire
  FROM tarifs_plafonds_taxe_sejour
  WHERE type_hebergement = p_type_hebergement;

  -- Si commune spécifiée, utiliser son taux
  IF p_code_insee IS NOT NULL THEN
    SELECT
      COALESCE((tarifs->>p_type_hebergement::text)::numeric, v_taux_unitaire),
      taxe_additionnelle_departementale
    INTO v_taux_unitaire, v_taux_additionnel
    FROM taxe_sejour_communes
    WHERE code_insee = p_code_insee
      AND taxe_active = true;
  END IF;

  -- Compter les occupants assujettis
  FOR v_occupant IN SELECT * FROM jsonb_array_elements(p_occupants)
  LOOP
    IF (v_occupant->>'est_mineur')::boolean = true
       OR v_occupant->>'exoneration' IS NOT NULL THEN
      v_occupants_exoneres := v_occupants_exoneres + 1;
    ELSE
      v_occupants_assujettis := v_occupants_assujettis + 1;
    END IF;
  END LOOP;

  -- Calcul
  v_taxe_base := p_nuitees * v_occupants_assujettis * v_taux_unitaire;
  v_taxe_additionnelle := v_taxe_base * (v_taux_additionnel / 100);
  v_total := v_taxe_base + v_taxe_additionnelle;

  RETURN jsonb_build_object(
    'nuitees', p_nuitees,
    'occupants_assujettis', v_occupants_assujettis,
    'occupants_exoneres', v_occupants_exoneres,
    'taux_unitaire', v_taux_unitaire,
    'taxe_base', ROUND(v_taxe_base, 2),
    'taux_additionnel_pct', v_taux_additionnel,
    'taxe_additionnelle', ROUND(v_taxe_additionnelle, 2),
    'total', ROUND(v_total, 2),
    'formule', p_nuitees || ' nuits × ' || v_occupants_assujettis || ' pers. × ' ||
               v_taux_unitaire || '€ = ' || ROUND(v_taxe_base, 2) || '€'
  );
END;
$$;

-- Récupérer les statistiques de taxe de séjour pour un propriétaire
CREATE OR REPLACE FUNCTION get_taxe_sejour_stats(
  p_owner_id UUID,
  p_annee INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH stats AS (
    SELECT
      COUNT(*) as nombre_sejours,
      COALESCE(SUM(nombre_nuitees), 0) as total_nuitees,
      COALESCE(SUM(nombre_occupants_assujettis), 0) as total_personnes,
      COALESCE(SUM(CASE WHEN taxe_collectee THEN montant_total ELSE 0 END), 0) as total_collecte,
      COALESCE(SUM(montant_total), 0) as total_a_reverser,
      COALESCE(SUM(CASE WHEN NOT taxe_collectee THEN montant_total ELSE 0 END), 0) as en_attente
    FROM sejours_touristiques
    WHERE owner_id = p_owner_id
      AND EXTRACT(YEAR FROM date_arrivee) = p_annee
  ),
  declarations AS (
    SELECT
      COUNT(*) FILTER (WHERE statut IN ('brouillon', 'a_declarer')) as en_cours,
      COUNT(*) FILTER (WHERE statut IN ('brouillon', 'a_declarer') AND date_limite < CURRENT_DATE) as en_retard
    FROM declarations_taxe_sejour
    WHERE owner_id = p_owner_id
      AND annee_fiscale = p_annee
  ),
  par_type AS (
    SELECT
      type_hebergement,
      SUM(nombre_nuitees) as nuitees,
      SUM(montant_total) as montant
    FROM sejours_touristiques
    WHERE owner_id = p_owner_id
      AND EXTRACT(YEAR FROM date_arrivee) = p_annee
    GROUP BY type_hebergement
  )
  SELECT jsonb_build_object(
    'periode', jsonb_build_object(
      'debut', p_annee || '-01-01',
      'fin', p_annee || '-12-31'
    ),
    'nombre_sejours', s.nombre_sejours,
    'total_nuitees', s.total_nuitees,
    'total_personnes', s.total_personnes,
    'total_taxe_collectee', s.total_collecte,
    'total_taxe_a_reverser', s.total_a_reverser,
    'taxe_en_attente', s.en_attente,
    'declarations_en_cours', d.en_cours,
    'declarations_en_retard', d.en_retard,
    'par_type_hebergement', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'type', type_hebergement,
        'nuitees', nuitees,
        'montant', montant
      )) FROM par_type),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM stats s, declarations d;

  RETURN v_result;
END;
$$;

-- Créer une déclaration avec les séjours de la période
CREATE OR REPLACE FUNCTION create_declaration_taxe_sejour(
  p_owner_id UUID,
  p_commune_config_id UUID,
  p_periode_debut DATE,
  p_periode_fin DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_declaration_id UUID;
  v_annee INTEGER;
  v_periode_ref VARCHAR(10);
  v_totaux RECORD;
  v_date_limite DATE;
  v_periodicite VARCHAR(20);
  v_jour_limite INTEGER;
BEGIN
  -- Récupérer la config commune
  SELECT periodicite_declaration, jour_limite_declaration
  INTO v_periodicite, v_jour_limite
  FROM taxe_sejour_communes
  WHERE id = p_commune_config_id;

  -- Calculer période de référence et date limite
  v_annee := EXTRACT(YEAR FROM p_periode_debut);

  IF v_periodicite = 'mensuelle' THEN
    v_periode_ref := TO_CHAR(p_periode_debut, 'YYYY-MM');
    v_date_limite := (DATE_TRUNC('month', p_periode_fin) + INTERVAL '1 month' + (v_jour_limite - 1) * INTERVAL '1 day')::date;
  ELSIF v_periodicite = 'trimestrielle' THEN
    v_periode_ref := v_annee || '-Q' || CEIL(EXTRACT(MONTH FROM p_periode_debut) / 3.0)::integer;
    v_date_limite := (DATE_TRUNC('quarter', p_periode_fin) + INTERVAL '3 months' + (v_jour_limite - 1) * INTERVAL '1 day')::date;
  ELSE -- annuelle
    v_periode_ref := v_annee::text;
    v_date_limite := MAKE_DATE(v_annee + 1, 1, v_jour_limite);
  END IF;

  -- Calculer les totaux des séjours de la période
  SELECT
    COALESCE(SUM(nombre_nuitees), 0),
    COALESCE(SUM(nombre_occupants_assujettis), 0),
    COALESCE(SUM(montant_taxe_collectee), 0),
    COALESCE(SUM(montant_taxe_additionnelle), 0),
    COALESCE(SUM(montant_total), 0)
  INTO v_totaux
  FROM sejours_touristiques
  WHERE owner_id = p_owner_id
    AND commune_config_id = p_commune_config_id
    AND date_arrivee >= p_periode_debut
    AND date_depart <= p_periode_fin
    AND declaration_id IS NULL
    AND taxe_collectee = true;

  -- Créer la déclaration
  INSERT INTO declarations_taxe_sejour (
    owner_id,
    commune_config_id,
    periode_debut,
    periode_fin,
    annee_fiscale,
    periode_reference,
    date_limite,
    total_nuitees,
    total_personnes_assujetties,
    montant_taxe_totale,
    montant_taxe_additionnelle,
    montant_total_a_reverser
  ) VALUES (
    p_owner_id,
    p_commune_config_id,
    p_periode_debut,
    p_periode_fin,
    v_annee,
    v_periode_ref,
    v_date_limite,
    v_totaux.sum,
    v_totaux.sum,
    v_totaux.sum,
    v_totaux.sum,
    v_totaux.sum
  )
  RETURNING id INTO v_declaration_id;

  -- Associer les séjours à cette déclaration
  UPDATE sejours_touristiques
  SET declaration_id = v_declaration_id
  WHERE owner_id = p_owner_id
    AND commune_config_id = p_commune_config_id
    AND date_arrivee >= p_periode_debut
    AND date_depart <= p_periode_fin
    AND declaration_id IS NULL
    AND taxe_collectee = true;

  RETURN v_declaration_id;
END;
$$;

-- ============================================
-- VUES
-- ============================================

-- Vue des séjours avec calculs
CREATE OR REPLACE VIEW v_sejours_touristiques_complets AS
SELECT
  s.*,
  l.type_bail,
  l.date_debut as bail_date_debut,
  l.date_fin as bail_date_fin,
  p.adresse_complete,
  p.code_postal as property_code_postal,
  p.ville,
  c.nom_commune,
  c.code_insee,
  c.taxe_additionnelle_departementale,
  CASE
    WHEN s.taxe_collectee THEN 'Collectée'
    WHEN s.date_depart < CURRENT_DATE THEN 'À collecter'
    ELSE 'En cours'
  END as statut_collecte,
  CASE
    WHEN s.declaration_id IS NOT NULL THEN 'Déclaré'
    WHEN s.taxe_collectee AND s.declaration_id IS NULL THEN 'À déclarer'
    ELSE 'En attente'
  END as statut_declaration
FROM sejours_touristiques s
JOIN leases l ON s.lease_id = l.id
JOIN properties p ON s.property_id = p.id
LEFT JOIN taxe_sejour_communes c ON s.commune_config_id = c.id;

-- Vue des déclarations en retard
CREATE OR REPLACE VIEW v_declarations_taxe_en_retard AS
SELECT
  d.*,
  c.nom_commune,
  c.code_insee,
  CURRENT_DATE - d.date_limite as jours_retard
FROM declarations_taxe_sejour d
JOIN taxe_sejour_communes c ON d.commune_config_id = c.id
WHERE d.statut IN ('brouillon', 'a_declarer')
  AND d.date_limite < CURRENT_DATE;

-- ============================================
-- DONNÉES INITIALES - Quelques communes exemple
-- ============================================

INSERT INTO taxe_sejour_communes (code_insee, nom_commune, code_postal, departement, tarifs, observations) VALUES
  ('75056', 'Paris', '75001', '75',
   '{"palace": 15.00, "hotel_5_etoiles": 5.00, "hotel_4_etoiles": 2.88, "hotel_3_etoiles": 1.70, "hotel_2_etoiles": 1.00, "meuble_tourisme_nc": 0.90}'::jsonb,
   'Déclaration via paris.fr - Numéro enregistrement obligatoire'),
  ('13055', 'Marseille', '13001', '13',
   '{"meuble_tourisme_nc": 0.83, "meuble_tourisme_1": 0.83, "meuble_tourisme_2": 0.94, "meuble_tourisme_3": 1.50}'::jsonb,
   'Déclaration via taxesejour-marseille.fr'),
  ('69123', 'Lyon', '69001', '69',
   '{"meuble_tourisme_nc": 0.88, "meuble_tourisme_3": 1.65, "meuble_tourisme_4": 2.50}'::jsonb,
   'Déclaration via lyon.fr'),
  ('06088', 'Nice', '06000', '06',
   '{"meuble_tourisme_nc": 0.90, "meuble_tourisme_3": 1.70, "meuble_tourisme_4": 2.88}'::jsonb,
   'Déclaration via nice.fr');

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON TABLE taxe_sejour_communes IS 'Configuration de la taxe de séjour par commune - Article L2333-26 CGCT';
COMMENT ON TABLE sejours_touristiques IS 'Séjours touristiques soumis à taxe de séjour';
COMMENT ON TABLE declarations_taxe_sejour IS 'Déclarations périodiques de taxe de séjour à reverser aux communes';
COMMENT ON TABLE tarifs_plafonds_taxe_sejour IS 'Référentiel des tarifs plafonds légaux par type d''hébergement';

COMMENT ON FUNCTION calculate_taxe_sejour IS 'Calcule le montant de taxe de séjour pour un séjour donné';
COMMENT ON FUNCTION get_taxe_sejour_stats IS 'Récupère les statistiques de taxe de séjour pour un propriétaire';
COMMENT ON FUNCTION create_declaration_taxe_sejour IS 'Crée une déclaration de taxe de séjour avec les séjours de la période';


-- ========== 20260127000008_diagnostics_dom_tom.sql ==========
-- ============================================
-- Migration: Diagnostics DOM-TOM - GAP-009/010/011 SOTA 2026
-- ============================================
-- Spécificités réglementaires des départements d'outre-mer:
-- - 971: Guadeloupe, 972: Martinique, 973: Guyane
-- - 974: La Réunion, 976: Mayotte
--
-- Conformité:
-- - Loi n°99-471 du 8 juin 1999 (termites)
-- - Code de l'environnement (risques naturels DOM)
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

-- États d'infestation termites
CREATE TYPE etat_termites AS ENUM (
  'absence',
  'indices_anciens',
  'presence_active',
  'non_visible'
);

-- Types de termites tropicaux
CREATE TYPE type_termite AS ENUM (
  'reticulitermes',
  'cryptotermes',
  'coptotermes',
  'nasutitermes',
  'heterotermes'
);

-- Zones d'inspection termites
CREATE TYPE zone_diagnostic_termites AS ENUM (
  'interieur',
  'exterieur',
  'parties_communes',
  'dependances'
);

-- Risques naturels spécifiques DOM
CREATE TYPE risque_naturel_dom AS ENUM (
  'cyclone',
  'seisme',
  'volcan',
  'tsunami',
  'inondation',
  'mouvement_terrain',
  'submersion_marine',
  'erosion_cotiere',
  'recul_trait_cote',
  'radon',
  'feu_foret'
);

-- Zones volcaniques
CREATE TYPE zone_volcanique AS ENUM (
  'zone_interdite',
  'zone_danger_immediat',
  'zone_proximite',
  'zone_eloignee'
);

-- ============================================
-- TABLE: diagnostics_termites
-- Diagnostic termites obligatoire en DOM
-- ============================================
CREATE TABLE diagnostics_termites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Bien concerné
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Diagnostiqueur
  diagnostiqueur_nom VARCHAR(255) NOT NULL,
  diagnostiqueur_certification VARCHAR(100) NOT NULL,
  numero_certification VARCHAR(50) NOT NULL,
  assurance_rc VARCHAR(100) NOT NULL,
  date_validite_certification DATE NOT NULL,

  -- Dates
  date_diagnostic DATE NOT NULL,
  date_validite DATE NOT NULL, -- 6 mois après diagnostic

  -- Localisation
  departement VARCHAR(3) NOT NULL,
  commune VARCHAR(255) NOT NULL,
  zone_arrete_prefectoral BOOLEAN NOT NULL DEFAULT true, -- Tout DOM est en zone arrêté
  reference_arrete VARCHAR(100),

  -- Résultat global
  conclusion etat_termites NOT NULL,
  presence_active BOOLEAN NOT NULL DEFAULT false,

  -- Types identifiés
  types_termites_identifies type_termite[] DEFAULT '{}',

  -- Traitement existant
  traitement_preventif_existant BOOLEAN NOT NULL DEFAULT false,
  date_dernier_traitement DATE,

  -- Recommandations
  recommandations TEXT[] DEFAULT '{}',

  -- Document
  document_id UUID REFERENCES documents(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte de validité (6 mois)
  CONSTRAINT validite_6_mois CHECK (date_validite = date_diagnostic + INTERVAL '6 months')
);

-- Index
CREATE INDEX idx_diagnostics_termites_property ON diagnostics_termites(property_id);
CREATE INDEX idx_diagnostics_termites_owner ON diagnostics_termites(owner_id);
CREATE INDEX idx_diagnostics_termites_departement ON diagnostics_termites(departement);
CREATE INDEX idx_diagnostics_termites_validite ON diagnostics_termites(date_validite);
CREATE INDEX idx_diagnostics_termites_actifs ON diagnostics_termites(property_id)
  WHERE presence_active = true;

-- ============================================
-- TABLE: diagnostics_termites_zones
-- Détail par zone inspectée
-- ============================================
CREATE TABLE diagnostics_termites_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  diagnostic_id UUID NOT NULL REFERENCES diagnostics_termites(id) ON DELETE CASCADE,

  zone zone_diagnostic_termites NOT NULL,
  localisation VARCHAR(255) NOT NULL,
  etat etat_termites NOT NULL,
  elements_infestes TEXT[] DEFAULT '{}',
  observations TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_termites_zones_diagnostic ON diagnostics_termites_zones(diagnostic_id);

-- ============================================
-- TABLE: erp_dom_tom
-- État des Risques et Pollutions spécifique DOM
-- ============================================
CREATE TABLE erp_dom_tom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Bien concerné
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Localisation
  departement VARCHAR(3) NOT NULL CHECK (departement IN ('971', '972', '973', '974', '976')),
  commune VARCHAR(255) NOT NULL,

  -- Dates
  date_erp DATE NOT NULL,
  date_validite DATE NOT NULL, -- 6 mois

  -- Zone sismique (tous les DOM sont >= 2)
  zone_sismique INTEGER NOT NULL CHECK (zone_sismique BETWEEN 1 AND 5),

  -- Zone cyclonique
  zone_cyclonique BOOLEAN NOT NULL DEFAULT false,
  normes_paracycloniques BOOLEAN NOT NULL DEFAULT false,

  -- Zone volcanique
  zone_volcanique zone_volcanique,
  distance_volcan_km NUMERIC(10,2),
  volcan_reference VARCHAR(100),

  -- Tsunami
  risque_tsunami BOOLEAN NOT NULL DEFAULT false,

  -- Submersion marine
  zone_submersion_marine BOOLEAN NOT NULL DEFAULT false,

  -- Inondation
  zone_inondable BOOLEAN NOT NULL DEFAULT false,

  -- PPRN
  pprn_existe BOOLEAN NOT NULL DEFAULT false,
  pprn_reference VARCHAR(100),
  pprn_date_approbation DATE,
  pprn_prescriptions TEXT[] DEFAULT '{}',

  -- Mouvement de terrain
  mouvement_terrain BOOLEAN NOT NULL DEFAULT false,

  -- Érosion côtière
  erosion_cotiere BOOLEAN NOT NULL DEFAULT false,

  -- Recul du trait de côte (loi Climat et Résilience)
  recul_trait_cote_concerne BOOLEAN NOT NULL DEFAULT false,
  recul_trait_cote_30_ans BOOLEAN NOT NULL DEFAULT false,
  recul_trait_cote_100_ans BOOLEAN NOT NULL DEFAULT false,

  -- Risques technologiques
  seveso_proximite BOOLEAN NOT NULL DEFAULT false,
  distance_seveso_m NUMERIC(10,2),

  -- Pollution
  sis BOOLEAN NOT NULL DEFAULT false, -- Secteur d'information sur les sols

  -- Radon (zones volcaniques)
  zone_radon INTEGER CHECK (zone_radon BETWEEN 1 AND 3),

  -- IAL
  ial_annexe BOOLEAN NOT NULL DEFAULT true,

