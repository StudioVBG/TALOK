export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SOTA 2026 : API CRUD pour les moyens de paiement propriétaire (abonnement)
 *
 * GET    /api/owner/payment-methods → liste des cartes/PM
 * POST   /api/owner/payment-methods → attacher un PM au customer Stripe
 * PATCH  /api/owner/payment-methods → définir le PM par défaut
 * DELETE /api/owner/payment-methods?id=pm_xxx → détacher un PM
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { z } from "zod";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import type { Json } from "@/lib/supabase/database.types";

async function getOwnerContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new ApiError(401, "Non authentifié");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) throw new ApiError(404, "Profil non trouvé");
  if (profile.role !== "owner" && profile.role !== "admin") {
    throw new ApiError(403, "Accès réservé aux propriétaires");
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, stripe_customer_id")
    .eq("owner_id", profile.id)
    .maybeSingle();

  return { user, profile, subscription, stripeCustomerId: subscription?.stripe_customer_id ?? null };
}

function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

function getUserAgent(request: NextRequest): string | null {
  return request.headers.get("user-agent");
}

async function insertAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  action: string,
  paymentMethodType: string | null,
  metadata: Record<string, unknown>,
  ipAddress: string | null,
  userAgent: string | null
) {
  await supabase.from("owner_payment_audit_log").insert({
    owner_id: ownerId,
    action,
    payment_method_type: paymentMethodType,
    metadata: metadata as Json,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

// ───────── GET ─────────
export async function GET() {
  try {
    const supabase = await createClient();
    const { stripeCustomerId } = await getOwnerContext(supabase);

    if (!stripeCustomerId) {
      return NextResponse.json({ methods: [] });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
    });

    const methods = paymentMethods.data.map((pm) => {
      const card = pm.card;
      return {
        id: pm.id,
        type: pm.type,
        card: card
          ? {
              brand: card.brand,
              last4: card.last4,
              exp_month: card.exp_month,
              exp_year: card.exp_year,
            }
          : null,
        created: pm.created,
      };
    });

    return NextResponse.json({ methods });
  } catch (error) {
    return handleApiError(error);
  }
}

// ───────── POST ─────────
const addSchema = z.object({
  stripe_payment_method_id: z.string().min(3),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, profile, stripeCustomerId: existingCustomerId } = await getOwnerContext(supabase);

    const body = await request.json();
    const { stripe_payment_method_id } = addSchema.parse(body);

    let stripeCustomerId = existingCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { profile_id: profile.id, user_id: user.id },
      });
      stripeCustomerId = customer.id;
      await supabase
        .from("subscriptions")
        .upsert(
          {
            owner_id: profile.id,
            stripe_customer_id: stripeCustomerId,
            status: "incomplete",
          },
          { onConflict: "owner_id" }
        );
    }

    await stripe.paymentMethods.attach(stripe_payment_method_id, {
      customer: stripeCustomerId,
    });

    const pm = await stripe.paymentMethods.retrieve(stripe_payment_method_id);
    const card = pm.card;

    await insertAudit(
      supabase,
      profile.id,
      "card_added",
      "card",
      {
        payment_method_id: stripe_payment_method_id,
        last4: card?.last4 ?? null,
        brand: card?.brand ?? null,
      },
      getClientIp(request),
      getUserAgent(request)
    );

    return NextResponse.json({
      success: true,
      payment_method: {
        id: pm.id,
        card: card ? { brand: card.brand, last4: card.last4, exp_month: card.exp_month, exp_year: card.exp_year } : null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ───────── PATCH ─────────
const patchSchema = z.object({
  default_payment_method_id: z.string().min(3),
});

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { profile, stripeCustomerId } = await getOwnerContext(supabase);

    if (!stripeCustomerId) {
      throw new ApiError(400, "Aucun compte de paiement associé. Souscrivez un forfait ou ajoutez une carte.");
    }

    const body = await request.json();
    const { default_payment_method_id } = patchSchema.parse(body);

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: default_payment_method_id },
    });

    await insertAudit(
      supabase,
      profile.id,
      "set_default",
      "card",
      { payment_method_id: default_payment_method_id },
      getClientIp(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// ───────── DELETE ─────────
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { profile, stripeCustomerId } = await getOwnerContext(supabase);

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      throw new ApiError(400, "Paramètre id requis");
    }

    if (!stripeCustomerId) {
      throw new ApiError(400, "Aucun compte de paiement associé.");
    }

    const pm = await stripe.paymentMethods.retrieve(id);
    if (pm.customer !== stripeCustomerId) {
      throw new ApiError(403, "Ce moyen de paiement ne vous appartient pas.");
    }

    await stripe.paymentMethods.detach(id);

    await insertAudit(
      supabase,
      profile.id,
      "revoked",
      "card",
      { payment_method_id: id, last4: pm.card?.last4 ?? null },
      getClientIp(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
