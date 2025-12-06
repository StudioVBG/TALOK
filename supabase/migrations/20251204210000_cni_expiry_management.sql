-- Migration : Gestion de l'expiration des CNI
-- Date : 2025-12-04
-- 
-- Fonctionnalités :
-- - CNI non modifiable une fois uploadée
-- - Renouvellement automatique J-30 avant expiration
-- - Notifications locataire + propriétaire

-- ============================================
-- AJOUT DES CHAMPS SUR LA TABLE DOCUMENTS
-- ============================================

-- Date d'expiration du document (extraite de l'OCR ou saisie manuellement)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Date de demande de renouvellement (quand le système a notifié)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS renewal_requested_at TIMESTAMPTZ;

-- Document archivé (remplacé par une nouvelle version)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Lien vers le document de remplacement
ALTER TABLE documents ADD COLUMN IF NOT EXISTS replaced_by UUID REFERENCES documents(id);

-- Statut de vérification (pour admin/propriétaire)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'
  CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired'));

-- Notes de vérification (si rejeté)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Date de vérification
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Vérifié par (profile_id de l'admin ou propriétaire)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);

-- ============================================
-- INDEX POUR LES REQUÊTES FRÉQUENTES
-- ============================================

-- Index pour trouver les CNI expirant bientôt
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date 
ON documents(expiry_date) 
WHERE type IN ('cni_recto', 'cni_verso') AND is_archived = false;

-- Index pour le statut de vérification
CREATE INDEX IF NOT EXISTS idx_documents_verification_status 
ON documents(verification_status) 
WHERE type IN ('cni_recto', 'cni_verso');

-- ============================================
-- TABLE POUR LES NOTIFICATIONS CNI
-- ============================================

CREATE TABLE IF NOT EXISTS cni_expiry_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_profile_id UUID REFERENCES profiles(id),
  owner_profile_id UUID REFERENCES profiles(id),
  
  -- Type de notification
  notification_type TEXT NOT NULL CHECK (notification_type IN ('j30', 'j15', 'j7', 'expired')),
  
  -- Statut d'envoi
  tenant_notified_at TIMESTAMPTZ,
  owner_notified_at TIMESTAMPTZ,
  tenant_email_sent BOOLEAN DEFAULT false,
  owner_email_sent BOOLEAN DEFAULT false,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Éviter les doublons
  UNIQUE(document_id, notification_type)
);

-- Index pour le CRON
CREATE INDEX IF NOT EXISTS idx_cni_notifications_created 
ON cni_expiry_notifications(created_at);

-- ============================================
-- FONCTION POUR VÉRIFIER LES CNI EXPIRANT
-- ============================================

CREATE OR REPLACE FUNCTION check_expiring_cni()
RETURNS TABLE (
  document_id UUID,
  lease_id UUID,
  tenant_email TEXT,
  owner_profile_id UUID,
  expiry_date DATE,
  days_until_expiry INTEGER,
  notification_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id as document_id,
    d.lease_id,
    d.metadata->>'tenant_email' as tenant_email,
    p.owner_id as owner_profile_id,
    d.expiry_date,
    (d.expiry_date - CURRENT_DATE)::INTEGER as days_until_expiry,
    CASE 
      WHEN (d.expiry_date - CURRENT_DATE) <= 0 THEN 'expired'
      WHEN (d.expiry_date - CURRENT_DATE) <= 7 THEN 'j7'
      WHEN (d.expiry_date - CURRENT_DATE) <= 15 THEN 'j15'
      WHEN (d.expiry_date - CURRENT_DATE) <= 30 THEN 'j30'
      ELSE NULL
    END as notification_type
  FROM documents d
  JOIN leases l ON l.id = d.lease_id
  JOIN properties p ON p.id = l.property_id
  WHERE 
    d.type = 'cni_recto'
    AND d.is_archived = false
    AND d.expiry_date IS NOT NULL
    AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    AND l.statut IN ('active', 'pending_signature')
    -- Exclure ceux déjà notifiés pour ce type
    AND NOT EXISTS (
      SELECT 1 FROM cni_expiry_notifications n
      WHERE n.document_id = d.id
      AND n.notification_type = CASE 
        WHEN (d.expiry_date - CURRENT_DATE) <= 0 THEN 'expired'
        WHEN (d.expiry_date - CURRENT_DATE) <= 7 THEN 'j7'
        WHEN (d.expiry_date - CURRENT_DATE) <= 15 THEN 'j15'
        WHEN (d.expiry_date - CURRENT_DATE) <= 30 THEN 'j30'
      END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER POUR EMPÊCHER LA MODIFICATION DES CNI
-- ============================================

CREATE OR REPLACE FUNCTION prevent_cni_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Autoriser la mise à jour de certains champs uniquement
  IF OLD.type IN ('cni_recto', 'cni_verso') THEN
    -- Champs autorisés à être modifiés
    IF (
      NEW.storage_path IS DISTINCT FROM OLD.storage_path OR
      NEW.lease_id IS DISTINCT FROM OLD.lease_id OR
      NEW.type IS DISTINCT FROM OLD.type
    ) THEN
      RAISE EXCEPTION 'Les documents CNI ne peuvent pas être modifiés. Veuillez uploader une nouvelle version.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_prevent_cni_modification ON documents;
CREATE TRIGGER trigger_prevent_cni_modification
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION prevent_cni_modification();

-- ============================================
-- TRIGGER POUR EMPÊCHER LA SUPPRESSION DES CNI
-- ============================================

CREATE OR REPLACE FUNCTION prevent_cni_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.type IN ('cni_recto', 'cni_verso') THEN
    RAISE EXCEPTION 'Les documents CNI ne peuvent pas être supprimés pour des raisons légales. Ils sont archivés automatiquement lors du renouvellement.';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_prevent_cni_deletion ON documents;
CREATE TRIGGER trigger_prevent_cni_deletion
  BEFORE DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION prevent_cni_deletion();

-- ============================================
-- RLS POLICIES POUR CNI_EXPIRY_NOTIFICATIONS
-- ============================================

ALTER TABLE cni_expiry_notifications ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent tout voir
CREATE POLICY "Admins can manage cni notifications"
ON cni_expiry_notifications FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Les propriétaires peuvent voir les notifications de leurs baux
CREATE POLICY "Owners can view their cni notifications"
ON cni_expiry_notifications FOR SELECT
TO authenticated
USING (
  owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON COLUMN documents.expiry_date IS 'Date d''expiration du document d''identité';
COMMENT ON COLUMN documents.renewal_requested_at IS 'Date à laquelle le système a demandé le renouvellement';
COMMENT ON COLUMN documents.is_archived IS 'True si le document a été remplacé par une nouvelle version';
COMMENT ON COLUMN documents.replaced_by IS 'UUID du document de remplacement';
COMMENT ON COLUMN documents.verification_status IS 'Statut de vérification: pending, verified, rejected, expired';

COMMENT ON TABLE cni_expiry_notifications IS 'Historique des notifications d''expiration CNI envoyées';

