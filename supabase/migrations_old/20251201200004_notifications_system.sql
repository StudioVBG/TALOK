-- =====================================================
-- MIGRATION: Système de Notifications complet
-- Description: Notifications in-app, emails et alertes automatiques
-- =====================================================

-- =====================================================
-- TABLE: user_notifications (notifications utilisateur)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Destinataire
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Type de notification
  type TEXT NOT NULL CHECK (type IN (
    'payment_received',      -- Paiement reçu
    'payment_due',           -- Paiement dû
    'payment_overdue',       -- Paiement en retard
    'lease_expiring',        -- Bail expire bientôt
    'lease_signed',          -- Bail signé
    'new_ticket',            -- Nouveau ticket
    'ticket_update',         -- Mise à jour ticket
    'new_message',           -- Nouveau message chat
    'new_document',          -- Nouveau document
    'maintenance_scheduled', -- Intervention planifiée
    'maintenance_completed', -- Intervention terminée
    'review_received',       -- Avis reçu
    'system',                -- Notification système
    'reminder',              -- Rappel
    'alert'                  -- Alerte urgente
  )),
  
  -- Contenu
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Lien vers l'action
  action_url TEXT,
  action_label TEXT,
  
  -- Entités liées (optionnel)
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  
  -- Priorité et statut
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  -- Canal d'envoi
  channels TEXT[] DEFAULT ARRAY['in_app'], -- in_app, email, push
  email_sent_at TIMESTAMPTZ,
  push_sent_at TIMESTAMPTZ,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Optionnel: expiration automatique
);

-- Index
CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_id, read_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON user_notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON user_notifications(priority) WHERE priority IN ('high', 'urgent');

-- =====================================================
-- TABLE: notification_preferences (préférences)
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Préférences par type
  payment_due_email BOOLEAN DEFAULT TRUE,
  payment_due_push BOOLEAN DEFAULT TRUE,
  payment_overdue_email BOOLEAN DEFAULT TRUE,
  payment_overdue_push BOOLEAN DEFAULT TRUE,
  
  lease_expiring_email BOOLEAN DEFAULT TRUE,
  lease_expiring_push BOOLEAN DEFAULT TRUE,
  
  new_ticket_email BOOLEAN DEFAULT TRUE,
  new_ticket_push BOOLEAN DEFAULT TRUE,
  ticket_update_email BOOLEAN DEFAULT FALSE,
  ticket_update_push BOOLEAN DEFAULT TRUE,
  
  new_message_email BOOLEAN DEFAULT FALSE,
  new_message_push BOOLEAN DEFAULT TRUE,
  
  maintenance_email BOOLEAN DEFAULT TRUE,
  maintenance_push BOOLEAN DEFAULT TRUE,
  
  review_received_email BOOLEAN DEFAULT TRUE,
  review_received_push BOOLEAN DEFAULT TRUE,
  
  -- Résumés
  daily_summary_email BOOLEAN DEFAULT FALSE,
  weekly_summary_email BOOLEAN DEFAULT TRUE,
  
  -- Ne pas déranger
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_days TEXT[], -- ['saturday', 'sunday']
  
  -- Push tokens
  push_tokens JSONB DEFAULT '[]', -- [{token: ..., device: ..., platform: ...}]
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- =====================================================
-- TABLE: scheduled_notifications (notifications planifiées)
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Qui et quoi
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  notification_data JSONB NOT NULL,
  
  -- Planification
  scheduled_for TIMESTAMPTZ NOT NULL,
  recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly'
  
  -- Statut
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending 
  ON scheduled_notifications(scheduled_for) 
  WHERE status = 'pending';

-- =====================================================
-- FONCTION: Créer une notification
-- =====================================================
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_action_url TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_prefs notification_preferences;
  v_channels TEXT[] := ARRAY['in_app'];
