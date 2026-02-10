import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe-client";
import { getAlertLevel, getUsagePercentage } from "@/lib/billing-utils";
import type { BillingData, UsageMetric, UsageSummary, PlanFeatureGroup, Territoire } from "@/types/billing";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    // Fetch subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: "Aucun abonnement trouve" }, { status: 404 });
    }

    // Fetch plan
    const { data: planData } = await supabase
      .from("plans")
      .select("*")
      .eq("id", subscription.plan_id)
      .single();

    // Fetch usage
    const { data: usageData } = await supabase
      .from("subscription_usage")
      .select("*")
      .eq("subscription_id", subscription.id)
      .single();

    // Fetch payment method from Stripe if available
    let paymentMethod = null;
    if (subscription.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
          expand: ["default_payment_method"],
        });
        const pm = stripeSub.default_payment_method;
        if (pm && typeof pm !== "string" && pm.card) {
          paymentMethod = {
            id: pm.id,
            brand: (pm.card.brand || "unknown") as "visa" | "mastercard" | "amex" | "discover" | "unknown",
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          };
        }
      } catch {
        // Stripe unavailable — no payment method
      }
    }

    // Build usage summary
    const limits = planData?.limits || {};
    const buildUsageRecord = (metric: UsageMetric, current: number, max: number) => ({
      metric,
      current_value: current,
      max_value: max,
      percentage: getUsagePercentage(current, max),
      alert_level: getAlertLevel(current, max),
    });

    const usage: UsageSummary = {
      biens: buildUsageRecord("biens", usageData?.properties_count || 0, limits.max_properties ?? -1),
      signatures: buildUsageRecord("signatures", usageData?.signatures_used || 0, limits.signatures_monthly_quota ?? -1),
      utilisateurs: buildUsageRecord("utilisateurs", usageData?.users_count || 0, limits.max_users ?? -1),
      stockage_mb: buildUsageRecord("stockage_mb", usageData?.storage_mb || 0, (limits.max_documents_gb ?? -1) * 1024),
    };

    // Build plan features
    const features: PlanFeatureGroup[] = planData?.feature_groups || [];

    const territoire: Territoire = subscription.territoire || "metropole";

    const response: BillingData = {
      subscription: {
        id: subscription.id,
        user_id: subscription.user_id,
        plan_id: subscription.plan_id,
        status: subscription.status,
        billing_cycle: subscription.billing_cycle || "monthly",
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        pause_collection_until: subscription.pause_collection_until || null,
        trial_end: subscription.trial_end || null,
        territoire,
        tva_taux: subscription.tva_taux || 20,
        stripe_customer_id: subscription.stripe_customer_id || null,
        stripe_subscription_id: subscription.stripe_subscription_id || null,
        created_at: subscription.created_at,
        updated_at: subscription.updated_at,
      },
      usage,
      plan: {
        id: planData?.slug || subscription.plan_id,
        name: planData?.name || "Plan",
        description: planData?.description || "",
        price_monthly_ht: planData?.price_monthly || 0,
        price_yearly_ht: planData?.price_yearly || 0,
        yearly_discount_percent: planData?.yearly_discount_percent || 20,
        limits: {
          biens: limits.max_properties ?? -1,
          signatures: limits.signatures_monthly_quota ?? -1,
          utilisateurs: limits.max_users ?? -1,
          stockage_mb: (limits.max_documents_gb ?? -1) * 1024,
        },
        features,
        stripe_price_monthly: planData?.stripe_price_monthly || "",
        stripe_price_yearly: planData?.stripe_price_yearly || "",
      },
      payment_method: paymentMethod,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
