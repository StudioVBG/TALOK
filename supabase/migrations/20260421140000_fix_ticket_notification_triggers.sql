-- =============================================
-- DROP : triggers notify_owner_on_ticket_created + notify_provider_on_work_order
-- =============================================
-- Ces deux triggers, définis dans 20260305100001_add_missing_notification_triggers.sql,
-- sont à la fois CASSÉS (NEW.title et NEW.priority n'existent pas — les colonnes
-- réelles sont titre / priorite) et REDONDANTS : le parcours canonique passe par
-- l'outbox + la Edge Function process-outbox, qui utilise sendNotification() avec
-- les bonnes colonnes et les bonnes préférences utilisateur.
--
-- Tenter de les "réparer" imposerait de dupliquer le schéma actuel de
-- notifications (qui a divergé : recipient_id / profile_id, body / message,
-- action_url / link, etc.) et de maintenir deux chemins de notification en
-- parallèle. Plus sûr : les dropper.

DROP TRIGGER IF EXISTS trg_notify_owner_on_ticket_created ON tickets;
DROP TRIGGER IF EXISTS trg_notify_provider_on_work_order ON tickets;

DROP FUNCTION IF EXISTS notify_owner_on_ticket_created();
DROP FUNCTION IF EXISTS notify_provider_on_work_order();

-- Le trigger trigger_notify_ticket_created (migration 20251205000001) reste en place :
-- il est correctement écrit (utilise NEW.titre, pas NEW.title) et passe par la
-- fonction helper create_notification() qui cible les bonnes colonnes.
