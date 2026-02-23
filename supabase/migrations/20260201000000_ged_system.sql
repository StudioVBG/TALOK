-- Migration: Système GED (Gestion Électronique des Documents)
-- SOTA 2026 - Extension du système documents existant
-- Ajoute: document_types référentiel, alertes d'expiration, partages, audit log GED
-- RÉTROCOMPATIBLE: ne modifie aucune colonne existante

BEGIN;

-- ============================================
-- TABLE: ged_document_types (Référentiel types)
-- ============================================
-- Référentiel centralisé des types de documents avec métadonnées GED
-- Complète l'enum DocumentType existant avec des infos de validité et rattachement

CREATE TABLE IF NOT EXISTS ged_document_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  label_short TEXT,
  icon TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'legal', 'diagnostic', 'insurance', 'financial',
    'administrative', 'identity', 'edl', 'maintenance', 'other'
  )),
  is_expirable BOOLEAN NOT NULL DEFAULT FALSE,
  default_validity_days INTEGER,
  can_attach_to_entity BOOLEAN NOT NULL DEFAULT FALSE,
  can_attach_to_property BOOLEAN NOT NULL DEFAULT FALSE,
  can_attach_to_lease BOOLEAN NOT NULL DEFAULT FALSE,
  is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  is_mandatory_for_lease BOOLEAN NOT NULL DEFAULT FALSE,
  retention_days INTEGER,  -- Durée légale de conservation en jours
  display_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed data: tous les types de documents
