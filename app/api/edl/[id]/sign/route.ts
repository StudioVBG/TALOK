export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
import { decode } from "base64-arraybuffer";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { extractClientIP } from "@/lib/utils/ip-address";
import { 
  verifyEDLAccess, 
  createServiceClient
} from "@/lib/helpers/edl-auth";

/**
 * POST /api/edl/[id]/sign - Signer un EDL avec Audit Trail
 * SOTA 2026: Utilise le helper centralisé pour la vérification des permissions
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: edlId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { signature: signatureBase64, metadata: clientMetadata } = body;

    if (!signatureBase64) {
      return NextResponse.json(
        { error: "La signature tactile est obligatoire" },
        { status: 400 }
      );
    }

    // Rate limiting pour les signatures
    const limiter = getRateLimiterByUser(rateLimitPresets.api);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "Trop de requêtes. Veuillez réessayer plus tard.",
          resetAt: limitResult.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitPresets.api.maxRequests.toString(),
            "X-RateLimit-Remaining": limitResult.remaining.toString(),
            "X-RateLimit-Reset": limitResult.resetAt.toString(),
          },
        }
      );
    }

    const serviceClient = createServiceClient();

    // Récupérer le profil avec les infos tenant
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

    // Vérifier les permissions avec le helper SOTA
    const accessResult = await verifyEDLAccess({
      edlId,
      userId: user.id,
      profileId: profile.id,
      profileRole: profile.role
    }, serviceClient);

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    const edl = accessResult.edl;

    const isOwner = profile.role === "owner";
    const signerRole = isOwner ? "owner" : "tenant";
    const cniNumber = (profile as any).tenant_profile?.[0]?.cni_number || null;

    // 3. Vérifier l'identité pour les locataires (CNI obligatoire)
    if (!isOwner && !cniNumber) {
      return NextResponse.json(
        { error: "Votre identité (CNI) doit être vérifiée avant de signer" },
        { status: 403 }
      );
    }

    // 4. Uploader l'image de signature dans Storage (utiliser serviceClient pour éviter RLS)
    const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, "");
    const fileName = `edl/${edlId}/signatures/${user.id}_${Date.now()}.png`;
    
    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(fileName, decode(base64Data), {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[sign-edl] Upload error:", uploadError);
      throw new Error("Erreur lors de l'enregistrement de l'image de signature");
    }

    // 5. Générer le Dossier de Preuve (Audit Trail)
    const proof = await generateSignatureProof({
      documentType: "EDL",
      documentId: edlId,
      documentContent: JSON.stringify(edl), // Hash du contenu actuel de l'EDL
      signerName: `${profile.prenom} ${profile.nom}`,
      signerEmail: user.email!,
      signerProfileId: profile.id,
      identityVerified: isOwner || !!cniNumber,
      identityMethod: isOwner ? "Compte Propriétaire Authentifié" : `CNI n°${cniNumber}`,
      signatureType: "draw",
      signatureImage: signatureBase64,
      userAgent: request.headers.get("user-agent") || "Inconnu",
      ipAddress: extractClientIP(request),
      screenSize: clientMetadata?.screenSize || "Non spécifié",
      touchDevice: clientMetadata?.touchDevice || false,
    });

    // 6. Enregistrer la signature et la preuve en base (serviceClient pour bypass RLS)
    const { data: signature, error: sigError } = await serviceClient
      .from("edl_signatures")
      .upsert({
        edl_id: edlId,
        signer_user: user.id,
        signer_role: signerRole,
        signer_profile_id: profile.id,
        signed_at: new Date().toISOString(),
        signature_image_path: fileName,
        ip_inet: proof.metadata.ipAddress as any,
        user_agent: proof.metadata.userAgent,
        proof_id: proof.proofId,
        proof_metadata: proof as any,
        document_hash: proof.document.hash,
      } as any, {
        onConflict: "edl_id, signer_profile_id"
      })
      .select()
      .single();

    if (sigError) {
      console.error("[sign-edl] Signature upsert error:", sigError);
      throw sigError;
    }

    // 7. Vérifier si tous les signataires ont signé
    const { data: allSignatures } = await serviceClient
      .from("edl_signatures")
      .select("signer_role, signature_image_path, signed_at")
      .eq("edl_id", edlId);

    const hasOwner = allSignatures?.some(
      (s: any) => (s.signer_role === "owner" || s.signer_role === "proprietaire" || s.signer_role === "bailleur") 
        && s.signature_image_path && s.signed_at
    );
    const hasTenant = allSignatures?.some(
      (s: any) => (s.signer_role === "tenant" || s.signer_role === "locataire" || s.signer_role === "locataire_principal") 
        && s.signature_image_path && s.signed_at
    );

    if (hasOwner && hasTenant) {
      await serviceClient
        .from("edl")
        .update({ status: "signed" } as any)
        .eq("id", edlId);

      await serviceClient.from("outbox").insert({
        event_type: "Inspection.Signed",
        payload: {
          edl_id: edlId,
          all_signed: true,
        },
      } as any);
    }

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "edl_signed",
      entity_type: "edl",
      entity_id: edlId,
      metadata: {
        signer_role: signerRole,
        proof_id: proof.proofId,
        ip: proof.metadata.ipAddress
      },
    } as any);

    return NextResponse.json({ success: true, proof_id: proof.proofId });
  } catch (error: unknown) {
    console.error("[sign-edl] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

