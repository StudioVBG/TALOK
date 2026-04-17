/**
 * SMS metered billing — wraps sendSMS with usage tracking & Stripe reporting
 */

import { createServiceRoleClient } from '@/lib/supabase/service-client';
import { stripe } from '@/lib/stripe';
import { sendSMS, type SendSmsParams, type SendSmsResult } from '@/lib/sms';

/**
 * Send an SMS, track usage in sms_usage table, and report to Stripe metered billing.
 */
export async function sendTrackedSMS(
  profileId: string,
  options: Omit<SendSmsParams, 'context'> & { context?: Partial<SendSmsParams['context']> }
): Promise<SendSmsResult> {
  const result = await sendSMS({
    to: options.to,
    body: options.body,
    context: {
      type: options.context?.type ?? 'notification',
      profileId: options.context?.profileId ?? profileId,
      userId: options.context?.userId,
      relatedId: options.context?.relatedId,
    },
  });
  if (!result.success) return result;

  const supabase = createServiceRoleClient();
  const month = new Date().toISOString().slice(0, 7);

  // 2. Increment usage atomically
  await supabase.rpc('increment_sms_usage', {
    p_profile_id: profileId,
    p_month: month,
  });

  // 3. Report to Stripe metered billing
  const { data: addon } = await supabase
    .from('subscription_addons')
    .select('stripe_subscription_item_id')
    .eq('profile_id', profileId)
    .eq('addon_type', 'sms')
    .eq('status', 'active')
    .single();

  if (addon?.stripe_subscription_item_id) {
    try {
      await stripe.subscriptionItems.createUsageRecord(
        addon.stripe_subscription_item_id,
        {
          quantity: 1,
          timestamp: Math.floor(Date.now() / 1000),
        }
      );
    } catch (error) {
      console.error('[SMS Billing] Failed to report usage to Stripe:', error);
    }
  }

  return result;
}

/**
 * Get SMS usage for a profile in the current month
 */
export async function getSMSUsage(
  profileId: string,
  month?: string
): Promise<{ count: number; month: string }> {
  const supabase = createServiceRoleClient();
  const targetMonth = month || new Date().toISOString().slice(0, 7);

  const { data } = await supabase
    .from('sms_usage')
    .select('count')
    .eq('profile_id', profileId)
    .eq('month', targetMonth)
    .single();

  return {
    count: (data as any)?.count || 0,
    month: targetMonth,
  };
}
