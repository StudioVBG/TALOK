-- =====================================================
-- Migration: Create cron_logs table for admin monitoring
-- =====================================================

CREATE TABLE IF NOT EXISTS cron_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cron_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error', 'running')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cron_logs_name ON cron_logs(cron_name);
CREATE INDEX idx_cron_logs_started ON cron_logs(started_at DESC);

-- RLS
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read cron_logs"
  ON cron_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'platform_admin')
    )
  );

CREATE POLICY "Service role can insert cron_logs"
  ON cron_logs FOR INSERT
  WITH CHECK (true);
