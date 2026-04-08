/**
 * Configuration des plans d'abonnement
 * Synchronisé avec la base de données subscription_plans
 * 
 * GRILLE TARIFAIRE OPTIMISÉE 2026 - VERSION B (AGGRESSIVE)
 * ========================================================
 * 
 * FORFAITS STANDARD :
 * - Gratuit : 0€ (1 bien) - Acquisition
 * - Starter : 9€/mois (3 biens) + 3€/bien suppl. - -5% GLI
 * - Confort : 35€/mois (10 biens) + 2,50€/bien suppl. - 2 signatures ⭐
 * - Pro : 69€/mois (50 biens) + 2€/bien suppl. - 10 signatures
 * 
 * FORFAITS ENTERPRISE (OPTION B - AGGRESSIVE) :
 * - Enterprise S : 249€/mois (50-100 biens) - 25 signatures + AM partagé
 * - Enterprise M : 349€/mois (100-200 biens) - 40 signatures + White label
 * - Enterprise L : 499€/mois (200-500 biens) - 60 signatures + AM dédié ⭐
 * - Enterprise XL : 799€/mois (500+ biens) - Illimité + formations
 * 
 * FRAIS DE PAIEMENT :
 * - CB Standard : 2,2% (marge ~31%)
 * - CB Enterprise : 1,9% (marge ~21%)
 * - SEPA Standard : 0,50€ (marge 30%)
 * - SEPA Enterprise : 0,40€ (marge 12,5%)
 * - Virement : Gratuit
 * 
 * SIGNATURES (OPTIMISÉ pour rentabilité) :
 * - Gratuit : 0 incluse (5,90€/signature)
 * - Starter : 0 incluse (4,90€/signature)
 * - Confort : 2/mois incluses (3,90€/signature au-delà)
 * - Pro : 10/mois incluses (2,50€/signature au-delà)
 * - Enterprise S/M/L : 25-60/mois incluses (1,90€/signature au-delà)
 * - Enterprise XL : Illimité (inclus)
 * 
 * MARGE MOYENNE : 40-55%
 * RÉDUCTION ANNUELLE : -20%
 */

import {
  PAYMENT_FEES,
  EXTRA_PROPERTY_FEES,
  SIGNATURE_PRICES,
  SIGNATURE_QUOTAS,
  GLI_DISCOUNTS,
  ENTERPRISE_TIERS,
} from './pricing-config';

// ============================================
// TYPES
// ============================================

export type PlanSlug = 
  | 'gratuit' 
  | 'starter' 
  | 'confort' 
  | 'pro' 
  | 'enterprise_s' 
  | 'enterprise_m' 
  | 'enterprise_l' 
  | 'enterprise_xl'
  | 'enterprise'; // Legacy - redirige vers enterprise_s

export type FeatureKey =
  | 'signatures'
  | 'open_banking'
  | 'open_banking_level'
  | 'bank_reconciliation'
  | 'auto_reminders'
  | 'auto_reminders_sms'
  | 'irl_revision'
  | 'alerts_deadlines'
  | 'tenant_portal'
  | 'tenant_payment_online'
  | 'lease_generation'
  | 'colocation'
  | 'multi_units'
  | 'multi_users'
  | 'max_users'
  | 'roles_permissions'
  | 'activity_log'
  | 'work_orders'
  | 'work_orders_planning'
  | 'providers_management'
  | 'owner_reports'
  | 'multi_mandants'
  | 'channel_manager'
  | 'api_access'
  | 'api_access_level'
  | 'webhooks'
  | 'white_label'
  | 'custom_domain'
  | 'sso'
  | 'priority_support'
  | 'dedicated_account_manager'
  | 'scoring_tenant'
  | 'scoring_advanced'
  | 'edl_digital'
  | 'copro_module'
  | 'sla_guarantee';

export interface PlanLimits {
  max_properties: number; // -1 = illimité
  max_leases: number;
  max_tenants: number;
  max_documents_gb: number;
  max_users: number;
  signatures_monthly_quota: number;
  extra_property_price: number; // centimes par bien supplémentaire
  included_properties: number;
}

export interface Plan {
  slug: PlanSlug;
  name: string;
  description: string;
  tagline: string;
  price_monthly: number | null; // centimes, null = sur devis
  price_yearly: number | null; // centimes, null = sur devis
  limits: PlanLimits;
  features: Record<string, boolean | string | number>;
  highlights: string[];
  is_popular: boolean;
  cta_text: string;
  trial_days: number;
  badge?: string;
  gradient?: string;
}

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'paused'
  | 'incomplete'
  | 'unpaid'
  | 'expired';

export type BillingCycle = 'monthly' | 'yearly';

const FEATURE_DISABLED_VALUES = new Set(["none", "false", "disabled", "off", "0", ""]);

// ============================================
// CONFIGURATION DES PLANS
// Synchronisé avec subscription_plans en BDD
// ============================================

