// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { verifyWebhookSignature, downloadSignedDocument, downloadAuditTrail } from "@/lib/yousign/service";
import type { YousignWebhookEvent, YousignEventType } from "@/lib/yousign/types";

// Supabase avec service role
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * POST /api/webhooks/yousign - Handler pour les webhooks Yousign
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-yousign-signature-256") || "";

    // Vérifier la signature
    if (process.env.YOUSIGN_WEBHOOK_SECRET) {
      const isValid = verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        console.error("[webhook/yousign] Signature invalide");
        return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
      }
    }

    const event: YousignWebhookEvent = JSON.parse(rawBody);
    console.log(`[webhook/yousign] Événement reçu: ${event.event_name}`);

    // Récupérer notre demande de signature
    const yousignProcedureId = event.data.signature_request.id;
    const { data: signatureRequest } = await supabase
      .from("signature_requests")
      .select("*, signers:signature_request_signers(*)")
      .eq("yousign_procedure_id", yousignProcedureId)
      .single();

    if (!signatureRequest) {
      console.warn(`[webhook/yousign] Demande non trouvée pour: ${yousignProcedureId}`);
      return NextResponse.json({ received: true });
    }

    // Traiter selon le type d'événement
    switch (event.event_name) {
      case "signature_request.activated":
        await handleActivated(signatureRequest, event);
        break;

      case "signer.notified":
        await handleSignerNotified(signatureRequest, event);
        break;

      case "signer.document_opened":
        await handleSignerOpened(signatureRequest, event);
        break;

      case "signer.signed":
        await handleSignerSigned(signatureRequest, event);
        break;

      case "signer.signature_declined":
        await handleSignerDeclined(signatureRequest, event);
        break;

      case "signature_request.done":
        await handleRequestDone(signatureRequest, event);
        break;

      case "signature_request.expired":
        await handleRequestExpired(signatureRequest, event);
        break;

      default:
        console.log(`[webhook/yousign] Événement non géré: ${event.event_name}`);
    }

    // Audit log
    await supabase.from("signature_audit_log").insert({
      signature_request_id: signatureRequest.id,
      action: `yousign_${event.event_name}`,
      details: {
        yousign_event_id: event.id,
        signer_id: event.data.signer?.id,
      },
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[webhook/yousign] Erreur:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// HANDLERS
// ============================================

async function handleActivated(signatureRequest: any, event: YousignWebhookEvent) {
  console.log(`[webhook/yousign] Procédure activée: ${signatureRequest.id}`);
  // Déjà géré lors de l'envoi
}

async function handleSignerNotified(signatureRequest: any, event: YousignWebhookEvent) {
  const yousignSignerId = event.data.signer?.id;
  if (!yousignSignerId) return;

  console.log(`[webhook/yousign] Signataire notifié: ${yousignSignerId}`);

  await supabase
    .from("signature_request_signers")
    .update({
      status: "notified",
      notified_at: event.event_time,
    })
    .eq("yousign_signer_id", yousignSignerId);
}

async function handleSignerOpened(signatureRequest: any, event: YousignWebhookEvent) {
  const yousignSignerId = event.data.signer?.id;
  if (!yousignSignerId) return;

  console.log(`[webhook/yousign] Document ouvert par: ${yousignSignerId}`);

  await supabase
    .from("signature_request_signers")
    .update({
      status: "opened",
      opened_at: event.event_time,
    })
    .eq("yousign_signer_id", yousignSignerId);
}

async function handleSignerSigned(signatureRequest: any, event: YousignWebhookEvent) {
  const yousignSignerId = event.data.signer?.id;
  if (!yousignSignerId) return;

  console.log(`[webhook/yousign] Signataire a signé: ${yousignSignerId}`);

  // Mettre à jour le signataire
  await supabase
    .from("signature_request_signers")
    .update({
      status: "signed",
      signed_at: event.event_time,
    })
    .eq("yousign_signer_id", yousignSignerId);

  // Récupérer le signataire pour notification
  const { data: signer } = await supabase
    .from("signature_request_signers")
    .select("profile_id, first_name, last_name")
    .eq("yousign_signer_id", yousignSignerId)
    .single();

  // Notifier le propriétaire de la demande
  await supabase.from("notifications").insert({
    profile_id: signatureRequest.owner_id,
    type: "signer_signed",
    title: "Signature reçue",
    message: `${signer?.first_name} ${signer?.last_name} a signé le document "${signatureRequest.name}".`,
    data: { signature_request_id: signatureRequest.id },
  });
}

async function handleSignerDeclined(signatureRequest: any, event: YousignWebhookEvent) {
  const yousignSignerId = event.data.signer?.id;
  if (!yousignSignerId) return;

  console.log(`[webhook/yousign] Signataire a refusé: ${yousignSignerId}`);

  await supabase
    .from("signature_request_signers")
    .update({
      status: "refused",
      refused_at: event.event_time,
      refused_reason: "Refusé par le signataire",
    })
    .eq("yousign_signer_id", yousignSignerId);

  // Mettre à jour la demande
  await supabase
    .from("signature_requests")
    .update({ status: "rejected" })
    .eq("id", signatureRequest.id);

  // Notifier le propriétaire
  const { data: signer } = await supabase
    .from("signature_request_signers")
    .select("first_name, last_name")
    .eq("yousign_signer_id", yousignSignerId)
    .single();

  await supabase.from("notifications").insert({
    profile_id: signatureRequest.owner_id,
    type: "signer_declined",
    title: "Signature refusée",
    message: `${signer?.first_name} ${signer?.last_name} a refusé de signer "${signatureRequest.name}".`,
    data: { signature_request_id: signatureRequest.id },
  });
}

async function handleRequestDone(signatureRequest: any, event: YousignWebhookEvent) {
  console.log(`[webhook/yousign] Procédure terminée: ${signatureRequest.id}`);

  try {
    // ========================================
    // ARCHIVAGE: Télécharger les documents
    // ========================================
    
    // 1. Document signé
    const signedPdf = await downloadSignedDocument(
      signatureRequest.yousign_procedure_id,
      "default" // Le premier document
    );

    const signedPath = `signed/${signatureRequest.owner_id}/${signatureRequest.id}_signed.pdf`;
    await supabase.storage.from("documents").upload(signedPath, signedPdf, {
      contentType: "application/pdf",
      upsert: true,
    });

    // Créer l'entrée document
    const { data: signedDoc } = await supabase
      .from("documents")
      .insert({
        type: signatureRequest.document_type,
        owner_id: signatureRequest.owner_id,
        property_id: signatureRequest.related_entity_type === "lease" 
          ? null // À récupérer depuis lease
          : null,
        lease_id: signatureRequest.related_entity_type === "lease"
          ? signatureRequest.related_entity_id
          : null,
        title: `${signatureRequest.name} - Signé`,
        storage_path: signedPath,
        metadata: {
          yousign_procedure_id: signatureRequest.yousign_procedure_id,
          signed_at: event.event_time,
        },
      })
      .select()
      .single();

    // 2. Journal des preuves (audit trail)
    const auditTrailPdf = await downloadAuditTrail(signatureRequest.yousign_procedure_id);

    const proofPath = `proofs/${signatureRequest.owner_id}/${signatureRequest.id}_proof.pdf`;
    await supabase.storage.from("documents").upload(proofPath, auditTrailPdf, {
      contentType: "application/pdf",
      upsert: true,
    });

    const { data: proofDoc } = await supabase
      .from("documents")
      .insert({
        type: "autre",
        owner_id: signatureRequest.owner_id,
        title: `${signatureRequest.name} - Journal des preuves`,
        storage_path: proofPath,
        metadata: {
          yousign_procedure_id: signatureRequest.yousign_procedure_id,
          type: "audit_trail",
        },
      })
      .select()
      .single();

    // ========================================
    // Mettre à jour la demande
    // ========================================
    await supabase
      .from("signature_requests")
      .update({
        status: "done",
        completed_at: event.event_time,
        signed_document_id: signedDoc?.id,
        proof_document_id: proofDoc?.id,
      })
      .eq("id", signatureRequest.id);

    // ========================================
    // Actions post-signature selon le type
    // ========================================
    if (signatureRequest.related_entity_type === "lease" && signatureRequest.related_entity_id) {
      // Activer le bail
      await supabase
        .from("leases")
        .update({ statut: "active" })
        .eq("id", signatureRequest.related_entity_id);

      // Mettre à jour les lease_signers
      const signers = signatureRequest.signers as any[];
      for (const signer of signers) {
        if (signer.profile_id) {
          await supabase
            .from("lease_signers")
            .update({
              signature_status: "signed",
              signed_at: signer.signed_at,
            })
            .eq("lease_id", signatureRequest.related_entity_id)
            .eq("profile_id", signer.profile_id);
        }
      }

      // Émettre événement
      await supabase.from("outbox").insert({
        event_type: "Lease.Activated",
        payload: { lease_id: signatureRequest.related_entity_id },
      });
    }

    // ========================================
    // Notifier tous les participants
    // ========================================
    const signers = signatureRequest.signers as any[];
    for (const signer of signers) {
      if (signer.profile_id) {
        await supabase.from("notifications").insert({
          profile_id: signer.profile_id,
          type: "signature_completed",
          title: "Document signé",
          message: `Le document "${signatureRequest.name}" a été signé par tous les participants.`,
          data: {
            signature_request_id: signatureRequest.id,
            signed_document_id: signedDoc?.id,
          },
        });
      }
    }

    // Notifier le propriétaire
    await supabase.from("notifications").insert({
      profile_id: signatureRequest.owner_id,
      type: "signature_completed",
      title: "Signatures terminées",
      message: `Toutes les signatures ont été recueillies pour "${signatureRequest.name}". Le document signé et le journal des preuves sont disponibles.`,
      data: {
        signature_request_id: signatureRequest.id,
        signed_document_id: signedDoc?.id,
        proof_document_id: proofDoc?.id,
      },
    });

    console.log(`[webhook/yousign] Archivage terminé pour: ${signatureRequest.id}`);
  } catch (archiveError: any) {
    console.error(`[webhook/yousign] Erreur archivage:`, archiveError);
    // Marquer quand même comme terminé mais noter l'erreur
    await supabase
      .from("signature_requests")
      .update({
        status: "done",
        completed_at: event.event_time,
      })
      .eq("id", signatureRequest.id);
  }
}

async function handleRequestExpired(signatureRequest: any, event: YousignWebhookEvent) {
  console.log(`[webhook/yousign] Procédure expirée: ${signatureRequest.id}`);

  await supabase
    .from("signature_requests")
    .update({ status: "expired" })
    .eq("id", signatureRequest.id);

  // Notifier le propriétaire
  await supabase.from("notifications").insert({
    profile_id: signatureRequest.owner_id,
    type: "signature_expired",
    title: "Demande de signature expirée",
    message: `La demande "${signatureRequest.name}" a expiré sans que toutes les signatures soient recueillies.`,
    data: { signature_request_id: signatureRequest.id },
  });
}

