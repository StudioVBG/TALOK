-- Migration: Mise à jour période d'essai de 14 à 30 jours (1er mois offert)
-- Date: 2025-12-04

-- ============================================
-- 1. Ajouter les colonnes trial_days et cta_text si elles n'existent pas
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'trial_days') THEN
    ALTER TABLE subscription_plans ADD COLUMN trial_days INTEGER DEFAULT 14;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'cta_text') THEN
    ALTER TABLE subscription_plans ADD COLUMN cta_text TEXT;
  END IF;
END$$;

-- Mettre à jour trial_days dans subscription_plans
UPDATE subscription_plans
SET 
  trial_days = 30,
  cta_text = '1er mois offert',
  updated_at = NOW()
WHERE slug IN ('starter', 'confort', 'pro');

-- Plan Enterprise garde 30 jours aussi
UPDATE subscription_plans
SET 
  trial_days = 30,
  updated_at = NOW()
WHERE slug = 'enterprise';

-- ============================================
-- 2. Mettre à jour les triggers de création d'abonnement
-- ============================================

-- Fonction de création d'abonnement avec 30 jours d'essai
CREATE OR REPLACE FUNCTION public.create_owner_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_trial_end TIMESTAMPTZ := NOW() + INTERVAL '30 days';  -- 1 mois offert
BEGIN
  -- Seulement pour les propriétaires
  IF NEW.role != 'owner' THEN
    RETURN NEW;
  END IF;
  
  -- Récupérer le plan Starter par défaut
  SELECT id INTO v_plan_id
  FROM subscription_plans
  WHERE slug = 'starter' AND is_active = true
  LIMIT 1;
  
  IF v_plan_id IS NULL THEN
    RAISE WARNING 'Plan starter non trouvé, abonnement non créé';
    RETURN NEW;
  END IF;
  
  -- Vérifier si un abonnement existe déjà
  IF EXISTS (SELECT 1 FROM subscriptions WHERE owner_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  -- Créer l'abonnement en période d'essai (1 mois offert)
  INSERT INTO subscriptions (
    owner_id,
    plan_id,
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
    'trialing',  -- Essai gratuit 30 jours (1er mois offert)
    'monthly',
    v_now,
    v_trial_end,
    v_now,
    v_trial_end,
    0,
    0,
    0,
    0,
    v_now,
    v_now
  );
  
  RAISE NOTICE 'Abonnement Starter (1er mois offert) créé pour le propriétaire %', NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur création abonnement pour %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ============================================
-- 3. Mise à jour des abonnements existants en trialing (optionnel)
-- ============================================

-- Étendre la période d'essai des abonnements récents (créés dans les 14 derniers jours)
-- qui n'ont pas encore été convertis
UPDATE subscriptions
SET 
  trial_end = trial_start + INTERVAL '30 days',
  current_period_end = trial_start + INTERVAL '30 days',
  updated_at = NOW()
WHERE 
  status = 'trialing'
  AND trial_start > NOW() - INTERVAL '14 days'
  AND stripe_subscription_id IS NULL;  -- Pas encore lié à Stripe

COMMENT ON FUNCTION public.create_owner_subscription() IS 
'Crée automatiquement un abonnement Starter avec 1er mois offert pour chaque nouveau propriétaire';