export const PLANS: Record<PlanSlug, Plan> = {
  // ============================================
  // GRATUIT - 0€/mois
  // Pour l'acquisition et découverte
  // ============================================
  gratuit: {
    slug: 'gratuit',
    name: 'Gratuit',
    description: 'Découvrez la gestion locative simplifiée avec 1 bien',
    tagline: 'Pour découvrir',
    price_monthly: 0,
    price_yearly: 0,
    limits: {
      max_properties: 1,
      max_leases: 1,
      max_tenants: 2,
      max_documents_gb: 0.1, // 100 Mo
      max_users: 1,
      signatures_monthly_quota: SIGNATURE_QUOTAS.gratuit, // 0
      extra_property_price: 0, // Pas de bien supplémentaire
      included_properties: 1,
    },
    features: {
      signatures: true,
      signatures_monthly_quota: SIGNATURE_QUOTAS.gratuit,
      signature_price: SIGNATURE_PRICES.gratuit, // 5,90€
      open_banking: false,
      open_banking_level: 'none',
      bank_reconciliation: false,
      auto_reminders: false,
      auto_reminders_sms: false,
      irl_revision: false,
      alerts_deadlines: false,
      tenant_portal: 'basic',
      tenant_payment_online: false, // Virement uniquement
      payment_fees_cb: 0, // Non disponible
      payment_fees_sepa: 0, // Non disponible
      lease_generation: true,
      colocation: false,
      multi_units: false,
      multi_users: false,
      max_users: 1,
      roles_permissions: false,
      activity_log: false,
      work_orders: false,
      work_orders_planning: false,
      providers_management: false,
      owner_reports: false,
      multi_mandants: false,
      channel_manager: 'none',
      api_access: false,
      api_access_level: 'none',
      webhooks: false,
      white_label: false,
      custom_domain: false,
      sso: false,
      scoring_tenant: false,
      scoring_advanced: false,
      edl_digital: false,
      copro_module: false,
      priority_support: false,
      dedicated_account_manager: false,
      sla_guarantee: false,
      gli_discount: GLI_DISCOUNTS.gratuit, // 0%
    },
    highlights: [
      '1 bien inclus',
      'Quittances PDF',
      'Suivi des loyers',
      'Portail locataire basique',
      'Support email',
    ],
    is_popular: false,
    cta_text: 'Commencer gratuitement',
    trial_days: 0,
    gradient: 'from-gray-400 to-gray-500',
  },

  // ============================================
  // STARTER - 9€/mois
  // Pour bien démarrer
  // ============================================
  starter: {
    slug: 'starter',
    name: 'Starter',
    description: 'Idéal pour gérer jusqu\'à 3 biens en toute simplicité',
    tagline: 'Pour bien démarrer',
    price_monthly: 900, // 9€
    price_yearly: 9000, // 90€ (=7,50€/mois, -17%)
    limits: {
      max_properties: 3,
      max_leases: 5,
      max_tenants: 10,
      max_documents_gb: 1,
      max_users: 1,
      signatures_monthly_quota: SIGNATURE_QUOTAS.starter, // 0 incluse
      extra_property_price: EXTRA_PROPERTY_FEES.starter, // 3€/bien
      included_properties: 3,
    },
    features: {
      signatures: true,
      signatures_monthly_quota: SIGNATURE_QUOTAS.starter, // 0
      signature_price: SIGNATURE_PRICES.starter, // 4,90€
      open_banking: false,
      open_banking_level: 'none',
      bank_reconciliation: false,
      auto_reminders: 'email_basic', // 1 rappel email
      auto_reminders_sms: false,
      irl_revision: false,
      alerts_deadlines: false,
      tenant_portal: 'basic',
      tenant_payment_online: true,
      payment_fees_cb: PAYMENT_FEES.CB_PERCENTAGE, // 2,2%
      payment_fees_sepa: PAYMENT_FEES.SEPA_FIXED, // 0,50€
      lease_generation: true,
      colocation: false,
      multi_units: false,
      multi_users: false,
      max_users: 1,
      roles_permissions: false,
      activity_log: false,
      work_orders: false,
      work_orders_planning: false,
      providers_management: false,
      owner_reports: false,
      multi_mandants: false,
      channel_manager: 'none',
      api_access: false,
      api_access_level: 'none',
      webhooks: false,
      white_label: false,
      custom_domain: false,
      sso: false,
      scoring_tenant: false,
      scoring_advanced: false,
      edl_digital: false,
      copro_module: false,
      priority_support: false,
      dedicated_account_manager: false,
      sla_guarantee: false,
      gli_discount: GLI_DISCOUNTS.starter, // 0%
    },
    highlights: [
      'Jusqu\'à 3 biens',
      '+3€/bien supplémentaire',
      'Paiement en ligne (CB/SEPA)',
      'Quittances automatiques',
      'Portail locataire',
      '-5% sur assurance GLI',
    ],
    is_popular: false,
    cta_text: '1er mois offert',
    trial_days: 30,
    gradient: 'from-slate-500 to-slate-600',
  },

  // ============================================
  // CONFORT - 35€/mois ⭐ LE PLUS POPULAIRE
  // Pour les propriétaires actifs
  // ============================================
  confort: {
    slug: 'confort',
    name: 'Confort',
    description: 'Pour les propriétaires actifs avec plusieurs biens',
    tagline: 'Le plus populaire',
    price_monthly: 3500, // 35€ (OPTIMISÉ: était 29€)
    price_yearly: 33600, // 336€ (=28€/mois, -20%)
    limits: {
      max_properties: 10,
      max_leases: 25,
      max_tenants: 40,
      max_documents_gb: 5,
      max_users: 2, // Ajout d'un 2ème utilisateur
      signatures_monthly_quota: SIGNATURE_QUOTAS.confort, // 2/mois (OPTIMISÉ: était 1)
      extra_property_price: EXTRA_PROPERTY_FEES.confort, // 2,50€/bien
      included_properties: 10,
    },
    features: {
      signatures: true,
      signatures_monthly_quota: SIGNATURE_QUOTAS.confort, // 2
      signature_price: SIGNATURE_PRICES.confort, // 3,90€
      open_banking: true,
      open_banking_level: 'basic',
      bank_reconciliation: true,
      auto_reminders: true,
      auto_reminders_sms: false,
      irl_revision: true,
      alerts_deadlines: true,
      tenant_portal: 'advanced',
      tenant_payment_online: true,
      payment_fees_cb: PAYMENT_FEES.CB_PERCENTAGE, // 2,2%
      payment_fees_sepa: PAYMENT_FEES.SEPA_FIXED, // 0,50€
      lease_generation: true,
      colocation: true,
      multi_units: true,
      multi_users: true, // Activé!
      max_users: 2,
      work_orders: true,
      providers_management: false,
      owner_reports: true,
      api_access: false,
      scoring_tenant: true,
      edl_digital: true,
      gli_discount: GLI_DISCOUNTS.confort, // -10%
    },
    highlights: [
      'Jusqu\'à 10 biens',
      '+2,50€/bien supplémentaire',
      '2 signatures/mois incluses',
      '2 utilisateurs inclus',
      'Open Banking intégré',
      'Scoring locataire IA',
      'EDL numérique',
      '-10% sur assurance GLI',
    ],
    is_popular: true,
    cta_text: '1er mois offert',
    trial_days: 30,
    badge: '⭐ Le plus choisi',
    gradient: 'from-violet-500 to-indigo-600',
  },

  // ============================================
  // PRO - 69€/mois (OPTIMISÉ: était 59€)
  // Performance maximale
  // ============================================
  pro: {
    slug: 'pro',
    name: 'Pro',
    description: 'Pour les gestionnaires professionnels et SCI',
    tagline: 'Performance maximale',
    price_monthly: 6900, // 69€ (OPTIMISÉ: était 59€)
    price_yearly: 66200, // 662€ (=55€/mois, -20%)
    limits: {
      max_properties: 50,
      max_leases: -1, // Illimité
      max_tenants: -1, // Illimité
      max_documents_gb: 30, // Augmenté: était 20
      max_users: 5,
      signatures_monthly_quota: SIGNATURE_QUOTAS.pro, // 10/mois (OPTIMISÉ: était 5)
      extra_property_price: EXTRA_PROPERTY_FEES.pro, // 2€/bien
      included_properties: 50,
    },
    features: {
      signatures: true,
      signatures_monthly_quota: SIGNATURE_QUOTAS.pro, // 10
      signature_price: SIGNATURE_PRICES.pro, // 2,50€
      open_banking: true,
      open_banking_level: 'advanced',
      bank_reconciliation: true,
      auto_reminders: true,
      auto_reminders_sms: true,
      irl_revision: true,
      alerts_deadlines: true,
      tenant_portal: 'full',
      tenant_payment_online: true,
      payment_fees_cb: PAYMENT_FEES.CB_PERCENTAGE, // 2,2%
      payment_fees_sepa: PAYMENT_FEES.SEPA_FIXED, // 0,50€
      lease_generation: true,
      colocation: true,
      multi_units: true,
      multi_users: true,
      max_users: 5,
      roles_permissions: true,
      activity_log: true,
      work_orders: true,
      work_orders_planning: true,
      providers_management: true,
      owner_reports: true,
      api_access: true,
      api_access_level: 'read_write', // Amélioré: était read
      scoring_tenant: true,
      scoring_advanced: true,
      edl_digital: true,
      gli_discount: GLI_DISCOUNTS.pro, // -15%
    },
    highlights: [
      '50 biens inclus',
      '+2€/bien supplémentaire',
      '10 signatures/mois incluses',
      'Jusqu\'à 5 utilisateurs',
      'Relances SMS automatiques',
      'API lecture + écriture',
      'Gestion prestataires complète',
      '-15% sur assurance GLI',
    ],
    is_popular: false,
    cta_text: '1er mois offert',
    trial_days: 30,
    badge: '🚀 Pro',
    gradient: 'from-amber-500 to-orange-600',
  },

  // ============================================
  // ENTERPRISE S - 249€/mois (50-100 biens)
  // Pour les gestionnaires établis
  // ============================================
  enterprise_s: {
    slug: 'enterprise_s',
    name: 'Enterprise S',
    description: 'Pour les gestionnaires de 50 à 100 biens',
    tagline: '50-100 biens',
    price_monthly: ENTERPRISE_TIERS.enterprise_s.price_monthly, // 249€
    price_yearly: ENTERPRISE_TIERS.enterprise_s.price_yearly, // 2390€ (-20%)
    limits: {
      max_properties: 100,
      max_leases: -1,
      max_tenants: -1,
      max_documents_gb: 50,
      max_users: -1,
      signatures_monthly_quota: SIGNATURE_QUOTAS.enterprise_s, // 25/mois
      extra_property_price: 0,
      included_properties: 100,
    },
    features: {
      signatures: true,
      signatures_monthly_quota: SIGNATURE_QUOTAS.enterprise_s,
      signature_price: SIGNATURE_PRICES.enterprise_s, // 1,90€
      open_banking: true,
      open_banking_level: 'premium',
      bank_reconciliation: true,
      auto_reminders: true,
      auto_reminders_sms: true,
      irl_revision: true,
      alerts_deadlines: true,
      tenant_portal: 'full',
      tenant_payment_online: true,
      payment_fees_cb: PAYMENT_FEES.ENTERPRISE_CB_PERCENTAGE, // 1,9%
      payment_fees_sepa: PAYMENT_FEES.ENTERPRISE_SEPA_FIXED, // 0,40€
      lease_generation: true,
      colocation: true,
      multi_units: true,
      multi_users: true,
      max_users: -1,
      roles_permissions: true,
      activity_log: true,
      work_orders: true,
      work_orders_planning: true,
      providers_management: true,
      owner_reports: true,
      multi_mandants: true,
      channel_manager: 'all',
      api_access: true,
      api_access_level: 'full',
      webhooks: true,
      white_label: false,
      custom_domain: false,
      sso: false,
      scoring_tenant: true,
      scoring_advanced: true,
      edl_digital: true,
      copro_module: false,
      priority_support: true,
      dedicated_account_manager: true, // Partagé inclus!
      account_manager_type: 'shared',
      sla_guarantee: true,
      sla_percent: 99,
      gli_discount: GLI_DISCOUNTS.enterprise_s, // -18%
    },
    highlights: [
      'Jusqu\'à 100 biens',
      '25 signatures/mois incluses',
      'Account Manager partagé',
      'Utilisateurs illimités',
      'API complète + Webhooks',
      'Frais CB réduits (1,9%)',
      'SLA 99%',
      '-18% sur assurance GLI',
    ],
    is_popular: false,
    cta_text: 'Essai gratuit 30j',
    trial_days: 30,
    badge: '🏢 Enterprise S',
    gradient: 'from-emerald-500 to-teal-600',
  },

  // ============================================
  // ENTERPRISE M - 349€/mois (100-200 biens)
  // Pour les gestionnaires confirmés
  // ============================================
  enterprise_m: {
    slug: 'enterprise_m',
    name: 'Enterprise M',
    description: 'Pour les gestionnaires de 100 à 200 biens',
    tagline: '100-200 biens',
    price_monthly: ENTERPRISE_TIERS.enterprise_m.price_monthly, // 349€
    price_yearly: ENTERPRISE_TIERS.enterprise_m.price_yearly, // 3350€ (-20%)
    limits: {
      max_properties: 200,
      max_leases: -1,
      max_tenants: -1,
      max_documents_gb: 100,
      max_users: -1,
      signatures_monthly_quota: SIGNATURE_QUOTAS.enterprise_m, // 40/mois
      extra_property_price: 0,
      included_properties: 200,
    },
    features: {
      signatures: true,
      signatures_monthly_quota: SIGNATURE_QUOTAS.enterprise_m,
      signature_price: SIGNATURE_PRICES.enterprise_m, // 1,90€
      open_banking: true,
      open_banking_level: 'premium',
      bank_reconciliation: true,
      auto_reminders: true,
      auto_reminders_sms: true,
      irl_revision: true,
      alerts_deadlines: true,
      tenant_portal: 'full',
      tenant_payment_online: true,
      payment_fees_cb: PAYMENT_FEES.ENTERPRISE_CB_PERCENTAGE, // 1,9%
      payment_fees_sepa: PAYMENT_FEES.ENTERPRISE_SEPA_FIXED, // 0,40€
      lease_generation: true,
      colocation: true,
      multi_units: true,
      multi_users: true,
      max_users: -1,
      roles_permissions: true,
      activity_log: true,
      work_orders: true,
      work_orders_planning: true,
      providers_management: true,
      owner_reports: true,
      multi_mandants: true,
      channel_manager: 'all',
      api_access: true,
      api_access_level: 'full',
      webhooks: true,
      white_label: true,
      white_label_level: 'basic',
      custom_domain: false,
      sso: false,
      scoring_tenant: true,
      scoring_advanced: true,
      edl_digital: true,
      copro_module: false,
      priority_support: true,
      dedicated_account_manager: true,
      account_manager_type: 'shared',
      sla_guarantee: true,
      sla_percent: 99,
      gli_discount: GLI_DISCOUNTS.enterprise_m, // -20%
    },
    highlights: [
      'Jusqu\'à 200 biens',
      '40 signatures/mois incluses',
      'Account Manager partagé',
      'White label basique',
      'Utilisateurs illimités',
      'API complète + Webhooks',
      'SLA 99%',
      '-20% sur assurance GLI',
    ],
    is_popular: false,
    cta_text: 'Essai gratuit 30j',
    trial_days: 30,
    badge: '🏢 Enterprise M',
    gradient: 'from-teal-500 to-cyan-600',
  },

  // ============================================
  // ENTERPRISE L - 499€/mois (200-500 biens)
  // Pour les grands gestionnaires
  // ============================================
  enterprise_l: {
    slug: 'enterprise_l',
    name: 'Enterprise L',
    description: 'Pour les gestionnaires de 200 à 500 biens',
    tagline: '200-500 biens',
    price_monthly: ENTERPRISE_TIERS.enterprise_l.price_monthly, // 499€
    price_yearly: ENTERPRISE_TIERS.enterprise_l.price_yearly, // 4790€ (-20%)
    limits: {
      max_properties: 500,
      max_leases: -1,
      max_tenants: -1,
      max_documents_gb: 200,
      max_users: -1,
      signatures_monthly_quota: SIGNATURE_QUOTAS.enterprise_l, // 60/mois
      extra_property_price: 0,
      included_properties: 500,
    },
    features: {
      signatures: true,
      signatures_monthly_quota: SIGNATURE_QUOTAS.enterprise_l,
      signature_price: SIGNATURE_PRICES.enterprise_l, // 1,90€
      open_banking: true,
      open_banking_level: 'premium',
      bank_reconciliation: true,
      auto_reminders: true,
      auto_reminders_sms: true,
      irl_revision: true,
      alerts_deadlines: true,
      tenant_portal: 'full',
      tenant_payment_online: true,
      payment_fees_cb: PAYMENT_FEES.ENTERPRISE_CB_PERCENTAGE, // 1,9%
      payment_fees_sepa: PAYMENT_FEES.ENTERPRISE_SEPA_FIXED, // 0,40€
      lease_generation: true,
      colocation: true,
      multi_units: true,
      multi_users: true,
      max_users: -1,
      roles_permissions: true,
      activity_log: true,
      work_orders: true,
      work_orders_planning: true,
      providers_management: true,
      owner_reports: true,
      multi_mandants: true,
      channel_manager: 'all',
      api_access: true,
      api_access_level: 'full',
      webhooks: true,
      white_label: true,
      white_label_level: 'full',
      custom_domain: true,
      sso: false,
      scoring_tenant: true,
      scoring_advanced: true,
      edl_digital: true,
      copro_module: true,
      priority_support: true,
      dedicated_account_manager: true,
      account_manager_type: 'dedicated', // Dédié!
      sla_guarantee: true,
      sla_percent: 99.5,
      gli_discount: GLI_DISCOUNTS.enterprise_l, // -22%
    },
    highlights: [
      'Jusqu\'à 500 biens',
      '60 signatures/mois incluses',
      'Account Manager DÉDIÉ',
      'White label complet',
      'Custom domain',
      'Module copropriété',
      'SLA 99,5%',
      '-22% sur assurance GLI',
    ],
    is_popular: true,
    cta_text: 'Nous contacter',
    trial_days: 30,
    badge: '⭐ Enterprise L',
    gradient: 'from-cyan-500 to-blue-600',
  },

  // ============================================
  // ENTERPRISE XL - 799€/mois (500+ biens)
  // Solution premium sur-mesure
  // ============================================
  enterprise_xl: {
    slug: 'enterprise_xl',
    name: 'Enterprise XL',
    description: 'Solution sur-mesure pour +500 biens',
    tagline: '500+ biens',
    price_monthly: ENTERPRISE_TIERS.enterprise_xl.price_monthly, // 799€
    price_yearly: ENTERPRISE_TIERS.enterprise_xl.price_yearly, // 7670€ (-20%)
    limits: {
      max_properties: -1,
      max_leases: -1,
      max_tenants: -1,
      max_documents_gb: -1,
      max_users: -1,
      signatures_monthly_quota: SIGNATURE_QUOTAS.enterprise_xl, // Illimité
      extra_property_price: 0,
      included_properties: -1,
    },
    features: {
      signatures: true,
      signatures_monthly_quota: SIGNATURE_QUOTAS.enterprise_xl, // -1
      signature_price: 0, // Inclus
      open_banking: true,
      open_banking_level: 'premium',
      bank_reconciliation: true,
      auto_reminders: true,
      auto_reminders_sms: true,
      irl_revision: true,
      alerts_deadlines: true,
      tenant_portal: 'full',
      tenant_payment_online: true,
      payment_fees_cb: PAYMENT_FEES.ENTERPRISE_CB_PERCENTAGE, // 1,9%
      payment_fees_sepa: PAYMENT_FEES.ENTERPRISE_SEPA_FIXED, // 0,40€
      lease_generation: true,
      colocation: true,
      multi_units: true,
      multi_users: true,
      max_users: -1,
      roles_permissions: true,
      activity_log: true,
      work_orders: true,
      work_orders_planning: true,
      providers_management: true,
      owner_reports: true,
      multi_mandants: true,
      channel_manager: 'all',
      api_access: true,
      api_access_level: 'full',
      webhooks: true,
      white_label: true,
      white_label_level: 'full',
      custom_domain: true,
      sso: true,
      scoring_tenant: true,
      scoring_advanced: true,
      edl_digital: true,
      copro_module: true,
      priority_support: true,
      dedicated_account_manager: true,
      account_manager_type: 'dedicated',
      onboarding_included: true, // Formations incluses!
      training_hours: 10, // 10h de formation
      sla_guarantee: true,
      sla_percent: 99.9, // SLA premium
      gli_discount: GLI_DISCOUNTS.enterprise_xl, // -25%
    },
    highlights: [
      'Biens illimités',
      'Signatures illimitées',
      '10h de formation incluses',
      'White label + SSO',
      'Custom domain',
      'Account Manager dédié',
      'SLA 99,9% garanti',
      '-25% sur assurance GLI',
    ],
    is_popular: false,
    cta_text: 'Nous contacter',
    trial_days: 30,
    badge: '🚀 Enterprise XL',
    gradient: 'from-blue-500 to-indigo-600',
  },

  // ============================================
  // ENTERPRISE (Legacy) - Redirige vers Enterprise S
  // Conservé pour rétrocompatibilité
  // ============================================
  enterprise: {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Solution Enterprise - Contactez-nous pour choisir votre taille',
    tagline: 'Sur mesure',
    price_monthly: null, // Sur devis
    price_yearly: null,
    limits: {
      max_properties: -1,
      max_leases: -1,
      max_tenants: -1,
      max_documents_gb: -1,
      max_users: -1,
      signatures_monthly_quota: -1,
      extra_property_price: 0,
      included_properties: -1,
    },
    features: {
      signatures: true,
      signatures_monthly_quota: -1,
      signature_price: 0,
      open_banking: true,
      open_banking_level: 'premium',
      bank_reconciliation: true,
      auto_reminders: true,
      auto_reminders_sms: true,
      irl_revision: true,
      alerts_deadlines: true,
      tenant_portal: 'full',
      tenant_payment_online: true,
      payment_fees_cb: PAYMENT_FEES.ENTERPRISE_CB_PERCENTAGE,
      payment_fees_sepa: PAYMENT_FEES.ENTERPRISE_SEPA_FIXED,
      lease_generation: true,
      colocation: true,
      multi_units: true,
      multi_users: true,
      max_users: -1,
      roles_permissions: true,
      activity_log: true,
      work_orders: true,
      work_orders_planning: true,
      providers_management: true,
      owner_reports: true,
      multi_mandants: true,
      channel_manager: 'all',
      api_access: true,
      api_access_level: 'full',
      webhooks: true,
      white_label: true,
      custom_domain: true,
      sso: true,
      scoring_tenant: true,
      scoring_advanced: true,
      edl_digital: true,
      copro_module: true,
      priority_support: true,
      dedicated_account_manager: true,
      sla_guarantee: true,
      gli_discount: GLI_DISCOUNTS.enterprise,
    },
    highlights: [
      'Choisissez votre taille : S, M, L ou XL',
      'À partir de 249€/mois',
      'Toutes les fonctionnalités incluses',
      'Support dédié',
    ],
    is_popular: false,
    cta_text: 'Nous contacter',
    trial_days: 0,
    badge: '🏢 Enterprise',
    gradient: 'from-emerald-500 to-teal-600',
  },
};

