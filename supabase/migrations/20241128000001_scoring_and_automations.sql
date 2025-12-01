-- Migration: Scoring de solvabilité et Automations
-- Date: 2024-11-28
-- Description: Ajoute les tables pour le scoring, les indexations IRL et améliore les notifications

BEGIN;

-- ============================================
-- 1. TABLE POUR LES INDEXATIONS IRL
-- ============================================

CREATE TABLE IF NOT EXISTS lease_indexations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  
  -- Anciens et nouveaux loyers
  old_rent NUMERIC(10,2) NOT NULL,
  new_rent NUMERIC(10,2) NOT NULL,
  
  -- Valeurs IRL
  old_irl_quarter TEXT NOT NULL, -- Ex: "2023-Q4"
  old_irl_value NUMERIC(8,2) NOT NULL,
  new_irl_quarter TEXT NOT NULL,
  new_irl_value NUMERIC(8,2) NOT NULL,
  
  -- Calculs
  increase_amount NUMERIC(10,2) NOT NULL,
  increase_percent NUMERIC(5,2) NOT NULL,
  
  -- Dates
  effective_date DATE NOT NULL,
  applied_at TIMESTAMPTZ,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'expired')),
  rejection_reason TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lease_indexations_lease_id ON lease_indexations(lease_id);
CREATE INDEX idx_lease_indexations_status ON lease_indexations(status);
CREATE INDEX idx_lease_indexations_effective_date ON lease_indexations(effective_date);

-- ============================================
-- 2. AMÉLIORATION TABLE NOTIFICATIONS
-- ============================================

-- Ajouter des colonnes manquantes si elles n'existent pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notifications' AND column_name = 'priority') THEN
    ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'medium' 
      CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notifications' AND column_name = 'type') THEN
    ALTER TABLE notifications ADD COLUMN type TEXT NOT NULL DEFAULT 'info';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notifications' AND column_name = 'metadata') THEN
    ALTER TABLE notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_metadata ON notifications USING GIN(metadata);

-- ============================================
-- 3. TABLE POUR LES SCORES DE SOLVABILITÉ
-- ============================================

-- Stocker l'historique des scores calculés
CREATE TABLE IF NOT EXISTS solvability_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES tenant_applications(id) ON DELETE CASCADE,
  
  -- Score global
  total_score INTEGER NOT NULL CHECK (total_score >= 0 AND total_score <= 100),
  recommendation TEXT NOT NULL CHECK (recommendation IN ('accept', 'review', 'reject')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  
  -- Facteurs détaillés (stockés en JSON pour flexibilité)
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Métriques clés
  effort_rate NUMERIC(5,2),
  income_ratio NUMERIC(5,2),
  is_gli_eligible BOOLEAN DEFAULT false,
  
  -- Risques et recommandations
  risks JSONB DEFAULT '[]'::jsonb,
  strengths JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  
  -- Métadonnées
  version TEXT NOT NULL DEFAULT '1.0.0',
  calculated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solvability_scores_application ON solvability_scores(application_id);
CREATE INDEX idx_solvability_scores_recommendation ON solvability_scores(recommendation);
CREATE INDEX idx_solvability_scores_created ON solvability_scores(created_at DESC);

-- ============================================
-- 4. RLS POLICIES
-- ============================================

-- Activer RLS
ALTER TABLE lease_indexations ENABLE ROW LEVEL SECURITY;
ALTER TABLE solvability_scores ENABLE ROW LEVEL SECURITY;

-- Policies pour lease_indexations
CREATE POLICY "Owners can view their lease indexations"
  ON lease_indexations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE l.id = lease_indexations.lease_id
      AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update their lease indexations"
  ON lease_indexations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE l.id = lease_indexations.lease_id
      AND pr.user_id = auth.uid()
    )
  );

-- Policies pour solvability_scores
CREATE POLICY "Owners can view scores for their properties"
  ON solvability_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_applications ta
      JOIN properties p ON ta.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE ta.id = solvability_scores.application_id
      AND pr.user_id = auth.uid()
    )
  );

-- Service role peut tout faire
CREATE POLICY "Service role full access to indexations"
  ON lease_indexations FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to scores"
  ON solvability_scores FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 5. TRIGGERS
-- ============================================

-- Trigger updated_at
CREATE TRIGGER update_lease_indexations_updated_at 
  BEFORE UPDATE ON lease_indexations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. FONCTION POUR OBTENIR LA DERNIÈRE VALEUR IRL
-- ============================================

CREATE OR REPLACE FUNCTION get_latest_irl()
RETURNS TABLE(quarter TEXT, value NUMERIC) AS $$
BEGIN
  -- Valeurs IRL codées en dur (à mettre à jour trimestriellement)
  -- En production, ces valeurs seraient dans une table dédiée
  RETURN QUERY
  SELECT '2024-Q3'::TEXT, 144.51::NUMERIC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;