BEGIN
  -- Récupérer les préférences
  SELECT * INTO v_prefs FROM notification_preferences WHERE user_id = p_user_id;
  
  -- Déterminer les canaux selon les préférences
  IF v_prefs IS NOT NULL THEN
    -- Ajouter email selon le type
    IF (p_type = 'payment_due' AND v_prefs.payment_due_email) OR
       (p_type = 'payment_overdue' AND v_prefs.payment_overdue_email) OR
       (p_type = 'new_ticket' AND v_prefs.new_ticket_email) OR
       (p_type = 'new_message' AND v_prefs.new_message_email) OR
       (p_type = 'lease_expiring' AND v_prefs.lease_expiring_email) THEN
      v_channels := array_append(v_channels, 'email');
    END IF;
    
    -- Ajouter push selon le type
    IF (p_type = 'payment_due' AND v_prefs.payment_due_push) OR
       (p_type = 'payment_overdue' AND v_prefs.payment_overdue_push) OR
       (p_type = 'new_ticket' AND v_prefs.new_ticket_push) OR
       (p_type = 'new_message' AND v_prefs.new_message_push) OR
       (p_type = 'lease_expiring' AND v_prefs.lease_expiring_push) THEN
      v_channels := array_append(v_channels, 'push');
    END IF;
  ELSE
    -- Préférences par défaut
    v_channels := ARRAY['in_app', 'email'];
  END IF;
  
  -- Créer la notification
  INSERT INTO user_notifications (
    user_id,
    type,
    title,
    message,
    action_url,
    priority,
    channels,
    metadata
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_action_url,
    p_priority,
    v_channels,
    p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTION: Marquer comme lu
-- =====================================================
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_notifications
  SET read_at = NOW()
  WHERE id = p_notification_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTION: Marquer toutes comme lues
-- =====================================================
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
  UPDATE user_notifications
  SET read_at = NOW()
  WHERE user_id = auth.uid()
    AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Notification automatique nouveau ticket
-- =====================================================
CREATE OR REPLACE FUNCTION notify_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_user_id UUID;
  v_property_address TEXT;
BEGIN
  -- Récupérer le propriétaire et l'adresse
  SELECT p.user_id, prop.adresse_complete || ', ' || prop.ville
  INTO v_owner_user_id, v_property_address
  FROM properties prop
  JOIN profiles p ON prop.owner_id = p.id
  WHERE prop.id = NEW.property_id;
  
  IF v_owner_user_id IS NOT NULL THEN
    PERFORM create_notification(
      v_owner_user_id,
      'new_ticket',
      'Nouveau ticket de maintenance',
      'Un nouveau ticket a été créé pour ' || v_property_address || ': ' || NEW.titre,
      '/app/owner/tickets/' || NEW.id,
      CASE NEW.priorite WHEN 'haute' THEN 'high' ELSE 'normal' END,
      jsonb_build_object('ticket_id', NEW.id, 'priority', NEW.priorite)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_ticket ON tickets;
CREATE TRIGGER trigger_notify_new_ticket
  AFTER INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_ticket();

-- =====================================================
-- TRIGGER: Notification paiement reçu
-- =====================================================
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_user_id UUID;
  v_amount NUMERIC;
BEGIN
  IF NEW.statut = 'succeeded' AND (OLD.statut IS NULL OR OLD.statut != 'succeeded') THEN
    -- Récupérer le propriétaire via la facture
    SELECT u.id, i.montant_total
    INTO v_owner_user_id, v_amount
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    JOIN profiles pr ON i.owner_id = pr.id
    JOIN auth.users u ON pr.user_id = u.id
    WHERE p.id = NEW.id;
    
    IF v_owner_user_id IS NOT NULL THEN
      PERFORM create_notification(
        v_owner_user_id,
        'payment_received',
        'Paiement reçu',
        'Un paiement de ' || v_amount || '€ a été reçu.',
        '/app/owner/money',
        'normal',
        jsonb_build_object('payment_id', NEW.id, 'amount', v_amount)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_payment_received ON payments;
CREATE TRIGGER trigger_notify_payment_received
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_received();

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Notifications: utilisateurs voient leurs propres notifications
CREATE POLICY "Users can view own notifications"
  ON user_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON user_notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Préférences: utilisateurs gèrent leurs propres préférences
CREATE POLICY "Users can manage own preferences"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid());

-- Planifiées: utilisateurs voient leurs propres
CREATE POLICY "Users can view own scheduled"
  ON scheduled_notifications FOR SELECT
  USING (user_id = auth.uid());

-- =====================================================
-- REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;

