-- Migration: Passkeys (WebAuthn) et 2FA SOTA 2026
-- Date: 2026-01-10
-- Description: Ajoute le support des Passkeys et améliore le système 2FA

-- =============================================================================
-- TABLE: passkey_credentials
-- Stocke les credentials WebAuthn des utilisateurs
-- =============================================================================
CREATE TABLE IF NOT EXISTS passkey_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL CHECK (device_type IN ('singleDevice', 'multiDevice')),
  backed_up BOOLEAN NOT NULL DEFAULT false,
  transports TEXT[] DEFAULT '{}',
  friendly_name TEXT DEFAULT 'Ma passkey',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour lookup rapide par user_id et credential_id
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_id ON passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_credential_id ON passkey_credentials(credential_id);

-- =============================================================================
-- TABLE: passkey_challenges
-- Stocke les challenges WebAuthn temporaires
-- =============================================================================
CREATE TABLE IF NOT EXISTS passkey_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour nettoyage des challenges expirés
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_expires_at ON passkey_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_user_type ON passkey_challenges(user_id, type);

-- =============================================================================
-- TABLE: user_2fa
-- Configuration 2FA améliorée avec recovery codes
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_2fa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  totp_secret TEXT,
  recovery_codes JSONB DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT false,
  pending_activation BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour lookup rapide
CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON user_2fa(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_enabled ON user_2fa(enabled) WHERE enabled = true;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkey_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;

-- Policies pour passkey_credentials
CREATE POLICY "Users can view their own passkeys"
  ON passkey_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own passkeys"
  ON passkey_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own passkeys"
  ON passkey_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own passkeys"
  ON passkey_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Policy service-role pour passkey_challenges (géré côté serveur)
CREATE POLICY "Service role full access to challenges"
  ON passkey_challenges FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policies pour user_2fa
CREATE POLICY "Users can view their own 2FA config"
  ON user_2fa FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own 2FA config"
  ON user_2fa FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own 2FA config"
  ON user_2fa FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger pour updated_at sur passkey_credentials
CREATE OR REPLACE FUNCTION update_passkey_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_passkey_credentials_updated_at ON passkey_credentials;
CREATE TRIGGER trigger_passkey_credentials_updated_at
  BEFORE UPDATE ON passkey_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_passkey_credentials_updated_at();

-- Trigger pour updated_at sur user_2fa
CREATE OR REPLACE FUNCTION update_user_2fa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_2fa_updated_at ON user_2fa;
CREATE TRIGGER trigger_user_2fa_updated_at
  BEFORE UPDATE ON user_2fa
  FOR EACH ROW
  EXECUTE FUNCTION update_user_2fa_updated_at();

-- =============================================================================
-- CLEANUP FUNCTION
-- Nettoie les challenges expirés (à appeler via cron)
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_passkey_challenges()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM passkey_challenges
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE passkey_credentials IS 'Stocke les credentials WebAuthn (Passkeys) des utilisateurs - SOTA 2026';
COMMENT ON TABLE passkey_challenges IS 'Stocke les challenges WebAuthn temporaires pour registration/authentication';
COMMENT ON TABLE user_2fa IS 'Configuration 2FA TOTP avec recovery codes - SOTA 2026';

COMMENT ON COLUMN passkey_credentials.device_type IS 'singleDevice = clé physique, multiDevice = passkey synchronisée (iCloud, Google)';
COMMENT ON COLUMN passkey_credentials.backed_up IS 'true si la passkey est synchronisée dans le cloud';
COMMENT ON COLUMN user_2fa.recovery_codes IS 'Array JSON de {code, used, used_at}';
