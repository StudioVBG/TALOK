/**
 * Helpers pour le module assurances Talok
 */

import type { ExpiryStatus, InsurancePolicy, InsurancePolicyWithExpiry } from "./types";

/**
 * Calcule le statut d'expiration d'une police d'assurance
 */
export function getExpiryStatus(endDate: string): { status: ExpiryStatus; daysLeft: number } {
  const end = new Date(endDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) return { status: "expired", daysLeft };
  if (daysLeft <= 7) return { status: "critical", daysLeft };
  if (daysLeft <= 30) return { status: "warning", daysLeft };
  return { status: "ok", daysLeft };
}

/**
 * Enrichit une police avec son statut d'expiration
 */
export function enrichPolicyWithExpiry(
  policy: InsurancePolicy,
  propertyAddress?: string
): InsurancePolicyWithExpiry {
  const { status, daysLeft } = getExpiryStatus(policy.end_date);
  return {
    ...policy,
    expiry_status: status,
    days_until_expiry: daysLeft,
    property_address: propertyAddress,
  };
}

/**
 * Formate le montant couvert pour l'affichage
 */
export function formatCoverage(amountCents: number | null): string {
  if (!amountCents) return "Non renseigne";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

/**
 * Formate les jours restants avant expiration
 */
export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft <= 0) return "Expiree";
  if (daysLeft === 1) return "Expire demain";
  if (daysLeft < 30) return `Expire dans ${daysLeft} jours`;
  const months = Math.floor(daysLeft / 30);
  if (months === 1) return "Expire dans 1 mois";
  return `Expire dans ${months} mois`;
}

/**
 * Trie les polices : expirées/critiques en premier
 */
export function sortPoliciesByUrgency(policies: InsurancePolicyWithExpiry[]): InsurancePolicyWithExpiry[] {
  const priority: Record<ExpiryStatus, number> = {
    expired: 0,
    critical: 1,
    warning: 2,
    ok: 3,
  };
  return [...policies].sort((a, b) => priority[a.expiry_status] - priority[b.expiry_status]);
}
