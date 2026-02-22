/**
 * @version 2026-02-15 - Audit sécurité complet
 *
 * FIX P1-1: Ajout rate limiting
 * FIX P1-2: Suppression base64 de proof_metadata
 * FIX P1-8: Ajout audit_log
 * FIX P0-2: Validation image signature
 * FIX P2-5: Logger structuré
 */
export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { extractClientIP } from "@/lib/utils/ip-address";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { validateSignatureImage, stripBase64Prefix } from "@/lib/utils/validate-signature";
import { createSignatureLogger } from "@/lib/utils/signature-logger";

/**
 * POST /api/signature/edl/[token]/sign - Signer un EDL via token d'invitation
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const log = createSignatureLogger("/api/signature/edl/[token]/sign");

  try {
    // FIX P1-1: Rate limiting (manquait totalement)
    const rateLimitResponse = applyRateLimit(request, "signature");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { token } = await params;
    const serviceClient = getServiceClient();

    // 1. Trouver la signature par token
    const { data: signatureEntry, error: sigError } = await serviceClient
      .from("edl_signatures")
      .select("*, profile:profiles(*), edl:edl_id(*)")
      .eq("invitation_token", token)
      .single();

    if (sigError || !signatureEntry) {
      log.warn("Token EDL invalide");
      return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });
    }

    log.setContext({ entityId: signatureEntry.edl_id, entityType: "edl" });

    // Vérifier si le token a expiré (7 jours après l'envoi)
    const TOKEN_EXPIRATION_DAYS = 7;
    if ((signatureEntry as any).invitation_sent_at) {
      const sentDate = new Date((signatureEntry as any).invitation_sent_at);
      const expirationDate = new Date(sentDate.getTime() + TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
      if (new Date() > expirationDate) {
        return NextResponse.json(
          {
            error: "Ce lien d'invitation a expiré. Veuillez demander un nouveau lien au propriétaire.",
            expired_at: expirationDate.toISOString(),
          },
          { status: 410 }
        );
      }
    }

    // Vérifier si déjà signé (idempotency)
    if (signatureEntry.signature_image_path) {
      return NextResponse.json({ error: "Ce document a déjà été signé" }, { status: 400 });
    }

    // P0-1: CNI recommandé mais non bloquant (alignement avec /api/edl/[id]/sign)
    const signerRole = (signatureEntry as any).signer_role;
    const isTenant = ["tenant", "locataire", "locataire_principal"].includes(signerRole);
    const signerProfileId = (signatureEntry as any).signer_profile_id;
    let identityVerified = true;
    if (isTenant && signerProfileId) {
      const { data: tenantProfile } = await serviceClient
        .from("tenant_profiles")
        .select("cni_number")
        .eq("profile_id", signerProfileId)
        .maybeSingle();
      identityVerified = !!(tenantProfile as { cni_number?: string | null } | null)?.cni_number?.trim?.();
    }

    const body = await request.json();
    const { signature: signatureBase64, metadata: clientMetadata } = body;

    if (!signatureBase64) {
      return NextResponse.json(
        { error: "La signature tactile est obligatoire" },
        { status: 400 }
      );
    }

    // FIX P0-2: Validation de l'image
    const validation = validateSignatureImage(signatureBase64);
    if (!validation.valid) {
      log.warn("Image de signature invalide", { errors: validation.errors });
      return NextResponse.json(
        { error: validation.errors[0], validation_errors: validation.errors },
        { status: 400 }
      );
    }

    // 2. Uploader l'image de signature
    const base64Data = stripBase64Prefix(signatureBase64);
    const fileName = `edl/${signatureEntry.edl_id}/signatures/guest_${Date.now()}.png`;
    
    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(fileName, Buffer.from(base64Data, 'base64'), {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      log.error("Erreur upload signature", { error: uploadError.message });
      throw new Error("Erreur lors de l'enregistrement de l'image de signature");
    }

    // 3. Générer le Dossier de Preuve
    const proof = await generateSignatureProof({
      documentType: "EDL",
      documentId: signatureEntry.edl_id,
      documentContent: JSON.stringify(signatureEntry.edl),
      signerName: (signatureEntry as any).signer_name || `${signatureEntry.profile?.prenom || ""} ${signatureEntry.profile?.nom || ""}`.trim() || "Locataire",
      signerEmail: signatureEntry.profile?.email || "guest@tenant.com",
      signerProfileId: (signatureEntry as any).signer_profile_id,
      identityVerified,
      identityMethod: identityVerified ? "CNI vérifié" : "Lien d'invitation sécurisé",
      signatureType: "draw",
      signatureImage: signatureBase64,
      userAgent: request.headers.get("user-agent") || "Inconnu",
      ipAddress: extractClientIP(request),
      screenSize: clientMetadata?.screenSize || "Non spécifié",
      touchDevice: clientMetadata?.touchDevice || false,
    });

    // FIX P1-2: Exclure base64 du proof_metadata
    const proofForDB = {
      ...proof,
      signature: {
        ...proof.signature,
        imageData: `[STORED:${fileName}]`,
      },
    };

    // 4. Mettre à jour la signature
    const { error: updateError } = await serviceClient
      .from("edl_signatures")
      .update({
        signed_at: new Date().toISOString(),
        signature_image_path: fileName,
        ip_inet: proof.metadata.ipAddress as any,
        user_agent: proof.metadata.userAgent,
        proof_id: proof.proofId,
        proof_metadata: proofForDB as any,
        document_hash: proof.document.hash,
      } as any)
      .eq("id", signatureEntry.id);

    if (updateError) throw updateError;

    // 5. Vérifier si tout est signé
    const { data: allSignatures } = await serviceClient
      .from("edl_signatures")
      .select("signer_role, signature_image_path, signed_at")
      .eq("edl_id", signatureEntry.edl_id);

    const hasOwner = allSignatures?.some(
      (s: any) => (s.signer_role === "owner" || s.signer_role === "proprietaire") 
        && s.signature_image_path && s.signed_at
    );
    const hasTenant = allSignatures?.some(
      (s: any) => (s.signer_role === "tenant" || s.signer_role === "locataire") 
        && s.signature_image_path && s.signed_at
    );

    if (hasOwner && hasTenant) {
      await serviceClient
        .from("edl")
        .update({ status: "signed" } as any)
        .eq("id", signatureEntry.edl_id);

      // Sync digicode from EDL keys to property (visible côté locataire)
      const { data: edlRow } = await serviceClient
        .from("edl")
        .select("keys, property_id")
        .eq("id", signatureEntry.edl_id)
        .single();
      const keys = (edlRow as { keys?: Array<{ type?: string; observations?: string }> } | null)?.keys;
      const propertyId = (edlRow as { property_id?: string } | null)?.property_id;
      if (Array.isArray(keys) && propertyId) {
        const digicodeKey = keys.find(
          (k) =>
            k.type &&
            (String(k.type).toLowerCase().includes("digicode") || String(k.type).toLowerCase().includes("code"))
        );
        if (digicodeKey?.observations?.trim()) {
          await serviceClient
            .from("properties")
            .update({ digicode: digicodeKey.observations.trim() } as Record<string, unknown>)
            .eq("id", propertyId);
        }
      }

      await serviceClient.from("outbox").insert({
        event_type: "Inspection.Signed",
        payload: {
          edl_id: signatureEntry.edl_id,
          all_signed: true,
        },
      } as any);
    }

    // FIX P1-8: Audit log (manquait totalement)
    try {
      await serviceClient.from("audit_log").insert({
        actor_type: "user",
        actor_id: (signatureEntry as any).signer_profile_id || null,
        action: "edl_signed_via_token",
        resource: "edl",
        resource_id: signatureEntry.edl_id,
        after: {
          signer_role: signatureEntry.signer_role,
          proof_id: proof.proofId,
          ip: proof.metadata.ipAddress,
          correlation_id: log.getCorrelationId(),
        },
      } as any);
    } catch (auditErr) {
      log.warn("Erreur audit_log (non bloquant)", { error: String(auditErr) });
    }

    log.complete(true, { proofId: proof.proofId, allSigned: hasOwner && hasTenant });

    return NextResponse.json({ success: true, proof_id: proof.proofId });
  } catch (error: unknown) {
    log.complete(false, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}












