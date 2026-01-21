-- ============================================================================
-- P4: EVENT SOURCING & AUDIT SYSTEM (SOTA 2026)
-- ============================================================================
-- Date: 2026-01-21
-- Description: Complete event sourcing implementation with immutable audit trail
-- Features:
--   - Partitioned audit_events table for performance
--   - Automatic event capture via triggers
--   - Actor tracking (user, system, webhook, cron)
--   - Full payload capture with before/after states
--   - Compliance-ready (GDPR, legal retention)
-- ============================================================================

-- ============================================================================
-- PHASE 1: ENUM TYPES
-- ============================================================================

-- Actor types (who performed the action)
CREATE TYPE audit_actor_type AS ENUM (
  'user',           -- Authenticated user action
  'system',         -- System/application action
  'webhook',        -- External webhook callback
  'cron',           -- Scheduled job
  'migration',      -- Database migration
  'admin',          -- Admin override
  'anonymous'       -- Unauthenticated action
);

-- Event categories for grouping
CREATE TYPE audit_event_category AS ENUM (
  'auth',           -- Authentication events
  'property',       -- Property management
  'lease',          -- Lease lifecycle
  'signature',      -- Signature events
  'inspection',     -- EDL events
  'financial',      -- Invoices, payments
  'tenant',         -- Tenant management
  'ticket',         -- Support tickets
  'document',       -- Document operations
  'communication',  -- Messages, notifications
  'admin',          -- Admin operations
  'gdpr',           -- Privacy/GDPR events
  'system'          -- System events
);

-- ============================================================================
-- PHASE 2: MAIN AUDIT_EVENTS TABLE (PARTITIONED BY MONTH)
-- ============================================================================

CREATE TABLE audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Event identification
  event_type TEXT NOT NULL,              -- e.g., 'lease.created', 'payment.received'
  event_category audit_event_category NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,

  -- Actor information
  actor_type audit_actor_type NOT NULL DEFAULT 'user',
  actor_id UUID,                          -- Profile ID if user
  actor_email TEXT,                       -- For audit trail
  actor_role TEXT,                        -- Role at time of action

  -- Target entity
  entity_type TEXT NOT NULL,              -- e.g., 'lease', 'invoice', 'property'
  entity_id UUID NOT NULL,
  entity_name TEXT,                       -- Human-readable identifier

  -- Parent entity (for nested resources)
  parent_entity_type TEXT,
  parent_entity_id UUID,

  -- Payload
  payload JSONB NOT NULL DEFAULT '{}',
  old_values JSONB,                       -- Previous state (for updates)
  new_values JSONB,                       -- New state (for creates/updates)

  -- Context
  request_id UUID,                        -- Correlation ID
  session_id UUID,                        -- User session
  ip_address INET,
  user_agent TEXT,
  origin TEXT,                            -- 'web', 'mobile', 'api'

  -- Geolocation (optional)
  geo_country TEXT,
  geo_city TEXT,

  -- Timestamps (immutable)
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_time TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Partition key
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create comment
COMMENT ON TABLE audit_events IS 'Immutable event log for complete audit trail (P4 SOTA 2026). Partitioned by month for performance.';

-- ============================================================================
-- PHASE 3: CREATE PARTITIONS (2025-2027)
-- ============================================================================

-- 2025 partitions
CREATE TABLE audit_events_2025_01 PARTITION OF audit_events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE audit_events_2025_02 PARTITION OF audit_events
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE audit_events_2025_03 PARTITION OF audit_events
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE audit_events_2025_04 PARTITION OF audit_events
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE audit_events_2025_05 PARTITION OF audit_events
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE audit_events_2025_06 PARTITION OF audit_events
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE audit_events_2025_07 PARTITION OF audit_events
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE audit_events_2025_08 PARTITION OF audit_events
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE audit_events_2025_09 PARTITION OF audit_events
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE audit_events_2025_10 PARTITION OF audit_events
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE audit_events_2025_11 PARTITION OF audit_events
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE audit_events_2025_12 PARTITION OF audit_events
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- 2026 partitions
CREATE TABLE audit_events_2026_01 PARTITION OF audit_events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_events_2026_02 PARTITION OF audit_events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE audit_events_2026_03 PARTITION OF audit_events
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_events_2026_04 PARTITION OF audit_events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_events_2026_05 PARTITION OF audit_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit_events_2026_06 PARTITION OF audit_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_events_2026_07 PARTITION OF audit_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE audit_events_2026_08 PARTITION OF audit_events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE audit_events_2026_09 PARTITION OF audit_events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE audit_events_2026_10 PARTITION OF audit_events
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE audit_events_2026_11 PARTITION OF audit_events
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE audit_events_2026_12 PARTITION OF audit_events
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- 2027 partitions (first half)
CREATE TABLE audit_events_2027_01 PARTITION OF audit_events
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE audit_events_2027_02 PARTITION OF audit_events
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE audit_events_2027_03 PARTITION OF audit_events
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE audit_events_2027_04 PARTITION OF audit_events
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE audit_events_2027_05 PARTITION OF audit_events
  FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');
