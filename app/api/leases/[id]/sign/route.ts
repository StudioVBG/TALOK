export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";

/**
 * POST /api/leases/[id]/sign - Signer un bail avec Audit Trail conforme
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const leaseId = params.id;
  
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    const serviceClient = getServiceClient();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Rate limiting
    const limiter = getRateLimiterByUser(rateLimitPresets.api);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: "Trop de requêtes. Veuillez réessayer plus tard." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { signature_image, metadata: clientMetadata } = body;

    if (!signature_image) {
      return NextResponse.json(
        { error: "La signature tactile est obligatoire" },
        { status: 400 }
      );
    }

    // 1. Récupérer le profil et les données d'identité
    const { data: profile } = await serviceClient
      .from("profiles")
      .select(`
        id, 
        prenom, 
        nom, 
        role,
        tenant_profile:tenant_profiles(cni_number)
      `)
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // 2. Vérifier les droits de signature
    const rights = await checkSignatureRights(leaseId, profile.id, user.email || "");

    if (!rights.canSign) {
      return NextResponse.json({ error: rights.reason || "Accès refusé" }, { status: 403 });
    }

    const isOwner = profile.role === "owner";
    const cniNumber = (profile as any).tenant_profile?.[0]?.cni_number || null;

    // 3. Vérifier l'identité pour les locataires
    if (!isOwner && !cniNumber) {
      return NextResponse.json(
        { error: "Votre identité (CNI) doit être vérifiée avant de signer" },
        { status: 403 }
      );
    }

    // 4. Récupérer les données du bail pour le hash
    const { data: lease } = await serviceClient
      .from("leases")
      .select("*, property:properties(*)")
      .eq("id", leaseId)
      .single();

    // 5. Générer le Dossier de Preuve (Audit Trail)
    const proof = await generateSignatureProof({
      documentType: "BAIL",
      documentId: leaseId,
      documentContent: JSON.stringify(lease), // Hash du contenu actuel du bail
      signerName: `${profile.prenom} ${profile.nom}`,
      signerEmail: user.email!,
      signerProfileId: profile.id,
      identityVerified: isOwner || !!cniNumber,
      identityMethod: isOwner ? "Compte Propriétaire Authentifié" : `CNI n°${cniNumber}`,
      signatureType: "draw",
      signatureImage: signature_image,
      userAgent: request.headers.get("user-agent") || "Inconnu",
      ipAddress: request.headers.get("x-forwarded-for") || "Inconnue",
      screenSize: clientMetadata?.screenSize || "Non spécifié",
      touchDevice: clientMetadata?.touchDevice || false,
    });

    // 6. Uploader l'image de signature
      const base64Data = signature_image.replace(/^data:image\/\w+;base64,/, "");
        const fileName = `signatures/${leaseId}/${user.id}_${Date.now()}.png`;
      
    await serviceClient.storage
        .from("documents")
      .upload(fileName, Buffer.from(base64Data, "base64"), {
          contentType: "image/png",
            upsert: true,
        });

    // 7. Auto-créer le signataire si nécessaire
    let signer = rights.signer;
    if (rights.needsAutoCreate && !signer) {
      signer = await autoCreateSigner(leaseId, profile.id, rights.role!);
    }

    // 8. Mettre à jour le signataire avec les infos de preuve
    const { error: updateError } = await serviceClient
      .from("lease_signers")
      .update({
        signature_status: "signed",
        signed_at: proof.timestamp.iso,
        signature_image_path: fileName,
        ip_inet: proof.metadata.ipAddress as any,
        user_agent: proof.metadata.userAgent,
        proof_id: proof.proofId,
        proof_metadata: proof as any,
        document_hash: proof.document.hash,
      } as any)
      .eq("id", signer.id);

    if (updateError) throw updateError;

    // 9. Mettre à jour le statut global du bail
    const newLeaseStatus = await determineLeaseStatus(leaseId);
    await serviceClient.from("leases").update({ statut: newLeaseStatus }).eq("id", leaseId);

    // 10. Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "lease_signed",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: { role: rights.role, proof_id: proof.proofId },
    } as any);

    return NextResponse.json({
      success: true,
      proof_id: proof.proofId,
      lease_status: newLeaseStatus
    });

  } catch (error: any) {
    console.error("[Sign-Lease] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

async function checkSignatureRights(leaseId: string, profileId: string, email: string): Promise<any> {
  // Implémentation réelle nécessaire
  return { canSign: true, signer: { id: "mock-id" }, role: "tenant", needsAutoCreate: false };
}

async function autoCreateSigner(leaseId: string, profileId: string, role: string): Promise<any> {
  return { id: "mock-id" };
}

async function determineLeaseStatus(leaseId: string): Promise<string> {
  return "active";
}
