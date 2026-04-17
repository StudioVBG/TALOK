/**
 * Charges locatives calculation engine.
 * All financial calculations happen server-side in centimes (INTEGER).
 *
 * Handles:
 * - Summarizing charges by category for a property/fiscal year
 * - Computing annual regularization (provisions vs actual)
 * - Generating per-category detail breakdown
 */

import type {
  CategoryDetailItem,
  ChargeCategory,
  ChargeEntry,
  ChargesSummary,
  RegularizationCalculation,
  RegularizationInput,
  RegularizationResult,
} from "./types";
import type { ChargeCategoryCode } from "./types";
import {
  DEFAULT_JOURS_ANNEE,
  FRAIS_GESTION_TEOM_PCT_DEFAULT,
  PRESCRIPTION_YEARS,
  getCategoryLabel,
} from "./constants";

/**
 * Calculate a summary of all charges for a property in a fiscal year.
 */
export function calculateChargesSummary(
  categories: ChargeCategory[],
  entries: ChargeEntry[]
): ChargesSummary {
  const byCategory: ChargesSummary["by_category"] = categories.map((cat) => {
    const catEntries = entries.filter((e) => e.category_id === cat.id);
    const actual_cents = catEntries.reduce((sum, e) => sum + e.amount_cents, 0);
    const recoverable_cents = catEntries
      .filter((e) => e.is_recoverable)
      .reduce((sum, e) => sum + e.amount_cents, 0);

    return {
      category: cat.category as ChargeCategoryCode,
      label: cat.label,
      budget_cents: cat.annual_budget_cents,
      actual_cents,
      recoverable_cents,
    };
  });

  return {
    total_budget_cents: byCategory.reduce((s, c) => s + c.budget_cents, 0),
    total_actual_cents: byCategory.reduce((s, c) => s + c.actual_cents, 0),
    total_recoverable_cents: byCategory.reduce((s, c) => s + c.recoverable_cents, 0),
    total_non_recoverable_cents: byCategory.reduce(
      (s, c) => s + (c.actual_cents - c.recoverable_cents),
      0
    ),
    by_category: byCategory,
  };
}

/**
 * Calculate regularization for a specific lease.
 *
 * @param leaseId - The lease ID
 * @param propertyId - The property ID
 * @param fiscalYear - The fiscal year
 * @param categories - All charge categories for the property
 * @param entries - All charge entries for the property and fiscal year
 * @param totalProvisionsCents - Total provisions paid by the tenant during the year
 */
export function calculateRegularization(params: {
  leaseId: string;
  propertyId: string;
  fiscalYear: number;
  categories: ChargeCategory[];
  entries: ChargeEntry[];
  totalProvisionsCents: number;
}): RegularizationCalculation {
  const { leaseId, propertyId, fiscalYear, categories, entries, totalProvisionsCents } = params;

  // Only recoverable entries count toward tenant regularization
  const recoverableEntries = entries.filter((e) => e.is_recoverable);

  const detail_per_category: CategoryDetailItem[] = categories
    .filter((cat) => cat.is_recoverable)
    .map((cat) => {
      const catEntries = recoverableEntries.filter((e) => e.category_id === cat.id);
      const actual_cents = catEntries.reduce((sum, e) => sum + e.amount_cents, 0);

      return {
        category_id: cat.id,
        category_code: cat.category as ChargeCategoryCode,
        category_label: getCategoryLabel(cat.category as ChargeCategoryCode),
        budget_cents: cat.annual_budget_cents,
        actual_cents,
        difference_cents: actual_cents - cat.annual_budget_cents,
      };
    });

  const total_actual_cents = detail_per_category.reduce((s, d) => s + d.actual_cents, 0);
  const balance_cents = total_actual_cents - totalProvisionsCents;

  return {
    lease_id: leaseId,
    property_id: propertyId,
    fiscal_year: fiscalYear,
    total_provisions_cents: totalProvisionsCents,
    total_actual_cents,
    balance_cents,
    detail_per_category,
  };
}

/**
 * Format cents to euros string (e.g. 12345 -> "123,45 €")
 */
