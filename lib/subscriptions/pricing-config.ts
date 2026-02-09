/**
 * Configuration centralisée des prix
 * Tous les prix sont en CENTIMES
 * 
 * GRILLE TARIFAIRE OPTIMISÉE 2025 - VERSION B (AGGRESSIVE)
 * ========================================================
 * 
 * FORFAITS STANDARD :
 * - Gratuit : 0€ (1 bien)
 * - Starter : 9€/mois (3 biens) + 3€/bien suppl.
 * - Confort : 35€/mois (10 biens) + 2,50€/bien suppl. - 2 signatures incluses
 * - Pro : 69€/mois (50 biens) + 2€/bien suppl. - 10 signatures incluses
 * 
 * FORFAITS ENTERPRISE :
 * - Enterprise S : 249€/mois (50-100 biens) - 25 signatures, AM partagé
 * - Enterprise M : 349€/mois (100-200 biens) - 40 signatures, White label
 * - Enterprise L : 499€/mois (200-500 biens) - 60 signatures, AM dédié ⭐
 * - Enterprise XL : 799€/mois (500+ biens) - Illimité, formations incluses
 * 
 * MARGES CIBLES :
 * - Abonnements : 98%
 * - Paiements CB : 31% (2,2% facturé - 1,5% Stripe)
 * - Paiements CB Enterprise : 21% (1,9% facturé - 1,5% Stripe)
 * - Paiements SEPA : 30% (0,50€ facturé - 0,35€ Stripe)
 * - Paiements SEPA Enterprise : 12,5% (0,40€ facturé - 0,35€ Stripe)
 * - Signatures : 62-74% (selon plan)
 * - Signatures Enterprise : 21% (1,90€ facturé - 1,50€ coût)
 * - GLI : 100% (commission partenaire)
 */

// ============================================
// FRAIS DE PAIEMENT
// ============================================

export const PAYMENT_FEES = {
  // Carte bancaire : pourcentage en points de base (220 = 2,2%)
  CB_PERCENTAGE: 220, // 2,2% facturé au propriétaire
  CB_FIXED: 0, // Pas de frais fixe supplémentaire
  
  // Prélèvement SEPA : montant fixe en centimes
  SEPA_FIXED: 50, // 0,50€ par transaction
  
  // Coûts réels Stripe (pour calcul de marge)
  STRIPE_CB_PERCENTAGE: 150, // 1,5%
  STRIPE_CB_FIXED: 25, // 0,25€
  STRIPE_SEPA_FIXED: 35, // 0,35€
  
  // Tarifs négociés Enterprise (marge garantie)
  ENTERPRISE_CB_PERCENTAGE: 190, // 1,9% (marge ~21%)
  ENTERPRISE_SEPA_FIXED: 40, // 0,40€ (marge 12,5%)
} as const;

// ============================================
// FRAIS PAR BIEN SUPPLÉMENTAIRE (en centimes)
// ============================================

export const EXTRA_PROPERTY_FEES = {
  gratuit: 0, // Pas de bien supplémentaire possible
  starter: 300, // 3€/mois par bien suppl.
  confort: 250, // 2,50€/mois par bien suppl.
  pro: 200, // 2€/mois par bien suppl.
  // Tiers Enterprise : inclus dans la plage définie
  enterprise_s: 0, // 50-100 biens inclus
  enterprise_m: 0, // 100-200 biens inclus
  enterprise_l: 0, // 200-500 biens inclus
  enterprise_xl: 0, // Illimité
  enterprise: 0, // Legacy - Illimité, pas de frais
} as const;

// ============================================
// PRIX DES SIGNATURES (en centimes)
// ============================================

export const SIGNATURE_PRICES = {
  // Prix facturé par signature hors quota
  gratuit: 590, // 5,90€/signature (pas de quota)
  starter: 490, // 4,90€/signature
  confort: 390, // 3,90€/signature
  pro: 250, // 2,50€/signature (réduit car 10 incluses)
  // Tiers Enterprise : 1,90€/signature au-delà du quota (marge 21%)
  enterprise_s: 190, // 1,90€
  enterprise_m: 190, // 1,90€
  enterprise_l: 190, // 1,90€
  enterprise_xl: 0, // Inclus (illimité)
  enterprise: 0, // Legacy - Inclus (illimité)
  
  // Coût réel Yousign
  YOUSIGN_COST: 150, // ~1,50€/signature (volume négocié)
} as const;

// ============================================
// QUOTAS DE SIGNATURES PAR PLAN (par mois)
// ============================================

