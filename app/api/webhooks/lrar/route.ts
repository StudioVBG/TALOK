export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/lrar
 *
 * Webhook pour recevoir les mises à jour de statut des LRAR envoyées
 * via le service LRAR (Merci Facteur / AR24 / Maileva).
 *
 * Sprint 3 — S3-2
 *
 * Logique :
 *   1. Vérifie le secret webhook (header X-LRAR-Secret ou Authorization)
 *   2. Parse le payload (tracking_number, status, timestamps)
 *   3. Met à jour copro_convocations (tracking_number → status, accuse_reception_at)
 *   4. Notifie le syndic si un recommandé est retourné (non distribué)
 *
 * Le mapping des statuts dépend du fournisseur. Ce handler est
 * volontairement tolérant sur les noms de champs (snake_case, camelCase)
 * pour supporter plusieurs fournisseurs sans duplication.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service-client";

const LRAR_WEBHOOK_SECRET = process.env.LRAR_WEBHOOK_SECRET;

// Mapping des statuts fournisseur → statuts Talok (copro_convocations.status)
const STATUS_MAP: Record<string, string> = {
  // Merci Facteur
  created: "pending",
  queued: "pending",
  printing: "pending",
  dispatched: "sent",
  in_transit: "sent",
  delivered: "delivered",
  signed: "delivered",
  read: "read",
  returned: "returned",
  refused: "refused",
  lost: "failed",
  error: "failed",

  // AR24 (LRE)
  CREATED: "pending",
  SENT: "sent",
  RECEIVED: "delivered",
  ACKNOWLEDGED: "read",
  REJECTED: "refused",
  EXPIRED: "failed",
};

export async function POST(request: NextRequest) {
  try {
    // 1. Vérifier le secret webhook
    const secret =
      request.headers.get("x-lrar-secret") ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (LRAR_WEBHOOK_SECRET && secret !== LRAR_WEBHOOK_SECRET) {
      console.warn("[webhook:lrar] Secret invalide ou manquant");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parser le payload (tolérant sur la structure)
    const body = await request.json();

    const trackingNumber =
      body.tracking_number ||
      body.trackingNumber ||
      body.reference ||
      body.id;

    const providerStatus =
      body.status ||
      body.event_type ||
      body.eventType ||
      body.state;

    if (!trackingNumber || !providerStatus) {
      return NextResponse.json(
        {
          error: "tracking_number et status requis",
          received: { trackingNumber, providerStatus },
        },
        { status: 400 }
      );
    }

    // 3. Mapper le statut fournisseur vers Talok
    const talokStatus = STATUS_MAP[providerStatus] || "sent";
    const deliveredAt =
      body.delivered_at ||
      body.deliveredAt ||
      body.signed_at ||
      body.signedAt ||
      null;
    const arUrl =
      body.acknowledgment_url ||
      body.ar_scan_url ||
      body.arUrl ||
      body.acknowledgmentUrl ||
      null;
    const arSignedAt =
      body.ar_signed_at ||
      body.arSignedAt ||
      body.acknowledgment_signed_at ||
      null;
    const failureReason =
      body.failure_reason ||
      body.return_reason ||
      body.error_message ||
      null;

    const supabase = getServiceClient();

    // 4. Trouver la convocation par tracking_number
    const { data: convocation, error: findError } = await supabase
      .from("copro_convocations")
      .select("id, site_id, assembly_id, recipient_name, status")
      .eq("tracking_number", trackingNumber)
      .maybeSingle();

    if (findError) {
      console.error("[webhook:lrar] Erreur lookup:", findError);
      return NextResponse.json(
        { error: "Erreur interne" },
        { status: 500 }
      );
    }

    if (!convocation) {
      console.warn(
        `[webhook:lrar] Convocation introuvable pour tracking=${trackingNumber}`
      );
      // On retourne 200 pour éviter que le fournisseur ne retry en boucle
      return NextResponse.json({ received: true, matched: false });
    }

    const conv = convocation as any;

    // 5. Mettre à jour la convocation
    const updatePayload: Record<string, any> = {
      status: talokStatus,
      updated_at: new Date().toISOString(),
    };

    if (talokStatus === "delivered" || talokStatus === "read") {
      updatePayload.delivered_at =
        deliveredAt || new Date().toISOString();
    }

    if (arUrl) {
      updatePayload.accuse_reception_url = arUrl;
    }

    if (arSignedAt) {
      updatePayload.accuse_reception_at = arSignedAt;
    }

    if (failureReason) {
      updatePayload.error_message = failureReason;
    }

    await supabase
      .from("copro_convocations")
      .update(updatePayload)
      .eq("id", conv.id);

    console.log(
      `[webhook:lrar] Convocation ${conv.id} → status=${talokStatus} (tracking=${trackingNumber})`
    );

    // 6. Si retourné/refusé : notifier le syndic
    if (talokStatus === "returned" || talokStatus === "refused") {
      // Trouver le syndic du site
      const { data: site } = await supabase
        .from("sites")
        .select("syndic_profile_id")
        .eq("id", conv.site_id)
        .maybeSingle();

      const syndicProfileId = (site as any)?.syndic_profile_id;
      if (syndicProfileId) {
        const { data: syndicProfile } = await supabase
          .from("profiles")
          .select("id, user_id")
          .eq("id", syndicProfileId)
          .maybeSingle();

        if (syndicProfile) {
          await supabase.from("notifications").insert({
            profile_id: (syndicProfile as any).id,
            user_id: (syndicProfile as any).user_id,
            type: "lrar_returned",
            title: `Recommandé ${
              talokStatus === "returned" ? "retourné" : "refusé"
            }`,
            message: `La lettre recommandée envoyée à ${
              conv.recipient_name
            } a été ${
              talokStatus === "returned"
                ? "retournée à l'expéditeur"
                : "refusée par le destinataire"
            }.${
              failureReason ? ` Motif : ${failureReason}` : ""
            }`,
            action_url: `/syndic/assemblies/${conv.assembly_id}`,
            is_read: false,
            priority: "high",
            status: "pending",
            channels_status: { in_app: "sent" },
            data: {
              tracking_number: trackingNumber,
              convocation_id: conv.id,
              assembly_id: conv.assembly_id,
            },
          });
        }
      }
    }

    // 7. Audit log
    await supabase
      .from("audit_log")
      .insert({
        user_id: "00000000-0000-0000-0000-000000000000", // System
        action: "lrar_status_updated",
        entity_type: "copro_convocations",
        entity_id: conv.id,
        metadata: {
          tracking_number: trackingNumber,
          provider_status: providerStatus,
          talok_status: talokStatus,
          delivered_at: deliveredAt,
          ar_url: arUrl,
        },
      } as any)
      .catch((err: any) =>
        console.warn("[webhook:lrar] audit_log insert failed:", err)
      );

    return NextResponse.json({
      received: true,
      matched: true,
      convocation_id: conv.id,
      status: talokStatus,
    });
  } catch (error: unknown) {
    console.error("[webhook:lrar] Erreur:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}
