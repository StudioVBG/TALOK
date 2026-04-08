-- =====================================================
-- MIGRATION: Système de notifications unifié
-- Ajoute la table notification_event_preferences (per-event)
-- et les colonnes manquantes sur notifications
-- =====================================================

-- 1. Ajouter colonnes manquantes à notifications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'route') THEN
    ALTER TABLE notifications ADD COLUMN route TEXT;
    COMMENT ON COLUMN notifications.route IS 'Deep link route (e.g. /owner/invoices/xxx)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'channels_sent') THEN
    ALTER TABLE notifications ADD COLUMN channels_sent TEXT[] DEFAULT '{}';
    COMMENT ON COLUMN notifications.channels_sent IS 'Channels actually used: email, push, in_app, sms';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
    ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read_at') THEN
    ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'profile_id') THEN
    ALTER TABLE notifications ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Index for profile-based queries
CREATE INDEX IF NOT EXISTS idx_notif_profile_read_created
  ON notifications(profile_id, is_read, created_at DESC);

-- 2. Table de préférences par événement
CREATE TABLE IF NOT EXISTS notification_event_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_event_prefs_profile
  ON notification_event_preferences(profile_id);

ALTER TABLE notification_event_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own event preferences" ON notification_event_preferences;
CREATE POLICY "Users can view own event preferences"
  ON notification_event_preferences FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage own event preferences" ON notification_event_preferences;
CREATE POLICY "Users can manage own event preferences"
  ON notification_event_preferences FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Allow service role to insert
DROP POLICY IF EXISTS "Service can manage event preferences" ON notification_event_preferences;
CREATE POLICY "Service can manage event preferences"
  ON notification_event_preferences FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_notification_event_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notif_event_prefs ON notification_event_preferences;
CREATE TRIGGER trigger_update_notif_event_prefs
  BEFORE UPDATE ON notification_event_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_event_prefs_updated_at();

COMMENT ON TABLE notification_event_preferences IS 'Per-event notification channel preferences for each user';

SELECT 'Unified notification system migration complete' AS result;