export const SIGNATURE_QUOTAS = {
  gratuit: 0, // Aucune incluse
  starter: 0, // Aucune incluse, tout payant
  confort: 2, // 2/mois incluses (OPTIMISÉ : était 1)
  pro: 10, // 10/mois incluses (OPTIMISÉ : était 5)
  // Tiers Enterprise (3 options combinées)
  enterprise_s: 25, // 25/mois incluses (50-100 biens)
  enterprise_m: 40, // 40/mois incluses (100-200 biens)
  enterprise_l: 60, // 60/mois incluses (200-500 biens)
  enterprise_xl: -1, // Illimité (500+ biens)
  enterprise: -1, // Legacy - Illimité (-1 = pas de limite)
} as const;

// ============================================
// CONFIGURATION TIERS ENTERPRISE
// ============================================

export const ENTERPRISE_TIERS = {
  // Enterprise S : 50-100 biens - 249€/mois (OPTIMISÉ: était 199€)
  enterprise_s: {
    min_properties: 50,
    max_properties: 100,
    price_monthly: 24900, // 249€
    price_yearly: 239000, // 2390€ (=199€/mois, -20%)
    signatures_included: 25,
    signature_extra_price: 190, // 1,90€
    has_account_manager: true, // Partagé (ajouté!)
    has_white_label: false,
    has_custom_domain: false,
    has_sso: false,
    sla_percent: 99,
  },
  // Enterprise M : 100-200 biens - 349€/mois (OPTIMISÉ: était 299€)
  enterprise_m: {
    min_properties: 100,
    max_properties: 200,
    price_monthly: 34900, // 349€
    price_yearly: 335000, // 3350€ (=279€/mois, -20%)
    signatures_included: 40,
    signature_extra_price: 190, // 1,90€
    has_account_manager: true, // Partagé
    has_white_label: true, // Basique
    has_custom_domain: false,
    has_sso: false,
    sla_percent: 99,
  },
  // Enterprise L : 200-500 biens - 499€/mois (OPTIMISÉ: était 449€)
  enterprise_l: {
    min_properties: 200,
    max_properties: 500,
    price_monthly: 49900, // 499€
    price_yearly: 479000, // 4790€ (=399€/mois, -20%)
    signatures_included: 60,
    signature_extra_price: 190, // 1,90€
    has_account_manager: true, // Dédié
    has_white_label: true, // Complet
    has_custom_domain: true,
    has_sso: false,
    sla_percent: 99.5,
  },
  // Enterprise XL : 500+ biens - 799€/mois (OPTIMISÉ: était 699€)
  enterprise_xl: {
    min_properties: 500,
    max_properties: -1, // Illimité
    price_monthly: 79900, // 799€
    price_yearly: 767000, // 7670€ (=639€/mois, -20%)
    signatures_included: -1, // Illimité
    signature_extra_price: 0, // Inclus
    has_account_manager: true, // Dédié + formations incluses
    has_white_label: true,
    has_custom_domain: true,
    has_sso: true,
    sla_percent: 99.9, // SLA premium
  },
} as const;

// Type pour les tiers Enterprise
export type EnterpriseTier = keyof typeof ENTERPRISE_TIERS;

// ============================================
// PRIX DES DOCUMENTS PREMIUM (en centimes)
// ============================================

export const DOCUMENT_PRICES = {
  // Documents générés automatiquement
  BAIL_ALUR: 1900, // 19€
  BAIL_MEUBLE: 1900, // 19€
  BAIL_COLOCATION: 2400, // 24€
  BAIL_COMMERCIAL: 2900, // 29€
  
  EDL_NUMERIQUE: 2900, // 29€
  EDL_SORTIE: 2900, // 29€
  
  REGULARISATION_CHARGES: 1500, // 15€
  ATTESTATION_FISCALE: 900, // 9€
  ATTESTATION_LOYER: 500, // 5€
  
  // Envois postaux
  LETTRE_SIMPLE: 300, // 3€
  LETTRE_RECOMMANDEE: 900, // 9€
  MISE_EN_DEMEURE: 900, // 9€
  
  // Coûts réels
  LETTRE_RECOMMANDEE_COST: 350, // 3,50€ (AR24/La Poste)
  LETTRE_SIMPLE_COST: 100, // 1€
} as const;

// ============================================
// PRIX DES SERVICES ADDITIONNELS (en centimes)
// ============================================

