-- ==========================================================
-- Phase 4 — Modules : Accounting, Providers, Seasonal, Notifications, etc.
-- 37 migrations combinees
-- Genere le 2026-04-09
-- ==========================================================

BEGIN;

-- === MIGRATION: 20260209100000_create_sms_messages_table.sql ===
-- Migration: Create sms_messages table for Twilio SMS tracking (2026-02-09)
--
-- The application code (API routes) already references this table:
--   - POST /api/notifications/sms/send  → inserts SMS records
--   - POST /api/webhooks/twilio          → updates delivery status
-- But the table was never created in a migration.

-- ============================================================
-- 1. Create sms_messages table
-- ============================================================

CREATE TABLE IF NOT EXISTS sms_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  from_number   TEXT NOT NULL,
  to_number     TEXT NOT NULL,
  message       TEXT NOT NULL,
  segments      INT DEFAULT 1,
  twilio_sid    TEXT,
  twilio_status TEXT,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'sent', 'delivered', 'undelivered', 'failed')),
  error_code    TEXT,
  error_message TEXT,
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  sms_messages IS 'Journal des SMS envoyés via Twilio';
COMMENT ON COLUMN sms_messages.profile_id    IS 'Profil destinataire (nullable si envoi à un numéro libre)';
COMMENT ON COLUMN sms_messages.from_number   IS 'Numéro ou service Twilio expéditeur';
COMMENT ON COLUMN sms_messages.to_number     IS 'Numéro de téléphone du destinataire (format E.164)';
COMMENT ON COLUMN sms_messages.segments      IS 'Nombre de segments SMS (1 segment = 160 caractères)';
COMMENT ON COLUMN sms_messages.twilio_sid    IS 'SID du message Twilio (pour corrélation webhook)';
COMMENT ON COLUMN sms_messages.twilio_status IS 'Dernier statut brut renvoyé par Twilio';
COMMENT ON COLUMN sms_messages.status        IS 'Statut normalisé : queued, sent, delivered, undelivered, failed';

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Lookup by Twilio SID (webhook updates)
CREATE INDEX IF NOT EXISTS idx_sms_messages_twilio_sid
  ON sms_messages (twilio_sid)
  WHERE twilio_sid IS NOT NULL;

-- Lookup by profile
CREATE INDEX IF NOT EXISTS idx_sms_messages_profile_id
  ON sms_messages (profile_id)
  WHERE profile_id IS NOT NULL;

-- Recent messages
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at
  ON sms_messages (created_at DESC);

-- ============================================================
-- 3. Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_sms_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sms_messages_updated_at ON sms_messages;
CREATE TRIGGER trg_sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_messages_updated_at();

-- ============================================================
-- 4. Row Level Security
-- ============================================================

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Admins can see all SMS
CREATE POLICY sms_messages_admin_all ON sms_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Owners can see SMS they sent (via their profile)
CREATE POLICY sms_messages_owner_select ON sms_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'owner'
        AND p.id = sms_messages.profile_id
    )
  );

-- Service role inserts (API routes use service role client, bypasses RLS)
-- No explicit INSERT policy needed for service role, but add one for completeness
CREATE POLICY sms_messages_service_insert ON sms_messages
  FOR INSERT
  WITH CHECK (true);


-- === MIGRATION: 20260216500001_enforce_unique_constraints_safety.sql ===
-- REVIEW: Cette migration contient des DROP/DELETE dangereux. Verifier avant d'appliquer.
-- REVIEW: -- Migration: Enforce unique constraints safety net
-- REVIEW: -- Date: 2026-02-16
-- REVIEW: -- Description: S'assure que les contraintes uniques critiques sont bien appliquées.
-- REVIEW: --              Idempotent : ne fait rien si elles existent déjà.
-- REVIEW: --              Nettoie les doublons existants avant de créer les contraintes.
-- REVIEW: 
-- REVIEW: BEGIN;
-- REVIEW: 
-- REVIEW: -- =============================================
-- REVIEW: -- 1. INVOICES: unique (lease_id, periode)
-- REVIEW: -- =============================================
-- REVIEW: DO $$
-- REVIEW: BEGIN
-- REVIEW:   IF NOT EXISTS (
-- REVIEW:     SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_lease_periode'
-- REVIEW:   ) AND NOT EXISTS (
-- REVIEW:     SELECT 1 FROM pg_indexes WHERE indexname = 'uq_invoices_lease_periode'
-- REVIEW:   ) THEN
-- REVIEW:     -- Supprimer les doublons en gardant le plus récent
-- REVIEW:     DELETE FROM invoices
-- REVIEW:     WHERE id IN (
-- REVIEW:       SELECT id FROM (
-- REVIEW:         SELECT id,
-- REVIEW:                ROW_NUMBER() OVER (PARTITION BY lease_id, periode ORDER BY created_at DESC) AS rn
-- REVIEW:         FROM invoices
-- REVIEW:         WHERE lease_id IS NOT NULL AND periode IS NOT NULL
-- REVIEW:       ) sub
-- REVIEW:       WHERE sub.rn > 1
-- REVIEW:     );
-- REVIEW: 
-- REVIEW:     ALTER TABLE invoices
-- REVIEW:       ADD CONSTRAINT uq_invoices_lease_periode
-- REVIEW:       UNIQUE (lease_id, periode);
-- REVIEW: 
-- REVIEW:     RAISE NOTICE 'Created constraint uq_invoices_lease_periode on invoices';
-- REVIEW:   ELSE
-- REVIEW:     RAISE NOTICE 'Constraint uq_invoices_lease_periode already exists, skipping';
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- =============================================
-- REVIEW: -- 2. LEASE_SIGNERS: unique (lease_id, profile_id) WHERE profile_id IS NOT NULL
-- REVIEW: -- =============================================
-- REVIEW: DO $$
-- REVIEW: BEGIN
-- REVIEW:   IF NOT EXISTS (
-- REVIEW:     SELECT 1 FROM pg_indexes WHERE indexname = 'uq_lease_signers_lease_profile'
-- REVIEW:   ) THEN
-- REVIEW:     -- Supprimer les doublons en gardant celui qui a été signé (ou le plus récent)
-- REVIEW:     DELETE FROM lease_signers
-- REVIEW:     WHERE id IN (
-- REVIEW:       SELECT id FROM (
-- REVIEW:         SELECT id,
-- REVIEW:                ROW_NUMBER() OVER (
-- REVIEW:                  PARTITION BY lease_id, profile_id
-- REVIEW:                  ORDER BY
-- REVIEW:                    CASE WHEN signature_status = 'signed' THEN 0 ELSE 1 END,
-- REVIEW:                    created_at DESC
-- REVIEW:                ) AS rn
-- REVIEW:         FROM lease_signers
-- REVIEW:         WHERE profile_id IS NOT NULL
-- REVIEW:       ) sub
-- REVIEW:       WHERE sub.rn > 1
-- REVIEW:     );
-- REVIEW: 
-- REVIEW:     CREATE UNIQUE INDEX uq_lease_signers_lease_profile
-- REVIEW:       ON lease_signers (lease_id, profile_id)
-- REVIEW:       WHERE profile_id IS NOT NULL;
-- REVIEW: 
-- REVIEW:     RAISE NOTICE 'Created index uq_lease_signers_lease_profile on lease_signers';
-- REVIEW:   ELSE
-- REVIEW:     RAISE NOTICE 'Index uq_lease_signers_lease_profile already exists, skipping';
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- =============================================
-- REVIEW: -- 3. ROOMMATES: unique (lease_id, profile_id)
-- REVIEW: -- =============================================
-- REVIEW: DO $$
-- REVIEW: BEGIN
-- REVIEW:   IF NOT EXISTS (
-- REVIEW:     SELECT 1 FROM pg_indexes WHERE indexname = 'uq_roommates_lease_profile'
-- REVIEW:   ) THEN
-- REVIEW:     -- Vérifier si la table roommates existe
-- REVIEW:     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roommates') THEN
-- REVIEW:       -- Supprimer les doublons
-- REVIEW:       DELETE FROM roommates
-- REVIEW:       WHERE id IN (
-- REVIEW:         SELECT id FROM (
-- REVIEW:           SELECT id,
-- REVIEW:                  ROW_NUMBER() OVER (PARTITION BY lease_id, profile_id ORDER BY created_at DESC) AS rn
-- REVIEW:           FROM roommates
-- REVIEW:           WHERE lease_id IS NOT NULL AND profile_id IS NOT NULL
-- REVIEW:         ) sub
-- REVIEW:         WHERE sub.rn > 1
-- REVIEW:       );
-- REVIEW: 
-- REVIEW:       CREATE UNIQUE INDEX uq_roommates_lease_profile
-- REVIEW:         ON roommates (lease_id, profile_id);
-- REVIEW: 
-- REVIEW:       RAISE NOTICE 'Created index uq_roommates_lease_profile on roommates';
-- REVIEW:     ELSE
-- REVIEW:       RAISE NOTICE 'Table roommates does not exist, skipping';
-- REVIEW:     END IF;
-- REVIEW:   ELSE
-- REVIEW:     RAISE NOTICE 'Index uq_roommates_lease_profile already exists, skipping';
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- =============================================
-- REVIEW: -- 4. DOCUMENTS: Empêcher les doublons de fichiers (même storage_path)
-- REVIEW: -- =============================================
-- REVIEW: DO $$
-- REVIEW: BEGIN
-- REVIEW:   IF NOT EXISTS (
-- REVIEW:     SELECT 1 FROM pg_indexes WHERE indexname = 'uq_documents_storage_path'
-- REVIEW:   ) THEN
-- REVIEW:     -- Supprimer les doublons en gardant le plus récent
-- REVIEW:     DELETE FROM documents
-- REVIEW:     WHERE id IN (
-- REVIEW:       SELECT id FROM (
-- REVIEW:         SELECT id,
-- REVIEW:                ROW_NUMBER() OVER (PARTITION BY storage_path ORDER BY created_at DESC) AS rn
-- REVIEW:         FROM documents
-- REVIEW:         WHERE storage_path IS NOT NULL
-- REVIEW:       ) sub
-- REVIEW:       WHERE sub.rn > 1
-- REVIEW:     );
-- REVIEW: 
-- REVIEW:     CREATE UNIQUE INDEX uq_documents_storage_path
-- REVIEW:       ON documents (storage_path)
-- REVIEW:       WHERE storage_path IS NOT NULL;
-- REVIEW: 
-- REVIEW:     RAISE NOTICE 'Created index uq_documents_storage_path on documents';
-- REVIEW:   ELSE
-- REVIEW:     RAISE NOTICE 'Index uq_documents_storage_path already exists, skipping';
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: COMMIT;
-- REVIEW: 


-- === MIGRATION: 20260219000000_missing_tables_and_rag.sql ===
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


-- === MIGRATION: 20260221_fix_owner_data_chain.sql ===
-- ============================================
-- Migration: Correction de la chaîne de données compte propriétaire
-- Date: 2026-02-21
-- Description:
--   1. handle_new_user() crée aussi owner_profiles / tenant_profiles / provider_profiles
--   2. create_default_particulier_entity() crée une entité pour tous les types (pas seulement particulier)
--   3. Backfill des données existantes (owner_profiles, tenant_profiles, legal_entities)
--   4. Index unique sur lease_signers pour éviter doublons (lease_id, invited_email) quand profile_id IS NULL
-- Idempotent: peut être exécutée plusieurs fois sans effet secondaire.
-- ============================================

BEGIN;

-- ============================================
-- 1. Corriger handle_new_user() : créer les profils spécialisés
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
  v_profile_id UUID;
BEGIN
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le rôle
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Insérer le profil avec toutes les données
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  -- Récupérer le profile_id qui vient d'être créé ou mis à jour
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = NEW.id;

  -- Créer le profil spécialisé selon le rôle
  IF v_role = 'owner' AND v_profile_id IS NOT NULL THEN
    INSERT INTO public.owner_profiles (profile_id, type)
    VALUES (v_profile_id, 'particulier')
    ON CONFLICT (profile_id) DO NOTHING;
  ELSIF v_role = 'tenant' AND v_profile_id IS NOT NULL THEN
    INSERT INTO public.tenant_profiles (profile_id)
    VALUES (v_profile_id)
    ON CONFLICT (profile_id) DO NOTHING;
  ELSIF v_role = 'provider' AND v_profile_id IS NOT NULL THEN
    INSERT INTO public.provider_profiles (profile_id, type_services)
    VALUES (v_profile_id, '{}')
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Crée automatiquement un profil et le profil spécialisé (owner_profiles, tenant_profiles, etc.) lors de la création d''un utilisateur.';

-- ============================================
-- 2. Corriger create_default_particulier_entity() : créer entité pour tous les types
-- ============================================

CREATE OR REPLACE FUNCTION create_default_particulier_entity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO legal_entities (owner_profile_id, entity_type, nom, regime_fiscal, is_active)
  SELECT
    NEW.profile_id,
    CASE WHEN NEW.type = 'societe' THEN 'sci_ir' ELSE 'particulier' END,
    COALESCE(
      (SELECT CONCAT(p.prenom, ' ', p.nom) FROM profiles p WHERE p.id = NEW.profile_id),
      'Patrimoine personnel'
    ),
    'ir',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM legal_entities WHERE owner_profile_id = NEW.profile_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Backfill : réparer les données existantes
-- ============================================

-- Créer owner_profiles manquants
INSERT INTO owner_profiles (profile_id, type)
SELECT id, 'particulier'
FROM profiles
WHERE role = 'owner'
  AND NOT EXISTS (SELECT 1 FROM owner_profiles WHERE profile_id = profiles.id);

-- Créer tenant_profiles manquants
INSERT INTO tenant_profiles (profile_id)
SELECT id FROM profiles
WHERE role = 'tenant'
  AND NOT EXISTS (SELECT 1 FROM tenant_profiles WHERE profile_id = profiles.id);

-- Créer provider_profiles manquants
INSERT INTO provider_profiles (profile_id, type_services)
SELECT id, '{}' FROM profiles
WHERE role = 'provider'
  AND NOT EXISTS (SELECT 1 FROM provider_profiles WHERE profile_id = profiles.id);

-- Créer legal_entities manquantes pour les propriétaires
INSERT INTO legal_entities (owner_profile_id, entity_type, nom, regime_fiscal, is_active)
SELECT op.profile_id, 'particulier',
  COALESCE(CONCAT(p.prenom, ' ', p.nom), 'Patrimoine personnel'), 'ir', true
FROM owner_profiles op
JOIN profiles p ON op.profile_id = p.id
WHERE NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.owner_profile_id = op.profile_id);

-- Lier les propriétés orphelines à l'entité par défaut du propriétaire
UPDATE properties p
SET legal_entity_id = (
  SELECT le.id FROM legal_entities le
  WHERE le.owner_profile_id = p.owner_id
  ORDER BY le.created_at ASC
  LIMIT 1
)
WHERE p.legal_entity_id IS NULL
  AND EXISTS (SELECT 1 FROM legal_entities le WHERE le.owner_profile_id = p.owner_id);

-- ============================================
-- 4. Index unique pour éviter doublons de signataires (invited_email sans profile_id)
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_lease_signer_email
  ON lease_signers (lease_id, invited_email)
  WHERE profile_id IS NULL AND invited_email IS NOT NULL;

COMMIT;


-- === MIGRATION: 20260223200000_fix_all_missing_tables_and_columns.sql ===
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


-- === MIGRATION: 20260224100000_normalize_provider_names.sql ===
-- Normalise les noms des providers pour correspondre au code (Twilio, Stripe, etc.)
-- Le code credentials-service.ts cherche des noms capitalisés.

UPDATE api_providers SET name = 'Twilio' WHERE lower(name) = 'twilio';
UPDATE api_providers SET name = 'Stripe' WHERE lower(name) = 'stripe';
UPDATE api_providers SET name = 'GoCardless' WHERE lower(name) = 'gocardless';
UPDATE api_providers SET name = 'Mindee' WHERE lower(name) = 'mindee';


-- === MIGRATION: 20260226000000_fix_notifications_triggers.sql ===
-- =====================================================
-- MIGRATION: Fix notifications body NOT NULL + trigger document center
-- Date: 2026-02-26
--
-- BUG 1: trg_notify_tenant_document_center faisait INSERT direct sans body/user_id
--        -> échec de l'INSERT document. On utilise create_notification() à la place.
-- BUG 2: create_notification() n'insérait pas body (NOT NULL) -> échec silencieux.
-- =====================================================

BEGIN;

-- Filet de sécurité : body peut avoir une valeur par défaut si jamais oublié
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'body') THEN
    ALTER TABLE notifications ALTER COLUMN body SET DEFAULT '';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fix_notifications] body default: %', SQLERRM;
END $$;

-- Recréer create_notification() en insérant body = p_message (requis NOT NULL)
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_user_id UUID;
  v_is_profile BOOLEAN := false;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE id = p_recipient_id
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    v_is_profile := true;
  ELSE
    v_user_id := p_recipient_id;
  END IF;

  IF v_is_profile THEN
    INSERT INTO notifications (
      user_id,
      profile_id,
      type,
      title,
      body,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_recipient_id,
      p_type,
      p_title,
      COALESCE(NULLIF(TRIM(p_message), ''), '(sans contenu)'),
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  ELSE
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_type,
      p_title,
      COALESCE(NULLIF(TRIM(p_message), ''), '(sans contenu)'),
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN v_notification_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_notification] Erreur: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) IS
'Crée une notification. body et message remplis avec p_message. p_recipient_id = profile_id ou user_id.';

-- Remplacer le trigger document center : utiliser create_notification() au lieu d'INSERT direct
CREATE OR REPLACE FUNCTION notify_tenant_document_center_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_label TEXT;
  v_notification_type TEXT;
  v_message TEXT;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_doc_label := CASE
    WHEN NEW.type IN ('bail', 'contrat', 'avenant') THEN 'Un nouveau bail'
    WHEN NEW.type = 'quittance' THEN 'Une nouvelle quittance'
    WHEN NEW.type IN ('EDL_entree', 'edl_entree') THEN 'Un état des lieux d''entrée'
    WHEN NEW.type IN ('EDL_sortie', 'edl_sortie') THEN 'Un état des lieux de sortie'
    WHEN NEW.type IN ('attestation_assurance') THEN 'Votre attestation d''assurance'
    WHEN NEW.type IN ('dpe', 'erp', 'crep') THEN 'Un diagnostic technique'
    ELSE 'Un document'
  END;

  v_notification_type := CASE
    WHEN NEW.type IN ('bail', 'contrat', 'avenant') THEN 'document_lease_added'
    WHEN NEW.type = 'quittance' THEN 'document_receipt_added'
    WHEN NEW.type LIKE 'EDL%' OR NEW.type LIKE 'edl%' THEN 'document_edl_added'
    ELSE 'document_added'
  END;

  v_message := v_doc_label || ' est disponible dans votre espace documents.';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    PERFORM create_notification(
      NEW.tenant_id,
      v_notification_type,
      v_doc_label || ' a été ajouté',
      v_message,
      '/tenant/documents',
      NEW.id,
      'document'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_tenant_document_center_update] Non-blocking: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tenant_document_center ON documents;
CREATE TRIGGER trg_notify_tenant_document_center
  AFTER INSERT ON documents
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NOT NULL)
  EXECUTE FUNCTION notify_tenant_document_center_update();

COMMIT;


-- === MIGRATION: 20260230100000_create_notification_resolve_profile_id.sql ===
-- =====================================================
-- MIGRATION: create_notification — résolution profile_id → user_id
-- Date: 2026-02-30
--
-- OBJECTIF:
--   p_recipient_id peut être un profile_id (ex: triggers tenant) ou un user_id
--   (ex: triggers owner). Si c'est un profile_id, on résout user_id et on
--   insère les deux pour que la RLS (user_id = auth.uid()) et les vues
--   par profile_id fonctionnent.
-- =====================================================

DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_user_id UUID;
  v_is_profile BOOLEAN := false;
