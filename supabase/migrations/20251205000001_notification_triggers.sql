-- =====================================================
-- Migration: Triggers de notifications automatiques
-- Date: 2025-12-05
-- Description: Génère des notifications automatiques pour les événements clés
-- =====================================================

-- 1. S'assurer que la table notifications existe avec la bonne structure
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'payment_received', 'payment_late', 'payment_reminder',
    'lease_signed', 'lease_pending_signature', 'lease_expiring',
    'ticket_new', 'ticket_update', 'ticket_resolved',
    'message_new',
    'document_uploaded', 'document_signed',
    'reminder', 'alert', 'system'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  related_id UUID,
  related_type TEXT, -- 'invoice', 'lease', 'ticket', 'message', 'document'
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 2. RLS pour les notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (recipient_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (recipient_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (recipient_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Permettre l'insertion par le système (triggers)
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- FONCTION: Créer une notification
-- =====================================================
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    recipient_id, type, title, message, link, related_id, related_type
  ) VALUES (
    p_recipient_id, p_type, p_title, p_message, p_link, p_related_id, p_related_type
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER 1: Notification quand une facture passe en retard
-- =====================================================
CREATE OR REPLACE FUNCTION notify_invoice_late()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tenant_name TEXT;
  v_property_address TEXT;
  v_amount NUMERIC;
BEGIN
  -- Seulement si le statut passe à 'late'
  IF NEW.statut = 'late' AND (OLD.statut IS NULL OR OLD.statut != 'late') THEN
    -- Récupérer les infos
    SELECT 
      p.owner_id,
      COALESCE(pr.prenom || ' ' || pr.nom, 'Locataire'),
      COALESCE(p.adresse_complete, 'Adresse inconnue'),
      NEW.montant_total
    INTO v_owner_id, v_tenant_name, v_property_address, v_amount
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles pr ON ls.profile_id = pr.id
    WHERE l.id = NEW.lease_id;
    
    -- Notifier le propriétaire
    IF v_owner_id IS NOT NULL THEN
      PERFORM create_notification(
        v_owner_id,
        'payment_late',
        'Loyer impayé',
        format('Le loyer de %s (%s) de %s€ est en retard.', v_tenant_name, v_property_address, v_amount),
        '/app/owner/money?filter=late',
        NEW.id,
        'invoice'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_invoice_late ON invoices;
CREATE TRIGGER trigger_notify_invoice_late
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION notify_invoice_late();

-- =====================================================
-- TRIGGER 2: Notification quand un paiement est reçu
-- =====================================================
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tenant_name TEXT;
  v_amount NUMERIC;
BEGIN
  -- Seulement si le statut passe à 'succeeded'
  IF NEW.statut = 'succeeded' AND (OLD.statut IS NULL OR OLD.statut != 'succeeded') THEN
    -- Récupérer les infos via la facture
    SELECT 
      p.owner_id,
      COALESCE(pr.prenom || ' ' || pr.nom, 'Locataire'),
      NEW.montant
    INTO v_owner_id, v_tenant_name, v_amount
    FROM invoices i
    JOIN leases l ON i.lease_id = l.id
    JOIN properties p ON l.property_id = p.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles pr ON ls.profile_id = pr.id
    WHERE i.id = NEW.invoice_id;
    
    -- Notifier le propriétaire
    IF v_owner_id IS NOT NULL THEN
      PERFORM create_notification(
        v_owner_id,
        'payment_received',
        'Paiement reçu',
        format('Paiement de %s€ reçu de %s.', v_amount, v_tenant_name),
        '/app/owner/money',
        NEW.id,
        'payment'
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
-- TRIGGER 3: Notification quand un bail est signé
-- =====================================================
CREATE OR REPLACE FUNCTION notify_lease_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_address TEXT;
BEGIN
  -- Seulement si le statut passe à 'active'
  IF NEW.statut = 'active' AND (OLD.statut IS NULL OR OLD.statut != 'active') THEN
    -- Récupérer les infos
    SELECT p.owner_id, COALESCE(p.adresse_complete, 'Adresse inconnue')
    INTO v_owner_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;
    
    -- Notifier le propriétaire
    IF v_owner_id IS NOT NULL THEN
      PERFORM create_notification(
        v_owner_id,
        'lease_signed',
        'Bail signé !',
        format('Le bail pour %s est maintenant actif.', v_property_address),
        '/app/owner/leases/' || NEW.id,
        NEW.id,
        'lease'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_lease_signed ON leases;
CREATE TRIGGER trigger_notify_lease_signed
  AFTER UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION notify_lease_signed();

-- =====================================================
-- TRIGGER 4: Notification quand un nouveau ticket est créé
-- =====================================================
CREATE OR REPLACE FUNCTION notify_ticket_created()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_address TEXT;
  v_creator_name TEXT;
BEGIN
  -- Récupérer les infos
  SELECT 
    p.owner_id, 
    COALESCE(p.adresse_complete, 'Adresse inconnue'),
    COALESCE(pr.prenom || ' ' || pr.nom, 'Utilisateur')
  INTO v_owner_id, v_property_address, v_creator_name
  FROM properties p
  LEFT JOIN profiles pr ON pr.id = NEW.created_by_profile_id
  WHERE p.id = NEW.property_id;
  
  -- Notifier le propriétaire (sauf si c'est lui qui a créé le ticket)
  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.created_by_profile_id THEN
    PERFORM create_notification(
      v_owner_id,
      'ticket_new',
      'Nouveau ticket',
      format('%s a signalé un problème : %s (%s)', v_creator_name, NEW.titre, v_property_address),
      '/app/owner/tickets/' || NEW.id,
      NEW.id,
      'ticket'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_ticket_created ON tickets;
CREATE TRIGGER trigger_notify_ticket_created
  AFTER INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_created();

-- =====================================================
-- TRIGGER 5: Notification quand un ticket est résolu
-- =====================================================
CREATE OR REPLACE FUNCTION notify_ticket_resolved()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id UUID;
  v_property_address TEXT;
BEGIN
  -- Seulement si le statut passe à 'resolved' ou 'closed'
  IF NEW.statut IN ('resolved', 'closed') AND OLD.statut NOT IN ('resolved', 'closed') THEN
    -- Récupérer les infos
    SELECT 
      NEW.created_by_profile_id,
      COALESCE(p.adresse_complete, 'Adresse inconnue')
    INTO v_creator_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;
    
    -- Notifier le créateur du ticket
    IF v_creator_id IS NOT NULL THEN
      PERFORM create_notification(
        v_creator_id,
        'ticket_resolved',
        'Ticket résolu',
        format('Votre demande "%s" a été traitée.', NEW.titre),
        '/app/owner/tickets/' || NEW.id,
        NEW.id,
        'ticket'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_ticket_resolved ON tickets;
CREATE TRIGGER trigger_notify_ticket_resolved
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_resolved();

-- =====================================================
-- FONCTION: Générer les notifications de baux expirants
-- (À appeler via cron job)
-- =====================================================
CREATE OR REPLACE FUNCTION generate_lease_expiry_notifications()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_lease RECORD;
BEGIN
  -- Trouver les baux qui expirent dans 60 jours et n'ont pas encore été notifiés
  FOR v_lease IN
    SELECT 
      l.id,
      l.date_fin,
      p.owner_id,
      p.adresse_complete
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    WHERE l.statut = 'active'
      AND l.date_fin IS NOT NULL
      AND l.date_fin BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.related_id = l.id 
        AND n.type = 'lease_expiring'
        AND n.created_at > CURRENT_DATE - INTERVAL '30 days'
      )
  LOOP
    PERFORM create_notification(
      v_lease.owner_id,
      'lease_expiring',
      'Bail arrivant à échéance',
      format('Le bail pour %s expire le %s.', 
        v_lease.adresse_complete, 
        to_char(v_lease.date_fin, 'DD/MM/YYYY')
      ),
      '/app/owner/leases/' || v_lease.id,
      v_lease.id,
      'lease'
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTION: Générer les rappels de loyers impayés
-- (À appeler via cron job)
-- =====================================================
CREATE OR REPLACE FUNCTION generate_payment_reminders()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_invoice RECORD;
BEGIN
  -- Trouver les factures impayées depuis plus de 5 jours
  FOR v_invoice IN
    SELECT 
      i.id,
      i.montant_total,
      i.date_echeance,
      p.owner_id,
      COALESCE(pr.prenom || ' ' || pr.nom, 'Locataire') as tenant_name,
      p.adresse_complete
    FROM invoices i
    JOIN leases l ON i.lease_id = l.id
    JOIN properties p ON l.property_id = p.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles pr ON ls.profile_id = pr.id
    WHERE i.statut IN ('sent', 'late')
      AND i.date_echeance < CURRENT_DATE - INTERVAL '5 days'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.related_id = i.id 
        AND n.type = 'payment_reminder'
        AND n.created_at > CURRENT_DATE - INTERVAL '7 days'
      )
  LOOP
    PERFORM create_notification(
      v_invoice.owner_id,
      'payment_reminder',
      'Rappel loyer impayé',
      format('Le loyer de %s€ de %s (%s) est impayé depuis le %s.', 
        v_invoice.montant_total,
        v_invoice.tenant_name,
        v_invoice.adresse_complete,
        to_char(v_invoice.date_echeance, 'DD/MM/YYYY')
      ),
      '/app/owner/money?filter=late',
      v_invoice.id,
      'invoice'
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Activer le Realtime pour les notifications
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

COMMENT ON TABLE notifications IS 'Notifications automatiques générées par les triggers système';

