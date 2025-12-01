-- =====================================================
-- Migration : Table OTP Codes
-- Date : 2024-12-01
-- Description : Stockage sécurisé des codes OTP pour les signatures
-- =====================================================

-- Créer la table otp_codes si elle n'existe pas
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  lease_id UUID REFERENCES leases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  purpose TEXT DEFAULT 'signature',
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_lease 
  ON otp_codes(phone_number, lease_id, is_used);

CREATE INDEX IF NOT EXISTS idx_otp_codes_expires 
  ON otp_codes(expires_at) 
  WHERE is_used = false;

-- RLS
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Politique : seuls les admins peuvent voir les OTP (pour debug)
CREATE POLICY "Admins can view OTP codes"
  ON otp_codes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Politique : le service peut insérer des OTP
CREATE POLICY "Service can insert OTP codes"
  ON otp_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique : le service peut mettre à jour les OTP
CREATE POLICY "Service can update OTP codes"
  ON otp_codes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Fonction de nettoyage des anciens OTP (à exécuter périodiquement)
CREATE OR REPLACE FUNCTION cleanup_expired_otp_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM otp_codes
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$;

-- Commentaires
COMMENT ON TABLE otp_codes IS 'Stockage sécurisé des codes OTP pour vérification SMS';
COMMENT ON COLUMN otp_codes.code_hash IS 'Hash PBKDF2 du code OTP';
COMMENT ON COLUMN otp_codes.salt IS 'Salt unique pour le hachage';
COMMENT ON COLUMN otp_codes.attempts IS 'Nombre de tentatives de validation';

