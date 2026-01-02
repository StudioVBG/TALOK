-- Migration: 20260101000000_ai_rag_embeddings.sql
-- SOTA 2026 - Architecture AI-First avec RAG
-- Active pgvector et crée les tables pour le RAG

-- ============================================
-- EXTENSION: pgvector pour les embeddings
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- TABLE: legal_embeddings
-- Stocke les documents juridiques vectorisés (Loi ALUR, décrets, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS legal_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimension
  
  -- Catégories juridiques
  category TEXT NOT NULL CHECK (category IN (
    'loi_alur',           -- Loi pour l'accès au logement et l'urbanisme rénové
    'decret_decence',     -- Décret décence du logement
    'bail_type',          -- Types de baux (nu, meublé, mobilité)
    'charges',            -- Régularisation des charges
    'depot_garantie',     -- Dépôt de garantie
    'conge',              -- Congés et préavis
    'travaux',            -- Travaux et réparations locatives
    'assurance',          -- Assurance habitation
    'fiscalite',          -- Fiscalité immobilière
    'copropriete',        -- Copropriété
    'edl',                -- État des lieux
    'indexation'          -- Indexation des loyers (IRL)
  )),
  
  -- Source du document
  source_title TEXT,
  source_url TEXT,
  source_date DATE,
  article_reference TEXT, -- Ex: "Article 22 de la loi du 6 juillet 1989"
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index HNSW pour recherche vectorielle rapide (cosine similarity)
CREATE INDEX IF NOT EXISTS legal_embeddings_embedding_idx 
ON legal_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index sur les catégories pour filtrage
CREATE INDEX IF NOT EXISTS legal_embeddings_category_idx 
ON legal_embeddings(category);

-- Index full-text pour recherche hybride
CREATE INDEX IF NOT EXISTS legal_embeddings_content_fts_idx 
ON legal_embeddings 
USING gin(to_tsvector('french', content));

-- ============================================
-- TABLE: platform_knowledge
-- Base de connaissances plateforme (FAQ, tutoriels, bonnes pratiques)
-- ============================================
CREATE TABLE IF NOT EXISTS platform_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(1536),
  
  -- Type de connaissance
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN (
    'faq',            -- Questions fréquentes
    'tutorial',       -- Tutoriels d'utilisation
    'best_practice',  -- Bonnes pratiques
    'template',       -- Modèles de documents
    'glossary',       -- Définitions et glossaire
    'workflow'        -- Processus et workflows
  )),
  
  -- Titre et slug pour référence
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  
  -- Pour qui (filtrage par rôle)
  target_roles TEXT[] DEFAULT ARRAY['owner', 'tenant', 'provider'],
  
  -- Priorité d'affichage
  priority INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_knowledge_embedding_idx 
ON platform_knowledge 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS platform_knowledge_type_idx 
ON platform_knowledge(knowledge_type);

CREATE INDEX IF NOT EXISTS platform_knowledge_roles_idx 
ON platform_knowledge USING gin(target_roles);

-- ============================================
-- TABLE: user_context_embeddings  
-- Contexte utilisateur vectorisé (baux, propriétés, tickets)
-- Permet une recherche sémantique personnalisée
-- ============================================
CREATE TABLE IF NOT EXISTS user_context_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Type et référence de l'entité
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'property',   -- Bien immobilier
    'lease',      -- Bail
    'tenant',     -- Locataire (pour les propriétaires)
    'invoice',    -- Facture
    'ticket',     -- Ticket de maintenance
    'document'    -- Document
  )),
  entity_id UUID NOT NULL,
  
  -- Contenu textuel résumé
  content TEXT NOT NULL,
  summary TEXT, -- Résumé court pour affichage
  
  -- Embedding
  embedding VECTOR(1536),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Une seule entrée par entité
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS user_context_embedding_idx 
ON user_context_embeddings 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS user_context_profile_idx 
ON user_context_embeddings(profile_id);

CREATE INDEX IF NOT EXISTS user_context_entity_type_idx 
ON user_context_embeddings(entity_type);

-- ============================================
-- TABLE: ai_conversations
-- Historique des conversations IA pour analytics
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES assistant_threads(id) ON DELETE SET NULL,
  
  -- Requête et réponse
  user_query TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  
  -- Métriques
  response_time_ms INT,
  tokens_used INT,
  model_used TEXT DEFAULT 'gpt-4o',
  
  -- RAG metrics
  rag_docs_retrieved INT DEFAULT 0,
  rag_sources JSONB DEFAULT '[]',
  
  -- Tools utilisés
  tools_called JSONB DEFAULT '[]',
  
  -- Feedback utilisateur
  feedback_rating INT CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_comment TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_conversations_profile_idx 
ON ai_conversations(profile_id);

CREATE INDEX IF NOT EXISTS ai_conversations_created_idx 
ON ai_conversations(created_at DESC);

