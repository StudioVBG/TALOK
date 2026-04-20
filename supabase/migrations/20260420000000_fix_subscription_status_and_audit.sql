-- Migration: add 'suspended' status to subscriptions + create admin_subscription_actions audit table

-- 1. Add 'suspended' to the status CHECK constraint
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'suspended', 'incomplete'));

-- Migrate any existing 'paused' rows to 'suspended' for consistency with the UI
UPDATE subscriptions SET status = 'suspended' WHERE status = 'paused';

-- 2. Create admin_subscription_actions audit table
CREATE TABLE IF NOT EXISTS admin_subscription_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('plan_override', 'gift_days', 'suspend', 'unsuspend')),
  from_plan TEXT,
  to_plan TEXT,
  gift_days INTEGER,
  reason TEXT NOT NULL,
  notify_user BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sub_actions_admin ON admin_subscription_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sub_actions_target ON admin_subscription_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sub_actions_type ON admin_subscription_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_sub_actions_created ON admin_subscription_actions(created_at DESC);

-- RLS: only admins can read/write
ALTER TABLE admin_subscription_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_sub_actions_admin_all" ON admin_subscription_actions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'platform_admin')
    )
  );