BEGIN
  -- Si p_recipient_id correspond à un profil, récupérer le user_id
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE id = p_recipient_id
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    v_is_profile := true;
  ELSE
    -- Rétrocompat : considérer p_recipient_id comme user_id
    v_user_id := p_recipient_id;
  END IF;

  -- Insérer avec user_id (obligatoire pour RLS) et optionnellement profile_id
  IF v_is_profile THEN
    INSERT INTO notifications (
      user_id,
      profile_id,
      type,
      title,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_recipient_id,
      p_type,
      p_title,
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  ELSE
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_type,
      p_title,
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN v_notification_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_notification] Erreur: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) IS
'Crée une notification. p_recipient_id peut être un profile_id (résolution user_id) ou un user_id (rétrocompat).';


-- === MIGRATION: 20260304100000_activate_pg_cron_schedules.sql ===
-- ============================================
-- Migration : Activer pg_cron + pg_net et planifier tous les crons
-- Date : 2026-03-04
-- Description : Configure le scheduling automatique des API routes cron
--   via Supabase pg_cron + pg_net. Zéro service externe requis.
--
-- Prérequis (à configurer dans le dashboard Supabase > SQL Editor) :
--   ALTER DATABASE postgres SET app.settings.app_url = 'https://votre-site.netlify.app';
--   ALTER DATABASE postgres SET app.settings.cron_secret = 'votre-cron-secret';
-- ============================================

-- Activer les extensions (déjà disponibles sur Supabase Pro)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Supprimer les anciens jobs s'ils existent (idempotent)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'payment-reminders',
  'generate-monthly-invoices',
  'generate-invoices',
  'process-webhooks',
  'lease-expiry-alerts',
  'check-cni-expiry',
  'irl-indexation',
  'visit-reminders',
  'cleanup-exports',
  'cleanup-webhooks',
  'subscription-alerts',
  'notifications'
);

-- ===== CRONS CRITIQUES =====

-- Relances de paiement : quotidien à 8h UTC
SELECT cron.schedule('payment-reminders', '0 8 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/payment-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Génération factures mensuelles (route API) : 1er du mois à 6h
SELECT cron.schedule('generate-monthly-invoices', '0 6 1 * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/generate-monthly-invoices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Génération factures (RPC SQL) : 1er du mois à 6h30
SELECT cron.schedule('generate-invoices', '30 6 1 * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/generate-invoices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Process webhooks : toutes les 5 min
SELECT cron.schedule('process-webhooks', '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/process-webhooks',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ===== CRONS SECONDAIRES =====

-- Alertes fin de bail : lundi 8h
SELECT cron.schedule('lease-expiry-alerts', '0 8 * * 1',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/lease-expiry-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Vérif CNI expirées : quotidien 10h
SELECT cron.schedule('check-cni-expiry', '0 10 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/check-cni-expiry',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Alertes abonnements : quotidien 10h
SELECT cron.schedule('subscription-alerts', '0 10 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/subscription-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Indexation IRL : 1er du mois 7h
SELECT cron.schedule('irl-indexation', '0 7 1 * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/irl-indexation',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Rappels de visites : toutes les 30 min
SELECT cron.schedule('visit-reminders', '*/30 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/visit-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ===== NETTOYAGE =====

-- Nettoyage exports expirés : quotidien 3h
SELECT cron.schedule('cleanup-exports', '0 3 * * *',
  $$SELECT cleanup_expired_exports()$$
);

-- Nettoyage webhooks anciens : quotidien 4h
SELECT cron.schedule('cleanup-webhooks', '0 4 * * *',
  $$SELECT cleanup_old_webhooks()$$
);

COMMENT ON EXTENSION pg_cron IS 'Scheduling automatique des crons via Supabase pg_cron + pg_net';


-- === MIGRATION: 20260305100001_add_missing_notification_triggers.sql ===
-- =====================================================
-- Ajout des triggers de notification manquants
-- Identifiés lors de l'audit de propagation inter-comptes
-- =====================================================

-- =====================================================
-- TRIGGER 1: Notifier le propriétaire quand un ticket est créé
-- par un locataire sur l'un de ses biens
-- =====================================================
CREATE OR REPLACE FUNCTION notify_owner_on_ticket_created()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_address TEXT;
BEGIN
  -- Récupérer le propriétaire et l'adresse du bien
  SELECT p.owner_id, COALESCE(p.adresse_complete, 'Logement')
  INTO v_owner_id, v_property_address
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Si pas de propriétaire trouvé, on sort
  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Créer la notification pour le propriétaire
  INSERT INTO notifications (
    profile_id,
    type,
    title,
    message,
    link,
    metadata
  ) VALUES (
    v_owner_id,
    'ticket',
    'Nouveau signalement',
    'Un signalement a été créé pour ' || v_property_address || ' : ' || COALESCE(NEW.title, NEW.titre, 'Sans titre'),
    '/owner/tickets/' || NEW.id,
    jsonb_build_object(
      'ticket_id', NEW.id,
      'property_id', NEW.property_id,
      'priority', COALESCE(NEW.priority, NEW.priorite, 'normal')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger seulement s'il n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_owner_on_ticket_created'
  ) THEN
    CREATE TRIGGER trg_notify_owner_on_ticket_created
      AFTER INSERT ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION notify_owner_on_ticket_created();
  END IF;
END;
$$;

-- =====================================================
-- TRIGGER 2: Notifier le prestataire quand un ticket lui est assigné
-- (work order / intervention assignée)
-- =====================================================
CREATE OR REPLACE FUNCTION notify_provider_on_work_order()
RETURNS TRIGGER AS $$
DECLARE
  v_property_address TEXT;
BEGIN
  -- Seulement si un prestataire est assigné
  IF NEW.provider_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Seulement si l'assignation est nouvelle (INSERT ou UPDATE avec changement de provider)
  IF TG_OP = 'UPDATE' AND OLD.provider_id = NEW.provider_id THEN
    RETURN NEW;
  END IF;

  -- Récupérer l'adresse du bien
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Créer la notification pour le prestataire
  INSERT INTO notifications (
    profile_id,
    type,
    title,
    message,
    link,
    metadata
  ) VALUES (
    NEW.provider_id,
    'work_order',
    'Nouvelle intervention assignée',
    'Intervention sur ' || COALESCE(v_property_address, 'un bien') || ' : ' || COALESCE(NEW.title, NEW.titre, 'Sans titre'),
    '/provider/interventions/' || NEW.id,
    jsonb_build_object(
      'ticket_id', NEW.id,
      'property_id', NEW.property_id,
      'priority', COALESCE(NEW.priority, NEW.priorite, 'normal')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger seulement s'il n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_provider_on_work_order'
  ) THEN
    CREATE TRIGGER trg_notify_provider_on_work_order
      AFTER INSERT OR UPDATE OF provider_id ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION notify_provider_on_work_order();
  END IF;
END;
$$;


-- === MIGRATION: 20260309000002_add_ticket_to_conversations.sql ===
-- Migration: Add ticket_id to conversations table for ticket-chat integration

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_ticket_id ON conversations(ticket_id);


-- === MIGRATION: 20260321100000_fix_cron_post_refactoring_sota2026.sql ===
-- ============================================
-- Migration corrective : SOTA 2026 post-refactoring
-- Date : 2026-03-21
-- Description :
--   1. Supprime le job generate-monthly-invoices (route supprimee en P3)
--   2. Ajoute le job process-outbox pour le processeur outbox asynchrone
-- ============================================

-- 1. Supprimer le job pointant vers la route supprimee
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'generate-monthly-invoices';

-- 2. Ajouter le processeur outbox (toutes les 5 minutes)
SELECT cron.schedule('process-outbox', '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/process-outbox',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);


-- === MIGRATION: 20260326022619_fix_documents_bucket_mime.sql ===
-- Fix: Aligner les MIME types du bucket storage avec lib/documents/constants.ts
-- Bug: Word/Excel etaient acceptes par le code mais rejetes par le bucket

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
]::text[],
file_size_limit = 52428800  -- 50 Mo
WHERE id = 'documents';


-- === MIGRATION: 20260329180000_notify_owner_edl_signed.sql ===
-- Migration: Notification propriétaire quand un EDL est signé par les deux parties
-- Date: 2026-03-29
-- Description: Ajoute un trigger qui notifie le propriétaire lorsqu'un EDL passe en statut "signed"

-- ============================================================================
-- Fonction de notification EDL signé → propriétaire
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_owner_edl_signed()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_id UUID;
    v_property_address TEXT;
    v_edl_type TEXT;
    v_existing UUID;
BEGIN
    -- Seulement quand le statut passe à 'signed'
    IF NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') THEN

        -- Récupérer le type de l'EDL
        v_edl_type := COALESCE(NEW.type, 'entree');

        -- Récupérer le propriétaire et l'adresse via la propriété
        SELECT p.owner_id, p.adresse_complete
        INTO v_owner_id, v_property_address
        FROM properties p
        WHERE p.id = NEW.property_id;

        IF v_owner_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- Déduplication : vérifier si une notification similaire existe dans la dernière heure
        SELECT id INTO v_existing
        FROM notifications
        WHERE profile_id = v_owner_id
          AND type = 'edl_signed'
          AND related_id = NEW.id
          AND created_at > NOW() - INTERVAL '1 hour'
        LIMIT 1;

        IF v_existing IS NOT NULL THEN
            RETURN NEW;
        END IF;

        -- Créer la notification via la RPC
        PERFORM create_notification(
            v_owner_id,
            'edl_signed',
            CASE v_edl_type
                WHEN 'entree' THEN 'État des lieux d''entrée signé'
                WHEN 'sortie' THEN 'État des lieux de sortie signé'
                ELSE 'État des lieux signé'
            END,
            'L''état des lieux ' ||
            CASE v_edl_type
                WHEN 'entree' THEN 'd''entrée'
                WHEN 'sortie' THEN 'de sortie'
                ELSE ''
            END ||
            ' pour ' || COALESCE(v_property_address, 'votre bien') ||
            ' a été signé par toutes les parties.',
            '/owner/edl/' || NEW.id,
            NEW.id,
            'edl'
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Ne pas bloquer la transaction si la notification échoue
    RAISE WARNING '[notify_owner_edl_signed] Erreur: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger sur la table edl (UPDATE du statut)
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_notify_owner_edl_signed ON edl;
CREATE TRIGGER trigger_notify_owner_edl_signed
    AFTER UPDATE OF status ON edl
    FOR EACH ROW
    WHEN (NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed')
    EXECUTE FUNCTION public.notify_owner_edl_signed();


-- === MIGRATION: 20260406210000_accounting_complete.sql ===
-- =====================================================
-- MIGRATION: Module Comptabilite complet
-- Date: 2026-04-06
--
-- 15 tables, 16 index, RLS, triggers, fonctions SQL
-- Double-entry accounting, FEC, rapprochement bancaire,
-- plan comptable PCG + copro, amortissements, OCR, audit
-- =====================================================

-- =====================================================
-- 1. ACCOUNTING_EXERCISES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')),
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exercise_dates_valid CHECK (end_date > start_date),
  CONSTRAINT exercise_unique_period UNIQUE (entity_id, start_date, end_date)
);

CREATE INDEX idx_exercises_entity ON accounting_exercises(entity_id);
CREATE INDEX idx_exercises_status ON accounting_exercises(entity_id, status);

ALTER TABLE accounting_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises_entity_access" ON accounting_exercises
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 2. CHART_OF_ACCOUNTS
-- =====================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN (
    'asset', 'liability', 'equity', 'income', 'expense'
  )),
  plan_type TEXT NOT NULL DEFAULT 'pcg' CHECK (plan_type IN ('pcg', 'copro', 'custom')),
  account_class INTEGER GENERATED ALWAYS AS (
    CAST(LEFT(account_number, 1) AS INTEGER)
  ) STORED,
  is_active BOOLEAN NOT NULL DEFAULT true,
  parent_account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_number_entity_unique UNIQUE (entity_id, account_number)
);

CREATE INDEX idx_coa_entity ON chart_of_accounts(entity_id);
CREATE INDEX idx_coa_number ON chart_of_accounts(entity_id, account_number);
CREATE INDEX idx_coa_class ON chart_of_accounts(entity_id, account_class);

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coa_entity_access" ON chart_of_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 3. ACCOUNTING_JOURNALS
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code IN ('ACH', 'VE', 'BQ', 'OD', 'AN', 'CL')),
  label TEXT NOT NULL,
  journal_type TEXT NOT NULL CHECK (journal_type IN (
    'purchase', 'sales', 'bank', 'miscellaneous', 'opening', 'closing'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT journal_code_entity_unique UNIQUE (entity_id, code)
);

ALTER TABLE accounting_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journals_entity_access" ON accounting_journals
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 4. ACCOUNTING_ENTRIES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  journal_code TEXT NOT NULL,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  label TEXT NOT NULL,
  source TEXT,
  reference TEXT,
  is_validated BOOLEAN NOT NULL DEFAULT false,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  reversal_of UUID REFERENCES accounting_entries(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entry_number_unique UNIQUE (entity_id, exercise_id, entry_number)
);

CREATE INDEX idx_entries_exercise ON accounting_entries(exercise_id);
CREATE INDEX idx_entries_journal ON accounting_entries(entity_id, journal_code);
CREATE INDEX idx_entries_date ON accounting_entries(entity_id, entry_date);

ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries_entity_access" ON accounting_entries
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. ACCOUNTING_ENTRY_LINES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT,
  debit_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
  credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  lettrage TEXT,
  piece_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_side CHECK (
    (debit_cents > 0 AND credit_cents = 0) OR
    (debit_cents = 0 AND credit_cents > 0)
  )
);

CREATE INDEX idx_entry_lines_entry ON accounting_entry_lines(entry_id);
CREATE INDEX idx_entry_lines_account ON accounting_entry_lines(account_number);
CREATE INDEX idx_entry_lines_lettrage ON accounting_entry_lines(lettrage) WHERE lettrage IS NOT NULL;

ALTER TABLE accounting_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entry_lines_via_entry" ON accounting_entry_lines
  FOR ALL TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 6. BANK_CONNECTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('nordigen', 'bridge', 'manual')),
  provider_connection_id TEXT,
  bank_name TEXT,
  iban_hash TEXT NOT NULL,
  account_type TEXT DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'other')),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN (
    'pending', 'syncing', 'synced', 'error', 'expired'
  )),
  last_sync_at TIMESTAMPTZ,
  consent_expires_at TIMESTAMPTZ,
  error_message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iban_hash_unique UNIQUE (iban_hash)
);

CREATE INDEX idx_bank_conn_entity ON bank_connections(entity_id);

ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_conn_entity_access" ON bank_connections
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. BANK_TRANSACTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  provider_transaction_id TEXT,
  transaction_date DATE NOT NULL,
  value_date DATE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  label TEXT,
  raw_label TEXT,
  category TEXT,
  counterpart_name TEXT,
  counterpart_iban TEXT,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN (
    'pending', 'matched_auto', 'matched_manual', 'suggested', 'orphan', 'ignored'
  )),
  matched_entry_id UUID REFERENCES accounting_entries(id),
  match_score NUMERIC(5,2),
  suggestion JSONB,
  is_internal_transfer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_tx_connection ON bank_transactions(connection_id);
CREATE INDEX idx_bank_tx_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_tx_status ON bank_transactions(reconciliation_status);
CREATE INDEX idx_bank_tx_matched ON bank_transactions(matched_entry_id) WHERE matched_entry_id IS NOT NULL;

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_tx_via_connection" ON bank_transactions
  FOR ALL TO authenticated
  USING (
    connection_id IN (
      SELECT id FROM bank_connections
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    connection_id IN (
      SELECT id FROM bank_connections
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 8. DOCUMENT_ANALYSES (OCR + IA)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  extracted_data JSONB NOT NULL DEFAULT '{}',
  confidence_score NUMERIC(5,4),
  suggested_account TEXT,
  suggested_journal TEXT,
  document_type TEXT,
  siret_verified BOOLEAN DEFAULT false,
  tva_coherent BOOLEAN DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'completed', 'failed', 'validated', 'rejected'
  )),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_analyses_entity ON document_analyses(entity_id);
CREATE INDEX idx_doc_analyses_status ON document_analyses(processing_status);

ALTER TABLE document_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_analyses_entity_access" ON document_analyses
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 9. AMORTIZATION_SCHEDULES
-- =====================================================
CREATE TABLE IF NOT EXISTS amortization_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  property_id UUID,
  component TEXT NOT NULL,
  acquisition_date DATE NOT NULL,
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  terrain_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  depreciable_amount_cents INTEGER GENERATED ALWAYS AS (
    total_amount_cents - CAST(ROUND(total_amount_cents * terrain_percent / 100) AS INTEGER)
  ) STORED,
  duration_years INTEGER NOT NULL CHECK (duration_years > 0),
  amortization_method TEXT NOT NULL DEFAULT 'linear' CHECK (amortization_method IN ('linear', 'degressive')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amort_sched_entity ON amortization_schedules(entity_id);

ALTER TABLE amortization_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amort_sched_entity_access" ON amortization_schedules
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 10. AMORTIZATION_LINES
-- =====================================================
CREATE TABLE IF NOT EXISTS amortization_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES amortization_schedules(id) ON DELETE CASCADE,
  exercise_year INTEGER NOT NULL,
  annual_amount_cents INTEGER NOT NULL CHECK (annual_amount_cents >= 0),
  cumulated_amount_cents INTEGER NOT NULL CHECK (cumulated_amount_cents >= 0),
  net_book_value_cents INTEGER NOT NULL CHECK (net_book_value_cents >= 0),
  is_prorata BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT amort_line_unique UNIQUE (schedule_id, exercise_year)
);

ALTER TABLE amortization_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amort_lines_via_schedule" ON amortization_lines
  FOR ALL TO authenticated
  USING (
    schedule_id IN (
      SELECT id FROM amortization_schedules
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    schedule_id IN (
      SELECT id FROM amortization_schedules
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 11. DEFICIT_TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS deficit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  deficit_type TEXT NOT NULL CHECK (deficit_type IN ('foncier', 'bic_meuble')),
  origin_year INTEGER NOT NULL,
  initial_amount_cents INTEGER NOT NULL CHECK (initial_amount_cents > 0),
  used_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (used_amount_cents >= 0),
  remaining_amount_cents INTEGER GENERATED ALWAYS AS (
    initial_amount_cents - used_amount_cents
  ) STORED,
  expires_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deficit_entity ON deficit_tracking(entity_id);

ALTER TABLE deficit_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deficit_entity_access" ON deficit_tracking
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 12. CHARGE_REGULARIZATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS charge_regularizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  lease_id UUID,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  provisions_paid_cents INTEGER NOT NULL DEFAULT 0,
  actual_recoverable_cents INTEGER NOT NULL DEFAULT 0,
  actual_non_recoverable_cents INTEGER NOT NULL DEFAULT 0,
  balance_cents INTEGER GENERATED ALWAYS AS (
    provisions_paid_cents - actual_recoverable_cents
  ) STORED,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'sent', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE charge_regularizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charge_reg_entity_access" ON charge_regularizations
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 13. EC_ACCESS + EC_ANNOTATIONS (Portail Expert-Comptable)
-- =====================================================
CREATE TABLE IF NOT EXISTS ec_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  ec_user_id UUID NOT NULL REFERENCES auth.users(id),
  ec_name TEXT NOT NULL,
  ec_email TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'annotate', 'validate')),
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ec_access_entity ON ec_access(entity_id);

ALTER TABLE ec_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ec_access_owner" ON ec_access
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
    OR ec_user_id = auth.uid()
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS ec_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES accounting_entries(id),
  ec_user_id UUID NOT NULL REFERENCES auth.users(id),
  annotation_type TEXT NOT NULL CHECK (annotation_type IN (
    'comment', 'question', 'correction', 'validation'
  )),
  content TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ec_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ec_annotations_access" ON ec_annotations
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
    OR ec_user_id = auth.uid()
  )
  WITH CHECK (
    ec_user_id = auth.uid()
  );

-- =====================================================
-- 14. COPRO_BUDGETS + COPRO_FUND_CALLS
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  budget_name TEXT NOT NULL,
  budget_lines JSONB NOT NULL DEFAULT '[]',
  total_budget_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'voted', 'executed')),
  voted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE copro_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copro_budgets_entity_access" ON copro_budgets
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS copro_fund_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES copro_budgets(id) ON DELETE CASCADE,
  copro_lot_id UUID,
  owner_name TEXT NOT NULL,
  tantiemes INTEGER NOT NULL CHECK (tantiemes > 0),
  total_tantiemes INTEGER NOT NULL CHECK (total_tantiemes > 0),
  call_amount_cents INTEGER NOT NULL CHECK (call_amount_cents > 0),
  call_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'partial', 'paid', 'overdue'
  )),
  paid_amount_cents INTEGER NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE copro_fund_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copro_fund_calls_entity_access" ON copro_fund_calls
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 15. MANDANT_ACCOUNTS + CRG_REPORTS
-- =====================================================
CREATE TABLE IF NOT EXISTS mandant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  mandant_name TEXT NOT NULL,
  mandant_user_id UUID REFERENCES auth.users(id),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mandant_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mandant_accounts_entity_access" ON mandant_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS crg_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  mandant_id UUID NOT NULL REFERENCES mandant_accounts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_income_cents INTEGER NOT NULL DEFAULT 0,
  total_expenses_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  net_owner_cents INTEGER NOT NULL DEFAULT 0,
  report_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'validated')),
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crg_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crg_reports_entity_access" ON crg_reports
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 16. ACCOUNTING_AUDIT_LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'api', 'ec')),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON accounting_audit_log(entity_id);
CREATE INDEX idx_audit_target ON accounting_audit_log(target_type, target_id);
CREATE INDEX idx_audit_date ON accounting_audit_log(created_at);

