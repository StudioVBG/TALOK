-- =====================================================
-- Migration: Fix subscription plan prices to match official pricing grid
-- Date: 2026-04-08
-- Description:
--   Ensures subscription_plans prices match the official Talok pricing:
--   - Gratuit: 0€/mois
--   - Starter: 9€/mois (900 centimes)
--   - Confort: 35€/mois (3500 centimes)
--   - Pro: 69€/mois (6900 centimes)
--   - Enterprise S: 249€/mois (24900 centimes)
--   Idempotent — safe to run multiple times.
-- =====================================================

BEGIN;

UPDATE subscription_plans SET price_monthly = 0, price_yearly = 0
WHERE slug = 'gratuit' AND price_monthly != 0;

UPDATE subscription_plans SET price_monthly = 900, price_yearly = 9000
WHERE slug = 'starter' AND price_monthly != 900;

UPDATE subscription_plans SET price_monthly = 3500, price_yearly = 35000
WHERE slug = 'confort' AND price_monthly != 3500;

UPDATE subscription_plans SET price_monthly = 6900, price_yearly = 69000
WHERE slug = 'pro' AND price_monthly != 6900;

UPDATE subscription_plans SET price_monthly = 24900, price_yearly = 249000
WHERE slug = 'enterprise_s' AND price_monthly != 24900;

COMMIT;
