-- Migration : Amélioration du système de gestion des clés API externes
-- Ajoute le support pour les clés API de services tiers (Resend, Stripe, etc.)

-- ============================================
-- 1. AJOUTER RESEND COMME PROVIDER
-- ============================================

INSERT INTO api_providers (name, category, pricing_model, status, metadata)
VALUES 
  ('Resend', 'email', 'tiered', 'active', '{"free_quota": 3000, "daily_limit": 100, "docs": "https://resend.com/docs", "test_address": "onboarding@resend.dev"}'),
  ('SendGrid', 'email', 'tiered', 'inactive', '{"free_quota": 100, "docs": "https://docs.sendgrid.com"}'),
  ('Google Maps', 'maps', 'per_request', 'inactive', '{"docs": "https://developers.google.com/maps"}'),
  ('France Identité', 'kyc', 'free', 'inactive', '{"docs": "https://franceconnect.gouv.fr"}')
ON CONFLICT (name) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- ============================================
-- 2. AJOUTER DES COLONNES POUR LES CLÉS EXTERNES
-- ============================================

-- Ajouter les colonnes si elles n'existent pas
DO $$ 
BEGIN
  -- Colonne pour stocker la clé externe chiffrée
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'api_credentials' AND column_name = 'external_key_encrypted') THEN
    ALTER TABLE api_credentials ADD COLUMN external_key_encrypted TEXT;
  END IF;
  
  -- Colonne pour le nom/label de la clé
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'api_credentials' AND column_name = 'name') THEN
    ALTER TABLE api_credentials ADD COLUMN name TEXT;
  END IF;
  
  -- Colonne pour les paramètres supplémentaires (ex: EMAIL_FROM pour Resend)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'api_credentials' AND column_name = 'config') THEN
    ALTER TABLE api_credentials ADD COLUMN config JSONB DEFAULT '{}';
  END IF;
  
  -- Colonne pour le statut actif/inactif
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'api_credentials' AND column_name = 'is_active') THEN
    ALTER TABLE api_credentials ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  -- Colonne pour l'utilisateur créateur
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'api_credentials' AND column_name = 'created_by') THEN
    ALTER TABLE api_credentials ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
  
  -- Colonne pour la dernière rotation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'api_credentials' AND column_name = 'rotated_at') THEN
    ALTER TABLE api_credentials ADD COLUMN rotated_at TIMESTAMPTZ;
  END IF;
  
  -- Colonne pour le hash de la clé (pour vérification)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'api_credentials' AND column_name = 'key_hash') THEN
    ALTER TABLE api_credentials ADD COLUMN key_hash TEXT;
  END IF;
  
  -- Colonne pour les permissions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'api_credentials' AND column_name = 'permissions') THEN
    ALTER TABLE api_credentials ADD COLUMN permissions JSONB DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- 3. CRÉER UNE VUE POUR LES PROVIDERS AVEC LEURS CREDENTIALS
-- ============================================

CREATE OR REPLACE VIEW v_provider_credentials AS
SELECT 
  p.id AS provider_id,
  p.name AS provider_name,
  p.category,
  p.pricing_model,
  p.status AS provider_status,
  p.metadata AS provider_metadata,
  c.id AS credential_id,
  c.name AS credential_name,
  c.env,
  c.is_active AS credential_active,
  c.config,
  c.created_at AS credential_created_at,
  c.rotated_at,
  CASE WHEN c.external_key_encrypted IS NOT NULL THEN true ELSE false END AS has_key
FROM api_providers p
LEFT JOIN api_credentials c ON c.provider_id = p.id
ORDER BY p.category, p.name;

-- ============================================
-- 4. INDEX POUR LES PERFORMANCES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_api_credentials_is_active ON api_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_api_providers_category ON api_providers(category);
CREATE INDEX IF NOT EXISTS idx_api_providers_status ON api_providers(status);

-- ============================================
-- 5. FONCTION POUR OBTENIR LA CLÉ ACTIVE D'UN PROVIDER
-- ============================================

CREATE OR REPLACE FUNCTION get_active_credential(provider_name_param TEXT, env_param TEXT DEFAULT 'prod')
RETURNS TABLE(
  credential_id UUID,
  external_key_encrypted TEXT,
  config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.external_key_encrypted,
    c.config
  FROM api_credentials c
  JOIN api_providers p ON p.id = c.provider_id
  WHERE p.name = provider_name_param
    AND c.env = env_param
    AND c.is_active = true
  ORDER BY c.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_active_credential IS 'Récupère les credentials actifs pour un provider donné';

