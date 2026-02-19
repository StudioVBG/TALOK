/**
 * Types — Billing & Subscription
 * Convention : prix toujours en centimes cote serveur
 */

export type PlanId =
  | "gratuit"
  | "starter"
  | "confort"
  | "pro"
  | "enterprise_s"
  | "enterprise_m"
  | "enterprise_l"
  | "enterprise_xl";

export type BillingCycle = "monthly" | "yearly";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "paused"
  | "past_due"
  | "canceled"
  | "incomplete";

/**
 * Statut de facture Stripe (billing/abonnement)
 * @see InvoiceStatus dans @/lib/types/status.ts pour les factures locataires
 */
export type BillingInvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "void"
  | "uncollectible";

/** @deprecated Utiliser BillingInvoiceStatus */
export type InvoiceStatus = BillingInvoiceStatus;

export type Territoire =
  | "metropole"
  | "martinique"
  | "guadeloupe"
  | "reunion"
  | "guyane"
  | "mayotte";

export type UsageMetric =
  | "biens"
  | "signatures"
  | "utilisateurs"
  | "stockage_mb";

export type AlertLevel = "normal" | "warning" | "critical" | "exceeded";

export type CancellationReason =
  | "too_expensive"
  | "missing_features"
  | "technical_issues"
  | "switching_competitor"
  | "temporary"
  | "other";

export type PauseDuration = 1 | 2 | 3;

// ============================================
// SUBSCRIPTION
// ============================================

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: PlanId;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  pause_collection_until: string | null;
  trial_end: string | null;
  territoire: Territoire;
  tva_taux: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// USAGE
// ============================================

export interface UsageRecord {
  metric: UsageMetric;
  current_value: number;
  max_value: number;
  percentage: number;
  alert_level: AlertLevel;
}

export interface UsageSummary {
  biens: UsageRecord;
  signatures: UsageRecord;
  utilisateurs: UsageRecord;
  stockage_mb: UsageRecord;
}

// ============================================
// INVOICE
// ============================================

export interface Invoice {
  id: string;
  number: string;
  status: BillingInvoiceStatus;
  amount_ht: number;
  amount_tva: number;
  amount_ttc: number;
  tva_taux: number;
  period_start: string;
  period_end: string;
  pdf_url: string | null;
  hosted_url: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface InvoicesResponse {
  invoices: Invoice[];
  has_more: boolean;
  next_cursor: string | null;
}

// ============================================
// PAYMENT METHOD
// ============================================

/**
 * Moyen de paiement Stripe (carte bancaire enregistrée)
 * @see PaymentMethod dans @/lib/types/index.ts pour les méthodes de paiement métier
 */
export interface BillingPaymentMethod {
  id: string;
  brand: "visa" | "mastercard" | "amex" | "discover" | "unknown";
  last4: string;
  exp_month: number;
  exp_year: number;
}

/** @deprecated Utiliser BillingPaymentMethod */
export type PaymentMethod = BillingPaymentMethod;

// ============================================
// PLAN
// ============================================

export interface PlanFeatureItem {
  label: string;
  included: boolean;
  tooltip?: string;
}

export interface PlanFeatureGroup {
  category: string;
  features: PlanFeatureItem[];
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  price_monthly_ht: number;
  price_yearly_ht: number;
  yearly_discount_percent: number;
  limits: Record<UsageMetric, number>;
  features: PlanFeatureGroup[];
  stripe_price_monthly: string;
  stripe_price_yearly: string;
}

// ============================================
// BILLING AGGREGATE (API response)
// ============================================

export interface BillingData {
  subscription: Subscription;
  usage: UsageSummary;
  plan: PlanDefinition;
  payment_method: BillingPaymentMethod | null;
}

// ============================================
// API PAYLOADS
// ============================================

export interface UpgradePayload {
  new_plan_id: PlanId;
  billing_cycle?: BillingCycle;
}

export interface DowngradePayload {
  new_plan_id: PlanId;
}

export interface PausePayload {
  duration_months: PauseDuration;
}

export interface CancelPayload {
  reason: CancellationReason;
  reason_detail?: string;
}
