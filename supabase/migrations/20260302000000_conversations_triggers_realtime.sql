-- ============================================================================
-- MIGRATION : Triggers et Realtime pour le système de messagerie
-- Date: 2026-03-02
-- Contexte: Le bouton "Nouvelle conversation" (MessagesPageContent) utilise
--   chatService.getOrCreateConversation() qui INSERT dans conversations/messages.
--   Les triggers ci-dessous maintiennent automatiquement les compteurs non-lus,
--   le preview du dernier message, et le tri chronologique.
-- Tables impactées : conversations, messages
-- ============================================================================

-- ============================================
-- 1. TRIGGER : Mise à jour automatique de la conversation après chaque message
--    - last_message_at (tri de la liste)
--    - last_message_preview (aperçu dans la sidebar)
--    - owner_unread_count / tenant_unread_count (badges)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_conv RECORD;
BEGIN
  -- Récupérer la conversation pour déterminer qui est owner/tenant
  SELECT owner_profile_id, tenant_profile_id
  INTO v_conv
  FROM conversations
  WHERE id = NEW.conversation_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Mettre à jour last_message_at, last_message_preview, et incrémenter le compteur non-lu
  IF NEW.sender_profile_id = v_conv.owner_profile_id THEN
    -- Message envoyé par le propriétaire → incrémenter tenant_unread_count
    UPDATE conversations
    SET
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      tenant_unread_count = tenant_unread_count + 1,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  ELSIF NEW.sender_profile_id = v_conv.tenant_profile_id THEN
    -- Message envoyé par le locataire → incrémenter owner_unread_count
    UPDATE conversations
    SET
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      owner_unread_count = owner_unread_count + 1,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  ELSE
    -- Cas générique (ex: message système)
    UPDATE conversations
    SET
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur la table messages
DROP TRIGGER IF EXISTS trg_update_conversation_on_new_message ON messages;
CREATE TRIGGER trg_update_conversation_on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();

-- ============================================
-- 2. REALTIME : Activer la publication pour les mises à jour en temps réel
--    Le chatService souscrit à :
--    - INSERT sur messages (nouveaux messages)
--    - UPDATE sur conversations (compteurs, preview)
-- ============================================

-- REPLICA IDENTITY FULL nécessaire pour que Realtime envoie
-- l'ancienne ET la nouvelle version de la row sur UPDATE
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Ajouter les tables à la publication supabase_realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Table conversations déjà dans supabase_realtime';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Table messages déjà dans supabase_realtime';
END $$;

-- ============================================
-- 3. INDEX : Optimiser la recherche de conversation existante
--    Utilisé par chatService.getOrCreateConversation() pour vérifier
--    si une conversation existe déjà (property_id + owner + tenant)
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_pair
  ON conversations (property_id, owner_profile_id, tenant_profile_id)
  WHERE status = 'active';

-- ============================================
-- FIN
-- ============================================================================