CREATE TABLE audit_events_2027_06 PARTITION OF audit_events
  FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

-- Default partition for future dates
CREATE TABLE audit_events_future PARTITION OF audit_events
  FOR VALUES FROM ('2027-07-01') TO (MAXVALUE);

-- ============================================================================
-- PHASE 4: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX idx_audit_events_entity ON audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_events_actor ON audit_events (actor_id, created_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_events_type ON audit_events (event_type, created_at DESC);
CREATE INDEX idx_audit_events_category ON audit_events (event_category, created_at DESC);

-- Time-based indexes
CREATE INDEX idx_audit_events_occurred ON audit_events (occurred_at DESC);
CREATE INDEX idx_audit_events_request ON audit_events (request_id) WHERE request_id IS NOT NULL;

-- Full-text search on payload
CREATE INDEX idx_audit_events_payload_gin ON audit_events USING gin (payload jsonb_path_ops);

-- ============================================================================
-- PHASE 5: IMMUTABILITY RULES
-- ============================================================================

-- Prevent updates
CREATE RULE audit_events_no_update AS ON UPDATE TO audit_events
DO INSTEAD NOTHING;

-- Prevent deletes (except for GDPR compliance - admin only)
CREATE OR REPLACE FUNCTION check_audit_delete_permission()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow delete via explicit GDPR erasure function
  IF current_setting('app.audit_gdpr_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Direct deletion of audit_events is prohibited. Use gdpr_erase_user_data() function.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_events_prevent_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION check_audit_delete_permission();

-- ============================================================================
-- PHASE 6: HELPER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 Record audit event (main function)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_audit_event(
  p_event_type TEXT,
  p_event_category audit_event_category,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_payload JSONB DEFAULT '{}',
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_parent_entity_type TEXT DEFAULT NULL,
  p_parent_entity_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_event_id UUID;
BEGIN
  -- Get current user context
  v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
  v_actor_email := current_setting('app.current_user_email', true);
  v_actor_role := current_setting('app.current_user_role', true);

  INSERT INTO audit_events (
    event_type,
    event_category,
    actor_type,
    actor_id,
    actor_email,
    actor_role,
    entity_type,
    entity_id,
    entity_name,
    parent_entity_type,
    parent_entity_id,
    payload,
    old_values,
    new_values,
    request_id,
    ip_address,
    user_agent
  ) VALUES (
    p_event_type,
    p_event_category,
    CASE
      WHEN v_actor_id IS NOT NULL THEN 'user'::audit_actor_type
      WHEN current_setting('app.cron_job', true) = 'true' THEN 'cron'::audit_actor_type
      WHEN current_setting('app.webhook', true) = 'true' THEN 'webhook'::audit_actor_type
      ELSE 'system'::audit_actor_type
    END,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_parent_entity_type,
    p_parent_entity_id,
    p_payload,
    p_old_values,
    p_new_values,
    NULLIF(current_setting('app.request_id', true), '')::UUID,
    NULLIF(current_setting('app.ip_address', true), '')::INET,
    current_setting('app.user_agent', true)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_audit_event IS 'Records an audit event with full context (P4 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 6.2 Get entity history
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_entity_history(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  event_id UUID,
  event_type TEXT,
  event_category audit_event_category,
  actor_email TEXT,
  actor_role TEXT,
  payload JSONB,
  old_values JSONB,
  new_values JSONB,
  occurred_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    ae.event_type,
    ae.event_category,
    ae.actor_email,
    ae.actor_role,
    ae.payload,
    ae.old_values,
    ae.new_values,
    ae.occurred_at
  FROM audit_events ae
  WHERE ae.entity_type = p_entity_type
    AND ae.entity_id = p_entity_id
  ORDER BY ae.occurred_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_entity_history IS 'Retrieves audit history for a specific entity (P4 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 6.3 Get user activity
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_activity(
  p_user_id UUID,
  p_from_date TIMESTAMPTZ DEFAULT now() - interval '30 days',
  p_to_date TIMESTAMPTZ DEFAULT now(),
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  event_id UUID,
  event_type TEXT,
  event_category audit_event_category,
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  occurred_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    ae.event_type,
    ae.event_category,
    ae.entity_type,
    ae.entity_id,
    ae.entity_name,
    ae.occurred_at
  FROM audit_events ae
  WHERE ae.actor_id = p_user_id
    AND ae.occurred_at BETWEEN p_from_date AND p_to_date
  ORDER BY ae.occurred_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_user_activity IS 'Retrieves audit activity for a specific user (P4 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 6.4 GDPR data export
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gdpr_export_user_audit_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'exported_at', now(),
    'events', COALESCE(jsonb_agg(
      jsonb_build_object(
        'event_type', event_type,
        'entity_type', entity_type,
        'entity_id', entity_id,
        'payload', payload,
        'occurred_at', occurred_at
      ) ORDER BY occurred_at
    ), '[]'::jsonb)
  ) INTO v_result
  FROM audit_events
  WHERE actor_id = p_user_id;

  -- Record the export itself
  PERFORM record_audit_event(
    'gdpr.data_exported',
    'gdpr',
    'profile',
    p_user_id,
    jsonb_build_object('event_count', (v_result->'events')::jsonb)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION gdpr_export_user_audit_data IS 'Exports all audit data for a user (GDPR compliance)';

-- ----------------------------------------------------------------------------
-- 6.5 GDPR data erasure (pseudonymization)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gdpr_erase_user_data(p_user_id UUID, p_reason TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Enable delete permission
  PERFORM set_config('app.audit_gdpr_delete', 'true', true);

  -- Pseudonymize actor information in audit events
  UPDATE audit_events
  SET
    actor_email = 'GDPR_ERASED_' || substring(actor_id::text, 1, 8),
    actor_role = 'erased',
    payload = payload - 'email' - 'name' - 'phone' - 'address',
    ip_address = NULL,
    user_agent = NULL
  WHERE actor_id = p_user_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Record the erasure
  PERFORM record_audit_event(
    'gdpr.data_erased',
    'gdpr',
    'profile',
    p_user_id,
    jsonb_build_object(
      'reason', p_reason,
      'events_affected', v_count
    )
  );

  -- Reset delete permission
  PERFORM set_config('app.audit_gdpr_delete', 'false', true);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION gdpr_erase_user_data IS 'Pseudonymizes user data in audit events (GDPR compliance)';

-- ============================================================================
-- PHASE 7: AUTOMATIC AUDIT TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7.1 Generic audit trigger function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_category audit_event_category;
  v_entity_name TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Determine event type
  v_event_type := TG_TABLE_NAME || '.' || lower(TG_OP);

  -- Determine category based on table
  v_category := CASE TG_TABLE_NAME
    WHEN 'profiles' THEN 'auth'
    WHEN 'properties' THEN 'property'
    WHEN 'leases' THEN 'lease'
    WHEN 'signature_sessions' THEN 'signature'
    WHEN 'signature_participants' THEN 'signature'
    WHEN 'edl' THEN 'inspection'
    WHEN 'invoices' THEN 'financial'
    WHEN 'payments' THEN 'financial'
    WHEN 'tickets' THEN 'ticket'
    WHEN 'documents' THEN 'document'
    WHEN 'chat_messages' THEN 'communication'
    ELSE 'system'
  END;

  -- Build values based on operation
  IF TG_OP = 'DELETE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
    v_entity_name := COALESCE(
      OLD.name,
      OLD.titre,
      OLD.title,
      OLD.email,
      OLD.id::TEXT
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    v_entity_name := COALESCE(
      NEW.name,
      NEW.titre,
      NEW.title,
      NEW.email,
      NEW.id::TEXT
    );
  ELSE -- INSERT
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
    v_entity_name := COALESCE(
      NEW.name,
      NEW.titre,
      NEW.title,
      NEW.email,
      NEW.id::TEXT
    );
  END IF;

  -- Record the event
  PERFORM record_audit_event(
    v_event_type,
    v_category,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object('trigger', TG_NAME, 'operation', TG_OP),
    v_old_values,
    v_new_values,
    v_entity_name
  );

  -- Return appropriate row
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_trigger_function IS 'Generic trigger function for automatic audit logging (P4 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 7.2 Create audit triggers for main tables
-- ----------------------------------------------------------------------------

-- Properties
DROP TRIGGER IF EXISTS trg_audit_properties ON properties;
CREATE TRIGGER trg_audit_properties
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Leases
DROP TRIGGER IF EXISTS trg_audit_leases ON leases;
CREATE TRIGGER trg_audit_leases
  AFTER INSERT OR UPDATE OR DELETE ON leases
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Invoices
DROP TRIGGER IF EXISTS trg_audit_invoices ON invoices;
CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Payments
DROP TRIGGER IF EXISTS trg_audit_payments ON payments;
CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Signature sessions (P1)
DROP TRIGGER IF EXISTS trg_audit_signature_sessions ON signature_sessions;
CREATE TRIGGER trg_audit_signature_sessions
  AFTER INSERT OR UPDATE OR DELETE ON signature_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- EDL
DROP TRIGGER IF EXISTS trg_audit_edl ON edl;
CREATE TRIGGER trg_audit_edl
  AFTER INSERT OR UPDATE OR DELETE ON edl
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Tickets
DROP TRIGGER IF EXISTS trg_audit_tickets ON tickets;
CREATE TRIGGER trg_audit_tickets
  AFTER INSERT OR UPDATE OR DELETE ON tickets
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- PHASE 8: STATISTICS VIEWS
-- ============================================================================

-- Daily event summary
CREATE OR REPLACE VIEW v_audit_daily_stats AS
SELECT
  date_trunc('day', occurred_at) AS day,
  event_category,
  count(*) AS event_count,
  count(DISTINCT actor_id) AS unique_actors,
  count(DISTINCT entity_id) AS unique_entities
FROM audit_events
WHERE occurred_at > now() - interval '90 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

COMMENT ON VIEW v_audit_daily_stats IS 'Daily audit event statistics (P4 SOTA 2026)';

-- Event type distribution
CREATE OR REPLACE VIEW v_audit_event_distribution AS
SELECT
  event_type,
  event_category,
  count(*) AS total_count,
  count(*) FILTER (WHERE occurred_at > now() - interval '7 days') AS last_7_days,
  count(*) FILTER (WHERE occurred_at > now() - interval '30 days') AS last_30_days
FROM audit_events
GROUP BY event_type, event_category
ORDER BY total_count DESC;

COMMENT ON VIEW v_audit_event_distribution IS 'Audit event type distribution (P4 SOTA 2026)';

-- Recent high-impact events
CREATE OR REPLACE VIEW v_audit_recent_important AS
SELECT
  id,
  event_type,
  event_category,
  actor_email,
  entity_type,
  entity_id,
  entity_name,
  occurred_at
FROM audit_events
WHERE event_type IN (
  'lease.created',
  'lease.deleted',
  'payment.created',
  'signature_sessions.updated',
  'gdpr.data_exported',
  'gdpr.data_erased'
)
ORDER BY occurred_at DESC
LIMIT 100;

COMMENT ON VIEW v_audit_recent_important IS 'Recent high-impact audit events (P4 SOTA 2026)';

-- ============================================================================
-- PHASE 9: RLS POLICIES
-- ============================================================================

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Admins can see all events
CREATE POLICY audit_events_admin_all ON audit_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can see events they created
CREATE POLICY audit_events_own_events ON audit_events
  FOR SELECT
  TO authenticated
  USING (
    actor_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Users can see events for entities they own
CREATE POLICY audit_events_owned_entities ON audit_events
  FOR SELECT
  TO authenticated
  USING (
    -- Properties they own
    (entity_type = 'properties' AND entity_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    ))
    OR
    -- Leases they're part of
    (entity_type = 'leases' AND entity_id IN (
      SELECT id FROM leases WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    ))
  );

-- ============================================================================
-- PHASE 10: GRANTS
-- ============================================================================

-- Statistics views
GRANT SELECT ON v_audit_daily_stats TO authenticated;
GRANT SELECT ON v_audit_event_distribution TO authenticated;
GRANT SELECT ON v_audit_recent_important TO authenticated;

-- Functions
GRANT EXECUTE ON FUNCTION record_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION get_entity_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity TO authenticated;

-- GDPR functions (admin only)
REVOKE ALL ON FUNCTION gdpr_export_user_audit_data FROM PUBLIC;
REVOKE ALL ON FUNCTION gdpr_erase_user_data FROM PUBLIC;
-- Admin grant would be done separately

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE audit_events IS 'P4 SOTA 2026: Immutable event sourcing audit trail.

Features:
- Partitioned by month for performance
- Automatic event capture via triggers
- Full before/after state capture
- GDPR-compliant with export/erasure functions
- RLS policies for access control

Usage:
- Direct: INSERT into audit_events or use record_audit_event()
- Automatic: Triggers on main tables (properties, leases, invoices, etc.)
- Query: Use get_entity_history() or get_user_activity()
- Admin: v_audit_daily_stats, v_audit_event_distribution views

Event naming convention: {table}.{operation}
Examples: lease.created, payment.updated, signature_sessions.deleted';