// ============================================
// FEATURE DESCRIPTIONS
// ============================================

export const FEATURE_LABELS: Record<string, {
  label: string;
  description: string;
  icon: string;
  category: 'base' | 'documents' | 'finance' | 'automation' | 'collaboration' | 'advanced';
}> = {
  signatures: {
    label: 'Signature électronique',
    description: 'Signez vos documents en ligne',
    icon: 'PenTool',
    category: 'documents',
  },
  open_banking: {
    label: 'Open Banking',
    description: 'Synchronisez vos comptes bancaires',
    icon: 'Landmark',
    category: 'finance',
  },
  bank_reconciliation: {
    label: 'Rapprochement bancaire',
    description: 'Associez automatiquement paiements et loyers',
    icon: 'ArrowLeftRight',
    category: 'finance',
  },
  auto_reminders: {
    label: 'Relances automatiques',
    description: 'Relances email automatiques',
    icon: 'Mail',
    category: 'automation',
  },
  auto_reminders_sms: {
    label: 'Relances SMS',
    description: 'Envoyez des SMS automatiques',
    icon: 'MessageSquare',
    category: 'automation',
  },
  irl_revision: {
    label: 'Révision IRL',
    description: 'Révision automatique des loyers',
    icon: 'TrendingUp',
    category: 'automation',
  },
  tenant_portal: {
    label: 'Portail locataire',
    description: 'Espace dédié pour vos locataires',
    icon: 'Users',
    category: 'base',
  },
  tenant_payment_online: {
    label: 'Paiement en ligne',
    description: 'Locataires peuvent payer en ligne (CB/SEPA)',
    icon: 'CreditCard',
    category: 'finance',
  },
  lease_generation: {
    label: 'Génération de bail',
    description: 'Créez des baux conformes loi ALUR',
    icon: 'FileText',
    category: 'documents',
  },
  scoring_tenant: {
    label: 'Scoring IA',
    description: 'Évaluez la solvabilité de vos candidats',
    icon: 'Brain',
    category: 'advanced',
  },
  edl_digital: {
    label: 'EDL numérique',
    description: 'États des lieux digitaux avec photos',
    icon: 'ClipboardCheck',
    category: 'documents',
  },
  multi_users: {
    label: 'Multi-utilisateurs',
    description: 'Ajoutez des collaborateurs',
    icon: 'UserPlus',
    category: 'collaboration',
  },
  work_orders: {
    label: 'Ordres de travaux',
    description: 'Gérez vos interventions',
    icon: 'Wrench',
    category: 'collaboration',
  },
  providers_management: {
    label: 'Gestion prestataires',
    description: 'Gérez vos artisans et interventions',
    icon: 'Users',
    category: 'collaboration',
  },
  api_access: {
    label: 'API',
    description: 'Intégrez vos outils',
    icon: 'Code',
    category: 'advanced',
  },
  webhooks: {
    label: 'Webhooks',
    description: 'Notifications temps réel',
    icon: 'Webhook',
    category: 'advanced',
  },
  white_label: {
    label: 'White label',
    description: 'Personnalisez avec votre marque',
    icon: 'Palette',
    category: 'advanced',
  },
  copro_module: {
    label: 'Module copropriété',
    description: 'Gestion syndic intégrée',
    icon: 'Building2',
    category: 'advanced',
  },
  gli_discount: {
    label: 'Réduction GLI',
    description: 'Réduction sur l\'assurance Garantie Loyers Impayés',
    icon: 'Shield',
    category: 'finance',
  },
};

