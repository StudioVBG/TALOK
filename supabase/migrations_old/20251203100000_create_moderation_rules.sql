-- Migration: Create moderation_rules table
-- SOTA Décembre 2025 - Table pour les règles de modération admin

-- Table pour les règles de modération admin
CREATE TABLE IF NOT EXISTS moderation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_type TEXT NOT NULL, -- 'property_approval', 'lease_signature', 'provider_validation', etc.
  rule_config JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_moderation_rules_flow_type ON moderation_rules(flow_type);
CREATE INDEX IF NOT EXISTS idx_moderation_rules_active ON moderation_rules(is_active) WHERE is_active = true;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_moderation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_moderation_rules_updated_at ON moderation_rules;
CREATE TRIGGER trigger_moderation_rules_updated_at
  BEFORE UPDATE ON moderation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_moderation_rules_updated_at();

-- RLS
ALTER TABLE moderation_rules ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire/écrire
DROP POLICY IF EXISTS "Admin can view moderation rules" ON moderation_rules;
CREATE POLICY "Admin can view moderation rules" ON moderation_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin can create moderation rules" ON moderation_rules;
CREATE POLICY "Admin can create moderation rules" ON moderation_rules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin can update moderation rules" ON moderation_rules;
CREATE POLICY "Admin can update moderation rules" ON moderation_rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin can delete moderation rules" ON moderation_rules;
CREATE POLICY "Admin can delete moderation rules" ON moderation_rules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Données initiales (règles par défaut)
INSERT INTO moderation_rules (flow_type, rule_config, description, is_active) VALUES
  ('property_approval', '{"auto_approve": false, "require_photos": true, "min_photos": 3}', 'Validation des nouvelles propriétés', true),
  ('provider_validation', '{"require_siret": true, "require_insurance": true, "auto_approve_certified": false}', 'Validation des prestataires', true),
  ('lease_signature', '{"require_all_parties": true, "expiry_days": 7}', 'Règles de signature des baux', true)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE moderation_rules IS 'Règles de modération configurables par l''admin pour différents flux métier';
COMMENT ON COLUMN moderation_rules.flow_type IS 'Type de flux: property_approval, lease_signature, provider_validation, etc.';
COMMENT ON COLUMN moderation_rules.rule_config IS 'Configuration JSON des règles spécifiques au flow_type';