INSERT INTO ged_document_types (id, label, label_short, icon, category, is_expirable, default_validity_days, can_attach_to_entity, can_attach_to_property, can_attach_to_lease, is_auto_generated, is_mandatory_for_lease, retention_days, display_order) VALUES
  -- Légaux (bail)
  ('bail', 'Bail de location', 'Bail', 'FileText', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, TRUE, 1825, 10),
  ('avenant', 'Avenant au bail', 'Avenant', 'FilePlus', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 11),
  ('engagement_garant', 'Acte de cautionnement', 'Caution', 'Shield', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 12),
  ('bail_signe_locataire', 'Bail signé locataire', 'Bail signé', 'FileCheck', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 13),
  ('bail_signe_proprietaire', 'Bail signé propriétaire', 'Bail signé', 'FileCheck', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 14),
  ('consentement', 'Consentement RGPD', 'RGPD', 'ShieldCheck', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1095, 15),

  -- Diagnostics (bien) - EXPIRABLES
  ('dpe', 'DPE (Diagnostic Performance Énergétique)', 'DPE', 'Thermometer', 'diagnostic', TRUE, 3650, FALSE, TRUE, FALSE, FALSE, TRUE, 3650, 20),
  ('diagnostic_gaz', 'Diagnostic Gaz', 'Gaz', 'Flame', 'diagnostic', TRUE, 2190, FALSE, TRUE, FALSE, FALSE, TRUE, 2190, 21),
  ('diagnostic_electricite', 'Diagnostic Électricité', 'Électricité', 'Zap', 'diagnostic', TRUE, 2190, FALSE, TRUE, FALSE, FALSE, TRUE, 2190, 22),
  ('diagnostic_plomb', 'Diagnostic Plomb (CREP)', 'Plomb', 'AlertTriangle', 'diagnostic', TRUE, 365, FALSE, TRUE, FALSE, FALSE, TRUE, NULL, 23),
  ('diagnostic_amiante', 'Diagnostic Amiante', 'Amiante', 'AlertTriangle', 'diagnostic', TRUE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, NULL, 24),
  ('diagnostic_termites', 'Diagnostic Termites', 'Termites', 'Bug', 'diagnostic', TRUE, 180, FALSE, TRUE, FALSE, FALSE, FALSE, 180, 25),
  ('erp', 'État des Risques et Pollutions', 'ERP', 'MapPin', 'diagnostic', TRUE, 180, FALSE, TRUE, FALSE, FALSE, TRUE, 180, 26),
  ('diagnostic', 'Dossier Diagnostic Technique (DDT)', 'DDT', 'FileSearch', 'diagnostic', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, NULL, 27),
  ('diagnostic_tertiaire', 'Diagnostic tertiaire', 'Tertiaire', 'Building', 'diagnostic', TRUE, 3650, FALSE, TRUE, FALSE, FALSE, FALSE, 3650, 28),
  ('diagnostic_performance', 'Diagnostic performance', 'Performance', 'BarChart', 'diagnostic', TRUE, 3650, FALSE, TRUE, FALSE, FALSE, FALSE, 3650, 29),

  -- Assurances - EXPIRABLES
  ('attestation_assurance', 'Attestation d''assurance habitation', 'Assurance hab.', 'ShieldCheck', 'insurance', TRUE, 365, FALSE, FALSE, TRUE, FALSE, TRUE, 1095, 30),
  ('assurance_pno', 'Assurance PNO', 'PNO', 'Shield', 'insurance', TRUE, 365, FALSE, TRUE, FALSE, FALSE, FALSE, 1095, 31),

  -- Financiers
  ('quittance', 'Quittance de loyer', 'Quittance', 'Receipt', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, TRUE, FALSE, 1095, 40),
  ('facture', 'Facture', 'Facture', 'Receipt', 'financial', FALSE, NULL, TRUE, TRUE, TRUE, FALSE, FALSE, 3650, 41),
  ('rib', 'RIB / Coordonnées bancaires', 'RIB', 'CreditCard', 'financial', FALSE, NULL, TRUE, FALSE, FALSE, FALSE, FALSE, NULL, 42),
  ('avis_imposition', 'Avis d''imposition', 'Impôts', 'FileText', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1095, 43),
  ('bulletin_paie', 'Bulletin de paie', 'Paie', 'FileText', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1095, 44),
  ('attestation_loyer', 'Attestation de loyer', 'Att. loyer', 'FileText', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1095, 45),
  ('justificatif_revenus', 'Justificatif de revenus', 'Revenus', 'FileText', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1095, 46),
  ('taxe_fonciere', 'Taxe foncière', 'Taxe fonc.', 'FileText', 'financial', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 47),
  ('taxe_sejour', 'Taxe de séjour', 'Taxe séjour', 'FileText', 'financial', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 48),

  -- Identité
  ('piece_identite', 'Pièce d''identité', 'ID', 'User', 'identity', TRUE, 3650, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 50),
  ('cni_recto', 'Carte d''identité (recto)', 'CNI recto', 'CreditCard', 'identity', TRUE, 3650, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 51),
  ('cni_verso', 'Carte d''identité (verso)', 'CNI verso', 'CreditCard', 'identity', TRUE, 3650, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 52),
  ('passeport', 'Passeport', 'Passeport', 'BookOpen', 'identity', TRUE, 3650, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 53),
  ('titre_sejour', 'Titre de séjour', 'Titre séjour', 'FileText', 'identity', TRUE, 365, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 54),

  -- États des lieux
  ('EDL_entree', 'État des lieux d''entrée', 'EDL entrée', 'ClipboardCheck', 'edl', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, TRUE, 1825, 60),
  ('EDL_sortie', 'État des lieux de sortie', 'EDL sortie', 'ClipboardCheck', 'edl', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 61),
  ('inventaire', 'Inventaire mobilier', 'Inventaire', 'List', 'edl', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 62),

  -- Candidature locataire
  ('candidature_identite', 'Candidature - Identité', 'ID candidat', 'UserCheck', 'identity', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 365, 70),
  ('candidature_revenus', 'Candidature - Revenus', 'Revenus candidat', 'DollarSign', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 365, 71),
  ('candidature_domicile', 'Candidature - Domicile', 'Domicile candidat', 'Home', 'identity', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 365, 72),
  ('candidature_garantie', 'Candidature - Garantie', 'Garantie candidat', 'Shield', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 365, 73),

  -- Garant
  ('garant_identite', 'Garant - Identité', 'ID garant', 'UserCheck', 'identity', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 80),
  ('garant_revenus', 'Garant - Revenus', 'Revenus garant', 'DollarSign', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 81),
  ('garant_domicile', 'Garant - Domicile', 'Domicile garant', 'Home', 'identity', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 82),
  ('garant_engagement', 'Garant - Engagement', 'Engagement garant', 'FileSignature', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 83),

  -- Prestataire / Maintenance
  ('devis', 'Devis', 'Devis', 'Calculator', 'maintenance', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 90),
  ('ordre_mission', 'Ordre de mission', 'Ordre mission', 'ClipboardList', 'maintenance', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 91),
  ('rapport_intervention', 'Rapport d''intervention', 'Rapport', 'FileText', 'maintenance', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 92),

  -- Copropriété
  ('copropriete', 'Règlement de copropriété', 'Règl. copro', 'Building', 'administrative', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, NULL, 100),
  ('proces_verbal', 'Procès-verbal d''AG', 'PV AG', 'FileText', 'administrative', FALSE, NULL, TRUE, TRUE, FALSE, FALSE, FALSE, 1825, 101),
  ('appel_fonds', 'Appel de fonds', 'Appel fonds', 'Receipt', 'financial', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 102),

  -- Administratifs (entité)
  ('annexe_pinel', 'Annexe Pinel', 'Pinel', 'FileText', 'administrative', FALSE, NULL, TRUE, TRUE, FALSE, FALSE, FALSE, 3650, 110),
  ('etat_travaux', 'État des travaux', 'Travaux', 'Wrench', 'administrative', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 111),
  ('publication_jal', 'Publication JAL', 'JAL', 'Newspaper', 'administrative', FALSE, NULL, TRUE, FALSE, FALSE, FALSE, FALSE, 1825, 112),

  -- Divers
  ('courrier', 'Courrier', 'Courrier', 'Mail', 'other', FALSE, NULL, TRUE, TRUE, TRUE, FALSE, FALSE, 1095, 120),
  ('photo', 'Photo / Justificatif visuel', 'Photo', 'Camera', 'other', FALSE, NULL, FALSE, TRUE, TRUE, FALSE, FALSE, NULL, 121),
  ('autre', 'Autre document', 'Autre', 'File', 'other', FALSE, NULL, TRUE, TRUE, TRUE, FALSE, FALSE, NULL, 200)
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- EXTENSION: Colonnes GED sur documents existant
-- ============================================
-- Ajoute les colonnes GED sans toucher aux colonnes existantes

