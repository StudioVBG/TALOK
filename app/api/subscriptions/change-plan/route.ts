export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/subscriptions/change-plan
 * Change le forfait d'un abonnement existant (upgrade ou downgrade)
 * Pour les upgrades sans abonnement existant, utiliser /api/subscriptions/checkout
 *
 * Le downgrade prend effet à la fin de la période en cours (Art. L215-1)
 * L'upgrade prend effet immédiatement avec prorata
 */

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { z } from "zod";

const changePlanSchema = z.object({
  plan_slug: z.string().min(1),
  billing_cycle: z.enum(["monthly", "yearly"]),
});

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
    const parsed = changePlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "plan_slug et billing_cycle requis" },
        { status: 400 }
      );
    }

    const { plan_slug, billing_cycle } = parsed.data;

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent modifier leur abonnement" },
        { status: 403 }
      );
    }

    // Récupérer l'abonnement actuel
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id, stripe_customer_id, plan_slug, status")
      .eq("owner_id", profile.id)
      .single();

    if (!subscription) {
      return NextResponse.json(
        { error: "Aucun abonnement trouvé" },
        { status: 404 }
      );
    }

    if (!subscription.stripe_subscription_id) {
      return NextResponse.json(
        { error: "Abonnement non lié à Stripe. Utilisez la page pricing pour souscrire." },
        { status: 400 }
      );
    }

    // Récupérer le plan cible
    const { data: targetPlan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("slug", plan_slug)
      .eq("is_active", true)
      .single();

    if (!targetPlan) {
      return NextResponse.json(
        { error: "Plan non trouvé" },
        { status: 404 }
      );
    }

    // Plan gratuit = annuler l'abonnement
    if (targetPlan.price_monthly === 0 && targetPlan.price_yearly === 0) {
      // Annuler à la fin de la période
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      const serviceClient = createServiceRoleClient();
      await serviceClient
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      // Logger l'événement
      await serviceClient.from("subscription_events").insert({
        subscription_id: subscription.id,
        user_id: user.id,
        event_type: "downgraded",
        from_plan: subscription.plan_slug,
        to_plan: plan_slug,
        metadata: { billing_cycle, reason: "user_downgrade_to_free" },
      });

      return NextResponse.json({
        success: true,
        message: "Abonnement annulé à la fin de la période en cours",
        effective: "period_end",
      });
    }

    // Récupérer l'abonnement Stripe actuel
    const stripeSub = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    if (!stripeSub || stripeSub.status === "canceled") {
      return NextResponse.json(
        { error: "L'abonnement Stripe n'est plus actif. Veuillez souscrire à nouveau." },
        { status: 400 }
      );
    }

    // Déterminer le nouveau prix
    const newPriceId =
      billing_cycle === "yearly"
        ? targetPlan.stripe_price_yearly_id
        : targetPlan.stripe_price_monthly_id;

    // Mettre à jour l'abonnement Stripe
    const currentItem = stripeSub.items.data[0];

    if (newPriceId) {
      // Avec un price ID Stripe existant
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        items: [
          {
            id: currentItem.id,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations",
        // Si cancel_at_period_end était true, le réactiver
        cancel_at_period_end: false,
      });
    } else {
      // Créer un prix ad-hoc
      const unitAmount =
        billing_cycle === "yearly"
          ? targetPlan.price_yearly
          : targetPlan.price_monthly;

      const newPrice = await stripe.prices.create({
        currency: "eur",
        product: currentItem.price.product as string,
        unit_amount: unitAmount,
        recurring: {
          interval: billing_cycle === "yearly" ? "year" : "month",
        },
      });

      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        items: [
          {
            id: currentItem.id,
            price: newPrice.id,
          },
        ],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
      });
    }

    // Mettre à jour localement
    const serviceClient = createServiceRoleClient();
    await serviceClient
      .from("subscriptions")
      .update({
        plan_slug: plan_slug,
        plan_id: targetPlan.id,
        billing_cycle: billing_cycle,
        cancel_at_period_end: false,
        canceled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    // Logger l'événement
    await serviceClient.from("subscription_events").insert({
      subscription_id: subscription.id,
      user_id: user.id,
      event_type: "plan_changed",
      from_plan: subscription.plan_slug,
      to_plan: plan_slug,
      metadata: { billing_cycle },
    });

    return NextResponse.json({
      success: true,
      message: `Forfait modifié vers ${targetPlan.name}`,
      new_plan: plan_slug,
    });
  } catch (error: unknown) {
    console.error("[change-plan POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
