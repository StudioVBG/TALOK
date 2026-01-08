-- Migration: Grille tarifaire unifiée 2025
-- Date: 2024-12-04
-- Description: Nettoie les anciens plans et crée la nouvelle grille
--
-- PLANS:
--   - starter: 9€/mois (3 biens)
--   - confort: 29€/mois (10 biens) - LE PLUS POPULAIRE
--   - pro: 59€/mois (50 biens)
--   - enterprise: Sur devis (illimité)

BEGIN;

-- ============================================
-- ÉTAPE 1: Nettoyer les anciens plans
-- ============================================

-- Supprimer les plans obsolètes (garde les abonnements existants via cascade ou migration)
DELETE FROM subscription_plans 
WHERE slug IN ('free', 'gratuit', 'solo', 'starter', 'business')
AND slug NOT IN ('starter', 'confort', 'pro', 'enterprise');

-- ============================================
-- ÉTAPE 2: Upsert des nouveaux plans
-- ============================================

-- STARTER - 9€/mois
INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'starter',
  'Starter',
  'Idéal pour gérer jusqu''à 3 biens en toute simplicité',
  900, 9000,  -- 9€/mois, 90€/an
  3, 5, 10, 1,
  '{
    "signatures": false,
    "open_banking": false,
    "bank_reconciliation": false,
    "auto_reminders": false,
    "auto_reminders_sms": false,
    "irl_revision": false,
    "tenant_portal": "basic",
    "tenant_payment_online": false,
    "lease_generation": true,
    "colocation": false,
    "multi_users": false,
    "work_orders": false,
    "providers_management": false,
    "owner_reports": false,
    "api_access": false,
    "scoring_tenant": false,
    "edl_digital": false
  }'::jsonb,
  true, false, 0
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- CONFORT - 29€/mois (LE PLUS POPULAIRE)
INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'confort',
  'Confort',
  'Pour les propriétaires actifs avec plusieurs biens',
  2900, 29000,  -- 29€/mois, 290€/an
  10, 25, 40, 5,
  '{
    "signatures": true,
    "signatures_monthly_quota": 5,
    "open_banking": true,
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": false,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "advanced",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": false,
    "work_orders": true,
    "providers_management": false,
    "owner_reports": true,
    "api_access": false,
    "scoring_tenant": true,
    "edl_digital": true
  }'::jsonb,
  true, true, 1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- PRO - 59€/mois
INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'pro',
  'Pro',
  'Le plan idéal pour les gestionnaires et SCI',
  5900, 59000,  -- 59€/mois, 590€/an
  50, -1, -1, 20,  -- -1 = illimité
  '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 5,
    "work_orders": true,
    "providers_management": true,
    "owner_reports": true,
    "api_access": true,
    "scoring_tenant": true,
    "edl_digital": true,
    "included_properties": 50,
    "extra_property_price": 100
  }'::jsonb,
  true, false, 2
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE - Sur devis
INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise',
  'Enterprise',
  'Solution sur-mesure : white label, API complète, SLA',
  0, 0,  -- Sur devis (0 = contact sales)
  -1, -1, -1, -1,  -- Tout illimité
  '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "work_orders": true,
    "providers_management": true,
    "owner_reports": true,
    "api_access": true,
    "webhooks": true,
    "white_label": true,
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, false, 3
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================
-- ÉTAPE 3: Migrer les abonnements existants
-- ============================================

-- Migrer les anciens plans vers les nouveaux
-- gratuit/free/solo → starter
UPDATE subscriptions 
SET plan_id = (SELECT id FROM subscription_plans WHERE slug = 'starter')
WHERE plan_id IN (
  SELECT id FROM subscription_plans WHERE slug IN ('free', 'gratuit', 'solo')
);

-- Mettre à jour plan_slug si la colonne existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'plan_slug'
  ) THEN
    UPDATE subscriptions SET plan_slug = 'starter' 
    WHERE plan_slug IN ('free', 'gratuit', 'solo');
    
    UPDATE subscriptions SET plan_slug = 'confort' 
    WHERE plan_slug = 'confort';
    
    UPDATE subscriptions SET plan_slug = 'pro' 
    WHERE plan_slug IN ('pro', 'business');
  END IF;
END $$;

-- ============================================
-- ÉTAPE 4: Mettre à jour le trigger auto-subscription
-- ============================================

-- Fonction pour créer l'abonnement starter automatiquement
CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Seulement pour les propriétaires
  IF NEW.role = 'owner' THEN
    -- Récupérer l'ID du plan starter
    SELECT id INTO v_plan_id 
    FROM subscription_plans 
    WHERE slug = 'starter' 
    LIMIT 1;
    
    -- Créer l'abonnement si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id, 
        plan_id, 
        status, 
        billing_cycle, 
        current_period_start,
        current_period_end,
        trial_end,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'trialing',  -- Essai gratuit 14 jours
        'monthly',
        NOW(),
        NOW() + INTERVAL '14 days',
        NOW() + INTERVAL '14 days',
        0,
        0
      )
      ON CONFLICT (owner_id) DO NOTHING;
      
      RAISE NOTICE 'Abonnement Talok Starter (essai) créé pour le propriétaire %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer le trigger
DROP TRIGGER IF EXISTS trg_create_owner_subscription ON profiles;
CREATE TRIGGER trg_create_owner_subscription
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'owner')
  EXECUTE FUNCTION create_owner_subscription();

-- ============================================
-- ÉTAPE 5: Nettoyer les anciens plans inutilisés
-- ============================================

-- Supprimer les anciens plans qui n'ont plus d'abonnements
DELETE FROM subscription_plans 
WHERE slug IN ('free', 'gratuit', 'solo', 'business')
AND NOT EXISTS (
  SELECT 1 FROM subscriptions WHERE plan_id = subscription_plans.id
);

-- ============================================
-- ÉTAPE 6: Créer abonnements manquants
-- ============================================

-- Pour les propriétaires existants sans abonnement
DO $$
DECLARE
  v_plan_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_plan_id FROM subscription_plans WHERE slug = 'starter' LIMIT 1;
  
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      owner_id, plan_id, status, billing_cycle, 
      current_period_start, current_period_end, trial_end,
      properties_count, leases_count
    )
    SELECT 
      p.id,
      v_plan_id,
      'trialing',
      'monthly',
      NOW(),
      NOW() + INTERVAL '14 days',
      NOW() + INTERVAL '14 days',
      COALESCE((SELECT COUNT(*) FROM properties WHERE owner_id = p.id), 0),
      0
    FROM profiles p
    WHERE p.role = 'owner'
    AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.owner_id = p.id)
    ON CONFLICT (owner_id) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '% abonnement(s) Starter créé(s)', v_count;
  END IF;
END $$;

COMMIT;

