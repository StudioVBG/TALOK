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
    // STRATÉGIE DE RÉSOLUTION DU PROFIL (SOTA 2026 - v2)
    // ===============================
    // 1. Chercher par user_id (cas standard)
    // 2. Chercher par email et lier/mettre à jour si nécessaire
    // 3. Chercher dans edl_signatures pour cet EDL spécifique
    // 4. Créer un profil minimal en dernier recours (avec gestion conflit)
    // ===============================

    console.log("[sign-edl] 🔍 Résolution du profil pour user:", user.id, "email:", user.email);

    let profile: {
      id: string;
      prenom: string;
      nom: string;
      role: string;
      tenant_profile?: { cni_number: string | null }[];
    } | null = null;

    // Étape 1: Chercher par user_id (cas le plus courant)
    const { data: profileByUserId, error: step1Error } = await serviceClient
      .from("profiles")
      .select(`
        id,
        prenom,
        nom,
        role,
        tenant_profile:tenant_profiles(cni_number)
      `)
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileByUserId) {
      profile = profileByUserId;
      console.log("[sign-edl] ✅ Étape 1: Profil trouvé par user_id:", profile.id);
    } else {
      console.log("[sign-edl] ℹ️ Étape 1: Pas de profil avec user_id", step1Error?.message || "");
    }

    // Étape 2: Si non trouvé, chercher par email (avec ou sans user_id existant)
    if (!profile && user.email) {
      console.log("[sign-edl] 🔍 Étape 2: Recherche par email:", user.email);

      const { data: profileByEmail, error: step2Error } = await serviceClient
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
        .maybeSingle();

      if (profileByEmail) {
        // Cas A: Le profil n'a pas encore de user_id → on le lie
        if (!profileByEmail.user_id) {
          console.log("[sign-edl] 🔗 Étape 2: Liaison du profil au compte auth");
          await serviceClient
            .from("profiles")
            .update({ user_id: user.id })
            .eq("id", profileByEmail.id);
        }
        // Cas B: Le profil a un user_id différent → conflit d'identité
        else if (profileByEmail.user_id !== user.id) {
          console.warn("[sign-edl] ⚠️ Étape 2: Conflit - profil email a un autre user_id:", profileByEmail.user_id);
          // On met à jour le user_id pour correspondre au compte auth actuel
          // (l'utilisateur s'est peut-être reconnecté avec un nouveau compte)
          await serviceClient
            .from("profiles")
            .update({ user_id: user.id })
            .eq("id", profileByEmail.id);
        }

        profile = {
          id: profileByEmail.id,
          prenom: profileByEmail.prenom,
          nom: profileByEmail.nom,
          role: profileByEmail.role,
          tenant_profile: profileByEmail.tenant_profile
        };
        console.log("[sign-edl] ✅ Étape 2: Profil trouvé par email:", profile.id);
      } else {
        console.log("[sign-edl] ℹ️ Étape 2: Pas de profil avec email", step2Error?.message || "");
      }
    }

    // Étape 3: Chercher dans edl_signatures pour cet EDL spécifique
    if (!profile) {
      console.log("[sign-edl] 🔍 Étape 3: Recherche dans edl_signatures pour EDL:", edlId);

      // D'abord, chercher l'entrée edl_signatures par signer_user OU signer_email
      const { data: edlSignature, error: step3Error } = await serviceClient
        .from("edl_signatures")
        .select(`
          id,
          signer_profile_id,
          signer_email,
          signer_user
        `)
        .eq("edl_id", edlId)
        .or(`signer_user.eq.${user.id}${user.email ? `,signer_email.ilike.${user.email}` : ""}`)
        .maybeSingle();

      if (edlSignature) {
        console.log("[sign-edl] ℹ️ Étape 3: Entrée edl_signatures trouvée:", edlSignature.id);

        // Si on a un signer_profile_id, récupérer le profil
        if (edlSignature.signer_profile_id) {
          const { data: sigProfile } = await serviceClient
            .from("profiles")
            .select(`
              id,
              prenom,
              nom,
              role,
              user_id,
              tenant_profile:tenant_profiles(cni_number)
            `)
            .eq("id", edlSignature.signer_profile_id)
            .single();

          if (sigProfile) {
            // Lier le profil au compte si pas déjà fait
            if (!sigProfile.user_id || sigProfile.user_id !== user.id) {
              await serviceClient
                .from("profiles")
                .update({ user_id: user.id })
                .eq("id", sigProfile.id);
              console.log("[sign-edl] 🔗 Étape 3: Profil lié au compte via edl_signatures");
            }

            profile = {
              id: sigProfile.id,
              prenom: sigProfile.prenom,
              nom: sigProfile.nom,
              role: sigProfile.role,
              tenant_profile: sigProfile.tenant_profile
            };
            console.log("[sign-edl] ✅ Étape 3: Profil trouvé via signer_profile_id:", profile.id);
          }
        }

        // Si pas de signer_profile_id mais on a l'entrée, on va créer/lier un profil à l'étape 4
        if (!profile) {
          console.log("[sign-edl] ℹ️ Étape 3: edl_signatures trouvé sans signer_profile_id, passage à l'étape 4");
        }
      } else {
        console.log("[sign-edl] ℹ️ Étape 3: Pas d'entrée edl_signatures correspondante", step3Error?.message || "");
      }
    }

    // Étape 4: Dernier recours - créer un profil minimal (avec gestion conflit email)
    if (!profile && user.email) {
      console.log("[sign-edl] ⚠️ Étape 4: Création d'un profil minimal pour:", user.email);

      // Utiliser upsert avec on_conflict sur user_id pour éviter les doublons
      const { data: newProfile, error: createError } = await serviceClient
        .from("profiles")
        .upsert({
          user_id: user.id,
          email: user.email,
          role: "tenant",
          prenom: user.user_metadata?.prenom || user.email.split("@")[0],
          nom: user.user_metadata?.nom || "",
        }, {
          onConflict: "user_id",
          ignoreDuplicates: false
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
        console.log("[sign-edl] ✅ Étape 4: Profil créé/mis à jour:", profile.id);
      } else {
        console.error("[sign-edl] ❌ Étape 4: Erreur création profil:", createError?.message, createError?.details);

        // Dernier essai: peut-être que le profil existe maintenant (race condition)
        const { data: retryProfile } = await serviceClient
          .from("profiles")
          .select(`
            id,
            prenom,
            nom,
            role,
            tenant_profile:tenant_profiles(cni_number)
          `)
          .eq("user_id", user.id)
          .maybeSingle();

        if (retryProfile) {
          profile = retryProfile;
          console.log("[sign-edl] ✅ Étape 4 (retry): Profil trouvé après erreur:", profile.id);
        }
      }
    }

    if (!profile) {
      console.error("[sign-edl] ❌ ÉCHEC FINAL: Impossible de trouver ou créer un profil pour:", {
        userId: user.id,
        email: user.email,
        metadata: user.user_metadata
      });
      return NextResponse.json({
        error: "Profil non trouvé. Veuillez vous déconnecter et vous reconnecter, ou contacter le support."
      }, { status: 404 });
    }

    console.log("[sign-edl] ✅ Profil résolu:", profile.id, profile.prenom, profile.nom);

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

