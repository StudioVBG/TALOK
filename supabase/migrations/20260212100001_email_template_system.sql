-- ============================================================
-- Email Template System
-- Tables: email_templates, email_template_versions, email_logs
-- ============================================================

-- Table des templates email éditables
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  available_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  send_delay_minutes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherche rapide par slug et catégorie
CREATE INDEX IF NOT EXISTS idx_email_templates_slug ON email_templates(slug);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);

-- Historique des modifications (audit trail)
CREATE TABLE IF NOT EXISTS email_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  modified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_template_versions_template ON email_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_versions_created ON email_template_versions(created_at DESC);

-- Logs d'envoi
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  variables_used JSONB,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template_slug);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_email_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON email_templates;
CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_template_updated_at();

-- Trigger pour versionner automatiquement les modifications
CREATE OR REPLACE FUNCTION version_email_template()
RETURNS TRIGGER AS $$
BEGIN
  -- Sauvegarder l'ancienne version si le contenu a changé
  IF OLD.subject IS DISTINCT FROM NEW.subject
     OR OLD.body_html IS DISTINCT FROM NEW.body_html
     OR OLD.body_text IS DISTINCT FROM NEW.body_text THEN
    INSERT INTO email_template_versions (template_id, subject, body_html, body_text, modified_by)
    VALUES (OLD.id, OLD.subject, OLD.body_html, OLD.body_text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_email_template_version ON email_templates;
CREATE TRIGGER trg_email_template_version
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION version_email_template();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- email_templates: lecture pour les admins, écriture pour les admins
CREATE POLICY "email_templates_admin_read" ON email_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "email_templates_admin_write" ON email_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- email_templates: lecture pour le service role (envoi d'emails)
CREATE POLICY "email_templates_service_read" ON email_templates
  FOR SELECT TO service_role
  USING (true);

-- email_template_versions: lecture pour les admins
CREATE POLICY "email_template_versions_admin_read" ON email_template_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- email_logs: lecture pour les admins
CREATE POLICY "email_logs_admin_read" ON email_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- email_logs: insertion pour service role
CREATE POLICY "email_logs_service_insert" ON email_logs
  FOR INSERT TO service_role
  WITH CHECK (true);
