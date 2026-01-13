/**
 * Revenue Intelligence Service
 * SOTA 2026 - AI-powered revenue analytics
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import type {
  RevenueMetrics,
  CohortData,
  CohortMonth,
  RevenueForecasting,
  ForecastMonth,
  SubscriptionAnalytics,
} from './types';

// ============================================
// CORE REVENUE METRICS
// ============================================

/**
 * Calculate comprehensive revenue metrics
 */
export async function calculateRevenueMetrics(
  periodStart?: Date,
  periodEnd?: Date
): Promise<RevenueMetrics> {
  const supabase = createServiceRoleClient();

  const now = new Date();
  const start = periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
  const end = periodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Previous period for comparison
  const prevStart = new Date(start);
  prevStart.setMonth(prevStart.getMonth() - 1);
  const prevEnd = new Date(end);
  prevEnd.setMonth(prevEnd.getMonth() - 1);

  // Get all subscriptions with plans
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      owner_id,
      status,
      billing_cycle,
      created_at,
      canceled_at,
      plan:subscription_plans(
        slug,
        name,
        price_monthly,
        price_yearly
      )
    `);

  if (error || !subscriptions) {
    throw new Error(`Failed to fetch subscriptions: ${error?.message}`);
  }

  // Get subscription events for the period
  const { data: events } = await supabase
    .from('subscription_events')
    .select('*')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  // Calculate metrics
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
  const payingSubscriptions = activeSubscriptions.filter(s =>
    s.plan?.price_monthly && s.plan.price_monthly > 0
  );

  // MRR calculation
  const mrr = payingSubscriptions.reduce((sum, sub) => {
    const plan = sub.plan;
    if (!plan) return sum;

    if (sub.billing_cycle === 'yearly' && plan.price_yearly) {
      return sum + (plan.price_yearly / 12);
    }
    return sum + (plan.price_monthly || 0);
  }, 0);

  // MRR Breakdown
  const newEvents = (events || []).filter(e => e.event_type === 'created');
  const upgradeEvents = (events || []).filter(e => e.event_type === 'upgraded');
  const downgradeEvents = (events || []).filter(e => e.event_type === 'downgraded');
  const cancelEvents = (events || []).filter(e => e.event_type === 'canceled');
  const reactivateEvents = (events || []).filter(e => e.event_type === 'reactivated');

  const mrr_new = newEvents.reduce((sum, e) => sum + (e.amount || 0), 0);
  const mrr_expansion = upgradeEvents.reduce((sum, e) => sum + (e.amount || 0), 0);
  const mrr_contraction = Math.abs(downgradeEvents.reduce((sum, e) => sum + (e.amount || 0), 0));
  const mrr_churn = Math.abs(cancelEvents.reduce((sum, e) => sum + (e.amount || 0), 0));
  const mrr_reactivation = reactivateEvents.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Churn calculations
  const totalCustomersStart = subscriptions.filter(s =>
    new Date(s.created_at) < start &&
    (!s.canceled_at || new Date(s.canceled_at) >= start)
  ).length;

  const churnedCustomers = cancelEvents.length;
  const churn_rate = totalCustomersStart > 0
    ? (churnedCustomers / totalCustomersStart) * 100
    : 0;

  const revenue_churn_rate = mrr > 0
    ? (mrr_churn / mrr) * 100
    : 0;

  // Growth and retention
  const nrr = mrr > 0
    ? ((mrr + mrr_expansion - mrr_contraction - mrr_churn) / mrr) * 100
    : 100;

  const grr = mrr > 0
    ? ((mrr - mrr_contraction - mrr_churn) / mrr) * 100
    : 100;

  // Quick ratio
  const quick_ratio = (mrr_contraction + mrr_churn) > 0
    ? (mrr_new + mrr_expansion + mrr_reactivation) / (mrr_contraction + mrr_churn)
    : mrr_new + mrr_expansion + mrr_reactivation > 0 ? 999 : 0;

  // ARPU / ARPPU
  const totalUsers = subscriptions.length;
  const payingUsers = payingSubscriptions.length;
  const arpu = totalUsers > 0 ? mrr / totalUsers : 0;
  const arppu = payingUsers > 0 ? mrr / payingUsers : 0;

  // LTV (simplified: ARPPU / monthly churn rate)
  const monthlyChurnRate = churn_rate / 100;
  const ltv = monthlyChurnRate > 0 ? arppu / monthlyChurnRate : arppu * 24; // 2 years default

  // Growth rate (simplified, would need previous period data)
  const growth_rate = 0; // TODO: Compare with previous period

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    nrr: Math.round(nrr * 100) / 100,
    grr: Math.round(grr * 100) / 100,
    arpu: Math.round(arpu * 100) / 100,
    arppu: Math.round(arppu * 100) / 100,
    ltv: Math.round(ltv * 100) / 100,
    cac: 0, // Would need marketing spend data
    ltv_cac_ratio: 0, // Would need CAC

    mrr_new: Math.round(mrr_new * 100) / 100,
    mrr_expansion: Math.round(mrr_expansion * 100) / 100,
    mrr_contraction: Math.round(mrr_contraction * 100) / 100,
    mrr_churn: Math.round(mrr_churn * 100) / 100,
    mrr_reactivation: Math.round(mrr_reactivation * 100) / 100,

    churn_rate: Math.round(churn_rate * 100) / 100,
    revenue_churn_rate: Math.round(revenue_churn_rate * 100) / 100,

    growth_rate: Math.round(growth_rate * 100) / 100,
    quick_ratio: Math.round(quick_ratio * 100) / 100,

    period_start: start.toISOString(),
    period_end: end.toISOString(),
    calculated_at: new Date().toISOString(),
  };
}

// ============================================
// COHORT ANALYSIS
// ============================================

/**
 * Generate cohort retention data
 */
export async function generateCohortAnalysis(
  months: number = 12
): Promise<CohortData[]> {
  const supabase = createServiceRoleClient();
  const cohorts: CohortData[] = [];

  // Get all subscriptions
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      owner_id,
      status,
      created_at,
      canceled_at,
      billing_cycle,
      plan:subscription_plans(price_monthly, price_yearly)
    `)
    .order('created_at', { ascending: true });

  if (error || !subscriptions) {
    return cohorts;
  }

  const now = new Date();

  // Group by acquisition month
  const cohortMap = new Map<string, typeof subscriptions>();

  subscriptions.forEach(sub => {
    const cohortMonth = sub.created_at.substring(0, 7); // YYYY-MM
    if (!cohortMap.has(cohortMonth)) {
      cohortMap.set(cohortMonth, []);
    }
    cohortMap.get(cohortMonth)!.push(sub);
  });

  // Calculate retention for each cohort
  for (const [cohortMonth, subs] of cohortMap) {
    const cohortStart = new Date(cohortMonth + '-01');
    const monthsSinceStart = Math.floor(
      (now.getTime() - cohortStart.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    if (monthsSinceStart < 0 || monthsSinceStart > months) continue;

    const cohortMonths: CohortMonth[] = [];

    for (let m = 0; m <= Math.min(monthsSinceStart, months); m++) {
      const checkDate = new Date(cohortStart);
      checkDate.setMonth(checkDate.getMonth() + m);
      const checkEnd = new Date(checkDate);
      checkEnd.setMonth(checkEnd.getMonth() + 1);

      // Count active customers at this point
      const activeAtMonth = subs.filter(sub => {
        const createdAt = new Date(sub.created_at);
        const canceledAt = sub.canceled_at ? new Date(sub.canceled_at) : null;

        return createdAt <= checkEnd &&
               (!canceledAt || canceledAt > checkDate);
      });

      // Calculate revenue
      const revenue = activeAtMonth.reduce((sum, sub) => {
        const plan = sub.plan;
        if (!plan) return sum;
        if (sub.billing_cycle === 'yearly' && plan.price_yearly) {
          return sum + (plan.price_yearly / 12);
        }
        return sum + (plan.price_monthly || 0);
      }, 0);

      const initialRevenue = m === 0 ? revenue : (cohortMonths[0]?.revenue || revenue);

      cohortMonths.push({
        month_number: m,
        active_customers: activeAtMonth.length,
        retention_rate: subs.length > 0
          ? Math.round((activeAtMonth.length / subs.length) * 100 * 10) / 10
          : 0,
        revenue: Math.round(revenue * 100) / 100,
        revenue_retention: initialRevenue > 0
          ? Math.round((revenue / initialRevenue) * 100 * 10) / 10
          : 0,
      });
    }

    cohorts.push({
      cohort_month: cohortMonth,
      total_customers: subs.length,
      months: cohortMonths,
    });
  }

  // Return most recent cohorts first
  return cohorts.reverse().slice(0, months);
}

// ============================================
// REVENUE FORECASTING
// ============================================

/**
 * Generate revenue forecast using simple exponential smoothing
 * In production, this would use ML models
 */
export async function generateRevenueForecast(
  months: number = 12
): Promise<RevenueForecasting> {
  const supabase = createServiceRoleClient();
  const forecasts: ForecastMonth[] = [];

  // Get historical MRR data
  const { data: metrics } = await supabase
    .from('revenue_metrics_history')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(12);

  // If no historical data, use current metrics
  const currentMetrics = await calculateRevenueMetrics();

  const historicalMRR = metrics?.map(m => m.mrr) || [];
  const lastMRR = currentMetrics.mrr;

  // Simple forecasting with growth assumption
  const avgGrowth = historicalMRR.length >= 2
    ? historicalMRR.reduce((sum, mrr, i, arr) => {
        if (i === 0) return sum;
        return sum + ((mrr - arr[i - 1]) / arr[i - 1]);
      }, 0) / (historicalMRR.length - 1)
    : 0.02; // Default 2% monthly growth

  const churnRate = currentMetrics.churn_rate / 100;
  const volatility = 0.15; // 15% volatility for confidence intervals

  const now = new Date();

  for (let m = 1; m <= months; m++) {
    const forecastDate = new Date(now);
    forecastDate.setMonth(forecastDate.getMonth() + m);
    const month = forecastDate.toISOString().substring(0, 7);

    // Compound growth with churn
    const netGrowth = avgGrowth - churnRate;
    const predictedMRR = lastMRR * Math.pow(1 + netGrowth, m);

    // Confidence interval widens over time
    const intervalWidth = predictedMRR * volatility * Math.sqrt(m);

    forecasts.push({
      month,
      predicted_mrr: Math.round(predictedMRR * 100) / 100,
      lower_bound: Math.round((predictedMRR - intervalWidth) * 100) / 100,
      upper_bound: Math.round((predictedMRR + intervalWidth) * 100) / 100,
      predicted_customers: Math.round(
        (currentMetrics.mrr > 0 ? predictedMRR / currentMetrics.arppu : 0)
      ),
      predicted_churn: Math.round(churnRate * 100 * 10) / 10,
    });
  }

  return {
    forecast_months: forecasts,
    confidence_interval: 0.80, // 80% confidence
    model_accuracy: 0, // Would need historical accuracy tracking
    assumptions: [
      `Croissance mensuelle moyenne: ${Math.round(avgGrowth * 100 * 10) / 10}%`,
      `Taux de churn: ${Math.round(churnRate * 100 * 10) / 10}%`,
      `Volatilité: ${Math.round(volatility * 100)}%`,
      'Modèle: Lissage exponentiel simple',
    ],
  };
}

// ============================================
// MRR WATERFALL
// ============================================

export interface MRRWaterfallData {
  month: string;
  starting_mrr: number;
  new_mrr: number;
  expansion_mrr: number;
  contraction_mrr: number;
  churned_mrr: number;
  reactivation_mrr: number;
  ending_mrr: number;
  net_change: number;
}

/**
 * Generate MRR waterfall data for visualization
 */
export async function generateMRRWaterfall(
  months: number = 6
): Promise<MRRWaterfallData[]> {
  const supabase = createServiceRoleClient();
  const waterfall: MRRWaterfallData[] = [];

  const now = new Date();

  for (let m = months - 1; m >= 0; m--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 0);

    const metrics = await calculateRevenueMetrics(monthStart, monthEnd);

    // Get previous month's ending MRR
    const prevMonthEnd = new Date(monthStart);
    prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
    const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);

    let startingMRR = 0;
    if (m < months - 1 && waterfall.length > 0) {
      startingMRR = waterfall[waterfall.length - 1].ending_mrr;
    } else {
      // Calculate starting MRR from subscriptions active at month start
      const { data: subs } = await supabase
        .from('subscriptions')
        .select(`
          status,
          billing_cycle,
          created_at,
          canceled_at,
          plan:subscription_plans(price_monthly, price_yearly)
        `)
        .lte('created_at', monthStart.toISOString())
        .or(`canceled_at.is.null,canceled_at.gte.${monthStart.toISOString()}`);

      startingMRR = (subs || [])
        .filter(s => s.status === 'active' ||
          (s.canceled_at && new Date(s.canceled_at) > monthStart))
        .reduce((sum, sub) => {
          const plan = sub.plan;
          if (!plan) return sum;
          if (sub.billing_cycle === 'yearly' && plan.price_yearly) {
            return sum + (plan.price_yearly / 12);
          }
          return sum + (plan.price_monthly || 0);
        }, 0);
    }

    const netChange = metrics.mrr_new + metrics.mrr_expansion +
                      metrics.mrr_reactivation - metrics.mrr_contraction -
                      metrics.mrr_churn;

    waterfall.push({
      month: monthStart.toISOString().substring(0, 7),
      starting_mrr: Math.round(startingMRR * 100) / 100,
      new_mrr: metrics.mrr_new,
      expansion_mrr: metrics.mrr_expansion,
      contraction_mrr: metrics.mrr_contraction,
      churned_mrr: metrics.mrr_churn,
      reactivation_mrr: metrics.mrr_reactivation,
      ending_mrr: Math.round((startingMRR + netChange) * 100) / 100,
      net_change: Math.round(netChange * 100) / 100,
    });
  }

  return waterfall;
}

