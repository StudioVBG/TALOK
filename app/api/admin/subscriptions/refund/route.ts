export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/subscriptions/refund
 * Émet un remboursement Stripe pour un paiement donné.
 *
 * Body:
 *   - payment_intent_id?: string   (prioritaire)
 *   - charge_id?: string           (fallback)
 *   - amount?: number              (en centimes, optionnel — total si omis)
 *   - reason?: "duplicate" | "fraudulent" | "requested_by_customer"
 *   - admin_note: string           (obligatoire — raison interne)
 *   - user_id?: string             (profile_id pour audit / contexte)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe, isStripeServerConfigured } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";

const refundSchema = z
  .object({
    payment_intent_id: z.string().optional(),
    charge_id: z.string().optional(),
    amount: z.number().int().positive().optional(),
    reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
    admin_note: z.string().min(3, "Raison interne requise (≥ 3 caractères)"),
    user_id: z.string().uuid().optional(),
  })
  .refine((d) => d.payment_intent_id || d.charge_id, {
    message: "payment_intent_id ou charge_id requis",
  });

export async function POST(request: Request) {
  try {
    if (!isStripeServerConfigured()) {
      return NextResponse.json(
        { error: "Stripe n'est pas configuré sur ce serveur" },
        { status: 503 }
      );
    }

    const csrf = await validateCsrfFromRequestDetailed(request);
    if (!csrf.valid) {
      await logCsrfFailure(request, csrf.reason!, "admin.subscriptions.refund");
      return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
    }

    const auth = await requireAdminPermissions(request, ["admin.subscriptions.write"], {
      rateLimit: "adminCritical",
      auditAction: "Remboursement Stripe émis",
    });
    if (isAdminAuthError(auth)) return auth;

    const body = await request.json().catch(() => ({}));
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { payment_intent_id, charge_id, amount, reason, admin_note, user_id } = parsed.data;

    const refund = await stripe.refunds.create({
      ...(payment_intent_id ? { payment_intent: payment_intent_id } : {}),
      ...(charge_id ? { charge: charge_id } : {}),
      ...(amount ? { amount } : {}),
      ...(reason ? { reason } : {}),
      metadata: {
        issued_by_admin: auth.user.id,
        admin_note,
        ...(user_id ? { talok_user_id: user_id } : {}),
      },
    });

    // Log applicatif dans subscription_events (table existante)
    try {
      const supabase = createServiceRoleClient();
      await supabase.from("subscription_events").insert({
        owner_id: user_id || null,
        event_type: "admin_refund_issued",
        payload: {
          refund_id: refund.id,
          amount: refund.amount,
          status: refund.status,
          reason: reason || null,
          admin_note,
          payment_intent_id: payment_intent_id || null,
          charge_id: charge_id || null,
          issued_by: auth.user.id,
        },
      });
    } catch (logErr) {
      console.warn("[admin/refund] subscription_events log failed:", logErr);
    }

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount,
        status: refund.status,
        currency: refund.currency,
        created: refund.created,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Admin Refund POST]", error);
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(error, { tags: { route: "admin.subscriptions.refund" } });
    } catch {}
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
