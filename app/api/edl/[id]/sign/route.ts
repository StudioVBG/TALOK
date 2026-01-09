export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
import { decode } from "base64-arraybuffer";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { extractClientIP } from "@/lib/utils/ip-address";

/**
 * POST /api/edl/[id]/sign - Signer un EDL avec Audit Trail
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
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

    // 🔧 FIX: Utiliser un service client pour contourner RLS et éviter les erreurs "EDL non trouvé"
    const serviceClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 1. Récupérer l'EDL et les infos de bail/identité (sans RLS)
    const { data: edl, error: edlError } = await serviceClient
      .from("edl")
      .select(`
        *,
        lease:leases (
          id,
          property:properties(id, adresse_complete, ville, code_postal, owner_id),
          tenant_identity_verified
        )
      `)
      .eq("id", params.id)
      .single();

    if (edlError || !edl) {
      console.error("[sign-edl] EDL not found:", edlError);
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    // 2. Récupérer le profil pour déterminer le rôle et l'identité
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

    // 🔧 FIX: Vérification manuelle des permissions (puisqu'on bypass RLS)
    const edlData = edl as any;
    let isAuthorized = false;

    // Cas 1: L'utilisateur est le créateur de l'EDL
    if (edlData.created_by === user.id) {
      isAuthorized = true;
    }

    // Cas 2: L'utilisateur est le propriétaire du bien
    if (edlData.lease?.property?.owner_id === profile.id) {
      isAuthorized = true;
    }

    // Cas 3: L'utilisateur est un signataire de l'EDL
    const { data: edlSignature } = await serviceClient
      .from("edl_signatures")
      .select("id")
      .eq("edl_id", params.id)
      .eq("signer_profile_id", profile.id)
      .maybeSingle();
    
    if (edlSignature) {
      isAuthorized = true;
    }

    // Cas 4: L'utilisateur est un signataire du bail lié
    if (edlData.lease_id) {
      const { data: leaseSigner } = await serviceClient
        .from("lease_signers")
        .select("id")
        .eq("lease_id", edlData.lease_id)
        .eq("profile_id", profile.id)
        .maybeSingle();
      
      if (leaseSigner) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      console.error("[sign-edl] Accès non autorisé pour user:", user.id);
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

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
    const fileName = `edl/${params.id}/signatures/${user.id}_${Date.now()}.png`;
    
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
      documentId: params.id,
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
        edl_id: params.id,
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
      .eq("edl_id", params.id);

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
        .eq("id", params.id);

      await serviceClient.from("outbox").insert({
        event_type: "Inspection.Signed",
        payload: {
          edl_id: params.id,
          all_signed: true,
        },
      } as any);
    }

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "edl_signed",
      entity_type: "edl",
      entity_id: params.id,
      metadata: { 
        signer_role: signerRole, 
        proof_id: proof.proofId,
        ip: proof.metadata.ipAddress
      },
    } as any);

    return NextResponse.json({ success: true, proof_id: proof.proofId });
  } catch (error: any) {
    console.error("[sign-edl] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

