-- Migration: Gestion des clés API par l'admin
-- Date: 2024-11-28
-- Description: Tables pour stocker les providers et credentials API de manière sécurisée

BEGIN;

-- ============================================
-- TABLE DES PROVIDERS API
-- ============================================

CREATE TABLE IF NOT EXISTS api_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,           -- Ex: "mindee", "yousign", "stripe"
  type TEXT NOT NULL,                  -- Ex: "ocr", "signature", "payment"
  category TEXT NOT NULL,              -- Ex: "documents", "signatures", "paiements"
  description TEXT,
  documentation_url TEXT,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
  config JSONB DEFAULT '{}'::jsonb,    -- Config par défaut du provider
  pricing_info TEXT,                   -- Info tarification
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_providers_name ON api_providers(name);
CREATE INDEX IF NOT EXISTS idx_api_providers_status ON api_providers(status);
CREATE INDEX IF NOT EXISTS idx_api_providers_category ON api_providers(category);

-- ============================================
-- TABLE DES CREDENTIALS API
-- ============================================

CREATE TABLE IF NOT EXISTS api_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES api_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- Ex: "Production Mindee"
  key_hash TEXT NOT NULL,              -- Hash SHA256 pour vérification
  encrypted_key TEXT NOT NULL,         -- Clé chiffrée AES-256-GCM
  secret_ref TEXT,                     -- Référence (ex: "encrypted")
  env TEXT NOT NULL DEFAULT 'prod' CHECK (env IN ('prod', 'staging', 'dev', 'test')),
  permissions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  rotated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  monthly_usage INTEGER DEFAULT 0,     -- Usage mensuel pour suivi des coûts
  monthly_limit INTEGER,               -- Limite mensuelle optionnelle
  expires_at TIMESTAMPTZ,              -- Date d'expiration optionnelle
  notes TEXT,                          -- Notes admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_credentials_provider ON api_credentials(provider_id);
CREATE INDEX IF NOT EXISTS idx_api_credentials_active ON api_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_api_credentials_env ON api_credentials(env);
CREATE INDEX IF NOT EXISTS idx_api_credentials_created_by ON api_credentials(created_by);

-- ============================================
-- TABLE DE SUIVI DES USAGES API
-- ============================================

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credential_id UUID NOT NULL REFERENCES api_credentials(id) ON DELETE CASCADE,
  endpoint TEXT,                       -- Endpoint appelé
  status_code INTEGER,                 -- Code de retour
  response_time_ms INTEGER,            -- Temps de réponse
  cost_estimate NUMERIC(10,4),         -- Coût estimé
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_credential ON api_usage_logs(credential_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created ON api_usage_logs(created_at DESC);

-- ============================================
-- INSÉRER LES PROVIDERS PAR DÉFAUT
-- ============================================

INSERT INTO api_providers (name, type, category, description, documentation_url, pricing_info) VALUES
  ('mindee', 'ocr', 'Documents', 'OCR et extraction de données depuis des documents français (bulletins de salaire, pièces d''identité, avis d''imposition)', 'https://developers.mindee.com/docs', 'Gratuit: 250 pages/mois, Pro: $0.01/page'),
  ('yousign', 'signature', 'Signatures', 'Signatures électroniques légales conformes eIDAS (SES/AES/QES)', 'https://developers.yousign.com/', 'À partir de 0.50€/signature'),
  ('stripe', 'payment', 'Paiements', 'Paiements en ligne, prélèvements SEPA et facturation récurrente', 'https://stripe.com/docs/api', '1.4% + 0.25€/transaction'),
  ('brevo', 'email', 'Notifications', 'Envoi d''emails transactionnels et marketing (ex-Sendinblue)', 'https://developers.brevo.com/', 'Gratuit: 300 emails/jour'),
  ('twilio', 'sms', 'Notifications', 'Envoi de SMS et vérification OTP par téléphone', 'https://www.twilio.com/docs', '~0.04€/SMS France'),
  ('google_vision', 'ocr', 'Documents', 'Google Cloud Vision API pour OCR avancé', 'https://cloud.google.com/vision/docs', '$1.50/1000 pages'),
  ('aws_textract', 'ocr', 'Documents', 'AWS Textract pour extraction de données structurées', 'https://docs.aws.amazon.com/textract/', '$1.50/1000 pages'),
  ('docusign', 'signature', 'Signatures', 'Signatures électroniques internationales', 'https://developers.docusign.com/', 'À partir de 1€/signature'),
  ('gocardless', 'payment', 'Paiements', 'Prélèvements SEPA récurrents', 'https://developer.gocardless.com/', '1% plafonné à 2€/transaction'),
  ('pappers', 'verification', 'Vérification', 'Vérification d''entreprises et données légales françaises', 'https://www.pappers.fr/api', 'À partir de 0.02€/requête')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  documentation_url = EXCLUDED.documentation_url,
  pricing_info = EXCLUDED.pricing_info,
  updated_at = NOW();

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE api_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage api_providers" ON api_providers;
DROP POLICY IF EXISTS "Admins can manage api_credentials" ON api_credentials;
DROP POLICY IF EXISTS "Admins can view api_usage_logs" ON api_usage_logs;
DROP POLICY IF EXISTS "Service role full access to providers" ON api_providers;
DROP POLICY IF EXISTS "Service role full access to credentials" ON api_credentials;
DROP POLICY IF EXISTS "Service role full access to usage_logs" ON api_usage_logs;

-- Seuls les admins peuvent voir/gérer les providers
CREATE POLICY "Admins can manage api_providers"
  ON api_providers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Seuls les admins peuvent voir/gérer les credentials
CREATE POLICY "Admins can manage api_credentials"
  ON api_credentials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Seuls les admins peuvent voir les logs d'usage
CREATE POLICY "Admins can view api_usage_logs"
  ON api_usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Service role peut tout faire
CREATE POLICY "Service role full access to providers"
  ON api_providers FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to credentials"
  ON api_credentials FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to usage_logs"
  ON api_usage_logs FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_api_providers_updated_at 
  BEFORE UPDATE ON api_providers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_credentials_updated_at 
  BEFORE UPDATE ON api_credentials 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FONCTION POUR RESET MENSUEL DES USAGES
-- ============================================

CREATE OR REPLACE FUNCTION reset_monthly_api_usage()
RETURNS void AS $$
BEGIN
  UPDATE api_credentials SET monthly_usage = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FONCTION POUR INCRÉMENTER L'USAGE
-- ============================================

CREATE OR REPLACE FUNCTION increment_api_usage(p_credential_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE api_credentials 
  SET 
    usage_count = COALESCE(usage_count, 0) + 1,
    monthly_usage = COALESCE(monthly_usage, 0) + 1,
    last_used_at = NOW()
  WHERE id = p_credential_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

