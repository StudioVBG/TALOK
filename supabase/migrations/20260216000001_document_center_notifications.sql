-- =============================================================================
-- Migration : Document Center — Notifications & URL updates
-- Date      : 2026-02-16
-- Auteur    : Audit UX/UI — Unification des routes documentaires
--
-- Objectif  : Mettre à jour les templates de notification et les URLs
--             qui référençaient /tenant/receipts ou /tenant/signatures
--             pour pointer vers /tenant/documents (Document Center unifié).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Mettre à jour les templates d'email qui contiennent les anciennes routes
--    (table email_templates si elle existe)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates') THEN
    -- Remplacer /tenant/receipts par /tenant/documents?type=quittance
    UPDATE email_templates
    SET body = REPLACE(body, '/tenant/receipts', '/tenant/documents?type=quittance'),
        updated_at = NOW()
    WHERE body LIKE '%/tenant/receipts%';

    -- Remplacer /tenant/signatures par /tenant/documents
    UPDATE email_templates
    SET body = REPLACE(body, '/tenant/signatures', '/tenant/documents'),
        updated_at = NOW()
    WHERE body LIKE '%/tenant/signatures%';

    RAISE NOTICE 'email_templates updated: receipts → documents, signatures → documents';
  ELSE
    RAISE NOTICE 'email_templates table does not exist, skipping';
  END IF;
END $$;


-- =============================================================================
-- 2. Mettre à jour les notifications existantes qui pointent vers les anciennes routes
--    (table notifications si elle existe)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    -- Mettre à jour les metadata.action_url des notifications non lues
    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{action_url}',
      to_jsonb(REPLACE(metadata->>'action_url', '/tenant/receipts', '/tenant/documents?type=quittance'))
    )
    WHERE metadata->>'action_url' LIKE '%/tenant/receipts%'
      AND read_at IS NULL;

    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{action_url}',
      to_jsonb(REPLACE(metadata->>'action_url', '/tenant/signatures', '/tenant/documents'))
    )
    WHERE metadata->>'action_url' LIKE '%/tenant/signatures%'
      AND read_at IS NULL;

    RAISE NOTICE 'notifications metadata updated for unread notifications';
  ELSE
    RAISE NOTICE 'notifications table does not exist, skipping';
  END IF;
END $$;


-- =============================================================================
-- 3. Fonction utilitaire : tenant_has_key_document()
--    Vérifie si un locataire a un document clé spécifique
--    Utilisée par les triggers de notification et le dashboard
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_has_key_document(
  p_tenant_id UUID,
  p_slot_key TEXT  -- 'bail', 'quittance', 'edl', 'assurance'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_types TEXT[];
  v_exists BOOLEAN;
BEGIN
  -- Mapper le slot_key aux types de documents
  v_types := CASE p_slot_key
    WHEN 'bail' THEN ARRAY['bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire']
    WHEN 'quittance' THEN ARRAY['quittance']
    WHEN 'edl' THEN ARRAY['EDL_entree', 'edl_entree', 'inventaire']
    WHEN 'assurance' THEN ARRAY['attestation_assurance', 'assurance_pno']
    ELSE ARRAY[]::TEXT[]
  END;

  SELECT EXISTS (
    SELECT 1 FROM documents
    WHERE tenant_id = p_tenant_id
      AND type = ANY(v_types)
      AND (verification_status IS NULL OR verification_status != 'rejected')
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

COMMENT ON FUNCTION public.tenant_has_key_document IS
  'Vérifie si un locataire possède un document clé (bail, quittance, edl, assurance). Utilisé par le Document Center et les triggers.';

GRANT EXECUTE ON FUNCTION public.tenant_has_key_document TO authenticated;


-- =============================================================================
-- 4. Trigger : Notifier le locataire quand un document clé est ajouté
--    (mise à jour du trigger existant pour utiliser les nouvelles routes)
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_tenant_document_center_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_label TEXT;
  v_notification_type TEXT;
BEGIN
  -- Ne notifier que pour les documents liés à un locataire
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Déterminer le label et le type de notification
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

  -- Insérer la notification (si la table existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    INSERT INTO notifications (
      profile_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      NEW.tenant_id,
      v_notification_type,
      v_doc_label || ' a été ajouté',
      v_doc_label || ' est disponible dans votre espace documents.',
      jsonb_build_object(
        'document_id', NEW.id,
        'document_type', NEW.type,
        'action_url', '/tenant/documents',
        'action_label', 'Voir le document'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recréer le trigger
DROP TRIGGER IF EXISTS trg_notify_tenant_document_center ON documents;
CREATE TRIGGER trg_notify_tenant_document_center
  AFTER INSERT ON documents
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NOT NULL)
  EXECUTE FUNCTION notify_tenant_document_center_update();


-- =============================================================================
-- 5. Stats : Fonction pour les analytics du Document Center
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_document_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  IF p_tenant_id IS NOT NULL THEN
    v_profile_id := p_tenant_id;
  ELSE
    SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'by_type', jsonb_object_agg(type, cnt),
    'recent_7d', SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END),
    'has_bail', bool_or(type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire')),
    'has_quittance', bool_or(type = 'quittance'),
    'has_edl', bool_or(type IN ('EDL_entree', 'edl_entree', 'inventaire')),
    'has_assurance', bool_or(type IN ('attestation_assurance', 'assurance_pno'))
  )
  INTO v_result
  FROM (
    SELECT type, COUNT(*) AS cnt, MIN(created_at) AS created_at
    FROM documents
    WHERE tenant_id = v_profile_id
    GROUP BY type
  ) sub;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.tenant_document_stats IS
  'Statistiques du coffre-fort documentaire du locataire : total, par type, récents, flags de complétude.';

GRANT EXECUTE ON FUNCTION public.tenant_document_stats TO authenticated;


COMMIT;

-- =============================================================================
-- Rollback :
--   DROP FUNCTION IF EXISTS public.tenant_has_key_document;
--   DROP FUNCTION IF EXISTS public.tenant_document_stats;
--   DROP FUNCTION IF EXISTS notify_tenant_document_center_update() CASCADE;
--   DROP TRIGGER IF EXISTS trg_notify_tenant_document_center ON documents;
-- =============================================================================
