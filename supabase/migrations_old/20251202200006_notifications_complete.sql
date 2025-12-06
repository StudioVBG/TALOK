-- =====================================================
-- MIGRATION: Notifications Push et SMS complètes
-- =====================================================

-- =====================================================
-- 1. TABLE: push_subscriptions (Abonnements Push)
-- =====================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Endpoint Push
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  
  -- Device info
  device_type TEXT CHECK (device_type IN ('web', 'ios', 'android')),
  device_name TEXT,
  browser TEXT,
  
  -- Statut
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile ON push_subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);

-- =====================================================
-- 2. TABLE: notification_preferences (Préférences)
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Préférences par canal
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false, -- SMS désactivé par défaut (payant)
  
  -- Préférences par type
  payment_reminders BOOLEAN DEFAULT true,
  payment_confirmations BOOLEAN DEFAULT true,
  lease_updates BOOLEAN DEFAULT true,
  ticket_updates BOOLEAN DEFAULT true,
  document_notifications BOOLEAN DEFAULT true,
  marketing BOOLEAN DEFAULT false,
  
  -- Horaires de silence
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  
  -- Fréquence résumés
  digest_frequency TEXT CHECK (digest_frequency IN (
    'realtime', 'daily', 'weekly', 'never'
  )) DEFAULT 'realtime',
  digest_time TIME DEFAULT '09:00',
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(profile_id)
);

