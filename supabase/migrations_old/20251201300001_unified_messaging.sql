-- =====================================================
-- MIGRATION: Système de messagerie unifié multi-rôles
-- Description: Permet la communication entre tous les rôles
-- (propriétaires, locataires, colocataires, prestataires, syndics, admin)
-- =====================================================

-- =====================================================
-- TABLE: unified_conversations
-- =====================================================
CREATE TABLE IF NOT EXISTS unified_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Type de conversation
  type TEXT NOT NULL CHECK (type IN (
    'owner_tenant',      -- Propriétaire ↔ Locataire
    'owner_provider',    -- Propriétaire ↔ Prestataire
    'owner_syndic',      -- Propriétaire ↔ Syndic
    'tenant_provider',   -- Locataire ↔ Prestataire (pour tickets)
    'roommates',         -- Entre colocataires
    'syndic_owners',     -- Syndic ↔ Groupe de propriétaires
    'group',             -- Discussion de groupe
    'ticket',            -- Liée à un ticket
    'announcement'       -- Annonces
  )),
  
  -- Contexte optionnel
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  copro_site_id UUID, -- Pour les syndics (référence à copro_sites si existant)
  
  -- Metadata
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour unified_conversations
CREATE INDEX IF NOT EXISTS idx_unified_conv_type ON unified_conversations(type);
CREATE INDEX IF NOT EXISTS idx_unified_conv_property ON unified_conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_unified_conv_lease ON unified_conversations(lease_id);
CREATE INDEX IF NOT EXISTS idx_unified_conv_ticket ON unified_conversations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_unified_conv_last_message ON unified_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_conv_status ON unified_conversations(status);

-- =====================================================
-- TABLE: conversation_participants
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES unified_conversations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Rôle dans la conversation
  participant_role TEXT NOT NULL CHECK (participant_role IN (
    'owner', 'tenant', 'roommate', 'provider', 'syndic', 'admin', 'guarantor'
  )),
  
  -- Permissions
  can_write BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false, -- Peut ajouter/retirer des participants
  
  -- Compteur de messages non lus
  unread_count INTEGER DEFAULT 0,
  last_read_at TIMESTAMPTZ,
  
  -- Notifications
  muted_until TIMESTAMPTZ, -- Mettre en sourdine
  
  -- Timestamps
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ, -- NULL si toujours membre
  
  UNIQUE(conversation_id, profile_id)
);

-- Index pour conversation_participants
CREATE INDEX IF NOT EXISTS idx_conv_participants_profile ON conversation_participants(profile_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_role ON conversation_participants(participant_role);
CREATE INDEX IF NOT EXISTS idx_conv_participants_unread ON conversation_participants(profile_id, unread_count) WHERE unread_count > 0;

-- =====================================================
-- TABLE: unified_messages
-- =====================================================
CREATE TABLE IF NOT EXISTS unified_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES unified_conversations(id) ON DELETE CASCADE,
  
  -- Auteur
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Contenu
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'system', 'action')),
  
  -- Fichiers attachés
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  attachment_size INTEGER,
  
  -- Métadonnées (pour les messages système ou actions)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Index pour unified_messages
