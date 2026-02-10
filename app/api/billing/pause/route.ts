import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe-client";
import { z } from "zod";

const PauseSchema = z.object({
  duration_months: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = PauseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Duree invalide (1, 2 ou 3 mois)" }, { status: 400 });
    }

    const { duration_months } = parsed.data;

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: "Aucun abonnement Stripe actif" }, { status: 400 });
    }

    const resumesAt = new Date();
    resumesAt.setMonth(resumesAt.getMonth() + duration_months);
    const resumesAtTimestamp = Math.floor(resumesAt.getTime() / 1000);

    const stripe = getStripe();
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      pause_collection: {
        behavior: "void",
        resumes_at: resumesAtTimestamp,
      },
    });

    await supabase
      .from("subscriptions")
      .update({
        status: "paused",
        pause_collection_until: resumesAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "update",
      entity_type: "subscription",
      entity_id: subscription.id,
      metadata: { action: "pause", duration_months, resumes_at: resumesAt.toISOString() },
      risk_level: "medium",
      success: true,
    });

    return NextResponse.json({
      success: true,
      resumes_at: resumesAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
