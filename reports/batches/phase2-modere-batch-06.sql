-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 6/15
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260309100000_sync_subscription_plans_features.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260309100000_sync_subscription_plans_features.sql'; END $pre$;

-- =====================================================
-- Migration: Synchronisation complète des plans d'abonnement
-- Date: 2026-03-09
-- Description:
--   - Synchronise les features JSONB de subscription_plans avec le frontend (plans.ts)
--   - Ajoute les plans manquants (gratuit, enterprise_s/m/l/xl)
--   - Met à jour les prix (confort 29→35€, pro 59→69€)
--   - Synchronise subscriptions.plan_slug avec subscription_plans.slug
--   - Migre les abonnements enterprise legacy → enterprise_s
--   - Recalcule les compteurs d'usage
--   - Crée les abonnements manquants pour les propriétaires orphelins
--   - Met à jour has_subscription_feature() pour les features non-booléennes
-- =====================================================

BEGIN;

-- =====================================================
-- ÉTAPE 1: UPSERT des 8 plans avec features complètes
-- Source de vérité : lib/subscriptions/plans.ts
-- =====================================================

-- GRATUIT - 0€/mois (1 bien) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'gratuit',
  'Gratuit',
  'Découvrez la gestion locative simplifiée avec 1 bien',
  0, 0,
  1, 1, 2, 0.1,
  '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "open_banking": false,
    "open_banking_level": "none",
    "bank_reconciliation": false,
    "auto_reminders": false,
    "auto_reminders_sms": false,
    "irl_revision": false,
    "alerts_deadlines": false,
    "tenant_portal": "basic",
    "tenant_payment_online": false,
    "lease_generation": true,
    "colocation": false,
    "multi_units": false,
    "multi_users": false,
    "max_users": 1,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": false,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": false,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": false,
    "scoring_advanced": false,
    "edl_digital": false,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
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

-- STARTER - 9€/mois (3 biens) - MISE À JOUR features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'starter',
  'Starter',
  'Idéal pour gérer jusqu''à 3 biens en toute simplicité',
  900, 9000,
  3, 5, 10, 1,
  '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "open_banking": false,
    "open_banking_level": "none",
    "bank_reconciliation": false,
    "auto_reminders": "email_basic",
    "auto_reminders_sms": false,
    "irl_revision": false,
    "alerts_deadlines": false,
    "tenant_portal": "basic",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": false,
    "multi_units": false,
    "multi_users": false,
    "max_users": 1,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": false,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": false,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": false,
    "scoring_advanced": false,
    "edl_digital": false,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
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

-- CONFORT - 35€/mois (10 biens) - MISE À JOUR prix + features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'confort',
  'Confort',
  'Pour les propriétaires actifs avec plusieurs biens',
  3500, 33600,  -- 35€/mois, 336€/an (=28€/mois, -20%)
  10, 25, 40, 5,
  '{
    "signatures": true,
    "signatures_monthly_quota": 2,
    "open_banking": true,
    "open_banking_level": "basic",
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
    "multi_users": true,
    "max_users": 2,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": true,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": true,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": false,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
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

-- PRO - 69€/mois (50 biens) - MISE À JOUR prix + features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'pro',
  'Pro',
  'Pour les gestionnaires professionnels et SCI',
  6900, 66200,  -- 69€/mois, 662€/an (=55€/mois, -20%)
  50, -1, -1, 30,
  '{
    "signatures": true,
    "signatures_monthly_quota": 10,
    "open_banking": true,
    "open_banking_level": "advanced",
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
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": true,
    "api_access_level": "read_write",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
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

