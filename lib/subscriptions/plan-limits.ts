/**
 * Plan Limits — Configuration centralisée des limites et features par forfait
 *
 * Ce fichier unifie les limites quantitatives (de pricing-config.ts) et les
 * features booléennes (de plans.ts) dans une structure plate, optimisée pour
 * le gating côté UI via usePlanAccess et UpgradeGate.
 *
 * ⚠️ NE PAS modifier plans.ts — ce fichier en dérive les valeurs.
 */

import { PLANS, type PlanSlug } from './plans';
import { PLAN_LIMITS as QUANTITATIVE_LIMITS, SIGNATURE_QUOTAS } from './pricing-config';

// ============================================
// TYPES
// ============================================

export interface PlanLimits {
  // Limites quantitatives
  maxProperties: number;       // -1 = illimité
  maxLeases: number;
  maxTenants: number;
  maxUsers: number;
  maxStorageMB: number;        // en Mo (-1 = illimité)
  maxSignaturesPerMonth: number; // -1 = illimité
  /**
   * Plafond HARD de SMS par mois calendaire.
   * 0 = SMS non inclus dans le plan (toute demande refusée sauf
   * add-on metered actif). -1 = illimité. Sinon quota strict.
   */
  maxSmsPerMonth: number;

  // Features booléennes
  hasRentCollection: boolean;  // Paiement en ligne (CB/SEPA)
  hasAccounting: boolean;      // Comptabilité / rapprochement bancaire
  hasFECExport: boolean;       // Export FEC comptable
  hasFiscalAI: boolean;        // Aide fiscale / scoring avancé
  hasAITalo: boolean;          // Agent IA TALO (scoring_advanced)
  hasMultiEntity: boolean;     // Multi-mandants / SCI
  hasAPI: boolean;             // Accès API
  hasOpenBanking: boolean;     // Open Banking
  hasAutoReminders: boolean;   // Relances automatiques
  hasAutoRemindersSMS: boolean;// Relances SMS
  hasIRLRevision: boolean;     // Révision IRL automatique
  hasEdlDigital: boolean;      // EDL numérique
  hasScoringTenant: boolean;   // Scoring locataire IA
  hasWorkOrders: boolean;      // Ordres de travaux
  hasProvidersManagement: boolean; // Gestion prestataires
  hasMultiUsers: boolean;      // Multi-utilisateurs
  hasCoproModule: boolean;     // Module copropriété
  hasWhiteLabel: boolean;      // Marque blanche
  hasSSO: boolean;             // SSO
  hasPrioritySupport: boolean; // Support prioritaire
}

// ============================================
// CONSTRUCTION DES LIMITES PAR PLAN
// ============================================

function buildLimitsForPlan(slug: PlanSlug): PlanLimits {
  const plan = PLANS[slug];
  const features = plan.features;
  const limits = plan.limits;

  // Helper pour vérifier une feature booléenne ou string-valued
  const hasFeat = (key: string): boolean => {
    const val = features[key];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val !== 'none' && val !== 'false' && val !== 'disabled' && val !== '' && val !== '0';
    if (typeof val === 'number') return val > 0;
    return false;
  };

  // Convertir Go en Mo pour maxStorageMB
  const storageGB = limits.max_documents_gb;
  const storageMB = storageGB === -1 ? -1 : Math.round(storageGB * 1024);

  // Quota SMS par plan (HARD — protection coût).
  // Au-delà, seul un add-on metered actif permet d'envoyer.
  const smsQuotas: Record<PlanSlug, number> = {
    gratuit: 0,
    starter: 20,
    confort: 100,
    pro: 500,
    enterprise_s: 2_000,
    enterprise_m: 5_000,
    enterprise_l: 10_000,
    enterprise_xl: 25_000,
    enterprise: 25_000,
  };

  return {
    // Quantitatifs
    maxProperties: limits.max_properties,
    maxLeases: limits.max_leases,
    maxTenants: limits.max_tenants,
    maxUsers: limits.max_users,
    maxStorageMB: storageMB,
    maxSignaturesPerMonth: limits.signatures_monthly_quota,
    maxSmsPerMonth: smsQuotas[slug] ?? 0,

    // Booléens
    hasRentCollection: hasFeat('tenant_payment_online'),
    hasAccounting: hasFeat('bank_reconciliation'),
    hasFECExport: hasFeat('bank_reconciliation'), // FEC disponible si compta disponible
    hasFiscalAI: hasFeat('scoring_advanced'),
    hasAITalo: hasFeat('scoring_advanced'),
    hasMultiEntity: hasFeat('multi_mandants'),
    hasAPI: hasFeat('api_access'),
    hasOpenBanking: hasFeat('open_banking'),
    hasAutoReminders: hasFeat('auto_reminders'),
    hasAutoRemindersSMS: hasFeat('auto_reminders_sms'),
    hasIRLRevision: hasFeat('irl_revision'),
    hasEdlDigital: hasFeat('edl_digital'),
    hasScoringTenant: hasFeat('scoring_tenant'),
    hasWorkOrders: hasFeat('work_orders'),
    hasProvidersManagement: hasFeat('providers_management'),
    hasMultiUsers: hasFeat('multi_users'),
    hasCoproModule: hasFeat('copro_module'),
    hasWhiteLabel: hasFeat('white_label'),
    hasSSO: hasFeat('sso'),
    hasPrioritySupport: hasFeat('priority_support'),
  };
}

