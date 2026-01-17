export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * POST /api/subscriptions/checkout
 * Crée une session Stripe Checkout pour un abonnement
 */

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    // Vérifier si Stripe est configuré
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("[checkout] STRIPE_SECRET_KEY n'est pas configurée");
      return NextResponse.json(
        { 
          error: "Stripe n'est pas configuré. Veuillez contacter l'administrateur.",
          code: "STRIPE_NOT_CONFIGURED"
        }, 
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { plan_slug, billing_cycle, success_url, cancel_url } = body;

    if (!plan_slug || !billing_cycle) {
      return NextResponse.json(
        { error: "plan_slug et billing_cycle requis" },
        { status: 400 }
      );
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent s'abonner" },
        { status: 403 }
      );
    }

    // Récupérer le plan
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("slug", plan_slug)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan non trouvé" },
        { status: 404 }
      );
    }

    // Plan gratuit = pas de checkout
    if (plan.price_monthly === 0 && plan.price_yearly === 0) {
      return NextResponse.json(
        { error: "Ce plan ne nécessite pas de paiement" },
        { status: 400 }
      );
    }

    // Vérifier si le propriétaire a déjà un abonnement
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("id, stripe_customer_id, status")
      .eq("owner_id", profile.id)
      .single();

    let customerId = existingSub?.stripe_customer_id;

    // Créer le customer Stripe si nécessaire
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${profile.prenom} ${profile.nom}`,
        metadata: {
          profile_id: profile.id,
          user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    // Déterminer le prix
    const priceId =
      billing_cycle === "yearly"
        ? plan.stripe_price_yearly_id
        : plan.stripe_price_monthly_id;

    // Si pas de price ID Stripe, créer un prix ad-hoc
    let lineItems;
    if (priceId) {
      lineItems = [{ price: priceId, quantity: 1 }];
    } else {
      // Créer un prix dynamique
      const unitAmount =
        billing_cycle === "yearly" ? plan.price_yearly : plan.price_monthly;

      lineItems = [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${plan.name} - ${billing_cycle === "yearly" ? "Annuel" : "Mensuel"}`,
              description: plan.description || undefined,
            },
            unit_amount: unitAmount,
            recurring: {
              interval: billing_cycle === "yearly" ? "year" : "month",
            },
          },
          quantity: 1,
        },
      ];
    }

    // Créer la session Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card", "sepa_debit"],
      line_items: lineItems,
      success_url:
        success_url || `${process.env.NEXT_PUBLIC_APP_URL}/owner/settings/billing?success=true`,
      cancel_url:
        cancel_url || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      subscription_data: {
        trial_period_days: existingSub ? undefined : 30, // 1er mois offert pour les nouveaux
        metadata: {
          profile_id: profile.id,
          plan_id: plan.id,
          plan_slug: plan.slug,
          billing_cycle,
        },
      },
      metadata: {
        profile_id: profile.id,
        plan_id: plan.id,
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      locale: "fr",
    });

    // Mettre à jour le customer_id si nouveau
    if (!existingSub?.stripe_customer_id) {
      const serviceClient = createServiceRoleClient();
      if (existingSub) {
        await serviceClient
          .from("subscriptions")
          .update({ stripe_customer_id: customerId })
          .eq("id", existingSub.id);
      }
    }

    return NextResponse.json({
      url: session.url,
      session_id: session.id,
    });
  } catch (error: unknown) {
    console.error("Erreur création checkout:", error);
    
    // Gérer les erreurs Stripe spécifiques
    if (error.type === "StripeAuthenticationError" || error.message?.includes("Invalid API Key")) {
      return NextResponse.json(
        { 
          error: "Configuration Stripe invalide. Veuillez contacter l'administrateur.",
          code: "STRIPE_AUTH_ERROR"
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