ALTER TABLE accounting_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_entity_access" ON accounting_audit_log
  FOR SELECT TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- Audit log is insert-only for the system, read-only for users
CREATE POLICY "audit_log_system_insert" ON accounting_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: Verify entry balance (sum debit = sum credit) before validation
CREATE OR REPLACE FUNCTION fn_check_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debit INTEGER;
  total_credit INTEGER;
BEGIN
  IF NEW.is_validated = true AND (OLD.is_validated IS DISTINCT FROM true) THEN
    SELECT COALESCE(SUM(debit_cents), 0), COALESCE(SUM(credit_cents), 0)
    INTO total_debit, total_credit
    FROM accounting_entry_lines
    WHERE entry_id = NEW.id;

    IF total_debit != total_credit THEN
      RAISE EXCEPTION 'Entry balance error: debit (%) != credit (%)', total_debit, total_credit;
    END IF;

    IF total_debit = 0 THEN
      RAISE EXCEPTION 'Entry has no lines or all amounts are zero';
    END IF;

    NEW.is_locked := true;
    NEW.validated_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entry_balance ON accounting_entries;
CREATE TRIGGER trg_entry_balance
  BEFORE UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_entry_balance();

-- Trigger: Prevent modification of locked/validated entries (intangibilite)
CREATE OR REPLACE FUNCTION fn_locked_entry_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = true THEN
    -- Allow only reversal_of to be set on locked entries
    IF NEW.is_locked = OLD.is_locked
       AND NEW.is_validated = OLD.is_validated
       AND NEW.entry_date = OLD.entry_date
       AND NEW.label = OLD.label
       AND NEW.journal_code = OLD.journal_code THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a locked/validated entry. Use reversal (contre-passation) instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_locked_entry ON accounting_entries;
CREATE TRIGGER trg_locked_entry
  BEFORE UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_locked_entry_guard();

-- Trigger: Auto audit log on entry changes
CREATE OR REPLACE FUNCTION fn_audit_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO accounting_audit_log (entity_id, actor_id, actor_type, action, target_type, target_id, details)
    VALUES (
      NEW.entity_id,
      NEW.created_by,
      'user',
      'create_entry',
      'accounting_entry',
      NEW.id,
      jsonb_build_object('journal_code', NEW.journal_code, 'entry_number', NEW.entry_number, 'label', NEW.label)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_validated = true AND OLD.is_validated = false THEN
      INSERT INTO accounting_audit_log (entity_id, actor_id, actor_type, action, target_type, target_id, details)
      VALUES (
        NEW.entity_id,
        NEW.validated_by,
        'user',
        'validate_entry',
        'accounting_entry',
        NEW.id,
        jsonb_build_object('entry_number', NEW.entry_number)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_entries ON accounting_entries;
CREATE TRIGGER trg_audit_entries
  AFTER INSERT OR UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_entry_changes();

-- Trigger: updated_at auto-update
CREATE OR REPLACE FUNCTION fn_accounting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'accounting_exercises', 'accounting_entries', 'bank_connections',
      'bank_transactions', 'document_analyses', 'amortization_schedules',
      'deficit_tracking', 'charge_regularizations', 'copro_budgets',
      'copro_fund_calls', 'mandant_accounts', 'crg_reports'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_accounting_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- =====================================================
-- HELPER: Generate next entry number
-- =====================================================
CREATE OR REPLACE FUNCTION fn_next_entry_number(
  p_entity_id UUID,
  p_exercise_id UUID,
  p_journal_code TEXT
)
RETURNS TEXT AS $$
DECLARE
  next_seq INTEGER;
  year_part TEXT;
BEGIN
  SELECT EXTRACT(YEAR FROM start_date)::TEXT INTO year_part
  FROM accounting_exercises WHERE id = p_exercise_id;

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(entry_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM accounting_entries
  WHERE entity_id = p_entity_id
    AND exercise_id = p_exercise_id
    AND journal_code = p_journal_code;

  RETURN p_journal_code || '-' || year_part || '-' || LPAD(next_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE accounting_exercises IS 'Exercices comptables par entite (SCI, copro, agence)';
COMMENT ON TABLE chart_of_accounts IS 'Plan comptable PCG/copro/custom par entite';
COMMENT ON TABLE accounting_entries IS 'Ecritures comptables double-entry avec intangibilite';
COMMENT ON TABLE bank_transactions IS 'Transactions bancaires importees pour rapprochement';
COMMENT ON TABLE accounting_audit_log IS 'Journal audit comptable (insertion seule, lecture utilisateur)';


-- === MIGRATION: 20260407120000_accounting_reconcile_schemas.sql ===
-- =====================================================
-- MIGRATION: Reconcile accounting schemas
-- Date: 2026-04-07
--
-- The old migration (20260110000001) created:
--   accounting_journals, accounting_entries, mandant_accounts,
--   charge_regularisations, deposit_operations, bank_reconciliations
--
-- The new migration (20260406210000) tries to create tables with
-- overlapping names but uses IF NOT EXISTS, so conflicting tables
-- are silently skipped.
--
-- This migration:
-- 1. Adds missing columns to old accounting_entries for double-entry support
-- 2. Adds missing columns to old accounting_journals for entity support
-- 3. Adds missing columns to old mandant_accounts for entity support
-- 4. Creates accounting_entry_lines if not exists (new table, no conflict)
-- 5. Ensures all new non-conflicting tables from 20260406210000 exist
-- =====================================================

-- =====================================================
-- 1. Extend accounting_journals with entity support
-- =====================================================
ALTER TABLE public.accounting_journals
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS journal_type TEXT;

-- Backfill label from libelle
UPDATE public.accounting_journals
SET label = libelle
WHERE label IS NULL AND libelle IS NOT NULL;

-- =====================================================
-- 2. Extend accounting_entries with double-entry header fields
-- =====================================================
ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES accounting_exercises(id),
  ADD COLUMN IF NOT EXISTS entry_number TEXT,
  ADD COLUMN IF NOT EXISTS entry_date DATE,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS is_validated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversal_of UUID REFERENCES accounting_entries(id);

-- Backfill new columns from old columns
UPDATE public.accounting_entries
SET
  entry_number = ecriture_num,
  entry_date = ecriture_date,
  label = ecriture_lib,
  is_validated = (valid_date IS NOT NULL),
  validated_at = valid_date::timestamptz
WHERE entry_number IS NULL AND ecriture_num IS NOT NULL;

-- Add the unique constraint for new entry numbering (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entry_number_unique'
  ) THEN
    -- Only add if no duplicates exist
    IF (SELECT COUNT(*) FROM (
      SELECT entity_id, exercise_id, entry_number
      FROM public.accounting_entries
      WHERE entity_id IS NOT NULL AND exercise_id IS NOT NULL AND entry_number IS NOT NULL
      GROUP BY entity_id, exercise_id, entry_number
      HAVING COUNT(*) > 1
    ) dups) = 0 THEN
      ALTER TABLE public.accounting_entries
        ADD CONSTRAINT entry_number_unique UNIQUE (entity_id, exercise_id, entry_number);
    END IF;
  END IF;
END $$;

-- =====================================================
-- 3. Extend mandant_accounts with entity support
-- =====================================================
ALTER TABLE public.mandant_accounts
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS mandant_name TEXT,
  ADD COLUMN IF NOT EXISTS mandant_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- 4. Ensure accounting_entry_lines exists
-- (This table is NEW — no conflict with old schema)
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT,
  debit_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
  credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  lettrage TEXT,
  piece_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_side CHECK (
    (debit_cents > 0 AND credit_cents = 0) OR
    (debit_cents = 0 AND credit_cents > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_entry_lines_entry ON accounting_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_lines_account ON accounting_entry_lines(account_number);
CREATE INDEX IF NOT EXISTS idx_entry_lines_lettrage ON accounting_entry_lines(lettrage)
  WHERE lettrage IS NOT NULL;

ALTER TABLE accounting_entry_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entry_lines_via_entry" ON accounting_entry_lines;
CREATE POLICY "entry_lines_via_entry" ON accounting_entry_lines
  FOR ALL TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 5. Add entity_members RLS policies to old tables
-- (Old tables used role-based RLS, add entity-based too)
-- =====================================================

-- accounting_entries: add entity-based policy
DROP POLICY IF EXISTS "entries_entity_access" ON public.accounting_entries;
CREATE POLICY "entries_entity_access" ON public.accounting_entries
  FOR ALL TO authenticated
  USING (
    entity_id IS NULL  -- allow access to old entries without entity
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- mandant_accounts: add entity-based policy
DROP POLICY IF EXISTS "mandant_entity_access" ON public.mandant_accounts;
CREATE POLICY "mandant_entity_access" ON public.mandant_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 6. Rename old accounting_accounts → keep as-is
-- The new chart_of_accounts is a separate table (no conflict)
-- Both can coexist: old for agency, new for owner/copro
-- =====================================================

COMMENT ON TABLE public.accounting_journals IS 'Journaux comptables — extended with entity support for multi-entity accounting';
COMMENT ON TABLE public.accounting_entries IS 'Ecritures comptables — extended with double-entry header fields and entity support';
COMMENT ON TABLE public.mandant_accounts IS 'Comptes mandants — extended with entity support';


-- === MIGRATION: 20260407130000_ocr_category_rules.sql ===
-- =====================================================
-- MIGRATION: OCR Category Rules + document_analyses extensions
-- Date: 2026-04-07
-- =====================================================

-- Table for OCR learning rules
CREATE TABLE IF NOT EXISTS ocr_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('supplier_name', 'supplier_siret', 'keyword')),
  match_value TEXT NOT NULL,
  target_account TEXT NOT NULL,
  target_category TEXT,
  target_journal TEXT,
  confidence_boost NUMERIC(5,2) DEFAULT 10.0,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entity_id, match_type, match_value)
);

CREATE INDEX IF NOT EXISTS idx_ocr_rules_entity ON ocr_category_rules(entity_id);
CREATE INDEX IF NOT EXISTS idx_ocr_rules_match ON ocr_category_rules(match_type, match_value);

ALTER TABLE ocr_category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_rules_entity_access" ON ocr_category_rules
  FOR ALL TO authenticated
  USING (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));

-- Extend document_analyses with OCR-specific columns
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES accounting_entries(id);
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS raw_ocr_text TEXT;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS suggested_entry JSONB;


-- === MIGRATION: 20260408042218_create_expenses_table.sql ===
-- Migration: Table expenses (dépenses/travaux propriétaire)
-- Date: 2026-04-08
-- RLS via chaîne : legal_entities.owner_profile_id → owner_profiles.profile_id
-- Compatible multi-entités (legal_entity_id) + particulier (owner_profile_id direct)

BEGIN;

-- ============================================
-- TABLE: expenses
-- ============================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rattachement entité / propriétaire
  legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  owner_profile_id UUID NOT NULL REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,

  -- Rattachement bien (optionnel — une dépense peut concerner plusieurs biens)
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,

  -- Catégorie de dépense
  category TEXT NOT NULL CHECK (category IN (
    'travaux',              -- Travaux / réparations
    'entretien',            -- Entretien courant
    'assurance',            -- Assurance PNO, loyers impayés
    'taxe_fonciere',        -- Taxe foncière
    'charges_copro',        -- Charges de copropriété
    'frais_gestion',        -- Frais de gestion / comptable
    'frais_bancaires',      -- Frais bancaires
    'diagnostic',           -- Diagnostics (DPE, amiante, etc.)
    'mobilier',             -- Mobilier (meublé)
    'honoraires',           -- Honoraires (notaire, huissier, avocat)
    'autre'                 -- Autre
  )),

  -- Détail
  description TEXT NOT NULL,
  montant DECIMAL(12, 2) NOT NULL CHECK (montant > 0),
  date_depense DATE NOT NULL DEFAULT CURRENT_DATE,
  fournisseur TEXT,                              -- Nom du prestataire / fournisseur

  -- TVA
  tva_taux DECIMAL(5, 2) DEFAULT 0,
  tva_montant DECIMAL(12, 2) DEFAULT 0,
  montant_ttc DECIMAL(12, 2) GENERATED ALWAYS AS (montant + COALESCE(tva_montant, 0)) STORED,

  -- Déductibilité fiscale
  deductible BOOLEAN NOT NULL DEFAULT true,
  deduction_exercice INTEGER,                    -- Année de déduction fiscale

  -- Justificatif
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  receipt_storage_path TEXT,

  -- Récurrence (si charge régulière)
  recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN (
    'mensuel', 'trimestriel', 'semestriel', 'annuel', 'ponctuel'
  )) DEFAULT 'ponctuel',

  -- Statut
  statut TEXT NOT NULL DEFAULT 'confirmed' CHECK (statut IN (
    'draft', 'confirmed', 'cancelled'
  )),

  -- Métadonnées
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- ============================================
-- INDEX
-- ============================================

CREATE INDEX IF NOT EXISTS idx_expenses_owner ON expenses(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_expenses_entity ON expenses(legal_entity_id) WHERE legal_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_expenses_year ON expenses(date_depense, owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_expenses_statut ON expenses(statut) WHERE statut = 'confirmed';

-- ============================================
-- RLS
-- ============================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Propriétaires : accès via la chaîne legal_entities → owner_profiles
-- Supporte à la fois :
--   - Dépenses rattachées à une entité (legal_entity_id IS NOT NULL)
--   - Dépenses en direct (owner_profile_id = profile courant)
CREATE POLICY "Owners can view own expenses" ON expenses
  FOR SELECT TO authenticated
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR public.user_role() = 'admin'
  );

CREATE POLICY "Owners can insert own expenses" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Owners can update own expenses" ON expenses
  FOR UPDATE TO authenticated
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Owners can delete own expenses" ON expenses
  FOR DELETE TO authenticated
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins full access on expenses" ON expenses
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- TRIGGER: updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

COMMIT;


-- === MIGRATION: 20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql ===
-- REVIEW: Cette migration contient des DROP/DELETE dangereux. Verifier avant d'appliquer.
-- REVIEW: -- =====================================================
-- REVIEW: -- MIGRATION: Réconciliation finale des schémas comptables
-- REVIEW: -- Date: 2026-04-08
-- REVIEW: --
-- REVIEW: -- 1. charge_regularisations (FR) → charge_regularizations (EN)
-- REVIEW: --    - Migre les données de l'ancienne table vers la nouvelle
-- REVIEW: --    - Crée une vue de compatibilité charge_regularisations
-- REVIEW: --
-- REVIEW: -- 2. accounting_entries inline → accounting_entry_lines
-- REVIEW: --    - Backfill des anciennes écritures inline (debit/credit)
-- REVIEW: --    - Vers le nouveau modèle header/lignes (entry_lines)
-- REVIEW: --
-- REVIEW: -- Idempotent : chaque opération vérifie l'état avant d'agir.
-- REVIEW: -- =====================================================
-- REVIEW: 
-- REVIEW: BEGIN;
-- REVIEW: 
-- REVIEW: -- =====================================================
-- REVIEW: -- PARTIE 1 : charge_regularisations → charge_regularizations
-- REVIEW: -- =====================================================
-- REVIEW: 
-- REVIEW: -- 1a. S'assurer que charge_regularizations a les colonnes de compatibilité
-- REVIEW: ALTER TABLE public.charge_regularizations
-- REVIEW:   ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id),
-- REVIEW:   ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id),
-- REVIEW:   ADD COLUMN IF NOT EXISTS annee INTEGER,
-- REVIEW:   ADD COLUMN IF NOT EXISTS date_emission DATE,
-- REVIEW:   ADD COLUMN IF NOT EXISTS date_echeance DATE,
-- REVIEW:   ADD COLUMN IF NOT EXISTS date_paiement DATE,
-- REVIEW:   ADD COLUMN IF NOT EXISTS nouvelle_provision DECIMAL(15, 2),
-- REVIEW:   ADD COLUMN IF NOT EXISTS notes TEXT,
-- REVIEW:   ADD COLUMN IF NOT EXISTS detail_charges JSONB DEFAULT '[]',
-- REVIEW:   ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
-- REVIEW: 
-- REVIEW: -- 1b. Migrer les données de charge_regularisations → charge_regularizations
-- REVIEW: -- Seulement les lignes qui n'existent pas déjà (idempotent via id)
-- REVIEW: INSERT INTO public.charge_regularizations (
-- REVIEW:   id,
-- REVIEW:   lease_id,
-- REVIEW:   property_id,
-- REVIEW:   tenant_id,
-- REVIEW:   annee,
-- REVIEW:   period_start,
-- REVIEW:   period_end,
-- REVIEW:   provisions_paid_cents,
-- REVIEW:   actual_recoverable_cents,
-- REVIEW:   actual_non_recoverable_cents,
-- REVIEW:   status,
-- REVIEW:   date_emission,
-- REVIEW:   date_echeance,
-- REVIEW:   date_paiement,
-- REVIEW:   nouvelle_provision,
-- REVIEW:   notes,
-- REVIEW:   detail_charges,
-- REVIEW:   created_by,
-- REVIEW:   created_at,
-- REVIEW:   updated_at,
-- REVIEW:   -- entity_id et exercise_id sont NULL — sera backfillé plus tard
-- REVIEW:   entity_id
-- REVIEW: )
-- REVIEW: SELECT
-- REVIEW:   cr.id,
-- REVIEW:   cr.lease_id,
-- REVIEW:   cr.property_id,
-- REVIEW:   cr.tenant_id,
-- REVIEW:   cr.annee,
-- REVIEW:   cr.date_debut,
-- REVIEW:   cr.date_fin,
-- REVIEW:   -- Conversion DECIMAL euros → INTEGER cents
-- REVIEW:   ROUND(cr.provisions_versees * 100)::INTEGER,
-- REVIEW:   ROUND(cr.charges_reelles * 100)::INTEGER,
-- REVIEW:   0, -- actual_non_recoverable_cents inconnu dans l'ancien schéma
-- REVIEW:   -- Mapping statut FR → EN
-- REVIEW:   CASE cr.statut
-- REVIEW:     WHEN 'draft' THEN 'draft'
-- REVIEW:     WHEN 'sent' THEN 'sent'
-- REVIEW:     WHEN 'paid' THEN 'paid'
-- REVIEW:     WHEN 'disputed' THEN 'draft'
-- REVIEW:     WHEN 'cancelled' THEN 'draft'
-- REVIEW:     ELSE 'draft'
-- REVIEW:   END,
-- REVIEW:   cr.date_emission,
-- REVIEW:   cr.date_echeance,
-- REVIEW:   cr.date_paiement,
-- REVIEW:   cr.nouvelle_provision,
-- REVIEW:   cr.notes,
-- REVIEW:   cr.detail_charges,
-- REVIEW:   cr.created_by,
-- REVIEW:   cr.created_at,
-- REVIEW:   cr.updated_at,
-- REVIEW:   -- Résoudre entity_id via property → properties.legal_entity_id
-- REVIEW:   (SELECT p.legal_entity_id FROM public.properties p WHERE p.id = cr.property_id LIMIT 1)
-- REVIEW: FROM public.charge_regularisations cr
-- REVIEW: WHERE NOT EXISTS (
-- REVIEW:   SELECT 1 FROM public.charge_regularizations crz WHERE crz.id = cr.id
-- REVIEW: );
-- REVIEW: 
-- REVIEW: -- 1c. Rattacher entity_id + exercise_id sur les lignes migrées qui n'en ont pas
-- REVIEW: -- entity_id via property
-- REVIEW: UPDATE public.charge_regularizations
-- REVIEW: SET entity_id = (
-- REVIEW:   SELECT p.legal_entity_id
-- REVIEW:   FROM public.properties p
-- REVIEW:   WHERE p.id = charge_regularizations.property_id
-- REVIEW:   LIMIT 1
-- REVIEW: )
-- REVIEW: WHERE entity_id IS NULL AND property_id IS NOT NULL;
-- REVIEW: 
-- REVIEW: -- exercise_id via annee → le premier exercice de cette année
-- REVIEW: UPDATE public.charge_regularizations
-- REVIEW: SET exercise_id = (
-- REVIEW:   SELECT ae.id
-- REVIEW:   FROM public.accounting_exercises ae
-- REVIEW:   WHERE EXTRACT(YEAR FROM ae.start_date) = charge_regularizations.annee
-- REVIEW:   ORDER BY ae.start_date ASC
-- REVIEW:   LIMIT 1
-- REVIEW: )
-- REVIEW: WHERE exercise_id IS NULL AND annee IS NOT NULL;
-- REVIEW: 
-- REVIEW: -- 1d. Renommer l'ancienne table et créer une vue de compatibilité
-- REVIEW: -- On ne DROP pas l'ancienne table pour éviter de casser du code legacy
-- REVIEW: -- qui pourrait encore la référencer via des FK ou du code direct
-- REVIEW: ALTER TABLE public.charge_regularisations RENAME TO charge_regularisations_legacy;
-- REVIEW: 
-- REVIEW: -- Vue de compatibilité : le code qui SELECT depuis charge_regularisations
-- REVIEW: -- continue de fonctionner, pointant vers la table normalisée
-- REVIEW: CREATE OR REPLACE VIEW public.charge_regularisations AS
-- REVIEW: SELECT
-- REVIEW:   id,
-- REVIEW:   lease_id,
-- REVIEW:   property_id,
-- REVIEW:   tenant_id,
-- REVIEW:   annee,
-- REVIEW:   period_start AS date_debut,
-- REVIEW:   period_end AS date_fin,
-- REVIEW:   -- Conversion cents → euros pour compatibilité
-- REVIEW:   (provisions_paid_cents / 100.0)::DECIMAL(15,2) AS provisions_versees,
-- REVIEW:   (actual_recoverable_cents / 100.0)::DECIMAL(15,2) AS charges_reelles,
-- REVIEW:   ((actual_recoverable_cents - provisions_paid_cents) / 100.0)::DECIMAL(15,2) AS solde,
-- REVIEW:   detail_charges,
-- REVIEW:   status AS statut,
-- REVIEW:   date_emission,
-- REVIEW:   date_echeance,
-- REVIEW:   date_paiement,
-- REVIEW:   nouvelle_provision,
-- REVIEW:   NULL::DATE AS date_effet_nouvelle_provision,
-- REVIEW:   notes,
-- REVIEW:   created_at,
-- REVIEW:   updated_at,
-- REVIEW:   created_by
-- REVIEW: FROM public.charge_regularizations;
-- REVIEW: 
-- REVIEW: COMMENT ON VIEW public.charge_regularisations IS
-- REVIEW:   'Vue de compatibilité — pointe vers charge_regularizations. Utiliser la table normalisée pour les nouvelles écritures.';
-- REVIEW: 
-- REVIEW: -- 1e. Triggers INSTEAD OF pour que INSERT/UPDATE/DELETE sur la vue
-- REVIEW: --     redirigent vers charge_regularizations (compatibilité code legacy)
-- REVIEW: 
-- REVIEW: CREATE OR REPLACE FUNCTION charge_regularisations_insert_redirect()
-- REVIEW: RETURNS TRIGGER AS $$
-- REVIEW: BEGIN
-- REVIEW:   INSERT INTO public.charge_regularizations (
-- REVIEW:     id, lease_id, property_id, tenant_id, annee,
-- REVIEW:     period_start, period_end,
-- REVIEW:     provisions_paid_cents, actual_recoverable_cents, actual_non_recoverable_cents,
-- REVIEW:     status, date_emission, date_echeance, date_paiement,
-- REVIEW:     nouvelle_provision, notes, detail_charges, created_by,
-- REVIEW:     entity_id
-- REVIEW:   ) VALUES (
-- REVIEW:     COALESCE(NEW.id, gen_random_uuid()),
-- REVIEW:     NEW.lease_id,
-- REVIEW:     NEW.property_id,
-- REVIEW:     NEW.tenant_id,
-- REVIEW:     NEW.annee,
-- REVIEW:     NEW.date_debut,
-- REVIEW:     NEW.date_fin,
-- REVIEW:     ROUND(COALESCE(NEW.provisions_versees, 0) * 100)::INTEGER,
-- REVIEW:     ROUND(COALESCE(NEW.charges_reelles, 0) * 100)::INTEGER,
-- REVIEW:     0,
-- REVIEW:     COALESCE(NEW.statut, 'draft'),
-- REVIEW:     NEW.date_emission,
-- REVIEW:     NEW.date_echeance,
-- REVIEW:     NEW.date_paiement,
-- REVIEW:     NEW.nouvelle_provision,
-- REVIEW:     NEW.notes,
-- REVIEW:     NEW.detail_charges,
-- REVIEW:     NEW.created_by,
-- REVIEW:     (SELECT p.legal_entity_id FROM public.properties p WHERE p.id = NEW.property_id LIMIT 1)
-- REVIEW:   )
-- REVIEW:   RETURNING id INTO NEW.id;
-- REVIEW:   RETURN NEW;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql;
-- REVIEW: 
-- REVIEW: CREATE TRIGGER charge_regularisations_on_insert
-- REVIEW:   INSTEAD OF INSERT ON public.charge_regularisations
-- REVIEW:   FOR EACH ROW EXECUTE FUNCTION charge_regularisations_insert_redirect();
-- REVIEW: 
-- REVIEW: CREATE OR REPLACE FUNCTION charge_regularisations_update_redirect()
-- REVIEW: RETURNS TRIGGER AS $$
-- REVIEW: BEGIN
-- REVIEW:   UPDATE public.charge_regularizations SET
-- REVIEW:     lease_id = NEW.lease_id,
-- REVIEW:     property_id = NEW.property_id,
-- REVIEW:     tenant_id = NEW.tenant_id,
-- REVIEW:     annee = NEW.annee,
-- REVIEW:     period_start = COALESCE(NEW.date_debut, period_start),
-- REVIEW:     period_end = COALESCE(NEW.date_fin, period_end),
-- REVIEW:     provisions_paid_cents = ROUND(COALESCE(NEW.provisions_versees, 0) * 100)::INTEGER,
-- REVIEW:     actual_recoverable_cents = ROUND(COALESCE(NEW.charges_reelles, 0) * 100)::INTEGER,
-- REVIEW:     status = COALESCE(NEW.statut, status),
-- REVIEW:     date_emission = NEW.date_emission,
-- REVIEW:     date_echeance = NEW.date_echeance,
-- REVIEW:     date_paiement = NEW.date_paiement,
-- REVIEW:     nouvelle_provision = NEW.nouvelle_provision,
-- REVIEW:     notes = NEW.notes,
-- REVIEW:     detail_charges = NEW.detail_charges,
-- REVIEW:     updated_at = NOW()
-- REVIEW:   WHERE id = OLD.id;
-- REVIEW:   RETURN NEW;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql;
-- REVIEW: 
-- REVIEW: CREATE TRIGGER charge_regularisations_on_update
-- REVIEW:   INSTEAD OF UPDATE ON public.charge_regularisations
-- REVIEW:   FOR EACH ROW EXECUTE FUNCTION charge_regularisations_update_redirect();
-- REVIEW: 
-- REVIEW: CREATE OR REPLACE FUNCTION charge_regularisations_delete_redirect()
-- REVIEW: RETURNS TRIGGER AS $$
-- REVIEW: BEGIN
-- REVIEW:   DELETE FROM public.charge_regularizations WHERE id = OLD.id;
-- REVIEW:   RETURN OLD;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql;
-- REVIEW: 
-- REVIEW: CREATE TRIGGER charge_regularisations_on_delete
-- REVIEW:   INSTEAD OF DELETE ON public.charge_regularisations
-- REVIEW:   FOR EACH ROW EXECUTE FUNCTION charge_regularisations_delete_redirect();
-- REVIEW: 
-- REVIEW: -- =====================================================
-- REVIEW: -- PARTIE 2 : Backfill accounting_entries → entry_lines
-- REVIEW: -- =====================================================
-- REVIEW: -- Les anciennes écritures ont debit/credit inline.
-- REVIEW: -- Le nouveau modèle utilise accounting_entry_lines.
-- REVIEW: -- On crée une ligne par écriture ancienne qui a un montant.
-- REVIEW: 
-- REVIEW: -- 2a. Insérer les lignes pour les écritures qui n'ont pas encore de lignes
-- REVIEW: INSERT INTO public.accounting_entry_lines (
-- REVIEW:   entry_id,
-- REVIEW:   account_number,
-- REVIEW:   label,
-- REVIEW:   debit_cents,
-- REVIEW:   credit_cents,
-- REVIEW:   lettrage,
-- REVIEW:   piece_ref
-- REVIEW: )
-- REVIEW: SELECT
-- REVIEW:   ae.id,
-- REVIEW:   ae.compte_num,
-- REVIEW:   ae.ecriture_lib,
-- REVIEW:   -- Conversion DECIMAL euros → INTEGER cents
-- REVIEW:   ROUND(ae.debit * 100)::INTEGER,
-- REVIEW:   ROUND(ae.credit * 100)::INTEGER,
-- REVIEW:   ae.ecriture_let,
-- REVIEW:   ae.piece_ref
-- REVIEW: FROM public.accounting_entries ae
-- REVIEW: WHERE
-- REVIEW:   -- Seulement les écritures qui ont des montants inline
-- REVIEW:   (ae.debit > 0 OR ae.credit > 0)
-- REVIEW:   -- Et qui n'ont pas encore de lignes associées
-- REVIEW:   AND NOT EXISTS (
-- REVIEW:     SELECT 1 FROM public.accounting_entry_lines ael
-- REVIEW:     WHERE ael.entry_id = ae.id
-- REVIEW:   )
-- REVIEW:   -- Et qui ont le format ancien (compte_num rempli)
-- REVIEW:   AND ae.compte_num IS NOT NULL;
-- REVIEW: 
-- REVIEW: -- 2b. Marquer les anciennes écritures comme ayant été migrées (via metadata)
-- REVIEW: -- On utilise la colonne source pour tracer
-- REVIEW: UPDATE public.accounting_entries
-- REVIEW: SET source = COALESCE(source, 'legacy_inline_migrated')
-- REVIEW: WHERE
-- REVIEW:   source IS NULL
-- REVIEW:   AND (debit > 0 OR credit > 0)
-- REVIEW:   AND compte_num IS NOT NULL
-- REVIEW:   AND EXISTS (
-- REVIEW:     SELECT 1 FROM public.accounting_entry_lines ael WHERE ael.entry_id = id
-- REVIEW:   );
-- REVIEW: 
-- REVIEW: -- =====================================================
-- REVIEW: -- VÉRIFICATION (commentaire informatif)
-- REVIEW: -- =====================================================
-- REVIEW: -- Après exécution, vérifier :
-- REVIEW: --
-- REVIEW: -- SELECT 'charge_regularizations' AS table_name, COUNT(*) FROM charge_regularizations
-- REVIEW: -- UNION ALL
-- REVIEW: -- SELECT 'charge_regularisations_legacy', COUNT(*) FROM charge_regularisations_legacy
-- REVIEW: -- UNION ALL
-- REVIEW: -- SELECT 'entries_with_lines', COUNT(DISTINCT entry_id) FROM accounting_entry_lines
-- REVIEW: -- UNION ALL
-- REVIEW: -- SELECT 'entries_without_lines', COUNT(*) FROM accounting_entries
-- REVIEW: --   WHERE (debit > 0 OR credit > 0) AND NOT EXISTS (
-- REVIEW: --     SELECT 1 FROM accounting_entry_lines WHERE entry_id = accounting_entries.id
-- REVIEW: --   );
-- REVIEW: 
-- REVIEW: COMMIT;
-- REVIEW: 


-- === MIGRATION: 20260408100000_copro_lots.sql ===
-- Sprint 5: Copropriété lots + fund call lines
-- Tables for syndic copropriété module

CREATE TABLE IF NOT EXISTS copro_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copro_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  lot_type TEXT CHECK (lot_type IN ('habitation','commerce','parking','cave','bureau','autre')) DEFAULT 'habitation',
  owner_name TEXT NOT NULL,
  owner_entity_id UUID REFERENCES legal_entities(id),
  owner_profile_id UUID REFERENCES profiles(id),
  tantiemes_generaux INTEGER NOT NULL CHECK (tantiemes_generaux > 0),
  tantiemes_speciaux JSONB DEFAULT '{}',
  surface_m2 NUMERIC(8,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(copro_entity_id, lot_number)
);
CREATE INDEX idx_copro_lots_entity ON copro_lots(copro_entity_id);
ALTER TABLE copro_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copro_lots_entity_access" ON copro_lots FOR ALL TO authenticated
  USING (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));

