-- =====================================================
-- SYSTÈME DE NOTIFICATIONS - MIGRATION ADAPTATIVE
-- =====================================================

-- 1. AJOUTER LES COLONNES MANQUANTES À LA TABLE EXISTANTE
DO $$
BEGIN
  -- Ajouter recipient_id si user_id existe (alias)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'recipient_id'
  ) THEN
    -- La table utilise user_id, pas besoin de recipient_id
    RAISE NOTICE 'Table notifications existe avec user_id, pas besoin de modification';
  END IF;
  
  -- Ajouter related_id si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'related_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN related_id UUID;
  END IF;
  
  -- Ajouter related_type si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'related_type'
  ) THEN
    ALTER TABLE notifications ADD COLUMN related_type TEXT;
  END IF;
  
  -- Ajouter read_at si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. AJOUTER LA COLONNE read SI N'EXISTE PAS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN read BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 3. CRÉER LES INDEX (utiliser user_id)
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 3. ACTIVER RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. CRÉER LES POLICIES
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- 5. FONCTION HELPER POUR CRÉER UNE NOTIFICATION
-- Drop d'abord pour permettre le changement de signature
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT);
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
    user_id, type, title, message, link, related_id, related_type
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
  v_owner_user_id UUID;
  v_tenant_name TEXT;
  v_property_address TEXT;
BEGIN
  IF NEW.statut = 'late' AND (OLD.statut IS NULL OR OLD.statut != 'late') THEN
    SELECT 
      pr.user_id,
      COALESCE(tenant_pr.prenom || ' ' || tenant_pr.nom, 'Locataire'),
      COALESCE(p.adresse_complete, 'Adresse inconnue')
    INTO v_owner_user_id, v_tenant_name, v_property_address
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    JOIN profiles pr ON p.owner_id = pr.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles tenant_pr ON ls.profile_id = tenant_pr.id
    WHERE l.id = NEW.lease_id;
    
    IF v_owner_user_id IS NOT NULL THEN
      PERFORM create_notification(
        v_owner_user_id,
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
  v_owner_user_id UUID;
  v_tenant_name TEXT;
BEGIN
  IF NEW.statut = 'succeeded' AND (OLD.statut IS NULL OR OLD.statut != 'succeeded') THEN
    SELECT 
      pr.user_id,
      COALESCE(tenant_pr.prenom || ' ' || tenant_pr.nom, 'Locataire')
    INTO v_owner_user_id, v_tenant_name
    FROM invoices i
    JOIN leases l ON i.lease_id = l.id
    JOIN properties p ON l.property_id = p.id
    JOIN profiles pr ON p.owner_id = pr.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles tenant_pr ON ls.profile_id = tenant_pr.id
    WHERE i.id = NEW.invoice_id;
    
    IF v_owner_user_id IS NOT NULL THEN
      PERFORM create_notification(
        v_owner_user_id,
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
  v_owner_user_id UUID;
  v_property_address TEXT;
BEGIN
  IF NEW.statut = 'active' AND (OLD.statut IS NULL OR OLD.statut != 'active') THEN
    SELECT pr.user_id, COALESCE(p.adresse_complete, 'Adresse')
    INTO v_owner_user_id, v_property_address
    FROM properties p
    JOIN profiles pr ON p.owner_id = pr.id
    WHERE p.id = NEW.property_id;
    
    IF v_owner_user_id IS NOT NULL THEN
      PERFORM create_notification(
        v_owner_user_id,
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
  v_owner_user_id UUID;
  v_owner_profile_id UUID;
  v_property_address TEXT;
  v_creator_name TEXT;
BEGIN
  SELECT 
    pr.user_id,
    p.owner_id,
    COALESCE(p.adresse_complete, 'Adresse'),
    COALESCE(creator_pr.prenom || ' ' || creator_pr.nom, 'Utilisateur')
  INTO v_owner_user_id, v_owner_profile_id, v_property_address, v_creator_name
  FROM properties p
  JOIN profiles pr ON p.owner_id = pr.id
  LEFT JOIN profiles creator_pr ON creator_pr.id = NEW.created_by_profile_id
  WHERE p.id = NEW.property_id;
  
  IF v_owner_user_id IS NOT NULL AND v_owner_profile_id != NEW.created_by_profile_id THEN
    PERFORM create_notification(
      v_owner_user_id,
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

-- 10. ACTIVER REALTIME (ignorer l'erreur si déjà activé)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table notifications déjà dans supabase_realtime';
END $$;

-- 11. VÉRIFICATION
SELECT 'Système de notifications installé avec succès!' as result;