-- =====================================================
-- 3. TABLE: notification_queue (File d'attente)
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Destinataire
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Canal
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'sms', 'in_app')),
  
  -- Contenu
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  action_url TEXT,
  
  -- Priorité
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'sent', 'delivered', 'failed', 'cancelled'
  )),
  
  -- Planification
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  
  -- Envoi
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Erreur
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Provider externe
  external_id TEXT, -- ID chez le provider (Twilio, etc.)
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_notification_queue_profile ON notification_queue(profile_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON notification_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_channel ON notification_queue(channel);

-- =====================================================
-- 4. TABLE: sms_messages (Historique SMS)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Numéros
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  
  -- Contenu
  message TEXT NOT NULL,
  
  -- Twilio
  twilio_sid TEXT UNIQUE,
  twilio_status TEXT,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'queued', 'sent', 'delivered', 'failed', 'undelivered'
  )),
  
  -- Coût
  segments INTEGER DEFAULT 1,
  cost DECIMAL(6,4),
  
  -- Erreur
  error_code TEXT,
  error_message TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sms_messages_profile ON sms_messages(profile_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON sms_messages(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_to ON sms_messages(to_number);

-- =====================================================
-- 5. TABLE: admin_audit_log (Journal admin)
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_profile_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Action
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  
  -- Détails
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

-- =====================================================
-- 6. FONCTIONS
-- =====================================================

-- Fonction: Envoyer une notification
CREATE OR REPLACE FUNCTION queue_notification(
  p_profile_id UUID,
  p_channel TEXT,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefs RECORD;
  v_notification_id UUID;
  v_user_id UUID;
BEGIN
  -- Récupérer les préférences
  SELECT * INTO v_prefs FROM notification_preferences WHERE profile_id = p_profile_id;
  
  -- Vérifier si le canal est activé
  IF v_prefs IS NOT NULL THEN
    CASE p_channel
      WHEN 'email' THEN
        IF NOT v_prefs.email_enabled THEN RETURN NULL; END IF;
      WHEN 'push' THEN
        IF NOT v_prefs.push_enabled THEN RETURN NULL; END IF;
      WHEN 'sms' THEN
        IF NOT v_prefs.sms_enabled THEN RETURN NULL; END IF;
      ELSE NULL;
    END CASE;
    
    -- Vérifier les heures de silence
    IF v_prefs.quiet_hours_enabled AND p_priority != 'urgent' THEN
      IF CURRENT_TIME BETWEEN v_prefs.quiet_hours_start AND v_prefs.quiet_hours_end THEN
        -- Reporter au lendemain
        p_scheduled_for := DATE_TRUNC('day', NOW()) + INTERVAL '1 day' + v_prefs.quiet_hours_end;
      END IF;
    END IF;
  END IF;
  
  -- Récupérer l'user_id
  SELECT user_id INTO v_user_id FROM profiles WHERE id = p_profile_id;
  
  -- Créer la notification
  INSERT INTO notification_queue (
    profile_id,
    user_id,
    channel,
    notification_type,
    title,
    body,
    data,
    action_url,
    priority,
    scheduled_for
  ) VALUES (
    p_profile_id,
    v_user_id,
    p_channel,
    p_type,
    p_title,
    p_body,
    p_data,
    p_action_url,
    p_priority,
    p_scheduled_for
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Fonction: Envoyer notification multi-canal
CREATE OR REPLACE FUNCTION notify_user(
  p_profile_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_email_id UUID;
  v_push_id UUID;
  v_in_app_id UUID;
BEGIN
  -- Email
  v_email_id := queue_notification(p_profile_id, 'email', p_type, p_title, p_body, p_data, p_action_url, p_priority);
  
  -- Push
  v_push_id := queue_notification(p_profile_id, 'push', p_type, p_title, p_body, p_data, p_action_url, p_priority);
  
  -- In-app (toujours)
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    data,
    action_url,
    is_read
  )
  SELECT user_id, p_title, p_body, p_type, p_data, p_action_url, false
  FROM profiles
  WHERE id = p_profile_id
  RETURNING id INTO v_in_app_id;
  
  v_result := jsonb_build_object(
    'email_id', v_email_id,
    'push_id', v_push_id,
    'in_app_id', v_in_app_id
  );
  
  RETURN v_result;
END;
$$;

-- Fonction: Dashboard Admin complet
CREATE OR REPLACE FUNCTION admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'users', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM profiles),
      'owners', (SELECT COUNT(*) FROM profiles WHERE role = 'owner'),
      'tenants', (SELECT COUNT(*) FROM profiles WHERE role = 'tenant'),
      'providers', (SELECT COUNT(*) FROM profiles WHERE role = 'provider'),
      'new_this_month', (SELECT COUNT(*) FROM profiles WHERE created_at >= DATE_TRUNC('month', NOW()))
    ),
    'properties', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM properties),
      'occupied', (SELECT COUNT(DISTINCT property_id) FROM leases WHERE statut = 'active'),
      'vacant', (SELECT COUNT(*) FROM properties) - (SELECT COUNT(DISTINCT property_id) FROM leases WHERE statut = 'active')
    ),
    'leases', jsonb_build_object(
      'active', (SELECT COUNT(*) FROM leases WHERE statut = 'active'),
      'pending', (SELECT COUNT(*) FROM leases WHERE statut = 'pending_signature'),
      'expiring_soon', (SELECT COUNT(*) FROM leases WHERE statut = 'active' AND date_fin <= CURRENT_DATE + INTERVAL '60 days')
    ),
    'payments', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM invoices WHERE statut IN ('sent', 'late')),
      'late', (SELECT COUNT(*) FROM invoices WHERE statut = 'late'),
      'total_due', (SELECT COALESCE(SUM(montant_total), 0) FROM invoices WHERE statut IN ('sent', 'late')),
      'collected_this_month', (SELECT COALESCE(SUM(montant_total), 0) FROM invoices WHERE statut = 'paid' AND updated_at >= DATE_TRUNC('month', NOW()))
    ),
    'tickets', jsonb_build_object(
      'open', (SELECT COUNT(*) FROM tickets WHERE statut = 'open'),
      'in_progress', (SELECT COUNT(*) FROM tickets WHERE statut = 'in_progress'),
      'high_priority', (SELECT COUNT(*) FROM tickets WHERE statut IN ('open', 'in_progress') AND priorite = 'haute')
    ),
    'notifications', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM notification_queue WHERE status = 'pending'),
      'failed_today', (SELECT COUNT(*) FROM notification_queue WHERE status = 'failed' AND created_at >= CURRENT_DATE)
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Push subscriptions
CREATE POLICY "Users can manage their push subscriptions"
  ON push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- Notification preferences
CREATE POLICY "Users can manage their notification preferences"
  ON notification_preferences FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Notification queue (lecture seule pour les utilisateurs)
CREATE POLICY "Users can view their notifications"
  ON notification_queue FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- SMS messages (lecture seule)
CREATE POLICY "Users can view their SMS"
  ON sms_messages FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Admin audit log (admins seulement)
CREATE POLICY "Admins can view audit log"
  ON admin_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can create audit entries"
  ON admin_audit_log FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- =====================================================
-- 8. TRIGGERS
-- =====================================================

CREATE TRIGGER trg_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_notification_queue_updated_at
  BEFORE UPDATE ON notification_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. COMMENTAIRES
-- =====================================================
COMMENT ON TABLE push_subscriptions IS 'Abonnements aux notifications push Web/Mobile';
COMMENT ON TABLE notification_preferences IS 'Préférences de notification par utilisateur';
COMMENT ON TABLE notification_queue IS 'File d''attente des notifications à envoyer';
COMMENT ON TABLE sms_messages IS 'Historique des SMS envoyés';
COMMENT ON TABLE admin_audit_log IS 'Journal des actions administratives';







