/**
 * Service de calcul des frais de paiement
 * Gère les frais CB et SEPA facturés aux propriétaires
 * 
 * MODÈLE ÉCONOMIQUE :
 * - CB : 2,2% facturé → 1,5% + 0,25€ Stripe = ~0,7% de marge
 * - SEPA : 0,50€ facturé → 0,35€ Stripe = 0,15€ de marge
 * - Virement : Gratuit (pas de frais, pas de marge)
 */

import { 
  PAYMENT_FEES, 
  calculateCBFee, 
  calculateStripeCBCost,
  calculateCBMargin, 
  calculateSEPAMargin,
  formatPriceCents,
  formatPercentage,
} from './pricing-config';
import type { PlanSlug } from './plans';
import { isEnterprisePlan } from './plans';

/**
 * Helper pour détecter si un plan a les tarifs Enterprise
 */
function hasEnterpriseRates(planSlug: PlanSlug): boolean {
  return isEnterprisePlan(planSlug);
}

// ============================================
// TYPES
// ============================================

export type PaymentMethod = 'cb' | 'sepa' | 'virement';

export interface PaymentFeeResult {
  /** Méthode de paiement */
  method: PaymentMethod;
  /** Montant du loyer en centimes */
  amount: number;
  /** Frais facturés au propriétaire en centimes */
  feeAmount: number;
  /** Pourcentage des frais (pour CB) */
  feePercentage: number;
  /** Montant net reçu par le propriétaire en centimes */
  netAmount: number;
  /** Coût réel Stripe en centimes */
  stripeCost: number;
  /** Marge pour la plateforme en centimes */
  platformMargin: number;
  /** Marge en pourcentage */
  marginPercentage: number;
}

export interface PaymentFeeSummary {
  method: PaymentMethod;
  label: string;
  feeText: string;
  recommended: boolean;
  available: boolean;
}

// ============================================
// FONCTIONS PRINCIPALES
// ============================================

/**
 * Calcule les frais de paiement détaillés pour un loyer
 * @param amountCents Montant du loyer en centimes
 * @param method Méthode de paiement
 * @param planSlug Plan de l'utilisateur
 * @returns Détail complet des frais et marges
 */
export function calculatePaymentFees(
  amountCents: number,
  method: PaymentMethod,
  planSlug: PlanSlug = 'gratuit'
): PaymentFeeResult {
  const isEnterprise = hasEnterpriseRates(planSlug);
  
  // Virement = gratuit, aucun frais
  if (method === 'virement') {
    return {
      method,
      amount: amountCents,
      feeAmount: 0,
      feePercentage: 0,
      netAmount: amountCents,
      stripeCost: 0,
      platformMargin: 0,
      marginPercentage: 0,
    };
  }
  
  // Prélèvement SEPA = frais fixe
  if (method === 'sepa') {
    const feeAmount = isEnterprise 
      ? PAYMENT_FEES.ENTERPRISE_SEPA_FIXED 
      : PAYMENT_FEES.SEPA_FIXED;
    const stripeCost = PAYMENT_FEES.STRIPE_SEPA_FIXED;
    const platformMargin = feeAmount - stripeCost;
    
    return {
      method,
      amount: amountCents,
      feeAmount,
      feePercentage: 0, // Frais fixe, pas de pourcentage
      netAmount: amountCents - feeAmount,
      stripeCost,
      platformMargin,
      marginPercentage: feeAmount > 0 ? Math.round((platformMargin / feeAmount) * 100) : 0,
    };
  }
  
  // Carte bancaire = pourcentage
  const feePercentageBps = isEnterprise 
    ? PAYMENT_FEES.ENTERPRISE_CB_PERCENTAGE 
    : PAYMENT_FEES.CB_PERCENTAGE;
  const feeAmount = Math.round(amountCents * feePercentageBps / 10000);
  const stripeCost = calculateStripeCBCost(amountCents);
  const platformMargin = feeAmount - stripeCost;
  
  return {
    method,
    amount: amountCents,
    feeAmount,
    feePercentage: feePercentageBps / 100, // Convertir en % (2.2)
    netAmount: amountCents - feeAmount,
    stripeCost,
    platformMargin,
    marginPercentage: feeAmount > 0 ? Math.round((platformMargin / feeAmount) * 100) : 0,
  };
}

/**
 * Obtient le résumé des frais pour l'affichage UI
 * @param planSlug Plan de l'utilisateur
 * @returns Liste des méthodes avec leurs frais
 */
export function getPaymentMethodsSummary(planSlug: PlanSlug = 'gratuit'): PaymentFeeSummary[] {
  const isEnterprise = hasEnterpriseRates(planSlug);
  const isGratuit = planSlug === 'gratuit';
  
  const cbPercentage = isEnterprise 
    ? PAYMENT_FEES.ENTERPRISE_CB_PERCENTAGE 
    : PAYMENT_FEES.CB_PERCENTAGE;
  
  const sepaFee = isEnterprise 
    ? PAYMENT_FEES.ENTERPRISE_SEPA_FIXED 
    : PAYMENT_FEES.SEPA_FIXED;
  
  return [
    {
      method: 'virement',
      label: 'Virement bancaire',
      feeText: 'Gratuit',
      recommended: false,
      available: true,
    },
    {
      method: 'sepa',
      label: 'Prélèvement SEPA',
      feeText: formatPriceCents(sepaFee) + '/transaction',
      recommended: true, // SEPA recommandé (moins cher pour le proprio)
      available: !isGratuit,
    },
    {
      method: 'cb',
      label: 'Carte bancaire',
      feeText: formatPercentage(cbPercentage),
      recommended: false,
      available: !isGratuit,
    },
  ];
}

