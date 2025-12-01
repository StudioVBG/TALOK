-- Migration: Ajouter les colonnes pour le système d'invitation locataire
-- Cette migration ajoute les colonnes nécessaires pour gérer les invitations
-- de signature de bail avec vérification d'identité

-- Ajouter les colonnes d'invitation à la table leases
ALTER TABLE leases ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS invite_token_expires_at TIMESTAMPTZ;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS tenant_email_pending TEXT;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS tenant_name_pending TEXT;

-- Colonnes pour stocker les données du locataire avant la création du profil
ALTER TABLE leases ADD COLUMN IF NOT EXISTS tenant_identity_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS tenant_identity_method TEXT; -- 'cni_scan', 'france_identite', 'manual'
ALTER TABLE leases ADD COLUMN IF NOT EXISTS tenant_identity_data JSONB; -- Données extraites de la CNI/FranceConnect

-- Colonnes pour le workflow de signature
ALTER TABLE leases ADD COLUMN IF NOT EXISTS yousign_signature_request_id TEXT;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS yousign_document_id TEXT;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS signature_started_at TIMESTAMPTZ;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS signature_completed_at TIMESTAMPTZ;

-- Index pour les tokens d'invitation (recherche rapide)
CREATE INDEX IF NOT EXISTS idx_leases_invite_token ON leases(invite_token) WHERE invite_token IS NOT NULL;

-- Index pour les baux en attente de signature
CREATE INDEX IF NOT EXISTS idx_leases_pending_signature ON leases(statut) WHERE statut IN ('draft', 'pending_signature');

-- Commentaires pour documentation
COMMENT ON COLUMN leases.invite_token IS 'Token unique pour l''invitation du locataire à signer';
COMMENT ON COLUMN leases.invite_token_expires_at IS 'Date d''expiration du token d''invitation';
COMMENT ON COLUMN leases.tenant_email_pending IS 'Email du locataire invité (avant création du compte)';
COMMENT ON COLUMN leases.tenant_name_pending IS 'Nom du locataire invité (avant vérification)';
COMMENT ON COLUMN leases.tenant_identity_verified IS 'Indique si l''identité du locataire a été vérifiée';
COMMENT ON COLUMN leases.tenant_identity_method IS 'Méthode de vérification: cni_scan, france_identite, manual';
COMMENT ON COLUMN leases.tenant_identity_data IS 'Données extraites lors de la vérification d''identité (nom, prénom, date naissance, etc.)';
COMMENT ON COLUMN leases.yousign_signature_request_id IS 'ID de la procédure Yousign';
COMMENT ON COLUMN leases.yousign_document_id IS 'ID du document Yousign';

-- Fonction pour vérifier si un token d'invitation est valide
CREATE OR REPLACE FUNCTION is_valid_lease_invite_token(p_token TEXT)
RETURNS TABLE (
  lease_id UUID,
  property_address TEXT,
  owner_name TEXT,
  loyer NUMERIC,
  charges NUMERIC,
  type_bail TEXT,
  is_valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id as lease_id,
    p.adresse_complete as property_address,
    CONCAT(pr.prenom, ' ', pr.nom) as owner_name,
    l.loyer,
    l.charges_forfaitaires as charges,
    l.type_bail,
    (l.invite_token_expires_at > NOW() AND l.statut = 'draft') as is_valid
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  JOIN profiles pr ON p.owner_id = pr.id
  WHERE l.invite_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner accès à la fonction aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION is_valid_lease_invite_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_valid_lease_invite_token(TEXT) TO anon;

