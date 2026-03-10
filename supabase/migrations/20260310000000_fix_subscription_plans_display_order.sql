-- =====================================================
-- Migration: Fix display_order des plans d'abonnement
-- Date: 2026-03-10
-- Description:
--   - Corrige display_order du plan Gratuit (-1 → 0)
--   - Réordonne tous les plans avec des valeurs séquentielles
-- =====================================================

BEGIN;

UPDATE subscription_plans SET display_order = 0, updated_at = NOW() WHERE slug = 'gratuit';
UPDATE subscription_plans SET display_order = 1, updated_at = NOW() WHERE slug = 'starter';
UPDATE subscription_plans SET display_order = 2, updated_at = NOW() WHERE slug = 'confort';
UPDATE subscription_plans SET display_order = 3, updated_at = NOW() WHERE slug = 'pro';
UPDATE subscription_plans SET display_order = 4, updated_at = NOW() WHERE slug = 'enterprise_s';
UPDATE subscription_plans SET display_order = 5, updated_at = NOW() WHERE slug = 'enterprise_m';
UPDATE subscription_plans SET display_order = 6, updated_at = NOW() WHERE slug = 'enterprise_l';
UPDATE subscription_plans SET display_order = 7, updated_at = NOW() WHERE slug = 'enterprise_xl';
UPDATE subscription_plans SET display_order = 99, updated_at = NOW() WHERE slug = 'enterprise';

COMMIT;
