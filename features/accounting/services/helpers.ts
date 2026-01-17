/**
 * Accounting Helpers - Utility functions
 * Extracted from accounting.service.ts
 */

/**
 * Formate une période YYYY-MM en texte lisible français
 */
export function formatPeriode(periode: string): string {
  const [year, month] = periode.split("-");
  const mois = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  return `${mois[parseInt(month) - 1]} ${year}`;
}

/**
 * Calcule la date de reversement (15 du mois suivant)
 */
export function getDateReversement(datePaiement: string): string {
  const date = new Date(datePaiement);
  date.setMonth(date.getMonth() + 1);
  date.setDate(15);
  return date.toISOString().split("T")[0];
}

/**
 * Formate un montant en euros
 */
export function formatMontant(montant: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(montant);
}

/**
 * Arrondit un montant à 2 décimales
 */
export function roundMontant(montant: number): number {
  return Math.round(montant * 100) / 100;
}