// Groupes de features pour l'affichage
export const FEATURE_GROUPS = [
  {
    id: 'base',
    title: '🏠 Gestion de base',
    features: ['tenant_portal', 'lease_generation'],
  },
  {
    id: 'documents',
    title: '📄 Documents',
    features: ['signatures', 'edl_digital'],
  },
  {
    id: 'finance',
    title: '💰 Finance',
    features: ['open_banking', 'bank_reconciliation', 'tenant_payment_online', 'gli_discount'],
  },
  {
    id: 'automation',
    title: '⚡ Automatisation',
    features: ['auto_reminders', 'auto_reminders_sms', 'irl_revision'],
  },
  {
    id: 'ai',
    title: '🤖 Intelligence Artificielle',
    features: ['scoring_tenant'],
  },
  {
    id: 'collaboration',
    title: '👥 Collaboration',
    features: ['multi_users', 'work_orders', 'providers_management'],
  },
  {
    id: 'advanced',
    title: '🔧 Avancé',
    features: ['api_access', 'webhooks', 'white_label', 'copro_module'],
  },
] as const;

// ============================================
// HELPERS
// ============================================

/**
 * Obtient le niveau d'un plan (pour comparaison)
 */
export function getPlanLevel(slug: PlanSlug): number {
  const levels: Record<PlanSlug, number> = {
    gratuit: -1,
    starter: 0,
    confort: 1,
    pro: 2,
    enterprise_s: 3,
    enterprise_m: 4,
    enterprise_l: 5,
    enterprise_xl: 6,
    enterprise: 3, // Legacy - équivalent à enterprise_s
  };
  return levels[slug];
}