-- ============================================
-- FUNCTION: match_legal_documents
-- Recherche sémantique dans les docs juridiques
-- ============================================
CREATE OR REPLACE FUNCTION match_legal_documents(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5,
  filter_category TEXT DEFAULT NULL,
  min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  category TEXT,
  source_title TEXT,
  article_reference TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    le.id,
    le.content,
    le.metadata,
    le.category,
    le.source_title,
    le.article_reference,
    1 - (le.embedding <=> query_embedding) as similarity
  FROM legal_embeddings le
  WHERE 
    le.embedding IS NOT NULL
    AND (filter_category IS NULL OR le.category = filter_category)
    AND 1 - (le.embedding <=> query_embedding) >= min_similarity
  ORDER BY le.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- FUNCTION: match_platform_knowledge
-- Recherche dans la base de connaissances
-- ============================================
CREATE OR REPLACE FUNCTION match_platform_knowledge(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5,
  filter_type TEXT DEFAULT NULL,
  filter_role TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  knowledge_type TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pk.id,
    pk.title,
    pk.content,
    pk.knowledge_type,
    1 - (pk.embedding <=> query_embedding) as similarity
  FROM platform_knowledge pk
  WHERE 
    pk.embedding IS NOT NULL
    AND (filter_type IS NULL OR pk.knowledge_type = filter_type)
    AND (filter_role IS NULL OR filter_role = ANY(pk.target_roles))
  ORDER BY pk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- FUNCTION: match_user_context
-- Recherche dans le contexte utilisateur
-- ============================================
CREATE OR REPLACE FUNCTION match_user_context(
  query_embedding VECTOR(1536),
  p_profile_id UUID,
  match_count INT DEFAULT 5,
  filter_entity_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  entity_id UUID,
  content TEXT,
  summary TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uce.id,
    uce.entity_type,
    uce.entity_id,
    uce.content,
    uce.summary,
    1 - (uce.embedding <=> query_embedding) as similarity
  FROM user_context_embeddings uce
  WHERE 
    uce.profile_id = p_profile_id
    AND uce.embedding IS NOT NULL
    AND (filter_entity_type IS NULL OR uce.entity_type = filter_entity_type)
  ORDER BY uce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- FUNCTION: hybrid_search_legal
-- Recherche hybride (vectorielle + full-text)
-- ============================================
CREATE OR REPLACE FUNCTION hybrid_search_legal(
  query_text TEXT,
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5,
  filter_category TEXT DEFAULT NULL,
  vector_weight FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  source_title TEXT,
  article_reference TEXT,
  vector_score FLOAT,
  text_score FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT 
      le.id,
      le.content,
      le.category,
      le.source_title,
      le.article_reference,
      1 - (le.embedding <=> query_embedding) as v_score
    FROM legal_embeddings le
    WHERE 
      le.embedding IS NOT NULL
      AND (filter_category IS NULL OR le.category = filter_category)
  ),
  text_results AS (
    SELECT 
      le.id,
      ts_rank(to_tsvector('french', le.content), plainto_tsquery('french', query_text)) as t_score
    FROM legal_embeddings le
    WHERE 
      to_tsvector('french', le.content) @@ plainto_tsquery('french', query_text)
      AND (filter_category IS NULL OR le.category = filter_category)
  )
  SELECT 
    vr.id,
    vr.content,
    vr.category,
    vr.source_title,
    vr.article_reference,
    vr.v_score as vector_score,
    COALESCE(tr.t_score, 0) as text_score,
    (vr.v_score * vector_weight + COALESCE(tr.t_score, 0) * (1 - vector_weight)) as combined_score
  FROM vector_results vr
  LEFT JOIN text_results tr ON vr.id = tr.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE legal_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Legal embeddings: lecture pour tous les authentifiés
CREATE POLICY "Legal embeddings readable by authenticated" 
ON legal_embeddings FOR SELECT 
TO authenticated 
USING (true);

-- Platform knowledge: lecture pour tous les authentifiés
CREATE POLICY "Platform knowledge readable by authenticated" 
ON platform_knowledge FOR SELECT 
TO authenticated 
USING (true);

-- User context: seulement pour le propriétaire du profil
CREATE POLICY "User context owned by profile" 
ON user_context_embeddings FOR ALL 
TO authenticated 
USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- AI conversations: seulement pour le propriétaire
CREATE POLICY "AI conversations owned by profile" 
ON ai_conversations FOR ALL 
TO authenticated 
USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================
-- TRIGGERS: Auto-update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER legal_embeddings_updated_at
BEFORE UPDATE ON legal_embeddings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER platform_knowledge_updated_at
BEFORE UPDATE ON platform_knowledge
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_context_updated_at
BEFORE UPDATE ON user_context_embeddings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE legal_embeddings IS 'Documents juridiques vectorisés pour RAG (Loi ALUR, décrets, etc.)';
COMMENT ON TABLE platform_knowledge IS 'Base de connaissances plateforme (FAQ, tutoriels, bonnes pratiques)';
COMMENT ON TABLE user_context_embeddings IS 'Contexte utilisateur vectorisé pour recherche personnalisée';
COMMENT ON TABLE ai_conversations IS 'Historique des conversations IA pour analytics et amélioration';
COMMENT ON FUNCTION match_legal_documents IS 'Recherche sémantique dans les documents juridiques';
COMMENT ON FUNCTION hybrid_search_legal IS 'Recherche hybride vectorielle + full-text dans les docs juridiques';