-- ENTERPRISE S - 249€/mois (100 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_s',
  'Enterprise S',
  'Pour les gestionnaires de 50 à 100 biens',
  24900, 239000,
  100, -1, -1, 50,
  '{
    "signatures": true,
    "signatures_monthly_quota": 25,
    "open_banking": true,
    "open_banking_level": "premium",
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

-- ENTERPRISE M - 349€/mois (200 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_m',
  'Enterprise M',
  'Pour les gestionnaires de 100 à 200 biens',
  34900, 335000,
  200, -1, -1, 100,
  '{
    "signatures": true,
    "signatures_monthly_quota": 40,
    "open_banking": true,
    "open_banking_level": "premium",
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
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
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

-- ENTERPRISE L - 499€/mois (500 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_l',
  'Enterprise L',
  'Pour les gestionnaires de 200 à 500 biens',
  49900, 479000,
  500, -1, -1, 200,
  '{
    "signatures": true,
    "signatures_monthly_quota": 60,
    "open_banking": true,
    "open_banking_level": "premium",
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
    "custom_domain": true,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, true, 5
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

-- ENTERPRISE XL - 799€/mois (illimité) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_xl',
  'Enterprise XL',
  'Solution sur-mesure pour +500 biens',
  79900, 767000,
  -1, -1, -1, -1,
  '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "open_banking_level": "premium",
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
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, false, 6
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

-- ENTERPRISE (Legacy) - Mise à jour features pour cohérence
-- On garde le plan en BDD pour les abonnements existants mais on le masque
UPDATE subscription_plans
SET
  features = '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "open_banking_level": "premium",
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
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  display_order = 99,
  updated_at = NOW()
WHERE slug = 'enterprise';

-- =====================================================
-- ÉTAPE 2: Synchroniser subscriptions.plan_slug
-- =====================================================

-- 2a. Synchroniser plan_slug avec le slug réel du plan lié
UPDATE subscriptions s
SET plan_slug = sp.slug, updated_at = NOW()
FROM subscription_plans sp
WHERE s.plan_id = sp.id
AND (s.plan_slug IS NULL OR s.plan_slug != sp.slug);

-- 2b. Migrer les abonnements enterprise legacy → enterprise_s
DO $$
DECLARE
  v_enterprise_s_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_enterprise_s_id FROM subscription_plans WHERE slug = 'enterprise_s';

  IF v_enterprise_s_id IS NOT NULL THEN
    UPDATE subscriptions
    SET plan_slug = 'enterprise_s',
        plan_id = v_enterprise_s_id,
        updated_at = NOW()
    WHERE plan_slug = 'enterprise';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) enterprise migré(s) vers enterprise_s', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 3: Recalculer les compteurs d'usage
-- =====================================================

-- 3a. Recalculer properties_count pour les comptes actifs
UPDATE subscriptions s
SET
  properties_count = COALESCE(prop_counts.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT p.owner_id, COUNT(*) as cnt
  FROM properties p
  WHERE p.deleted_at IS NULL
  GROUP BY p.owner_id
) prop_counts
WHERE s.owner_id = prop_counts.owner_id
AND s.status IN ('active', 'trialing');

-- 3b. Recalculer leases_count pour les comptes actifs
UPDATE subscriptions s
SET
  leases_count = COALESCE(lease_counts.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT pr.owner_id, COUNT(*) as cnt
  FROM leases l
  JOIN properties pr ON l.property_id = pr.id
  WHERE l.statut IN ('active', 'pending_signature', 'partially_signed', 'fully_signed')
  GROUP BY pr.owner_id
) lease_counts
WHERE s.owner_id = lease_counts.owner_id
AND s.status IN ('active', 'trialing');

-- =====================================================
-- ÉTAPE 4: Créer abonnements manquants
-- =====================================================

DO $$
DECLARE
  v_starter_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_starter_id FROM subscription_plans WHERE slug = 'starter' LIMIT 1;

  IF v_starter_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      owner_id, plan_id, plan_slug, status, billing_cycle,
      current_period_start, current_period_end, trial_end,
      properties_count, leases_count
    )
    SELECT
      p.id,
      v_starter_id,
      'starter',
      'trialing',
      'monthly',
      NOW(),
      NOW() + INTERVAL '30 days',
      NOW() + INTERVAL '30 days',
      COALESCE((SELECT COUNT(*) FROM properties pr WHERE pr.owner_id = p.id AND pr.deleted_at IS NULL), 0),
      0
    FROM profiles p
    WHERE p.role = 'owner'
    AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.owner_id = p.id)
    ON CONFLICT (owner_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) Starter créé(s) pour propriétaires orphelins', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 5: Mettre à jour has_subscription_feature()
-- Support des features non-booléennes (niveaux, nombres)
-- =====================================================

