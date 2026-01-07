export const runtime = 'nodejs';

/**
 * Webhook Yousign pour les événements de signature
 * POST /api/webhooks/yousign
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifyYousignWebhook, downloadSignedDocument } from "@/lib/yousign/yousign.service";

// Types d'événements Yousign
type YousignEventType =
  | "signature_request.activated"
  | "signature_request.done"
  | "signature_request.declined"
  | "signature_request.expired"
  | "signer.done"
  | "signer.declined"
  | "signer.notified"
  | "document.signed";

interface YousignWebhookPayload {
  event: YousignEventType;
  signature_request_id: string;
  signer_id?: string;
  document_id?: string;
  timestamp: string;
  data: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-yousign-signature-256") || "";

    // Vérifier la signature du webhook
    const isValid = await verifyYousignWebhook(body, signature);
    if (!isValid) {
      console.error("Signature webhook Yousign invalide");
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    const payload: YousignWebhookPayload = JSON.parse(body);
    const { event, signature_request_id, signer_id, data } = payload;

    console.log(`[Yousign Webhook] Événement: ${event}, Request: ${signature_request_id}`);

    const supabase = createServiceRoleClient();

    switch (event) {
      case "signature_request.activated":
        // La demande de signature a été activée
        await handleSignatureActivated(supabase, signature_request_id);
        break;

      case "signer.notified":
        // Un signataire a été notifié
        await handleSignerNotified(supabase, signature_request_id, signer_id!, data);
        break;

      case "signer.done":
        // Un signataire a signé
        await handleSignerDone(supabase, signature_request_id, signer_id!, data);
        break;

      case "signer.declined":
        // Un signataire a refusé
        await handleSignerDeclined(supabase, signature_request_id, signer_id!, data);
        break;

      case "signature_request.done":
        // Tous les signataires ont signé
        await handleSignatureComplete(supabase, signature_request_id, data);
        break;

      case "signature_request.declined":
        // La demande a été refusée
        await handleSignatureDeclined(supabase, signature_request_id, data);
        break;

      case "signature_request.expired":
        // La demande a expiré
        await handleSignatureExpired(supabase, signature_request_id);
        break;

      default:
        console.log(`[Yousign Webhook] Événement non géré: ${event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Erreur webhook Yousign:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// HANDLERS
// ============================================

async function handleSignatureActivated(supabase: any, requestId: string) {
  // Mettre à jour le statut du bail
  await supabase
    .from("leases")
    .update({
      statut: "pending_signature",
      signature_request_id: requestId,
      updated_at: new Date().toISOString(),
    })
    .eq("signature_request_id", requestId);

  // Mettre à jour le statut de l'engagement garant si applicable
  await supabase
    .from("guarantor_engagements")
    .update({
      status: "pending_signature",
      updated_at: new Date().toISOString(),
    })
    .eq("signature_request_id", requestId);

  console.log(`[Yousign] Signature request ${requestId} activée`);
}

async function handleSignerNotified(
  supabase: any,
  requestId: string,
  signerId: string,
  data: any
) {
  // Mettre à jour le statut du signataire
  await supabase
    .from("lease_signers")
    .update({
      signature_status: "pending",
      notified_at: new Date().toISOString(),
    })
    .eq("yousign_signer_id", signerId);

  // Créer une notification
  const { data: signer } = await supabase
    .from("lease_signers")
    .select("profile_id, lease:leases(property:properties(adresse_complete))")
    .eq("yousign_signer_id", signerId)
    .single();

  if (signer) {
    await supabase.rpc("notify_user", {
      p_profile_id: signer.profile_id,
      p_type: "signature_request",
      p_title: "Signature requise",
      p_body: `Vous avez un document à signer pour le bail de ${signer.lease?.property?.adresse_complete || "votre logement"}.`,
      p_action_url: `/app/signature/${requestId}`,
      p_priority: "high",
    });
  }

  console.log(`[Yousign] Signataire ${signerId} notifié`);
}

async function handleSignerDone(
  supabase: any,
  requestId: string,
  signerId: string,
  data: any
) {
  const now = new Date().toISOString();

  // Mettre à jour le signataire du bail
  await supabase
    .from("lease_signers")
    .update({
      signature_status: "signed",
      signed_at: now,
    })
    .eq("yousign_signer_id", signerId);

  // Mettre à jour l'engagement garant si applicable
  await supabase
    .from("guarantor_engagements")
    .update({
      signed_at: now,
    })
    .match({ signature_request_id: requestId });

  console.log(`[Yousign] Signataire ${signerId} a signé`);
}

async function handleSignerDeclined(
  supabase: any,
  requestId: string,
  signerId: string,
  data: any
) {
  // Mettre à jour le signataire
  await supabase
    .from("lease_signers")
    .update({
      signature_status: "refused",
      refusal_reason: data.decline_reason || "Refusé sans motif",
    })
    .eq("yousign_signer_id", signerId);

  // Notifier le propriétaire
  const { data: lease } = await supabase
    .from("leases")
    .select(`
      id,
      property:properties(owner_id, adresse_complete)
    `)
    .eq("signature_request_id", requestId)
    .single();

  if (lease) {
    await supabase.rpc("notify_user", {
      p_profile_id: lease.property.owner_id,
      p_type: "signature_declined",
      p_title: "Signature refusée",
      p_body: `Un signataire a refusé de signer le bail pour ${lease.property.adresse_complete}.`,
      p_action_url: `/owner/leases/${lease.id}`,
      p_priority: "high",
    });
  }

  console.log(`[Yousign] Signataire ${signerId} a refusé`);
}

async function handleSignatureComplete(
  supabase: any,
  requestId: string,
  data: any
) {
  const now = new Date().toISOString();

  // Télécharger le document signé
  let documentPath: string | null = null;
  try {
    const signedDocument = await downloadSignedDocument(requestId);
    if (signedDocument) {
      // Sauvegarder dans Supabase Storage
      const fileName = `bail_signe_${requestId}_${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(`signed-leases/${fileName}`, signedDocument, {
          contentType: "application/pdf",
        });

      if (!uploadError) {
        documentPath = uploadData.path;
      }
    }
  } catch (error) {
    console.error("Erreur téléchargement document signé:", error);
  }

  // Mettre à jour le bail
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .update({
      statut: "active",
      signature_completed_at: now,
      signed_document_path: documentPath,
      updated_at: now,
    })
    .eq("signature_request_id", requestId)
    .select(`
      id,
      property:properties(owner_id, adresse_complete)
    `)
    .single();

  if (lease) {
    // Créer le document en base
    if (documentPath) {
      await supabase.from("documents").insert({
        type: "bail",
        owner_id: lease.property.owner_id,
        lease_id: lease.id,
        property_id: lease.property.id,
        storage_path: documentPath,
        metadata: {
          signed_at: now,
          yousign_request_id: requestId,
        },
      });
    }

    // Notifier le propriétaire
    await supabase.rpc("notify_user", {
      p_profile_id: lease.property.owner_id,
      p_type: "lease_signed",
      p_title: "Bail signé !",
      p_body: `Le bail pour ${lease.property.adresse_complete} a été signé par toutes les parties.`,
      p_action_url: `/owner/leases/${lease.id}`,
      p_priority: "high",
    });
  }

  // Mettre à jour l'engagement garant si applicable
  await supabase
    .from("guarantor_engagements")
    .update({
      status: "active",
      signed_at: now,
    })
    .eq("signature_request_id", requestId);

  console.log(`[Yousign] Signature complète pour ${requestId}`);
}

async function handleSignatureDeclined(
  supabase: any,
  requestId: string,
  data: any
) {
  // Mettre à jour le bail
  await supabase
    .from("leases")
    .update({
      statut: "draft",
      signature_request_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("signature_request_id", requestId);

  // Mettre à jour l'engagement garant
  await supabase
    .from("guarantor_engagements")
    .update({
      status: "terminated",
      released_reason: "Signature refusée",
    })
    .eq("signature_request_id", requestId);

  console.log(`[Yousign] Signature refusée pour ${requestId}`);
}

async function handleSignatureExpired(supabase: any, requestId: string) {
  // Mettre à jour le bail
  await supabase
    .from("leases")
    .update({
      statut: "draft",
      signature_request_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("signature_request_id", requestId);

  console.log(`[Yousign] Signature expirée pour ${requestId}`);
}
