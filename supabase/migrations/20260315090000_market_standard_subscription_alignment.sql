BEGIN;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS selected_plan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS selected_plan_source TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_plan_id UUID REFERENCES subscription_plans(id),
  ADD COLUMN IF NOT EXISTS scheduled_plan_slug TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_plan_effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_subscription_schedule_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_selected_plan_at
  ON subscriptions(selected_plan_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_scheduled_plan_effective_at
  ON subscriptions(scheduled_plan_effective_at)
  WHERE scheduled_plan_effective_at IS NOT NULL;

UPDATE subscriptions s
SET plan_id = sp.id
FROM subscription_plans sp
WHERE s.plan_id IS NULL
  AND s.plan_slug IS NOT NULL
  AND sp.slug = s.plan_slug;

UPDATE subscriptions s
SET plan_slug = sp.slug
FROM subscription_plans sp
WHERE s.plan_slug IS NULL
  AND s.plan_id IS NOT NULL
  AND sp.id = s.plan_id;

UPDATE subscriptions
SET status = 'paused'
WHERE status = 'suspended';

UPDATE subscriptions
SET selected_plan_at = COALESCE(current_period_start, updated_at, created_at),
    selected_plan_source = CASE
      WHEN stripe_subscription_id IS NOT NULL THEN COALESCE(selected_plan_source, 'backfill_stripe')
      ELSE COALESCE(selected_plan_source, 'backfill_local')
    END
WHERE selected_plan_at IS NULL
   OR selected_plan_source IS NULL;

UPDATE subscriptions
SET scheduled_plan_id = NULL,
    scheduled_plan_slug = NULL,
    scheduled_plan_effective_at = NULL,
    stripe_subscription_schedule_id = NULL
WHERE scheduled_plan_effective_at IS NOT NULL
  AND scheduled_plan_effective_at < NOW() - INTERVAL '7 days';

UPDATE subscriptions s
SET scheduled_plan_id = sp.id
FROM subscription_plans sp
WHERE s.scheduled_plan_id IS NULL
  AND s.scheduled_plan_slug IS NOT NULL
  AND sp.slug = s.scheduled_plan_slug;

UPDATE subscriptions s
SET scheduled_plan_slug = sp.slug
FROM subscription_plans sp
WHERE s.scheduled_plan_slug IS NULL
  AND s.scheduled_plan_id IS NOT NULL
  AND sp.id = s.scheduled_plan_id;

UPDATE subscriptions
SET properties_count = property_counts.count_value
FROM (
  SELECT owner_id, COUNT(*)::INT AS count_value
  FROM properties
  WHERE deleted_at IS NULL
  GROUP BY owner_id
) AS property_counts
WHERE subscriptions.owner_id = property_counts.owner_id;

UPDATE subscriptions
SET properties_count = 0
WHERE properties_count IS NULL;

COMMIT;
