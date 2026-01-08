-- Migration: Grille tarifaire Enterprise optimisée
-- Date: 2024-12-06
-- Description: Ajoute les 4 tiers Enterprise avec tarification par volume
--
-- NOUVELLE GRILLE ENTERPRISE (3 options combinées):
--   - enterprise_s: 199€/mois (50-100 biens) - 20 signatures incluses
--   - enterprise_m: 299€/mois (100-200 biens) - 30 signatures + White label basic
--   - enterprise_l: 449€/mois (200-500 biens) - 50 signatures + AM partagé ⭐
--   - enterprise_xl: 699€/mois (500+ biens) - Signatures illimitées + AM dédié
--
-- MISE À JOUR DES PLANS EXISTANTS:
--   - gratuit: 0€ (1 bien) - Nouveau plan d'acquisition
--   - starter: 9€/mois - 0 signature incluse, paiement en ligne
--   - confort: 29€/mois - 1 signature/mois incluse (au lieu de 5)
--   - pro: 59€/mois - 5 signatures/mois (au lieu de illimité)

BEGIN;

-- ============================================
-- ÉTAPE 1: Ajouter le plan GRATUIT
-- ============================================

INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'gratuit',
  'Gratuit',
  'Découvrez Talok et simplifiez la gestion de votre premier bien',
  0, 0,  -- Gratuit
  1, 1, 2, 0.1,  -- 1 bien, 100 Mo
  '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "signature_price": 590,
    "open_banking": false,
    "bank_reconciliation": false,
    "auto_reminders": false,
    "auto_reminders_sms": false,
    "irl_revision": false,
    "tenant_portal": "basic",
    "tenant_payment_online": false,
    "payment_fees_cb": 0,
    "payment_fees_sepa": 0,
    "lease_generation": true,
    "colocation": false,
    "multi_users": false,
    "work_orders": false,
    "providers_management": false,
    "owner_reports": false,
    "api_access": false,
    "scoring_tenant": false,
    "edl_digital": false,
    "gli_discount": 0,
    "included_properties": 1,
    "extra_property_price": 0
  }'::jsonb,
  true, false, -1
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
-- ÉTAPE 2: Mettre à jour STARTER avec paiements
-- ============================================

UPDATE subscription_plans SET
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "signature_price": 490,
    "open_banking": false,
    "bank_reconciliation": false,
    "auto_reminders": "email_basic",
    "auto_reminders_sms": false,
    "irl_revision": false,
    "tenant_portal": "basic",
    "tenant_payment_online": true,
    "payment_fees_cb": 220,
    "payment_fees_sepa": 50,
    "lease_generation": true,
    "colocation": false,
    "multi_users": false,
    "work_orders": false,
    "providers_management": false,
    "owner_reports": false,
    "api_access": false,
    "scoring_tenant": false,
    "edl_digital": false,
    "gli_discount": 0,
    "included_properties": 3,
    "extra_property_price": 300
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'starter';

-- ============================================
-- ÉTAPE 3: Mettre à jour CONFORT (1 signature/mois)
-- ============================================

UPDATE subscription_plans SET
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 1,
    "signature_price": 390,
    "open_banking": true,
    "open_banking_level": "basic",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": false,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "advanced",
    "tenant_payment_online": true,
    "payment_fees_cb": 220,
    "payment_fees_sepa": 50,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": false,
    "work_orders": true,
    "providers_management": false,
    "owner_reports": true,
    "api_access": false,
    "scoring_tenant": true,
    "edl_digital": true,
    "gli_discount": 10,
    "included_properties": 10,
    "extra_property_price": 250
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'confort';

-- ============================================
-- ÉTAPE 4: Mettre à jour PRO (5 signatures/mois)
-- ============================================

UPDATE subscription_plans SET
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 5,
    "signature_price": 290,
    "open_banking": true,
    "open_banking_level": "advanced",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 220,
    "payment_fees_sepa": 50,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 5,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "api_access": true,
    "api_access_level": "read",
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "gli_discount": 15,
    "included_properties": 50,
    "extra_property_price": 200
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'pro';

-- ============================================
-- ÉTAPE 5: Créer ENTERPRISE S (199€/mois)
-- ============================================

INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_s',
  'Enterprise S',
  'Pour les gestionnaires de 50 à 100 biens',
  19900, 199000,  -- 199€/mois, 1990€/an
  100, -1, -1, 50,
  '{
    "signatures": true,
    "signatures_monthly_quota": 20,
    "signature_price": 150,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 35,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": false,
    "sla_guarantee": false,
    "gli_discount": 20,
    "included_properties": 100,
    "extra_property_price": 0,
    "tier_min_properties": 50,
    "tier_max_properties": 100
  }'::jsonb,
  true, false, 4
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
-- ÉTAPE 6: Créer ENTERPRISE M (299€/mois)
-- ============================================

INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_m',
  'Enterprise M',
  'Pour les gestionnaires de 100 à 200 biens',
  29900, 299000,  -- 299€/mois, 2990€/an
  200, -1, -1, 100,
  '{
    "signatures": true,
    "signatures_monthly_quota": 30,
    "signature_price": 150,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 35,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "white_label_level": "basic",
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": false,
    "sla_guarantee": false,
    "gli_discount": 20,
    "included_properties": 200,
    "extra_property_price": 0,
    "tier_min_properties": 100,
    "tier_max_properties": 200
  }'::jsonb,
  true, false, 5
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
-- ÉTAPE 7: Créer ENTERPRISE L (449€/mois) ⭐
-- ============================================

INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_l',
  'Enterprise L',
  'Pour les gestionnaires de 200 à 500 biens',
  44900, 449000,  -- 449€/mois, 4490€/an
  500, -1, -1, 200,
  '{
    "signatures": true,
    "signatures_monthly_quota": 50,
    "signature_price": 150,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 35,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "white_label_level": "full",
    "custom_domain": true,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "account_manager_type": "shared",
    "sla_guarantee": true,
    "sla_percent": 99.5,
    "gli_discount": 20,
    "included_properties": 500,
    "extra_property_price": 0,
    "tier_min_properties": 200,
    "tier_max_properties": 500
  }'::jsonb,
  true, true, 6  -- is_popular = true (Le plus choisi Enterprise)
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
-- ÉTAPE 8: Créer ENTERPRISE XL (699€/mois)
-- ============================================

INSERT INTO subscription_plans (
  slug, name, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_xl',
  'Enterprise XL',
  'Solution sur-mesure pour +500 biens',
  69900, 699000,  -- 699€/mois, 6990€/an
  -1, -1, -1, -1,  -- Tout illimité
  '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "signature_price": 0,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "payment_fees_cb": 190,
    "payment_fees_sepa": 35,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "white_label_level": "full",
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "account_manager_type": "dedicated",
    "sla_guarantee": true,
    "sla_percent": 99.5,
    "gli_discount": 20,
    "included_properties": -1,
    "extra_property_price": 0,
    "tier_min_properties": 500,
    "tier_max_properties": -1
  }'::jsonb,
  true, false, 7
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
-- ÉTAPE 9: Mettre à jour le plan ENTERPRISE legacy
-- ============================================

-- Garder le plan "enterprise" pour rétrocompatibilité mais le rediriger
-- Note: price_monthly = 0 au lieu de NULL car la colonne a une contrainte NOT NULL
UPDATE subscription_plans SET
  description = 'Solution Enterprise - Contactez-nous pour choisir votre taille',
  price_monthly = 0,  -- Sur devis (0 = contact)
  price_yearly = 0,
  features = features || '{
    "legacy": true,
    "redirect_to": "enterprise_s",
    "contact_required": true
  }'::jsonb,
  display_order = 99,  -- Masquer en bas
  updated_at = NOW()
WHERE slug = 'enterprise';

-- ============================================
-- ÉTAPE 10: Mettre à jour le trigger auto-subscription
-- Pour utiliser "gratuit" au lieu de "starter"
-- ============================================

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Seulement pour les propriétaires
  IF NEW.role = 'owner' THEN
    -- Récupérer l'ID du plan gratuit (nouveau défaut)
    SELECT id INTO v_plan_id 
    FROM subscription_plans 
    WHERE slug = 'gratuit' 
    LIMIT 1;
    
    -- Fallback sur starter si gratuit n'existe pas
    IF v_plan_id IS NULL THEN
      SELECT id INTO v_plan_id 
      FROM subscription_plans 
      WHERE slug = 'starter' 
      LIMIT 1;
    END IF;
    
    -- Créer l'abonnement si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id, 
        plan_id, 
        status, 
        billing_cycle, 
        current_period_start,
        current_period_end,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'active',  -- Actif immédiatement (plan gratuit)
        'monthly',
        NOW(),
        NOW() + INTERVAL '1 month',
        0,
        0
      )
      ON CONFLICT (owner_id) DO NOTHING;
      
      RAISE NOTICE 'Abonnement Talok Gratuit créé pour le propriétaire %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ÉTAPE 11: Fonction pour recommander le tier Enterprise
-- ============================================

CREATE OR REPLACE FUNCTION get_recommended_enterprise_tier(property_count INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF property_count >= 500 THEN
    RETURN 'enterprise_xl';
  ELSIF property_count >= 200 THEN
    RETURN 'enterprise_l';
  ELSIF property_count >= 100 THEN
    RETURN 'enterprise_m';
  ELSIF property_count >= 50 THEN
    RETURN 'enterprise_s';
  ELSE
    RETURN 'pro';  -- Pas besoin d'Enterprise
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- ÉTAPE 12: Vue récapitulative des plans
-- ============================================

CREATE OR REPLACE VIEW v_subscription_plans_summary AS
SELECT 
  slug,
  name,
  price_monthly,
  price_yearly,
  max_properties,
  features->>'signatures_monthly_quota' as signatures_quota,
  features->>'signature_price' as signature_extra_price,
  features->>'payment_fees_cb' as cb_fee_bps,
  features->>'payment_fees_sepa' as sepa_fee_cents,
  features->>'gli_discount' as gli_discount_percent,
  features->>'included_properties' as included_properties,
  is_popular,
  display_order
FROM subscription_plans
WHERE is_active = true
ORDER BY display_order;

-- ============================================
-- VÉRIFICATION
-- ============================================

DO $$
DECLARE
  v_count INTEGER;
  v_plan_info TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM subscription_plans WHERE is_active = true;
  RAISE NOTICE 'Migration terminée. % plans actifs', v_count;
  
  -- Afficher le résumé
  FOR v_plan_info IN 
    SELECT slug || ': ' || COALESCE(price_monthly::text, '0') || ' centimes/mois'
    FROM subscription_plans 
    WHERE is_active = true 
    ORDER BY display_order
  LOOP
    RAISE NOTICE '%', v_plan_info;
  END LOOP;
END $$;

COMMIT;