export const ADDON_PRICES = {
  // Pack Relances avancées
  PACK_RELANCES_MENSUEL: 490, // 4,90€/mois
  
  // SMS
  SMS_UNITAIRE: 15, // 0,15€/SMS
  SMS_COST: 7, // 0,07€ coût réel
  
  // Reporting
  EXPORT_COMPTABLE_MENSUEL: 490, // 4,90€/mois
  RAPPORT_FISCAL_ANNUEL: 990, // 9,90€/export
  ANALYTIQUE_MULTI_BIENS: 990, // 9,90€/mois
  
  // Scoring IA
  SCORING_LOCATAIRE_BASIC: 990, // 9,90€/dossier
  SCORING_LOCATAIRE_ADVANCED: 1490, // 14,90€/dossier (GPT-4)
  SCORING_COST: 50, // ~0,50€ coût API OpenAI
  
  // Autres
  RELANCE_SMS_PACK_10: 120, // 1,20€ (10 SMS)
  RELANCE_SMS_PACK_50: 500, // 5€ (50 SMS)
} as const;

// ============================================
// PRIX ONBOARDING (en centimes)
// ============================================

export const ONBOARDING_PRICES = {
  // Import de données
  IMPORT_AUTO: 2900, // 29€ (import fichier Excel/CSV)
  IMPORT_MANUEL: 4900, // 49€ (saisie manuelle assistée)
  
  // Formation
  FORMATION_HEURE: 9900, // 99€/h (visio personnalisée)
  FORMATION_GROUPE: 4900, // 49€/personne (webinar)
  
  // Migration
  MIGRATION_SIMPLE: 4900, // 49€ (depuis autre logiciel)
  MIGRATION_COMPLETE: 14900, // 149€ (avec historique)
  
  // Coûts estimés (temps humain)
  IMPORT_MANUEL_COST: 1500, // 15€ (~30 min)
  FORMATION_COST: 3000, // 30€/h
  MIGRATION_COST: 5000, // 50€ (~2h)
} as const;

// ============================================
// COMMISSIONS PARTENAIRES (en pourcentage)
// ============================================

export const PARTNER_COMMISSIONS = {
  // GLI (Garantie Loyers Impayés)
  GLI_COMMISSION_PERCENT: 25, // 25% de la prime reversée
  GLI_PRIME_PERCENT_MIN: 250, // 2,5% du loyer (prime min)
  GLI_PRIME_PERCENT_MAX: 350, // 3,5% du loyer (prime max)
  
  // Assurance PNO (Propriétaire Non Occupant)
  PNO_COMMISSION_PERCENT: 20, // 20% de la prime
  
  // Diagnostics immobiliers
  DIAGNOSTIC_COMMISSION_PERCENT: 15, // 15% du prix
  
  // Artisans/Prestataires
  ARTISAN_COMMISSION_PERCENT: 8, // 8% du devis accepté
  
  // Partenaires financiers
  CREDIT_COMMISSION_PERCENT: 5, // 5% des frais de dossier
} as const;

// ============================================
// RÉDUCTIONS GLI PAR PLAN (en pourcentage)
// ============================================

export const GLI_DISCOUNTS = {
  gratuit: 0, // Pas de réduction
  starter: 5, // -5% sur la prime GLI (nouveau!)
  confort: 10, // -10% sur la prime GLI
  pro: 15, // -15% sur la prime GLI
  // Tiers Enterprise différenciés pour valoriser les upgrades
  enterprise_s: 18, // -18%
  enterprise_m: 20, // -20%
  enterprise_l: 22, // -22%
  enterprise_xl: 25, // -25% (meilleur taux)
  enterprise: 20, // Legacy - -20% sur la prime GLI
} as const;

// ============================================
// LIMITES PAR PLAN
// ============================================

export const PLAN_LIMITS = {
  gratuit: {
    max_properties: 1,
    max_leases: 1,
    max_tenants: 2,
    max_documents_gb: 0.1, // 100 Mo
    max_users: 1,
  },
  starter: {
    max_properties: 3,
    max_leases: 5,
    max_tenants: 10,
    max_documents_gb: 1,
    max_users: 1,
  },
  confort: {
    max_properties: 10,
    max_leases: 25,
    max_tenants: 40,
    max_documents_gb: 5,
    max_users: 2, // Aligné avec plans.ts (2ème utilisateur inclus)
  },
  pro: {
    max_properties: 50,
    max_leases: -1, // Illimité
    max_tenants: -1,
    max_documents_gb: 20,
    max_users: 5,
  },
  // Tiers Enterprise
  enterprise_s: {
    max_properties: 100, // 50-100 biens
    max_leases: -1,
    max_tenants: -1,
    max_documents_gb: 50,
    max_users: -1, // Illimité
  },
  enterprise_m: {
    max_properties: 200, // 100-200 biens
    max_leases: -1,
    max_tenants: -1,
    max_documents_gb: 100,
    max_users: -1,
  },
  enterprise_l: {
    max_properties: 500, // 200-500 biens
    max_leases: -1,
    max_tenants: -1,
    max_documents_gb: 200,
    max_users: -1,
  },
  enterprise_xl: {
    max_properties: -1, // Illimité
    max_leases: -1,
    max_tenants: -1,
    max_documents_gb: -1,
    max_users: -1,
  },
  enterprise: {
    max_properties: -1, // Legacy - Illimité
    max_leases: -1,
    max_tenants: -1,
    max_documents_gb: -1,
    max_users: -1,
  },
} as const;

