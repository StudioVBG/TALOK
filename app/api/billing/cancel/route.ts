import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe-client";
import { z } from "zod";

const CancelSchema = z.object({
  reason: z.enum(["too_expensive", "missing_features", "technical_issues", "switching_competitor", "temporary", "other"]),
  reason_detail: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
    }

    const { reason, reason_detail } = parsed.data;

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
      cancel_at_period_end: true,
      metadata: {
        cancellation_reason: reason,
        cancellation_detail: reason_detail || "",
      },
    });

    await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "update",
      entity_type: "subscription",
      entity_id: subscription.id,
      metadata: {
        action: "cancel",
        reason,
        reason_detail: reason_detail || null,
        effective_date: subscription.current_period_end,
      },
      risk_level: "high",
      success: true,
    });

    return NextResponse.json({
      success: true,
      cancel_at: subscription.current_period_end,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
