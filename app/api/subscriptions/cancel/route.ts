// @ts-nocheck
/**
 * POST /api/subscriptions/cancel
 * Annule un abonnement Stripe
 */

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { at_period_end = true } = body;

    // Récupérer le profil et l'abonnement
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id, status")
      .eq("owner_id", profile.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "Pas d'abonnement actif" },
        { status: 404 }
      );
    }

    if (subscription.status === "canceled") {
      return NextResponse.json(
        { error: "Abonnement déjà annulé" },
        { status: 400 }
      );
    }

    // Annuler sur Stripe
    if (at_period_end) {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } else {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    }

    // Mettre à jour localement
    const serviceClient = createServiceRoleClient();
    await serviceClient
      .from("subscriptions")
      .update({
        cancel_at_period_end: at_period_end,
        canceled_at: at_period_end ? null : new Date().toISOString(),
        status: at_period_end ? subscription.status : "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    // Notification
    await serviceClient.from("notifications").insert({
      user_id: profile.id,
      type: "subscription_cancel_scheduled",
      title: at_period_end
        ? "Annulation programmée"
        : "Abonnement annulé",
      message: at_period_end
        ? "Votre abonnement sera annulé à la fin de la période en cours."
        : "Votre abonnement a été annulé immédiatement.",
    });

    // Audit log
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "subscription_canceled",
      entity_type: "subscription",
      entity_id: subscription.id,
      metadata: { at_period_end },
    });

    return NextResponse.json({
      success: true,
      message: at_period_end
        ? "Abonnement annulé à la fin de la période"
        : "Abonnement annulé immédiatement",
    });
  } catch (error: any) {
    console.error("Erreur annulation:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

