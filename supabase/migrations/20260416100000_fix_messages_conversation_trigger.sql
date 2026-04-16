-- Migration: Fix Messages Module
-- 1. Trigger AFTER INSERT ON messages → update conversations metadata
-- 2. Backfill existing conversations with last_message data
-- 3. Unique index to prevent duplicate conversations (race condition)

-- ============================================
-- 1. TRIGGER: update conversation on new message
-- ============================================

CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW(),
    owner_unread_count = CASE
      WHEN NEW.sender_role = 'tenant' THEN COALESCE(owner_unread_count, 0) + 1
      ELSE owner_unread_count
    END,
    tenant_unread_count = CASE
      WHEN NEW.sender_role = 'owner' THEN COALESCE(tenant_unread_count, 0) + 1
      ELSE tenant_unread_count
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON messages;

CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();

-- ============================================
-- 2. BACKFILL: populate last_message_at/preview for existing conversations
-- ============================================

UPDATE conversations c
SET
  last_message_at = sub.max_created,
  last_message_preview = sub.last_content,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.created_at AS max_created,
    LEFT(m.content, 100) AS last_content
  FROM messages m
  WHERE m.deleted_at IS NULL
  ORDER BY m.conversation_id, m.created_at DESC
) sub
WHERE c.id = sub.conversation_id
  AND c.last_message_at IS NULL;

-- ============================================
-- 3. UNIQUE INDEX: prevent duplicate active conversations
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_active_pair
  ON conversations (property_id, owner_profile_id, tenant_profile_id)
  WHERE status = 'active';
