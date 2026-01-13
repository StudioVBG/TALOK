/**
 * Smart Dunning Service
 * SOTA 2026 - AI-powered payment recovery
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import type {
  DunningSequence,
  DunningStep,
  DunningAttempt,
  DunningAttemptLog,
  ChurnPrediction,
  ChurnFactor,
  ChurnAction,
} from './types';

// ============================================
// DEFAULT DUNNING SEQUENCES
// ============================================

export const DEFAULT_DUNNING_SEQUENCE: DunningStep[] = [
  {
    day: 0,
    action: 'soft_reminder_email',
    template_id: 'payment_failed_day0',
    channel: 'email',
  },
  {
    day: 3,
    action: 'sms_reminder',
    template_id: 'payment_reminder_sms',
    channel: 'sms',
    fallback_channel: 'email',
  },
  {
    day: 7,
    action: 'payment_method_update_request',
    template_id: 'update_payment_method',
    channel: 'email',
  },
  {
    day: 14,
    action: 'offer_payment_plan',
    template_id: 'payment_plan_offer',
    channel: 'email',
  },
  {
    day: 21,
    action: 'final_warning',
    template_id: 'final_warning',
    channel: 'email',
  },
  {
    day: 30,
    action: 'graceful_downgrade',
    template_id: 'graceful_downgrade',
    channel: 'email',
  },
];

export const VIP_DUNNING_SEQUENCE: DunningStep[] = [
  {
    day: 0,
    action: 'soft_reminder_email',
    template_id: 'vip_payment_failed',
    channel: 'email',
  },
  {
    day: 2,
    action: 'soft_reminder_email',
    template_id: 'vip_friendly_reminder',
    channel: 'email',
  },
  {
    day: 5,
    action: 'payment_method_update_request',
    template_id: 'vip_update_payment',
    channel: 'email',
  },
  {
    day: 10,
    action: 'offer_payment_plan',
    template_id: 'vip_payment_plan',
    channel: 'email',
  },
  {
    day: 20,
    action: 'final_warning',
    template_id: 'vip_final_warning',
    channel: 'email',
  },
  {
    day: 45,
    action: 'graceful_downgrade',
    template_id: 'vip_downgrade',
    channel: 'email',
  },
];

// ============================================
// DUNNING MANAGEMENT
// ============================================

/**
 * Start a dunning process for a failed payment
 */
export async function startDunningProcess(
  subscriptionId: string,
  userId: string,
  paymentIntentId: string,
  amount: number,
  currency: string = 'eur'
): Promise<DunningAttempt> {
  const supabase = createServiceRoleClient();

  // Check if there's already an active dunning for this subscription
  const { data: existing } = await supabase
    .from('dunning_attempts')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .eq('status', 'active')
    .single();

  if (existing) {
    return existing as DunningAttempt;
  }

  // Determine which sequence to use based on customer value
  const sequence = await selectDunningSequence(userId);

  // Create dunning attempt
  const { data: attempt, error } = await supabase
    .from('dunning_attempts')
    .insert({
      subscription_id: subscriptionId,
      user_id: userId,
      sequence_id: sequence.id,
      current_step: 0,
      status: 'active',
      payment_intent_id: paymentIntentId,
      amount_due: amount,
      currency,
      attempts: [],
    })
    .select()
    .single();

  if (error) throw error;

  // Execute first step immediately
  await executeDunningStep(attempt.id, 0);

  return attempt as DunningAttempt;
}

/**
 * Select appropriate dunning sequence based on customer attributes
 */
async function selectDunningSequence(userId: string): Promise<DunningSequence> {
  const supabase = createServiceRoleClient();

  // Check if user is VIP (high LTV, long tenure, enterprise plan)
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select(`
      created_at,
      plan:subscription_plans(slug, price_monthly)
    `)
    .eq('owner_id', userId)
    .single();

  const isVIP = subscription?.plan?.slug?.startsWith('enterprise') ||
                (subscription?.plan?.price_monthly || 0) >= 6900; // €69+

  // Get or create appropriate sequence
  const sequenceSlug = isVIP ? 'vip' : 'default';
  const { data: dbSequence } = await supabase
    .from('dunning_sequences')
    .select('*')
    .eq('slug', sequenceSlug)
    .single();

  if (dbSequence) {
    return dbSequence as DunningSequence;
  }

  // Return default in-memory sequence
  return {
    id: isVIP ? 'vip-default' : 'default',
    name: isVIP ? 'VIP Dunning' : 'Standard Dunning',
    description: isVIP ? 'Gentle recovery for VIP customers' : 'Standard payment recovery',
    steps: isVIP ? VIP_DUNNING_SEQUENCE : DEFAULT_DUNNING_SEQUENCE,
    is_default: !isVIP,
    created_at: new Date().toISOString(),
  };
}

