-- Migration: Suivi de progression des protocoles juridiques
-- Description: Table pour suivre la progression des utilisateurs sur les protocoles anti-squat et protection locataire
-- Date: 2025-06-01

-- Table pour suivre la progression des utilisateurs sur les protocoles juridiques
CREATE TABLE IF NOT EXISTS legal_protocol_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  protocol_type TEXT NOT NULL CHECK (protocol_type IN ('anti_squat_owner', 'prevention_owner', 'protection_tenant')),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  steps_status JSONB NOT NULL DEFAULT '{}',
  notes JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Un utilisateur ne peut avoir qu'une progression par protocole et par logement
  UNIQUE(user_id, protocol_type, property_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_protocol_progress_user ON legal_protocol_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_protocol_progress_property ON legal_protocol_progress(property_id);
CREATE INDEX IF NOT EXISTS idx_protocol_progress_type ON legal_protocol_progress(protocol_type);

-- RLS policies
ALTER TABLE legal_protocol_progress ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur ne voit que ses propres progressions
CREATE POLICY "Users can view own protocol progress"
  ON legal_protocol_progress
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own protocol progress"
  ON legal_protocol_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own protocol progress"
  ON legal_protocol_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own protocol progress"
  ON legal_protocol_progress
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_legal_protocol_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_legal_protocol_progress_timestamp
  BEFORE UPDATE ON legal_protocol_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_legal_protocol_progress_updated_at();

-- Commentaires
COMMENT ON TABLE legal_protocol_progress IS 'Suivi de la progression des utilisateurs sur les protocoles juridiques (anti-squat, protection locataire)';
COMMENT ON COLUMN legal_protocol_progress.protocol_type IS 'Type de protocole: anti_squat_owner, prevention_owner, protection_tenant';
COMMENT ON COLUMN legal_protocol_progress.steps_status IS 'Statut de chaque étape: {"step_id": "pending|in_progress|completed|skipped"}';
COMMENT ON COLUMN legal_protocol_progress.notes IS 'Notes libres par étape: {"step_id": "note..."}';







