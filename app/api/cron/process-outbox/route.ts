export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * GET /api/cron/process-outbox — Traitement des evenements outbox
 * SOTA 2026: Processeur outbox asynchrone pour les evenements metier
 *
 * Header requis: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const batchSize = 20;

    // Fetch pending events (oldest first)
    const { data: events, error } = await supabase
      .from("outbox")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (error) {
      console.error("[Outbox] Fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ processed: 0, message: "No pending events" });
    }

    let processed = 0;
    let failed = 0;

    for (const event of events) {
      if (!event.id) continue;
      try {
        await processEvent(event);

        await supabase
          .from("outbox")
          .update({ status: "processed", processed_at: new Date().toISOString() } as any)
          .eq("id", event.id);

        processed++;
      } catch (err) {
        console.error(`[Outbox] Event ${event.id} (${event.event_type}) failed:`, err);

        const retryCount = ((event as any).retry_count ?? 0) + 1;
        const maxRetries = 3;

        await supabase
          .from("outbox")
          .update({
            status: retryCount >= maxRetries ? "dead_letter" : "pending",
            retry_count: retryCount,
            last_error: String(err),
          } as any)
          .eq("id", event.id);

        failed++;
      }
    }

    return NextResponse.json({ processed, failed, total: events.length, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    console.error("[Outbox] Server error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

async function processEvent(event: any): Promise<void> {
  const { event_type, payload } = event;

  switch (event_type) {
    case "Lease.SealRetry": {
      const { handleLeaseFullySigned } = await import("@/lib/services/lease-post-signature.service");
      await handleLeaseFullySigned(payload.lease_id);
      console.log(`[Outbox] Lease.SealRetry completed for ${payload.lease_id}`);
      break;
    }

    case "Lease.FullySigned": {
      // Générer le PDF signé du bail (non-bloquant — fire-and-forget)
      const fullySignedLeaseId = payload.lease_id;
      if (fullySignedLeaseId) {
        const { generateSignedLeasePDF } = await import("@/lib/documents/lease-pdf-generator");
        generateSignedLeasePDF(fullySignedLeaseId).catch((err) =>
          console.error("[cron/process-outbox] generateSignedLeasePDF failed:", err)
        );
      }
      console.log(`[Outbox] Lease.FullySigned for ${payload.lease_id} — PDF generation triggered`);
      break;
    }

    case "Lease.TenantSigned":
    case "Lease.OwnerSigned": {
      console.log(`[Outbox] ${event_type} for lease ${payload.lease_id}`);
      break;
    }

    default:
      console.warn(`[Outbox] Unknown event type: ${event_type}`);
  }
}
