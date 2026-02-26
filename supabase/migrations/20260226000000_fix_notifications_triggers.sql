-- =====================================================
-- MIGRATION: Fix notifications body NOT NULL + trigger document center
-- Date: 2026-02-26
--
-- BUG 1: trg_notify_tenant_document_center faisait INSERT direct sans body/user_id
--        -> échec de l'INSERT document. On utilise create_notification() à la place.
-- BUG 2: create_notification() n'insérait pas body (NOT NULL) -> échec silencieux.
-- =====================================================

BEGIN;

-- Filet de sécurité : body peut avoir une valeur par défaut si jamais oublié
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'body') THEN
    ALTER TABLE notifications ALTER COLUMN body SET DEFAULT '';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fix_notifications] body default: %', SQLERRM;
END $$;

-- Recréer create_notification() en insérant body = p_message (requis NOT NULL)
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
  v_user_id UUID;
  v_is_profile BOOLEAN := false;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE id = p_recipient_id
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    v_is_profile := true;
  ELSE
    v_user_id := p_recipient_id;
  END IF;

  IF v_is_profile THEN
    INSERT INTO notifications (
      user_id,
      profile_id,
      type,
      title,
      body,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_recipient_id,
      p_type,
      p_title,
      COALESCE(NULLIF(TRIM(p_message), ''), '(sans contenu)'),
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  ELSE
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_type,
      p_title,
      COALESCE(NULLIF(TRIM(p_message), ''), '(sans contenu)'),
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN v_notification_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_notification] Erreur: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) IS
'Crée une notification. body et message remplis avec p_message. p_recipient_id = profile_id ou user_id.';

-- Remplacer le trigger document center : utiliser create_notification() au lieu d'INSERT direct
CREATE OR REPLACE FUNCTION notify_tenant_document_center_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_label TEXT;
  v_notification_type TEXT;
  v_message TEXT;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_doc_label := CASE
    WHEN NEW.type IN ('bail', 'contrat', 'avenant') THEN 'Un nouveau bail'
    WHEN NEW.type = 'quittance' THEN 'Une nouvelle quittance'
    WHEN NEW.type IN ('EDL_entree', 'edl_entree') THEN 'Un état des lieux d''entrée'
    WHEN NEW.type IN ('EDL_sortie', 'edl_sortie') THEN 'Un état des lieux de sortie'
    WHEN NEW.type IN ('attestation_assurance') THEN 'Votre attestation d''assurance'
    WHEN NEW.type IN ('dpe', 'erp', 'crep') THEN 'Un diagnostic technique'
    ELSE 'Un document'
  END;

  v_notification_type := CASE
    WHEN NEW.type IN ('bail', 'contrat', 'avenant') THEN 'document_lease_added'
    WHEN NEW.type = 'quittance' THEN 'document_receipt_added'
    WHEN NEW.type LIKE 'EDL%' OR NEW.type LIKE 'edl%' THEN 'document_edl_added'
    ELSE 'document_added'
  END;

  v_message := v_doc_label || ' est disponible dans votre espace documents.';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    PERFORM create_notification(
      NEW.tenant_id,
      v_notification_type,
      v_doc_label || ' a été ajouté',
      v_message,
      '/tenant/documents',
      NEW.id,
      'document'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_tenant_document_center_update] Non-blocking: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tenant_document_center ON documents;
CREATE TRIGGER trg_notify_tenant_document_center
  AFTER INSERT ON documents
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NOT NULL)
  EXECUTE FUNCTION notify_tenant_document_center_update();

COMMIT;