-- Add missing columns to copro_fund_calls for syndic module
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES accounting_exercises(id);
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS call_number TEXT;
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS period_label TEXT;
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','partial','overdue'));

-- Make lot-level columns nullable (calls now represent periods, lines hold lot details)
ALTER TABLE copro_fund_calls ALTER COLUMN owner_name DROP NOT NULL;
ALTER TABLE copro_fund_calls ALTER COLUMN owner_name SET DEFAULT '';
ALTER TABLE copro_fund_calls ALTER COLUMN tantiemes DROP NOT NULL;
ALTER TABLE copro_fund_calls DROP CONSTRAINT IF EXISTS copro_fund_calls_tantiemes_check;
ALTER TABLE copro_fund_calls ALTER COLUMN tantiemes SET DEFAULT 0;
ALTER TABLE copro_fund_calls ALTER COLUMN total_tantiemes DROP NOT NULL;
ALTER TABLE copro_fund_calls DROP CONSTRAINT IF EXISTS copro_fund_calls_total_tantiemes_check;
ALTER TABLE copro_fund_calls ALTER COLUMN total_tantiemes SET DEFAULT 0;

-- Backfill exercise_id from budget if null
UPDATE copro_fund_calls SET exercise_id = copro_budgets.exercise_id
  FROM copro_budgets WHERE copro_fund_calls.budget_id = copro_budgets.id
  AND copro_fund_calls.exercise_id IS NULL;

-- Add copro_fund_call_lines if not exists
CREATE TABLE IF NOT EXISTS copro_fund_call_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES copro_fund_calls(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES copro_lots(id),
  owner_name TEXT NOT NULL,
  tantiemes INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','partial','paid','overdue')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE copro_fund_call_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copro_fund_call_lines_access" ON copro_fund_call_lines FOR ALL TO authenticated
  USING (call_id IN (SELECT id FROM copro_fund_calls WHERE entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid())));


-- === MIGRATION: 20260408110000_agency_hoguet.sql ===
-- ============================================================================
-- Sprint 6: Agency Hoguet compliance columns
--
-- Adds Carte G (carte professionnelle gestion immobiliere) and caisse de
-- garantie information to legal_entities for Loi Hoguet compliance.
-- ============================================================================

ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_numero TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_expiry DATE;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie_numero TEXT;

-- Index for quick Hoguet compliance checks
CREATE INDEX IF NOT EXISTS idx_legal_entities_carte_g
  ON legal_entities (carte_g_numero)
  WHERE carte_g_numero IS NOT NULL;

COMMENT ON COLUMN legal_entities.carte_g_numero IS 'Numero de carte professionnelle G (gestion immobiliere) - Loi Hoguet';
COMMENT ON COLUMN legal_entities.carte_g_expiry IS 'Date expiration de la carte G';
COMMENT ON COLUMN legal_entities.caisse_garantie IS 'Nom de la caisse de garantie financiere';
COMMENT ON COLUMN legal_entities.caisse_garantie_numero IS 'Numero adhesion a la caisse de garantie';


-- === MIGRATION: 20260408120000_api_keys_webhooks.sql ===
-- ============================================================================
-- Migration: API Keys, API Logs, API Webhooks
-- Feature: REST API pour développeurs tiers (Pro+/Enterprise)
-- ============================================================================

-- ============================================================================
-- 1. api_keys — Clés API pour authentification Bearer token
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,                           -- 'Mon ERP', 'Zapier'
  key_hash TEXT NOT NULL,                       -- SHA-256 du token (jamais en clair)
  key_prefix TEXT NOT NULL,                     -- 'tlk_live_xxxx' (pour identification)
  permissions TEXT[] DEFAULT '{read}',          -- ['read', 'write', 'delete']
  scopes TEXT[] DEFAULT '{properties}',         -- ['properties','leases','documents','accounting']
  rate_limit_per_hour INTEGER DEFAULT 1000,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_profile ON api_keys(profile_id);

-- RLS: Owner can only see/manage their own API keys
CREATE POLICY "api_keys_select_own" ON api_keys
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_keys_insert_own" ON api_keys
  FOR INSERT WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_keys_update_own" ON api_keys
  FOR UPDATE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_keys_delete_own" ON api_keys
  FOR DELETE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================================================
-- 2. api_logs — Logs de chaque appel API
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  request_body_size INTEGER,
  response_body_size INTEGER,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_logs_key ON api_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);

-- RLS: Owner can see logs for their own API keys
CREATE POLICY "api_logs_select_own" ON api_logs
  FOR SELECT USING (
    api_key_id IN (
      SELECT id FROM api_keys WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Insert allowed for service role only (via API middleware)
-- No insert policy for regular users

-- ============================================================================
-- 3. api_webhooks — Webhooks sortants configurés par le propriétaire
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,                       -- ['lease.created','payment.received',...]
  secret TEXT NOT NULL,                         -- Pour signature HMAC-SHA256
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  failure_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_webhooks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_webhooks_profile ON api_webhooks(profile_id);
CREATE INDEX IF NOT EXISTS idx_api_webhooks_events ON api_webhooks USING GIN(events);

-- RLS: Owner can only see/manage their own webhooks
CREATE POLICY "api_webhooks_select_own" ON api_webhooks
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_webhooks_insert_own" ON api_webhooks
  FOR INSERT WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_webhooks_update_own" ON api_webhooks
  FOR UPDATE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_webhooks_delete_own" ON api_webhooks
  FOR DELETE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. api_webhook_deliveries — Log de chaque envoi de webhook
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES api_webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  attempt INTEGER DEFAULT 1,
  error TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON api_webhook_deliveries(webhook_id, delivered_at DESC);

-- ============================================================================
-- 5. Triggers updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_api_keys_updated_at') THEN
    CREATE TRIGGER set_api_keys_updated_at
      BEFORE UPDATE ON api_keys
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_api_webhooks_updated_at') THEN
    CREATE TRIGGER set_api_webhooks_updated_at
      BEFORE UPDATE ON api_webhooks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- === MIGRATION: 20260408120000_colocation_module.sql ===
-- ============================================================
-- Migration: Module Colocation SOTA 2026
-- Tables: colocation_rooms, colocation_members, colocation_rules,
--         colocation_tasks, colocation_expenses
-- View:   v_colocation_balances
-- Alters: properties, leases
-- ============================================================

-- ============================================================
-- 1. Alter existing tables
-- ============================================================

ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  colocation_type TEXT CHECK (colocation_type IN ('bail_unique', 'baux_individuels'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  has_solidarity_clause BOOLEAN DEFAULT true;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  max_colocataires INTEGER;

ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  is_colocation BOOLEAN DEFAULT false;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  colocation_type TEXT CHECK (colocation_type IN ('bail_unique', 'baux_individuels'));
ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  solidarity_clause BOOLEAN DEFAULT false;

-- ============================================================
-- 2. Chambres d'une colocation
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  room_label TEXT,
  surface_m2 NUMERIC(6,2),
  rent_share_cents INTEGER NOT NULL,
  charges_share_cents INTEGER DEFAULT 0,
  is_furnished BOOLEAN DEFAULT false,
  description TEXT,
  photos JSONB DEFAULT '[]',
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, room_number)
);

ALTER TABLE colocation_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coloc_rooms_property ON colocation_rooms(property_id);

-- RLS: owner can manage rooms, tenant can read rooms of their property
CREATE POLICY coloc_rooms_owner_all ON colocation_rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_rooms.property_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY coloc_rooms_tenant_select ON colocation_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE l.property_id = colocation_rooms.property_id
        AND pr.user_id = auth.uid()
        AND l.statut IN ('active', 'pending')
    )
  );