/**
 * Vérifie si on peut upgrader vers un plan
 */
export function canUpgradeTo(from: PlanSlug, to: PlanSlug): boolean {
  return getPlanLevel(to) > getPlanLevel(from);
}

/**
 * Vérifie si on peut downgrader vers un plan
 */
export function canDowngradeTo(from: PlanSlug, to: PlanSlug): boolean {
  return getPlanLevel(to) < getPlanLevel(from);
}

/**
 * Formate un prix en euros
 */
export function formatPrice(cents: number | null, options?: {
  showCurrency?: boolean;
  showDecimals?: boolean;
}): string {
  if (cents === null) return 'Sur devis';
  if (cents === 0) return 'Gratuit';
  
  const { showCurrency = true, showDecimals = false } = options || {};
  const amount = cents / 100;
  
  if (showCurrency) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(amount);
  }
  
  return amount.toFixed(showDecimals ? 2 : 0);
}

/**
 * Calcule le prix mensuel équivalent pour un paiement annuel
 */
export function getMonthlyEquivalent(yearlyPriceCents: number | null): number | null {
  if (yearlyPriceCents === null) return null;
  return Math.round(yearlyPriceCents / 12);
}

/**
 * Calcule le pourcentage de réduction annuelle
 */
export function getYearlyDiscount(plan: Plan): number {
  if (!plan.price_monthly || !plan.price_yearly || plan.price_monthly === 0) return 0;
  const monthlyTotal = plan.price_monthly * 12;
  return Math.round(((monthlyTotal - plan.price_yearly) / monthlyTotal) * 100);
}

