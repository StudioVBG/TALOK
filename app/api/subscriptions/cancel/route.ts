export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * POST /api/subscriptions/cancel
 * Annule un abonnement avec raison et feedback
 */

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { z } from "zod";

const cancelSchema = z.object({
  reason: z.string().optional(),
  feedback: z.string().optional(),
  immediately: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { reason, feedback, immediately } = parsed.data;

    // Récupérer l'abonnement (supporter les deux cas: user_id ou owner_id via profile)
    let subscription = null;

    // D'abord essayer avec user_id
    const { data: subByUser } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id, status, plan_slug")
      .eq("user_id", user.id)
      .single();

    if (subByUser) {
      subscription = subByUser;
    } else {
      // Fallback: chercher via owner_id (ancien système)
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        const { data: subByOwner } = await supabase
          .from("subscriptions")
          .select("id, stripe_subscription_id, status, plan_slug")
          .eq("owner_id", profile.id)
          .single();

        subscription = subByOwner;
      }
    }

    if (!subscription) {
      return NextResponse.json({ error: "Abonnement non trouvé" }, { status: 404 });
    }

    if (subscription.status === "canceled") {
      return NextResponse.json({ error: "Abonnement déjà annulé" }, { status: 400 });
    }

    const serviceClient = createServiceRoleClient();

    // Si abonnement Stripe actif, annuler sur Stripe
    if (subscription.stripe_subscription_id) {
      try {
        if (immediately) {
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        } else {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true,
          });
        }
      } catch (stripeError: unknown) {
        console.error("Stripe cancel error:", stripeError);
        // Continuer même si Stripe échoue (l'abonnement peut être déjà annulé côté Stripe)
      }
    }

    // Mettre à jour localement
    const updateData: Record<string, unknown> = {
      cancel_at_period_end: !immediately,
      canceled_at: new Date().toISOString(),
      cancel_reason: reason || null,
      updated_at: new Date().toISOString(),
    };

    if (immediately) {
      updateData.status = "canceled";
      updateData.plan_slug = "starter";
    }

    await serviceClient
      .from("subscriptions")
      .update(updateData)
      .eq("id", subscription.id);

    // Logger l'événement
    await serviceClient.from("subscription_events").insert({
      subscription_id: subscription.id,
      user_id: user.id,
      event_type: "canceled",
      from_plan: subscription.plan_slug,
      to_plan: immediately ? "starter" : subscription.plan_slug,
      metadata: { reason, feedback, immediately },
    });

    // Stocker le feedback si fourni
    if (feedback) {
      await serviceClient.from("admin_user_notes").insert({
        user_id: user.id,
        admin_id: user.id, // Auto-généré
        note: `Feedback résiliation: ${feedback}`,
        is_important: true,
      }).catch(() => {
        // Ignorer si la table n'existe pas encore
      });
    }

    return NextResponse.json({
      success: true,
      message: immediately
        ? "Abonnement annulé immédiatement"
        : "Abonnement annulé à la fin de la période",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Cancel POST]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