CREATE INDEX IF NOT EXISTS idx_unified_messages_conversation ON unified_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_messages_sender ON unified_messages(sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_created ON unified_messages(created_at DESC);

-- =====================================================
-- TABLE: message_read_receipts (optionnel - pour tracking précis)
-- =====================================================
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES unified_messages(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_profile ON message_read_receipts(profile_id);

-- =====================================================
-- TRIGGER: Mise à jour automatique de updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_unified_conv_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unified_conv_updated_at ON unified_conversations;
CREATE TRIGGER trigger_unified_conv_updated_at
  BEFORE UPDATE ON unified_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_unified_conv_updated_at();

-- =====================================================
-- TRIGGER: Mise à jour du compteur de messages non lus
-- =====================================================
CREATE OR REPLACE FUNCTION update_participant_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Incrémenter le compteur pour tous les participants sauf l'expéditeur
  UPDATE conversation_participants
  SET 
    unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND profile_id != NEW.sender_profile_id
    AND left_at IS NULL;
  
  -- Mettre à jour la conversation
  UPDATE unified_conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_unread_count ON unified_messages;
CREATE TRIGGER trigger_update_unread_count
  AFTER INSERT ON unified_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_participant_unread_count();

-- =====================================================
-- FONCTION: Marquer comme lu
-- =====================================================
CREATE OR REPLACE FUNCTION mark_conversation_as_read(
  p_conversation_id UUID,
  p_profile_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE conversation_participants
  SET 
    unread_count = 0,
    last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND profile_id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTION: Obtenir ou créer une conversation
-- =====================================================
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_type TEXT,
  p_participant_ids UUID[],
  p_participant_roles TEXT[],
  p_property_id UUID DEFAULT NULL,
  p_lease_id UUID DEFAULT NULL,
  p_ticket_id UUID DEFAULT NULL,
  p_subject TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_participant_id UUID;
  v_idx INTEGER;
BEGIN
  -- Chercher une conversation existante avec les mêmes participants
  SELECT uc.id INTO v_conversation_id
  FROM unified_conversations uc
  WHERE uc.type = p_type
    AND uc.status = 'active'
    AND (p_property_id IS NULL OR uc.property_id = p_property_id)
    AND (p_lease_id IS NULL OR uc.lease_id = p_lease_id)
    AND (
      SELECT COUNT(DISTINCT cp.profile_id) 
      FROM conversation_participants cp 
      WHERE cp.conversation_id = uc.id 
        AND cp.left_at IS NULL
        AND cp.profile_id = ANY(p_participant_ids)
    ) = array_length(p_participant_ids, 1)
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  -- Créer une nouvelle conversation
  INSERT INTO unified_conversations (type, property_id, lease_id, ticket_id, subject)
  VALUES (p_type, p_property_id, p_lease_id, p_ticket_id, p_subject)
  RETURNING id INTO v_conversation_id;

  -- Ajouter les participants
  FOR v_idx IN 1..array_length(p_participant_ids, 1) LOOP
    INSERT INTO conversation_participants (conversation_id, profile_id, participant_role, is_admin)
    VALUES (
      v_conversation_id,
      p_participant_ids[v_idx],
      p_participant_roles[v_idx],
      v_idx = 1  -- Le premier participant est admin
    )
    ON CONFLICT (conversation_id, profile_id) DO NOTHING;
  END LOOP;

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTION: Compter les messages non lus pour un utilisateur
-- =====================================================
CREATE OR REPLACE FUNCTION get_total_unread_count(p_profile_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COALESCE(SUM(unread_count), 0) INTO v_count
  FROM conversation_participants
  WHERE profile_id = p_profile_id
    AND left_at IS NULL;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE unified_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Participants can view their conversations" ON unified_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON unified_conversations;
DROP POLICY IF EXISTS "Participants can update their conversations" ON unified_conversations;
DROP POLICY IF EXISTS "Members can view participants" ON conversation_participants;
DROP POLICY IF EXISTS "Admins can add participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can update their participation" ON conversation_participants;
DROP POLICY IF EXISTS "Participants can view messages" ON unified_messages;
DROP POLICY IF EXISTS "Participants can send messages" ON unified_messages;
DROP POLICY IF EXISTS "Authors can update their messages" ON unified_messages;
DROP POLICY IF EXISTS "Users can view their read receipts" ON message_read_receipts;
DROP POLICY IF EXISTS "Users can insert read receipts" ON message_read_receipts;

-- Conversations: les participants peuvent voir leurs conversations
CREATE POLICY "Participants can view their conversations"
  ON unified_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      JOIN profiles p ON p.id = cp.profile_id
      WHERE cp.conversation_id = unified_conversations.id
        AND p.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Conversations: les utilisateurs peuvent créer des conversations
CREATE POLICY "Users can create conversations"
  ON unified_conversations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Conversations: les participants peuvent mettre à jour
CREATE POLICY "Participants can update their conversations"
  ON unified_conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      JOIN profiles p ON p.id = cp.profile_id
      WHERE cp.conversation_id = unified_conversations.id
        AND p.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- Participants: les membres peuvent voir les autres participants
CREATE POLICY "Members can view participants"
  ON conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants my_cp
      JOIN profiles p ON p.id = my_cp.profile_id
      WHERE my_cp.conversation_id = conversation_participants.conversation_id
        AND p.user_id = auth.uid()
        AND my_cp.left_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Participants: ajout autorisé pour les utilisateurs authentifiés
CREATE POLICY "Admins can add participants"
  ON conversation_participants FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Participants: mise à jour de sa propre participation
CREATE POLICY "Users can update their participation"
  ON conversation_participants FOR UPDATE
  USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM conversation_participants cp
      JOIN profiles p ON p.id = cp.profile_id
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND p.user_id = auth.uid()
        AND cp.is_admin = true
    )
  );

-- Messages: les participants peuvent voir les messages
CREATE POLICY "Participants can view messages"
  ON unified_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      JOIN profiles p ON p.id = cp.profile_id
      WHERE cp.conversation_id = unified_messages.conversation_id
        AND p.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Messages: les participants peuvent envoyer des messages
CREATE POLICY "Participants can send messages"
  ON unified_messages FOR INSERT
  WITH CHECK (
    sender_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = unified_messages.conversation_id
        AND cp.profile_id = sender_profile_id
        AND cp.can_write = true
        AND cp.left_at IS NULL
    )
  );

-- Messages: les auteurs peuvent modifier leurs messages
CREATE POLICY "Authors can update their messages"
  ON unified_messages FOR UPDATE
  USING (
    sender_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Read receipts: voir ses propres confirmations de lecture
CREATE POLICY "Users can view their read receipts"
  ON message_read_receipts FOR SELECT
  USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM unified_messages um
      JOIN conversation_participants cp ON cp.conversation_id = um.conversation_id
      JOIN profiles p ON p.id = cp.profile_id
      WHERE um.id = message_read_receipts.message_id
        AND p.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- Read receipts: insérer ses confirmations de lecture
CREATE POLICY "Users can insert read receipts"
  ON message_read_receipts FOR INSERT
  WITH CHECK (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- =====================================================
-- REALTIME: Activer les notifications en temps réel
-- =====================================================
DO $$
BEGIN
  -- Vérifier si les tables sont déjà dans la publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'unified_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE unified_messages;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'unified_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE unified_conversations;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
  END IF;
END $$;

-- =====================================================
-- COMMENTAIRES
-- =====================================================
COMMENT ON TABLE unified_conversations IS 'Conversations unifiées supportant tous les types de communication entre rôles';
COMMENT ON TABLE conversation_participants IS 'Participants des conversations avec leurs permissions et compteurs';
COMMENT ON TABLE unified_messages IS 'Messages des conversations unifiées';
COMMENT ON TABLE message_read_receipts IS 'Confirmations de lecture des messages';
COMMENT ON FUNCTION mark_conversation_as_read IS 'Marque tous les messages d''une conversation comme lus pour un participant';
COMMENT ON FUNCTION get_or_create_conversation IS 'Récupère ou crée une conversation entre plusieurs participants';
COMMENT ON FUNCTION get_total_unread_count IS 'Retourne le nombre total de messages non lus pour un profil';

