-- =============================================
-- FIX : triggers notify_owner_on_ticket_created et notify_provider_on_work_order
-- =============================================
-- Les fonctions trigger définies en 20260305100001_add_missing_notification_triggers.sql
-- référencent NEW.title et NEW.priority (colonnes inexistantes — la table tickets
-- utilise titre et priorite en français). Résultat : le trigger plante à chaque
-- INSERT de ticket qui a un owner_id (via ERROR 42703 "record 'new' has no field 'title'").
--
-- Fix : remplacer les références anglaises inexistantes par les colonnes françaises
-- réelles, en gardant le même comportement métier.

CREATE OR REPLACE FUNCTION notify_owner_on_ticket_created()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_address TEXT;
BEGIN
  SELECT p.owner_id, COALESCE(p.adresse_complete, 'Logement')
  INTO v_owner_id, v_property_address
  FROM properties p
  WHERE p.id = NEW.property_id;

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (
    profile_id,
    type,
    title,
    message,
    link,
    metadata
  ) VALUES (
    v_owner_id,
    'ticket',
    'Nouveau signalement',
    'Un signalement a été créé pour ' || v_property_address || ' : ' || COALESCE(NEW.titre, 'Sans titre'),
    '/owner/tickets/' || NEW.id,
    jsonb_build_object(
      'ticket_id', NEW.id,
      'property_id', NEW.property_id,
      'priority', COALESCE(NEW.priorite, 'normal')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_provider_on_work_order()
RETURNS TRIGGER AS $$
DECLARE
  v_property_address TEXT;
BEGIN
  -- Seulement si un prestataire est assigné
  -- NB : sur tickets, la colonne est assigned_to (pas provider_id)
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.assigned_to = NEW.assigned_to THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM properties p
  WHERE p.id = NEW.property_id;

  INSERT INTO notifications (
    profile_id,
    type,
    title,
    message,
    link,
    metadata
  ) VALUES (
    NEW.assigned_to,
    'work_order',
    'Nouvelle intervention assignée',
    'Intervention sur ' || COALESCE(v_property_address, 'un bien') || ' : ' || COALESCE(NEW.titre, 'Sans titre'),
    '/provider/tickets/' || NEW.id,
    jsonb_build_object(
      'ticket_id', NEW.id,
      'property_id', NEW.property_id,
      'priority', COALESCE(NEW.priorite, 'normal')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ré-attacher le second trigger au bon nom de colonne (assigned_to)
-- si jamais il pointait encore sur provider_id
DROP TRIGGER IF EXISTS trg_notify_provider_on_work_order ON tickets;
CREATE TRIGGER trg_notify_provider_on_work_order
  AFTER INSERT OR UPDATE OF assigned_to ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_provider_on_work_order();