/**
 * Execute a specific dunning step
 */
async function executeDunningStep(
  attemptId: string,
  stepIndex: number
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Get the attempt
  const { data: attempt } = await supabase
    .from('dunning_attempts')
    .select('*')
    .eq('id', attemptId)
    .single();

  if (!attempt || attempt.status !== 'active') return;

  // Get sequence
  const { data: sequence } = await supabase
    .from('dunning_sequences')
    .select('steps')
    .eq('id', attempt.sequence_id)
    .single();

  const steps = (sequence?.steps as DunningStep[]) || DEFAULT_DUNNING_SEQUENCE;
  const step = steps[stepIndex];

  if (!step) {
    // No more steps, mark as failed
    await supabase
      .from('dunning_attempts')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
      })
      .eq('id', attemptId);
    return;
  }

  // Execute the action
  let result: 'sent' | 'failed' = 'sent';

  try {
    switch (step.action) {
      case 'soft_reminder_email':
      case 'payment_method_update_request':
      case 'final_warning':
        await sendDunningEmail(attempt.user_id, step.template_id, {
          amount: attempt.amount_due,
          currency: attempt.currency,
        });
        break;

      case 'sms_reminder':
        await sendDunningSMS(attempt.user_id, step.template_id, {
          amount: attempt.amount_due,
        });
        break;

      case 'offer_payment_plan':
        await createPaymentPlanOffer(attempt.user_id, attempt.amount_due);
        await sendDunningEmail(attempt.user_id, step.template_id, {
          amount: attempt.amount_due,
          currency: attempt.currency,
        });
        break;

      case 'graceful_downgrade':
        await performGracefulDowngrade(attempt.subscription_id);
        await sendDunningEmail(attempt.user_id, step.template_id, {});
        break;

      case 'account_suspension':
        await suspendAccount(attempt.subscription_id);
        break;
    }
  } catch (error) {
    console.error('[SmartDunning] Step execution failed:', error);
    result = 'failed';
  }

  // Log the attempt
  const log: DunningAttemptLog = {
    step: stepIndex,
    action: step.action,
    channel: step.channel,
    sent_at: new Date().toISOString(),
    opened_at: null,
    clicked_at: null,
    result,
    notes: null,
  };

  const attempts = [...(attempt.attempts as DunningAttemptLog[] || []), log];

  await supabase
    .from('dunning_attempts')
    .update({
      current_step: stepIndex,
      attempts,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attemptId);
}

/**
 * Process dunning steps for all active attempts
 * Should be called by a cron job daily
 */
export async function processDunningQueue(): Promise<{
  processed: number;
  recovered: number;
  failed: number;
}> {
  const supabase = createServiceRoleClient();
  let processed = 0;
  let recovered = 0;
  let failed = 0;

  // Get all active dunning attempts
  const { data: attempts } = await supabase
    .from('dunning_attempts')
    .select('*')
    .eq('status', 'active');

  for (const attempt of attempts || []) {
    processed++;

    // Check if payment was recovered
    if (attempt.payment_intent_id) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          attempt.payment_intent_id
        );

        if (paymentIntent.status === 'succeeded') {
          // Payment recovered!
          await supabase
            .from('dunning_attempts')
            .update({
              status: 'recovered',
              recovered_at: new Date().toISOString(),
            })
            .eq('id', attempt.id);

          recovered++;

          // Send recovery confirmation
          await sendDunningEmail(attempt.user_id, 'payment_recovered', {
            amount: attempt.amount_due,
            currency: attempt.currency,
          });

          continue;
        }
      } catch (error) {
        console.error('[SmartDunning] Error checking payment status:', error);
      }
    }

    // Get sequence steps
    const { data: sequence } = await supabase
      .from('dunning_sequences')
      .select('steps')
      .eq('id', attempt.sequence_id)
      .single();

    const steps = (sequence?.steps as DunningStep[]) || DEFAULT_DUNNING_SEQUENCE;

    // Find next step to execute
    const daysSinceStart = Math.floor(
      (Date.now() - new Date(attempt.started_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    const nextStepIndex = steps.findIndex((step, idx) =>
      idx > attempt.current_step && step.day <= daysSinceStart
    );

    if (nextStepIndex !== -1) {
      await executeDunningStep(attempt.id, nextStepIndex);
    } else if (attempt.current_step >= steps.length - 1) {
      // All steps exhausted
      await supabase
        .from('dunning_attempts')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
        })
        .eq('id', attempt.id);

      failed++;
    }
  }

  return { processed, recovered, failed };
}

// ============================================
// CHURN PREDICTION
// ============================================

