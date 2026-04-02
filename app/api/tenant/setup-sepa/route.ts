export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/tenant/setup-sepa
 *
 * Crée un SetupIntent Stripe pour configurer un mandat SEPA.
 * Le client_secret retourné est utilisé côté React avec
 * @stripe/react-stripe-js pour confirmer le mandat.
 *
 * Body optionnel : { leaseId?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ApiError(401, "Non authentifié");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom, email, stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(404, "Profil non trouvé");
    if (profile.role !== "tenant" && profile.role !== "admin") {
      throw new ApiError(403, "Accès réservé aux locataires");
    }

    // Créer ou récupérer le Stripe Customer
    let stripeCustomerId = profile.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile.email || user.email || undefined,
        name: `${profile.prenom || ""} ${profile.nom || ""}`.trim() || undefined,
        metadata: { profileId: profile.id, userId: user.id },
      });
      stripeCustomerId = customer.id;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", profile.id);
    }

    // Lire le leaseId optionnel depuis le body
    let leaseId: string | undefined;
    try {
      const body = await request.json();
      leaseId = body?.leaseId;
    } catch {
      // Body vide ou non-JSON — pas grave
    }

    // Créer le SetupIntent SEPA
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["sepa_debit"],
      usage: "off_session",
      metadata: {
        profileId: profile.id,
        userId: user.id,
        ...(leaseId ? { leaseId } : {}),
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId: stripeCustomerId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