CREATE OR REPLACE FUNCTION has_subscription_feature(p_owner_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  feature_raw JSONB;
  feature_type TEXT;
BEGIN
  -- Récupérer la valeur brute de la feature depuis le plan
  SELECT sp.features -> p_feature
  INTO feature_raw
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.slug = COALESCE(s.plan_slug, 'gratuit')
  WHERE s.owner_id = p_owner_id;

  -- Si pas de subscription ou feature absente
  IF feature_raw IS NULL THEN
    RETURN false;
  END IF;

  -- Déterminer le type JSONB
  feature_type := jsonb_typeof(feature_raw);

  -- Booléen : retourner directement
  IF feature_type = 'boolean' THEN
    RETURN feature_raw::text::boolean;
  END IF;

  -- Nombre : true si > 0 (ou -1 pour illimité)
  IF feature_type = 'number' THEN
    RETURN (feature_raw::text::numeric != 0);
  END IF;

  -- String : true si non vide et pas "none" ou "false"
  IF feature_type = 'string' THEN
    RETURN (feature_raw::text NOT IN ('"none"', '"false"', '""'));
  END IF;

  -- Null explicite
  IF feature_type = 'null' THEN
    RETURN false;
  END IF;

  -- Autres types (array, object) : considérer comme true
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_subscription_feature(UUID, TEXT) IS
  'Vérifie si un owner a accès à une feature selon son forfait. Supporte bool, niveaux (string) et quotas (number).';

-- =====================================================
-- ÉTAPE 6: Mise à jour du trigger create_owner_subscription
-- Mettre à jour les intervalles pour 30 jours (cohérence)
-- =====================================================

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Seulement pour les propriétaires
  IF NEW.role = 'owner' THEN
    -- Récupérer l'ID du plan starter (plan par défaut)
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = 'starter'
    LIMIT 1;

    -- Créer l'abonnement si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id,
        plan_id,
        plan_slug,
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
        'starter',
        'trialing',
        'monthly',
        NOW(),
        NOW() + INTERVAL '30 days',
        NOW() + INTERVAL '30 days',
        0,
        0
      )
      ON CONFLICT (owner_id) DO NOTHING;

      RAISE NOTICE 'Abonnement Talok Starter (essai 30j) créé pour le propriétaire %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260309100000', 'sync_subscription_plans_features')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260309100000_sync_subscription_plans_features.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260310000000_fix_subscription_plans_display_order.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260310000000_fix_subscription_plans_display_order.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260310000000', 'fix_subscription_plans_display_order')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260310000000_fix_subscription_plans_display_order.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260314020000_canonical_lease_activation_flow.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260314020000_canonical_lease_activation_flow.sql'; END $pre$;

-- Migration: recentrer le flux bail sur un parcours canonique
-- Date: 2026-03-14
--
-- Objectifs:
-- 1. Empêcher les activations implicites depuis les signataires ou l'EDL
-- 2. Faire de la facture initiale une étape explicite après fully_signed
-- 3. Préserver le dépôt de garantie dans le total de la facture initiale

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Neutraliser les activations SQL implicites legacy
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS tr_check_activate_lease ON lease_signers;
DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON edl;
DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;

-- ---------------------------------------------------------------------------
-- 2. L'EDL finalise uniquement le document, sans activer le bail
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_edl_finalization()
RETURNS TRIGGER AS $$
DECLARE
    v_has_owner BOOLEAN;
    v_has_tenant BOOLEAN;
    v_edl_id UUID;
