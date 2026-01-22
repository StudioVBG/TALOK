export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";

/**
 * POST /api/leases/[id]/pay - Effectuer un paiement
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Rate limiting pour les paiements
    const limiter = getRateLimiterByUser(rateLimitPresets.payment);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "Trop de requêtes. Veuillez réessayer plus tard.",
          resetAt: limitResult.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitPresets.payment.maxRequests.toString(),
            "X-RateLimit-Remaining": limitResult.remaining.toString(),
            "X-RateLimit-Reset": limitResult.resetAt.toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { amount, method, month, paymentShareId } = body;

    if (!amount || !method || !month) {
      return NextResponse.json(
        { error: "amount, method et month requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est bien locataire de ce bail
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", id as any)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .single();

    if (!roommate) {
      return NextResponse.json(
        { error: "Vous n'êtes pas locataire de ce bail" },
        { status: 403 }
      );
    }

    // Récupérer la part de paiement
    const { data: paymentShare, error: shareError } = await supabase
      .from("payment_shares")
      .select("*")
      .eq("id", paymentShareId as any)
      .eq("roommate_id", (roommate as any).id as any)
      .single();

    if (shareError || !paymentShare) {
      return NextResponse.json(
        { error: "Part de paiement non trouvée" },
        { status: 404 }
      );
    }

    // Déterminer le provider
    const provider = method === "cb" ? "stripe" : method === "prelevement" ? "gocardless" : "internal";
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    let providerIntentId: string | null = null;
    let providerStatus = "created";

    // Créer un payment intent
    if (method === "cb" && stripeSecretKey) {
      // TODO: Créer un Payment Intent Stripe
      // const stripe = require('stripe')(stripeSecretKey);
      // const paymentIntent = await stripe.paymentIntents.create({
      //   amount: Math.round(amount * 100), // Convertir en centimes
      //   currency: 'eur',
      //   metadata: {
      //     lease_id: params.id,
      //     payment_share_id: paymentShareId,
      //     month,
      //   },
      // });
      // providerIntentId = paymentIntent.id;
      providerIntentId = `mock_stripe_${Date.now()}`;
      providerStatus = "pending";
    } else if (method === "prelevement") {
      // TODO: Créer un mandat GoCardless
      providerIntentId = `mock_gocardless_${Date.now()}`;
      providerStatus = "pending";
    } else if (method === "virement" || method === "sct_inst") {
      // Virement direct, pas de provider externe
      providerStatus = "pending";
    }

    // Créer le payment intent
    const { data: paymentIntent, error: intentError } = await supabase
      .from("payment_intents")
      .insert({
        lease_id: id as any,
        payment_share_id: paymentShareId,
        amount,
        currency: "EUR",
        method,
        provider,
        provider_intent_id: providerIntentId,
        status: providerStatus,
        metadata: { month },
      } as any)
      .select()
      .single();

    if (intentError) throw intentError;

    const paymentIntentData = paymentIntent as any;

    // Mettre à jour le statut de la part de paiement
    await supabase
      .from("payment_shares")
      .update({
        status: "pending",
        provider,
        provider_intent_id: paymentIntentData.id,
        last_event_at: new Date().toISOString(),
      } as any)
      .eq("id", paymentShareId as any);

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "payment.intent.created",
        payload: {
          payment_intent_id: paymentIntentData.id,
          lease_id: id as any,
          payment_share_id: paymentShareId,
        amount,
        method,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "payment",
      entity_type: "payment_intent",
      entity_id: paymentIntentData.id,
      metadata: { amount, method, month },
    } as any);

    return NextResponse.json({
      success: true,
      payment_intent: paymentIntent,
      status: providerStatus,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