/**
 * Vérifie si le statut d'abonnement permet l'usage des features
 */
export function isSubscriptionStatusEntitled(status?: string | null): boolean {
  return !status || status === "active" || status === "trialing";
}

/**
 * Vérifie si une valeur de feature doit être considérée comme activée
 */
export function isFeatureValueEnabled(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") {
    return !FEATURE_DISABLED_VALUES.has(value.trim().toLowerCase());
  }
  if (typeof value === "number") {
    return value > 0;
  }
  return false;
}

/**
 * Vérifie si un plan donné donne accès à une feature
 */
export function hasPlanFeature(planSlug: PlanSlug, feature: FeatureKey): boolean {
  return isFeatureValueEnabled(PLANS[planSlug].features[feature]);
}

/**
 * Trouve le plan minimum requis pour une feature
 */
export function getRequiredPlanForFeature(feature: string): PlanSlug {
  const planOrder: PlanSlug[] = ['gratuit', 'starter', 'confort', 'pro', 'enterprise_s', 'enterprise_m', 'enterprise_l', 'enterprise_xl'];
  for (const slug of planOrder) {
    if (hasPlanFeature(slug, feature as FeatureKey)) {
      return slug;
    }
  }
  return 'enterprise_xl';
}

/**
 * Liste les features gagnées en passant d'un plan à un autre
 */