-- ============================================================
-- 3. Membres d'une colocation
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  room_id UUID REFERENCES colocation_rooms(id),
  lease_id UUID NOT NULL REFERENCES leases(id),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id),

  -- Statut
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'departing', 'departed')),

  -- Dates
  move_in_date DATE NOT NULL,
  move_out_date DATE,
  notice_given_at TIMESTAMPTZ,
  notice_effective_date DATE,
  solidarity_end_date DATE,

  -- Financier
  rent_share_cents INTEGER NOT NULL,
  charges_share_cents INTEGER DEFAULT 0,
  deposit_cents INTEGER DEFAULT 0,
  deposit_returned BOOLEAN DEFAULT false,

  -- Paiement SEPA
  stripe_payment_method_id TEXT,
  pays_individually BOOLEAN DEFAULT false,

  -- Remplacement
  replaced_by_member_id UUID REFERENCES colocation_members(id),
  replaces_member_id UUID REFERENCES colocation_members(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coloc_members_property ON colocation_members(property_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_lease ON colocation_members(lease_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_tenant ON colocation_members(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_status ON colocation_members(status) WHERE status = 'active';

-- RLS: owner can manage members
CREATE POLICY coloc_members_owner_all ON colocation_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_members.property_id
        AND pr.user_id = auth.uid()
    )
  );

-- RLS: tenant can read members of their colocation
CREATE POLICY coloc_members_tenant_select ON colocation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm2
      WHERE cm2.property_id = colocation_members.property_id
        AND cm2.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm2.status IN ('active', 'departing')
    )
  );

-- ============================================================
-- 4. Reglement interieur
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'menage', 'bruit', 'invites', 'animaux',
                        'espaces_communs', 'charges', 'autre')),
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY coloc_rules_owner_all ON colocation_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_rules.property_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY coloc_rules_tenant_select ON colocation_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_rules.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );

-- ============================================================
-- 5. Planning taches partagees
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  recurrence TEXT DEFAULT 'weekly'
    CHECK (recurrence IN ('daily', 'weekly', 'biweekly', 'monthly')),
  assigned_member_id UUID REFERENCES colocation_members(id),
  assigned_room_id UUID REFERENCES colocation_rooms(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  rotation_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY coloc_tasks_owner_all ON colocation_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_tasks.property_id
        AND pr.user_id = auth.uid()
    )
  );

-- Tenants can read and update tasks (mark as completed)
CREATE POLICY coloc_tasks_tenant_select ON colocation_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_tasks.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );

CREATE POLICY coloc_tasks_tenant_update ON colocation_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_tasks.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status = 'active'
    )
  );

-- ============================================================
-- 6. Depenses partagees entre colocataires
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  paid_by_member_id UUID NOT NULL REFERENCES colocation_members(id),
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  category TEXT DEFAULT 'autre'
    CHECK (category IN ('menage', 'courses', 'internet', 'electricite',
                        'eau', 'reparation', 'autre')),
  split_type TEXT DEFAULT 'equal'
    CHECK (split_type IN ('equal', 'by_room', 'custom')),
  split_details JSONB,
  receipt_document_id UUID REFERENCES documents(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY coloc_expenses_owner_all ON colocation_expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_expenses.property_id
        AND pr.user_id = auth.uid()
    )
  );

-- Tenants can read and create expenses
CREATE POLICY coloc_expenses_tenant_select ON colocation_expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_expenses.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );

CREATE POLICY coloc_expenses_tenant_insert ON colocation_expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_expenses.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status = 'active'
    )
  );

-- ============================================================
-- 7. Vue : Soldes entre colocataires
-- ============================================================

CREATE OR REPLACE VIEW v_colocation_balances AS
WITH active_member_counts AS (
  SELECT property_id, COUNT(*) AS cnt
  FROM colocation_members
  WHERE status = 'active'
  GROUP BY property_id
),
room_rent_totals AS (
  SELECT cr.property_id,
         SUM(cr.rent_share_cents) AS total_rent
  FROM colocation_rooms cr
  WHERE cr.is_available = false
  GROUP BY cr.property_id
),
expense_shares AS (
  SELECT
    e.property_id,
    e.paid_by_member_id AS payer_id,
    cm.id AS debtor_id,
    CASE e.split_type
      WHEN 'equal' THEN e.amount_cents / NULLIF(amc.cnt, 0)
      WHEN 'by_room' THEN
        CASE WHEN rrt.total_rent > 0 AND cr.rent_share_cents IS NOT NULL
          THEN cr.rent_share_cents * e.amount_cents / rrt.total_rent
          ELSE e.amount_cents / NULLIF(amc.cnt, 0)
        END
      ELSE COALESCE((e.split_details->>(cm.id::text))::int, 0)
    END AS share_cents
  FROM colocation_expenses e
  JOIN colocation_members cm
    ON cm.property_id = e.property_id AND cm.status = 'active'
  LEFT JOIN active_member_counts amc
    ON amc.property_id = e.property_id
  LEFT JOIN colocation_rooms cr
    ON cr.id = cm.room_id
  LEFT JOIN room_rent_totals rrt
    ON rrt.property_id = e.property_id
  WHERE NOT e.is_settled
)
SELECT
  property_id,
  payer_id,
  debtor_id,
  SUM(share_cents)::INTEGER AS total_owed_cents
FROM expense_shares
WHERE payer_id != debtor_id
GROUP BY property_id, payer_id, debtor_id;

-- ============================================================
-- 8. Triggers updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_colocation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coloc_rooms_updated_at
  BEFORE UPDATE ON colocation_rooms
  FOR EACH ROW EXECUTE FUNCTION update_colocation_updated_at();

CREATE TRIGGER trg_coloc_members_updated_at
  BEFORE UPDATE ON colocation_members
  FOR EACH ROW EXECUTE FUNCTION update_colocation_updated_at();

-- ============================================================
-- 9. Function: Auto-calculate solidarity_end_date
-- ============================================================

CREATE OR REPLACE FUNCTION auto_solidarity_end_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If member is departing and has a move_out_date, calculate solidarity end
  IF NEW.status = 'departing' AND NEW.move_out_date IS NOT NULL THEN
    -- If replaced, solidarity ends immediately
    IF NEW.replaced_by_member_id IS NOT NULL THEN
      NEW.solidarity_end_date = NEW.move_out_date;
    ELSE
      -- 6 months after move_out (loi ALUR)
      NEW.solidarity_end_date = NEW.move_out_date + INTERVAL '6 months';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coloc_solidarity_end
  BEFORE INSERT OR UPDATE ON colocation_members
  FOR EACH ROW EXECUTE FUNCTION auto_solidarity_end_date();


-- === MIGRATION: 20260408120000_edl_sortie_workflow.sql ===
-- ============================================================================
-- MIGRATION: EDL Sortie Workflow — Pièces, Vétusté, Retenues, Comparaison
-- Date: 2026-04-08
-- Description:
--   - Table edl_rooms (pièces structurées avec cotation globale)
--   - Extension edl_items avec champs comparaison entrée/sortie
--   - Extension edl avec champs sortie (retenues, dépôt, lien entrée)
--   - Table vetuste_grid (grille de vétusté)
--   - Mise à jour contraintes condition (6 niveaux)
-- ============================================================================

-- ─── 1. Étendre la table edl pour le workflow sortie ────────────────────────

DO $$
BEGIN
    -- Lien vers l'EDL d'entrée (pour EDL sortie)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'linked_entry_edl_id') THEN
        ALTER TABLE edl ADD COLUMN linked_entry_edl_id UUID REFERENCES edl(id);
    END IF;

    -- Parties présentes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'owner_present') THEN
        ALTER TABLE edl ADD COLUMN owner_present BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'owner_representative') THEN
        ALTER TABLE edl ADD COLUMN owner_representative TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'tenant_profiles') THEN
        ALTER TABLE edl ADD COLUMN tenant_profiles UUID[] DEFAULT '{}';
    END IF;

    -- Retenues sur dépôt (sortie uniquement)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'total_retenue_cents') THEN
        ALTER TABLE edl ADD COLUMN total_retenue_cents INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'retenue_details') THEN
        ALTER TABLE edl ADD COLUMN retenue_details JSONB DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'depot_garantie_cents') THEN
        ALTER TABLE edl ADD COLUMN depot_garantie_cents INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'montant_restitue_cents') THEN
        ALTER TABLE edl ADD COLUMN montant_restitue_cents INTEGER;
    END IF;
END $$;

-- Index pour la jointure entrée→sortie
CREATE INDEX IF NOT EXISTS idx_edl_linked_entry ON edl(linked_entry_edl_id);

-- ─── 2. Table edl_rooms (pièces structurées) ───────────────────────────────

CREATE TABLE IF NOT EXISTS edl_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edl_id UUID NOT NULL REFERENCES edl(id) ON DELETE CASCADE,

    room_name TEXT NOT NULL,
    room_type TEXT NOT NULL DEFAULT 'autre'
        CHECK (room_type IN (
            'entree','salon','sejour','cuisine','chambre','salle_de_bain',
            'wc','couloir','buanderie','cave','parking','balcon','terrasse',
            'jardin','garage','autre'
        )),
    sort_order INTEGER DEFAULT 0,

    -- État global de la pièce
    general_condition TEXT DEFAULT 'bon'
        CHECK (general_condition IN ('neuf','tres_bon','bon','usage_normal','mauvais','tres_mauvais')),
    observations TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE edl_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_edl_rooms_edl ON edl_rooms(edl_id);

-- RLS policies pour edl_rooms
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_select_policy') THEN
        CREATE POLICY edl_rooms_select_policy ON edl_rooms FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_insert_policy') THEN
        CREATE POLICY edl_rooms_insert_policy ON edl_rooms FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_update_policy') THEN
        CREATE POLICY edl_rooms_update_policy ON edl_rooms FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_delete_policy') THEN
        CREATE POLICY edl_rooms_delete_policy ON edl_rooms FOR DELETE USING (true);
    END IF;
END $$;

-- ─── 3. Étendre edl_items pour comparaison entrée/sortie ───────────────────

DO $$
BEGIN
    -- Lien vers la pièce
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'room_id') THEN
        ALTER TABLE edl_items ADD COLUMN room_id UUID REFERENCES edl_rooms(id) ON DELETE CASCADE;
    END IF;

    -- Type d'élément normalisé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'element_type') THEN
        ALTER TABLE edl_items ADD COLUMN element_type TEXT;
    END IF;

    -- Label personnalisé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'element_label') THEN
        ALTER TABLE edl_items ADD COLUMN element_label TEXT;
    END IF;

    -- Ordre d'affichage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'sort_order') THEN
        ALTER TABLE edl_items ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;

    -- Photos JSONB
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'photos') THEN
        ALTER TABLE edl_items ADD COLUMN photos JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Champs comparaison entrée (remplis auto pour EDL sortie)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_condition') THEN
        ALTER TABLE edl_items ADD COLUMN entry_condition TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_description') THEN
        ALTER TABLE edl_items ADD COLUMN entry_description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_photos') THEN
        ALTER TABLE edl_items ADD COLUMN entry_photos JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Dégradation notée
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'degradation_noted') THEN
        ALTER TABLE edl_items ADD COLUMN degradation_noted BOOLEAN DEFAULT false;
    END IF;

    -- Vétusté
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'vetuste_applicable') THEN
        ALTER TABLE edl_items ADD COLUMN vetuste_applicable BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'vetuste_coefficient') THEN
        ALTER TABLE edl_items ADD COLUMN vetuste_coefficient NUMERIC(3,2);
    END IF;

    -- Retenue sur cet élément
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'retenue_cents') THEN
        ALTER TABLE edl_items ADD COLUMN retenue_cents INTEGER DEFAULT 0;
    END IF;

    -- Coût de réparation estimé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'cout_reparation_cents') THEN
        ALTER TABLE edl_items ADD COLUMN cout_reparation_cents INTEGER DEFAULT 0;
    END IF;
END $$;

-- Mettre à jour la contrainte condition pour 6 niveaux
-- D'abord supprimer l'ancienne contrainte si elle existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'edl_items' AND column_name = 'condition'
    ) THEN
        ALTER TABLE edl_items DROP CONSTRAINT IF EXISTS edl_items_condition_check;
    END IF;
END $$;

ALTER TABLE edl_items ADD CONSTRAINT edl_items_condition_check_v2
    CHECK (condition IS NULL OR condition IN ('neuf','tres_bon','bon','usage_normal','moyen','mauvais','tres_mauvais'));

-- Index pour room_id
CREATE INDEX IF NOT EXISTS idx_edl_items_room_id ON edl_items(room_id);
CREATE INDEX IF NOT EXISTS idx_edl_items_element_type ON edl_items(element_type);

-- ─── 4. Table vetuste_grid (grille de vétusté) ─────────────────────────────

CREATE TABLE IF NOT EXISTS vetuste_grid (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_type TEXT NOT NULL,
    duree_vie_ans INTEGER NOT NULL,
    taux_abattement_annuel NUMERIC(4,2),
    valeur_residuelle_min NUMERIC(3,2) DEFAULT 0.10,
    source TEXT DEFAULT 'talok',
    notes TEXT
);

-- Seed grille standard (idempotent)
INSERT INTO vetuste_grid (element_type, duree_vie_ans, taux_abattement_annuel, notes)
SELECT * FROM (VALUES
    ('peinture',           7,  14.29::NUMERIC(4,2), 'Peinture murale standard'),
    ('papier_peint',       7,  14.29, 'Revêtement mural'),
    ('moquette',           7,  14.29, 'Revêtement sol textile'),
    ('parquet',            15,  6.67, 'Parquet massif ou contrecollé'),
    ('carrelage',          20,  5.00, 'Sol carrelé'),
    ('lino',               10, 10.00, 'Revêtement sol PVC/lino'),
    ('robinetterie',       10, 10.00, 'Robinets, mitigeurs'),
    ('sanitaires',         15,  6.67, 'WC, lavabo, baignoire'),
    ('volets',             15,  6.67, 'Volets roulants ou battants'),
    ('porte_interieure',   15,  6.67, 'Portes intérieures'),
    ('fenetre',            20,  5.00, 'Menuiseries extérieures'),
    ('chaudiere',          15,  6.67, 'Chaudière/cumulus'),
    ('electrique',         20,  5.00, 'Installation électrique'),
    ('placards',           15,  6.67, 'Rangements intégrés')
) AS v(element_type, duree_vie_ans, taux_abattement_annuel, notes)
WHERE NOT EXISTS (SELECT 1 FROM vetuste_grid LIMIT 1);

-- ─── 5. Commentaires ───────────────────────────────────────────────────────

COMMENT ON TABLE edl_rooms IS 'Pièces structurées pour l''état des lieux';
COMMENT ON TABLE vetuste_grid IS 'Grille de vétusté pour calcul des retenues (décret 2016-382)';
COMMENT ON COLUMN edl.linked_entry_edl_id IS 'EDL sortie: référence vers l''EDL d''entrée correspondant';
COMMENT ON COLUMN edl.total_retenue_cents IS 'Montant total des retenues sur dépôt de garantie (en centimes)';
COMMENT ON COLUMN edl.depot_garantie_cents IS 'Montant du dépôt de garantie du bail (en centimes)';
COMMENT ON COLUMN edl.montant_restitue_cents IS 'Montant à restituer au locataire (dépôt − retenues, en centimes)';
COMMENT ON COLUMN edl_items.entry_condition IS 'État de l''élément à l''entrée (rempli auto lors de l''EDL sortie)';
COMMENT ON COLUMN edl_items.vetuste_coefficient IS 'Coefficient vétusté 0.00 à 1.00 (calculé auto)';
COMMENT ON COLUMN edl_items.retenue_cents IS 'Retenue nette après vétusté (en centimes)';


-- === MIGRATION: 20260408120000_providers_module_sota.sql ===
-- =====================================================
-- MIGRATION: Module Prestataires SOTA 2026
-- Tables: providers, owner_providers
-- Alter: work_orders (extended state machine + fields)
-- Triggers: rating auto-update, updated_at
-- RLS: policies per role
-- =====================================================

-- =====================================================
-- 1. TABLE: providers (annuaire prestataires)
-- Standalone provider directory — not coupled to profiles
-- =====================================================

CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Identité
  company_name TEXT NOT NULL,
  siret TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,

  -- Activité
  trade_categories TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,

  -- Localisation
  address TEXT,
  city TEXT,
  postal_code TEXT,
  department TEXT,
  service_radius_km INTEGER DEFAULT 30,

  -- Qualifications
  certifications TEXT[] DEFAULT '{}',
  insurance_number TEXT,
  insurance_expiry DATE,
  decennale_number TEXT,
  decennale_expiry DATE,

  -- Notation (auto-updated by trigger)
  avg_rating NUMERIC(2,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_interventions INTEGER DEFAULT 0,

  -- Disponibilité
  is_available BOOLEAN DEFAULT true,
  response_time_hours INTEGER DEFAULT 48,
  emergency_available BOOLEAN DEFAULT false,

  -- Relation avec proprio
  added_by_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_marketplace BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,

  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_providers_department ON providers(department);
CREATE INDEX IF NOT EXISTS idx_providers_categories ON providers USING GIN(trade_categories);
CREATE INDEX IF NOT EXISTS idx_providers_owner ON providers(added_by_owner_id);
CREATE INDEX IF NOT EXISTS idx_providers_marketplace ON providers(is_marketplace) WHERE is_marketplace = true;
CREATE INDEX IF NOT EXISTS idx_providers_email ON providers(email);
CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);

