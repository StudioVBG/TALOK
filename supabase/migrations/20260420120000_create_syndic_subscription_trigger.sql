-- =====================================================
-- Migration: Auto-création de l'abonnement Syndic
--
-- Problème corrigé (P0 — audit du 2026-04-20) :
-- Aucun trigger ne crée d'abonnement pour les nouveaux syndics.
-- Conséquence : SyndicPlanBanner bloque 100 % du namespace /syndic/**
-- car `plan_slug IS NULL` → la bannière considère l'utilisateur comme
-- "plan gratuit" (sans `copro_module`) et masque le dashboard.
--
-- Fix :
-- 1. Nouveau trigger `create_syndic_subscription()` qui crée une
--    subscription `trialing` 30 jours sur le plan `confort`
--    (1er plan avec `copro_module: true` → accès immédiat au module).
-- 2. Backfill idempotent pour les syndics orphelins existants.
--
-- Modèle emprunté à `create_owner_subscription()`
-- (migrations 20251204600000 + 20260312000001).
-- =====================================================

-- =====================================================
-- 1. Fonction create_syndic_subscription()
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_syndic_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_trial_end TIMESTAMPTZ := NOW() + INTERVAL '30 days';
BEGIN
  IF NEW.role IS DISTINCT FROM 'syndic' THEN
    RETURN NEW;
  END IF;

  -- Plan Confort = premier plan avec copro_module = true
  -- (cf. lib/subscriptions/plans.ts:355 + skill talok-stripe-pricing §3.2)
  SELECT id INTO v_plan_id
  FROM subscription_plans
  WHERE slug = 'confort' AND is_active = true
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE WARNING 'Plan confort introuvable — abonnement syndic non créé pour %', NEW.id;
    RETURN NEW;
  END IF;

  -- Idempotent : ne fait rien si une subscription existe déjà
  IF EXISTS (SELECT 1 FROM subscriptions WHERE owner_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO subscriptions (
    owner_id,
    plan_id,
    plan_slug,
    status,
    billing_cycle,
    current_period_start,
    current_period_end,
    trial_start,
    trial_end,
    properties_count,
    leases_count,
    tenants_count,
    documents_size_mb,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_plan_id,
    'confort',
    'trialing',
    'monthly',
    v_now,
    v_trial_end,
    v_now,
    v_trial_end,
    0, 0, 0, 0,
    v_now,
    v_now
  )
  ON CONFLICT (owner_id) DO NOTHING;

  RAISE NOTICE 'Abonnement Confort (trialing 30j) créé pour syndic %', NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur création abonnement syndic %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.create_syndic_subscription() IS
  'Crée automatiquement un abonnement Confort en essai 30 jours pour chaque nouveau syndic. Débloque immédiatement copro_module et le namespace /syndic/**.';

-- =====================================================
-- 2. Trigger AFTER INSERT OR UPDATE OF role ON profiles
-- =====================================================

DROP TRIGGER IF EXISTS trg_create_syndic_subscription ON profiles;
CREATE TRIGGER trg_create_syndic_subscription
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'syndic')
  EXECUTE FUNCTION public.create_syndic_subscription();

-- =====================================================
-- 3. Backfill — syndics orphelins existants
-- =====================================================

DO $$
DECLARE
  v_plan_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_trial_end TIMESTAMPTZ := NOW() + INTERVAL '30 days';
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_plan_id
  FROM subscription_plans
  WHERE slug = 'confort' AND is_active = true
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE NOTICE 'Plan confort introuvable — backfill syndic ignoré';
    RETURN;
  END IF;

  INSERT INTO subscriptions (
    owner_id, plan_id, plan_slug, status, billing_cycle,
    current_period_start, current_period_end,
    trial_start, trial_end,
    properties_count, leases_count, tenants_count, documents_size_mb,
    created_at, updated_at
  )
  SELECT
    p.id,
    v_plan_id,
    'confort',
    'trialing',
    'monthly',
    v_now, v_trial_end,
    v_now, v_trial_end,
    0, 0, 0, 0,
    v_now, v_now
  FROM profiles p
  WHERE p.role = 'syndic'
    AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.owner_id = p.id)
  ON CONFLICT (owner_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE '% abonnement(s) Confort (trialing) backfillé(s) pour syndics orphelins', v_count;
  END IF;
END $$;
