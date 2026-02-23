-- =====================================================
-- MIGRATION: Audit Notifications — Trigger automatique
-- Date: 2026-02-28
--
-- Crée un trigger sur audit_log qui génère automatiquement
-- des notifications in-app pour tous les admins lorsqu'un
-- événement à risque élevé ou critique est enregistré.
--
-- Cela garantit que les admins sont informés en temps réel
-- même si l'application TypeScript n'appelle pas explicitement
-- alertCriticalAction (ex: insertions directes, triggers SQL).
-- =====================================================

BEGIN;

-- ============================================
-- 1. Fonction trigger : notifier les admins sur audit_log INSERT
-- ============================================
CREATE OR REPLACE FUNCTION notify_admins_on_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
  v_action_label TEXT;
  v_title TEXT;
  v_body TEXT;
  v_type TEXT;
  v_priority TEXT;
BEGIN
  -- Ne traiter que les événements high et critical
  IF NEW.risk_level NOT IN ('high', 'critical') THEN
    RETURN NEW;
  END IF;

  -- Labels lisibles pour les actions
  v_action_label := CASE NEW.action
    WHEN 'delete' THEN 'Suppression'
    WHEN 'role_change' THEN 'Changement de rôle'
    WHEN 'permission_grant' THEN 'Attribution de permission'
    WHEN 'permission_revoke' THEN 'Révocation de permission'
    WHEN '2fa_disabled' THEN '2FA désactivé'
    WHEN 'decrypt' THEN 'Déchiffrement'
    WHEN 'export' THEN 'Export de données'
    WHEN 'failed_login' THEN 'Échec de connexion'
    WHEN 'update' THEN 'Modification'
    WHEN 'create' THEN 'Création'
    WHEN 'read' THEN 'Lecture'
    ELSE NEW.action
  END;

  -- Type et priorité selon le niveau de risque
  IF NEW.risk_level = 'critical' THEN
    v_type := 'audit_critical';
    v_priority := 'urgent';
    v_title := 'Alerte sécurité critique : ' || v_action_label;
  ELSE
    v_type := 'audit_high';
    v_priority := 'high';
    v_title := 'Activité à haut risque : ' || v_action_label;
  END IF;

  v_body := v_action_label || ' sur ' || COALESCE(NEW.entity_type, 'inconnu')
    || '. Utilisateur: ' || LEFT(COALESCE(NEW.user_id::text, 'inconnu'), 8) || '...'
    || CASE WHEN NEW.ip_address IS NOT NULL THEN ' | IP: ' || NEW.ip_address ELSE '' END;

  -- Insérer une notification pour chaque admin
  FOR v_admin IN
    SELECT p.id AS profile_id, p.user_id
    FROM profiles p
    WHERE p.role = 'admin'
  LOOP
    INSERT INTO notifications (
      user_id,
      profile_id,
      type,
      title,
      body,
      is_read,
      priority,
      action_url,
      metadata
    ) VALUES (
      v_admin.user_id,
      v_admin.profile_id,
      v_type,
      v_title,
      v_body,
      false,
      v_priority,
      '/admin/audit-logs',
      jsonb_build_object(
        'audit_log_id', NEW.id,
        'audit_action', NEW.action,
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id,
        'actor_user_id', NEW.user_id,
        'risk_level', NEW.risk_level,
        'ip_address', NEW.ip_address,
        'source', 'audit_trigger'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Trigger sur audit_log
-- ============================================
DROP TRIGGER IF EXISTS trg_audit_notify_admins ON audit_log;
CREATE TRIGGER trg_audit_notify_admins
  AFTER INSERT ON audit_log
  FOR EACH ROW
  WHEN (NEW.risk_level IN ('high', 'critical'))
  EXECUTE FUNCTION notify_admins_on_audit_event();

COMMENT ON FUNCTION notify_admins_on_audit_event() IS
  'Génère des notifications in-app pour tous les admins lors d''un événement audit à risque élevé/critique.';

-- ============================================
-- 3. Index pour accélérer les requêtes de notifications d'audit
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_type_audit
  ON notifications(type) WHERE type IN ('audit_critical', 'audit_high', 'security_alert');

CREATE INDEX IF NOT EXISTS idx_audit_log_risk_level
  ON audit_log(risk_level) WHERE risk_level IN ('high', 'critical');

COMMIT;
