-- Migration pour LangGraph Checkpoints (PostgresSaver)
-- SOTA 2026 - Architecture Multi-Agent avec persistance durable
-- 
-- Cette table stocke les checkpoints LangGraph pour la persistance
-- des états d'exécution des agents multi-agent

-- Table principale pour les checkpoints LangGraph
CREATE TABLE IF NOT EXISTS langgraph_checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  parent_id TEXT,
  checkpoint JSONB NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (thread_id, checkpoint_id)
);

-- Index pour les recherches par thread_id (requête la plus fréquente)
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread 
  ON langgraph_checkpoints(thread_id);

-- Index pour les recherches par parent_id (pour time-travel)
CREATE INDEX IF NOT EXISTS idx_checkpoints_parent 
  ON langgraph_checkpoints(parent_id) 
  WHERE parent_id IS NOT NULL;

-- Index pour les recherches par date (nettoyage des anciens checkpoints)
CREATE INDEX IF NOT EXISTS idx_checkpoints_created_at 
  ON langgraph_checkpoints(created_at);

-- Index GIN pour les recherches dans le JSONB checkpoint
CREATE INDEX IF NOT EXISTS idx_checkpoints_checkpoint_gin 
  ON langgraph_checkpoints USING GIN (checkpoint);

-- Index GIN pour les recherches dans le JSONB metadata
CREATE INDEX IF NOT EXISTS idx_checkpoints_metadata_gin 
  ON langgraph_checkpoints USING GIN (metadata);

-- Fonction pour nettoyer les anciens checkpoints (optionnel, pour maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_checkpoints(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM langgraph_checkpoints
  WHERE created_at < now() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Commentaires pour documentation
COMMENT ON TABLE langgraph_checkpoints IS 
  'Stocke les checkpoints LangGraph pour la persistance des états d''exécution des agents multi-agent';

COMMENT ON COLUMN langgraph_checkpoints.thread_id IS 
  'Identifiant unique du thread de conversation';

COMMENT ON COLUMN langgraph_checkpoints.checkpoint_id IS 
  'Identifiant unique du checkpoint (généré par LangGraph)';

COMMENT ON COLUMN langgraph_checkpoints.parent_id IS 
  'Checkpoint parent (pour time-travel et debugging)';

COMMENT ON COLUMN langgraph_checkpoints.checkpoint IS 
  'État complet du checkpoint au format JSONB (messages, state, etc.)';

COMMENT ON COLUMN langgraph_checkpoints.metadata IS 
  'Métadonnées additionnelles (user_id, role, etc.)';

-- RLS (Row Level Security) - Optionnel selon vos besoins
-- Si vous voulez isoler les checkpoints par utilisateur :
-- ALTER TABLE langgraph_checkpoints ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY checkpoints_user_isolation ON langgraph_checkpoints
--   FOR ALL
--   USING (
--     (metadata->>'user_id')::text = current_setting('app.current_user_id', true)
--   );

