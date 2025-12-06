-- =====================================================
-- MIGRATION: Notifications et rappels pour les compteurs
-- Description: Types de notifications + triggers automatiques
-- =====================================================

BEGIN;

-- =====================================================
-- 1. AJOUTER LES TYPES DE NOTIFICATIONS POUR COMPTEURS
-- =====================================================

-- Modifier la contrainte CHECK pour inclure les nouveaux types
-- Note: On doit d'abord supprimer l'ancienne contrainte et en créer une nouvelle

-- Vérifier si la table user_notifications existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_notifications') THEN
    -- Supprimer l'ancienne contrainte si elle existe
    IF EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage 
      WHERE table_name = 'user_notifications' AND column_name = 'type'
    ) THEN
      ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
    END IF;
    
    -- Ajouter la nouvelle contrainte avec les types de compteurs
    ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_type_check CHECK (type IN (
      -- Types existants
      'payment_received',
      'payment_due',
      'payment_overdue',
      'lease_expiring',
      'lease_signed',
      'new_ticket',
      'ticket_update',
      'new_message',
      'new_document',
      'maintenance_scheduled',
      'maintenance_completed',
      'review_received',
      'system',
      'reminder',
      'alert',
      -- Nouveaux types pour les compteurs
      'meter_reading_required',     -- Relevé de compteur requis (EDL)
      'meter_reading_reminder',     -- Rappel de relevé mensuel
      'meter_reading_submitted',    -- Relevé soumis (pour le propriétaire)
      'meter_anomaly_detected',     -- Anomalie détectée sur un relevé
      'edl_scheduled',              -- EDL programmé
      'edl_meter_pending'           -- Compteurs en attente de relevé pour EDL
    ));
  END IF;
END $$;

-- Faire de même pour la table notifications (ancienne)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    -- Pas de contrainte stricte sur l'ancienne table pour compatibilité
  END IF;
END $$;

-- =====================================================
-- 2. FONCTION POUR CRÉER UNE NOTIFICATION
-- =====================================================

CREATE OR REPLACE FUNCTION create_meter_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_property_id UUID DEFAULT NULL,
  p_lease_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_profile_id UUID;
