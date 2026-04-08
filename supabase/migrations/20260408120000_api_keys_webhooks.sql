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
