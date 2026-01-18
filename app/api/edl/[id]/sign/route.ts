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

    // ===============================
    // STRATÉGIE DE RÉSOLUTION DU PROFIL (SOTA 2026)
    // ===============================
    // 1. Chercher par user_id (cas standard)
    // 2. Si non trouvé, chercher par email et lier
    // 3. Si non trouvé, chercher dans edl_signatures pour cet EDL
    // ===============================

    let profile: {
      id: string;
      prenom: string;
      nom: string;
      role: string;
      tenant_profile?: { cni_number: string | null }[];
    } | null = null;

    // Étape 1: Chercher par user_id (cas le plus courant)
    const { data: profileByUserId } = await serviceClient
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

    if (profileByUserId) {
      profile = profileByUserId;
      console.log("[sign-edl] ✅ Profil trouvé par user_id:", profile.id);
    }

    // Étape 2: Si non trouvé, chercher par email et lier au compte
    if (!profile && user.email) {
      const { data: profileByEmail } = await serviceClient
        .from("profiles")
        .select(`
          id,
          prenom,
          nom,
          role,
          user_id,
          tenant_profile:tenant_profiles(cni_number)
        `)
        .eq("email", user.email)
        .is("user_id", null) // Profil non lié à un compte
        .maybeSingle();

      if (profileByEmail) {
        // Lier le profil au compte auth
        await serviceClient
          .from("profiles")
          .update({ user_id: user.id })
          .eq("id", profileByEmail.id);

        profile = profileByEmail;
        console.log("[sign-edl] ✅ Profil trouvé par email et lié:", profile.id);
      }
    }

    // Étape 3: Chercher dans edl_signatures pour cet EDL spécifique
    if (!profile) {
      const { data: edlSignature } = await serviceClient
        .from("edl_signatures")
        .select(`
          signer_profile_id,
          signer_email,
          profile:profiles!edl_signatures_signer_profile_id_fkey(
            id,
            prenom,
            nom,
            role,
            user_id,
            tenant_profile:tenant_profiles(cni_number)
          )
        `)
        .eq("edl_id", edlId)
        .or(`signer_user.eq.${user.id},signer_email.eq.${user.email}`)
        .maybeSingle();

      if (edlSignature?.profile) {
        const sigProfile = edlSignature.profile as any;

        // Lier le profil au compte si pas déjà fait
        if (!sigProfile.user_id) {
          await serviceClient
            .from("profiles")
            .update({ user_id: user.id })
            .eq("id", sigProfile.id);
          console.log("[sign-edl] 🔗 Profil lié au compte via edl_signatures");
        }

        profile = {
          id: sigProfile.id,
          prenom: sigProfile.prenom,
          nom: sigProfile.nom,
          role: sigProfile.role,
          tenant_profile: sigProfile.tenant_profile
        };
        console.log("[sign-edl] ✅ Profil trouvé via edl_signatures:", profile.id);
      }
    }

    // Étape 4: Dernier recours - créer un profil minimal
    if (!profile && user.email) {
      console.log("[sign-edl] ⚠️ Création d'un profil minimal pour:", user.email);

      const { data: newProfile, error: createError } = await serviceClient
        .from("profiles")
        .insert({
          user_id: user.id,
          email: user.email,
          role: "tenant",
          prenom: user.user_metadata?.prenom || user.email.split("@")[0],
          nom: user.user_metadata?.nom || "",
        })
        .select(`
          id,
          prenom,
          nom,
          role,
          tenant_profile:tenant_profiles(cni_number)
        `)
        .single();

      if (!createError && newProfile) {
        profile = newProfile;
        console.log("[sign-edl] ✅ Profil minimal créé:", profile.id);
      } else {
        console.error("[sign-edl] Erreur création profil:", createError);
      }
    }

    if (!profile) {
      console.error("[sign-edl] ❌ Impossible de trouver ou créer un profil pour:", user.id, user.email);
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

