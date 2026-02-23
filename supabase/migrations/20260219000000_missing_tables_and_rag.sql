-- =====================================================
-- MIGRATION: Tables et fonctions manquantes
-- Date: 2026-02-19
-- Version: 20260219000000
--
-- Contenu:
--   1. tenant_rewards + colonne total_points sur tenant_profiles
--   2. invoice_reminders
--   3. webhook_logs
--   4. ai_conversations
--   5. Extension pgvector + tables RAG (legal_embeddings,
--      platform_knowledge, user_context_embeddings)
--   6. Fonctions RPC RAG (match_legal_documents,
--      hybrid_search_legal, match_platform_knowledge,
--      match_user_context)
--   7. RLS sur toutes les nouvelles tables
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TENANT REWARDS
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points NUMERIC(10,2) NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'rent_paid_on_time',
    'energy_saving',
    'profile_completed',
    'document_uploaded',
    'on_time_streak',
    'referral'
  )),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_rewards_profile
  ON tenant_rewards(profile_id, created_at DESC);

ALTER TABLE tenant_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_rewards_select_own" ON tenant_rewards;
CREATE POLICY "tenant_rewards_select_own" ON tenant_rewards
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tenant_rewards_insert_own" ON tenant_rewards;
CREATE POLICY "tenant_rewards_insert_own" ON tenant_rewards
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tenant_rewards_admin" ON tenant_rewards;
CREATE POLICY "tenant_rewards_admin" ON tenant_rewards
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- Colonne total_points sur tenant_profiles
ALTER TABLE tenant_profiles
  ADD COLUMN IF NOT EXISTS total_points NUMERIC(10,2) DEFAULT 0;

-- Trigger pour mettre a jour total_points automatiquement
CREATE OR REPLACE FUNCTION update_tenant_total_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tenant_profiles
  SET total_points = COALESCE(total_points, 0) + NEW.points
  WHERE profile_id = NEW.profile_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_tenant_total_points ON tenant_rewards;
CREATE TRIGGER trg_update_tenant_total_points
  AFTER INSERT ON tenant_rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_total_points();

-- =====================================================
-- 2. INVOICE REMINDERS
-- =====================================================

