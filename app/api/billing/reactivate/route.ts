import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe-client";

export async function POST() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: "Aucun abonnement Stripe actif" }, { status: 400 });
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "update",
      entity_type: "subscription",
      entity_id: subscription.id,
      metadata: { action: "reactivate" },
      risk_level: "low",
      success: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
