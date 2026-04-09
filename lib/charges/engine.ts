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
} from "./types";
import type { ChargeCategoryCode } from "./types";
import { getCategoryLabel } from "./constants";

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
