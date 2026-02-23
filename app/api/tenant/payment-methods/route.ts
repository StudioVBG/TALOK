export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SOTA 2026 : API CRUD pour les moyens de paiement locataire
 *
 * GET    /api/tenant/payment-methods              → liste des moyens
 * GET    /api/tenant/payment-methods?type=mandates → mandats SEPA
 * GET    /api/tenant/payment-methods?type=audit    → journal PSD3
 * POST   /api/tenant/payment-methods              → ajouter un moyen
 * PATCH  /api/tenant/payment-methods              → modifier (set default)
 * DELETE /api/tenant/payment-methods?id=xxx        → supprimer / révoquer
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { z } from "zod";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

async function getAuthProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new ApiError(401, "Non authentifié");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) throw new ApiError(404, "Profil non trouvé");
  if (profile.role !== "tenant" && profile.role !== "admin") {
    throw new ApiError(403, "Accès réservé aux locataires");
  }

  return { user, profile };
}

// ───────── GET ─────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { profile } = await getAuthProfile(supabase);
    const type = request.nextUrl.searchParams.get("type");

    if (type === "mandates") {
      const { data } = await supabase
        .from("sepa_mandates")
        .select("*")
        .eq("tenant_profile_id", profile.id)
        .order("created_at", { ascending: false });

      return NextResponse.json({ mandates: data ?? [] });
    }

    if (type === "audit") {
      const { data } = await supabase
        .from("payment_method_audit_log")
        .select("*")
        .eq("tenant_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(100);

      return NextResponse.json({ audit: data ?? [] });
    }

    const { data } = await supabase
      .from("tenant_payment_methods")
      .select("*")
      .eq("tenant_profile_id", profile.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    return NextResponse.json({ methods: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

// ───────── POST ─────────
const addSchema = z.object({
  stripe_payment_method_id: z.string().min(3),
  type: z.enum(["card", "sepa_debit", "apple_pay", "google_pay", "link"]),
  is_default: z.boolean().optional().default(false),
  label: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, profile } = await getAuthProfile(supabase);
    const body = await request.json();
    const payload = addSchema.parse(body);

    let stripeCustomerId = profile.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { profileId: profile.id, userId: user.id },
      });
      stripeCustomerId = customer.id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", profile.id);
    }

    // Attach the payment method to the Stripe customer
    await stripe.paymentMethods.attach(payload.stripe_payment_method_id, {
      customer: stripeCustomerId,
    });

    // Retrieve details from Stripe
    const pm = await stripe.paymentMethods.retrieve(payload.stripe_payment_method_id);

    const isCard = ["card", "apple_pay", "google_pay"].includes(payload.type);
    const isSepa = payload.type === "sepa_debit";

    // Check if this is the first method → auto-default
    const { count } = await supabase
      .from("tenant_payment_methods")
      .select("id", { count: "exact", head: true })
      .eq("tenant_profile_id", profile.id)
      .eq("status", "active");

    const isFirst = (count ?? 0) === 0;

    const { data: method, error } = await supabase
      .from("tenant_payment_methods")
      .insert({
        tenant_profile_id: profile.id,
        stripe_customer_id: stripeCustomerId,
        stripe_payment_method_id: payload.stripe_payment_method_id,
        type: payload.type,
        is_default: isFirst || payload.is_default,
        label: payload.label ?? null,
        card_brand: isCard ? (pm.card?.brand ?? null) : null,
        card_last4: isCard ? (pm.card?.last4 ?? null) : null,
        card_exp_month: isCard ? (pm.card?.exp_month ?? null) : null,
        card_exp_year: isCard ? (pm.card?.exp_year ?? null) : null,
        card_fingerprint: isCard ? (pm.card?.fingerprint ?? null) : null,
        sepa_last4: isSepa ? (pm.sepa_debit?.last4 ?? null) : null,
        sepa_bank_code: isSepa ? (pm.sepa_debit?.bank_code ?? null) : null,
        sepa_country: isSepa ? (pm.sepa_debit?.country ?? null) : null,
        sepa_fingerprint: isSepa ? (pm.sepa_debit?.fingerprint ?? null) : null,
        status: "active",
      })
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);

    // Audit log
    await supabase.from("payment_method_audit_log").insert({
      tenant_profile_id: profile.id,
      payment_method_id: method.id,
      action: "created",
      details: { type: payload.type, last4: isCard ? pm.card?.last4 : pm.sepa_debit?.last4 },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: request.headers.get("user-agent") ?? null,
    });

    return NextResponse.json({ method }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

// ───────── PATCH ─────────
const patchSchema = z.object({
  id: z.string().uuid(),
  is_default: z.boolean().optional(),
  label: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { profile } = await getAuthProfile(supabase);
    const body = await request.json();
    const payload = patchSchema.parse(body);

    const updates: Record<string, unknown> = {};
    if (payload.is_default !== undefined) updates.is_default = payload.is_default;
    if (payload.label !== undefined) updates.label = payload.label;

    const { data, error } = await supabase
      .from("tenant_payment_methods")
      .update(updates)
      .eq("id", payload.id)
      .eq("tenant_profile_id", profile.id)
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);
    if (!data) throw new ApiError(404, "Moyen de paiement non trouvé");

    if (payload.is_default) {
      await supabase.from("payment_method_audit_log").insert({
        tenant_profile_id: profile.id,
        payment_method_id: payload.id,
        action: "set_default",
        ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        user_agent: request.headers.get("user-agent") ?? null,
      });
    }

    return NextResponse.json({ method: data });
  } catch (error) {
    return handleApiError(error);
  }
}

// ───────── DELETE ─────────
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { profile } = await getAuthProfile(supabase);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) throw new ApiError(400, "ID requis");

    // Retrieve the method first
    const { data: existing } = await supabase
      .from("tenant_payment_methods")
      .select("stripe_payment_method_id, is_default, type")
      .eq("id", id)
      .eq("tenant_profile_id", profile.id)
      .single();

    if (!existing) throw new ApiError(404, "Moyen de paiement non trouvé");

    // Detach from Stripe
    try {
      await stripe.paymentMethods.detach(existing.stripe_payment_method_id);
    } catch {
      // Stripe detach can fail if already detached
    }

    // Soft-delete: mark as revoked
    await supabase
      .from("tenant_payment_methods")
      .update({ status: "revoked" })
      .eq("id", id);

    // If it was default, promote next active method
    if (existing.is_default) {
      const { data: next } = await supabase
        .from("tenant_payment_methods")
        .select("id")
        .eq("tenant_profile_id", profile.id)
        .eq("status", "active")
        .neq("id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (next) {
        await supabase
          .from("tenant_payment_methods")
          .update({ is_default: true })
          .eq("id", next.id);
      }
    }

    // Audit
    await supabase.from("payment_method_audit_log").insert({
      tenant_profile_id: profile.id,
      payment_method_id: id,
      action: "revoked",
      details: { type: existing.type },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: request.headers.get("user-agent") ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
