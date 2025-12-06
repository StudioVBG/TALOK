-- =====================================================
-- MIGRATION: Notifications Centralisées (version simplifiée)
-- =====================================================

-- Ajouter les colonnes manquantes à notifications si nécessaire
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'profile_id') THEN
    ALTER TABLE notifications ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'priority') THEN
    ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'normal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'action_url') THEN
    ALTER TABLE notifications ADD COLUMN action_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'channels_status') THEN
    ALTER TABLE notifications ADD COLUMN channels_status JSONB DEFAULT '{}';
  END IF;
END$$;

-- Index conditionnels
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications(profile_id);
  END IF;
END$$;

-- Table de préférences de notifications
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Canaux activés
  in_app_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT false,
  
  -- Plages horaires (ne pas déranger)
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  -- Fréquence des digests email
  email_digest_frequency TEXT DEFAULT 'instant',
  
  -- Templates désactivés
  disabled_templates TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_profile ON notification_preferences(profile_id);

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their notification preferences" ON notification_preferences;
CREATE POLICY "Users can manage their notification preferences"
  ON notification_preferences FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

COMMENT ON TABLE notification_preferences IS 'Préférences de notification par utilisateur';
