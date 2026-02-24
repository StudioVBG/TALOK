-- ============================================================================
-- MIGRATION CONSOLIDÉE : Tables et colonnes manquantes (connexions BDD)
-- Date: 2026-02-23
-- Corrige : tenant_profiles (CNI/KYC), conversations, messages, documents, storage
-- ============================================================================

-- ============================================
-- 1. COLONNES tenant_profiles (CNI / KYC)
-- ============================================

ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_recto_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verso_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_number TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_expiry_date DATE;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verified_at TIMESTAMPTZ;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verification_method TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS identity_data JSONB DEFAULT '{}';
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS selfie_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS selfie_verified_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_profiles' AND column_name = 'kyc_status'
  ) THEN
    ALTER TABLE tenant_profiles
    ADD COLUMN kyc_status TEXT DEFAULT 'pending'
    CHECK (kyc_status IN ('pending', 'processing', 'verified', 'rejected'));
  END IF;
END $$;

-- ============================================
-- 2. FONCTION update_updated_at (si absente)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. TABLE conversations
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
-- 5. FONCTION RPC mark_messages_as_read
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

  -- Marquer read_at sur les messages non lus reçus par le lecteur
  UPDATE messages
  SET read_at = COALESCE(read_at, NOW())
  WHERE conversation_id = p_conversation_id
    AND sender_profile_id != p_reader_profile_id
    AND read_at IS NULL;

  -- Remettre à zéro le compteur non lu du lecteur
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
-- 6. COLONNES documents (si manquantes)
-- ============================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS collection TEXT DEFAULT 'property_media';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- 7. BUCKET STORAGE documents
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Politique upload pour utilisateurs authentifiés
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- ============================================
-- FIN
-- ============================================================================