// ============================================
// PLAN_LIMITS — Pré-calculé pour chaque plan
// ============================================

export const PLAN_LIMITS: Record<PlanSlug, PlanLimits> = {
  gratuit: buildLimitsForPlan('gratuit'),
  starter: buildLimitsForPlan('starter'),
  confort: buildLimitsForPlan('confort'),
  pro: buildLimitsForPlan('pro'),
  enterprise_s: buildLimitsForPlan('enterprise_s'),
  enterprise_m: buildLimitsForPlan('enterprise_m'),
  enterprise_l: buildLimitsForPlan('enterprise_l'),
  enterprise_xl: buildLimitsForPlan('enterprise_xl'),
  enterprise: buildLimitsForPlan('enterprise'),
};

// ============================================
// HELPERS
// ============================================

/**
 * Retourne le premier plan qui offre une feature donnée
 */
export function getMinimumPlanForFeature(feature: keyof PlanLimits): PlanSlug {
  const planOrder: PlanSlug[] = ['gratuit', 'starter', 'confort', 'pro', 'enterprise_s', 'enterprise_m', 'enterprise_l', 'enterprise_xl'];

  for (const slug of planOrder) {
    const limits = PLAN_LIMITS[slug];
    const val = limits[feature];
    if (typeof val === 'boolean' && val) return slug;
    if (typeof val === 'number' && val !== 0) return slug;
  }

  return 'enterprise_xl';
}

/**
 * Retourne le plan cible d'upgrade en fonction du plan actuel
 */
export function getUpgradeTarget(currentPlan: PlanSlug): PlanSlug {
  const upgradeMap: Partial<Record<PlanSlug, PlanSlug>> = {
    gratuit: 'starter',
    starter: 'confort',
    confort: 'pro',
    pro: 'enterprise_s',
    enterprise_s: 'enterprise_m',
    enterprise_m: 'enterprise_l',
    enterprise_l: 'enterprise_xl',
  };
  return upgradeMap[currentPlan] || 'enterprise_xl';
}

/**
 * Retourne le CTA d'upgrade en fonction du plan actuel
 */
export function getUpgradeCTA(currentPlan: PlanSlug): string {
  const target = getUpgradeTarget(currentPlan);
  const targetPlan = PLANS[target];
  if (!targetPlan.price_monthly || targetPlan.price_monthly === 0) {
    return 'Contactez-nous';
  }
  return `Passer au ${targetPlan.name} — ${(targetPlan.price_monthly / 100).toFixed(2).replace('.', ',')}€/mois`;
}

/**
 * Retourne un message explicatif pour une feature donnée
 */
export function getUpgradeReason(feature: keyof PlanLimits, limits: PlanLimits): string {
  const msgs: Partial<Record<keyof PlanLimits, string>> = {
    maxProperties: `Vous avez atteint la limite de ${limits.maxProperties} biens. Passez au plan supérieur pour en ajouter.`,
    maxSignaturesPerMonth: `Vous avez utilisé vos ${limits.maxSignaturesPerMonth} signatures ce mois-ci.`,
    maxStorageMB: `Votre espace de stockage est plein (${limits.maxStorageMB > 0 ? (limits.maxStorageMB / 1024).toFixed(1) : 0} Go).`,
    hasRentCollection: 'La collecte automatique des loyers est disponible à partir du plan Starter.',
    hasAccounting: 'La comptabilité et le rapprochement bancaire sont disponibles à partir du plan Confort.',
    hasFECExport: 'L\'export FEC est disponible à partir du plan Confort.',
    hasFiscalAI: 'L\'aide fiscale IA est disponible à partir du plan Pro.',
    hasAITalo: 'L\'agent IA TALO est disponible à partir du plan Pro.',
    hasMultiEntity: 'La gestion multi-entités (SCI) est disponible à partir du plan Confort.',
    hasAPI: 'L\'accès API est disponible à partir du plan Pro.',
    hasOpenBanking: 'L\'Open Banking est disponible à partir du plan Confort.',
    hasEdlDigital: 'L\'EDL numérique est disponible à partir du plan Confort.',
    hasScoringTenant: 'Le scoring locataire IA est disponible à partir du plan Confort.',
    hasProvidersManagement: 'La gestion des prestataires est disponible à partir du plan Pro.',
    hasMultiUsers: 'Le multi-utilisateurs est disponible à partir du plan Confort.',
    hasCoproModule: 'Le module copropriété est disponible à partir du plan Enterprise.',
    hasWhiteLabel: 'La marque blanche est disponible à partir du plan Enterprise M.',
    hasSSO: 'Le SSO est disponible à partir du plan Enterprise XL.',
  };
  return msgs[feature] || 'Cette fonctionnalité nécessite un plan supérieur.';
}
