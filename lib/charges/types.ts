/**
 * Types for the charges locatives module.
 * Based on décret 87-713 for recoverable charges.
 */

export type ChargeCategoryCode =
  | "ascenseurs"
  | "eau_chauffage"
  | "installations_individuelles"
  | "parties_communes"
  | "espaces_exterieurs"
  | "taxes_redevances";

export interface ChargeCategory {
  id: string;
  property_id: string;
  category: ChargeCategoryCode;
  label: string;
  is_recoverable: boolean;
  annual_budget_cents: number;
  created_at: string;
  updated_at: string;
}

export interface ChargeEntry {
  id: string;
  property_id: string;
  category_id: string;
  label: string;
  amount_cents: number;
  date: string;
  is_recoverable: boolean;
  justificatif_document_id: string | null;
  accounting_entry_id: string | null;
  fiscal_year: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: ChargeCategory;
}

export interface CategoryDetailItem {
  category_id: string;
  category_code: ChargeCategoryCode;
  category_label: string;
  budget_cents: number;
  actual_cents: number;
  difference_cents: number;
}

export interface LeaseChargeRegularization {
  id: string;
  lease_id: string;
  property_id: string;
  fiscal_year: number;
  total_provisions_cents: number;
  total_actual_cents: number;
  balance_cents: number; // generated: actual - provisions
  detail_per_category: CategoryDetailItem[];
  document_id: string | null;
  sent_at: string | null;
  contested: boolean;
  contest_reason: string | null;
  contest_date: string | null;
  status: "draft" | "calculated" | "sent" | "acknowledged" | "contested" | "settled";
  created_at: string;
  updated_at: string;
}

export interface RegularizationCalculation {
  lease_id: string;
  property_id: string;
  fiscal_year: number;
  total_provisions_cents: number;
  total_actual_cents: number;
  balance_cents: number;
  detail_per_category: CategoryDetailItem[];
}

export interface ChargesSummary {
  total_budget_cents: number;
  total_actual_cents: number;
  total_recoverable_cents: number;
  total_non_recoverable_cents: number;
  by_category: {
    category: ChargeCategoryCode;
    label: string;
    budget_cents: number;
    actual_cents: number;
    recoverable_cents: number;
  }[];
}

// ---------------------------------------------------------------------------
// Sprint 1 — Regularization calculation engine types (camelCase inputs)
// ---------------------------------------------------------------------------

/**
 * Lease regularization status — aligned on DB CHECK constraint of
 * `lease_charge_regularizations.status` (migration 20260408130000).
 *
 * Note : the Sprint 0 skill brief mentioned a `waived` state, but the current
 * DB schema does not allow it. Settlement waived is represented via
 * `SettlementMethod = 'waived'` once status is `settled`.
 */
export type RegularizationStatus =
  | "draft"
  | "calculated"
  | "sent"
  | "acknowledged"
  | "contested"
  | "settled";

/**
 * Settlement method chosen by the owner when applying a regularization.
 * Not backed by a DB enum yet (Sprint 2 will add a column).
 */
export type SettlementMethod =
  | "stripe" // Stripe Checkout / PaymentIntent
  | "next_rent" // Ajout à la prochaine quittance
  | "installments_12" // Échelonnement 12 mois (droit locataire si régul tardive)
  | "deduction" // Déduction sur prochain loyer (cas trop-perçu)
  | "waived"; // Renonciation propriétaire — compte 654000

/**
 * Pure input for the regularization engine (no DB access — fed by the caller).
 * All monetary values are in cents (INTEGER).
 */
export interface RegularizationInput {
  leaseId: string;
  propertyId?: string;
  fiscalYear?: number;
  /** ISO date (yyyy-mm-dd) — inclusive lower bound of the regularization period. */
  periodStart: string;
  /** ISO date (yyyy-mm-dd) — inclusive upper bound of the regularization period. */
  periodEnd: string;
  /**
   * Total provisions cashed in from the tenant over the period
   * (sum of `payments.charges_part` in cents).
   */
  provisionsEncaisseesCentimes: number;
  /**
   * Total real recoverable charges over the period
   * (sum of `charge_entries.amount_cents` where `is_recoverable = true`).
   */
  chargesReellesCentimes: number;
  /** Optional TEOM gross amount (from tax_notices.teom_brut). */
  teomBrutCentimes?: number;
  /** Management fees percentage on TEOM (default FRAIS_GESTION_TEOM_PCT_DEFAULT). */
  fraisGestionTeomPct?: number;
  /** True if the property is in a REOM area — blocks TEOM recovery. */
  isReom?: boolean;
  /** Tenant's monthly rent (in cents) — used to flag `requiresEchelonnement`. */
  loyerMensuelCentimes?: number;
  /**
   * Reference date for prescription check (defaults to today).
   * Useful to unit-test prescription edge cases.
   */
  referenceDate?: string;
}

/**
 * Pure output of the regularization engine.
 */
export interface RegularizationResult {
  /** Positive : tenant owes. Negative : owner must refund. */
  balanceCentimes: number;
  isComplementDu: boolean;
  isTropPercu: boolean;
  /** True if periodEnd + PRESCRIPTION_YEARS < referenceDate. */
  isPrescrit: boolean;
  /** True if balance > 1 monthly rent (tenant has the right to 12 months). */
  requiresEchelonnement: boolean;
  /** Number of days in the period (inclusive bounds). */
  nbJoursPeriode: number;
  /** ISO date — periodEnd + PRESCRIPTION_YEARS. */
  dateLimiteEnvoi: string;
  /** TEOM net after frais de gestion — 0 if REOM. */
  teomNetCentimes?: number;
  /** Amount of provisions cashed (pass-through, for traceability). */
  provisionsVerseesCentimes: number;
  /** Amount of recoverable real charges (TEOM net included if provided). */
  chargesReellesTotalesCentimes: number;
}

/**
 * Structured OCR extraction of a property tax notice (avis de taxe foncière).
 * Source for `tax_notices.teom_brut` / `frais_gestion` / `teom_net` inserts.
 * Used by Sprint 6 (OCR pipeline) — types prepared early.
 */
export interface TaxNoticeExtraction {
  year: number;
  teomBrutCentimes: number;
  /** Percentage of "frais de gestion de la fiscalité directe locale" (≈ 8%). */
  fraisGestionPct: number;
  teomNetCentimes: number;
  /** True if the notice mentions REOM instead of TEOM — blocks recovery. */
  reom: boolean;
  /** IA confidence score on the extraction (0-1). */
  confidence: number;
  /** Optional addressed property (for reconciliation with properties table). */
  adresseBien?: string;
}
