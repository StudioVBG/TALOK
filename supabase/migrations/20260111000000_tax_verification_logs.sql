-- Migration: Table de logs pour la vérification d'avis d'imposition
-- Date: 2026-01-11
-- Description: Crée la table pour stocker l'historique des vérifications d'avis d'imposition

-- ============================================================================
-- TABLE: tax_verification_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Utilisateur qui a effectué la vérification
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Références optionnelles au locataire/candidature
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,

  -- Données hachées pour confidentialité (SHA-256)
  numero_fiscal_hash TEXT NOT NULL,
  reference_avis_hash TEXT NOT NULL,

  -- Résultat de la vérification
  status TEXT NOT NULL CHECK (status IN (
    'conforme',
    'non_conforme',
    'situation_partielle',
    'introuvable',
    'erreur'
  )),

  -- Mode de vérification utilisé
  verification_mode TEXT NOT NULL DEFAULT 'api_particulier' CHECK (verification_mode IN (
    'web_scraping',
    'api_particulier',
    '2d_doc'
  )),

  -- Informations d'audit
  ip_address INET,
  user_agent TEXT,

  -- Horodatage
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index pour les requêtes par utilisateur
CREATE INDEX idx_tax_verification_logs_user_id
  ON tax_verification_logs(user_id);

-- Index pour les requêtes par locataire
CREATE INDEX idx_tax_verification_logs_tenant_id
  ON tax_verification_logs(tenant_id)
  WHERE tenant_id IS NOT NULL;

-- Index pour les requêtes par candidature
CREATE INDEX idx_tax_verification_logs_application_id
  ON tax_verification_logs(application_id)
  WHERE application_id IS NOT NULL;

-- Index pour les statistiques par statut
CREATE INDEX idx_tax_verification_logs_status
  ON tax_verification_logs(status);

-- Index pour les requêtes temporelles
CREATE INDEX idx_tax_verification_logs_created_at
  ON tax_verification_logs(created_at DESC);

-- Index composite pour détecter les vérifications répétées
CREATE INDEX idx_tax_verification_logs_dedup
  ON tax_verification_logs(numero_fiscal_hash, reference_avis_hash, created_at DESC);

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

ALTER TABLE tax_verification_logs ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs ne voient que leurs propres vérifications
CREATE POLICY "Users can view their own verification logs"
  ON tax_verification_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent créer leurs propres logs
CREATE POLICY "Users can create their own verification logs"
  ON tax_verification_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Politique : Les admins peuvent tout voir
CREATE POLICY "Admins can view all verification logs"
  ON tax_verification_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tax_verification_logs IS
  'Historique des vérifications d''avis d''imposition français via API Particulier';

COMMENT ON COLUMN tax_verification_logs.numero_fiscal_hash IS
  'Hash SHA-256 du numéro fiscal (13 chiffres) pour confidentialité';

COMMENT ON COLUMN tax_verification_logs.reference_avis_hash IS
  'Hash SHA-256 de la référence d''avis (13 caractères) pour confidentialité';

COMMENT ON COLUMN tax_verification_logs.status IS
  'Résultat: conforme, non_conforme, situation_partielle, introuvable, erreur';

COMMENT ON COLUMN tax_verification_logs.verification_mode IS
  'Mode utilisé: api_particulier (recommandé), web_scraping, 2d_doc';
