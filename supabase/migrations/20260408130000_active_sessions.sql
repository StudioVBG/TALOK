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
