/**
 * Service de signatures électroniques internes TALOK
 *
 * Remplace l'intégration YouSign externe par un système interne
 * utilisant des signatures électroniques simples (SES)
 */

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  SignatureRequest,
  SignatureRequestSigner,
  SignatureRequestStatus,
  SignerStatus,
  CreateSignatureRequestDTO,
  CreateSignerDTO,
  SignDocumentDTO,
  SignatureAuditEntry,
  SignatureAction,
} from "./types";

// ============================================
// SIGNATURE REQUESTS
// ============================================

/**
 * Créer une nouvelle demande de signature
 */
export async function createSignatureRequest(
  dto: CreateSignatureRequestDTO,
  createdBy: string
): Promise<SignatureRequest> {
  const supabase = await createServerSupabase();

  const { data: request, error: requestError } = await supabase
    .from("signature_requests")
    .insert({
      name: dto.name,
      description: dto.description,
      document_type: dto.document_type,
      related_entity_type: dto.related_entity_type,
      related_entity_id: dto.related_entity_id,
      source_document_id: dto.source_document_id,
      status: "draft" as SignatureRequestStatus,
      created_by: createdBy,
      owner_id: createdBy,
      deadline: dto.deadline,
    })
    .select()
    .single();

  if (requestError) {
    throw new Error(`Erreur création demande de signature: ${requestError.message}`);
  }

  // Ajouter les signataires
  if (dto.signers && dto.signers.length > 0) {
    const signersToInsert = dto.signers.map((signer, index) => ({
      signature_request_id: request.id,
      profile_id: signer.profile_id,
      email: signer.email,
      first_name: signer.first_name,
      last_name: signer.last_name,
      phone: signer.phone,
      role: signer.role,
      signing_order: signer.signing_order ?? index + 1,
      status: "pending" as SignerStatus,
    }));

    const { error: signersError } = await supabase
      .from("signature_request_signers")
      .insert(signersToInsert);

    if (signersError) {
      console.error("Erreur ajout signataires:", signersError);
    }
  }

  // Audit
  await logAuditEntry(request.id, undefined, "request_created", {
    signers_count: dto.signers?.length ?? 0,
  });

  return request;
}

/**
 * Récupérer une demande de signature
 */
export async function getSignatureRequest(
  requestId: string
): Promise<SignatureRequest | null> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("signature_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error) {
    console.error("Erreur récupération demande:", error);
    return null;
  }

  return data;
}

/**
 * Récupérer les signataires d'une demande
 */
export async function getSigners(
  requestId: string
): Promise<SignatureRequestSigner[]> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("signature_request_signers")
    .select("*")
    .eq("signature_request_id", requestId)
    .order("signing_order", { ascending: true });

  if (error) {
    console.error("Erreur récupération signataires:", error);
    return [];
  }

  return data ?? [];
}

/**
 * Envoyer la demande de signature aux signataires
 */