export function formatCentsToEuros(cents: number): string {
  const euros = Math.abs(cents) / 100;
  const formatted = euros.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = cents < 0 ? "-" : "";
  return `${sign}${formatted} €`;
}

// ---------------------------------------------------------------------------
// Sprint 1 — Pure calculation engine (camelCase, cents, no I/O)
// ---------------------------------------------------------------------------

/**
 * Parse an ISO date string (yyyy-mm-dd) into a UTC `Date` pinned at midnight.
 * Throws on invalid input to avoid silent NaN propagation downstream.
 */
function parseIsoDate(iso: string): Date {
  // Accept both bare yyyy-mm-dd and full ISO timestamps.
  const bare = iso.length >= 10 ? iso.slice(0, 10) : iso;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bare)) {
    throw new Error(`Invalid ISO date: "${iso}"`);
  }
  const [y, m, d] = bare.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new Error(`Invalid calendar date: "${iso}"`);
  }
  return date;
}

/** Format a UTC `Date` as yyyy-mm-dd. */
function formatIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Difference in days between two ISO dates — inclusive of both bounds.
 * diffDays('2025-01-01', '2025-01-01') === 1
 * diffDays('2025-01-01', '2025-12-31') === 365
 * diffDays('2024-01-01', '2024-12-31') === 366 (leap year)
 *
 * @throws if `endISO < startISO`.
 */
