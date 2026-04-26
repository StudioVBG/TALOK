export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import {
  releaseEscrowToProvider,
  EscrowReleaseError,
} from "@/lib/work-orders/release-escrow";

/**
 * GET /api/cron/release-escrow — libération automatique des soldes WO
 *
 * Quotidien (cron Netlify ou GitHub Actions). Pour chaque paiement
 * work_order_payments avec :
 *   - escrow_status = 'held'
 *   - dispute_deadline IS NOT NULL AND dispute_deadline <= NOW()
 *   - status = 'succeeded'
 * on libère les fonds vers le compte Connect du prestataire (Stripe Transfer).
 *
 * Sécurité : Header Authorization: Bearer <CRON_SECRET>
 *
 * Idempotence : releaseEscrowToProvider() utilise une idempotencyKey Stripe
 * et un UPDATE WHERE escrow_status='held', donc tout double appel est safe.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const startedAt = Date.now();

  try {
    // Sélection des paiements à libérer
    const { data: candidates, error } = await (supabase as any)
      .from("work_order_payments")
      .select("id, work_order_id, payment_type, dispute_deadline")
      .eq("escrow_status", "held")
      .eq("status", "succeeded")
      .not("dispute_deadline", "is", null)
      .lte("dispute_deadline", new Date().toISOString())
      .limit(100);

    if (error) {
      console.error("[cron/release-escrow] query error:", error);
      return NextResponse.json(
        { error: "Failed to query held payments", details: error.message },
        { status: 500 },
      );
    }

    const payments = (candidates || []) as Array<{
      id: string;
      work_order_id: string;
      payment_type: string;
      dispute_deadline: string;
    }>;

    if (payments.length === 0) {
      return NextResponse.json({
        released: 0,
        errors: 0,
        duration_ms: Date.now() - startedAt,
      });
    }

    let releasedCount = 0;
    const errors: Array<{ payment_id: string; error: string }> = [];

    for (const p of payments) {
      try {
        await releaseEscrowToProvider(supabase, {
          paymentId: p.id,
          reason: "balance_release_on_deadline",
        });
        releasedCount++;

        // Avancer le statut WO vers 'paid' si tout le reste est libéré
        const { data: stillHeld } = await (supabase as any)
          .from("work_order_payments")
          .select("id")
          .eq("work_order_id", p.work_order_id)
          .eq("escrow_status", "held")
          .limit(1);

        if (!stillHeld || stillHeld.length === 0) {
          await supabase
            .from("work_orders")
            .update({ statut: "paid", paid_at: new Date().toISOString() })
            .eq("id", p.work_order_id);
        }
      } catch (err) {
        const message =
          err instanceof EscrowReleaseError
            ? `${err.code}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "Unknown error";
        errors.push({ payment_id: p.id, error: message });
        console.error(
          `[cron/release-escrow] Failed to release ${p.id}:`,
          message,
        );
      }
    }

    return NextResponse.json({
      released: releasedCount,
      errors: errors.length,
      error_details: errors,
      duration_ms: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("[cron/release-escrow] fatal:", err);
    return NextResponse.json(
      {
        error: "Cron fatal error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
