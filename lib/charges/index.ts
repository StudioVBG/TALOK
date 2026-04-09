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
} from "./types";

// Constants (décret 87-713)
export {
  CHARGE_CATEGORIES,
  getCategoryDefinition,
  getCategoryLabel,
  REGULARIZATION_STATUS_LABELS,
  REGULARIZATION_STATUS_COLORS,
} from "./constants";
export type { ChargeCategoryDefinition } from "./constants";

// Engine
export {
  calculateChargesSummary,
  calculateRegularization,
  formatCentsToEuros,
} from "./engine";
