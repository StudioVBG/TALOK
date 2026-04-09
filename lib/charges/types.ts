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
