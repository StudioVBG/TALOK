-- Migration: Create sms_messages table for Twilio SMS tracking (2026-02-09)
--
-- The application code (API routes) already references this table:
--   - POST /api/notifications/sms/send  → inserts SMS records
--   - POST /api/webhooks/twilio          → updates delivery status
-- But the table was never created in a migration.

-- ============================================================
-- 1. Create sms_messages table
-- ============================================================

CREATE TABLE IF NOT EXISTS sms_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  from_number   TEXT NOT NULL,
  to_number     TEXT NOT NULL,
  message       TEXT NOT NULL,
  segments      INT DEFAULT 1,
  twilio_sid    TEXT,
  twilio_status TEXT,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'sent', 'delivered', 'undelivered', 'failed')),
  error_code    TEXT,
  error_message TEXT,
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  sms_messages IS 'Journal des SMS envoyés via Twilio';
COMMENT ON COLUMN sms_messages.profile_id    IS 'Profil destinataire (nullable si envoi à un numéro libre)';
COMMENT ON COLUMN sms_messages.from_number   IS 'Numéro ou service Twilio expéditeur';
COMMENT ON COLUMN sms_messages.to_number     IS 'Numéro de téléphone du destinataire (format E.164)';
COMMENT ON COLUMN sms_messages.segments      IS 'Nombre de segments SMS (1 segment = 160 caractères)';
COMMENT ON COLUMN sms_messages.twilio_sid    IS 'SID du message Twilio (pour corrélation webhook)';
COMMENT ON COLUMN sms_messages.twilio_status IS 'Dernier statut brut renvoyé par Twilio';
COMMENT ON COLUMN sms_messages.status        IS 'Statut normalisé : queued, sent, delivered, undelivered, failed';

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Lookup by Twilio SID (webhook updates)
CREATE INDEX IF NOT EXISTS idx_sms_messages_twilio_sid
  ON sms_messages (twilio_sid)
  WHERE twilio_sid IS NOT NULL;

-- Lookup by profile
CREATE INDEX IF NOT EXISTS idx_sms_messages_profile_id
  ON sms_messages (profile_id)
  WHERE profile_id IS NOT NULL;

-- Recent messages
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at
  ON sms_messages (created_at DESC);

-- ============================================================
-- 3. Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_sms_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sms_messages_updated_at ON sms_messages;
CREATE TRIGGER trg_sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_messages_updated_at();

-- ============================================================
-- 4. Row Level Security
-- ============================================================

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Admins can see all SMS
CREATE POLICY sms_messages_admin_all ON sms_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Owners can see SMS they sent (via their profile)
CREATE POLICY sms_messages_owner_select ON sms_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'owner'
        AND p.id = sms_messages.profile_id
    )
  );

-- Service role inserts (API routes use service role client, bypasses RLS)
-- No explicit INSERT policy needed for service role, but add one for completeness
CREATE POLICY sms_messages_service_insert ON sms_messages
  FOR INSERT
  WITH CHECK (true);
