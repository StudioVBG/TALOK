/**
 * Utilitaires de facturation
 * Convention : prix en centimes partout cote serveur
 */

import type { AlertLevel, Territoire } from "@/types/billing";

// ============================================
// TVA
// ============================================

const TVA_RATES: Record<Territoire, number> = {
  metropole: 20.0,
  martinique: 8.5,
  guadeloupe: 8.5,
  reunion: 8.5,
  guyane: 0.0,
  mayotte: 8.5,
};

const TVA_LABELS: Record<Territoire, string> = {
  metropole: "France metropolitaine",
  martinique: "Martinique",
  guadeloupe: "Guadeloupe",
  reunion: "La Reunion",
  guyane: "Guyane",
  mayotte: "Mayotte",
};

export function getTvaRate(territoire: Territoire): number {
  return TVA_RATES[territoire];
}

export function getTvaLabel(territoire: Territoire): string {
  return TVA_LABELS[territoire];
}

export function getAllTvaRates(): Record<Territoire, number> {
  return { ...TVA_RATES };
}

// ============================================
// PRIX
// ============================================

export interface TaxBreakdown {
  ht: number;
  tva: number;
  ttc: number;
  taux: number;
}

export function computeTTC(amountHT: number, tvaTaux: number): TaxBreakdown {
  const tva = Math.round((amountHT * tvaTaux) / 100);
  return { ht: amountHT, tva, ttc: amountHT + tva, taux: tvaTaux };
}

export function formatPrice(centimes: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(centimes / 100);
}

export function formatPriceCompact(centimes: number): string {
  const euros = centimes / 100;
  if (euros === Math.floor(euros)) {
    return `${Math.floor(euros)} \u20AC`;
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(euros);
}

// ============================================
// USAGE ALERTS
// ============================================

export function getAlertLevel(current: number, max: number): AlertLevel {
  if (max === -1) return "normal";
  const pct = (current / max) * 100;
  if (pct >= 100) return "exceeded";
  if (pct >= 95) return "critical";
  if (pct >= 80) return "warning";
  return "normal";
}

export function getUsagePercentage(current: number, max: number): number {
  if (max === -1) return 0;
  if (max === 0) return 100;
  return Math.min(100, Math.round((current / max) * 100));
}

// ============================================
// DATES
// ============================================

export function formatDateLong(date: string | Date): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(date: string | Date): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function daysUntil(date: string | Date): number {
  const target = new Date(date);
  const now = new Date();
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
}

export function isExpiringSoon(expMonth: number, expYear: number, thresholdDays: number): boolean {
  const expDate = new Date(expYear, expMonth, 0);
  return daysUntil(expDate) <= thresholdDays;
}

// ============================================
// YEARLY SAVINGS
// ============================================

export function computeYearlySavings(
  monthlyHT: number,
  yearlyHT: number
): { savingsPercent: number; savingsAmount: number; monthlyEquivalent: number } {
  const annualFromMonthly = monthlyHT * 12;
  if (annualFromMonthly <= 0 || yearlyHT <= 0) {
    return { savingsPercent: 0, savingsAmount: 0, monthlyEquivalent: 0 };
  }
  const savingsAmount = annualFromMonthly - yearlyHT;
  const savingsPercent = Math.round((savingsAmount / annualFromMonthly) * 100);
  const monthlyEquivalent = Math.round(yearlyHT / 12);
  return { savingsPercent, savingsAmount, monthlyEquivalent };
}
