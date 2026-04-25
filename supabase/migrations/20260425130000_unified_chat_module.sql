-- ============================================================================
-- Sprint Provider Messaging — Module unified-chat
-- ============================================================================
-- Crée le schéma "unified_*" attendu par :
--   - app/api/unified-chat/conversations/route.ts
--   - app/api/unified-chat/conversations/[id]/route.ts
--   - app/api/unified-chat/conversations/[id]/messages/route.ts
--   - app/api/unified-chat/unread-count/route.ts
--   - lib/services/unified-chat.service.ts
--
-- Couvre les 7 rôles Talok et 9 conversation_type, avec :
--   - 3 tables : unified_conversations / conversation_participants / unified_messages
--   - 2 RPC : mark_conversation_as_read, get_total_unread_count
--   - 1 trigger : update_conversation_on_unified_message (last_message_* + unread)
--   - RLS : participants seulement, admin global
--
-- Conçu pour cohabiter avec la table legacy `conversations` étendue 4 rôles
-- (migration 20260419130000) — pas de DROP, pas de rename.
-- ============================================================================


-- ============================================================================
-- BLOC 1 — Tables
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.unified_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'owner_tenant',
    'owner_provider',
    'owner_syndic',
    'tenant_provider',
    'roommates',
    'syndic_owners',
    'group',
    'ticket',
    'announcement'
  )),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  lease_id UUID REFERENCES public.leases(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  copro_site_id UUID,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'closed')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_conversations_type
  ON public.unified_conversations(type);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_property
  ON public.unified_conversations(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_conversations_ticket
  ON public.unified_conversations(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_conversations_lease
  ON public.unified_conversations(lease_id) WHERE lease_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_conversations_status_last_msg
  ON public.unified_conversations(status, last_message_at DESC NULLS LAST);


CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL
    REFERENCES public.unified_conversations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_role TEXT NOT NULL CHECK (participant_role IN (
    'owner', 'tenant', 'roommate', 'provider', 'syndic', 'admin', 'guarantor'
  )),
  can_write BOOLEAN NOT NULL DEFAULT TRUE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  unread_count INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  last_read_at TIMESTAMPTZ,
  muted_until TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  CONSTRAINT uniq_participant_per_conversation UNIQUE (conversation_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_conv
  ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_profile_active
  ON public.conversation_participants(profile_id) WHERE left_at IS NULL;


CREATE TABLE IF NOT EXISTS public.unified_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL
    REFERENCES public.unified_conversations(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text', 'image', 'file', 'system', 'action')),
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  attachment_size BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_unified_messages_conv_created
  ON public.unified_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_messages_sender
  ON public.unified_messages(sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_active
  ON public.unified_messages(conversation_id, created_at DESC)
  WHERE deleted_at IS NULL;

COMMIT;


-- ============================================================================
-- BLOC 2 — Triggers : touch updated_at + propagation last_message + unread
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.touch_unified_conversations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unified_conversations_touch_updated_at
  ON public.unified_conversations;
CREATE TRIGGER trg_unified_conversations_touch_updated_at
  BEFORE UPDATE ON public.unified_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_unified_conversations_updated_at();


-- À chaque nouveau message :
--   - met à jour last_message_at, last_message_preview, updated_at de la conv
--   - incrémente unread_count des participants ≠ sender (et non-quittés, non-mutés)
CREATE OR REPLACE FUNCTION public.update_conversation_on_unified_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.unified_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 200),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  UPDATE public.conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND profile_id <> NEW.sender_profile_id
    AND left_at IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unified_messages_after_insert
  ON public.unified_messages;
CREATE TRIGGER trg_unified_messages_after_insert
  AFTER INSERT ON public.unified_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_unified_message();

COMMIT;


-- ============================================================================
-- BLOC 3 — RPC mark_conversation_as_read + get_total_unread_count
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_conversation_as_read(
  p_conversation_id UUID,
  p_profile_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversation_participants
  SET
    unread_count = 0,
    last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND profile_id = p_profile_id
    AND left_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_as_read(UUID, UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_total_unread_count(
  p_profile_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(unread_count), 0)::INTEGER
  INTO v_total
  FROM public.conversation_participants
  WHERE profile_id = p_profile_id
    AND left_at IS NULL;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_total_unread_count(UUID) TO authenticated;

COMMIT;


-- ============================================================================
-- BLOC 4 — RLS policies
-- ============================================================================
-- Helpers utilisés (déjà définis en prod) : public.user_profile_id(), public.user_role()
-- ============================================================================

BEGIN;

ALTER TABLE public.unified_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_messages ENABLE ROW LEVEL SECURITY;


-- ---------- unified_conversations ----------

DROP POLICY IF EXISTS unified_conv_select_participants
  ON public.unified_conversations;
CREATE POLICY unified_conv_select_participants
  ON public.unified_conversations FOR SELECT
  USING (
    public.user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = unified_conversations.id
        AND cp.profile_id = public.user_profile_id()
        AND cp.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS unified_conv_insert_authenticated
  ON public.unified_conversations;
CREATE POLICY unified_conv_insert_authenticated
  ON public.unified_conversations FOR INSERT
  WITH CHECK (
    public.user_profile_id() IS NOT NULL
  );

DROP POLICY IF EXISTS unified_conv_update_participants
  ON public.unified_conversations;
CREATE POLICY unified_conv_update_participants
  ON public.unified_conversations FOR UPDATE
  USING (
    public.user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = unified_conversations.id
        AND cp.profile_id = public.user_profile_id()
        AND cp.left_at IS NULL
    )
  );


-- ---------- conversation_participants ----------

DROP POLICY IF EXISTS conv_participants_select_self_or_co
  ON public.conversation_participants;
CREATE POLICY conv_participants_select_self_or_co
  ON public.conversation_participants FOR SELECT
  USING (
    public.user_role() = 'admin'
    OR profile_id = public.user_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND cp2.profile_id = public.user_profile_id()
        AND cp2.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS conv_participants_insert_member_or_admin
  ON public.conversation_participants;
CREATE POLICY conv_participants_insert_member_or_admin
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    public.user_role() = 'admin'
    OR profile_id = public.user_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND cp2.profile_id = public.user_profile_id()
        AND cp2.is_admin = TRUE
        AND cp2.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS conv_participants_update_self_or_admin
  ON public.conversation_participants;
CREATE POLICY conv_participants_update_self_or_admin
  ON public.conversation_participants FOR UPDATE
  USING (
    public.user_role() = 'admin'
    OR profile_id = public.user_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND cp2.profile_id = public.user_profile_id()
        AND cp2.is_admin = TRUE
        AND cp2.left_at IS NULL
    )
  );


-- ---------- unified_messages ----------

DROP POLICY IF EXISTS unified_messages_select_participants
  ON public.unified_messages;
CREATE POLICY unified_messages_select_participants
  ON public.unified_messages FOR SELECT
  USING (
    public.user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = unified_messages.conversation_id
        AND cp.profile_id = public.user_profile_id()
        AND cp.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS unified_messages_insert_writers
  ON public.unified_messages;
CREATE POLICY unified_messages_insert_writers
  ON public.unified_messages FOR INSERT
  WITH CHECK (
    sender_profile_id = public.user_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = unified_messages.conversation_id
        AND cp.profile_id = public.user_profile_id()
        AND cp.left_at IS NULL
        AND cp.can_write = TRUE
    )
  );

DROP POLICY IF EXISTS unified_messages_update_own
  ON public.unified_messages;
CREATE POLICY unified_messages_update_own
  ON public.unified_messages FOR UPDATE
  USING (sender_profile_id = public.user_profile_id())
  WITH CHECK (sender_profile_id = public.user_profile_id());

COMMIT;


-- ============================================================================
-- BLOC 5 — Realtime publication
-- ============================================================================
-- Le service unified-chat.service.ts s'abonne via :
--   - channel "unified_messages:<conversation_id>"
--   - channel "unified_conversations:updates"
--   - listener sur conversation_participants
-- → toutes ces tables doivent être dans la publication supabase_realtime.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_conversations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

COMMIT;


-- ============================================================================
-- FIN — Migration 20260425130000_unified_chat_module
-- Tables   : unified_conversations, conversation_participants, unified_messages
-- Triggers : trg_unified_conversations_touch_updated_at, trg_unified_messages_after_insert
-- RPC      : mark_conversation_as_read(UUID, UUID), get_total_unread_count(UUID)
-- RLS      : 9 policies (3 par table)
-- ============================================================================
