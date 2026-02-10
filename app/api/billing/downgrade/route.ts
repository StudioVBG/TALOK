import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe-client";
import { z } from "zod";

const DowngradeSchema = z.object({
  new_plan_id: z.enum(["gratuit", "starter", "confort", "pro", "enterprise_s", "enterprise_m", "enterprise_l", "enterprise_xl"]),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = DowngradeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
    }

    const { new_plan_id } = parsed.data;

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: "Aucun abonnement Stripe actif" }, { status: 400 });
    }

    const { data: newPlan } = await supabase
      .from("plans")
      .select("*")
      .eq("slug", new_plan_id)
      .single();

    if (!newPlan) {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    const cycle = subscription.billing_cycle || "monthly";
    const newPriceId = cycle === "yearly" ? newPlan.stripe_price_yearly : newPlan.stripe_price_monthly;

    if (!newPriceId) {
      return NextResponse.json({ error: "Prix Stripe non configure pour ce plan" }, { status: 400 });
    }

    const stripe = getStripe();
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    const itemId = stripeSub.items.data[0]?.id;

    if (!itemId) {
      return NextResponse.json({ error: "Item d'abonnement introuvable" }, { status: 400 });
    }

    // Downgrade: applies at next renewal
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: "create_prorations",
    });

    await supabase
      .from("subscriptions")
      .update({
        plan_id: new_plan_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "update",
      entity_type: "subscription",
      entity_id: subscription.id,
      metadata: { from_plan: subscription.plan_id, to_plan: new_plan_id, type: "downgrade" },
      risk_level: "medium",
      success: true,
    });

    return NextResponse.json({ success: true, plan_id: new_plan_id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