BEGIN
  -- Récupérer le profile_id
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = p_user_id;
  
  -- Essayer d'insérer dans user_notifications (nouvelle table)
  BEGIN
    INSERT INTO user_notifications (
      user_id,
      profile_id,
      type,
      title,
      message,
      property_id,
      lease_id,
      action_url,
      priority,
      metadata,
      channels
    ) VALUES (
      p_user_id,
      v_profile_id,
      p_type,
      p_title,
      p_message,
      p_property_id,
      p_lease_id,
      p_action_url,
      p_priority,
      p_metadata,
      ARRAY['in_app']
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
  EXCEPTION WHEN undefined_table THEN
    -- Si user_notifications n'existe pas, utiliser notifications
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      p_user_id,
      p_type,
      p_title,
      p_message,
      p_metadata || jsonb_build_object(
        'property_id', p_property_id,
        'lease_id', p_lease_id,
        'action_url', p_action_url
      )
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. TRIGGER: NOTIFICATION QUAND UN EDL EST CRÉÉ
-- =====================================================

CREATE OR REPLACE FUNCTION notify_edl_created() RETURNS TRIGGER AS $$
DECLARE
  v_lease RECORD;
  v_property RECORD;
  v_signer RECORD;
  v_edl_type_label TEXT;
BEGIN
  -- Récupérer les infos du bail et du logement
  SELECT l.*, p.adresse_complete, p.ville, p.owner_id
  INTO v_lease
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = NEW.lease_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Label du type d'EDL
  v_edl_type_label := CASE NEW.type 
    WHEN 'entree' THEN 'd''entrée'
    WHEN 'sortie' THEN 'de sortie'
    ELSE ''
  END;
  
  -- Notifier tous les signataires du bail (locataires)
  FOR v_signer IN 
    SELECT DISTINCT ls.profile_id, p.user_id
    FROM lease_signers ls
    JOIN profiles p ON ls.profile_id = p.id
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire')
  LOOP
    PERFORM create_meter_notification(
      v_signer.user_id,
      'edl_scheduled',
      'État des lieux ' || v_edl_type_label || ' programmé',
      'Un état des lieux ' || v_edl_type_label || ' est programmé pour le logement ' || 
        COALESCE(v_lease.adresse_complete, '') || '. N''oubliez pas de préparer vos relevés de compteurs.',
      v_lease.property_id,
      NEW.lease_id,
      '/app/tenant/meters',
      'high',
      jsonb_build_object(
        'edl_id', NEW.id,
        'edl_type', NEW.type,
        'scheduled_date', NEW.scheduled_date
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger si la table edl existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'edl') THEN
    DROP TRIGGER IF EXISTS trg_notify_edl_created ON edl;
    CREATE TRIGGER trg_notify_edl_created
      AFTER INSERT ON edl
      FOR EACH ROW
      EXECUTE FUNCTION notify_edl_created();
  END IF;
END $$;

-- =====================================================
-- 4. TRIGGER: NOTIFICATION QUAND UN RELEVÉ EST SOUMIS
-- =====================================================

CREATE OR REPLACE FUNCTION notify_meter_reading_submitted() RETURNS TRIGGER AS $$
DECLARE
  v_edl RECORD;
  v_lease RECORD;
  v_meter RECORD;
  v_owner_user_id UUID;
  v_meter_type_label TEXT;
BEGIN
  -- Récupérer les infos de l'EDL, du bail et du propriétaire
  SELECT e.*, l.property_id
  INTO v_edl
  FROM edl e
  JOIN leases l ON e.lease_id = l.id
  WHERE e.id = NEW.edl_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Récupérer le compteur
  SELECT * INTO v_meter FROM meters WHERE id = NEW.meter_id;
  
  -- Label du type de compteur
  v_meter_type_label := CASE v_meter.type 
    WHEN 'electricity' THEN 'Électricité'
    WHEN 'gas' THEN 'Gaz'
    WHEN 'water' THEN 'Eau'
    ELSE v_meter.type
  END;
  
  -- Récupérer le user_id du propriétaire
  SELECT p.user_id INTO v_owner_user_id
  FROM properties prop
  JOIN profiles p ON prop.owner_id = p.id
  WHERE prop.id = v_edl.property_id;
  
  IF v_owner_user_id IS NOT NULL THEN
    PERFORM create_meter_notification(
      v_owner_user_id,
      'meter_reading_submitted',
      'Nouveau relevé de compteur',
      'Un relevé de compteur ' || v_meter_type_label || ' (' || 
        NEW.reading_value || ' ' || NEW.reading_unit || ') a été soumis pour l''EDL.',
      v_edl.property_id,
      v_edl.lease_id,
      '/app/owner/inspections/' || NEW.edl_id,
      'normal',
      jsonb_build_object(
        'edl_id', NEW.edl_id,
        'meter_id', NEW.meter_id,
        'meter_type', v_meter.type,
        'reading_value', NEW.reading_value,
        'reading_unit', NEW.reading_unit,
        'ocr_confidence', NEW.ocr_confidence
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger si la table edl_meter_readings existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'edl_meter_readings') THEN
    DROP TRIGGER IF EXISTS trg_notify_meter_reading_submitted ON edl_meter_readings;
    CREATE TRIGGER trg_notify_meter_reading_submitted
      AFTER INSERT ON edl_meter_readings
      FOR EACH ROW
      EXECUTE FUNCTION notify_meter_reading_submitted();
  END IF;
END $$;

-- =====================================================
-- 5. FONCTION POUR ENVOYER DES RAPPELS DE RELEVÉ
-- (À appeler via un cron job ou Edge Function)
-- =====================================================

CREATE OR REPLACE FUNCTION send_meter_reading_reminders() RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_tenant RECORD;
  v_property RECORD;
BEGIN
  -- Trouver les baux actifs avec des compteurs
  FOR v_tenant IN
    SELECT DISTINCT 
      ls.profile_id,
      p.user_id,
      l.id AS lease_id,
      l.property_id,
      prop.adresse_complete,
      prop.ville
    FROM lease_signers ls
    JOIN profiles p ON ls.profile_id = p.id
    JOIN leases l ON ls.lease_id = l.id
    JOIN properties prop ON l.property_id = prop.id
    JOIN meters m ON m.property_id = prop.id AND m.is_active = true
    WHERE l.statut = 'active'
      AND ls.role IN ('locataire_principal', 'colocataire')
      -- Pas de relevé ce mois-ci
      AND NOT EXISTS (
        SELECT 1 FROM meter_readings mr
        WHERE mr.meter_id = m.id
          AND DATE_TRUNC('month', mr.reading_date) = DATE_TRUNC('month', CURRENT_DATE)
      )
      -- Pas de notification de rappel envoyée cette semaine
      AND NOT EXISTS (
        SELECT 1 FROM user_notifications un
        WHERE un.user_id = p.user_id
          AND un.type = 'meter_reading_reminder'
          AND un.created_at > CURRENT_DATE - INTERVAL '7 days'
      )
  LOOP
    -- Créer la notification de rappel
    PERFORM create_meter_notification(
      v_tenant.user_id,
      'meter_reading_reminder',
      'Rappel : Relevé de compteurs',
      'N''oubliez pas d''effectuer vos relevés de compteurs mensuels pour ' || 
        COALESCE(v_tenant.adresse_complete, 'votre logement') || '.',
      v_tenant.property_id,
      v_tenant.lease_id,
      '/app/tenant/meters',
      'normal',
      jsonb_build_object('reminder_type', 'monthly')
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. VUE POUR FACILITER L'AFFICHAGE DES NOTIFICATIONS COMPTEURS
-- =====================================================

CREATE OR REPLACE VIEW v_meter_notifications AS
SELECT 
  un.*,
  p.adresse_complete AS property_address,
  p.ville AS property_city,
  CASE un.type
    WHEN 'meter_reading_required' THEN '📊'
    WHEN 'meter_reading_reminder' THEN '⏰'
    WHEN 'meter_reading_submitted' THEN '✅'
    WHEN 'meter_anomaly_detected' THEN '⚠️'
    WHEN 'edl_scheduled' THEN '📋'
    WHEN 'edl_meter_pending' THEN '🔔'
    ELSE '📌'
  END AS icon
FROM user_notifications un
LEFT JOIN properties p ON un.property_id = p.id
WHERE un.type IN (
  'meter_reading_required',
  'meter_reading_reminder', 
  'meter_reading_submitted',
  'meter_anomaly_detected',
  'edl_scheduled',
  'edl_meter_pending'
);

COMMIT;

