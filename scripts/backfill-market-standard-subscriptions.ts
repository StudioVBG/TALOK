import "dotenv/config";

import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  buildSubscriptionUpdateFromStripe,
  getLiveOwnerUsage,
  resolvePlanIdentifiers,
} from "@/lib/subscriptions/market-standard";
import { syncPropertyBillingToStripe } from "@/lib/stripe/sync-property-billing";

async function main() {
  const supabase = createServiceRoleClient();
  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select("id, owner_id, plan_id, plan_slug, stripe_subscription_id, stripe_customer_id");

  if (error) {
    throw error;
  }

  for (const subscription of subscriptions || []) {
    const resolvedPlan = await resolvePlanIdentifiers(supabase as any, {
      planId: subscription.plan_id || null,
      planSlug: subscription.plan_slug || null,
    });

    const updatePayload: Record<string, unknown> = {
      plan_id: resolvedPlan.id,
      plan_slug: resolvedPlan.slug,
      selected_plan_at: new Date().toISOString(),
      selected_plan_source: subscription.stripe_subscription_id ? "backfill_stripe" : "backfill_local",
    };

    if (subscription.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        Object.assign(
          updatePayload,
          await buildSubscriptionUpdateFromStripe(supabase as any, stripeSubscription, {
            planId: resolvedPlan.id,
            planSlug: resolvedPlan.slug,
            metadata: {
              source: "backfill_script",
            },
          })
        );
      } catch (stripeError) {
        console.warn(
          `[backfill-market-standard-subscriptions] Impossible de synchroniser Stripe pour ${subscription.id}:`,
          stripeError
        );
      }
    }

    if (subscription.owner_id) {
      const usage = await getLiveOwnerUsage(supabase as any, subscription.owner_id);
      updatePayload.properties_count = usage.properties;
      updatePayload.leases_count = usage.leases;
    }

    await supabase
      .from("subscriptions")
      .update(updatePayload)
      .eq("id", subscription.id);

    if (subscription.owner_id && subscription.stripe_subscription_id) {
      try {
        await syncPropertyBillingToStripe(subscription.owner_id);
      } catch (syncError) {
        console.warn(
          `[backfill-market-standard-subscriptions] Sync biens supplementaires en echec pour ${subscription.owner_id}:`,
          syncError
        );
      }
    }
  }

  console.log(
    `[backfill-market-standard-subscriptions] ${subscriptions?.length || 0} abonnement(s) verifie(s).`
  );
}

main().catch((error) => {
  console.error("[backfill-market-standard-subscriptions] Fatal error:", error);
  process.exit(1);
});
