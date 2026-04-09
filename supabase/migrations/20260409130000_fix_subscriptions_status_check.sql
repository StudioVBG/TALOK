-- =====================================================
-- MIGRATION: Add 'expired' status to subscriptions CHECK constraint
-- Date: 2026-04-09
-- Problem: Application code sets status='expired' for expired trials,
--          but the CHECK constraint only allows:
--          'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete'
--          This causes silent write failures (fire-and-forget updates fail).
-- Solution: Drop old constraint, add new one including 'expired' and 'suspended'.
-- =====================================================

-- Drop the existing CHECK constraint on status
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;

-- Recreate with all valid statuses
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid',
    'paused', 'incomplete', 'expired', 'suspended'
  ));

-- Verification
DO $$
BEGIN
  RAISE NOTICE '=== Migration: subscriptions status CHECK updated (added expired, suspended) ===';
END $$;