// ============================================
// HELPERS
// ============================================

/**
 * Calcule les frais CB facturés au propriétaire
 * @param amountCents Montant en centimes
 * @param isEnterprise Si le client est Enterprise (tarif réduit)
 * @returns Frais en centimes
 */
export function calculateCBFee(amountCents: number, isEnterprise = false): number {
  const percentage = isEnterprise 
    ? PAYMENT_FEES.ENTERPRISE_CB_PERCENTAGE 
    : PAYMENT_FEES.CB_PERCENTAGE;
  return Math.round(amountCents * percentage / 10000);
}

/**
 * Calcule le coût Stripe réel pour CB
 * @param amountCents Montant en centimes
 * @returns Coût Stripe en centimes
 */
export function calculateStripeCBCost(amountCents: number): number {
  return Math.round(amountCents * PAYMENT_FEES.STRIPE_CB_PERCENTAGE / 10000) + PAYMENT_FEES.STRIPE_CB_FIXED;
}

/**
 * Calcule la marge sur les frais CB
 * @param amountCents Montant en centimes
 * @param isEnterprise Si le client est Enterprise
 * @returns Marge en centimes
 */
export function calculateCBMargin(amountCents: number, isEnterprise = false): number {
  const feeCharged = calculateCBFee(amountCents, isEnterprise);
  const stripeCost = calculateStripeCBCost(amountCents);
  return feeCharged - stripeCost;
}

/**
 * Calcule la marge sur les frais SEPA
 * @param isEnterprise Si le client est Enterprise
 * @returns Marge en centimes
 */
export function calculateSEPAMargin(isEnterprise = false): number {
  const feeCharged = isEnterprise 
    ? PAYMENT_FEES.ENTERPRISE_SEPA_FIXED 
    : PAYMENT_FEES.SEPA_FIXED;
  return feeCharged - PAYMENT_FEES.STRIPE_SEPA_FIXED;
}

/**
 * Calcule le prix d'une signature pour un plan donné
 * @param planSlug Slug du plan
 * @returns Prix en centimes (0 si illimité)
 */
export function getSignaturePrice(planSlug: keyof typeof SIGNATURE_PRICES): number {
  return SIGNATURE_PRICES[planSlug] || SIGNATURE_PRICES.starter;
}

/**
 * Calcule la marge sur une signature
 * @param planSlug Slug du plan
 * @returns Marge en centimes
 */
export function calculateSignatureMargin(planSlug: keyof typeof SIGNATURE_PRICES): number {
  const price = getSignaturePrice(planSlug);
  if (price === 0) return 0; // Inclus, pas de marge directe
  return price - SIGNATURE_PRICES.YOUSIGN_COST;
}

/**
 * Formate un prix en centimes vers euros
 * @param cents Prix en centimes
 * @returns Prix formaté (ex: "19,00 €")
 */
export function formatPriceCents(cents: number): string {
  if (cents === 0) return 'Gratuit';
  if (cents < 0) return 'Illimité';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Formate un pourcentage
 * @param basisPoints Points de base (100 = 1%)
 * @returns Pourcentage formaté (ex: "2,2%")
 */
export function formatPercentage(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(1)}%`;
}

/**
 * Vérifie si une limite est illimitée
 * @param limit Valeur de la limite
 * @returns true si illimité (-1)
 */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

// Export par défaut pour faciliter l'import
export default {
  PAYMENT_FEES,
  EXTRA_PROPERTY_FEES,
  SIGNATURE_PRICES,
  SIGNATURE_QUOTAS,
  DOCUMENT_PRICES,
  ADDON_PRICES,
  ONBOARDING_PRICES,
  PARTNER_COMMISSIONS,
  GLI_DISCOUNTS,
  PLAN_LIMITS,
};