export async function sendSignatureRequest(
  requestId: string
): Promise<void> {
  const supabase = await createServerSupabase();

  // Mettre à jour le statut
  const { error: updateError } = await supabase
    .from("signature_requests")
    .update({
      status: "pending" as SignatureRequestStatus,
      sent_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) {
    throw new Error(`Erreur envoi demande: ${updateError.message}`);
  }

  // Marquer les signataires comme notifiés
  const { error: signersError } = await supabase
    .from("signature_request_signers")
    .update({
      status: "notified" as SignerStatus,
      notified_at: new Date().toISOString(),
    })
    .eq("signature_request_id", requestId)
    .eq("status", "pending");

  if (signersError) {
    console.error("Erreur notification signataires:", signersError);
  }

  // Audit
  await logAuditEntry(requestId, undefined, "request_sent");
}

/**
 * Signer un document
 */
export async function signDocument(
  requestId: string,
  signerId: string,
  dto: SignDocumentDTO
): Promise<void> {
  const supabase = await createServerSupabase();

  // Mettre à jour le signataire
  const { error: signerError } = await supabase
    .from("signature_request_signers")
    .update({
      status: "signed" as SignerStatus,
      signed_at: new Date().toISOString(),
      signature_image_url: dto.signature_image_base64, // Stocké en base64 ou uploadé
      signature_ip: dto.ip_address,
      signature_user_agent: dto.user_agent,
    })
    .eq("id", signerId)
    .eq("signature_request_id", requestId);

  if (signerError) {
    throw new Error(`Erreur signature: ${signerError.message}`);
  }

  // Audit
  await logAuditEntry(requestId, signerId, "document_signed", {
    ip: dto.ip_address,
  });

  // Vérifier si tous les signataires ont signé
  await checkAndCompleteRequest(requestId);
}

/**
 * Refuser de signer
 */
export async function refuseSignature(
  requestId: string,
  signerId: string,
  reason?: string
): Promise<void> {
  const supabase = await createServerSupabase();

  const { error: signerError } = await supabase
    .from("signature_request_signers")
    .update({
      status: "refused" as SignerStatus,
      refused_at: new Date().toISOString(),
      refused_reason: reason,
    })
    .eq("id", signerId)
    .eq("signature_request_id", requestId);

  if (signerError) {
    throw new Error(`Erreur refus: ${signerError.message}`);
  }

  // Mettre à jour le statut de la demande
  const { error: requestError } = await supabase
    .from("signature_requests")
    .update({ status: "rejected" as SignatureRequestStatus })
    .eq("id", requestId);

  if (requestError) {
    console.error("Erreur mise à jour demande:", requestError);
  }

  // Audit
  await logAuditEntry(requestId, signerId, "signature_refused", { reason });
}

/**
 * Annuler une demande de signature
 */
export async function cancelSignatureRequest(
  requestId: string,
  reason?: string
): Promise<void> {
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("signature_requests")
    .update({ status: "canceled" as SignatureRequestStatus })
    .eq("id", requestId);

  if (error) {
    throw new Error(`Erreur annulation: ${error.message}`);
  }

  // Audit
  await logAuditEntry(requestId, undefined, "request_canceled", { reason });
}

// ============================================
// HELPERS
// ============================================

/**
 * Vérifier si tous les signataires ont signé et compléter la demande
 */
async function checkAndCompleteRequest(requestId: string): Promise<void> {
  const supabase = await createServerSupabase();

  const { data: signers } = await supabase
    .from("signature_request_signers")
    .select("status")
    .eq("signature_request_id", requestId);

  if (!signers) return;

  const allSigned = signers.every((s) => s.status === "signed");

  if (allSigned) {
    const { error } = await supabase
      .from("signature_requests")
      .update({
        status: "done" as SignatureRequestStatus,
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (!error) {
      await logAuditEntry(requestId, undefined, "request_completed");
    }
  } else {
    // Au moins un signataire a signé, mettre à jour en "ongoing"
    const hasSigned = signers.some((s) => s.status === "signed");
    if (hasSigned) {
      await supabase
        .from("signature_requests")
        .update({ status: "ongoing" as SignatureRequestStatus })
        .eq("id", requestId);
    }
  }
}

/**
 * Logger une entrée d'audit
 */
async function logAuditEntry(
  requestId: string,
  signerId: string | undefined,
  action: SignatureAction,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createServerSupabase();

    await supabase.from("signature_audit_log").insert({
      signature_request_id: requestId,
      signer_id: signerId,
      action,
      metadata,
    });
  } catch (error) {
    console.error("Erreur audit log:", error);
  }
}

/**
 * Générer un token de signature unique
 */
export function generateSignatureToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Vérifier si un token de signature est valide
 */
export async function verifySignatureToken(
  token: string
): Promise<{ valid: boolean; signerId?: string; requestId?: string }> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("signature_tokens")
    .select("signer_id, signature_request_id, expires_at")
    .eq("token", token)
    .single();

  if (!data) {
    return { valid: false };
  }

  const isExpired = new Date(data.expires_at) < new Date();

  return {
    valid: !isExpired,
    signerId: data.signer_id,
    requestId: data.signature_request_id,
  };
}
