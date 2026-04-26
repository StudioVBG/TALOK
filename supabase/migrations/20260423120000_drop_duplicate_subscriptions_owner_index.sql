-- Drop the duplicate index on subscriptions.owner_id.
--
-- Two equivalent indexes were created over time:
--   - idx_subscriptions_owner      (2024-11-29 migration)
--   - idx_subscriptions_owner_id   (2026-01 migration)
--
-- Both are plain btree indexes on (owner_id) with no partial filter and no
-- differing opclass, so keeping both only costs extra writes on every
-- INSERT/UPDATE of the subscriptions table without any read benefit.
-- We keep the older one (`idx_subscriptions_owner`) since it predates the
-- duplicate.

DROP INDEX IF EXISTS idx_subscriptions_owner_id;