// ============================================
// SUBSCRIPTION ANALYTICS
// ============================================

/**
 * Get detailed subscription analytics for a period
 */
export async function getSubscriptionAnalytics(
  periodStart?: Date,
  periodEnd?: Date
): Promise<SubscriptionAnalytics> {
  const supabase = createServiceRoleClient();

  const now = new Date();
  const start = periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
  const end = periodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get events for the period
  const { data: events } = await supabase
    .from('subscription_events')
    .select('*')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  // Count by event type
  const newSubscriptions = (events || []).filter(e => e.event_type === 'created').length;
  const upgrades = (events || []).filter(e => e.event_type === 'upgraded').length;
  const downgrades = (events || []).filter(e => e.event_type === 'downgraded').length;
  const cancellations = (events || []).filter(e => e.event_type === 'canceled').length;
  const reactivations = (events || []).filter(e => e.event_type === 'reactivated').length;

  // Trial metrics
  const trialStarts = (events || []).filter(e => e.event_type === 'trial_started').length;
  const trialConversions = (events || []).filter(e => e.event_type === 'trial_converted').length;

  // Get plan distribution
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select(`
      status,
      billing_cycle,
      plan:subscription_plans(slug, price_monthly, price_yearly)
    `)
    .eq('status', 'active');

  const planMap = new Map<string, { count: number; mrr: number }>();

  (subscriptions || []).forEach(sub => {
    const slug = sub.plan?.slug || 'unknown';
    if (!planMap.has(slug)) {
      planMap.set(slug, { count: 0, mrr: 0 });
    }
    const entry = planMap.get(slug)!;
    entry.count++;

    const plan = sub.plan;
    if (plan) {
      if (sub.billing_cycle === 'yearly' && plan.price_yearly) {
        entry.mrr += plan.price_yearly / 12;
      } else {
        entry.mrr += plan.price_monthly || 0;
      }
    }
  });

  const byPlan = Array.from(planMap.entries()).map(([slug, data]) => ({
    plan_slug: slug,
    count: data.count,
    mrr: Math.round(data.mrr * 100) / 100,
    churn_rate: 0, // Would need plan-specific churn calculation
  }));

  // MRR calculations
  const new_mrr = (events || [])
    .filter(e => e.event_type === 'created')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const expansion_mrr = (events || [])
    .filter(e => e.event_type === 'upgraded')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const contraction_mrr = Math.abs((events || [])
    .filter(e => e.event_type === 'downgraded')
    .reduce((sum, e) => sum + (e.amount || 0), 0));

  const churned_mrr = Math.abs((events || [])
    .filter(e => e.event_type === 'canceled')
    .reduce((sum, e) => sum + (e.amount || 0), 0));

  return {
    period: start.toISOString().substring(0, 7),
    new_subscriptions: newSubscriptions,
    upgrades,
    downgrades,
    cancellations,
    reactivations,
    by_plan: byPlan,
    trial_starts: trialStarts,
    trial_conversions: trialConversions,
    trial_conversion_rate: trialStarts > 0
      ? Math.round((trialConversions / trialStarts) * 100 * 10) / 10
      : 0,
    new_mrr: Math.round(new_mrr * 100) / 100,
    expansion_mrr: Math.round(expansion_mrr * 100) / 100,
    contraction_mrr: Math.round(contraction_mrr * 100) / 100,
    churned_mrr: Math.round(churned_mrr * 100) / 100,
    net_mrr_change: Math.round((new_mrr + expansion_mrr - contraction_mrr - churned_mrr) * 100) / 100,
  };
}

// ============================================
// STORE METRICS HISTORY
// ============================================

/**
 * Store current metrics for historical tracking
 * Should be called daily by a cron job
 */
export async function storeMetricsSnapshot(): Promise<void> {
  const supabase = createServiceRoleClient();
  const metrics = await calculateRevenueMetrics();

  await supabase.from('revenue_metrics_history').insert({
    mrr: metrics.mrr,
    arr: metrics.arr,
    nrr: metrics.nrr,
    grr: metrics.grr,
    arpu: metrics.arpu,
    arppu: metrics.arppu,
    ltv: metrics.ltv,
    churn_rate: metrics.churn_rate,
    revenue_churn_rate: metrics.revenue_churn_rate,
    mrr_new: metrics.mrr_new,
    mrr_expansion: metrics.mrr_expansion,
    mrr_contraction: metrics.mrr_contraction,
    mrr_churn: metrics.mrr_churn,
    mrr_reactivation: metrics.mrr_reactivation,
    quick_ratio: metrics.quick_ratio,
    period_start: metrics.period_start,
    period_end: metrics.period_end,
  });
}
