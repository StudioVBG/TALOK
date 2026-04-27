/**
 * Types partagés entre la route /api/accounting/dashboard/widgets et son
 * hook client. Sortis du fichier route handler pour éviter que les imports
 * `import type` côté client ne suivent involontairement la chaîne du runtime
 * Next.js (server-only modules, secrets, etc.).
 */

export interface TopPropertyResult {
  propertyId: string;
  propertyAddress: string | null;
  revenueCents: number;
  expensesCents: number;
  netResultCents: number;
}

export interface YoyComparisonResult {
  /** Année (label) de l'exercice courant. */
  currentYear: number | null;
  /** Année (label) de l'exercice précédent (peut être null si aucun). */
  previousYear: number | null;
  currentRevenueCents: number;
  currentExpensesCents: number;
  currentResultCents: number;
  previousRevenueCents: number;
  previousExpensesCents: number;
  previousResultCents: number;
  /**
   * Variation revenus N vs N-1 en pourcentage (arrondi 1 décimale).
   * Null si N-1 absent ou revenu N-1 = 0 (division impossible).
   */
  revenueDeltaPercent: number | null;
}

export interface DashboardWidgetsResponse {
  topProperties: TopPropertyResult[];
  yoy: YoyComparisonResult;
  recoverableChargesCents: number;
}
