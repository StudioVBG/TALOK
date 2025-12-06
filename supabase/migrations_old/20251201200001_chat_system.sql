-- =====================================================
-- MIGRATION: Système de Chat en temps réel
-- Description: Conversations et messages entre propriétaires et locataires
-- =====================================================

-- =====================================================
-- TABLE: conversations
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Participants
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Metadata
  subject TEXT, -- Sujet optionnel
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  
  -- Statut
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  
  -- Compteurs non lus (par participant)
  owner_unread_count INTEGER DEFAULT 0,
  tenant_unread_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Contrainte unique: une conversation par paire propriétaire-locataire par bien
  UNIQUE(property_id, owner_profile_id, tenant_profile_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_property ON conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- =====================================================
-- TABLE: messages
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Auteur
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('owner', 'tenant')),
  
  -- Contenu
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'system')),
  
  -- Fichier attaché (optionnel)
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  attachment_size INTEGER,
  
  -- Statut de lecture
  read_at TIMESTAMPTZ,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Index
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, read_at) WHERE read_at IS NULL;

-- =====================================================
-- TABLE: message_reactions (optionnel)
-- =====================================================
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL, -- emoji comme '👍', '❤️', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, profile_id, reaction)
);

-- =====================================================
-- FONCTION: Mettre à jour last_message_at de la conversation
-- =====================================================
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW(),
    -- Incrémenter le compteur non lu pour l'autre participant
    owner_unread_count = CASE 
      WHEN NEW.sender_role = 'tenant' THEN owner_unread_count + 1 
      ELSE owner_unread_count 
    END,
    tenant_unread_count = CASE 
      WHEN NEW.sender_role = 'owner' THEN tenant_unread_count + 1 
      ELSE tenant_unread_count 
    END
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON messages;
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- =====================================================
-- FONCTION: Marquer les messages comme lus
-- =====================================================
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_conversation_id UUID,
  p_reader_profile_id UUID
)
RETURNS void AS $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  -- Déterminer si le lecteur est le propriétaire
  SELECT owner_profile_id = p_reader_profile_id INTO v_is_owner
  FROM conversations WHERE id = p_conversation_id;
  
  -- Marquer les messages non lus comme lus
  UPDATE messages
  SET read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND sender_profile_id != p_reader_profile_id
    AND read_at IS NULL;
  
  -- Réinitialiser le compteur non lu
  IF v_is_owner THEN
    UPDATE conversations SET owner_unread_count = 0 WHERE id = p_conversation_id;
  ELSE
    UPDATE conversations SET tenant_unread_count = 0 WHERE id = p_conversation_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Conversations: les participants peuvent voir leurs conversations
CREATE POLICY "Participants can view their conversations"
  ON conversations FOR SELECT
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR tenant_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Conversations: les participants peuvent créer des conversations
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR tenant_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Conversations: les participants peuvent mettre à jour leurs conversations
CREATE POLICY "Participants can update their conversations"
  ON conversations FOR UPDATE
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR tenant_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Messages: les participants de la conversation peuvent voir les messages
CREATE POLICY "Conversation participants can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR c.tenant_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

-- Messages: les participants peuvent envoyer des messages
CREATE POLICY "Conversation participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.owner_profile_id = sender_profile_id
        OR c.tenant_profile_id = sender_profile_id
      )
    )
  );

-- Messages: l'auteur peut modifier son message
CREATE POLICY "Authors can update their messages"
  ON messages FOR UPDATE
  USING (
    sender_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Reactions: les participants peuvent voir les réactions
CREATE POLICY "Conversation participants can view reactions"
  ON message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = message_reactions.message_id
      AND (
        c.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR c.tenant_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

-- Reactions: les participants peuvent ajouter des réactions
CREATE POLICY "Participants can add reactions"
  ON message_reactions FOR INSERT
  WITH CHECK (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Reactions: les auteurs peuvent supprimer leurs réactions
CREATE POLICY "Authors can delete their reactions"
  ON message_reactions FOR DELETE
  USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- =====================================================
-- REALTIME: Activer les notifications en temps réel
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

