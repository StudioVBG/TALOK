/**
 * SOTA 2026 Payment System Types
 * State-of-the-art payment infrastructure
 */

// ============================================
// REVENUE INTELLIGENCE
// ============================================

export interface RevenueMetrics {
  // Core SaaS Metrics
  mrr: number;                    // Monthly Recurring Revenue
  arr: number;                    // Annual Recurring Revenue
  nrr: number;                    // Net Revenue Retention (%)
  grr: number;                    // Gross Revenue Retention (%)
  arpu: number;                   // Average Revenue Per User
  arppu: number;                  // Average Revenue Per Paying User
  ltv: number;                    // Lifetime Value
  cac: number;                    // Customer Acquisition Cost (if available)
  ltv_cac_ratio: number;          // LTV/CAC Ratio

  // MRR Breakdown
  mrr_new: number;                // New MRR
  mrr_expansion: number;          // Expansion MRR (upgrades)
  mrr_contraction: number;        // Contraction MRR (downgrades)
  mrr_churn: number;              // Churned MRR
  mrr_reactivation: number;       // Reactivated MRR

  // Churn Metrics
  churn_rate: number;             // Monthly churn rate (%)
  revenue_churn_rate: number;     // Revenue churn rate (%)

  // Growth Metrics
  growth_rate: number;            // Month-over-month growth (%)
  quick_ratio: number;            // (New + Expansion) / (Contraction + Churn)

  // Period
  period_start: string;
  period_end: string;
  calculated_at: string;
}

export interface CohortData {
  cohort_month: string;           // YYYY-MM
  total_customers: number;
  months: CohortMonth[];
}

export interface CohortMonth {
  month_number: number;           // 0 = acquisition month
  active_customers: number;
  retention_rate: number;         // %
  revenue: number;
  revenue_retention: number;      // %
}

export interface RevenueForecasting {
  forecast_months: ForecastMonth[];
  confidence_interval: number;    // e.g., 0.95 for 95%
  model_accuracy: number;         // Historical accuracy %
  assumptions: string[];
}

export interface ForecastMonth {
  month: string;                  // YYYY-MM
  predicted_mrr: number;
  lower_bound: number;
  upper_bound: number;
  predicted_customers: number;
  predicted_churn: number;
}

// ============================================
// SMART DUNNING
// ============================================

export type DunningSequenceStep =
  | 'soft_reminder_email'
  | 'sms_reminder'
  | 'payment_method_update_request'
  | 'offer_payment_plan'
  | 'final_warning'
  | 'graceful_downgrade'
  | 'account_suspension';

export interface DunningSequence {
  id: string;
  name: string;
  description: string;
  steps: DunningStep[];
  is_default: boolean;
  created_at: string;
}

export interface DunningStep {
  day: number;                    // Days after payment failure
  action: DunningSequenceStep;
  template_id: string;            // Email/SMS template
  channel: 'email' | 'sms' | 'push' | 'in_app';
  fallback_channel?: 'email' | 'sms';
  conditions?: DunningCondition[];
}

export interface DunningCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: string | number | boolean;
}