export function diffDays(startISO: string, endISO: string): number {
  const start = parseIsoDate(startISO);
  const end = parseIsoDate(endISO);
  if (end.getTime() < start.getTime()) {
    throw new Error(`diffDays: end (${endISO}) must be >= start (${startISO})`);
  }
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

/**
 * Pro-rata temporis — part of an annual charge for a sub-period.
 * Rounded to the nearest cent.
 *
 * @param chargeAnnuelleCentimes total annual charge in cents
 * @param joursPeriode number of days actually charged
 * @param joursAnnee denominator (defaults to 365)
 * @throws on negative values or joursAnnee <= 0
 */
export function prorataCentimes(
  chargeAnnuelleCentimes: number,
  joursPeriode: number,
  joursAnnee: number = DEFAULT_JOURS_ANNEE,
): number {
  if (!Number.isFinite(chargeAnnuelleCentimes) || chargeAnnuelleCentimes < 0) {
    throw new Error(`prorataCentimes: chargeAnnuelleCentimes must be >= 0 (got ${chargeAnnuelleCentimes})`);
  }
  if (!Number.isFinite(joursPeriode) || joursPeriode < 0) {
    throw new Error(`prorataCentimes: joursPeriode must be >= 0 (got ${joursPeriode})`);
  }
  if (!Number.isFinite(joursAnnee) || joursAnnee <= 0) {
    throw new Error(`prorataCentimes: joursAnnee must be > 0 (got ${joursAnnee})`);
  }
  if (joursPeriode >= joursAnnee) {
    // Full year (or over-coverage clamp) — return the charge as-is.
    return Math.round(chargeAnnuelleCentimes);
  }
  return Math.round((chargeAnnuelleCentimes * joursPeriode) / joursAnnee);
}

/**
 * Compute the TEOM net recoverable amount from a tax notice.
 *
 * Rules :
 *   - REOM (`isReom = true`) → always 0 (tenant pays the redevance directly
 *     to the EPCI, the owner has nothing to regularize).
 *   - Otherwise : teom_brut × (1 - fraisGestionPct/100), clamped at 0.
 *
 * @throws on invalid inputs.
 */
export function computeTeomNet(
  teomBrutCentimes: number,
  fraisGestionPct: number,
  isReom: boolean,
): number {
  if (!Number.isFinite(teomBrutCentimes) || teomBrutCentimes < 0) {
    throw new Error(`computeTeomNet: teomBrutCentimes must be >= 0 (got ${teomBrutCentimes})`);
  }
  if (!Number.isFinite(fraisGestionPct) || fraisGestionPct < 0 || fraisGestionPct > 100) {
    throw new Error(`computeTeomNet: fraisGestionPct must be in [0, 100] (got ${fraisGestionPct})`);
  }
  if (isReom) return 0;
  const net = Math.round(teomBrutCentimes * (1 - fraisGestionPct / 100));
  return Math.max(0, net);
}

/**
 * Identity-like guard that returns the provisions actually cashed in over the
 * regularization period. Exists to (a) centralize the provisioning semantics
 * and (b) reject negative inputs (would silently flip balances).
 *
 * The caller is responsible for summing `payments.charges_part` over the
 * period before calling this function — the engine has no DB access.
 */
export function computeProvisionsVersees(provisionsEncaisseesCentimes: number): number {
  if (!Number.isFinite(provisionsEncaisseesCentimes) || provisionsEncaisseesCentimes < 0) {
    throw new Error(
      `computeProvisionsVersees: provisionsEncaisseesCentimes must be >= 0 (got ${provisionsEncaisseesCentimes})`,
    );
  }
  return Math.round(provisionsEncaisseesCentimes);
}

/**
 * Add `years` calendar years to an ISO date — preserves month/day with
 * explicit handling of the 29th February edge case (29-Feb → 28-Feb if target
 * year is not a leap year).
 */
function addYears(iso: string, years: number): string {
  const src = parseIsoDate(iso);
  const y = src.getUTCFullYear() + years;
  const m = src.getUTCMonth();
  const d = src.getUTCDate();
  const target = new Date(Date.UTC(y, m, d));
  if (target.getUTCMonth() !== m) {
    // Day overflow (e.g. Feb 29 → Mar 1) — clamp to the last day of month m.
    return formatIsoDate(new Date(Date.UTC(y, m + 1, 0)));
  }
  return formatIsoDate(target);
}

/**
 * Core regularization calculation — pure function.
 * Consumes a fully-prepared `RegularizationInput` and returns a
 * `RegularizationResult` without any DB access or side-effect.
 *
 * Balance sign :
 *   balance > 0 → tenant owes a complement to the owner
 *   balance < 0 → owner must refund a surplus to the tenant
 */
export function computeRegularization(input: RegularizationInput): RegularizationResult {
  const nbJoursPeriode = diffDays(input.periodStart, input.periodEnd);

  const provisionsVerseesCentimes = computeProvisionsVersees(
    input.provisionsEncaisseesCentimes,
  );

  if (!Number.isFinite(input.chargesReellesCentimes) || input.chargesReellesCentimes < 0) {
    throw new Error(
      `computeRegularization: chargesReellesCentimes must be >= 0 (got ${input.chargesReellesCentimes})`,
    );
  }

  // Optional TEOM net — included in recoverable charges total when provided.
  let teomNetCentimes: number | undefined;
  if (input.teomBrutCentimes !== undefined) {
    teomNetCentimes = computeTeomNet(
      input.teomBrutCentimes,
      input.fraisGestionTeomPct ?? FRAIS_GESTION_TEOM_PCT_DEFAULT,
      input.isReom === true,
    );
  }

  const chargesReellesTotalesCentimes =
    Math.round(input.chargesReellesCentimes) + (teomNetCentimes ?? 0);

  const balanceCentimes = chargesReellesTotalesCentimes - provisionsVerseesCentimes;

  const dateLimiteEnvoi = addYears(input.periodEnd, PRESCRIPTION_YEARS);
  const referenceIso = input.referenceDate ?? formatIsoDate(new Date());
  const isPrescrit = parseIsoDate(dateLimiteEnvoi).getTime() < parseIsoDate(referenceIso).getTime();

  // Tenant has legal right to 12-month installments when balance > 1 monthly rent.
  // The skill's stricter criterion (régul > 1 an après exigibilité) is left for
  // Sprint 2 — UI-side signaling where the exigibilité date is available.
  const loyer = input.loyerMensuelCentimes;
  const requiresEchelonnement =
    balanceCentimes > 0 &&
    typeof loyer === "number" &&
    Number.isFinite(loyer) &&
    loyer > 0 &&
    balanceCentimes > loyer;

  return {
    balanceCentimes,
    isComplementDu: balanceCentimes > 0,
    isTropPercu: balanceCentimes < 0,
    isPrescrit,
    requiresEchelonnement,
    nbJoursPeriode,
    dateLimiteEnvoi,
    teomNetCentimes,
    provisionsVerseesCentimes,
    chargesReellesTotalesCentimes,
  };
}

