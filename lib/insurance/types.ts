/**
 * Types pour le module assurances Talok
 */

export const INSURANCE_TYPES = [
  "pno",
  "multirisques",
  "rc_pro",
  "decennale",
  "garantie_financiere",
  "gli",
] as const;

export type InsuranceType = (typeof INSURANCE_TYPES)[number];

export interface InsurancePolicy {
  id: string;
  profile_id: string;
  property_id: string | null;
  lease_id: string | null;
  insurance_type: InsuranceType;
  insurer_name: string;
  policy_number: string | null;
  start_date: string;
  end_date: string;
  amount_covered_cents: number | null;
  document_id: string | null;
  is_verified: boolean;
  verified_at: string | null;
  reminder_sent_30j: boolean;
  reminder_sent_7j: boolean;
  created_at: string;
  updated_at: string;
}

export type InsurancePolicyInsert = Omit<
  InsurancePolicy,
  "id" | "is_verified" | "verified_at" | "reminder_sent_30j" | "reminder_sent_7j" | "created_at" | "updated_at"
>;

export type InsurancePolicyUpdate = Partial<
  Pick<
    InsurancePolicy,
    | "insurer_name"
    | "policy_number"
    | "start_date"
    | "end_date"
    | "amount_covered_cents"
    | "document_id"
    | "insurance_type"
    | "property_id"
    | "lease_id"
  >
>;

export type ExpiryStatus = "ok" | "warning" | "critical" | "expired";

export interface InsurancePolicyWithExpiry extends InsurancePolicy {
  expiry_status: ExpiryStatus;
  days_until_expiry: number;
  property_address?: string;
}
