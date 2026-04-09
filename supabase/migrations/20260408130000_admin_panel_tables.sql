-- Migration: Admin Panel — admin_logs, feature_flags, support_tickets
-- Tables pour le panneau d'administration Talok

-- ============================================
-- 1. ADMIN_LOGS (journal d'actions admin)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_target ON admin_logs(target_type, target_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- ============================================
-- 2. FEATURE_FLAGS (flags fonctionnels)
-- ============================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  description TEXT,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_flags_name ON feature_flags(name);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled);

-- ============================================
-- 3. SUPPORT_TICKETS (tickets support)
-- ============================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  category TEXT DEFAULT 'general',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- Trigger updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. RLS POLICIES
-- ============================================

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- admin_logs: lecture/écriture pour admins uniquement
CREATE POLICY "Admins can read admin_logs"
  ON admin_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

CREATE POLICY "Admins can insert admin_logs"
  ON admin_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- feature_flags: lecture pour tous (utilisateurs connectes), ecriture pour admins
CREATE POLICY "Authenticated users can read feature_flags"
  ON feature_flags FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage feature_flags"
  ON feature_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- support_tickets: user voit ses propres tickets, admins voient tout
CREATE POLICY "Users can read own support_tickets"
  ON support_tickets FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create support_tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all support_tickets"
  ON support_tickets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- ============================================
-- 5. INSERT SOME DEFAULT FEATURE FLAGS
-- ============================================

INSERT INTO feature_flags (name, enabled, rollout_percentage, description) VALUES
  ('new_dashboard', false, 0, 'Nouveau tableau de bord utilisateur'),
  ('ai_assistant', false, 10, 'Assistant IA TALO pour les utilisateurs'),
  ('open_banking', false, 0, 'Integration Open Banking pour les virements'),
  ('electronic_signature_v2', false, 25, 'Nouvelle version de la signature electronique'),
  ('advanced_reporting', false, 0, 'Rapports avances pour les proprietaires Pro'),
  ('dark_mode', true, 100, 'Theme sombre'),
  ('maintenance_mode', false, 0, 'Mode maintenance - bloque les nouvelles inscriptions'),
  ('beta_features', false, 5, 'Fonctionnalites beta pour les early adopters')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 6. HELPER FUNCTION: log_admin_action
-- ============================================

CREATE OR REPLACE FUNCTION log_admin_action(
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_admin_profile_id UUID;
  v_log_id UUID;
BEGIN
  SELECT id INTO v_admin_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
    AND role IN ('admin', 'platform_admin')
  LIMIT 1;

  IF v_admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not an admin';
  END IF;

  INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
  VALUES (v_admin_profile_id, p_action, p_target_type, p_target_id, p_details)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
