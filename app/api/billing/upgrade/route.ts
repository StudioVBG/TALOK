import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { z } from "zod";
import { syncPropertyBillingToStripe } from "@/lib/stripe/sync-property-billing";
import { buildSubscriptionUpdateFromStripe } from "@/lib/subscriptions/market-standard";
import { logSubscriptionEvent } from "@/lib/subscriptions/subscription-service";

const UpgradeSchema = z.object({
  new_plan_id: z.enum(["gratuit", "starter", "confort", "pro", "enterprise_s", "enterprise_m", "enterprise_l", "enterprise_xl"]),
  billing_cycle: z.enum(["monthly", "yearly"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceClient = createServiceRoleClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = UpgradeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
    }

    const { new_plan_id, billing_cycle } = parsed.data;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: subscription } = await serviceClient
      .from("subscriptions")
      .select("*")
      .eq("owner_id", profile.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: "Aucun abonnement Stripe actif" }, { status: 400 });
    }

    const { data: newPlan } = await serviceClient
      .from("subscription_plans")
      .select("*")
      .eq("slug", new_plan_id)
      .single();

    if (!newPlan) {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    if ((newPlan.price_monthly ?? 0) === 0 && (newPlan.price_yearly ?? 0) === 0) {
      return NextResponse.json(
        { error: "Le passage vers le forfait gratuit doit etre planifie a echeance." },
        { status: 400 }
      );
    }

    const cycle = billing_cycle || subscription.billing_cycle || "monthly";
    const newPriceId = cycle === "yearly" ? newPlan.stripe_price_yearly_id : newPlan.stripe_price_monthly_id;

    if (!newPriceId) {
      return NextResponse.json({ error: "Prix Stripe non configure pour ce plan" }, { status: 400 });
    }

    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    const itemId = stripeSub.items.data[0]?.id;

    if (!itemId) {
      return NextResponse.json({ error: "Item d'abonnement introuvable" }, { status: 400 });
    }

    if ((subscription as { stripe_subscription_schedule_id?: string | null }).stripe_subscription_schedule_id) {
      try {
        await stripe.subscriptionSchedules.release(
          (subscription as { stripe_subscription_schedule_id?: string | null }).stripe_subscription_schedule_id as string
        );
      } catch (scheduleError) {
        console.warn("[billing/upgrade] Unable to release pending schedule:", scheduleError);
      }
    }

    const updatedStripeSubscription = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{ id: itemId, price: newPriceId as string }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
    });

    const subscriptionUpdate = await buildSubscriptionUpdateFromStripe(
      serviceClient as any,
      updatedStripeSubscription,
      {
        planSlug: new_plan_id,
        planId: newPlan.id,
        metadata: {
          last_plan_change_type: "upgrade",
          last_plan_change_at: new Date().toISOString(),
        },
      }
    );

    await serviceClient
      .from("subscriptions")
      .update({
        ...subscriptionUpdate,
        billing_cycle: cycle,
        scheduled_plan_id: null,
        scheduled_plan_slug: null,
        scheduled_plan_effective_at: null,
        stripe_subscription_schedule_id: null,
      })
      .eq("id", subscription.id);

    // Sync extra property billing (included_properties may change between plans)
    try {
      await syncPropertyBillingToStripe(profile.id);
    } catch (billingError) {
      console.warn("[billing/upgrade] Stripe property billing sync failed:", billingError);
    }

    // Audit log
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "update",
      entity_type: "subscription",
      entity_id: subscription.id,
      metadata: { from_plan: subscription.plan_slug ?? subscription.plan_id, to_plan: new_plan_id, billing_cycle: cycle },
      risk_level: "medium",
      success: true,
    });

    await logSubscriptionEvent(user.id, {
      event_type: "upgraded",
      from_plan: String(subscription.plan_slug ?? subscription.plan_id ?? ""),
      to_plan: new_plan_id,
      metadata: {
        billing_cycle: cycle,
        strategy: "stripe_in_place_upgrade",
      },
    });

    return NextResponse.json({ success: true, plan_id: new_plan_id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
