export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { extractClientIP } from "@/lib/utils/ip-address";
import { verifyEDLAccess } from "@/lib/helpers/edl-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { validateSignatureImage, stripBase64Prefix } from "@/lib/utils/validate-signature";
import { createSignatureLogger } from "@/lib/utils/signature-logger";
import { isIdentityValidForSignature, isCniExpiredOrExpiringSoon } from "@/lib/helpers/identity-check";
import type { TenantProfileIdentityFields } from "@/lib/helpers/identity-check";

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
      profile = {
        id: profileByUserId.id,
        prenom: profileByUserId.prenom ?? "",
        nom: profileByUserId.nom ?? "",
        role: profileByUserId.role,
      };
    } else {
    }

    // Étape 2: Si non trouvé, chercher par email (avec ou sans user_id existant)
    if (!profile && user.email) {

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
          const { error: linkError } = await serviceClient
            .from("profiles")
            .update({ user_id: user.id })
            .eq("id", profileByEmail.id);
          if (linkError) {
            console.warn("[sign-edl] ⚠️ Étape 2: Erreur liaison user_id:", linkError.message);
          }
        }
        // Cas B: Le profil a un user_id différent → conflit d'identité
        // FIX AUDIT 2026-02-16: Ne PAS écraser le user_id d'un autre utilisateur.
        // Cela détacherait le profil de son vrai propriétaire. On skip et on passe
        // aux étapes suivantes pour créer/trouver un profil propre.
        else if (profileByEmail.user_id !== user.id) {
          console.warn(
            "[sign-edl] ⚠️ Étape 2: Conflit d'identité détecté — profil email",
            user.email,
            "appartient à user_id:",
            profileByEmail.user_id,
            "mais l'utilisateur courant est:",
            user.id,
            "— on ne touche PAS au profil existant."
          );
          // Ne pas assigner ce profil, passer aux étapes suivantes
        }
        // Cas A résolu ou user_id déjà correct : on peut utiliser le profil
        else {
          profile = {
            id: profileByEmail.id,
            prenom: profileByEmail.prenom ?? "",
            nom: profileByEmail.nom ?? "",
            role: profileByEmail.role,
          };
        }

        // Cas A: user_id était null, on l'a lié → on peut utiliser le profil
        if (!profile && !profileByEmail.user_id) {
          profile = {
            id: profileByEmail.id,
            prenom: profileByEmail.prenom ?? "",
            nom: profileByEmail.nom ?? "",
            role: profileByEmail.role,
          };
        }
      } else {
      }
    }

    // Étape 3: Chercher dans edl_signatures pour cet EDL spécifique
    if (!profile) {

      const { data: edlSignatureData, error: step3Error } = await serviceClient
        .from("edl_signatures")
        .select("id, signer_profile_id, signer_email, signer_user")
        .eq("edl_id", edlId)
        .or(`signer_user.eq.${user.id}${user.email ? `,signer_email.ilike.${user.email}` : ""}`)
        .maybeSingle();

      if (step3Error) {
        console.warn("[sign-edl] ⚠️ Étape 3: Erreur requête edl_signatures:", step3Error.message);
      }

      const edlSignature = edlSignatureData as { id: string; signer_profile_id?: string | null; signer_email?: string | null; signer_user?: string } | null;
      if (edlSignature) {

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
            // FIX AUDIT 2026-02-16: Lier uniquement si user_id est null.
            // Ne jamais écraser un user_id existant appartenant à un autre compte.
            if (!sigProfile.user_id) {
              const { error: linkErr } = await serviceClient
                .from("profiles")
                .update({ user_id: user.id })
                .eq("id", sigProfile.id);
              if (linkErr) {
                console.warn("[sign-edl] ⚠️ Étape 3: Erreur liaison:", linkErr.message);
              } else {
              }
              profile = {
                id: sigProfile.id,
                prenom: sigProfile.prenom ?? "",
                nom: sigProfile.nom ?? "",
                role: sigProfile.role,
              };
            } else if (sigProfile.user_id === user.id) {
              profile = {
                id: sigProfile.id,
                prenom: sigProfile.prenom ?? "",
                nom: sigProfile.nom ?? "",
                role: sigProfile.role,
              };
            } else {
              console.warn(
                "[sign-edl] ⚠️ Étape 3: Profil signer_profile_id",
                sigProfile.id,
                "appartient à un autre user_id:",
                sigProfile.user_id,
                "— skip, passage à l'étape 4"
              );
            }
          } else {
          }
        }

        // Si pas de signer_profile_id mais on a l'entrée, on va créer/lier un profil à l'étape 4
        if (!profile) {
        }
      } else {
      }
    }

    // Étape 4: Dernier recours - créer un profil minimal (avec gestion conflit email)
    if (!profile && user.email) {

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
        profile = {
          id: newProfile.id,
          prenom: newProfile.prenom ?? "",
          nom: newProfile.nom ?? "",
          role: newProfile.role,
        };
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
          profile = {
            id: retryProfile.id,
            prenom: retryProfile.prenom ?? "",
            nom: retryProfile.nom ?? "",
            role: retryProfile.role,
          };
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
        profile = {
          id: fallbackProfile.id,
          prenom: fallbackProfile.prenom ?? "",
          nom: fallbackProfile.nom ?? "",
          role: fallbackProfile.role,
        };
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
    if (!edl) {
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    const isOwner = profile.role === "owner";
    const signerRole = isOwner ? "owner" : "tenant";

    // ===============================
    // RÉCUPÉRATION SÉPARÉE DE tenant_profiles (uniquement pour les locataires) + vérification identité valide pour signature
    // ===============================
    let identityVerified = isOwner;
    let tenantProfileRow: TenantProfileIdentityFields | null = null;

    if (!isOwner) {
      const { data: tenantProfile, error: tpError } = await serviceClient
        .from("tenant_profiles")
        .select("kyc_status, cni_verified_at, cni_number, cni_expiry_date")
        .eq("profile_id", profile.id)
        .maybeSingle() as { data: TenantProfileIdentityFields | null; error: unknown };

      if (tpError) {
        const errorMessage =
          tpError instanceof Error
            ? tpError.message
            : (tpError as { message?: string }).message ?? String(tpError);
        console.warn("[sign-edl] ⚠️ Erreur récupération tenant_profile:", errorMessage);
      }

      tenantProfileRow = tenantProfile;
      identityVerified = isIdentityValidForSignature(tenantProfileRow, { requireNotExpired: true });
      if (!identityVerified) {
        const expired = tenantProfileRow && isCniExpiredOrExpiringSoon(tenantProfileRow);
        return NextResponse.json(
          {
            error: expired
              ? "Votre pièce d'identité a expiré. Merci de la renouveler avant de signer."
              : "Votre identité doit être vérifiée avant de signer (CNI recto + verso).",
          },
          { status: 403 }
        );
      }
    }

    const cniNumber = !isOwner && tenantProfileRow ? (tenantProfileRow.cni_number ?? null) : null;

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
      signerEmail: user.email || `user-${user.id.slice(0, 8)}@talok.local`,
      signerProfileId: profile.id,
      identityVerified,
      identityMethod: isOwner ? "Compte Propriétaire Authentifié" : `CNI n°${cniNumber ?? ""}`,
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

    // FIX: Remplacer .upsert() par une logique explicite find-then-update-or-insert.
    // L'upsert avec onConflict ne fonctionne pas avec les partial unique indexes
    // (edl_signatures_edl_id_signer_profile_id_unique a un WHERE signer_profile_id IS NOT NULL).
    // De plus, les lignes d'invitation (signer_profile_id NULL) n'étaient jamais matchées.
    const orConditions = [
      `signer_profile_id.eq.${profile.id}`,
      `signer_user.eq.${user.id}`,
      ...(user.email ? [`signer_email.ilike.${user.email}`] : []),
    ].join(",");

    const { data: existingRow } = await serviceClient
      .from("edl_signatures")
      .select("id")
      .eq("edl_id", edlId)
      .or(orConditions)
      .maybeSingle();

    const signatureData = {
      edl_id: edlId,
      signer_user: user.id,
      signer_role: signerRole,
      signer_profile_id: profile.id,
      signer_name: `${profile.prenom || ""} ${profile.nom || ""}`.trim() || user.email || "Signataire",
      signer_email: user.email || null,
      signed_at: new Date().toISOString(),
      signature_image_path: fileName,
      ip_inet: proof.metadata.ipAddress ?? null,
      proof_id: proof.proofId,
      proof_metadata: proofMetadataForDB as any,
      document_hash: proof.document.hash,
    };

    let signature;
    let sigError;

    if (existingRow) {
      const result = await serviceClient
        .from("edl_signatures")
        .update(signatureData as any)
        .eq("id", existingRow.id)
        .select()
        .single();
      signature = result.data;
      sigError = result.error;
    } else {
      const result = await serviceClient
        .from("edl_signatures")
        .insert(signatureData as any)
        .select()
        .single();
      signature = result.data;
      sigError = result.error;
    }

    if (sigError) {
      console.error("[sign-edl] Signature save error:", sigError);
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
      const { error: edlUpdateError } = await serviceClient
        .from("edl")
        .update({ status: "signed" } as any)
        .eq("id", edlId);

      if (edlUpdateError) {
        log.error("Échec mise à jour statut EDL", { error: edlUpdateError.message });
      }

      // Sync digicode from EDL keys to property (visible côté locataire)
      const { data: edlRow } = await serviceClient
        .from("edl")
        .select("keys, property_id")
        .eq("id", edlId)
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
          edl_id: edlId,
          all_signed: true,
        },
      } as any);

      // Générer le PDF signé de l'EDL — INSERT/UPDATE document + upload Storage
      // est pris en charge par generateSignedEdlPdf (idempotent, pur PDF).
      try {
        const { handleEDLFullySigned } = await import("@/lib/services/edl-post-signature.service");
        await handleEDLFullySigned(edlId);
      } catch (postSignErr) {
        console.warn("[sign-edl] Exception post-signature EDL (non bloquant):", String(postSignErr));
      }

      // Générer la facture initiale pour le bail (si pas encore créée)
      if (edl.lease_id) {
        try {
          const { ensureInitialInvoiceForLease } = await import("@/lib/services/lease-initial-invoice.service");
          const invoiceResult = await ensureInitialInvoiceForLease(serviceClient as any, edl.lease_id);
          console.log("[sign-edl] Facture initiale:", {
            invoiceId: invoiceResult.invoiceId,
            created: invoiceResult.created,
            amount: invoiceResult.amount,
          });

          if (invoiceResult.created) {
            await serviceClient.from("outbox").insert({
              event_type: "Invoice.InitialCreated",
              payload: {
                invoice_id: invoiceResult.invoiceId,
                lease_id: edl.lease_id,
                tenant_profile_id: invoiceResult.tenantProfileId,
                owner_profile_id: invoiceResult.ownerProfileId,
                amount: invoiceResult.amount,
                deposit_amount: invoiceResult.depositAmount,
              },
            } as any);
          }
        } catch (invoiceErr) {
          console.error("[sign-edl] Erreur génération facture initiale:", String(invoiceErr));
        }
      }
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
        ip: proof.metadata.ipAddress ?? undefined,
      },
    } as any);

    // FIX AUDIT 2026-02-16: Invalider le cache pour que l'UI reflète la signature
    revalidatePath("/owner/inspections");
    revalidatePath(`/owner/inspections/${edlId}`);
    revalidatePath("/tenant/inspections");
    revalidatePath(`/tenant/inspections/${edlId}`);

    return NextResponse.json({
      success: true,
      proof_id: proof.proofId,
      ...(!identityVerified && { identity_warning: true }),
    });
  } catch (error: unknown) {
    const errMessage =
      error instanceof Error
        ? error.message
        : (error as { message?: string })?.message ?? "Erreur serveur";
    console.error("[sign-edl] Error:", errMessage, error);
    return NextResponse.json(
      { error: errMessage },
      { status: 500 }
    );
  }
}