/**
 * Génère le texte d'affichage des frais pour une méthode
 * @param method Méthode de paiement
 * @param planSlug Plan de l'utilisateur
 * @returns Texte formaté pour l'UI
 */
export function formatPaymentFeeText(method: PaymentMethod, planSlug: PlanSlug = 'gratuit'): string {
  const isEnterprise = hasEnterpriseRates(planSlug);
  
  switch (method) {
    case 'virement':
      return 'Gratuit';
    case 'sepa':
      const sepaFee = isEnterprise 
        ? PAYMENT_FEES.ENTERPRISE_SEPA_FIXED 
        : PAYMENT_FEES.SEPA_FIXED;
      return `${(sepaFee / 100).toFixed(2)}€/transaction`;
    case 'cb':
      const cbFee = isEnterprise 
        ? PAYMENT_FEES.ENTERPRISE_CB_PERCENTAGE 
        : PAYMENT_FEES.CB_PERCENTAGE;
      return `${(cbFee / 100).toFixed(1)}%`;
    default:
      return '';
  }
}

/**
 * Vérifie si le paiement en ligne est disponible pour un plan
 * @param planSlug Plan de l'utilisateur
 * @returns true si CB/SEPA disponibles
 */
export function isOnlinePaymentAvailable(planSlug: PlanSlug): boolean {
  // Tous les plans sauf gratuit ont accès au paiement en ligne
  return planSlug !== 'gratuit';
}

/**
 * Calcule le montant total avec frais pour affichage au locataire
 * (Si vous décidez de facturer le locataire plutôt que le proprio)
 * @param rentCents Loyer en centimes
 * @param method Méthode de paiement
 * @param planSlug Plan du propriétaire
 * @returns Montant total en centimes
 */
export function calculateTotalWithFees(
  rentCents: number,
  method: PaymentMethod,
  planSlug: PlanSlug = 'gratuit'
): number {
  const fees = calculatePaymentFees(rentCents, method, planSlug);
  return rentCents + fees.feeAmount;
}

/**
 * Simule les revenus de la plateforme sur un volume de paiements
 * @param totalVolumeCents Volume total en centimes
 * @param cbPercent Pourcentage payé en CB (0-100)
 * @param sepaPercent Pourcentage payé en SEPA (0-100)
 * @param transactionCount Nombre de transactions
 * @returns Revenus et marges
 */
export function simulatePlatformRevenue(
  totalVolumeCents: number,
  cbPercent: number,
  sepaPercent: number,
  transactionCount: number
): {
  cbRevenue: number;
  cbCost: number;
  cbMargin: number;
  sepaRevenue: number;
  sepaCost: number;
  sepaMargin: number;
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPercentage: number;
} {
  const cbVolume = Math.round(totalVolumeCents * cbPercent / 100);
  const sepaTransactions = Math.round(transactionCount * sepaPercent / 100);
  
  // CB
  const cbRevenue = Math.round(cbVolume * PAYMENT_FEES.CB_PERCENTAGE / 10000);
  const cbCost = Math.round(cbVolume * PAYMENT_FEES.STRIPE_CB_PERCENTAGE / 10000) + 
    Math.round(transactionCount * cbPercent / 100) * PAYMENT_FEES.STRIPE_CB_FIXED;
  const cbMargin = cbRevenue - cbCost;
  
  // SEPA
  const sepaRevenue = sepaTransactions * PAYMENT_FEES.SEPA_FIXED;
  const sepaCost = sepaTransactions * PAYMENT_FEES.STRIPE_SEPA_FIXED;
  const sepaMargin = sepaRevenue - sepaCost;
  
  // Total
  const totalRevenue = cbRevenue + sepaRevenue;
  const totalCost = cbCost + sepaCost;
  const totalMargin = cbMargin + sepaMargin;
  
  return {
    cbRevenue,
    cbCost,
    cbMargin,
    sepaRevenue,
    sepaCost,
    sepaMargin,
    totalRevenue,
    totalCost,
    totalMargin,
    marginPercentage: totalRevenue > 0 ? Math.round((totalMargin / totalRevenue) * 100) : 0,
  };
}

// ============================================
// EXEMPLES D'UTILISATION
// ============================================

/**
 * Exemple de calcul pour un loyer de 800€ payé en CB
 * 
 * const result = calculatePaymentFees(80000, 'cb', 'confort');
 * // result = {
 * //   method: 'cb',
 * //   amount: 80000,           // 800€
 * //   feeAmount: 1760,         // 17,60€ (2,2%)
 * //   feePercentage: 2.2,
 * //   netAmount: 78240,        // 782,40€ pour le proprio
 * //   stripeCost: 1225,        // 12,25€ coût Stripe
 * //   platformMargin: 535,     // 5,35€ de marge
 * //   marginPercentage: 30,    // 30% de marge
 * // }
 */

export default {
  calculatePaymentFees,
  getPaymentMethodsSummary,
  formatPaymentFeeText,
  isOnlinePaymentAvailable,
  calculateTotalWithFees,
  simulatePlatformRevenue,
};

