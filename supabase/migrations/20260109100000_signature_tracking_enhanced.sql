-- Migration: Amélioration du tracking des signatures
-- Date: 2026-01-09
-- Description: Vue agrégée et fonctions pour le suivi des signatures mensuelles
-- Compatible avec subscription_usage existante

BEGIN;

-- ============================================
-- VUE AGRÉGÉE: Signatures par mois et subscription
-- ============================================

CREATE OR REPLACE VIEW signature_usage_monthly AS
SELECT
  su.subscription_id,
  su.period_month,
  COALESCE(SUM(su.quantity), 0)::INTEGER as signatures_used,
  COUNT(*)::INTEGER as signature_events,
  MAX(su.created_at) as last_signature_at
FROM subscription_usage su
WHERE su.usage_type = 'signature'
GROUP BY su.subscription_id, su.period_month;

-- ============================================
-- FONCTION: Obtenir usage signatures du mois courant
-- ============================================

CREATE OR REPLACE FUNCTION get_signature_usage(p_subscription_id UUID)
RETURNS TABLE (
  signatures_used INTEGER,
  signatures_limit INTEGER,
  signatures_remaining INTEGER,
  usage_percentage INTEGER,
  period_month TEXT,
  last_signature_at TIMESTAMPTZ
) AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
  v_last_at TIMESTAMPTZ;
BEGIN
  -- Récupérer l'usage du mois courant
  SELECT
    COALESCE(SUM(quantity), 0)::INTEGER,
    MAX(created_at)
  INTO v_used, v_last_at
  FROM subscription_usage
  WHERE subscription_id = p_subscription_id
    AND usage_type = 'signature'
    AND period_month = v_current_month;

  -- Récupérer la limite du plan
  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  -- Si pas de limite trouvée, utiliser 0
  v_limit := COALESCE(v_limit, 0);
  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    v_used,
    v_limit,
    CASE WHEN v_limit = -1 THEN 999999 ELSE GREATEST(0, v_limit - v_used) END,
    CASE
      WHEN v_limit = -1 THEN 0
      WHEN v_limit = 0 THEN 100
      ELSE LEAST(100, (v_used * 100) / NULLIF(v_limit, 0))
    END::INTEGER,
    v_current_month,
    v_last_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- FONCTION: Incrémenter l'usage des signatures
-- ============================================

CREATE OR REPLACE FUNCTION increment_signature_usage(
  p_subscription_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Vérifier la limite avant d'incrémenter
  SELECT
    COALESCE(SUM(quantity), 0)::INTEGER
  INTO v_used
  FROM subscription_usage
  WHERE subscription_id = p_subscription_id
    AND usage_type = 'signature'
    AND period_month = v_current_month;

  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  -- Si limite atteinte et pas illimité, retourner false
  IF v_limit != -1 AND (COALESCE(v_used, 0) + p_quantity) > v_limit THEN
    RETURN false;
  END IF;

  -- Insérer l'usage
  INSERT INTO subscription_usage (
    subscription_id,
    usage_type,
    quantity,
    period_month,
    metadata
  ) VALUES (
    p_subscription_id,
    'signature',
    p_quantity,
    v_current_month,
    p_metadata
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FONCTION: Vérifier si une signature est possible
-- ============================================

CREATE OR REPLACE FUNCTION can_use_signature(p_subscription_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Récupérer l'usage actuel
  SELECT COALESCE(SUM(quantity), 0)::INTEGER
  INTO v_used
  FROM subscription_usage
  WHERE subscription_id = p_subscription_id
    AND usage_type = 'signature'
    AND period_month = v_current_month;

  -- Récupérer la limite
  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  -- -1 = illimité
  IF v_limit = -1 THEN
    RETURN true;
  END IF;

  RETURN v_used < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- FONCTION: Obtenir usage par owner_id (plus pratique)
-- ============================================

CREATE OR REPLACE FUNCTION get_signature_usage_by_owner(p_owner_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  signatures_used INTEGER,
  signatures_limit INTEGER,
  signatures_remaining INTEGER,
  usage_percentage INTEGER,
  period_month TEXT,
  last_signature_at TIMESTAMPTZ,
  can_sign BOOLEAN
) AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  -- Trouver la subscription de ce owner
  SELECT id INTO v_sub_id
  FROM subscriptions
  WHERE owner_id = p_owner_id
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    -- Pas de subscription, retourner des valeurs par défaut (plan gratuit)
    RETURN QUERY SELECT
      NULL::UUID,
      0::INTEGER,
      0::INTEGER,  -- Plan gratuit = 0 signatures incluses
      0::INTEGER,
      0::INTEGER,
      TO_CHAR(NOW(), 'YYYY-MM'),
      NULL::TIMESTAMPTZ,
      false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_sub_id,
    su.signatures_used,
    su.signatures_limit,
    su.signatures_remaining,
    su.usage_percentage,
    su.period_month,
    su.last_signature_at,
    (su.signatures_limit = -1 OR su.signatures_used < su.signatures_limit)
  FROM get_signature_usage(v_sub_id) su;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- INDEX pour performances
-- ============================================

CREATE INDEX IF NOT EXISTS idx_subscription_usage_signatures
  ON subscription_usage(subscription_id, period_month)
  WHERE usage_type = 'signature';

-- ============================================
-- MISE À JOUR subscription_plans: ajouter signatures_monthly_quota si manquant
-- ============================================

-- Mettre à jour les plans pour avoir signatures_monthly_quota dans features
UPDATE subscription_plans
SET features = features || jsonb_build_object('signatures_monthly_quota',
  CASE slug
    WHEN 'gratuit' THEN 0
    WHEN 'starter' THEN 0
    WHEN 'confort' THEN 2
    WHEN 'pro' THEN 10
    WHEN 'enterprise_s' THEN 25
    WHEN 'enterprise_m' THEN 40
    WHEN 'enterprise_l' THEN 60
    WHEN 'enterprise_xl' THEN -1
    WHEN 'enterprise' THEN -1
    ELSE 0
  END
)
WHERE NOT (features ? 'signatures_monthly_quota');

COMMIT;