/**
 * Calculate churn risk for a user
 */
export async function calculateChurnRisk(userId: string): Promise<ChurnPrediction> {
  const supabase = createServiceRoleClient();

  // Get user data
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:subscription_plans(slug, price_monthly)
    `)
    .eq('owner_id', userId)
    .single();

  // Get usage data
  const { data: usage } = await supabase
    .from('subscription_usage')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  // Get payment history
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);

  // Get support tickets (if available)
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Calculate risk factors
  const factors: ChurnFactor[] = [];
  let totalRisk = 0;

  // Factor 1: Payment failures
  const failedPayments = (payments || []).filter(p => p.statut === 'failed').length;
  if (failedPayments > 0) {
    const weight = Math.min(failedPayments * 15, 40);
    totalRisk += weight;
    factors.push({
      factor: 'payment_failures',
      weight,
      description: `${failedPayments} paiement(s) échoué(s) récemment`,
      trend: failedPayments > 1 ? 'worsening' : 'stable',
    });
  }

  // Factor 2: Usage decline
  const recentUsage = (usage || []).slice(0, 7);
  const olderUsage = (usage || []).slice(7, 14);
  const avgRecent = recentUsage.reduce((sum, u) => sum + (u.api_calls_this_month || 0), 0) / Math.max(recentUsage.length, 1);
  const avgOlder = olderUsage.reduce((sum, u) => sum + (u.api_calls_this_month || 0), 0) / Math.max(olderUsage.length, 1);

  if (avgOlder > 0 && avgRecent < avgOlder * 0.5) {
    const weight = 25;
    totalRisk += weight;
    factors.push({
      factor: 'usage_decline',
      weight,
      description: 'Utilisation en baisse de plus de 50%',
      trend: 'worsening',
    });
  } else if (avgRecent > avgOlder * 1.2) {
    // Positive factor
    factors.push({
      factor: 'usage_growth',
      weight: -10,
      description: 'Utilisation en hausse',
      trend: 'improving',
    });
    totalRisk -= 10;
  }

  // Factor 3: Support tickets sentiment
  const recentTickets = (tickets || []).filter(t =>
    new Date(t.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  if (recentTickets.length >= 3) {
    const weight = 20;
    totalRisk += weight;
    factors.push({
      factor: 'support_volume',
      weight,
      description: `${recentTickets.length} tickets support ce mois`,
      trend: 'worsening',
    });
  }

  // Factor 4: Trial about to end
  if (subscription?.status === 'trialing' && subscription.trial_end) {
    const daysUntilEnd = Math.floor(
      (new Date(subscription.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilEnd <= 3 && daysUntilEnd >= 0) {
      const weight = 15;
      totalRisk += weight;
      factors.push({
        factor: 'trial_ending',
        weight,
        description: `Essai se termine dans ${daysUntilEnd} jours`,
        trend: 'stable',
      });
    }
  }

  // Factor 5: Cancel at period end
  if (subscription?.cancel_at_period_end) {
    const weight = 50;
    totalRisk += weight;
    factors.push({
      factor: 'cancel_scheduled',
      weight,
      description: 'Annulation programmée en fin de période',
      trend: 'worsening',
    });
  }

  // Factor 6: Long tenure (reduces risk)
  if (subscription?.created_at) {
    const monthsSinceCreation = Math.floor(
      (Date.now() - new Date(subscription.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    if (monthsSinceCreation > 12) {
      const weight = -15;
      totalRisk += weight;
      factors.push({
        factor: 'tenure',
        weight,
        description: `Client depuis ${monthsSinceCreation} mois`,
        trend: 'improving',
      });
    }
  }

  // Normalize risk score
  const riskScore = Math.max(0, Math.min(100, totalRisk));

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (riskScore >= 70) riskLevel = 'critical';
  else if (riskScore >= 50) riskLevel = 'high';
  else if (riskScore >= 25) riskLevel = 'medium';

  // Generate recommended actions
  const actions: ChurnAction[] = [];

  if (failedPayments > 0) {
    actions.push({
      action: 'Envoyer rappel de mise à jour de moyen de paiement',
      priority: 'high',
      expected_impact: 20,
      automated: true,
    });
  }

  if (avgRecent < avgOlder * 0.5) {
    actions.push({
      action: 'Appel de réengagement par le CSM',
      priority: 'high',
      expected_impact: 30,
      automated: false,
    });
    actions.push({
      action: 'Envoyer tutoriels de nouvelles fonctionnalités',
      priority: 'medium',
      expected_impact: 10,
      automated: true,
    });
  }

  if (subscription?.cancel_at_period_end) {
    actions.push({
      action: 'Proposer offre de rétention (réduction 20%)',
      priority: 'high',
      expected_impact: 40,
      automated: true,
    });
  }

  if (riskLevel === 'critical') {
    actions.push({
      action: 'Escalade vers Account Manager',
      priority: 'high',
      expected_impact: 50,
      automated: false,
    });
  }

  return {
    user_id: userId,
    subscription_id: subscription?.id || '',
    risk_score: riskScore,
    risk_level: riskLevel,
    factors: factors.sort((a, b) => b.weight - a.weight),
    recommended_actions: actions,
    predicted_churn_date: subscription?.current_period_end || null,
    confidence: factors.length > 2 ? 0.8 : 0.6,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Batch calculate churn risk for all active subscriptions
 * Should be run weekly by cron
 */
export async function calculateAllChurnRisks(): Promise<ChurnPrediction[]> {
  const supabase = createServiceRoleClient();

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('owner_id')
    .in('status', ['active', 'trialing']);

  const predictions: ChurnPrediction[] = [];

  for (const sub of subscriptions || []) {
    try {
      const prediction = await calculateChurnRisk(sub.owner_id);
      predictions.push(prediction);

      // Store prediction
      await supabase.from('churn_predictions').upsert({
        user_id: prediction.user_id,
        subscription_id: prediction.subscription_id,
        risk_score: prediction.risk_score,
        risk_level: prediction.risk_level,
        factors: prediction.factors,
        recommended_actions: prediction.recommended_actions,
        confidence: prediction.confidence,
        calculated_at: prediction.calculated_at,
      });
    } catch (error) {
      console.error(`[SmartDunning] Failed to calculate churn risk for ${sub.owner_id}:`, error);
    }
  }

  return predictions;
}

/**
 * Get high-risk accounts for proactive intervention
 */
export async function getHighRiskAccounts(
  limit: number = 50
): Promise<ChurnPrediction[]> {
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from('churn_predictions')
    .select('*')
    .in('risk_level', ['high', 'critical'])
    .order('risk_score', { ascending: false })
    .limit(limit);

  return (data || []) as ChurnPrediction[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sendDunningEmail(
  userId: string,
  templateId: string,
  variables: Record<string, unknown>
): Promise<void> {
  // TODO: Integrate with email service (Resend, SendGrid, etc.)
  console.log(`[SmartDunning] Sending email ${templateId} to user ${userId}`, variables);
}

async function sendDunningSMS(
  userId: string,
  templateId: string,
  variables: Record<string, unknown>
): Promise<void> {
  // TODO: Integrate with SMS service (Twilio, etc.)
  console.log(`[SmartDunning] Sending SMS ${templateId} to user ${userId}`, variables);
}

async function createPaymentPlanOffer(
  userId: string,
  amount: number
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Create a payment plan (split amount into 3 payments)
  const installmentAmount = Math.ceil(amount / 3);

  await supabase.from('payment_plan_offers').insert({
    user_id: userId,
    total_amount: amount,
    installments: 3,
    installment_amount: installmentAmount,
    status: 'offered',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  });
}

async function performGracefulDowngrade(subscriptionId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  // Get the free plan
  const { data: freePlan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('slug', 'gratuit')
    .single();

  if (freePlan) {
    await supabase
      .from('subscriptions')
      .update({
        plan_id: freePlan.id,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);
  }
}

async function suspendAccount(subscriptionId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  await supabase
    .from('subscriptions')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);
}

// ============================================
// RETRY OPTIMIZATION
// ============================================

/**
 * Optimize payment retry timing using ML insights
 */
export async function getOptimalRetryTime(
  userId: string
): Promise<{ hour: number; dayOfWeek: number; confidence: number }> {
  const supabase = createServiceRoleClient();

  // Get historical successful payments
  const { data: payments } = await supabase
    .from('payments')
    .select('created_at, statut')
    .eq('owner_id', userId)
    .eq('statut', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!payments || payments.length < 5) {
    // Not enough data, return defaults
    return {
      hour: 10, // 10 AM
      dayOfWeek: 1, // Monday
      confidence: 0.3,
    };
  }

  // Analyze successful payment times
  const hours: number[] = [];
  const days: number[] = [];

  payments.forEach(p => {
    const date = new Date(p.created_at);
    hours.push(date.getHours());
    days.push(date.getDay());
  });

  // Find most common hour and day
  const hourCounts = hours.reduce((acc, h) => {
    acc[h] = (acc[h] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const dayCounts = days.reduce((acc, d) => {
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  const bestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    hour: parseInt(bestHour[0]),
    dayOfWeek: parseInt(bestDay[0]),
    confidence: Math.min(0.9, 0.3 + (payments.length / 20) * 0.6),
  };
}
