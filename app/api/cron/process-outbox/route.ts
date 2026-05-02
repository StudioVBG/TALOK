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
        const { generateSignedLeasePdf } = await import("@/lib/pdf/lease-signed-pdf");
        generateSignedLeasePdf(fullySignedLeaseId).catch((err) =>
          console.error("[cron/process-outbox] generateSignedLeasePdf failed:", err)
        );
      }
      console.log(`[Outbox] Lease.FullySigned for ${payload.lease_id} — PDF generation triggered`);
      break;
    }

    case "Inspection.Signed": {
      // Générer le PDF signé de l'EDL (non-bloquant — fire-and-forget)
      const edlId = payload.edl_id;
      if (edlId) {
        const { generateSignedEdlPdf } = await import("@/lib/pdf/edl-signed-pdf");
        generateSignedEdlPdf(edlId).catch((err) =>
          console.error("[cron/process-outbox] generateSignedEdlPdf failed:", err)
        );
      }
      console.log(`[Outbox] Inspection.Signed for ${edlId} — EDL PDF generation triggered`);
      break;
    }

    case "Lease.TenantSigned":
    case "Lease.OwnerSigned": {
      console.log(`[Outbox] ${event_type} for lease ${payload.lease_id}`);
      break;
    }

    case "Inspection.Signed": {
      await handleInspectionSigned(payload);
      break;
    }

    case "Lease.InvoiceEngineStart": {
      console.log(`[Outbox] Lease.InvoiceEngineStart for lease ${payload.lease_id}`);
      break;
    }

    default:
      console.warn(`[Outbox] Unknown event type: ${event_type}`);
  }
}

/**
 * Handle Inspection.Signed event:
 * When an EDL d'entrée is fully signed, generate the initial invoice
 * if the lease is in 'fully_signed' status and no initial invoice exists.
 */
async function handleInspectionSigned(payload: any): Promise<void> {
  const edlId = payload.edl_id;
  if (!edlId) {
    console.warn("[Outbox] Inspection.Signed: missing edl_id");
    return;
  }

  const supabase = createServiceRoleClient();

  // Fetch the EDL to get lease_id and type
  const { data: edl, error: edlError } = await supabase
    .from("edl")
    .select("id, type, status, lease_id")
    .eq("id", edlId)
    .maybeSingle();

  if (edlError || !edl) {
    console.error(`[Outbox] Inspection.Signed: EDL ${edlId} not found`, edlError);
    return;
  }

  // Only process entry inspections (EDL d'entrée)
  if (edl.type !== "entree") {
    console.log(`[Outbox] Inspection.Signed: EDL ${edlId} is type '${edl.type}', skipping`);
    return;
  }

  if (!edl.lease_id) {
    console.warn(`[Outbox] Inspection.Signed: EDL ${edlId} has no lease_id`);
    return;
  }

  // Check lease status
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("id, statut")
    .eq("id", edl.lease_id)
    .maybeSingle();

  if (leaseError || !lease) {
    console.error(`[Outbox] Inspection.Signed: lease ${edl.lease_id} not found`, leaseError);
    return;
  }

  if (lease.statut !== "fully_signed") {
    console.log(`[Outbox] Inspection.Signed: lease ${lease.id} is '${lease.statut}', not 'fully_signed'. Skipping.`);
    return;
  }

  // Generate the initial invoice via the canonical service
  const { ensureInitialInvoiceForLease } = await import("@/lib/services/lease-initial-invoice.service");

  try {
    const result = await ensureInitialInvoiceForLease(supabase, lease.id);
    if (result.created) {
      console.log(`[Outbox] Inspection.Signed: initial invoice ${result.invoiceId} created for lease ${lease.id} (amount: ${result.amount}€)`);
    } else {
      console.log(`[Outbox] Inspection.Signed: initial invoice ${result.invoiceId} already exists for lease ${lease.id}`);
    }
  } catch (err) {
    console.error(`[Outbox] Inspection.Signed: failed to create initial invoice for lease ${lease.id}:`, err);
    throw err; // Re-throw to trigger retry
  }
}
