/**
 * Types pour le système d'abonnements
 * Compatible avec le schéma BDD existant
 */

import type { PlanSlug, BillingCycle, SubscriptionStatus } from './plans';

// ============================================
// SUBSCRIPTION
// ============================================

export interface Subscription {
  id: string;
  owner_id: string;
  plan_id: string;
  
  // Status
  status: SubscriptionStatus;
  
  // Stripe
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  
  // Billing
  billing_cycle: BillingCycle;
  current_period_start: string | null;
  current_period_end: string | null;
  
  // Trial
  trial_start: string | null;
  trial_end: string | null;
  
  // Cancellation
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  
  // Usage actuel (stocké dans subscriptions)
  properties_count: number;
  leases_count: number;
  tenants_count: number;
  documents_size_mb: number;
  
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: PlanSlug;
  price_monthly: number;
  price_yearly: number;
  max_properties: number;
  max_leases: number;
  max_tenants: number;
  max_documents_gb: number;
  features: Record<string, boolean | string | number>;
}

export interface SubscriptionWithPlan extends Subscription {
  plan: SubscriptionPlan | null;
  plan_slug: PlanSlug;
  user_id?: string; // Pour compatibilité
}

// ============================================
// USAGE
// ============================================

export interface SubscriptionUsage {
  id: string;
  subscription_id: string | null;
  user_id: string;
  
  properties_count: number;
  leases_count: number;
  users_count: number;
  signatures_used_this_month: number;
  storage_used_bytes: number;
  api_calls_this_month: number;
  
  period_start: string;
  period_end: string;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface UsageSummary {
  properties: { used: number; limit: number; percentage: number };
  leases: { used: number; limit: number; percentage: number };
  users: { used: number; limit: number; percentage: number };
  signatures: { used: number; limit: number; percentage: number };
  storage: { used: number; limit: number; percentage: number; unit: string };
}

// ============================================
// EVENTS
// ============================================

export type SubscriptionEventType =
  | 'created'
  | 'upgraded'
  | 'downgraded'
  | 'canceled'
  | 'reactivated'
  | 'trial_started'
  | 'trial_ended'
  | 'trial_converted'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'payment_refunded'
  | 'invoice_created'
  | 'invoice_paid'
  | 'invoice_failed'
  | 'plan_changed'
  | 'promo_applied'
  | 'gift_received'
  | 'suspended'
  | 'unsuspended';

export interface SubscriptionEvent {
  id: string;
  subscription_id: string | null;
  user_id: string;
  event_type: SubscriptionEventType;
  from_plan: string | null;
  to_plan: string | null;
  stripe_event_id: string | null;
  amount: number | null;
  currency: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================
// INVOICES
// ============================================

/**
 * Statut de facture d'abonnement (aligné Stripe)
 */
export type SubscriptionInvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

/**
 * @deprecated Utilisez SubscriptionInvoiceStatus à la place
 * Sera supprimé dans 4 semaines
 */
export type InvoiceStatus = SubscriptionInvoiceStatus;

export interface SubscriptionInvoice {
  id: string;
  subscription_id: string | null;
  owner_id: string;
  stripe_invoice_id: string | null;
  invoice_number: string | null;

  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  currency: string;

  status: SubscriptionInvoiceStatus;
  
  invoice_pdf_url: string | null;
  hosted_invoice_url: string | null;
  
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  paid_at: string | null;
  
  lines: InvoiceLine[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unit_amount: number;
  amount: number;
}

// ============================================
// PROMO CODES
// ============================================

export type PromoDiscountType = 'percent' | 'fixed';

export interface PromoCode {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  
  discount_type: PromoDiscountType;
  discount_value: number;
  
  applicable_plans: PlanSlug[];
  min_billing_cycle: BillingCycle | null;
  first_subscription_only: boolean;
  
  max_uses: number | null;
  uses_count: number;
  max_uses_per_user: number;
  
  valid_from: string;
  valid_until: string | null;
  
  stripe_coupon_id: string | null;
  
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromoCodeValidation {
  valid: boolean;
  code: PromoCode | null;
  error?: string;
  discount_amount?: number;
  final_price?: number;
}

// ============================================
// ADMIN
// ============================================

export type AdminActionType =
  | 'plan_override'
  | 'gift_days'
  | 'suspend'
  | 'unsuspend'
  | 'reactivate'
  | 'cancel'
  | 'apply_promo'
  | 'remove_promo'
  | 'note_added'
  | 'email_sent'
  | 'refund'
  | 'credit_added';

export interface AdminSubscriptionAction {
  id: string;
  admin_user_id: string;
  target_user_id: string;
  action_type: AdminActionType;
  
  from_plan: string | null;
  to_plan: string | null;
  gift_days: number | null;
  promo_code: string | null;
  amount: number | null;
  
  reason: string;
  internal_note: string | null;
  notify_user: boolean;
  
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminUserNote {
  id: string;
  user_id: string;
  admin_id: string;
  note: string;
  is_important: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// API RESPONSES
// ============================================

export interface SubscriptionResponse {
  subscription: SubscriptionWithPlan;
  usage: UsageSummary;
  invoices: SubscriptionInvoice[];
  canUpgrade: boolean;
  canDowngrade: boolean;
  daysUntilRenewal: number | null;
  isTrialing: boolean;
  trialDaysRemaining: number | null;
}

export interface PlansResponse {
  plans: Array<{
    slug: PlanSlug;
    name: string;
    description: string;
    tagline: string;
    price_monthly: number | null;
    price_yearly: number | null;
    limits: Record<string, number>;
    features: Record<string, boolean | string | number>;
    highlights: string[];
    is_popular: boolean;
    cta_text: string;
    trial_days: number;
  }>;
}

export interface CheckoutResponse {
  url: string;
  session_id: string;
}

export interface PortalResponse {
  url: string;
}

// ============================================
// ADMIN STATS
// ============================================

export interface SubscriptionStats {
  total_users: number;
  paying_users: number;
  free_users: number;
  trialing_users: number;
  canceled_users: number;
  mrr: number;
  arr: number;
  arpu: number;
}

export interface PlanDistribution {
  plan_slug: PlanSlug;
  plan_name: string;
  count: number;
  percentage: number;
}

export interface AdminSubscriptionOverview {
  user_id: string;
  email: string;
  user_created_at: string;
  prenom: string | null;
  nom: string | null;
  user_role: string;
  subscription_id: string | null;
  plan_slug: PlanSlug;
  plan_name: string;
  price_monthly: number | null;
  status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  properties_count: number;
  leases_count: number;
  signatures_used_this_month: number;
  max_properties: number;
  max_signatures: number;
  mrr_contribution: number;
}

// ============================================
// ACTIONS
// ============================================

export interface UpgradeRequest {
  plan_slug: PlanSlug;
  billing_cycle: BillingCycle;
  promo_code?: string;
}

export interface DowngradeRequest {
  plan_slug: PlanSlug;
  reason?: string;
  feedback?: string;
}

export interface CancelRequest {
  reason: string;
  feedback?: string;
  immediately?: boolean;
}

export interface AdminOverrideRequest {
  user_id: string;
  action: 'upgrade' | 'downgrade' | 'gift' | 'suspend' | 'unsuspend' | 'reactivate' | 'cancel';
  target_plan?: PlanSlug;
  gift_days?: number;
  reason: string;
  notify_user: boolean;
  internal_note?: string;
}

export interface AdminApplyPromoRequest {
  user_id: string;
  promo_code: string;
  reason: string;
  notify_user: boolean;
}