-- RLS
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Owners see their own providers + marketplace
DROP POLICY IF EXISTS "Owners see own providers and marketplace" ON providers;
CREATE POLICY "Owners see own providers and marketplace"
  ON providers FOR SELECT
  USING (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR is_marketplace = true
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Owners can insert providers they add
DROP POLICY IF EXISTS "Owners can add providers" ON providers;
CREATE POLICY "Owners can add providers"
  ON providers FOR INSERT
  WITH CHECK (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );

-- Owners can update their own providers, providers can update themselves
DROP POLICY IF EXISTS "Owners update own providers" ON providers;
CREATE POLICY "Owners update own providers"
  ON providers FOR UPDATE
  USING (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Admins full access
DROP POLICY IF EXISTS "Admins full access providers" ON providers;
CREATE POLICY "Admins full access providers"
  ON providers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_providers_updated_at ON providers;
CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE providers IS 'Annuaire prestataires (carnet personnel + marketplace)';

-- =====================================================
-- 2. TABLE: owner_providers (carnet d adresses)
-- =====================================================

CREATE TABLE IF NOT EXISTS owner_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  nickname TEXT,
  notes TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, provider_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_owner_providers_owner ON owner_providers(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_providers_provider ON owner_providers(provider_id);

-- RLS
ALTER TABLE owner_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own provider links" ON owner_providers;
CREATE POLICY "Owners manage own provider links"
  ON owner_providers FOR ALL
  USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

COMMENT ON TABLE owner_providers IS 'Lien propriétaire ↔ prestataire (carnet d adresses personnel)';

-- =====================================================
-- 3. ALTER: work_orders — Extended state machine
-- Add new columns for the full ticket→devis→intervention→facture→paiement flow
-- =====================================================

-- Add new columns (idempotent with IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  -- property_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'property_id') THEN
    ALTER TABLE work_orders ADD COLUMN property_id UUID REFERENCES properties(id);
  END IF;

  -- owner_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'owner_id') THEN
    ALTER TABLE work_orders ADD COLUMN owner_id UUID REFERENCES profiles(id);
  END IF;

  -- entity_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'entity_id') THEN
    ALTER TABLE work_orders ADD COLUMN entity_id UUID REFERENCES legal_entities(id);
  END IF;

  -- lease_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'lease_id') THEN
    ALTER TABLE work_orders ADD COLUMN lease_id UUID REFERENCES leases(id);
  END IF;

  -- title
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'title') THEN
    ALTER TABLE work_orders ADD COLUMN title TEXT;
  END IF;

  -- description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'description') THEN
    ALTER TABLE work_orders ADD COLUMN description TEXT;
  END IF;

  -- category
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'category') THEN
    ALTER TABLE work_orders ADD COLUMN category TEXT;
  END IF;

  -- urgency
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'urgency') THEN
    ALTER TABLE work_orders ADD COLUMN urgency TEXT DEFAULT 'normal'
      CHECK (urgency IN ('low', 'normal', 'urgent', 'emergency'));
  END IF;

  -- status (new extended state machine — coexists with legacy statut)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'status') THEN
    ALTER TABLE work_orders ADD COLUMN status TEXT DEFAULT 'draft'
      CHECK (status IN (
        'draft', 'quote_requested', 'quote_received', 'quote_approved',
        'quote_rejected', 'scheduled', 'in_progress', 'completed',
        'invoiced', 'paid', 'disputed', 'cancelled'
      ));
  END IF;

  -- Quote dates & financials
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'requested_at') THEN
    ALTER TABLE work_orders ADD COLUMN requested_at TIMESTAMPTZ DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_received_at') THEN
    ALTER TABLE work_orders ADD COLUMN quote_received_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'approved_at') THEN
    ALTER TABLE work_orders ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'scheduled_date') THEN
    ALTER TABLE work_orders ADD COLUMN scheduled_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'scheduled_time_slot') THEN
    ALTER TABLE work_orders ADD COLUMN scheduled_time_slot TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'started_at') THEN
    ALTER TABLE work_orders ADD COLUMN started_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'completed_at') THEN
    ALTER TABLE work_orders ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;

  -- Financials
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_amount_cents') THEN
    ALTER TABLE work_orders ADD COLUMN quote_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_document_id') THEN
    ALTER TABLE work_orders ADD COLUMN quote_document_id UUID REFERENCES documents(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'invoice_amount_cents') THEN
    ALTER TABLE work_orders ADD COLUMN invoice_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'invoice_document_id') THEN
    ALTER TABLE work_orders ADD COLUMN invoice_document_id UUID REFERENCES documents(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'payment_method') THEN
    ALTER TABLE work_orders ADD COLUMN payment_method TEXT
      CHECK (payment_method IN ('bank_transfer', 'check', 'cash', 'stripe'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'paid_at') THEN
    ALTER TABLE work_orders ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;

  -- Intervention report
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'intervention_report') THEN
    ALTER TABLE work_orders ADD COLUMN intervention_report TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'intervention_photos') THEN
    ALTER TABLE work_orders ADD COLUMN intervention_photos JSONB DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'tenant_signature_url') THEN
    ALTER TABLE work_orders ADD COLUMN tenant_signature_url TEXT;
  END IF;

  -- Accounting link
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'accounting_entry_id') THEN
    ALTER TABLE work_orders ADD COLUMN accounting_entry_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'is_deductible') THEN
    ALTER TABLE work_orders ADD COLUMN is_deductible BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'deductible_category') THEN
    ALTER TABLE work_orders ADD COLUMN deductible_category TEXT;
  END IF;

  -- notes column (may already exist in some forks)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'notes') THEN
    ALTER TABLE work_orders ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Make ticket_id nullable (work orders can now be created standalone)
ALTER TABLE work_orders ALTER COLUMN ticket_id DROP NOT NULL;

-- New indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_property ON work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_owner ON work_orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_new_status ON work_orders(status);

-- Backfill: set status from legacy statut for existing rows
UPDATE work_orders
SET status = CASE
  WHEN statut = 'assigned' THEN 'draft'
  WHEN statut = 'scheduled' THEN 'scheduled'
  WHEN statut = 'done' THEN 'completed'
  WHEN statut = 'cancelled' THEN 'cancelled'
  WHEN statut = 'in_progress' THEN 'in_progress'
  ELSE 'draft'
END
WHERE status IS NULL;

-- Backfill: property_id from ticket if missing
UPDATE work_orders wo
SET property_id = t.property_id
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.property_id IS NULL
  AND t.property_id IS NOT NULL;

-- Backfill: title from ticket titre
UPDATE work_orders wo
SET title = t.titre
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.title IS NULL;

-- Backfill: description from ticket description
UPDATE work_orders wo
SET description = t.description
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.description IS NULL;

-- =====================================================
-- 4. FUNCTION: Update provider rating from reviews
-- Uses the new providers table
-- =====================================================

CREATE OR REPLACE FUNCTION update_provider_rating_from_reviews()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_id UUID;
BEGIN
  -- Find the provider linked to this provider_profile_id
  SELECT p.id INTO v_provider_id
  FROM providers p
  WHERE p.profile_id = NEW.provider_profile_id
  LIMIT 1;

  IF v_provider_id IS NOT NULL THEN
    UPDATE providers SET
      avg_rating = COALESCE(
        (SELECT ROUND(AVG(rating_overall)::NUMERIC, 1)
         FROM provider_reviews
         WHERE provider_profile_id = NEW.provider_profile_id AND is_published = true),
        0
      ),
      total_reviews = (
        SELECT COUNT(*)
        FROM provider_reviews
        WHERE provider_profile_id = NEW.provider_profile_id AND is_published = true
      )
    WHERE id = v_provider_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_provider_rating_from_reviews ON provider_reviews;
CREATE TRIGGER trg_update_provider_rating_from_reviews
  AFTER INSERT OR UPDATE ON provider_reviews
  FOR EACH ROW EXECUTE FUNCTION update_provider_rating_from_reviews();

-- =====================================================
-- 5. FUNCTION: Update provider total_interventions
-- =====================================================

CREATE OR REPLACE FUNCTION update_provider_intervention_count()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_record RECORD;
BEGIN
  -- Find the provider entry for this provider_id
  -- provider_id on work_orders references profiles(id)
  SELECT p.id INTO v_provider_record
  FROM providers p
  WHERE p.profile_id = COALESCE(NEW.provider_id, OLD.provider_id)
  LIMIT 1;

  IF v_provider_record.id IS NOT NULL THEN
    UPDATE providers SET
      total_interventions = (
        SELECT COUNT(*)
        FROM work_orders
        WHERE provider_id = COALESCE(NEW.provider_id, OLD.provider_id)
          AND (status IN ('completed', 'invoiced', 'paid') OR statut = 'done')
      )
    WHERE id = v_provider_record.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_provider_intervention_count ON work_orders;
CREATE TRIGGER trg_update_provider_intervention_count
  AFTER INSERT OR UPDATE OF status, statut OR DELETE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_provider_intervention_count();

-- =====================================================
-- 6. FUNCTION: Validate SIRET (14 digits)
-- =====================================================

CREATE OR REPLACE FUNCTION validate_provider_siret()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.siret IS NOT NULL AND NEW.siret <> '' THEN
    IF NEW.siret !~ '^\d{14}$' THEN
      RAISE EXCEPTION 'SIRET invalide: doit contenir exactement 14 chiffres';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_provider_siret ON providers;
CREATE TRIGGER trg_validate_provider_siret
  BEFORE INSERT OR UPDATE OF siret ON providers
  FOR EACH ROW EXECUTE FUNCTION validate_provider_siret();

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON COLUMN providers.trade_categories IS 'plomberie, electricite, serrurerie, peinture, menuiserie, chauffage, climatisation, toiture, maconnerie, jardinage, nettoyage, demenagement, diagnostic, general';
COMMENT ON COLUMN work_orders.status IS 'Extended state machine: draft→quote_requested→quote_received→quote_approved→scheduled→in_progress→completed→invoiced→paid';
COMMENT ON COLUMN work_orders.urgency IS 'low, normal, urgent, emergency';


-- === MIGRATION: 20260408120000_whitelabel_agency_module.sql ===
-- ============================================================================
-- White-label Agency Module
--
-- Tables for agency white-label branding, mandates (Hoguet-compliant),
-- CRG (Compte Rendu de Gestion), and mandant accounts.
-- ============================================================================

