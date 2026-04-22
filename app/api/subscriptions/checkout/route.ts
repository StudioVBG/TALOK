export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * POST /api/subscriptions/checkout
 * Crée une session Stripe Checkout pour un abonnement
 */

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  validatePromoCodeForCheckout,
  type Territory,
} from "@/lib/subscriptions/promo-codes.service";

const VALID_TERRITORIES: Territory[] = [
  "metropole",
  "martinique",
  "guadeloupe",
  "reunion",
  "guyane",
  "mayotte",
];

function isTerritory(value: unknown): value is Territory {
  return typeof value === "string" && (VALID_TERRITORIES as string[]).includes(value);
}

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
    const { plan_slug, billing_cycle, success_url, cancel_url, promo_code } = body as {
      plan_slug?: string;
      billing_cycle?: "monthly" | "yearly";
      success_url?: string;
      cancel_url?: string;
      promo_code?: string;
    };

    if (!plan_slug || !billing_cycle) {
      return NextResponse.json(
        { error: "plan_slug et billing_cycle requis" },
        { status: 400 }
      );
    }

    // Récupérer le profil (service role pour éviter récursion RLS)
    const serviceClient = createServiceRoleClient();
    const { data: profile } = await serviceClient
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
    const { data: plan, error: planError } = await serviceClient
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
    const { data: existingSub } = await serviceClient
      .from("subscriptions")
      .select("id, stripe_customer_id, stripe_subscription_id, status, plan_slug, billing_cycle")
      .eq("owner_id", profile.id)
      .single();

    const hasManagedStripeSubscription =
      Boolean(existingSub?.stripe_subscription_id) &&
      ["trialing", "active", "past_due", "paused", "incomplete"].includes(existingSub?.status || "");

    if (
      hasManagedStripeSubscription &&
      (existingSub?.plan_slug !== plan.slug || existingSub?.billing_cycle !== billing_cycle)
    ) {
      return NextResponse.json(
        {
          error: "Utilisez le flux de changement de forfait dedie pour modifier un abonnement existant.",
          code: "PLAN_CHANGE_REQUIRES_BILLING_ROUTE",
        },
        { status: 409 }
      );
    }

    let customerId = existingSub?.stripe_customer_id;

    // Créer le customer Stripe si nécessaire
    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${profile.prenom} ${profile.nom}`,
          metadata: {
            profile_id: profile.id,
            user_id: user.id,
          },
        });
        customerId = customer.id;
      } catch (stripeErr) {
        console.error("[checkout] Erreur création customer Stripe:", stripeErr);
        return NextResponse.json(
          { error: "Impossible de créer votre compte de paiement. Veuillez réessayer.", code: "STRIPE_CUSTOMER_ERROR" },
          { status: 502 }
        );
      }
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

    // Validation du code promo (si fourni).
    // Le territoire est résolu depuis subscriptions.territoire (si existant)
    // sinon 'metropole' par défaut — les codes sans contrainte territoire
    // passent quand même.
    let promoDiscount:
      | { promotion_code: string; promo_code_id: string; stripe_coupon_id: string | null }
      | null = null;

    if (promo_code && typeof promo_code === "string" && promo_code.trim()) {
      const rawTerritoire = (existingSub as { territoire?: unknown } | null)?.territoire;
      const territoire: Territory = isTerritory(rawTerritoire) ? rawTerritoire : "metropole";

      const result = await validatePromoCodeForCheckout(promo_code.trim(), {
        plan_slug: plan.slug as never,
        billing_cycle,
        user_id: user.id,
        territoire,
      });

      if (!result.valid || !result.code?.stripe_promotion_code_id) {
        return NextResponse.json(
          { error: result.reason ?? "Code promo invalide" },
          { status: 400 }
        );
      }

      promoDiscount = {
        promotion_code: result.code.stripe_promotion_code_id,
        promo_code_id: result.code.id,
        stripe_coupon_id: result.code.stripe_coupon_id,
      };
    }

    // Créer la session Checkout.
    // `allow_promotion_codes` volontairement retiré : seuls les codes gérés
    // dans /admin/promo-codes sont acceptés (décision Option A — Talok only).
    const sessionMetadata: Record<string, string> = {
      profile_id: profile.id,
      plan_id: plan.id,
      plan_slug: plan.slug,
      billing_cycle,
    };
    if (promoDiscount) {
      sessionMetadata.promo_code_id = promoDiscount.promo_code_id;
      if (promoDiscount.stripe_coupon_id) {
        sessionMetadata.stripe_coupon_id = promoDiscount.stripe_coupon_id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      // Parcours volontairement simple pour l'abonnement SaaS: carte bancaire uniquement.
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url:
        success_url || `${process.env.NEXT_PUBLIC_APP_URL}/owner/money?tab=forfait&success=true`,
      cancel_url:
        cancel_url || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      subscription_data: {
        // Stripe refuse trial_period_days + discounts (duration:once) — la
        // remise remplace l'essai 30j quand un code promo est appliqué.
        trial_period_days:
          existingSub || promoDiscount ? undefined : 30,
        metadata: sessionMetadata,
      },
      metadata: sessionMetadata,
      ...(promoDiscount
        ? { discounts: [{ promotion_code: promoDiscount.promotion_code }] }
        : {}),
      billing_address_collection: "auto",
      locale: "fr",
    } as any);

    // Mettre à jour le customer_id si nouveau
    if (!existingSub?.stripe_customer_id && customerId) {
      const serviceClient = createServiceRoleClient();
      if (existingSub) {
        // Compte existant sans Stripe customer → sauvegarder l'ID
        await serviceClient
          .from("subscriptions")
          .update({ stripe_customer_id: customerId })
          .eq("id", existingSub.id);
      } else {
        // Nouveau compte sans subscription → créer le record de base
        // Le webhook checkout.session.completed finalisera le plan/status
        await serviceClient
          .from("subscriptions")
          .upsert({
            owner_id: profile.id,
            stripe_customer_id: customerId,
            status: "incomplete",
            billing_cycle: billing_cycle,
            selected_plan_at: new Date().toISOString(),
            selected_plan_source: "checkout",
          }, { onConflict: "owner_id" });
      }
    }

    return NextResponse.json({
      url: session.url,
      session_id: session.id,
    });
  } catch (error: unknown) {
    console.error("Erreur création checkout:", error);
    
    // Gérer les erreurs Stripe spécifiques
    if ((error as any).type === "StripeAuthenticationError" || (error as Error).message?.includes("Invalid API Key")) {
      return NextResponse.json(
        { 
          error: "Configuration Stripe invalide. Veuillez contacter l'administrateur.",
          code: "STRIPE_AUTH_ERROR"
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? (error as Error).message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

