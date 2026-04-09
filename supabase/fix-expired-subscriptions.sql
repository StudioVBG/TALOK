-- ==========================================================
-- Script de nettoyage des abonnements expirés
-- A appliquer MANUELLEMENT par Thomas sur Supabase Dashboard
-- Date: 2026-04-09
-- ==========================================================

-- IMPORTANT: Exécuter chaque section séparément et vérifier les résultats

-- ──────────────────────────────────────────────
-- 1. DIAGNOSTIC : état actuel des abonnements
-- ──────────────────────────────────────────────

-- 1a. Compter les abonnements par statut
SELECT status, COUNT(*) as total
FROM subscriptions
GROUP BY status
ORDER BY total DESC;

-- 1b. Abonnements "active" sans stripe_subscription_id
SELECT id, owner_id, status, plan_id, current_period_end, stripe_subscription_id, stripe_customer_id
FROM subscriptions
WHERE status = 'active'
  AND stripe_subscription_id IS NULL
ORDER BY current_period_end ASC;

-- 1c. Abonnements avec current_period_end dans le passé mais toujours "active"
SELECT id, owner_id, status, plan_id, current_period_end, stripe_subscription_id
FROM subscriptions
WHERE status = 'active'
  AND current_period_end IS NOT NULL
  AND current_period_end < NOW()
ORDER BY current_period_end ASC;

-- 1d. Abonnements sans aucun lien Stripe (ni customer ni subscription)
SELECT id, owner_id, status, plan_id, created_at, current_period_end
FROM subscriptions
WHERE stripe_subscription_id IS NULL
  AND stripe_customer_id IS NULL
ORDER BY created_at DESC;

-- ──────────────────────────────────────────────
-- 2. FIX : Expirer les abonnements fantômes
-- ──────────────────────────────────────────────

-- 2a. Récupérer le plan_id du plan gratuit
-- (adapter le WHERE selon le nom exact dans subscription_plans)
SELECT id, slug, name FROM subscription_plans WHERE slug = 'gratuit' OR slug = 'free' LIMIT 1;

-- 2b. DRY RUN — voir ce qui serait modifié (NE MODIFIE RIEN)
SELECT
  s.id,
  s.owner_id,
  s.status as old_status,
  'expired' as new_status,
  s.plan_id as old_plan_id,
  s.current_period_end,
  s.stripe_subscription_id,
  p.slug as current_plan_slug
FROM subscriptions s
LEFT JOIN subscription_plans p ON s.plan_id = p.id
WHERE s.status = 'active'
  AND s.stripe_subscription_id IS NULL
  AND (
    s.current_period_end IS NULL
    OR s.current_period_end < NOW()
  );

-- 2c. APPLIQUER LE FIX — Expirer les abos sans Stripe et période dépassée
-- ⚠️  DECOMMENTER POUR EXECUTER
/*
UPDATE subscriptions
SET
  status = 'expired',
  updated_at = NOW()
WHERE status = 'active'
  AND stripe_subscription_id IS NULL
  AND (
    current_period_end IS NULL
    OR current_period_end < NOW()
  );
*/

-- ──────────────────────────────────────────────
-- 3. VERIFICATION post-fix
-- ──────────────────────────────────────────────

-- 3a. Re-compter par statut
SELECT status, COUNT(*) as total
FROM subscriptions
GROUP BY status
ORDER BY total DESC;

-- 3b. Vérifier : aucun abo "active" ne devrait avoir stripe_subscription_id NULL
-- (sauf les trials en cours)
SELECT id, owner_id, status, plan_id, current_period_end, trial_end
FROM subscriptions
WHERE status = 'active'
  AND stripe_subscription_id IS NULL
  AND (trial_end IS NULL OR trial_end < NOW());

-- ──────────────────────────────────────────────
-- 4. BONUS : Identifier les users potentiellement impactés
-- ──────────────────────────────────────────────

-- Users avec abo expiré qui pourraient penser avoir un plan payant
SELECT
  s.id as subscription_id,
  s.owner_id,
  s.status,
  p.slug as plan_slug,
  p.name as plan_name,
  pr.nom,
  pr.prenom,
  pr.email,
  s.current_period_end,
  s.canceled_at
FROM subscriptions s
LEFT JOIN subscription_plans p ON s.plan_id = p.id
LEFT JOIN profiles pr ON s.owner_id = pr.id
WHERE s.status IN ('expired', 'canceled')
  AND p.slug != 'gratuit'
ORDER BY s.current_period_end DESC
LIMIT 50;
