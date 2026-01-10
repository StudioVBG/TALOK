-- =====================================================
-- SYSTÈME DE NOTIFICATIONS TEMPS RÉEL
-- À exécuter dans: https://supabase.com/dashboard > SQL Editor
-- =====================================================

-- 1. CRÉER LA TABLE NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'payment_received', 'payment_late', 'payment_reminder',
    'lease_signed', 'lease_pending_signature', 'lease_expiring',
    'ticket_new', 'ticket_update', 'ticket_resolved',
    'message_new', 'document_uploaded', 'document_signed',
    'reminder', 'alert', 'system'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  related_id UUID,
  related_type TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- 2. CRÉER LES INDEX
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 3. ACTIVER RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. CRÉER LES POLICIES (supprimer d'abord si existent)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (recipient_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (recipient_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (recipient_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- 5. FONCTION HELPER POUR CRÉER UNE NOTIFICATION
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

-- 6. TRIGGER: FACTURE EN RETARD
CREATE OR REPLACE FUNCTION notify_invoice_late()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tenant_name TEXT;
  v_property_address TEXT;
BEGIN
  IF NEW.statut = 'late' AND (OLD.statut IS NULL OR OLD.statut != 'late') THEN
    SELECT 
      p.owner_id,
      COALESCE(pr.prenom || ' ' || pr.nom, 'Locataire'),
      COALESCE(p.adresse_complete, 'Adresse inconnue')
    INTO v_owner_id, v_tenant_name, v_property_address
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles pr ON ls.profile_id = pr.id
    WHERE l.id = NEW.lease_id;
    
    IF v_owner_id IS NOT NULL THEN
      PERFORM create_notification(
        v_owner_id,
        'payment_late',
        'Loyer impayé',
        format('Le loyer de %s (%s) de %s€ est en retard.', v_tenant_name, v_property_address, NEW.montant_total),
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

-- 7. TRIGGER: PAIEMENT REÇU
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tenant_name TEXT;
BEGIN
  IF NEW.statut = 'succeeded' AND (OLD.statut IS NULL OR OLD.statut != 'succeeded') THEN
    SELECT 
      p.owner_id,
      COALESCE(pr.prenom || ' ' || pr.nom, 'Locataire')
    INTO v_owner_id, v_tenant_name
    FROM invoices i
    JOIN leases l ON i.lease_id = l.id
    JOIN properties p ON l.property_id = p.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles pr ON ls.profile_id = pr.id
    WHERE i.id = NEW.invoice_id;
    
    IF v_owner_id IS NOT NULL THEN
      PERFORM create_notification(
        v_owner_id,
        'payment_received',
        'Paiement reçu',
        format('Paiement de %s€ reçu de %s.', NEW.montant, v_tenant_name),
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

-- 8. TRIGGER: BAIL SIGNÉ
CREATE OR REPLACE FUNCTION notify_lease_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_address TEXT;
BEGIN
  IF NEW.statut = 'active' AND (OLD.statut IS NULL OR OLD.statut != 'active') THEN
    SELECT p.owner_id, COALESCE(p.adresse_complete, 'Adresse')
    INTO v_owner_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;
    
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

-- 9. TRIGGER: NOUVEAU TICKET
CREATE OR REPLACE FUNCTION notify_ticket_created()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_address TEXT;
  v_creator_name TEXT;
BEGIN
  SELECT 
    p.owner_id, 
    COALESCE(p.adresse_complete, 'Adresse'),
    COALESCE(pr.prenom || ' ' || pr.nom, 'Utilisateur')
  INTO v_owner_id, v_property_address, v_creator_name
  FROM properties p
  LEFT JOIN profiles pr ON pr.id = NEW.created_by_profile_id
  WHERE p.id = NEW.property_id;
  
  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.created_by_profile_id THEN
    PERFORM create_notification(
      v_owner_id,
      'ticket_new',
      'Nouveau ticket',
      format('%s a signalé : %s (%s)', v_creator_name, NEW.titre, v_property_address),
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

-- 10. ACTIVER REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 11. VÉRIFICATION
SELECT 'Système de notifications installé avec succès!' as result;