CREATE TABLE IF NOT EXISTS invoice_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT DEFAULT 'email' CHECK (method IN ('email', 'sms', 'courrier')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  recipient_email TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice
  ON invoice_reminders(invoice_id, created_at DESC);

ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_reminders_select_owner" ON invoice_reminders;
CREATE POLICY "invoice_reminders_select_owner" ON invoice_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_reminders.invoice_id
        AND i.owner_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "invoice_reminders_insert_owner" ON invoice_reminders;
CREATE POLICY "invoice_reminders_insert_owner" ON invoice_reminders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_id
        AND i.owner_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "invoice_reminders_admin" ON invoice_reminders;
CREATE POLICY "invoice_reminders_admin" ON invoice_reminders
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- =====================================================
-- 3. WEBHOOK LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'stripe',
  event_type TEXT NOT NULL,
  event_id TEXT,
  payload JSONB,
  error TEXT,
  processed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider_date
  ON webhook_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id
  ON webhook_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status
  ON webhook_logs(status) WHERE status = 'error';

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Seuls les admins et le service_role lisent les webhook logs
DROP POLICY IF EXISTS "webhook_logs_admin" ON webhook_logs;
CREATE POLICY "webhook_logs_admin" ON webhook_logs
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- Permettre l'insertion depuis les API routes (service_role)
DROP POLICY IF EXISTS "webhook_logs_service_insert" ON webhook_logs;
CREATE POLICY "webhook_logs_service_insert" ON webhook_logs
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- 4. AI CONVERSATIONS (analytics)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_query TEXT NOT NULL,
  assistant_response TEXT,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  model_used TEXT,
  rag_docs_retrieved INTEGER DEFAULT 0,
  rag_sources JSONB DEFAULT '[]',
  thread_id UUID REFERENCES assistant_threads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_profile
  ON ai_conversations(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_model
  ON ai_conversations(model_used, created_at DESC);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations_select_own" ON ai_conversations;
CREATE POLICY "ai_conversations_select_own" ON ai_conversations
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_conversations_insert_own" ON ai_conversations;
CREATE POLICY "ai_conversations_insert_own" ON ai_conversations
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_conversations_admin" ON ai_conversations;
CREATE POLICY "ai_conversations_admin" ON ai_conversations
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- =====================================================
-- 5. EXTENSION PGVECTOR + TABLES RAG
-- =====================================================

-- Tenter d'installer pgvector. Si indisponible, on skip toute la section RAG.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Extension vector non disponible: %. Section RAG ignorée.', SQLERRM;
END $$;

-- Si pgvector est disponible, créer les tables RAG avec colonnes vector
-- Sinon, créer les tables sans colonnes vector (fallback JSONB)
DO $$
DECLARE
  v_has_vector BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') INTO v_has_vector;

  IF v_has_vector THEN
    RAISE NOTICE 'pgvector détecté, création des tables RAG avec vector(1536)';

    EXECUTE 'CREATE TABLE IF NOT EXISTS legal_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      source_title TEXT,
      source_url TEXT,
      source_date DATE,
      article_reference TEXT,
      metadata JSONB DEFAULT ''{}'',
      embedding vector(1536),
      tsv tsvector GENERATED ALWAYS AS (
        to_tsvector(''french'', coalesce(content, '''') || '' '' || coalesce(source_title, ''''))
      ) STORED,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS platform_knowledge (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      knowledge_type TEXT NOT NULL,
      target_roles TEXT[] DEFAULT ''{owner,tenant,provider}'',
      slug TEXT UNIQUE,
      priority INTEGER DEFAULT 0,
      metadata JSONB DEFAULT ''{}'',
      embedding vector(1536),
      is_published BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS user_context_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      embedding vector(1536),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(entity_type, entity_id)
    )';

  ELSE
    RAISE NOTICE 'pgvector absent, création des tables RAG sans vector (fallback JSONB)';

    EXECUTE 'CREATE TABLE IF NOT EXISTS legal_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      source_title TEXT,
      source_url TEXT,
      source_date DATE,
      article_reference TEXT,
      metadata JSONB DEFAULT ''{}'',
      embedding JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS platform_knowledge (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      knowledge_type TEXT NOT NULL,
      target_roles TEXT[] DEFAULT ''{owner,tenant,provider}'',
      slug TEXT UNIQUE,
      priority INTEGER DEFAULT 0,
      metadata JSONB DEFAULT ''{}'',
      embedding JSONB,
      is_published BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS user_context_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      embedding JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(entity_type, entity_id)
    )';
  END IF;
END $$;

-- Index standards (non-vector)
CREATE INDEX IF NOT EXISTS idx_legal_embeddings_category ON legal_embeddings(category);
CREATE INDEX IF NOT EXISTS idx_platform_knowledge_type ON platform_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_platform_knowledge_slug ON platform_knowledge(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_context_profile ON user_context_embeddings(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_context_entity ON user_context_embeddings(entity_type, entity_id);

-- Index vector uniquement si pgvector est disponible
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_legal_embeddings_vector ON legal_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_platform_knowledge_vector ON platform_knowledge USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_context_vector ON user_context_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip vector indexes: %', SQLERRM;
    END;
  END IF;
END $$;

-- RLS
ALTER TABLE legal_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_embeddings_select_authenticated" ON legal_embeddings;
CREATE POLICY "legal_embeddings_select_authenticated" ON legal_embeddings
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "legal_embeddings_admin_manage" ON legal_embeddings;
CREATE POLICY "legal_embeddings_admin_manage" ON legal_embeddings
  FOR ALL USING (public.user_role() = 'admin');

DROP POLICY IF EXISTS "platform_knowledge_select_authenticated" ON platform_knowledge;
CREATE POLICY "platform_knowledge_select_authenticated" ON platform_knowledge
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_published = true);
DROP POLICY IF EXISTS "platform_knowledge_admin_manage" ON platform_knowledge;
CREATE POLICY "platform_knowledge_admin_manage" ON platform_knowledge
  FOR ALL USING (public.user_role() = 'admin');

DROP POLICY IF EXISTS "user_context_select_own" ON user_context_embeddings;
CREATE POLICY "user_context_select_own" ON user_context_embeddings
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "user_context_manage_own" ON user_context_embeddings;
CREATE POLICY "user_context_manage_own" ON user_context_embeddings
  FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "user_context_admin" ON user_context_embeddings;
CREATE POLICY "user_context_admin" ON user_context_embeddings
  FOR ALL USING (public.user_role() = 'admin');

-- Fonctions RAG (uniquement si pgvector)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION match_legal_documents(
        query_embedding vector(1536), match_count INTEGER DEFAULT 5,
        filter_category TEXT DEFAULT NULL, min_similarity FLOAT DEFAULT 0.7
      ) RETURNS TABLE (id UUID, content TEXT, category TEXT, source_title TEXT, article_reference TEXT, metadata JSONB, similarity FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      BEGIN RETURN QUERY SELECT le.id, le.content, le.category, le.source_title, le.article_reference, le.metadata, 1 - (le.embedding <=> query_embedding) AS similarity FROM legal_embeddings le WHERE (filter_category IS NULL OR le.category = filter_category) AND 1 - (le.embedding <=> query_embedding) >= min_similarity ORDER BY le.embedding <=> query_embedding LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION hybrid_search_legal(
        query_text TEXT, query_embedding vector(1536), match_count INTEGER DEFAULT 5,
        filter_category TEXT DEFAULT NULL, vector_weight FLOAT DEFAULT 0.7
      ) RETURNS TABLE (id UUID, content TEXT, category TEXT, source_title TEXT, article_reference TEXT, combined_score FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      DECLARE text_weight FLOAT := 1.0 - vector_weight;
      BEGIN RETURN QUERY SELECT le.id, le.content, le.category, le.source_title, le.article_reference, (vector_weight * (1 - (le.embedding <=> query_embedding)) + text_weight * COALESCE(ts_rank_cd(le.tsv, plainto_tsquery('french', query_text)), 0)) AS combined_score FROM legal_embeddings le WHERE (filter_category IS NULL OR le.category = filter_category) AND (1 - (le.embedding <=> query_embedding) >= 0.5 OR le.tsv @@ plainto_tsquery('french', query_text)) ORDER BY combined_score DESC LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION match_platform_knowledge(
        query_embedding vector(1536), match_count INTEGER DEFAULT 5,
        filter_type TEXT DEFAULT NULL, filter_role TEXT DEFAULT NULL
      ) RETURNS TABLE (id UUID, title TEXT, content TEXT, knowledge_type TEXT, similarity FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      BEGIN RETURN QUERY SELECT pk.id, pk.title, pk.content, pk.knowledge_type, 1 - (pk.embedding <=> query_embedding) AS similarity FROM platform_knowledge pk WHERE pk.is_published = true AND (filter_type IS NULL OR pk.knowledge_type = filter_type) AND (filter_role IS NULL OR filter_role = ANY(pk.target_roles)) AND 1 - (pk.embedding <=> query_embedding) >= 0.5 ORDER BY pk.embedding <=> query_embedding LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION match_user_context(
        query_embedding vector(1536), p_profile_id UUID,
        match_count INTEGER DEFAULT 5, filter_entity_type TEXT DEFAULT NULL
      ) RETURNS TABLE (id UUID, entity_type TEXT, entity_id UUID, content TEXT, summary TEXT, similarity FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      BEGIN RETURN QUERY SELECT uce.id, uce.entity_type, uce.entity_id, uce.content, uce.summary, 1 - (uce.embedding <=> query_embedding) AS similarity FROM user_context_embeddings uce WHERE uce.profile_id = p_profile_id AND (filter_entity_type IS NULL OR uce.entity_type = filter_entity_type) AND 1 - (uce.embedding <=> query_embedding) >= 0.5 ORDER BY uce.embedding <=> query_embedding LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE 'GRANT EXECUTE ON FUNCTION match_legal_documents TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION hybrid_search_legal TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION match_platform_knowledge TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION match_user_context TO authenticated';
  ELSE
    RAISE NOTICE 'pgvector absent: fonctions RAG non créées.';
  END IF;
END $$;

-- =====================================================
-- 7. GRANTS (tables non-vector)
-- =====================================================

GRANT SELECT, INSERT ON tenant_rewards TO authenticated;
GRANT SELECT, INSERT ON invoice_reminders TO authenticated;
GRANT INSERT ON webhook_logs TO authenticated;
GRANT SELECT ON webhook_logs TO authenticated;
GRANT SELECT, INSERT ON ai_conversations TO authenticated;
GRANT SELECT ON legal_embeddings TO authenticated;
GRANT SELECT ON platform_knowledge TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_context_embeddings TO authenticated;

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON TABLE tenant_rewards IS 'Points de fidelite et recompenses locataires';
COMMENT ON TABLE invoice_reminders IS 'Historique des relances de factures envoyees';
COMMENT ON TABLE webhook_logs IS 'Logs des webhooks recus (Stripe, etc.)';
COMMENT ON TABLE ai_conversations IS 'Historique analytique des conversations avec l''assistant IA';
COMMENT ON TABLE legal_embeddings IS 'Embeddings vectoriels des documents juridiques pour RAG';
COMMENT ON TABLE platform_knowledge IS 'Base de connaissances plateforme avec embeddings pour RAG';
COMMENT ON TABLE user_context_embeddings IS 'Embeddings du contexte utilisateur pour recherche personnalisee RAG';

COMMIT;
