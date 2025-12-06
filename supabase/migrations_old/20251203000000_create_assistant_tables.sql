-- ============================================
-- Migration: Tables pour l'Assistant IA
-- SOTA Décembre 2025 - GPT-5.1 + LangGraph
-- ============================================

-- ============================================
-- TABLE: assistant_threads
-- Stocke les conversations avec l'assistant
-- ============================================

CREATE TABLE IF NOT EXISTS assistant_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Nouvelle conversation',
  last_message TEXT,
  message_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour la performance
CREATE INDEX IF NOT EXISTS idx_assistant_threads_profile_id ON assistant_threads(profile_id);
CREATE INDEX IF NOT EXISTS idx_assistant_threads_user_id ON assistant_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_threads_updated_at ON assistant_threads(updated_at DESC);

-- ============================================
-- TABLE: assistant_messages
-- Stocke les messages des conversations
-- ============================================

CREATE TABLE IF NOT EXISTS assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES assistant_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tools_used TEXT[] DEFAULT '{}',
  tool_results JSONB,
  tokens_used INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour la performance
CREATE INDEX IF NOT EXISTS idx_assistant_messages_thread_id ON assistant_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_created_at ON assistant_messages(created_at);

-- ============================================
-- FUNCTION: increment_message_count
-- Incrémente le compteur de messages d'un thread
-- ============================================

CREATE OR REPLACE FUNCTION increment_message_count(thread_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE assistant_threads 
  SET message_count = message_count + 1
  WHERE id = thread_id_param
  RETURNING message_count INTO new_count;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: update_thread_updated_at
-- Met à jour updated_at quand un message est ajouté
-- ============================================

CREATE OR REPLACE FUNCTION update_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE assistant_threads 
  SET updated_at = NOW(),
      message_count = message_count + 1
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thread_on_message ON assistant_messages;
CREATE TRIGGER trigger_update_thread_on_message
AFTER INSERT ON assistant_messages
FOR EACH ROW
EXECUTE FUNCTION update_thread_timestamp();

-- ============================================
-- RLS: Row Level Security
-- ============================================

-- Enable RLS
ALTER TABLE assistant_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;

-- Policies pour assistant_threads
DROP POLICY IF EXISTS "Users can view their own threads" ON assistant_threads;
CREATE POLICY "Users can view their own threads"
  ON assistant_threads FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own threads" ON assistant_threads;
CREATE POLICY "Users can create their own threads"
  ON assistant_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own threads" ON assistant_threads;
CREATE POLICY "Users can update their own threads"
  ON assistant_threads FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own threads" ON assistant_threads;
CREATE POLICY "Users can delete their own threads"
  ON assistant_threads FOR DELETE
  USING (auth.uid() = user_id);

-- Policies pour assistant_messages
DROP POLICY IF EXISTS "Users can view messages in their threads" ON assistant_messages;
CREATE POLICY "Users can view messages in their threads"
  ON assistant_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assistant_threads 
      WHERE assistant_threads.id = assistant_messages.thread_id 
      AND assistant_threads.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create messages in their threads" ON assistant_messages;
CREATE POLICY "Users can create messages in their threads"
  ON assistant_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assistant_threads 
      WHERE assistant_threads.id = thread_id 
      AND assistant_threads.user_id = auth.uid()
    )
  );

-- ============================================
-- TABLE: assistant_usage_stats (optionnel)
-- Pour le suivi des coûts et de l'utilisation
-- ============================================

CREATE TABLE IF NOT EXISTS assistant_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_sent INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  tools_called INTEGER DEFAULT 0,
  estimated_cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_assistant_usage_stats_profile_date 
  ON assistant_usage_stats(profile_id, date);

-- Policy pour assistant_usage_stats
ALTER TABLE assistant_usage_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own stats" ON assistant_usage_stats;
CREATE POLICY "Users can view their own stats"
  ON assistant_usage_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = assistant_usage_stats.profile_id 
      AND profiles.user_id = auth.uid()
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE assistant_threads IS 'Conversations avec l''assistant IA LangGraph';
COMMENT ON TABLE assistant_messages IS 'Messages des conversations assistant';
COMMENT ON TABLE assistant_usage_stats IS 'Statistiques d''utilisation pour le suivi des coûts';

COMMENT ON COLUMN assistant_threads.metadata IS 'Données additionnelles (contexte, préférences)';
COMMENT ON COLUMN assistant_messages.tools_used IS 'Liste des tools appelés pendant la génération';
COMMENT ON COLUMN assistant_messages.tool_results IS 'Résultats des tools pour debugging';