-- 1. whitelabel_configs — branding & domain config per agency
CREATE TABLE IF NOT EXISTS whitelabel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#2563EB',
  secondary_color TEXT,
  font_family TEXT DEFAULT 'Manrope',
  custom_domain TEXT,
  subdomain TEXT,
  domain_verified BOOLEAN DEFAULT false,
  company_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  siret TEXT,
  carte_g_number TEXT NOT NULL,
  carte_g_expiry DATE,
  caisse_garantie TEXT,
  caisse_garantie_montant INTEGER,
  rcp_assurance TEXT,
  show_powered_by_talok BOOLEAN DEFAULT true,
  custom_email_sender TEXT,
  custom_email_domain_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('setup', 'active', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whitelabel_configs ENABLE ROW LEVEL SECURITY;

-- Unique domain index
CREATE UNIQUE INDEX IF NOT EXISTS idx_wl_domain
  ON whitelabel_configs(custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Unique subdomain index
CREATE UNIQUE INDEX IF NOT EXISTS idx_wl_subdomain
  ON whitelabel_configs(subdomain)
  WHERE subdomain IS NOT NULL;

-- One config per agency
CREATE UNIQUE INDEX IF NOT EXISTS idx_wl_agency_profile
  ON whitelabel_configs(agency_profile_id);

-- RLS: agency sees own config only
CREATE POLICY whitelabel_configs_select ON whitelabel_configs
  FOR SELECT USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY whitelabel_configs_insert ON whitelabel_configs
  FOR INSERT WITH CHECK (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

CREATE POLICY whitelabel_configs_update ON whitelabel_configs
  FOR UPDATE USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY whitelabel_configs_admin ON whitelabel_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- 2. agency_mandates — Hoguet-compliant mandates
CREATE TABLE IF NOT EXISTS agency_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agency_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mandate_number TEXT NOT NULL,
  mandate_type TEXT DEFAULT 'gestion' CHECK (mandate_type IN ('gestion', 'location', 'syndic', 'transaction')),
  start_date DATE NOT NULL,
  end_date DATE,
  tacit_renewal BOOLEAN DEFAULT true,
  management_fee_type TEXT DEFAULT 'percentage' CHECK (management_fee_type IN ('percentage', 'fixed')),
  management_fee_rate NUMERIC(5,2),
  management_fee_fixed_cents INTEGER,
  property_ids UUID[] DEFAULT '{}',
  mandate_document_id UUID REFERENCES documents(id),
  mandant_bank_iban TEXT,
  mandant_bank_bic TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'terminated', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agency_mandates ENABLE ROW LEVEL SECURITY;

-- Sequential mandate numbering per agency
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_mandates_number
  ON agency_mandates(agency_profile_id, mandate_number);

-- RLS: agency sees own mandates
CREATE POLICY agency_mandates_agency_select ON agency_mandates
  FOR SELECT USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- RLS: owner sees mandates where they are mandant
CREATE POLICY agency_mandates_owner_select ON agency_mandates
  FOR SELECT USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY agency_mandates_insert ON agency_mandates
  FOR INSERT WITH CHECK (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

CREATE POLICY agency_mandates_update ON agency_mandates
  FOR UPDATE USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY agency_mandates_admin ON agency_mandates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- 3. agency_crg — Compte Rendu de Gestion
CREATE TABLE IF NOT EXISTS agency_crg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id UUID NOT NULL REFERENCES agency_mandates(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_rent_collected_cents INTEGER DEFAULT 0,
  total_charges_paid_cents INTEGER DEFAULT 0,
  total_fees_cents INTEGER DEFAULT 0,
  net_reversement_cents INTEGER DEFAULT 0,
  unpaid_rent_cents INTEGER DEFAULT 0,
  details_per_property JSONB DEFAULT '[]',
  works_summary JSONB DEFAULT '[]',
  document_id UUID REFERENCES documents(id),
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'acknowledged')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agency_crg ENABLE ROW LEVEL SECURITY;

-- Prevent duplicate CRG for same mandate/period
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_crg_mandate_period
  ON agency_crg(mandate_id, period_start, period_end);

-- RLS: agency sees CRGs for own mandates
CREATE POLICY agency_crg_agency_select ON agency_crg
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS: owner sees CRGs for their mandates
CREATE POLICY agency_crg_owner_select ON agency_crg
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.owner_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY agency_crg_insert ON agency_crg
  FOR INSERT WITH CHECK (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY agency_crg_update ON agency_crg
  FOR UPDATE USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY agency_crg_admin ON agency_crg
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- 4. agency_mandant_accounts — fund separation (Hoguet compliance)
CREATE TABLE IF NOT EXISTS agency_mandant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id UUID NOT NULL REFERENCES agency_mandates(id) ON DELETE CASCADE,
  balance_cents INTEGER DEFAULT 0,
  last_reversement_at TIMESTAMPTZ,
  reversement_overdue BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agency_mandant_accounts ENABLE ROW LEVEL SECURITY;

-- One account per mandate
CREATE UNIQUE INDEX IF NOT EXISTS idx_mandant_accounts_mandate
  ON agency_mandant_accounts(mandate_id);

-- RLS: agency sees own mandant accounts
CREATE POLICY mandant_accounts_agency_select ON agency_mandant_accounts
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS: owner sees their mandant account
CREATE POLICY mandant_accounts_owner_select ON agency_mandant_accounts
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.owner_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY mandant_accounts_insert ON agency_mandant_accounts
  FOR INSERT WITH CHECK (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY mandant_accounts_update ON agency_mandant_accounts
  FOR UPDATE USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY mandant_accounts_admin ON agency_mandant_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- ============================================================================
-- Triggers: auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_whitelabel_configs') THEN
    CREATE TRIGGER set_updated_at_whitelabel_configs
      BEFORE UPDATE ON whitelabel_configs
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_agency_mandates') THEN
    CREATE TRIGGER set_updated_at_agency_mandates
      BEFORE UPDATE ON agency_mandates
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_mandant_accounts') THEN
    CREATE TRIGGER set_updated_at_mandant_accounts
      BEFORE UPDATE ON agency_mandant_accounts
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

-- ============================================================================
-- Trigger: auto-flag overdue reversements (> 30 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_reversement_overdue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance_cents > 0 AND (
    NEW.last_reversement_at IS NULL
    OR NEW.last_reversement_at < now() - interval '30 days'
  ) THEN
    NEW.reversement_overdue = true;
  ELSE
    NEW.reversement_overdue = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'check_reversement_overdue_trigger') THEN
    CREATE TRIGGER check_reversement_overdue_trigger
      BEFORE INSERT OR UPDATE ON agency_mandant_accounts
      FOR EACH ROW EXECUTE FUNCTION check_reversement_overdue();
  END IF;
END $$;

-- Comments
COMMENT ON TABLE whitelabel_configs IS 'White-label branding and domain configuration per agency (Enterprise plan)';
COMMENT ON TABLE agency_mandates IS 'Hoguet-compliant management mandates between agencies and property owners';
COMMENT ON TABLE agency_crg IS 'Compte Rendu de Gestion - periodic management reports for mandants';
COMMENT ON TABLE agency_mandant_accounts IS 'Mandant fund accounts - strict separation from agency own funds (Hoguet)';
COMMENT ON COLUMN agency_mandant_accounts.reversement_overdue IS 'Auto-flagged true when balance > 0 and last reversement > 30 days ago';


-- === MIGRATION: 20260408130000_active_sessions.sql ===
-- ============================================================
-- MIGRATION: active_sessions — Session tracking & multi-device
-- SOTA 2026 — Auth & RBAC Architecture
-- ============================================================

-- Table: active_sessions
-- Tracks authenticated sessions per user/device for security overview
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_name TEXT,
  ip_address INET,
  user_agent TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_active_sessions_profile_id ON active_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_active ON active_sessions(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_sessions_not_revoked ON active_sessions(profile_id) WHERE revoked_at IS NULL;

-- Enable RLS
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see and manage their own sessions
CREATE POLICY "Users can view own sessions"
  ON active_sessions FOR SELECT
  USING (profile_id = user_profile_id());

CREATE POLICY "Users can insert own sessions"
  ON active_sessions FOR INSERT
  WITH CHECK (profile_id = user_profile_id());

CREATE POLICY "Users can update own sessions"
  ON active_sessions FOR UPDATE
  USING (profile_id = user_profile_id());

-- Admins can view all sessions (for security audit)
CREATE POLICY "Admins can view all sessions"
  ON active_sessions FOR SELECT
  USING (user_role() = 'admin');

-- Auto-update timestamp trigger
CREATE TRIGGER set_active_sessions_updated_at
  BEFORE UPDATE ON active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: upsert_active_session
-- Called on login/token refresh to track active sessions
CREATE OR REPLACE FUNCTION upsert_active_session(
  p_profile_id UUID,
  p_device_name TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_device TEXT;
BEGIN
  -- Parse device name from user agent if not provided
  v_device := COALESCE(p_device_name,
    CASE
      WHEN p_user_agent ILIKE '%iPhone%' THEN 'iPhone'
      WHEN p_user_agent ILIKE '%iPad%' THEN 'iPad'
      WHEN p_user_agent ILIKE '%Android%' THEN 'Android'
      WHEN p_user_agent ILIKE '%Macintosh%' THEN 'Mac'
      WHEN p_user_agent ILIKE '%Windows%' THEN 'Windows'
      WHEN p_user_agent ILIKE '%Linux%' THEN 'Linux'
      ELSE 'Appareil inconnu'
    END
  );

  -- Try to find an existing active session from the same device/IP
  SELECT id INTO v_session_id
  FROM active_sessions
  WHERE profile_id = p_profile_id
    AND revoked_at IS NULL
    AND (
      (ip_address = p_ip_address AND user_agent = p_user_agent)
      OR (device_name = v_device AND ip_address = p_ip_address)
    )
  ORDER BY last_active_at DESC
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    -- Update existing session
    UPDATE active_sessions
    SET last_active_at = now(),
        device_name = v_device,
        user_agent = COALESCE(p_user_agent, user_agent)
    WHERE id = v_session_id;
  ELSE
    -- Insert new session
    INSERT INTO active_sessions (profile_id, device_name, ip_address, user_agent)
    VALUES (p_profile_id, v_device, p_ip_address, p_user_agent)
    RETURNING id INTO v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$;

-- Function: revoke_session
CREATE OR REPLACE FUNCTION revoke_session(
  p_session_id UUID,
  p_profile_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE active_sessions
  SET revoked_at = now()
  WHERE id = p_session_id
    AND profile_id = p_profile_id
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

-- Auto-expire sessions older than 30 days (to be called by pg_cron)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE active_sessions
    SET revoked_at = now()
    WHERE revoked_at IS NULL
      AND last_active_at < now() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;


-- === MIGRATION: 20260408130000_admin_panel_tables.sql ===
-- Migration: Admin Panel — admin_logs, feature_flags, support_tickets
-- Tables pour le panneau d'administration Talok

-- ============================================
-- 1. ADMIN_LOGS (journal d'actions admin)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_target ON admin_logs(target_type, target_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- ============================================
-- 2. FEATURE_FLAGS (flags fonctionnels)
-- ============================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  description TEXT,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_flags_name ON feature_flags(name);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled);

-- ============================================
-- 3. SUPPORT_TICKETS (tickets support)
-- ============================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  category TEXT DEFAULT 'general',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- Trigger updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. RLS POLICIES
-- ============================================

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- admin_logs: lecture/écriture pour admins uniquement
CREATE POLICY "Admins can read admin_logs"
  ON admin_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

CREATE POLICY "Admins can insert admin_logs"
  ON admin_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- feature_flags: lecture pour tous (utilisateurs connectes), ecriture pour admins
CREATE POLICY "Authenticated users can read feature_flags"
  ON feature_flags FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage feature_flags"
  ON feature_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- support_tickets: user voit ses propres tickets, admins voient tout
CREATE POLICY "Users can read own support_tickets"
  ON support_tickets FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create support_tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all support_tickets"
  ON support_tickets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- ============================================
-- 5. INSERT SOME DEFAULT FEATURE FLAGS
-- ============================================

INSERT INTO feature_flags (name, enabled, rollout_percentage, description) VALUES
  ('new_dashboard', false, 0, 'Nouveau tableau de bord utilisateur'),
  ('ai_assistant', false, 10, 'Assistant IA TALO pour les utilisateurs'),
  ('open_banking', false, 0, 'Integration Open Banking pour les virements'),
  ('electronic_signature_v2', false, 25, 'Nouvelle version de la signature electronique'),
  ('advanced_reporting', false, 0, 'Rapports avances pour les proprietaires Pro'),
  ('dark_mode', true, 100, 'Theme sombre'),
  ('maintenance_mode', false, 0, 'Mode maintenance - bloque les nouvelles inscriptions'),
  ('beta_features', false, 5, 'Fonctionnalites beta pour les early adopters')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 6. HELPER FUNCTION: log_admin_action
-- ============================================

CREATE OR REPLACE FUNCTION log_admin_action(
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_admin_profile_id UUID;
  v_log_id UUID;
BEGIN
  SELECT id INTO v_admin_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
    AND role IN ('admin', 'platform_admin')
  LIMIT 1;

  IF v_admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not an admin';
  END IF;

  INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
  VALUES (v_admin_profile_id, p_action, p_target_type, p_target_id, p_details)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === MIGRATION: 20260408130000_candidatures_workflow.sql ===
-- Migration : Workflow Candidatures Locatives
-- Tables : property_listings, applications
-- RLS policies pour owner, tenant et accès public

-- ============================================
-- 1. TABLE PROPERTY_LISTINGS (Annonces)
-- ============================================

CREATE TABLE IF NOT EXISTS property_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  rent_amount_cents INTEGER NOT NULL CHECK (rent_amount_cents >= 0),
  charges_cents INTEGER DEFAULT 0 CHECK (charges_cents >= 0),
  available_from DATE NOT NULL,
  bail_type TEXT NOT NULL CHECK (bail_type IN ('nu', 'meuble', 'colocation', 'saisonnier', 'commercial')),
  photos JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT false,
  public_url_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_property_listings_property ON property_listings(property_id);
CREATE INDEX idx_property_listings_owner ON property_listings(owner_id);
CREATE INDEX idx_property_listings_published ON property_listings(is_published) WHERE is_published = true;
CREATE INDEX idx_property_listings_token ON property_listings(public_url_token);

-- RLS
ALTER TABLE property_listings ENABLE ROW LEVEL SECURITY;

-- Owner peut tout faire sur ses annonces
CREATE POLICY property_listings_owner_all ON property_listings
  FOR ALL USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Annonces publiées lisibles par tous (page publique)
CREATE POLICY property_listings_public_read ON property_listings
  FOR SELECT USING (is_published = true);

-- Trigger updated_at
CREATE TRIGGER update_property_listings_updated_at
  BEFORE UPDATE ON property_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. TABLE APPLICATIONS (Candidatures)
-- ============================================

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  applicant_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  message TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  completeness_score INTEGER DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
  scoring_id UUID,
  status TEXT DEFAULT 'received' CHECK (status IN (
    'received', 'documents_pending', 'complete', 'scoring',
    'shortlisted', 'accepted', 'rejected', 'withdrawn'
  )),
  rejection_reason TEXT,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_applications_listing ON applications(listing_id);
CREATE INDEX idx_applications_property ON applications(property_id);
CREATE INDEX idx_applications_owner ON applications(owner_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_email ON applications(applicant_email);

-- RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Owner peut voir les candidatures pour ses biens
CREATE POLICY applications_owner_all ON applications
  FOR ALL USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Candidat authentifié peut voir ses propres candidatures
CREATE POLICY applications_applicant_read ON applications
  FOR SELECT USING (applicant_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Insertion publique (candidats non authentifiés peuvent postuler)
CREATE POLICY applications_public_insert ON applications
  FOR INSERT WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. FONCTION : Calcul automatique complétude
-- ============================================

CREATE OR REPLACE FUNCTION calculate_application_completeness()
RETURNS TRIGGER AS $$
DECLARE
  score INTEGER := 0;
  docs JSONB;
BEGIN
  docs := COALESCE(NEW.documents, '[]'::jsonb);

  -- Nom et email toujours fournis (20 points)
  score := 20;

  -- Téléphone (10 points)
  IF NEW.applicant_phone IS NOT NULL AND NEW.applicant_phone != '' THEN
    score := score + 10;
  END IF;

  -- Message / lettre de motivation (10 points)
  IF NEW.message IS NOT NULL AND length(NEW.message) > 20 THEN
    score := score + 10;
  END IF;

  -- Documents : CNI (20 points)
  IF docs @> '[{"type": "identity"}]'::jsonb THEN
    score := score + 20;
  END IF;

  -- Documents : Justificatifs de revenus (20 points)
  IF docs @> '[{"type": "income"}]'::jsonb THEN
    score := score + 20;
  END IF;

  -- Documents : Avis d'imposition (20 points)
  IF docs @> '[{"type": "tax_notice"}]'::jsonb THEN
    score := score + 20;
  END IF;

  NEW.completeness_score := LEAST(score, 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_calculate_completeness
  BEFORE INSERT OR UPDATE OF documents, applicant_phone, message ON applications
  FOR EACH ROW EXECUTE FUNCTION calculate_application_completeness();

-- ============================================
-- 4. FONCTION : Nettoyage RGPD des candidatures refusées (> 6 mois)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_rejected_applications()
RETURNS void AS $$
BEGIN
  -- Supprimer les documents des candidatures refusées depuis plus de 6 mois
  UPDATE applications
  SET documents = '[]'::jsonb,
      applicant_phone = NULL,
      message = NULL
  WHERE status = 'rejected'
    AND rejected_at < now() - INTERVAL '6 months'
    AND documents != '[]'::jsonb;
END;
$$ LANGUAGE plpgsql;


-- === MIGRATION: 20260408130000_charges_locatives_module.sql ===
-- =====================================================
-- CHARGES LOCATIVES MODULE
-- Tables: charge_categories, charge_entries, charge_regularizations_v2
-- Décret 87-713 : 6 catégories de charges récupérables
-- =====================================================

-- 1. CHARGE_CATEGORIES
-- Catégories de charges par bien (décret 87-713)
CREATE TABLE IF NOT EXISTS charge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'ascenseurs',
    'eau_chauffage',
    'installations_individuelles',
    'parties_communes',
    'espaces_exterieurs',
    'taxes_redevances'
  )),
  label TEXT NOT NULL,
  is_recoverable BOOLEAN NOT NULL DEFAULT true,
  annual_budget_cents INTEGER NOT NULL DEFAULT 0 CHECK (annual_budget_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_charge_categories_property ON charge_categories(property_id);
CREATE INDEX idx_charge_categories_category ON charge_categories(category);

ALTER TABLE charge_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charge_categories_owner_access" ON charge_categories
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Tenants can read categories for their leased properties
CREATE POLICY "charge_categories_tenant_read" ON charge_categories
  FOR SELECT TO authenticated
  USING (
    property_id IN (
      SELECT l.property_id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND l.statut IN ('active', 'terminated')
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

-- 2. CHARGE_ENTRIES
-- Individual charge entries (actual expenses)
CREATE TABLE IF NOT EXISTS charge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES charge_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  date DATE NOT NULL,
  is_recoverable BOOLEAN NOT NULL DEFAULT true,
  justificatif_document_id UUID,
  accounting_entry_id UUID,
  fiscal_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_charge_entries_property ON charge_entries(property_id);
CREATE INDEX idx_charge_entries_category ON charge_entries(category_id);
CREATE INDEX idx_charge_entries_fiscal_year ON charge_entries(fiscal_year);
CREATE INDEX idx_charge_entries_date ON charge_entries(date);

ALTER TABLE charge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charge_entries_owner_access" ON charge_entries
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Tenants can read recoverable entries for their leased properties
CREATE POLICY "charge_entries_tenant_read" ON charge_entries
  FOR SELECT TO authenticated
  USING (
    is_recoverable = true
    AND property_id IN (
      SELECT l.property_id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND l.statut IN ('active', 'terminated')
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

-- 3. LEASE_CHARGE_REGULARIZATIONS
-- Annual regularization per lease (replaces basic charge_reconciliations)
CREATE TABLE IF NOT EXISTS lease_charge_regularizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  total_provisions_cents INTEGER NOT NULL DEFAULT 0,
  total_actual_cents INTEGER NOT NULL DEFAULT 0,
  balance_cents INTEGER GENERATED ALWAYS AS (
    total_actual_cents - total_provisions_cents
  ) STORED, -- positive = tenant owes, negative = overpaid
  detail_per_category JSONB NOT NULL DEFAULT '[]'::jsonb,
  document_id UUID, -- PDF du décompte
  sent_at TIMESTAMPTZ,
  contested BOOLEAN NOT NULL DEFAULT false,
  contest_reason TEXT,
  contest_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'calculated', 'sent', 'acknowledged', 'contested', 'settled'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lease_id, fiscal_year)
);

CREATE INDEX idx_lease_charge_reg_lease ON lease_charge_regularizations(lease_id);
CREATE INDEX idx_lease_charge_reg_property ON lease_charge_regularizations(property_id);
CREATE INDEX idx_lease_charge_reg_year ON lease_charge_regularizations(fiscal_year);
CREATE INDEX idx_lease_charge_reg_status ON lease_charge_regularizations(status);

ALTER TABLE lease_charge_regularizations ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "lease_charge_reg_owner_access" ON lease_charge_regularizations
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Tenant can read and update (for contestation) their own regularizations
CREATE POLICY "lease_charge_reg_tenant_read" ON lease_charge_regularizations
  FOR SELECT TO authenticated
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

CREATE POLICY "lease_charge_reg_tenant_contest" ON lease_charge_regularizations
  FOR UPDATE TO authenticated
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  )
  WITH CHECK (
    -- Tenant can only update contestation fields
    status = 'sent'
  );

-- 4. TRIGGER: auto-update updated_at
CREATE OR REPLACE FUNCTION update_charges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_charge_categories_updated
  BEFORE UPDATE ON charge_categories
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();

CREATE TRIGGER trg_charge_entries_updated
  BEFORE UPDATE ON charge_entries
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();

CREATE TRIGGER trg_lease_charge_reg_updated
  BEFORE UPDATE ON lease_charge_regularizations
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();


-- === MIGRATION: 20260408130000_diagnostics_rent_control.sql ===
-- =============================================================================
-- Migration: property_diagnostics + rent_control_zones
-- Diagnostics immobiliers obligatoires (DDT) et encadrement des loyers
-- =============================================================================

-- 1. Table property_diagnostics
CREATE TABLE IF NOT EXISTS property_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  diagnostic_type TEXT NOT NULL CHECK (diagnostic_type IN (
    'dpe','amiante','plomb','gaz','electricite','termites','erp','surface_boutin','bruit'
  )),
  performed_date DATE NOT NULL,
  expiry_date DATE,
  result TEXT,
  diagnostiqueur_name TEXT,
  diagnostiqueur_certification TEXT,
  document_id UUID REFERENCES documents(id),
  is_valid BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, diagnostic_type)
);

-- RLS
ALTER TABLE property_diagnostics ENABLE ROW LEVEL SECURITY;

-- Owners can manage diagnostics on their properties
CREATE POLICY "property_diagnostics_owner_select"
  ON property_diagnostics FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "property_diagnostics_owner_insert"
  ON property_diagnostics FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "property_diagnostics_owner_update"
  ON property_diagnostics FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "property_diagnostics_owner_delete"
  ON property_diagnostics FOR DELETE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Tenants can view diagnostics for their leased properties
CREATE POLICY "property_diagnostics_tenant_select"
  ON property_diagnostics FOR SELECT
  USING (
    property_id IN (
      SELECT l.property_id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles p ON p.id = ls.profile_id
      WHERE p.user_id = auth.uid()
        AND l.statut = 'active'
    )
  );

-- Indexes
CREATE INDEX idx_property_diagnostics_property ON property_diagnostics(property_id);
CREATE INDEX idx_property_diagnostics_type ON property_diagnostics(diagnostic_type);
CREATE INDEX idx_property_diagnostics_expiry ON property_diagnostics(expiry_date) WHERE expiry_date IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_property_diagnostics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_property_diagnostics_updated_at
  BEFORE UPDATE ON property_diagnostics
  FOR EACH ROW EXECUTE FUNCTION update_property_diagnostics_updated_at();

-- 2. Table rent_control_zones (reference data)
CREATE TABLE IF NOT EXISTS rent_control_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  zone TEXT NOT NULL,
  type_logement TEXT NOT NULL,
  nb_pieces INTEGER,
  loyer_reference NUMERIC(6,2),
  loyer_majore NUMERIC(6,2),
  loyer_minore NUMERIC(6,2),
  year INTEGER NOT NULL,
  quarter INTEGER,
  source_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: read-only for all authenticated users
ALTER TABLE rent_control_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rent_control_zones_read"
  ON rent_control_zones FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Index for fast lookups
CREATE INDEX idx_rent_control_city_year ON rent_control_zones(city, year);
CREATE INDEX idx_rent_control_type ON rent_control_zones(type_logement, nb_pieces);

-- 3. Seed initial rent control reference data (Paris 2026 Q1 examples)
INSERT INTO rent_control_zones (city, zone, type_logement, nb_pieces, loyer_reference, loyer_majore, loyer_minore, year, quarter) VALUES
  ('Paris', '1', 'nu_ancien', 1, 28.30, 33.96, 19.81, 2026, 1),
  ('Paris', '1', 'nu_ancien', 2, 25.50, 30.60, 17.85, 2026, 1),
  ('Paris', '1', 'nu_ancien', 3, 23.10, 27.72, 16.17, 2026, 1),
  ('Paris', '1', 'meuble_ancien', 1, 33.10, 39.72, 23.17, 2026, 1),
  ('Paris', '1', 'meuble_ancien', 2, 29.80, 35.76, 20.86, 2026, 1),
  ('Paris', '1', 'meuble_ancien', 3, 27.40, 32.88, 19.18, 2026, 1),
  ('Paris', '2', 'nu_ancien', 1, 26.80, 32.16, 18.76, 2026, 1),
  ('Paris', '2', 'nu_ancien', 2, 24.20, 29.04, 16.94, 2026, 1),
  ('Paris', '2', 'meuble_ancien', 1, 31.50, 37.80, 22.05, 2026, 1),
  ('Paris', '2', 'meuble_ancien', 2, 28.30, 33.96, 19.81, 2026, 1),
  ('Lyon', '1', 'nu_ancien', 1, 14.50, 17.40, 10.15, 2026, 1),
  ('Lyon', '1', 'nu_ancien', 2, 12.80, 15.36, 8.96, 2026, 1),
  ('Lyon', '1', 'meuble_ancien', 1, 17.20, 20.64, 12.04, 2026, 1),
  ('Lille', '1', 'nu_ancien', 1, 13.80, 16.56, 9.66, 2026, 1),
  ('Lille', '1', 'nu_ancien', 2, 12.10, 14.52, 8.47, 2026, 1),
  ('Lille', '1', 'meuble_ancien', 1, 16.50, 19.80, 11.55, 2026, 1),
  ('Bordeaux', '1', 'nu_ancien', 1, 14.00, 16.80, 9.80, 2026, 1),
  ('Bordeaux', '1', 'meuble_ancien', 1, 16.80, 20.16, 11.76, 2026, 1),
  ('Montpellier', '1', 'nu_ancien', 1, 13.20, 15.84, 9.24, 2026, 1),
  ('Montpellier', '1', 'meuble_ancien', 1, 15.80, 18.96, 11.06, 2026, 1)
ON CONFLICT DO NOTHING;


-- === MIGRATION: 20260408130000_guarantor_workflow_complete.sql ===
-- ============================================
-- Migration: Workflow garant complet
-- Date: 2026-04-08
-- Description:
--   1. Ajouter le support Visale au type de garantie
--   2. Ajouter les colonnes d'invitation (email, token, etc.)
--   3. Ajouter les colonnes de libération
--   4. Ajouter le numéro Visale sur les engagements
--   5. Créer la table guarantor_invitations
--   6. Créer la fonction RPC guarantor_dashboard
--   7. Ajouter les RLS policies manquantes
-- ============================================

BEGIN;

-- ============================================
-- 1. TABLE D'INVITATIONS GARANT
-- ============================================

CREATE TABLE IF NOT EXISTS guarantor_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Informations garant invité
  guarantor_name TEXT NOT NULL,
  guarantor_email TEXT NOT NULL,
  guarantor_phone TEXT,
  guarantor_type TEXT NOT NULL DEFAULT 'solidaire'
    CHECK (guarantor_type IN ('simple', 'solidaire', 'visale')),
  relationship TEXT,

  -- Token d'invitation
  invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Suivi
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  declined_reason TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

  -- Lien avec le profil garant créé après acceptation
  guarantor_profile_id UUID REFERENCES profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(lease_id, guarantor_email)
);

CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_lease ON guarantor_invitations(lease_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_token ON guarantor_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_email ON guarantor_invitations(guarantor_email);
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_status ON guarantor_invitations(status);

COMMENT ON TABLE guarantor_invitations IS 'Invitations envoyées par les propriétaires aux garants potentiels';

-- ============================================
-- 2. ÉTENDRE guarantor_engagements POUR VISALE
-- ============================================

-- Mettre à jour la contrainte type_garantie pour inclure visale
ALTER TABLE guarantor_engagements
DROP CONSTRAINT IF EXISTS guarantor_engagements_type_garantie_check;

ALTER TABLE guarantor_engagements
ADD CONSTRAINT guarantor_engagements_type_garantie_check
CHECK (type_garantie IN ('caution_simple', 'caution_solidaire', 'visale'));

-- Ajouter le numéro Visale
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS visale_number TEXT;

-- Ajouter les colonnes de libération
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS liberated_at TIMESTAMPTZ;

ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS liberation_reason TEXT
  CHECK (liberation_reason IS NULL OR liberation_reason IN (
    'fin_bail', 'remplacement_locataire', 'depart_colocataire_6mois', 'accord_parties', 'autre'
  ));

-- Ajouter la référence à l'invitation
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES guarantor_invitations(id);

-- Ajouter la colonne signed_at si pas présente (alias pour date_signature)
-- date_signature existe déjà comme DATE, ajoutons signed_at comme TIMESTAMPTZ pour plus de précision
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- ============================================
-- 3. ÉTENDRE guarantor_profiles
-- ============================================

-- Ajouter les colonnes manquantes attendues par les types TS
ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS relation_to_tenant TEXT CHECK (relation_to_tenant IN (
  'parent', 'grand_parent', 'oncle_tante', 'frere_soeur', 'employeur', 'ami', 'autre'
));

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS relation_details TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS situation_pro TEXT CHECK (situation_pro IN (
  'cdi', 'cdd', 'fonctionnaire', 'independant', 'retraite', 'profession_liberale', 'chef_entreprise', 'autre'
));

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS employeur_nom TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS employeur_adresse TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS anciennete_mois INTEGER;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS revenus_fonciers DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS autres_revenus DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS charges_mensuelles DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS credits_en_cours DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS est_proprietaire BOOLEAN DEFAULT false;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS valeur_patrimoine_immobilier DECIMAL(12, 2);

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS adresse_complete TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS code_postal TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS ville TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_garant BOOLEAN DEFAULT false;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_garant_at TIMESTAMPTZ;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_data_processing BOOLEAN DEFAULT false;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_data_processing_at TIMESTAMPTZ;

-- ============================================
-- 4. RLS POLICIES POUR INVITATIONS
-- ============================================

ALTER TABLE guarantor_invitations ENABLE ROW LEVEL SECURITY;

-- Le propriétaire qui a invité peut voir/modifier ses invitations
CREATE POLICY "guarantor_invitations_owner_select" ON guarantor_invitations
  FOR SELECT USING (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "guarantor_invitations_owner_insert" ON guarantor_invitations
  FOR INSERT WITH CHECK (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "guarantor_invitations_owner_update" ON guarantor_invitations
  FOR UPDATE USING (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Le garant invité peut voir ses invitations (par email lié à son user)
CREATE POLICY "guarantor_invitations_guarantor_select" ON guarantor_invitations
  FOR SELECT USING (
    guarantor_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- Admin peut tout
CREATE POLICY "guarantor_invitations_admin_all" ON guarantor_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 5. TRIGGER updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_guarantor_invitations_updated_at ON guarantor_invitations;
CREATE TRIGGER update_guarantor_invitations_updated_at
  BEFORE UPDATE ON guarantor_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. FONCTION RPC : DASHBOARD GARANT
-- ============================================

CREATE OR REPLACE FUNCTION guarantor_dashboard(p_guarantor_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  -- Récupérer le profile_id du garant
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_guarantor_user_id AND role = 'guarantor';

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Construire le résultat du dashboard
  SELECT jsonb_build_object(
    'profile_id', v_profile_id,
    'engagements', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ge.id,
          'lease_id', ge.lease_id,
          'caution_type', CASE ge.type_garantie
            WHEN 'caution_simple' THEN 'simple'
            WHEN 'caution_solidaire' THEN 'solidaire'
            WHEN 'visale' THEN 'visale'
            ELSE ge.type_garantie
          END,
          'montant_garanti', ge.montant_max_garanti,
          'status', CASE ge.statut
            WHEN 'pending' THEN 'pending_signature'
            WHEN 'active' THEN 'active'
            WHEN 'expired' THEN 'released'
            WHEN 'invoked' THEN 'called'
            WHEN 'terminated' THEN 'terminated'
            ELSE ge.statut
          END,
          'signed_at', ge.signed_at,
          'created_at', ge.created_at,
          'tenant', jsonb_build_object(
            'id', tp.id,
            'name', TRIM(COALESCE(tp.prenom, '') || ' ' || COALESCE(tp.nom, ''))
          ),
          'property', jsonb_build_object(
            'id', prop.id,
            'adresse', prop.adresse_complete,
            'ville', prop.ville
          ),
          'lease', jsonb_build_object(
            'loyer', l.loyer,
            'charges', COALESCE(l.charges_forfaitaires, 0),
            'date_debut', l.date_debut
          )
        )
        ORDER BY ge.created_at DESC
      )
      FROM guarantor_engagements ge
      JOIN profiles tp ON tp.id = ge.tenant_profile_id
      JOIN leases l ON l.id = ge.lease_id
      JOIN properties prop ON prop.id = l.property_id
      WHERE ge.guarantor_profile_id = v_profile_id
    ), '[]'::jsonb),
    'incidents', '[]'::jsonb,
    'stats', jsonb_build_object(
      'total_engagements', (
        SELECT COUNT(*) FROM guarantor_engagements
        WHERE guarantor_profile_id = v_profile_id
        AND statut IN ('active', 'pending')
      ),
      'pending_signatures', (
        SELECT COUNT(*) FROM guarantor_engagements
        WHERE guarantor_profile_id = v_profile_id
        AND statut = 'pending'
      ),
      'total_amount_guaranteed', COALESCE((
        SELECT SUM(montant_max_garanti) FROM guarantor_engagements
        WHERE guarantor_profile_id = v_profile_id
        AND statut = 'active'
      ), 0),
      'active_incidents', 0
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION guarantor_dashboard IS 'Retourne les données du dashboard garant (engagements, incidents, stats)';

COMMIT;


-- === MIGRATION: 20260408130000_insurance_policies.sql ===
-- =============================================
-- Migration: Evolve insurance_policies table
-- From tenant-only to multi-role (PNO, multirisques, RC Pro, decennale, GLI, garantie financiere)
-- Original table: 20240101000009_tenant_advanced.sql
-- =============================================

BEGIN;

-- 1. Add new columns to existing table
ALTER TABLE insurance_policies
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS insurance_type TEXT,
  ADD COLUMN IF NOT EXISTS amount_covered_cents INTEGER,
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_30j BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_7j BOOLEAN DEFAULT false;

-- 2. Migrate data: copy tenant_profile_id -> profile_id, coverage_type -> insurance_type
UPDATE insurance_policies
SET profile_id = tenant_profile_id
WHERE profile_id IS NULL AND tenant_profile_id IS NOT NULL;

UPDATE insurance_policies
SET insurance_type = CASE
  WHEN coverage_type = 'habitation' THEN 'multirisques'
  WHEN coverage_type = 'responsabilite' THEN 'rc_pro'
  WHEN coverage_type = 'comprehensive' THEN 'multirisques'
  ELSE 'multirisques'
END
WHERE insurance_type IS NULL AND coverage_type IS NOT NULL;

-- 3. Make lease_id optional (was NOT NULL, now multi-role policies may not have a lease)
ALTER TABLE insurance_policies ALTER COLUMN lease_id DROP NOT NULL;

-- 4. Make policy_number optional (was NOT NULL)
ALTER TABLE insurance_policies ALTER COLUMN policy_number DROP NOT NULL;

-- 5. Add insurance_type CHECK constraint
ALTER TABLE insurance_policies DROP CONSTRAINT IF EXISTS insurance_policies_coverage_type_check;
ALTER TABLE insurance_policies ADD CONSTRAINT chk_insurance_type
  CHECK (insurance_type IN ('pno', 'multirisques', 'rc_pro', 'decennale', 'garantie_financiere', 'gli'));

-- 6. Add business constraints
ALTER TABLE insurance_policies ADD CONSTRAINT chk_insurance_dates
  CHECK (end_date > start_date);
ALTER TABLE insurance_policies ADD CONSTRAINT chk_insurance_amount_positive
  CHECK (amount_covered_cents IS NULL OR amount_covered_cents > 0);

-- 7. New indexes
CREATE INDEX IF NOT EXISTS idx_insurance_profile ON insurance_policies(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_property ON insurance_policies(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insurance_expiry_active ON insurance_policies(end_date) WHERE end_date > now();
CREATE INDEX IF NOT EXISTS idx_insurance_type ON insurance_policies(insurance_type);

-- 8. RLS (drop old policies from tenant_rls if they exist, add new multi-role ones)
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;

-- Drop old policies safely
DROP POLICY IF EXISTS "Tenants can view own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Tenants can insert own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Tenants can update own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Tenants can delete own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Owners can view tenant insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_select ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_insert ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_update ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_delete ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_view_tenants ON insurance_policies;

-- Users can manage their own policies
CREATE POLICY insurance_self_select ON insurance_policies
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR public.user_role() = 'admin'
  );

CREATE POLICY insurance_self_insert ON insurance_policies
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY insurance_self_update ON insurance_policies
  FOR UPDATE TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY insurance_self_delete ON insurance_policies
  FOR DELETE TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Owners can view tenant insurance linked to their properties
CREATE POLICY insurance_owner_view_tenants ON insurance_policies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles prof ON p.owner_id = prof.id
      WHERE l.id = insurance_policies.lease_id
        AND prof.user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY insurance_admin_all ON insurance_policies
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- 9. Trigger updated_at (idempotent)
CREATE OR REPLACE FUNCTION update_insurance_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insurance_updated_at ON insurance_policies;
CREATE TRIGGER trg_insurance_updated_at
  BEFORE UPDATE ON insurance_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_insurance_policies_updated_at();

-- 10. View: assurances expirant bientot
CREATE OR REPLACE VIEW insurance_expiring_soon AS
SELECT
  ip.id,
  ip.profile_id,
  ip.property_id,
  ip.lease_id,
  ip.insurance_type,
  ip.insurer_name,
  ip.policy_number,
  ip.start_date,
  ip.end_date,
  ip.amount_covered_cents,
  ip.document_id,
  ip.is_verified,
  ip.reminder_sent_30j,
  ip.reminder_sent_7j,
  p.first_name,
  p.last_name,
  p.email,
  p.role,
  prop.adresse_complete AS property_address,
  CASE
    WHEN ip.end_date <= CURRENT_DATE THEN 'expired'
    WHEN ip.end_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
    WHEN ip.end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'warning'
    ELSE 'ok'
  END AS expiry_status,
  ip.end_date - CURRENT_DATE AS days_until_expiry
FROM insurance_policies ip
JOIN profiles p ON ip.profile_id = p.id
LEFT JOIN properties prop ON ip.property_id = prop.id
WHERE ip.end_date <= CURRENT_DATE + INTERVAL '30 days';

COMMIT;


-- === MIGRATION: 20260408130000_rgpd_consent_records_and_data_requests.sql ===
-- Migration RGPD : consent_records (historique granulaire) + data_requests (demandes export/suppression)
-- Complète la table user_consents existante avec un historique versionné

-- ============================================
-- 1. consent_records : historique granulaire des consentements
-- ============================================
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'cgu', 'privacy_policy', 'marketing', 'analytics',
    'cookies_functional', 'cookies_analytics'
  )),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  version TEXT NOT NULL
);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consent records"
  ON consent_records FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own consent records"
  ON consent_records FOR INSERT
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_consent_records_profile_id ON consent_records(profile_id);
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);

-- ============================================
-- 2. data_requests : demandes RGPD (export, suppression, rectification)
-- ============================================
CREATE TABLE IF NOT EXISTS data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'deletion', 'rectification')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason TEXT,
  completed_at TIMESTAMPTZ,
  download_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data requests"
  ON data_requests FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own data requests"
  ON data_requests FOR INSERT
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own pending data requests"
  ON data_requests FOR UPDATE
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status = 'pending'
  );

CREATE INDEX idx_data_requests_profile_id ON data_requests(profile_id);
CREATE INDEX idx_data_requests_status ON data_requests(status);


-- === MIGRATION: 20260408130000_seasonal_rental_module.sql ===
-- ============================================================
-- Migration: Location saisonnière (seasonal rental module)
-- Tables: seasonal_listings, seasonal_rates, reservations, seasonal_blocked_dates
-- ============================================================

-- Vérifier que l'extension btree_gist est disponible pour la contrainte EXCLUDE
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- 1. seasonal_listings — Annonces saisonnières
-- ============================================================
CREATE TABLE IF NOT EXISTS seasonal_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  min_nights INTEGER DEFAULT 1 CHECK (min_nights >= 1),
  max_nights INTEGER DEFAULT 90 CHECK (max_nights >= 1),
  max_guests INTEGER DEFAULT 4 CHECK (max_guests >= 1),
  check_in_time TEXT DEFAULT '15:00',
  check_out_time TEXT DEFAULT '11:00',
  house_rules TEXT,
  amenities TEXT[] DEFAULT '{}',
  cleaning_fee_cents INTEGER DEFAULT 0 CHECK (cleaning_fee_cents >= 0),
  security_deposit_cents INTEGER DEFAULT 0 CHECK (security_deposit_cents >= 0),
  tourist_tax_per_night_cents INTEGER DEFAULT 0 CHECK (tourist_tax_per_night_cents >= 0),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE seasonal_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_manage_own_listings" ON seasonal_listings
  FOR ALL USING (owner_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_seasonal_listings_property ON seasonal_listings(property_id);
CREATE INDEX idx_seasonal_listings_owner ON seasonal_listings(owner_id);
CREATE INDEX idx_seasonal_listings_published ON seasonal_listings(is_published) WHERE is_published = true;

-- ============================================================
-- 2. seasonal_rates — Tarifs par saison
-- ============================================================
CREATE TABLE IF NOT EXISTS seasonal_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES seasonal_listings(id) ON DELETE CASCADE,
  season_name TEXT NOT NULL CHECK (season_name IN ('haute', 'basse', 'moyenne', 'fetes')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  nightly_rate_cents INTEGER NOT NULL CHECK (nightly_rate_cents > 0),
  weekly_rate_cents INTEGER CHECK (weekly_rate_cents > 0),
  monthly_rate_cents INTEGER CHECK (monthly_rate_cents > 0),
  min_nights_override INTEGER CHECK (min_nights_override >= 1),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_rate_dates CHECK (end_date > start_date)
);

ALTER TABLE seasonal_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_manage_rates" ON seasonal_rates
  FOR ALL USING (listing_id IN (
    SELECT id FROM seasonal_listings WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_seasonal_rates_listing ON seasonal_rates(listing_id);
CREATE INDEX idx_seasonal_rates_dates ON seasonal_rates(start_date, end_date);

-- ============================================================
-- 3. reservations — Réservations saisonnières
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES seasonal_listings(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  guest_count INTEGER DEFAULT 1 CHECK (guest_count >= 1),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER NOT NULL CHECK (nights >= 1),
  nightly_rate_cents INTEGER NOT NULL CHECK (nightly_rate_cents > 0),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  cleaning_fee_cents INTEGER DEFAULT 0 CHECK (cleaning_fee_cents >= 0),
  tourist_tax_cents INTEGER DEFAULT 0 CHECK (tourist_tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  deposit_cents INTEGER DEFAULT 0 CHECK (deposit_cents >= 0),
  source TEXT DEFAULT 'direct' CHECK (source IN ('direct','airbnb','booking','other')),
  external_id TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN (
    'pending','confirmed','checked_in','checked_out','cancelled','no_show'
  )),
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  cleaning_status TEXT DEFAULT 'pending' CHECK (cleaning_status IN ('pending','scheduled','done')),
  cleaning_provider_id UUID REFERENCES providers(id),
  notes TEXT,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_reservation_dates CHECK (check_out > check_in),
  CONSTRAINT no_overlap EXCLUDE USING gist (
    listing_id WITH =,
    daterange(check_in, check_out) WITH &&
  ) WHERE (status NOT IN ('cancelled','no_show'))
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_manage_reservations" ON reservations
  FOR ALL USING (listing_id IN (
    SELECT id FROM seasonal_listings WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_reservations_listing ON reservations(listing_id);
CREATE INDEX idx_reservations_property ON reservations(property_id);
CREATE INDEX idx_reservations_dates ON reservations(check_in, check_out);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_source ON reservations(source);
CREATE INDEX idx_reservations_cleaning ON reservations(cleaning_status) WHERE cleaning_status != 'done';

-- ============================================================
-- 4. seasonal_blocked_dates — Dates bloquées
-- ============================================================
CREATE TABLE IF NOT EXISTS seasonal_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES seasonal_listings(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT DEFAULT 'owner_block',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_blocked_dates CHECK (end_date >= start_date)
);

ALTER TABLE seasonal_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_manage_blocked" ON seasonal_blocked_dates
  FOR ALL USING (listing_id IN (
    SELECT id FROM seasonal_listings WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_blocked_dates_listing ON seasonal_blocked_dates(listing_id);
CREATE INDEX idx_blocked_dates_range ON seasonal_blocked_dates(start_date, end_date);

-- ============================================================
-- 5. Triggers updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_seasonal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seasonal_listings_updated_at
  BEFORE UPDATE ON seasonal_listings
  FOR EACH ROW EXECUTE FUNCTION update_seasonal_updated_at();

CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_seasonal_updated_at();


-- === MIGRATION: 20260408140000_tickets_module_sota.sql ===
-- =============================================
-- TICKETS MODULE SOTA — Upgrade complet
-- State machine: open → acknowledged → assigned → in_progress → resolved → closed
--                       ↓                                        ↓
--                    rejected                               reopened → in_progress
-- =============================================

-- 1. Ajouter les nouvelles colonnes à tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_rating INTEGER;

-- 2. Contrainte satisfaction_rating
ALTER TABLE tickets ADD CONSTRAINT tickets_satisfaction_rating_check
  CHECK (satisfaction_rating IS NULL OR (satisfaction_rating >= 1 AND satisfaction_rating <= 5));

-- 3. Contrainte category
ALTER TABLE tickets ADD CONSTRAINT tickets_category_check
  CHECK (category IS NULL OR category IN (
    'plomberie','electricite','serrurerie','chauffage','humidite',
    'nuisibles','bruit','parties_communes','equipement','autre'
  ));

-- 4. Étendre la contrainte de statut (garder paused pour backward compat)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_statut_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_statut_check
  CHECK (statut IN (
    'open','acknowledged','assigned','in_progress',
    'resolved','closed','rejected','reopened','paused'
  ));

-- 5. Étendre la contrainte de priorité (garder anciennes valeurs françaises pour compat)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_priorite_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_priorite_check
  CHECK (priorite IN ('low','normal','urgent','emergency','basse','normale','haute','urgente'));

-- 6. Backfill owner_id depuis properties pour tickets existants
UPDATE tickets t
SET owner_id = p.owner_id
FROM properties p
WHERE t.property_id = p.id
  AND t.owner_id IS NULL;

-- 7. Nouveaux index
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_owner_id ON tickets(owner_id);

-- 8. Créer la table ticket_comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id ON ticket_comments(author_id);

-- 9. RLS policies pour ticket_comments
CREATE POLICY "ticket_comments_select_owner"
  ON ticket_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      JOIN properties p ON p.id = t.property_id
      WHERE t.id = ticket_comments.ticket_id
        AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "ticket_comments_select_creator"
  ON ticket_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND t.created_by_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "ticket_comments_select_assigned"
  ON ticket_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND t.assigned_to = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "ticket_comments_insert"
  ON ticket_comments FOR INSERT
  WITH CHECK (
    author_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "ticket_comments_select_admin"
  ON ticket_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 10. Trigger updated_at pour tickets (si pas déjà présent)
CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tickets_updated_at ON tickets;
CREATE TRIGGER trigger_update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_updated_at();


-- === MIGRATION: 20260408200000_unified_notification_system.sql ===
-- =====================================================
-- MIGRATION: Système de notifications unifié
-- Ajoute la table notification_event_preferences (per-event)
-- et les colonnes manquantes sur notifications
-- =====================================================

-- 1. Ajouter colonnes manquantes à notifications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'route') THEN
    ALTER TABLE notifications ADD COLUMN route TEXT;
    COMMENT ON COLUMN notifications.route IS 'Deep link route (e.g. /owner/invoices/xxx)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'channels_sent') THEN
    ALTER TABLE notifications ADD COLUMN channels_sent TEXT[] DEFAULT '{}';
    COMMENT ON COLUMN notifications.channels_sent IS 'Channels actually used: email, push, in_app, sms';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
    ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read_at') THEN
    ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'profile_id') THEN
    ALTER TABLE notifications ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Index for profile-based queries
CREATE INDEX IF NOT EXISTS idx_notif_profile_read_created
  ON notifications(profile_id, is_read, created_at DESC);

-- 2. Table de préférences par événement
CREATE TABLE IF NOT EXISTS notification_event_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_event_prefs_profile
  ON notification_event_preferences(profile_id);

ALTER TABLE notification_event_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own event preferences" ON notification_event_preferences;
CREATE POLICY "Users can view own event preferences"
  ON notification_event_preferences FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage own event preferences" ON notification_event_preferences;
CREATE POLICY "Users can manage own event preferences"
  ON notification_event_preferences FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Allow service role to insert
DROP POLICY IF EXISTS "Service can manage event preferences" ON notification_event_preferences;
CREATE POLICY "Service can manage event preferences"
  ON notification_event_preferences FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_notification_event_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notif_event_prefs ON notification_event_preferences;
CREATE TRIGGER trigger_update_notif_event_prefs
  BEFORE UPDATE ON notification_event_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_event_prefs_updated_at();

COMMENT ON TABLE notification_event_preferences IS 'Per-event notification channel preferences for each user';

SELECT 'Unified notification system migration complete' AS result;


COMMIT;
