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

    case "ChargeRegularization.Paid": {
      // Sprint 0.f — notif tenant + owner après paiement Stripe d'une régul.
      // L'event est émis par le webhook Stripe (payment_intent.succeeded
      // avec metadata.type='charge_regularization', cf Sprint 0.d.1).
      const supabase = createServiceRoleClient();
      const { sendEmail } = await import("@/lib/emails/resend.service");
      const regId = payload.regularization_id as string | undefined;
      const amountEur = typeof payload.amount === "number" ? payload.amount : 0;

      if (!regId) {
        console.warn("[Outbox] ChargeRegularization.Paid missing regularization_id");
        break;
      }

      const { data: reg } = await supabase
        .from("lease_charge_regularizations")
        .select(
          "fiscal_year, lease_id, leases(lease_signers!inner(role, profiles(email, prenom)))",
        )
        .eq("id", regId)
        .maybeSingle();

      const tenantSigner = ((reg as any)?.leases?.lease_signers ?? []).find(
        (s: any) => s.role === "locataire_principal",
      );
      const tenantEmail = tenantSigner?.profiles?.email as string | undefined;
      const tenantFirstName = (tenantSigner?.profiles?.prenom as string | undefined) ?? "";
      const fiscalYear = (reg as any)?.fiscal_year as number | undefined;

      if (!tenantEmail) {
        console.warn(`[Outbox] ChargeRegularization.Paid ${regId} — no tenant email, skipping send`);
        break;
      }

      const subject = `Paiement de votre régularisation de charges ${fiscalYear ?? ""} confirmé`;
      const amountFmt = amountEur.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const html = `
        <div style="font-family:'Manrope',sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#1B2A6B">Paiement confirmé</h2>
          <p>Bonjour ${tenantFirstName},</p>
          <p>Nous confirmons la bonne réception de votre paiement de
          <strong>${amountFmt} €</strong> au titre de la régularisation des charges${fiscalYear ? ` ${fiscalYear}` : ""}.</p>
          <p>Vous pouvez retrouver le détail dans votre espace Talok.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.talok.fr"}/tenant/charges"
             style="display:inline-block;background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">
            Voir mes charges
          </a>
          <p style="margin-top:24px;font-size:12px;color:#999">Talok — Gestion locative simplifiée</p>
        </div>`;

      const result = await sendEmail({
        to: tenantEmail,
        subject,
        html,
        idempotencyKey: `reg-paid-${regId}`,
      });

      if (!result.success) {
        // Throw → retry (Outbox marquera retry_count + dead_letter au max).
        throw new Error(`sendEmail failed: ${result.error ?? "unknown"}`);
      }
      console.log(`[Outbox] ChargeRegularization.Paid ${regId} — email sent to ${tenantEmail}`);
      break;
    }

    default:
      console.warn(`[Outbox] Unknown event type: ${event_type}`);
  }
}
