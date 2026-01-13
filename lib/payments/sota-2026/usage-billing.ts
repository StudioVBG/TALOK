/**
 * Usage-Based Billing Service
 * SOTA 2026 - Metered billing with Stripe Meters
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import type {
  UsageMeter,
  UsageRecord,
  UsageSummaryByMeter,
  CreditBalance,
  CreditTransaction,
  CreditPackage,
} from './types';

// ============================================
// USAGE METERS
// ============================================

/**
 * Create a new usage meter
 */
export async function createUsageMeter(
  name: string,
  eventName: string,
  aggregation: 'sum' | 'count' | 'max' | 'last' = 'sum',
  defaultUnit: string = 'units'
): Promise<UsageMeter> {
  const supabase = createServiceRoleClient();

  // Create Stripe meter if possible
  let stripeMeter: Stripe.Billing.Meter | null = null;
  try {
    stripeMeter = await stripe.billing.meters.create({
      display_name: name,
      event_name: eventName,
      default_aggregation: { formula: aggregation },
    });
  } catch (error) {
    console.warn('[UsageBilling] Could not create Stripe meter:', error);
  }

  const { data, error } = await supabase
    .from('usage_meters')
    .insert({
      name,
      event_name: eventName,
      aggregation,
      default_unit: defaultUnit,
      stripe_meter_id: stripeMeter?.id || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as UsageMeter;
}

/**
 * Get all active usage meters
 */
export async function getUsageMeters(): Promise<UsageMeter[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('usage_meters')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return (data || []) as UsageMeter[];
}

// ============================================
// USAGE RECORDING
// ============================================

/**
 * Record usage event
 */
export async function recordUsage(
  subscriptionId: string,
  meterName: string,
  quantity: number,
  timestamp?: Date,
  metadata?: Record<string, unknown>
): Promise<UsageRecord> {
  const supabase = createServiceRoleClient();

  // Get meter
  const { data: meter } = await supabase
    .from('usage_meters')
    .select('*')
    .eq('name', meterName)
    .single();

  if (!meter) {
    throw new Error(`Usage meter not found: ${meterName}`);
  }

  // Generate idempotency key
  const idempotencyKey = `${subscriptionId}-${meter.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Record in Stripe if meter exists
  let stripeEventId: string | null = null;
  if (meter.stripe_meter_id) {
    try {
      // Get subscription's Stripe customer
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('id', subscriptionId)
        .single();

      if (subscription?.stripe_customer_id) {
        const event = await stripe.billing.meterEvents.create({
          event_name: meter.event_name,
          payload: {
            stripe_customer_id: subscription.stripe_customer_id,
            value: quantity.toString(),
          },
          timestamp: timestamp ? Math.floor(timestamp.getTime() / 1000) : undefined,
        });
        stripeEventId = event.identifier;
      }
    } catch (error) {
      console.warn('[UsageBilling] Could not record Stripe meter event:', error);
    }
  }

  // Record locally
  const { data, error } = await supabase
    .from('usage_records')
    .insert({
      subscription_id: subscriptionId,
      meter_id: meter.id,
      quantity,
      timestamp: (timestamp || new Date()).toISOString(),
      idempotency_key: idempotencyKey,
      stripe_event_id: stripeEventId,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as UsageRecord;
}

/**
 * Record signature usage (convenience function)
 */
export async function recordSignatureUsage(
  subscriptionId: string,
  signatureId: string,
  documentType: string = 'lease'
): Promise<UsageRecord> {
  return recordUsage(subscriptionId, 'signatures', 1, undefined, {
    signature_id: signatureId,
    document_type: documentType,
  });
}

/**
 * Record API call usage (convenience function)
 */
export async function recordAPIUsage(
  subscriptionId: string,
  endpoint: string,
  calls: number = 1
): Promise<UsageRecord> {
  return recordUsage(subscriptionId, 'api_calls', calls, undefined, {
    endpoint,
  });
}

/**
 * Record storage usage (convenience function)
 */
export async function recordStorageUsage(
  subscriptionId: string,
  bytes: number,
  operation: 'upload' | 'delete'
): Promise<UsageRecord> {
  const quantity = operation === 'delete' ? -bytes : bytes;
  return recordUsage(subscriptionId, 'storage', quantity, undefined, {
    operation,
  });
}

// ============================================
// USAGE SUMMARIES
// ============================================

/**
 * Get usage summary for a subscription by all meters
 */
export async function getUsageSummary(
  subscriptionId: string
): Promise<UsageSummaryByMeter[]> {
  const supabase = createServiceRoleClient();

  // Get subscription with plan
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select(`
      current_period_start,
      current_period_end,
      plan:subscription_plans(features)
    `)
    .eq('id', subscriptionId)
    .single();

  if (!subscription) return [];

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

  // Calculate previous period
  const prevPeriodStart = new Date(periodStart);
  prevPeriodStart.setMonth(prevPeriodStart.getMonth() - 1);
  const prevPeriodEnd = new Date(periodStart);
  prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);

  // Get all meters
  const meters = await getUsageMeters();
  const summaries: UsageSummaryByMeter[] = [];

  for (const meter of meters) {
    // Current period usage
    const { data: currentUsage } = await supabase
      .from('usage_records')
      .select('quantity')
      .eq('subscription_id', subscriptionId)
      .eq('meter_id', meter.id)
      .gte('timestamp', periodStart.toISOString())
      .lte('timestamp', periodEnd.toISOString());

    // Previous period usage
    const { data: prevUsage } = await supabase
      .from('usage_records')
      .select('quantity')
      .eq('subscription_id', subscriptionId)
      .eq('meter_id', meter.id)
      .gte('timestamp', prevPeriodStart.toISOString())
      .lte('timestamp', prevPeriodEnd.toISOString());

    const currentQuantity = (currentUsage || []).reduce((sum, r) => sum + r.quantity, 0);
    const prevQuantity = (prevUsage || []).reduce((sum, r) => sum + r.quantity, 0);

    // Get included quota from plan
    const features = subscription.plan?.features || {};
    let included = 0;
    let overagePrice = 0;

    switch (meter.name) {
      case 'signatures':
        included = (features.signatures_monthly_quota as number) || 0;
        overagePrice = (features.signature_price as number) || 390; // €3.90 default
        break;
      case 'api_calls':
        included = (features.api_calls_monthly as number) || 10000;
        overagePrice = 0.001; // €0.001 per call
        break;
      case 'storage':
        included = ((features.max_documents_gb as number) || 5) * 1024 * 1024 * 1024; // Convert to bytes
        overagePrice = 0.10; // €0.10 per GB
        break;
    }

    const overage = Math.max(0, currentQuantity - included);
    const overageCost = overage * overagePrice / 100; // Convert from cents

    const trend = prevQuantity > 0
      ? ((currentQuantity - prevQuantity) / prevQuantity) * 100
      : 0;

    summaries.push({
      meter_id: meter.id,
      meter_name: meter.name,
      current_period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        quantity: currentQuantity,
        included,
        overage,
        overage_cost: Math.round(overageCost * 100) / 100,
      },
      previous_period: {
        quantity: prevQuantity,
        cost: 0, // Historical cost not tracked yet
      },
      trend: Math.round(trend * 10) / 10,
    });
  }

  return summaries;
}

/**
 * Calculate overage charges for a subscription
 */
export async function calculateOverageCharges(
  subscriptionId: string
): Promise<{ total: number; breakdown: Array<{ meter: string; overage: number; cost: number }> }> {
  const summaries = await getUsageSummary(subscriptionId);

  const breakdown = summaries
    .filter(s => s.current_period.overage > 0)
    .map(s => ({
      meter: s.meter_name,
      overage: s.current_period.overage,
      cost: s.current_period.overage_cost,
    }));

  const total = breakdown.reduce((sum, b) => sum + b.cost, 0);

  return {
    total: Math.round(total * 100) / 100,
    breakdown,
  };
}

// ============================================
// CREDIT SYSTEM
// ============================================

/**
 * Get or create credit balance for a user
 */
export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const supabase = createServiceRoleClient();

  // Get subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('owner_id', userId)
    .single();

  // Try to get existing balance
  const { data: existing } = await supabase
    .from('credit_balances')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    return existing as CreditBalance;
  }

  // Create new balance
  const { data, error } = await supabase
    .from('credit_balances')
    .insert({
      user_id: userId,
      subscription_id: subscription?.id || null,
      balance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CreditBalance;
}

/**
 * Add credits to a user's balance
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: CreditTransaction['type'],
  description: string,
  referenceType?: CreditTransaction['reference_type'],
  referenceId?: string,
  expiresAt?: Date
): Promise<CreditTransaction> {
  const supabase = createServiceRoleClient();

  // Get current balance
  const balance = await getCreditBalance(userId);

  // Calculate new balance
  const newBalance = balance.balance + amount;

  // Update balance
  await supabase
    .from('credit_balances')
    .update({
      balance: newBalance,
      lifetime_earned: balance.lifetime_earned + (amount > 0 ? amount : 0),
      expires_at: expiresAt?.toISOString() || balance.expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', balance.id);

  // Create transaction record
  const { data, error } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      type,
      amount,
      balance_after: newBalance,
      description,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      expires_at: expiresAt?.toISOString() || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CreditTransaction;
}

/**
 * Spend credits from a user's balance
 */
export async function spendCredits(
  userId: string,
  amount: number,
  description: string,
  referenceType?: CreditTransaction['reference_type'],
  referenceId?: string
): Promise<{ success: boolean; transaction?: CreditTransaction; error?: string }> {
  const supabase = createServiceRoleClient();

  // Get current balance
  const balance = await getCreditBalance(userId);

  if (balance.balance < amount) {
    return {
      success: false,
      error: `Solde insuffisant. Disponible: ${balance.balance}, Requis: ${amount}`,
    };
  }

  // Calculate new balance
  const newBalance = balance.balance - amount;

  // Update balance
  await supabase
    .from('credit_balances')
    .update({
      balance: newBalance,
      lifetime_spent: balance.lifetime_spent + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', balance.id);

  // Create transaction record
  const { data, error } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      type: 'spent',
      amount: -amount,
      balance_after: newBalance,
      description,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    transaction: data as CreditTransaction,
  };
}

/**
 * Get credit transaction history
 */
export async function getCreditHistory(
  userId: string,
  limit: number = 50
): Promise<CreditTransaction[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CreditTransaction[];
}

/**
 * Get available credit packages
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('credit_packages')
    .select('*')
    .eq('is_active', true)
    .order('credits');

  if (error) throw error;
  return (data || []) as CreditPackage[];
}

/**
 * Purchase a credit package
 */
export async function purchaseCreditPackage(
  userId: string,
  packageId: string
): Promise<{ clientSecret: string; transaction?: CreditTransaction }> {
  const supabase = createServiceRoleClient();

  // Get package
  const { data: pkg } = await supabase
    .from('credit_packages')
    .select('*')
    .eq('id', packageId)
    .eq('is_active', true)
    .single();

  if (!pkg) {
    throw new Error('Package not found');
  }

  // Get user's Stripe customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    // Create Stripe customer
    const customer = await stripe.customers.create({
      metadata: { user_id: userId },
    });
    customerId = customer.id;

    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', userId);
  }

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: pkg.price,
    currency: 'eur',
    customer: customerId,
    metadata: {
      type: 'credit_purchase',
      package_id: packageId,
      credits: (pkg.credits + pkg.bonus_credits).toString(),
      user_id: userId,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret!,
  };
}

/**
 * Handle successful credit purchase (called from webhook)
 */
export async function handleCreditPurchase(
  userId: string,
  packageId: string
): Promise<CreditTransaction> {
  const supabase = createServiceRoleClient();

  // Get package
  const { data: pkg } = await supabase
    .from('credit_packages')
    .select('*')
    .eq('id', packageId)
    .single();

  if (!pkg) {
    throw new Error('Package not found');
  }

  const totalCredits = pkg.credits + pkg.bonus_credits;

  // Add credits (expire in 1 year)
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  return addCredits(
    userId,
    totalCredits,
    'purchased',
    `Achat pack ${pkg.name}: ${pkg.credits} crédits${pkg.bonus_credits > 0 ? ` + ${pkg.bonus_credits} bonus` : ''}`,
    'purchase',
    packageId,
    expiresAt
  );
}

// ============================================
// MONTHLY CREDIT ALLOCATION
// ============================================

/**
 * Allocate monthly credits from subscription plan
 * Should be called at the start of each billing period
 */
export async function allocateMonthlyCredits(subscriptionId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  // Get subscription with plan
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select(`
      owner_id,
      plan:subscription_plans(features)
    `)
    .eq('id', subscriptionId)
    .single();

  if (!subscription) return;

  const features = subscription.plan?.features || {};
  const monthlySignatures = (features.signatures_monthly_quota as number) || 0;

  if (monthlySignatures > 0) {
    // Allocate signature credits
    await addCredits(
      subscription.owner_id,
      monthlySignatures,
      'earned',
      `Allocation mensuelle: ${monthlySignatures} signatures`,
      'subscription',
      subscriptionId
    );
  }
}

/**
 * Expire old credits (run daily via cron)
 */
export async function expireOldCredits(): Promise<number> {
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  // Get transactions with expired credits that haven't been marked
  const { data: expiring } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('type', 'earned')
    .lt('expires_at', now)
    .gt('amount', 0);

  let expiredCount = 0;

  for (const tx of expiring || []) {
    // Create expiration transaction
    await addCredits(
      tx.user_id,
      -tx.amount,
      'expired',
      `Crédits expirés (origine: ${tx.description})`,
      tx.reference_type,
      tx.reference_id
    );
    expiredCount += tx.amount;
  }

  return expiredCount;
}