export function getUpgradeFeatures(from: PlanSlug, to: PlanSlug): string[] {
  const fromFeatures = PLANS[from].features;
  const toFeatures = PLANS[to].features;
  
  return Object.keys(toFeatures).filter(
    (key) => {
      const fromVal = fromFeatures[key];
      const toVal = toFeatures[key];
      // Feature activée dans le nouveau plan mais pas dans l'ancien
      if (toVal === true && fromVal !== true) return true;
      // Ou valeur améliorée
      if (typeof toVal === 'string' && toVal !== 'none' && toVal !== 'basic' && 
          (fromVal === false || fromVal === 'none' || fromVal === 'basic')) return true;
      return false;
    }
  );
}

/**
 * Liste les features perdues en passant d'un plan à un autre
 */
export function getDowngradeFeatures(from: PlanSlug, to: PlanSlug): string[] {
  const fromFeatures = PLANS[from].features;
  const toFeatures = PLANS[to].features;
  
  return Object.keys(fromFeatures).filter(
    (key) => {
      const fromVal = fromFeatures[key];
      const toVal = toFeatures[key];
      if (fromVal === true && toVal !== true) return true;
      return false;
    }
  );
}

/**
 * Formate une limite pour l'affichage
 */
export function formatLimit(value: number, unit?: string): string {
  if (value === -1) return 'Illimité';
  if (value === 0) return '-';
  return unit ? `${value} ${unit}` : value.toString();
}

