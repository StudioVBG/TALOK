export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { decode } from "base64-arraybuffer";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";

/**
 * POST /api/signature/edl/[token]/sign - Signer un EDL via token d'invitation
 */
export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = await params;
    const serviceClient = getServiceClient();

    // 1. Trouver la signature par token
    const { data: signatureEntry, error: sigError } = await serviceClient
      .from("edl_signatures")
      .select("*, profile:profiles(*), edl:edl_id(*)")
      .eq("invitation_token", token)
      .single();

    if (sigError || !signatureEntry) {
      return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });
    }

    if (signatureEntry.signed_at) {
      return NextResponse.json({ error: "Ce document a déjà été signé" }, { status: 400 });
    }

    const body = await request.json();
    const { signature: signatureBase64, metadata: clientMetadata } = body;

    if (!signatureBase64) {
      return NextResponse.json(
        { error: "La signature tactile est obligatoire" },
        { status: 400 }
      );
    }

    // 2. Uploader l'image de signature
    const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, "");
    const fileName = `edl/${signatureEntry.edl_id}/signatures/guest_${Date.now()}.png`;
    
    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(fileName, decode(base64Data), {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      throw new Error("Erreur lors de l'enregistrement de l'image de signature");
    }

    // 3. Générer le Dossier de Preuve
    const proof = await generateSignatureProof({
      documentType: "EDL",
      documentId: signatureEntry.edl_id,
      documentContent: JSON.stringify(signatureEntry.edl),
      signerName: signatureEntry.signer_name || `${signatureEntry.profile?.prenom || ""} ${signatureEntry.profile?.nom || ""}`.trim() || "Locataire",
      signerEmail: signatureEntry.profile?.email || "guest@tenant.com",
      signerProfileId: signatureEntry.signer_profile_id,
      identityVerified: true, // On considère vérifié par le token unique
      identityMethod: "Lien d'invitation sécurisé",
      signatureType: "draw",
      signatureImage: signatureBase64,
      userAgent: request.headers.get("user-agent") || "Inconnu",
      ipAddress: request.headers.get("x-forwarded-for") || "Inconnue",
      screenSize: clientMetadata?.screenSize || "Non spécifié",
      touchDevice: clientMetadata?.touchDevice || false,
    });

    // 4. Mettre à jour la signature
    const { error: updateError } = await serviceClient
      .from("edl_signatures")
      .update({
        signed_at: new Date().toISOString(),
        signature_image_path: fileName,
        ip_inet: proof.metadata.ipAddress as any,
        user_agent: proof.metadata.userAgent,
        proof_id: proof.proofId,
        proof_metadata: proof as any,
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

      await serviceClient.from("outbox").insert({
        event_type: "Inspection.Signed",
        payload: {
          edl_id: signatureEntry.edl_id,
          all_signed: true,
        },
      } as any);
    }

    return NextResponse.json({ success: true, proof_id: proof.proofId });
  } catch (error: any) {
    console.error("[sign-edl-token] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}