export interface DunningAttempt {
  id: string;
  subscription_id: string;
  user_id: string;
  sequence_id: string;
  current_step: number;
  status: 'active' | 'recovered' | 'failed' | 'cancelled';
  payment_intent_id: string | null;
  amount_due: number;
  currency: string;
  attempts: DunningAttemptLog[];
  started_at: string;
  recovered_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DunningAttemptLog {
  step: number;
  action: DunningSequenceStep;
  channel: string;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  result: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  notes: string | null;
}

export interface ChurnPrediction {
  user_id: string;
  subscription_id: string;
  risk_score: number;             // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factors: ChurnFactor[];
  recommended_actions: ChurnAction[];
  predicted_churn_date: string | null;
  confidence: number;             // 0-1
  calculated_at: string;
}

export interface ChurnFactor {
  factor: string;
  weight: number;                 // Contribution to risk score
  description: string;
  trend: 'improving' | 'stable' | 'worsening';
}

export interface ChurnAction {
  action: string;
  priority: 'low' | 'medium' | 'high';
  expected_impact: number;        // % reduction in churn risk
  automated: boolean;
}

// ============================================
// USAGE-BASED BILLING
// ============================================

export interface UsageMeter {
  id: string;
  name: string;
  event_name: string;             // e.g., 'signature_created'
  aggregation: 'sum' | 'count' | 'max' | 'last';
  default_unit: string;           // e.g., 'signatures'
  stripe_meter_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UsageRecord {
  id: string;
  subscription_id: string;
  meter_id: string;
  quantity: number;
  timestamp: string;
  idempotency_key: string;
  stripe_event_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UsageSummaryByMeter {
  meter_id: string;
  meter_name: string;
  current_period: {
    start: string;
    end: string;
    quantity: number;
    included: number;
    overage: number;
    overage_cost: number;
  };
  previous_period: {
    quantity: number;
    cost: number;
  };
  trend: number;                  // % change
}

// ============================================
// CREDIT SYSTEM
// ============================================

export interface CreditBalance {
  id: string;
  user_id: string;
  subscription_id: string;
  balance: number;                // Current credit balance
  lifetime_earned: number;        // Total credits ever earned
  lifetime_spent: number;         // Total credits ever spent
  expires_at: string | null;      // Oldest credits expiration
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: 'earned' | 'spent' | 'expired' | 'purchased' | 'gifted' | 'refunded';
  amount: number;                 // Positive for earned, negative for spent
  balance_after: number;
  description: string;
  reference_type: 'subscription' | 'signature' | 'purchase' | 'promo' | 'admin';
  reference_id: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;                  // In cents
  bonus_credits: number;          // Extra credits (e.g., "Buy 100, get 20 free")
  stripe_price_id: string | null;
  is_active: boolean;
  popular: boolean;
}

// ============================================
// TENANT REWARDS
// ============================================

export interface TenantRewardsAccount {
  id: string;
  tenant_id: string;
  points_balance: number;
  lifetime_points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  tier_progress: number;          // Progress to next tier (%)
  payment_streak: number;         // Consecutive on-time payments
  longest_streak: number;
  rewards_earned: number;         // Total value of rewards earned
  created_at: string;
  updated_at: string;
}

export interface RewardTransaction {
  id: string;
  account_id: string;
  type: 'earned' | 'redeemed' | 'expired' | 'bonus';
  points: number;
  description: string;
  reference_type: 'rent_payment' | 'referral' | 'streak_bonus' | 'redemption' | 'promo';
  reference_id: string | null;
  partner_id: string | null;
  created_at: string;
}

export interface RewardPartner {
  id: string;
  name: string;
  logo_url: string;
  category: 'dining' | 'shopping' | 'entertainment' | 'travel' | 'services' | 'utilities';
  points_per_euro: number;
  description: string;
  terms: string;
  is_active: boolean;
  is_featured: boolean;
}

export interface RewardRedemption {
  id: string;
  account_id: string;
  partner_id: string;
  points_spent: number;
  value: number;                  // Euro value
  code: string | null;            // Redemption code if applicable
  status: 'pending' | 'confirmed' | 'used' | 'expired' | 'cancelled';
  expires_at: string | null;
  created_at: string;
}

// ============================================
// EMBEDDED FINANCE
// ============================================

export interface FinancingOffer {
  id: string;
  user_id: string;
  user_type: 'owner' | 'tenant';
  offer_type: 'rent_advance' | 'deposit_split' | 'work_loan' | 'bnpl';
  status: 'available' | 'applied' | 'approved' | 'active' | 'completed' | 'declined';
  amount_min: number;
  amount_max: number;
  apr: number;                    // Annual percentage rate
  term_months: number;
  monthly_payment: number | null;
  stripe_capital_offer_id: string | null;
  expires_at: string;
  created_at: string;
}

export interface FinancingApplication {
  id: string;
  offer_id: string;
  user_id: string;
  requested_amount: number;
  approved_amount: number | null;
  term_months: number;
  status: 'pending' | 'under_review' | 'approved' | 'declined' | 'cancelled';
  decision_at: string | null;
  decline_reason: string | null;
  stripe_application_id: string | null;
  created_at: string;
}

export interface InstantPayout {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  destination: 'bank_account' | 'debit_card';
  stripe_payout_id: string | null;
  arrival_date: string;
  created_at: string;
}

// ============================================
// PAYMENT METHODS 2026
// ============================================

export interface PaymentMethodPreference {
  user_id: string;
  default_method: string | null;
  saved_methods: SavedPaymentMethod[];
  autopay_enabled: boolean;
  autopay_method_id: string | null;
  preferred_day: number | null;   // Day of month for autopay
}

export interface SavedPaymentMethod {
  id: string;
  stripe_payment_method_id: string;
  type: 'card' | 'sepa_debit' | 'link' | 'paypal' | 'klarna' | 'apple_pay' | 'google_pay';
  last4: string | null;
  brand: string | null;
  exp_month: number | null;
  exp_year: number | null;
  bank_name: string | null;
  is_default: boolean;
  created_at: string;
}

// ============================================
// FINANCIAL OS / RECONCILIATION
// ============================================

export interface BankConnection {
  id: string;
  user_id: string;
  provider: 'plaid' | 'bridge' | 'tink' | 'nordigen';
  institution_name: string;
  institution_logo: string | null;
  account_id: string;
  account_name: string;
  account_type: 'checking' | 'savings';
  last_synced_at: string;
  status: 'active' | 'error' | 'disconnected';
  created_at: string;
}

export interface BankTransaction {
  id: string;
  connection_id: string;
  user_id: string;
  transaction_id: string;         // From bank
  date: string;
  amount: number;
  currency: string;
  description: string;
  category: string | null;
  counterparty: string | null;
  is_matched: boolean;
  matched_payment_id: string | null;
  match_confidence: number | null;
  created_at: string;
}

export interface ReconciliationRule {
  id: string;
  user_id: string;
  name: string;
  conditions: ReconciliationCondition[];
  action: 'auto_match' | 'suggest' | 'ignore';
  property_id: string | null;     // Optional filter
  tenant_id: string | null;       // Optional filter
  priority: number;
  is_active: boolean;
  created_at: string;
}

export interface ReconciliationCondition {
  field: 'amount' | 'description' | 'counterparty' | 'date';
  operator: 'equals' | 'contains' | 'starts_with' | 'range' | 'regex';
  value: string | number | [number, number];
}

export interface ReconciliationSuggestion {
  id: string;
  bank_transaction_id: string;
  suggested_payment_id: string;
  confidence: number;             // 0-100
  match_reasons: string[];
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

// ============================================
// ANALYTICS & REPORTING
// ============================================

export interface PaymentAnalytics {
  period: string;                 // YYYY-MM

  // Volume
  total_transactions: number;
  total_volume: number;
  average_transaction: number;

  // Success rates by method
  by_payment_method: {
    method: string;
    transactions: number;
    volume: number;
    success_rate: number;
    average_time_to_success: number;  // seconds
  }[];

  // Failure analysis
  failure_reasons: {
    reason: string;
    count: number;
    percentage: number;
  }[];

  // Time analysis
  by_day_of_week: {
    day: number;
    transactions: number;
    success_rate: number;
  }[];

  by_hour: {
    hour: number;
    transactions: number;
    success_rate: number;
  }[];
}

export interface SubscriptionAnalytics {
  period: string;

  // Movements
  new_subscriptions: number;
  upgrades: number;
  downgrades: number;
  cancellations: number;
  reactivations: number;

  // By plan
  by_plan: {
    plan_slug: string;
    count: number;
    mrr: number;
    churn_rate: number;
  }[];

  // Conversion funnel
  trial_starts: number;
  trial_conversions: number;
  trial_conversion_rate: number;

  // Revenue
  new_mrr: number;
  expansion_mrr: number;
  contraction_mrr: number;
  churned_mrr: number;
  net_mrr_change: number;
}
