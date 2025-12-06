-- Migration: Table de tracking des sessions d'impersonation
-- Date: 2024-12-06
-- Description: Stocke l'historique des sessions d'impersonation admin

BEGIN;

-- ============================================
-- TABLE: impersonation_sessions
-- ============================================

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired')),
  actions_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT different_users CHECK (admin_id != target_user_id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_impersonation_admin 
  ON impersonation_sessions(admin_id, status);
  
CREATE INDEX IF NOT EXISTS idx_impersonation_target 
  ON impersonation_sessions(target_user_id);
  
CREATE INDEX IF NOT EXISTS idx_impersonation_active 
  ON impersonation_sessions(status) WHERE status = 'active';

-- ============================================
-- RLS: Seuls les admins peuvent voir les sessions
-- ============================================

ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Politique: Admin peut voir toutes les sessions
CREATE POLICY "admin_view_impersonation_sessions" ON impersonation_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Politique: Admin peut insérer ses propres sessions
CREATE POLICY "admin_insert_impersonation_sessions" ON impersonation_sessions
  FOR INSERT
  WITH CHECK (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Politique: Admin peut mettre à jour ses propres sessions
CREATE POLICY "admin_update_impersonation_sessions" ON impersonation_sessions
  FOR UPDATE
  USING (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- FUNCTION: Expirer les sessions automatiquement
-- ============================================

CREATE OR REPLACE FUNCTION expire_impersonation_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE impersonation_sessions
  SET 
    status = 'expired',
    ended_at = NOW()
  WHERE 
    status = 'active' 
    AND expires_at < NOW();
END;
$$;

-- Commentaires
COMMENT ON TABLE impersonation_sessions IS 
  'Historique des sessions d''impersonation admin pour audit et sécurité';
COMMENT ON COLUMN impersonation_sessions.reason IS 
  'Raison de l''impersonation (obligatoire pour audit)';
COMMENT ON COLUMN impersonation_sessions.actions_count IS 
  'Nombre d''actions effectuées pendant la session';

COMMIT;

