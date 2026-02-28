-- ============================================================================
-- MIGRATION : Système de messagerie complet — Tables, RLS, Triggers, Realtime
-- Date: 2026-03-02
-- Contexte: Création des tables conversations/messages + triggers pour
--   chatService.getOrCreateConversation() et le bouton "Nouvelle conversation"
-- ============================================================================

-- ============================================
-- 1. FONCTION update_updated_at (si absente)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. TABLE conversations
-- ============================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  owner_unread_count INTEGER NOT NULL DEFAULT 0,
  tenant_unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_profile_id ON conversations(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_profile_id ON conversations(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_property_id ON conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS conversations
-- ============================================

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can insert conversations" ON conversations;
CREATE POLICY "Users can insert conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

-- ============================================
-- 4. TABLE messages
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('owner', 'tenant')),
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'system')),
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  attachment_size INTEGER,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_profile_id ON messages(sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(conversation_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS messages
-- ============================================

DROP POLICY IF EXISTS "Users can view messages of own conversations" ON messages;
CREATE POLICY "Users can view messages of own conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_profile_id = public.user_profile_id() OR c.tenant_profile_id = public.user_profile_id())
    )
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON messages;
CREATE POLICY "Users can insert messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    sender_profile_id = public.user_profile_id()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_profile_id = public.user_profile_id() OR c.tenant_profile_id = public.user_profile_id())
    )
  );

-- ============================================
-- 6. FONCTION RPC mark_messages_as_read
-- ============================================

CREATE OR REPLACE FUNCTION public.mark_messages_as_read(
  p_conversation_id UUID,
  p_reader_profile_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv RECORD;
BEGIN
  SELECT owner_profile_id, tenant_profile_id INTO v_conv
  FROM conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE messages
  SET read_at = COALESCE(read_at, NOW())
  WHERE conversation_id = p_conversation_id
    AND sender_profile_id != p_reader_profile_id
    AND read_at IS NULL;

  IF v_conv.owner_profile_id = p_reader_profile_id THEN
    UPDATE conversations
    SET owner_unread_count = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
  ELSIF v_conv.tenant_profile_id = p_reader_profile_id THEN
    UPDATE conversations
    SET tenant_unread_count = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(UUID, UUID) TO authenticated;

-- ============================================
-- 7. TRIGGER : MAJ automatique conversation après chaque message
--    (last_message_at, last_message_preview, unread_count)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_conv RECORD;
BEGIN
  SELECT owner_profile_id, tenant_profile_id
  INTO v_conv
  FROM conversations
  WHERE id = NEW.conversation_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_profile_id = v_conv.owner_profile_id THEN
    UPDATE conversations SET
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      tenant_unread_count = tenant_unread_count + 1,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  ELSIF NEW.sender_profile_id = v_conv.tenant_profile_id THEN
    UPDATE conversations SET
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      owner_unread_count = owner_unread_count + 1,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  ELSE
    UPDATE conversations SET
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_conversation_on_new_message ON messages;
CREATE TRIGGER trg_update_conversation_on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();

-- ============================================
-- 8. REALTIME
-- ============================================

ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;

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
-- 9. INDEX unique anti-doublon conversation
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_pair
  ON conversations (property_id, owner_profile_id, tenant_profile_id)
  WHERE status = 'active';

-- ============================================
-- FIN
-- ============================================================================