-- Rattachement entité juridique
ALTER TABLE documents ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL;

-- Validité / Expiration
ALTER TABLE documents ADD COLUMN IF NOT EXISTS valid_from DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS valid_until DATE;

-- Versioning
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_current_version BOOLEAN NOT NULL DEFAULT TRUE;

-- Statut GED (complète le verification_status existant)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ged_status TEXT DEFAULT 'active' CHECK (ged_status IN (
  'draft', 'active', 'pending_signature', 'signed', 'archived', 'expired'
));

-- Signature
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_data JSONB;

-- Tags pour recherche
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Données extraites par IA GED
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ged_ai_data JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ged_ai_processed_at TIMESTAMPTZ;

-- Index GED
CREATE INDEX IF NOT EXISTS idx_documents_entity_id ON documents(entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_valid_until ON documents(valid_until) WHERE valid_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_ged_status ON documents(ged_status);
CREATE INDEX IF NOT EXISTS idx_documents_version ON documents(parent_document_id, version);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin(tags);


-- ============================================
-- TABLE: document_alerts (Alertes d'expiration)
-- ============================================

CREATE TABLE IF NOT EXISTS document_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Type d'alerte
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'expiring_soon',     -- Document arrive à expiration
    'expired',           -- Document expiré
    'missing',           -- Document manquant (obligatoire pour bail)
    'action_required'    -- Action requise (upload, signature, etc.)
  )),

  -- Configuration
  days_before_expiry INTEGER,   -- Pour expiring_soon: combien de jours avant
  message TEXT,                 -- Message personnalisé

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'dismissed', 'resolved'
  )),

  -- Notification
  notified_at TIMESTAMPTZ,
  notification_channel TEXT,   -- 'in_app', 'email', 'sms'

  -- Résolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte: pas de doublon
  UNIQUE(document_id, alert_type, days_before_expiry)
);

