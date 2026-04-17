/**
 * Charges locatives module — barrel export.
 *
 * Tables: charge_categories, charge_entries, lease_charge_regularizations
 * Migration: 20260408130000_charges_locatives_module.sql
 */

// Types
export type {
  ChargeCategoryCode,
  ChargeCategory,
  ChargeEntry,
  CategoryDetailItem,
  LeaseChargeRegularization,
  RegularizationCalculation,
  ChargesSummary,
  // Sprint 1 — engine types
  RegularizationInput,
  RegularizationResult,
  RegularizationStatus,
  SettlementMethod,
  TaxNoticeExtraction,
} from "./types";

// Constants (décret 87-713 + engine thresholds + PCG accounts)
export {
  CHARGE_CATEGORIES,
  getCategoryDefinition,
  getCategoryLabel,
  REGULARIZATION_STATUS_LABELS,
  REGULARIZATION_STATUS_COLORS,
  // Sprint 1
  FRAIS_GESTION_TEOM_PCT_DEFAULT,
  PRESCRIPTION_YEARS,
  ECHELEMENT_MONTHS,
  DEFAULT_JOURS_ANNEE,
  PCG_ACCOUNTS,
} from "./constants";
export type { ChargeCategoryDefinition, PcgAccountCode } from "./constants";

// Engine
export {
  calculateChargesSummary,
  calculateRegularization,
  formatCentsToEuros,
  // Sprint 1 — pure calculation engine
  diffDays,
  prorataCentimes,
  computeTeomNet,
  computeProvisionsVersees,
  computeRegularization,
} from "./engine";