BEGIN
    v_edl_id := NEW.edl_id;

    SELECT 
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
              AND signer_role IN ('owner', 'proprietaire', 'bailleur') 
              AND signature_image_path IS NOT NULL
              AND signed_at IS NOT NULL
        ),
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
              AND signer_role IN ('tenant', 'locataire', 'locataire_principal') 
              AND signature_image_path IS NOT NULL
              AND signed_at IS NOT NULL
        )
    INTO v_has_owner, v_has_tenant;

    IF v_has_owner AND v_has_tenant THEN
        UPDATE edl
        SET 
            status = 'signed',
            completed_date = COALESCE(completed_date, CURRENT_DATE),
            updated_at = NOW()
        WHERE id = v_edl_id
          AND status != 'signed';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3. Préserver le dépôt de garantie dans le calcul du total
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  v_deposit_amount DECIMAL := 0;
BEGIN
  IF NEW.metadata IS NOT NULL AND NEW.metadata->>'type' = 'initial_invoice' THEN
    v_deposit_amount := COALESCE((NEW.metadata->>'deposit_amount')::DECIMAL, 0);
  END IF;

  NEW.montant_total :=
    ROUND(COALESCE(NEW.montant_loyer, 0) + COALESCE(NEW.montant_charges, 0) + v_deposit_amount, 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 4. Fonction SSOT de génération de la facture initiale
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_initial_signing_invoice(
  p_lease_id UUID,
  p_tenant_id UUID,
  p_owner_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_date_debut DATE;
  v_loyer DECIMAL(10,2);
  v_charges DECIMAL(10,2);
  v_deposit DECIMAL(10,2);
  v_total_days INT;
  v_prorata_days INT;
  v_prorata_loyer DECIMAL(10,2);
  v_prorata_charges DECIMAL(10,2);
  v_is_prorated BOOLEAN := false;
  v_month_str TEXT;
  v_due_date DATE;
  v_period_end DATE;
  v_invoice_exists BOOLEAN;
BEGIN
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_loyer := COALESCE(v_lease.loyer, 0);
  v_charges := COALESCE(v_lease.charges_forfaitaires, 0);
  v_deposit := COALESCE(v_lease.depot_de_garantie, 0);
  v_date_debut := v_lease.date_debut;

  IF v_date_debut IS NULL THEN RETURN; END IF;

  v_month_str := TO_CHAR(v_date_debut, 'YYYY-MM');

  SELECT EXISTS(
    SELECT 1 FROM invoices
    WHERE lease_id = p_lease_id
      AND (
        metadata->>'type' = 'initial_invoice'
        OR type = 'initial_invoice'
      )
  ) INTO v_invoice_exists;

  IF v_invoice_exists THEN RETURN; END IF;

  v_total_days := EXTRACT(DAY FROM (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_prorata_days := v_total_days - EXTRACT(DAY FROM v_date_debut)::INT + 1;
  v_period_end := (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  IF v_prorata_days < v_total_days THEN
    v_prorata_loyer := ROUND((v_loyer * v_prorata_days / v_total_days), 2);
    v_prorata_charges := ROUND((v_charges * v_prorata_days / v_total_days), 2);
    v_is_prorated := true;
  ELSE
    v_prorata_loyer := v_loyer;
    v_prorata_charges := v_charges;
  END IF;

  v_due_date := GREATEST(v_date_debut, CURRENT_DATE);

  INSERT INTO invoices (
    lease_id,
    owner_id,
    tenant_id,
    periode,
    montant_loyer,
    montant_charges,
    montant_total,
    date_echeance,
    due_date,
    period_start,
    period_end,
    invoice_number,
    type,
    statut,
    generated_at,
    metadata,
    notes
  ) VALUES (
    p_lease_id,
    p_owner_id,
    p_tenant_id,
    v_month_str,
    v_prorata_loyer,
    v_prorata_charges,
    v_prorata_loyer + v_prorata_charges + v_deposit,
    v_due_date,
    v_due_date,
    v_date_debut,
    v_period_end,
    'INI-' || REPLACE(v_month_str, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
    'initial_invoice',
    'sent',
    NOW(),
    jsonb_build_object(
      'type', 'initial_invoice',
      'includes_deposit', v_deposit > 0,
      'deposit_amount', v_deposit,
      'is_prorated', v_is_prorated,
      'prorata_days', v_prorata_days,
      'total_days', v_total_days,
      'generated_at_signing', true
    ),
    CASE
      WHEN v_is_prorated THEN
        'Facture initiale : loyer prorata du ' || v_date_debut || ' au ' || v_period_end
        || ' (' || v_prorata_days || '/' || v_total_days || ' jours)'
        || ' + dépôt de garantie ' || v_deposit || ' €'
      ELSE
        'Facture initiale : loyer ' || v_month_str || ' + dépôt de garantie ' || v_deposit || ' €'
    END
  );
END;
$$;

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260314020000', 'canonical_lease_activation_flow')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260314020000_canonical_lease_activation_flow.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260318000000_fix_auth_reset_template_examples.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260318000000_fix_auth_reset_template_examples.sql'; END $pre$;

-- =============================================================================
-- Migration : Align auth reset template examples with live recovery flow
-- Date      : 2026-03-18
-- Objectif  : Éviter les exemples legacy /auth/reset?token=... qui ne
--             correspondent plus au flux actuel /auth/callback -> /auth/reset-password
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates') THEN
    UPDATE email_templates
    SET available_variables = REPLACE(
          available_variables::text,
          'https://talok.fr/auth/reset?token=...',
          'https://talok.fr/auth/callback?next=/auth/reset-password&code=...'
        )::jsonb,
        updated_at = NOW()
    WHERE slug = 'auth_reset_password'
      AND available_variables::text LIKE '%https://talok.fr/auth/reset?token=...%';

    RAISE NOTICE 'email_templates auth_reset_password example updated to callback/reset-password flow';
  ELSE
    RAISE NOTICE 'email_templates table does not exist, skipping';
  END IF;
END $$;

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260318000000', 'fix_auth_reset_template_examples')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260318000000_fix_auth_reset_template_examples.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260320100000_fix_owner_id_mismatch_and_rls.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260320100000_fix_owner_id_mismatch_and_rls.sql'; END $pre$;

-- ============================================================================
-- Migration: Fix owner_id mismatch on properties table
-- Date: 2026-03-20
--
-- Problème: Certaines propriétés ont owner_id = profiles.user_id (UUID auth)
-- au lieu de owner_id = profiles.id (UUID profil). Cela casse les politiques
-- RLS qui utilisent public.user_profile_id() pour comparer avec owner_id.
--
-- Cette migration:
-- 1. Corrige les owner_id incorrects (user_id → profiles.id)
-- 2. S'assure que la fonction user_profile_id() est SECURITY DEFINER et STABLE
-- 3. Supprime les doublons éventuels de propriétés
-- ============================================================================

-- ============================================================================
-- 1. Corriger les owner_id qui pointent vers user_id au lieu de profiles.id
-- ============================================================================

-- Diagnostic d'abord (visible dans les logs)
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM properties pr
  INNER JOIN profiles p ON pr.owner_id = p.user_id
  WHERE p.role = 'owner'
    AND p.id != pr.owner_id
    AND pr.deleted_at IS NULL;

  RAISE NOTICE 'Propriétés avec owner_id mismatch (user_id au lieu de profiles.id): %', mismatch_count;
END $$;

-- Correction: remplacer owner_id = user_id par owner_id = profiles.id
UPDATE properties pr
SET owner_id = p.id,
    updated_at = NOW()
FROM profiles p
WHERE pr.owner_id = p.user_id
  AND p.role = 'owner'
  AND p.id != pr.owner_id;

-- ============================================================================
-- 2. S'assurer que user_profile_id() fonctionne correctement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================================
-- 3. Vérifier et supprimer les doublons de propriétés
--    (même adresse, même owner_id, même type = doublon probable)
-- ============================================================================

-- Marquer les doublons comme supprimés (soft delete) en gardant le plus récent
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id, adresse_complete, type, ville, code_postal
      ORDER BY created_at DESC
    ) as rn
  FROM properties
  WHERE deleted_at IS NULL
    AND adresse_complete IS NOT NULL
    AND adresse_complete != ''
)
UPDATE properties
SET deleted_at = NOW(),
    deleted_by = NULL  -- patch sprint-b2: column is UUID, original migration tried to insert string 'system-dedup-migration'
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Log du nombre de doublons supprimés
DO $$
DECLARE
  dedup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dedup_count
  FROM properties
  WHERE deleted_at >= NOW() - INTERVAL '1 minute'
    AND deleted_by IS NULL;

  RAISE NOTICE 'Propriétés doublons soft-deleted (last minute): %', dedup_count;
END $$;

-- ============================================================================
-- 4. Vérification finale
-- ============================================================================

DO $$
DECLARE
  remaining_mismatch INTEGER;
  total_active INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_mismatch
  FROM properties pr
  INNER JOIN profiles p ON pr.owner_id = p.user_id
  WHERE p.role = 'owner'
    AND p.id != pr.owner_id
    AND pr.deleted_at IS NULL;

  SELECT COUNT(*) INTO total_active
  FROM properties
  WHERE deleted_at IS NULL;

  RAISE NOTICE 'Vérification: % propriétés actives, % mismatches restants', total_active, remaining_mismatch;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260320100000', 'fix_owner_id_mismatch_and_rls')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260320100000_fix_owner_id_mismatch_and_rls.sql'; END $post$;

COMMIT;

-- END OF BATCH 6/15 (Phase 2 MODERE)