CREATE INDEX IF NOT EXISTS idx_document_alerts_status ON document_alerts(status) WHERE status IN ('pending', 'sent');
CREATE INDEX IF NOT EXISTS idx_document_alerts_document ON document_alerts(document_id);


-- ============================================
-- TABLE: document_shares (Partages sécurisés)
-- ============================================

CREATE TABLE IF NOT EXISTS document_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Type de partage
  share_type TEXT NOT NULL CHECK (share_type IN ('link', 'email')),

  -- Destinataire
  recipient_email TEXT,
  recipient_name TEXT,

  -- Token et URL
  share_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Sécurité
  password_hash TEXT,          -- Optionnel: mot de passe pour accéder
  expires_at TIMESTAMPTZ NOT NULL,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_document_shares_token ON document_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_document_shares_document ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_expires ON document_shares(expires_at) WHERE expires_at IS NOT NULL;


-- ============================================
-- TABLE: document_ged_audit_log (Journal GED)
-- ============================================
-- Séparé de l'audit_log existant pour ne pas interférer

CREATE TABLE IF NOT EXISTS document_ged_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Action
  action TEXT NOT NULL CHECK (action IN (
    'created', 'viewed', 'downloaded', 'updated', 'signed',
    'shared', 'archived', 'deleted', 'restored', 'version_created',
    'alert_created', 'alert_dismissed', 'ai_analyzed'
  )),

  -- Détails
  details JSONB,

  -- Contexte
  performed_by UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ged_audit_document ON document_ged_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_ged_audit_action ON document_ged_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_ged_audit_performed_at ON document_ged_audit_log(performed_at);


-- ============================================
-- VUE: v_documents_ged (Vue enrichie GED)
-- ============================================
-- Vue qui combine documents + ged_document_types pour faciliter les requêtes

CREATE OR REPLACE VIEW v_documents_ged AS
SELECT
  d.id,
  d.type,
  d.title,
  d.storage_path,
  d.file_size,
  d.mime_type,
  d.owner_id,
  d.tenant_id,
  d.property_id,
  d.lease_id,
  d.entity_id,
  d.valid_from,
  d.valid_until,
  d.version,
  d.parent_document_id,
  d.is_current_version,
  d.ged_status,
  d.signed_at,
  d.tags,
  d.ged_ai_data,
  d.created_at,
  d.updated_at,
  -- Infos du type de document
  gdt.label AS type_label,
  gdt.label_short AS type_label_short,
  gdt.icon AS type_icon,
  gdt.category AS type_category,
  gdt.is_expirable,
  gdt.default_validity_days,
  gdt.is_mandatory_for_lease,
  gdt.retention_days,
  -- Calculs d'expiration
  CASE
    WHEN d.valid_until IS NOT NULL AND d.valid_until < CURRENT_DATE THEN 'expired'
    WHEN d.valid_until IS NOT NULL AND d.valid_until < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    WHEN d.valid_until IS NOT NULL AND d.valid_until < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_notice'
    WHEN d.valid_until IS NOT NULL THEN 'valid'
    ELSE NULL
  END AS expiry_status,
  CASE
    WHEN d.valid_until IS NOT NULL THEN d.valid_until - CURRENT_DATE
    ELSE NULL
  END AS days_until_expiry