/**
 * Vérifie si un plan a une limite dépassée
 */
export function isOverLimit(usage: number, limit: number): boolean {
  if (limit === -1) return false;
  return usage >= limit;
}

/**
 * Calcule le pourcentage d'utilisation
 */
export function getUsagePercentage(usage: number, limit: number): number {
  if (limit === -1) return 0;
  if (limit === 0) return usage > 0 ? 100 : 0;
  return Math.min(100, Math.round((usage / limit) * 100));
}

/**
 * Obtient tous les plans dans l'ordre d'affichage
 */
export function getOrderedPlans(): Plan[] {
  return ['gratuit', 'starter', 'confort', 'pro', 'enterprise_s', 'enterprise_m', 'enterprise_l', 'enterprise_xl'].map((slug) => PLANS[slug as PlanSlug]);
}

/**
 * Obtient les plans payants uniquement (pour pricing page standard)
 */
export function getPaidPlans(): Plan[] {
  return ['starter', 'confort', 'pro'].map((slug) => PLANS[slug as PlanSlug]);
}

/**
 * Obtient les plans Enterprise uniquement (pour pricing page Enterprise)
 */
export function getEnterprisePlans(): Plan[] {
  return ['enterprise_s', 'enterprise_m', 'enterprise_l', 'enterprise_xl'].map((slug) => PLANS[slug as PlanSlug]);
}

/**
 * Obtient les plans affichables pour la page tarifs standard (sans Enterprise)
 */
export function getDisplayPlans(): Plan[] {
  return ['gratuit', 'starter', 'confort', 'pro'].map((slug) => PLANS[slug as PlanSlug]);
}

/**
 * Obtient tous les plans affichables avec Enterprise
 */
export function getAllDisplayPlans(): Plan[] {
  return ['gratuit', 'starter', 'confort', 'pro', 'enterprise_s', 'enterprise_m', 'enterprise_l', 'enterprise_xl'].map((slug) => PLANS[slug as PlanSlug]);
}

/**
 * Vérifie si un slug est un plan valide
 */
export function isValidPlanSlug(slug: string): slug is PlanSlug {
  return ['gratuit', 'starter', 'confort', 'pro', 'enterprise_s', 'enterprise_m', 'enterprise_l', 'enterprise_xl', 'enterprise'].includes(slug);
}

/**
 * Vérifie si un plan est un tier Enterprise
 */
export function isEnterprisePlan(slug: PlanSlug): boolean {
  return slug.startsWith('enterprise');
}

/**
 * Obtient le bon tier Enterprise en fonction du nombre de biens
 */
export function getRecommendedEnterpriseTier(propertyCount: number): PlanSlug {
  if (propertyCount >= 500) return 'enterprise_xl';
  if (propertyCount >= 200) return 'enterprise_l';
  if (propertyCount >= 100) return 'enterprise_m';
  return 'enterprise_s';
}

/**
 * Obtient le plan par défaut pour les nouveaux utilisateurs
 */
export function getDefaultPlan(): PlanSlug {
  return 'gratuit';
}

/**
 * Calcule le prix total pour un nombre de biens
 */
export function calculateTotalPrice(planSlug: PlanSlug, propertyCount: number): number {
  const plan = PLANS[planSlug];
  if (!plan.price_monthly) return 0;
  
  const basePrice = plan.price_monthly;
  const includedProperties = plan.limits.included_properties;
  const extraPropertyPrice = plan.limits.extra_property_price;
  
  if (includedProperties === -1 || propertyCount <= includedProperties) {
    return basePrice;
  }
  
  const extraProperties = propertyCount - includedProperties;
  return basePrice + (extraProperties * extraPropertyPrice);
}

/**
 * Obtient le prix d'une signature pour un plan
 */
export function getSignaturePrice(planSlug: PlanSlug): number {
  const plan = PLANS[planSlug];
  return (plan.features.signature_price as number) || 0;
}

/**
 * Vérifie si le paiement en ligne est disponible
 */
export function isOnlinePaymentAvailable(planSlug: PlanSlug): boolean {
  const plan = PLANS[planSlug];
  return plan.features.tenant_payment_online === true;
}

/**
 * Obtient les frais de paiement CB pour un plan
 */
export function getCBFeePercentage(planSlug: PlanSlug): number {
  const plan = PLANS[planSlug];
  return (plan.features.payment_fees_cb as number) || 0;
}

/**
 * Obtient les frais de paiement SEPA pour un plan
 */
export function getSEPAFee(planSlug: PlanSlug): number {
  const plan = PLANS[planSlug];
  return (plan.features.payment_fees_sepa as number) || 0;
}

// Export par défaut
export default PLANS;
