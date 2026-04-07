-- Migration: Audit fixes — missing indexes, CHECK constraints, and RLS
-- Idempotent: safe to run multiple times

-- 1. Missing index on sepa_mandates.owner_profile_id
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_owner ON sepa_mandates(owner_profile_id);

-- 2. CHECK constraints on status columns
DO $$ BEGIN
  ALTER TABLE reconciliation_matches
    ADD CONSTRAINT chk_reconciliation_matches_status
    CHECK (status IN ('pending','matched','disputed','resolved'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payment_schedules
    ADD CONSTRAINT chk_payment_schedules_status
    CHECK (status IN ('pending','active','paused','completed','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE receipt_stubs
    ADD CONSTRAINT chk_receipt_stubs_status
    CHECK (status IN ('signed','cancelled','archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE subscriptions
    ADD CONSTRAINT chk_subscriptions_status
    CHECK (status IN ('trialing','active','past_due','canceled','incomplete','paused'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE visit_slots
    ADD CONSTRAINT chk_visit_slots_status
    CHECK (status IN ('available','booked','cancelled','completed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE visit_bookings
    ADD CONSTRAINT chk_visit_bookings_status
    CHECK (status IN ('pending','confirmed','cancelled','no_show','completed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Enable RLS on lease_notices (idempotent — ENABLE is a no-op if already on)
ALTER TABLE IF EXISTS lease_notices ENABLE ROW LEVEL SECURITY;