FROM documents d
LEFT JOIN ged_document_types gdt ON gdt.id = d.type
WHERE d.is_archived IS NOT TRUE
  AND d.is_current_version IS TRUE;


-- ============================================
-- VUE: v_document_alerts_summary (Résumé alertes)
-- ============================================
-- Pour le panneau d'alertes de la page GED

CREATE OR REPLACE VIEW v_document_alerts_summary AS
SELECT
  d.owner_id,
  d.property_id,
  d.lease_id,
  d.entity_id,
  COUNT(*) FILTER (WHERE vg.expiry_status = 'expired') AS expired_count,
  COUNT(*) FILTER (WHERE vg.expiry_status = 'expiring_soon') AS expiring_soon_count,
  COUNT(*) FILTER (WHERE vg.expiry_status = 'expiring_notice') AS expiring_notice_count,
  json_agg(
    json_build_object(
      'id', d.id,
      'type', d.type,
      'title', d.title,
      'valid_until', d.valid_until,
      'expiry_status', vg.expiry_status,
      'days_until_expiry', vg.days_until_expiry,
      'property_id', d.property_id,
      'lease_id', d.lease_id
    ) ORDER BY d.valid_until ASC
  ) FILTER (WHERE vg.expiry_status IN ('expired', 'expiring_soon', 'expiring_notice')) AS alert_documents
FROM documents d
JOIN v_documents_ged vg ON vg.id = d.id
WHERE d.is_archived IS NOT TRUE
  AND d.valid_until IS NOT NULL
  AND vg.expiry_status IS NOT NULL
GROUP BY d.owner_id, d.property_id, d.lease_id, d.entity_id;


-- ============================================
-- RLS: Policies pour les nouvelles tables
-- ============================================

-- document_alerts
ALTER TABLE document_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts for their documents"
  ON document_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      LEFT JOIN properties p ON d.property_id = p.id
      LEFT JOIN profiles pr ON pr.user_id = auth.uid()
      WHERE d.id = document_alerts.document_id
        AND (d.owner_id = pr.id OR d.tenant_id = pr.id)
    )
  );

CREATE POLICY "Users can update alerts for their documents"
  ON document_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      LEFT JOIN profiles pr ON pr.user_id = auth.uid()
      WHERE d.id = document_alerts.document_id
        AND (d.owner_id = pr.id)
    )
  );

-- document_shares
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their shares"
  ON document_shares FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can create shares"
  ON document_shares FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their shares"
  ON document_shares FOR DELETE
  USING (created_by = auth.uid());

-- document_ged_audit_log
ALTER TABLE document_ged_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their documents"
  ON document_ged_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      LEFT JOIN profiles pr ON pr.user_id = auth.uid()
      WHERE d.id = document_ged_audit_log.document_id
        AND (d.owner_id = pr.id)
    )
  );

CREATE POLICY "System can insert audit logs"
  ON document_ged_audit_log FOR INSERT
  WITH CHECK (TRUE);

-- ged_document_types (lecture publique)
ALTER TABLE ged_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read document types"
  ON ged_document_types FOR SELECT
  USING (TRUE);


-- ============================================
-- FONCTION: Mise à jour automatique des alertes
-- ============================================

CREATE OR REPLACE FUNCTION update_document_ged_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Si valid_until est défini et passé, marquer comme expiré
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until < CURRENT_DATE AND NEW.ged_status = 'active' THEN
    NEW.ged_status := 'expired';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur mise à jour de documents
DROP TRIGGER IF EXISTS trigger_update_document_ged_status ON documents;
CREATE TRIGGER trigger_update_document_ged_status
  BEFORE UPDATE ON documents
  FOR EACH ROW
  WHEN (OLD.valid_until IS DISTINCT FROM NEW.valid_until OR OLD.ged_status IS DISTINCT FROM NEW.ged_status)
  EXECUTE FUNCTION update_document_ged_status();

COMMIT;
