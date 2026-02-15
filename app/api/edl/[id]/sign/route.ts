export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { extractClientIP } from "@/lib/utils/ip-address";
import { verifyEDLAccess } from "@/lib/helpers/edl-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { validateSignatureImage, stripBase64Prefix } from "@/lib/utils/validate-signature";
import { createSignatureLogger } from "@/lib/utils/signature-logger";

/**
 * POST /api/edl/[id]/sign - Signer un EDL avec Audit Trail
 * SOTA 2026 v3: Résolution de profil robuste, séparée du join tenant_profiles
 * 
 * Corrections appliquées :
 * - Séparation de la résolution de profil et du join tenant_profiles
 *   (le join ne peut plus faire échouer la résolution)
 * - .single() → .maybeSingle() pour éviter les crashes
 * - Service client singleton (getServiceClient) au lieu de createServiceClient
 * - Gestion d'erreurs exhaustive à chaque étape
 * - Metadata envoyée par les deux flux (owner + tenant)
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

    const log = createSignatureLogger("/api/edl/[id]/sign", edlId);
    log.setContext({ entityType: "edl", userId: user.id });

    const body = await request.json();
    const { signature: signatureBase64, metadata: clientMetadata } = body;

    if (!signatureBase64) {
      return NextResponse.json(
        { error: "La signature tactile est obligatoire" },
        { status: 400 }
      );
    }

    // FIX P0-2: Validation de l'image de signature côté serveur
    const validation = validateSignatureImage(signatureBase64);
    if (!validation.valid) {
      log.warn("Image de signature invalide", { errors: validation.errors });
      return NextResponse.json(
        { error: validation.errors[0], validation_errors: validation.errors },
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

    // Utiliser le service client singleton (plus efficace, cohérent avec le reste du projet)
    const serviceClient = getServiceClient();

    // ===============================
    // STRATÉGIE DE RÉSOLUTION DU PROFIL (SOTA 2026 - v3)
    // ===============================
    // IMPORTANT: On ne join PAS tenant_profiles ici.
    // Le join causait des échecs silencieux pour les propriétaires.
    // On récupère tenant_profiles SÉPARÉMENT après résolution, uniquement si nécessaire.
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
    } | null = null;

    // Étape 1: Chercher par user_id (cas le plus courant)
    const { data: profileByUserId, error: step1Error } = await serviceClient
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (step1Error) {
      console.warn("[sign-edl] ⚠️ Étape 1: Erreur requête:", step1Error.message, step1Error.code);
    }

    if (profileByUserId) {
      profile = profileByUserId;
      console.log("[sign-edl] ✅ Étape 1: Profil trouvé par user_id:", profile.id, "role:", profile.role);
    } else {
      console.log("[sign-edl] ℹ️ Étape 1: Pas de profil avec user_id", step1Error?.message || "");
    }

    // Étape 2: Si non trouvé, chercher par email (avec ou sans user_id existant)
    if (!profile && user.email) {
      console.log("[sign-edl] 🔍 Étape 2: Recherche par email:", user.email);

      const { data: profileByEmail, error: step2Error } = await serviceClient
        .from("profiles")
        .select("id, prenom, nom, role, user_id")
        .eq("email", user.email)
        .maybeSingle();

      if (step2Error) {
        console.warn("[sign-edl] ⚠️ Étape 2: Erreur requête:", step2Error.message, step2Error.code);
      }

      if (profileByEmail) {
        // Cas A: Le profil n'a pas encore de user_id → on le lie
        if (!profileByEmail.user_id) {
          console.log("[sign-edl] 🔗 Étape 2: Liaison du profil au compte auth");
          const { error: linkError } = await serviceClient
            .from("profiles")
            .update({ user_id: user.id })
            .eq("id", profileByEmail.id);
          if (linkError) {
            console.warn("[sign-edl] ⚠️ Étape 2: Erreur liaison user_id:", linkError.message);
          }
        }
        // Cas B: Le profil a un user_id différent → conflit d'identité
        else if (profileByEmail.user_id !== user.id) {
          console.warn("[sign-edl] ⚠️ Étape 2: Conflit - profil email a un autre user_id:", profileByEmail.user_id);
          const { error: updateError } = await serviceClient
            .from("profiles")
            .update({ user_id: user.id })
            .eq("id", profileByEmail.id);
          if (updateError) {
            console.warn("[sign-edl] ⚠️ Étape 2: Erreur mise à jour user_id:", updateError.message);
          }
        }

        profile = {
          id: profileByEmail.id,
          prenom: profileByEmail.prenom,
          nom: profileByEmail.nom,
          role: profileByEmail.role,
        };
        console.log("[sign-edl] ✅ Étape 2: Profil trouvé par email:", profile.id, "role:", profile.role);
      } else {
        console.log("[sign-edl] ℹ️ Étape 2: Pas de profil avec email", step2Error?.message || "");
      }
    }

    // Étape 3: Chercher dans edl_signatures pour cet EDL spécifique
    if (!profile) {
      console.log("[sign-edl] 🔍 Étape 3: Recherche dans edl_signatures pour EDL:", edlId);

      const { data: edlSignature, error: step3Error } = await serviceClient
        .from("edl_signatures")
        .select("id, signer_profile_id, signer_email, signer_user")
        .eq("edl_id", edlId)
        .or(`signer_user.eq.${user.id}${user.email ? `,signer_email.ilike.${user.email}` : ""}`)
        .maybeSingle();

      if (step3Error) {
        console.warn("[sign-edl] ⚠️ Étape 3: Erreur requête edl_signatures:", step3Error.message);
      }

      if (edlSignature) {
        console.log("[sign-edl] ℹ️ Étape 3: Entrée edl_signatures trouvée:", edlSignature.id);

        // Si on a un signer_profile_id, récupérer le profil
        if (edlSignature.signer_profile_id) {
          // FIX: .maybeSingle() au lieu de .single() pour ne pas crasher
          const { data: sigProfile, error: sigProfileError } = await serviceClient
            .from("profiles")
            .select("id, prenom, nom, role, user_id")
            .eq("id", edlSignature.signer_profile_id)
            .maybeSingle();

          if (sigProfileError) {
            console.warn("[sign-edl] ⚠️ Étape 3: Erreur récup profil signer:", sigProfileError.message);
          }

          if (sigProfile) {
            // Lier le profil au compte si pas déjà fait
            if (!sigProfile.user_id || sigProfile.user_id !== user.id) {
              const { error: linkErr } = await serviceClient
                .from("profiles")
                .update({ user_id: user.id })
                .eq("id", sigProfile.id);
              if (linkErr) {
                console.warn("[sign-edl] ⚠️ Étape 3: Erreur liaison:", linkErr.message);
              } else {
                console.log("[sign-edl] 🔗 Étape 3: Profil lié au compte via edl_signatures");
              }
            }

            profile = {
              id: sigProfile.id,
              prenom: sigProfile.prenom,
              nom: sigProfile.nom,
              role: sigProfile.role,
            };
            console.log("[sign-edl] ✅ Étape 3: Profil trouvé via signer_profile_id:", profile.id);
          } else {
            console.log("[sign-edl] ℹ️ Étape 3: signer_profile_id existe mais profil introuvable");
          }
        }

        // Si pas de signer_profile_id mais on a l'entrée, on va créer/lier un profil à l'étape 4
        if (!profile) {
          console.log("[sign-edl] ℹ️ Étape 3: edl_signatures trouvé sans profil valide, passage à l'étape 4");
        }
      } else {
        console.log("[sign-edl] ℹ️ Étape 3: Pas d'entrée edl_signatures correspondante", step3Error?.message || "");
      }
    }

    // Étape 4: Dernier recours - créer un profil minimal (avec gestion conflit email)
    if (!profile && user.email) {
      console.log("[sign-edl] ⚠️ Étape 4: Création d'un profil minimal pour:", user.email);

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
        .select("id, prenom, nom, role")
        .maybeSingle();

      if (createError) {
        console.error("[sign-edl] ❌ Étape 4: Erreur upsert profil:", createError.message, createError.details, createError.code);
      }

      if (newProfile) {
        profile = newProfile;
        console.log("[sign-edl] ✅ Étape 4: Profil créé/mis à jour:", profile.id);
      } else {
        // Dernier essai: peut-être que le profil existe maintenant (race condition)
        const { data: retryProfile, error: retryError } = await serviceClient
          .from("profiles")
          .select("id, prenom, nom, role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (retryError) {
          console.error("[sign-edl] ❌ Étape 4 (retry): Erreur:", retryError.message);
        }

        if (retryProfile) {
          profile = retryProfile;
          console.log("[sign-edl] ✅ Étape 4 (retry): Profil trouvé après erreur:", profile.id);
        }
      }
    }

    // Étape 4b: Si user.email est null, essayer quand même de créer avec l'ID
    if (!profile && !user.email) {
      console.warn("[sign-edl] ⚠️ Étape 4b: user.email est null, tentative de création sans email");
      const { data: fallbackProfile, error: fallbackError } = await serviceClient
        .from("profiles")
        .upsert({
          user_id: user.id,
          email: `user-${user.id.slice(0, 8)}@unknown.local`,
          role: "tenant",
          prenom: user.user_metadata?.prenom || "Utilisateur",
          nom: user.user_metadata?.nom || "",
        }, {
          onConflict: "user_id",
          ignoreDuplicates: false
        })
        .select("id, prenom, nom, role")
        .maybeSingle();

      if (fallbackError) {
        console.error("[sign-edl] ❌ Étape 4b: Erreur:", fallbackError.message);
      }
      if (fallbackProfile) {
        profile = fallbackProfile;
        console.log("[sign-edl] ✅ Étape 4b: Profil créé sans email:", profile.id);
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

    console.log("[sign-edl] ✅ Profil résolu:", profile.id, profile.prenom, profile.nom, "role:", profile.role);

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

    // ===============================
    // RÉCUPÉRATION SÉPARÉE DE tenant_profiles (uniquement pour les locataires)
    // ===============================
    let cniNumber: string | null = null;

    if (!isOwner) {
      const { data: tenantProfile, error: tpError } = await serviceClient
        .from("tenant_profiles")
        .select("cni_number")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (tpError) {
        console.warn("[sign-edl] ⚠️ Erreur récupération tenant_profile:", tpError.message);
      }

      cniNumber = tenantProfile?.cni_number || null;
      console.log("[sign-edl] ℹ️ CNI locataire:", cniNumber ? "présent" : "absent");
    }

    // Vérifier l'identité pour les locataires (CNI obligatoire)
    if (!isOwner && !cniNumber) {
      return NextResponse.json(
        { error: "Votre identité (CNI) doit être vérifiée avant de signer" },
        { status: 403 }
      );
    }

    // 4. Uploader l'image de signature dans Storage (utiliser serviceClient pour éviter RLS)
    const base64Data = stripBase64Prefix(signatureBase64);
    const fileName = `edl/${edlId}/signatures/${user.id}_${Date.now()}.png`;
    
    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(fileName, Buffer.from(base64Data, 'base64'), {
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
    // 🔧 FIX: Exclure l'image base64 du proof_metadata pour réduire la taille
    // et ne PAS insérer de colonne `user_agent` (n'existe que dans lease_signers)
    const proofMetadataForDB = {
      ...proof,
      signature: {
        ...proof.signature,
        imageData: `[STORED:${fileName}]`, // Remplacer par le path stocké
      },
    };

    const { data: signature, error: sigError } = await serviceClient
      .from("edl_signatures")
      .upsert({
        edl_id: edlId,
        signer_user: user.id,
        signer_role: signerRole,
        signer_profile_id: profile.id,
        signer_name: `${profile.prenom || ""} ${profile.nom || ""}`.trim() || user.email || "Signataire",
        signer_email: user.email || null,
        signed_at: new Date().toISOString(),
        signature_image_path: fileName,
        ip_inet: proof.metadata.ipAddress as any,
        proof_id: proof.proofId,
        proof_metadata: proofMetadataForDB as any,
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

