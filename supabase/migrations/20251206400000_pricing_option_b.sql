-- Migration: Grille tarifaire Option B (Aggressive)
-- Date: 2024-12-06
-- Description: Optimisation des prix pour maximiser les revenus
--
-- CHANGEMENTS PRINCIPAUX :
-- - Confort : 29€ → 35€, 1 → 2 signatures, 2 utilisateurs
-- - Pro : 59€ → 69€, 5 → 10 signatures, API lecture+écriture
-- - Enterprise S : 199€ → 249€, AM partagé inclus
-- - Enterprise M : 299€ → 349€, AM partagé inclus
-- - Enterprise L : 449€ → 499€, AM dédié
-- - Enterprise XL : 699€ → 799€, formations incluses, SLA 99.9%
-- - Réduction annuelle : 17% → 20%
-- - Signatures Enterprise : 1,50€ → 1,90€
-- - SEPA Enterprise : 0,35€ → 0,40€
-- - GLI différenciés par tier

BEGIN;

-- ============================================
-- MISE À JOUR STARTER (GLI ajouté)
-- ============================================

UPDATE subscription_plans SET
  features = features || '{
    "gli_discount": 5,
    "payment_fees_cb": 220,
    "payment_fees_sepa": 50
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'starter';

-- ============================================
-- MISE À JOUR CONFORT : 29€ → 35€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 3500, -- 35€
  price_yearly = 33600, -- 336€ (28€/mois, -20%)
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 2,
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
    "multi_users": true,
    "max_users": 2,
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
-- MISE À JOUR PRO : 59€ → 69€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 6900, -- 69€
  price_yearly = 66200, -- 662€ (55€/mois, -20%)
  max_documents_gb = 30, -- Augmenté
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 10,
    "signature_price": 250,
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
    "api_access_level": "read_write",
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
-- MISE À JOUR ENTERPRISE S : 199€ → 249€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 24900, -- 249€
  price_yearly = 239000, -- 2390€ (199€/mois, -20%)
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 25,
    "signature_price": 190,
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
    "payment_fees_sepa": 40,
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
    "dedicated_account_manager": true,
    "account_manager_type": "shared",
    "sla_guarantee": true,
    "sla_percent": 99,
    "gli_discount": 18,
    "included_properties": 100,
    "extra_property_price": 0,
    "tier_min_properties": 50,
    "tier_max_properties": 100
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'enterprise_s';

-- ============================================
-- MISE À JOUR ENTERPRISE M : 299€ → 349€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 34900, -- 349€
  price_yearly = 335000, -- 3350€ (279€/mois, -20%)
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 40,
    "signature_price": 190,
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
    "payment_fees_sepa": 40,
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
    "dedicated_account_manager": true,
    "account_manager_type": "shared",
    "sla_guarantee": true,
    "sla_percent": 99,
    "gli_discount": 20,
    "included_properties": 200,
    "extra_property_price": 0,
    "tier_min_properties": 100,
    "tier_max_properties": 200
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'enterprise_m';

-- ============================================
-- MISE À JOUR ENTERPRISE L : 449€ → 499€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 49900, -- 499€
  price_yearly = 479000, -- 4790€ (399€/mois, -20%)
  features = '{
    "signatures": true,
    "signatures_monthly_quota": 60,
    "signature_price": 190,
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
    "payment_fees_sepa": 40,
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
    "account_manager_type": "dedicated",
    "sla_guarantee": true,
    "sla_percent": 99.5,
    "gli_discount": 22,
    "included_properties": 500,
    "extra_property_price": 0,
    "tier_min_properties": 200,
    "tier_max_properties": 500
  }'::jsonb,
  is_popular = true,
  updated_at = NOW()
WHERE slug = 'enterprise_l';

-- ============================================
-- MISE À JOUR ENTERPRISE XL : 699€ → 799€
-- ============================================

UPDATE subscription_plans SET
  price_monthly = 79900, -- 799€
  price_yearly = 767000, -- 7670€ (639€/mois, -20%)
  features = '{
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
    "payment_fees_sepa": 40,
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
    "onboarding_included": true,
    "training_hours": 10,
    "sla_guarantee": true,
    "sla_percent": 99.9,
    "gli_discount": 25,
    "included_properties": -1,
    "extra_property_price": 0,
    "tier_min_properties": 500,
    "tier_max_properties": -1
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'enterprise_xl';

-- ============================================
-- VÉRIFICATION
-- ============================================

DO $$
DECLARE
  v_record RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'GRILLE TARIFAIRE OPTION B APPLIQUÉE';
  RAISE NOTICE '========================================';
  
  FOR v_record IN 
    SELECT 
      slug,
      price_monthly / 100 as prix_mensuel,
      price_yearly / 100 as prix_annuel,
      features->>'signatures_monthly_quota' as signatures,
      features->>'gli_discount' as gli_discount
    FROM subscription_plans 
    WHERE is_active = true 
    ORDER BY display_order
  LOOP
    RAISE NOTICE '% : %€/mois, %€/an, % sign., GLI -%', 
      v_record.slug, 
      v_record.prix_mensuel, 
      v_record.prix_annuel,
      COALESCE(v_record.signatures, '0'),
      COALESCE(v_record.gli_discount, '0') || '%';
  END LOOP;
END $$;

COMMIT;

