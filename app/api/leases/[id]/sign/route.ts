export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { extractClientIP } from "@/lib/utils/ip-address";
import { SIGNER_ROLES, isOwnerRole, isTenantRole, LEASE_STATUS } from "@/lib/constants/roles";
import { validateSignatureImage, stripBase64Prefix } from "@/lib/utils/validate-signature";
import { createSignatureLogger } from "@/lib/utils/signature-logger";

/**
 * POST /api/leases/[id]/sign - Signer un bail avec Audit Trail conforme
 *
 * FIX P0-2: Validation image signature côté serveur
 * FIX P0-3: Décompte quotas signatures
 * FIX P0-6: Appel seal_lease() après fully_signed
 * FIX P1-2: Suppression base64 de proof_metadata
 * FIX P2-5: Logger structuré
 *
 * @version 2026-02-15 - Audit sécurité complet
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leaseId = id;
  const log = createSignatureLogger("/api/leases/[id]/sign", leaseId);
  log.setContext({ entityType: "lease" });
  
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    const serviceClient = getServiceClient();

    if (!user) {
      log.warn("Tentative non authentifiée");
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    log.setContext({ userId: user.id });

    // Rate limiting
    const limiter = getRateLimiterByUser(rateLimitPresets.api);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) {
      log.warn("Rate limit atteint");
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

    // FIX P0-2: Validation de l'image de signature côté serveur
    const validation = validateSignatureImage(signature_image);
    if (!validation.valid) {
      log.warn("Image de signature invalide", { errors: validation.errors, sizeBytes: validation.sizeBytes });
      return NextResponse.json(
        { error: validation.errors[0], validation_errors: validation.errors },
        { status: 400 }
      );
    }

    // 1. Récupérer le profil
    const { data: profileData, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("user_id", user.id as any)
      .single();

    const profile = profileData as any;

    if (!profile) {
      log.error("Profil non trouvé", { profileError: profileError?.message });
      return NextResponse.json({ 
        error: "Profil non trouvé", 
        details: {
          user_id: user.id,
          email: user.email,
          errorMessage: profileError?.message
        }
      }, { status: 404 });
    }

    log.setContext({ profileId: profile.id, signerRole: profile.role });

    // 2. Vérifier les droits de signature
    const rights = await checkSignatureRights(leaseId, profile.id, user.email || "");

    if (!rights.canSign) {
      log.warn("Droits de signature refusés", { reason: rights.reason });
      return NextResponse.json({ error: rights.reason || "Accès refusé" }, { status: 403 });
    }

    const isOwner = profile.role === "owner";
    
    // Récupérer le CNI optionnellement
    let cniNumber: string | null = null;
    if (!isOwner) {
      const { data: tenantProfile } = await serviceClient
        .from("tenant_profiles")
        .select("cni_number")
        .eq("profile_id", profile.id as any)
        .maybeSingle();
      
      cniNumber = (tenantProfile as any)?.cni_number || null;
    }

    log.info("Vérification identité", { isOwner, hasCNI: !!cniNumber });

    // 3. FIX P0-3: Vérifier le quota de signatures avant de continuer
    try {
      const { incrementSignatureUsage, checkSignatureQuota } = await import("@/lib/subscriptions/signature-tracking");
      
      // Trouver le owner_id du bien pour vérifier son quota
      const { data: leaseForQuota } = await serviceClient
        .from("leases")
        .select("property:properties(owner_id)")
        .eq("id", leaseId as any)
        .single();
      
      const ownerId = (leaseForQuota as any)?.property?.owner_id;
      if (ownerId) {
        const quota = await checkSignatureQuota(ownerId);
        if (!quota.canSign && !quota.isUnlimited) {
          log.warn("Quota de signatures atteint", { used: quota.used, limit: quota.limit });
          return NextResponse.json(
            { error: "Quota de signatures mensuel atteint. Veuillez upgrader votre abonnement." },
            { status: 403 }
          );
        }
      }
    } catch (quotaError) {
      // Ne pas bloquer la signature si le service de quota est indisponible
      log.warn("Vérification quota échouée, poursuite", { error: String(quotaError) });
    }

    // 4. Récupérer les données du bail pour le hash
    const { data: lease } = await serviceClient
      .from("leases")
      .select("*, property:properties(*)")
      .eq("id", leaseId as any)
      .single();

    // 5. Générer le Dossier de Preuve (Audit Trail)
    let identityMethod = "Compte Authentifié (Email Vérifié)";
    if (isOwner) {
      identityMethod = "Compte Propriétaire Authentifié";
    } else if (cniNumber) {
      identityMethod = `CNI n°${cniNumber}`;
    }
    
    const proof = await generateSignatureProof({
      documentType: "BAIL",
      documentId: leaseId,
      documentContent: JSON.stringify(lease),
      signerName: `${profile.prenom} ${profile.nom}`,
      signerEmail: user.email!,
      signerProfileId: profile.id,
      identityVerified: true,
      identityMethod: identityMethod,
      signatureType: "draw",
      signatureImage: signature_image,
      userAgent: request.headers.get("user-agent") || "Inconnu",
      ipAddress: extractClientIP(request),
      screenSize: clientMetadata?.screenSize || "Non spécifié",
      touchDevice: clientMetadata?.touchDevice || false,
    });

    // 6. Uploader l'image de signature
    const base64Data = stripBase64Prefix(signature_image);
    const fileName = `signatures/${leaseId}/${user.id}_${Date.now()}.png`;
    
    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(fileName, Buffer.from(base64Data, "base64"), {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      log.error("Erreur upload signature", { uploadError: uploadError.message });
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement de la signature. Veuillez réessayer." },
        { status: 500 }
      );
    }
    log.info("Signature uploadée", { fileName });

    // 7. Auto-créer le signataire si nécessaire
    let signer = rights.signer;
    if (rights.needsAutoCreate && !signer) {
      signer = await autoCreateSigner(leaseId, profile.id, rights.role!);
    }

    // 8. Mettre à jour le signataire avec les infos de preuve
    // FIX P1-2: Exclure l'image base64 du proof_metadata pour réduire la taille
    const proofForDB = {
      ...proof,
      signature: {
        ...proof.signature,
        imageData: `[STORED:${fileName}]`,
      },
    };

    const { error: updateError } = await serviceClient
      .from("lease_signers")
      .update({
        signature_status: "signed",
        signed_at: proof.timestamp.iso,
        signature_image_path: fileName,
        ip_inet: proof.metadata.ipAddress as any,
        user_agent: proof.metadata.userAgent,
        proof_id: proof.proofId,
        proof_metadata: proofForDB as any,
        document_hash: proof.document.hash,
      } as any)
      .eq("id", signer.id as any);

    if (updateError) {
      await serviceClient.storage.from("documents").remove([fileName]).catch(() => null);
      throw updateError;
    }

    // 9. Mettre à jour le statut global du bail
    // FIX AUDIT 2026-02-16: Vérification d'erreur + rollback compensatoire
    const newLeaseStatus = await determineLeaseStatus(leaseId);
    const { error: leaseUpdateError } = await serviceClient
      .from("leases")
      .update({ statut: newLeaseStatus } as any)
      .eq("id", leaseId as any);

    if (leaseUpdateError) {
      log.error("Échec mise à jour statut bail — rollback signataire", {
        leaseUpdateError: leaseUpdateError.message,
        attemptedStatus: newLeaseStatus,
      });
      // Rollback compensatoire : remettre le signataire en pending + supprimer le fichier orphelin
      await serviceClient
        .from("lease_signers")
        .update({ signature_status: "pending", signed_at: null, signature_image_path: null } as any)
        .eq("id", signer.id as any);
      await serviceClient.storage.from("documents").remove([fileName]).catch(() => null);
      throw new Error(
        `Échec de la mise à jour du statut du bail: ${leaseUpdateError.message}. La signature a été annulée, veuillez réessayer.`
      );
    }

    // FIX P0-3: Incrémenter l'usage des signatures après succès
    try {
      const { incrementSignatureUsage } = await import("@/lib/subscriptions/signature-tracking");
      const leaseForOwner = lease as any;
      const ownerId = leaseForOwner?.property?.owner_id || leaseForOwner?.property_id;
      if (ownerId) {
        await incrementSignatureUsage(ownerId, 1, {
          document_type: "bail",
          document_id: leaseId,
          signers_count: 1,
        });
      }
    } catch (usageError) {
      log.warn("Erreur incrément usage signature", { error: String(usageError) });
    }

    // FIX P0-6: Si fully_signed, déclencher le scellement du bail
    if (newLeaseStatus === LEASE_STATUS.FULLY_SIGNED) {
      try {
        const { error: sealError } = await serviceClient.rpc("seal_lease", {
          p_lease_id: leaseId,
          p_pdf_path: `pending_generation_${Date.now()}`,
        });
        if (sealError) {
          log.warn("Erreur scellement bail (non bloquant)", {
            lease_id: leaseId,
            sealError: sealError.message,
            code: sealError.code,
          });
          // Insert outbox pour retry asynchrone (worker/cron peut rappeler seal_lease)
          try {
            await serviceClient.from("outbox").insert({
              event_type: "Lease.SealRetry",
              payload: { lease_id: leaseId, reason: "seal_lease_failed", error: sealError.message },
            });
          } catch {
            // non bloquant
          }
        } else {
          log.info("Bail scellé avec succès", { lease_id: leaseId });
        }
      } catch (sealErr) {
        log.warn("Exception scellement bail", { lease_id: leaseId, error: String(sealErr) });
        try {
          await serviceClient.from("outbox").insert({
            event_type: "Lease.SealRetry",
            payload: { lease_id: leaseId, reason: "seal_lease_exception", error: String(sealErr) },
          });
        } catch {
          // non bloquant
        }
      }
    }

    // 10. Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "lease_signed",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: { role: rights.role, proof_id: proof.proofId, correlation_id: log.getCorrelationId() },
    } as any);

    // 11. Émettre les événements pour notifications
    try {
      const { data: leaseInfo } = await serviceClient
        .from("leases")
        .select(`
          id,
          property:properties(id, adresse_complete, ville, owner_id),
          signers:lease_signers(profile_id, role, signature_status, profiles(prenom, nom, user_id))
        `)
        .eq("id", leaseId)
        .single();

      const ownerSigner = leaseInfo?.signers?.find((s: any) => isOwnerRole(s.role));
      const tenantSigner = leaseInfo?.signers?.find((s: any) => isTenantRole(s.role));

      // Si le LOCATAIRE vient de signer → Notifier le PROPRIÉTAIRE
      if (isTenantRole(rights.role) || rights.role === "tenant" || rights.role === "principal") {
        await serviceClient.from("outbox").insert({
          event_type: "Lease.TenantSigned",
          payload: {
            lease_id: leaseId,
            owner_user_id: ownerSigner?.profiles?.user_id,
            owner_profile_id: ownerSigner?.profile_id,
            tenant_name: `${tenantSigner?.profiles?.prenom || ""} ${tenantSigner?.profiles?.nom || ""}`.trim() || "Le locataire",
            property_address: leaseInfo?.property?.adresse_complete || leaseInfo?.property?.ville || "votre bien",
          },
        } as any);
      }

      // Si le PROPRIÉTAIRE vient de signer → Notifier le LOCATAIRE
      if (isOwnerRole(rights.role)) {
        await serviceClient.from("outbox").insert({
          event_type: "Lease.OwnerSigned",
          payload: {
            lease_id: leaseId,
            tenant_user_id: tenantSigner?.profiles?.user_id,
            tenant_profile_id: tenantSigner?.profile_id,
            owner_name: `${ownerSigner?.profiles?.prenom || ""} ${ownerSigner?.profiles?.nom || ""}`.trim() || "Le propriétaire",
            property_address: leaseInfo?.property?.adresse_complete || leaseInfo?.property?.ville || "le bien",
          },
        } as any);
      }

      // Si le bail est maintenant FULLY_SIGNED → Notifier les deux parties
      if (newLeaseStatus === LEASE_STATUS.FULLY_SIGNED) {
        if (ownerSigner?.profiles?.user_id) {
          await serviceClient.from("outbox").insert({
            event_type: "Lease.FullySigned",
            payload: {
              lease_id: leaseId,
              user_id: ownerSigner.profiles.user_id,
              profile_id: ownerSigner.profile_id,
              is_owner: true,
              property_address: leaseInfo?.property?.adresse_complete || leaseInfo?.property?.ville,
              next_step: "edl_entree",
            },
          } as any);
        }

        if (tenantSigner?.profiles?.user_id) {
          await serviceClient.from("outbox").insert({
            event_type: "Lease.FullySigned",
            payload: {
              lease_id: leaseId,
              user_id: tenantSigner.profiles.user_id,
              profile_id: tenantSigner.profile_id,
              is_owner: false,
              property_address: leaseInfo?.property?.adresse_complete || leaseInfo?.property?.ville,
              next_step: "await_edl",
            },
          } as any);
        }
      }
    } catch (notifError) {
      log.warn("Erreur émission événements (non bloquant)", { error: String(notifError) });
    }

    // Invalider le cache ISR — propriétaire ET locataire
    const signedPropertyId = (lease as any)?.property_id || (lease as any)?.property?.id;
    if (signedPropertyId) {
      revalidatePath(`/owner/properties/${signedPropertyId}`);
      revalidatePath("/owner/properties");
    }
    revalidatePath("/owner/leases");
    revalidatePath("/tenant/signatures");
    revalidatePath("/tenant/documents");
    revalidatePath(`/owner/leases/${leaseId}`);

    log.complete(true, { proofId: proof.proofId, newStatus: newLeaseStatus });

    return NextResponse.json({
      success: true,
      proof_id: proof.proofId,
      lease_status: newLeaseStatus,
      new_status: newLeaseStatus
    });

  } catch (error: unknown) {
    log.complete(false, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Vérifie les droits de signature d'un utilisateur sur un bail
 * - Cherche d'abord par profile_id
 * - Puis par email (pour les invités)
 * - Puis vérifie si c'est le propriétaire
 */
async function checkSignatureRights(leaseId: string, profileId: string, email: string): Promise<{
  canSign: boolean;
  reason?: string;
  signer?: any;
  role?: string;
  needsAutoCreate?: boolean;
}> {
  const serviceClient = getServiceClient();
  
  // 1. Chercher si l'utilisateur est déjà un signataire via profile_id
  const { data: existingSignerData } = await serviceClient
    .from("lease_signers")
    .select("*")
    .eq("lease_id", leaseId as any)
    .eq("profile_id", profileId as any)
    .maybeSingle();
  
  const existingSigner = existingSignerData as any;
    
  if (existingSigner) {
    if (existingSigner.signature_status === "signed") {
      return { canSign: false, reason: "Vous avez déjà signé ce bail" };
    }
    return { 
      canSign: true, 
      signer: existingSigner, 
      role: existingSigner.role,
      needsAutoCreate: false 
    };
  }
  
  // 2. Chercher si l'utilisateur est invité via email (signataire sans profile_id)
  if (email) {
    const { data: invitedSignerData } = await serviceClient
      .from("lease_signers")
      .select("*")
      .eq("lease_id", leaseId as any)
      .eq("invited_email", email as any)
      .is("profile_id", null)
      .maybeSingle();
    
    const invitedSigner = invitedSignerData as any;
      
    if (invitedSigner) {
      if (invitedSigner.signature_status === "signed") {
        return { canSign: false, reason: "Vous avez déjà signé ce bail" };
      }
      // L'utilisateur a été invité par email - mettre à jour avec son profile_id
      const { data: updated } = await serviceClient
        .from("lease_signers")
        .update({ profile_id: profileId } as any)
        .eq("id", invitedSigner.id as any)
        .select()
        .single();
        
      if (updated) {
        console.log("[checkSignatureRights] Linked invited signer to profile:", profileId);
        return { 
          canSign: true, 
          signer: updated, 
          role: invitedSigner.role,
          needsAutoCreate: false 
        };
      }
    }
    
    // 2b. Chercher un signataire locataire avec email placeholder (fallback)
    // Prioritize matching by email first for accuracy, then fall back to any placeholder
    let placeholderSignerData: any = null;

    if (email) {
      // Try exact email match first
      const { data: emailMatch } = await serviceClient
        .from("lease_signers")
        .select("*")
        .eq("lease_id", leaseId as any)
        .is("profile_id", null)
        .in("role", ["locataire_principal", "locataire", "tenant", "colocataire"] as any)
        .eq("invited_email", email)
        .maybeSingle();

      placeholderSignerData = emailMatch;
    }

    if (!placeholderSignerData) {
      // Fall back to any placeholder signer without profile_id
      const { data: anyPlaceholder } = await serviceClient
        .from("lease_signers")
        .select("*")
        .eq("lease_id", leaseId as any)
        .is("profile_id", null)
        .in("role", ["locataire_principal", "locataire", "tenant", "colocataire"] as any)
        .maybeSingle();

      placeholderSignerData = anyPlaceholder;
    }
    
    const placeholderSigner = placeholderSignerData as any;
      
    if (placeholderSigner) {
      // Mettre à jour avec le vrai profile_id
      const { data: updated } = await serviceClient
        .from("lease_signers")
        .update({ profile_id: profileId, invited_email: email } as any)
        .eq("id", placeholderSigner.id as any)
        .select()
        .single();
        
      if (updated) {
        console.log("[checkSignatureRights] Updated placeholder signer with profile:", profileId);
        return { 
          canSign: true, 
          signer: updated, 
          role: placeholderSigner.role,
          needsAutoCreate: false 
        };
      }
    }
  }
  
  // 3. Vérifier si c'est le propriétaire du bien
  const { data: leaseData } = await serviceClient
    .from("leases")
    .select("property:properties(owner_id)")
    .eq("id", leaseId as any)
    .single();
  
  const lease = leaseData as any;
    
  if (lease && lease.property?.owner_id === profileId) {
    // Chercher le signataire propriétaire existant
    const { data: ownerSignerData } = await serviceClient
      .from("lease_signers")
      .select("*")
      .eq("lease_id", leaseId as any)
      .in("role", ["proprietaire", "owner"] as any)
      .maybeSingle();
    
    const ownerSigner = ownerSignerData as any;
      
    if (ownerSigner) {
      if (ownerSigner.signature_status === "signed") {
        return { canSign: false, reason: "Vous avez déjà signé ce bail en tant que propriétaire" };
      }
      // Mettre à jour avec le profile_id si nécessaire
      if (!ownerSigner.profile_id) {
        const { data: updated } = await serviceClient
          .from("lease_signers")
          .update({ profile_id: profileId } as any)
          .eq("id", ownerSigner.id as any)
          .select()
          .single();
          
        if (updated) {
          return { 
            canSign: true, 
            signer: updated, 
            role: "proprietaire",
            needsAutoCreate: false 
          };
        }
      }
      return { 
        canSign: true, 
        signer: ownerSigner, 
        role: "proprietaire",
        needsAutoCreate: false 
      };
}
    // Le propriétaire n'a pas encore de signataire, il faut en créer un
    return { 
      canSign: true, 
      signer: null, 
      role: "proprietaire",
      needsAutoCreate: true 
    };
  }
  
  return { canSign: false, reason: "Vous n'êtes pas autorisé à signer ce bail" };
}

/**
 * Crée automatiquement un signataire pour un bail
 */
async function autoCreateSigner(leaseId: string, profileId: string, role: string): Promise<any> {
  const serviceClient = getServiceClient();
  
  const { data: newSigner, error } = await serviceClient
    .from("lease_signers")
    .insert({
      lease_id: leaseId,
      profile_id: profileId,
      role: role,
      signature_status: "pending",
    } as any)
    .select()
    .single();
    
  if (error) {
    console.error("[autoCreateSigner] Error:", error);
    throw new Error("Impossible de créer le signataire: " + error.message);
  }
  
  const signer = newSigner as any;
  console.log("[autoCreateSigner] Created signer:", signer.id, "for lease:", leaseId);
  return signer;
}

/**
 * Détermine le statut du bail en fonction des signatures
 * Transitions :
 *   - Aucune signature           → DRAFT (ou PENDING_SIGNATURE si signataires présents)
 *   - Signature(s) partielle(s)  → PARTIALLY_SIGNED
 *   - Tous locataires/garants OK → PENDING_OWNER_SIGNATURE
 *   - Tout le monde signé        → FULLY_SIGNED
 */
async function determineLeaseStatus(leaseId: string): Promise<string> {
  const serviceClient = getServiceClient();
  
  const { data: signersData, error } = await serviceClient
    .from("lease_signers")
    .select("signature_status, role, profile_id")
    .eq("lease_id", leaseId as any);
  
  const signers = signersData as any[];
    
  if (error || !signers || signers.length === 0) {
    console.warn("[determineLeaseStatus] No signers found for lease:", leaseId);
    return LEASE_STATUS.DRAFT;
  }
  
  // Utilisation des helpers de rôles standardisés
  const hasOwner = signers.some(s => isOwnerRole(s.role));
  const hasTenant = signers.some(s => isTenantRole(s.role));
  
  // Vérifier qu'on a au moins 2 signataires (proprio + locataire)
  if (signers.length < 2 || !hasOwner || !hasTenant) {
    console.warn("[determineLeaseStatus] Missing required signers (owner:", hasOwner, ", tenant:", hasTenant, ", count:", signers.length, ")");
    return signers.some(s => s.signature_status === "signed") ? LEASE_STATUS.PARTIALLY_SIGNED : LEASE_STATUS.DRAFT;
  }
  
  const signedCount = signers.filter(s => s.signature_status === "signed").length;
  const allSigned = signedCount === signers.length;
  const ownerSigned = signers.filter(s => isOwnerRole(s.role)).every(s => s.signature_status === "signed");
  const allNonOwnersSigned = signers.filter(s => !isOwnerRole(s.role)).every(s => s.signature_status === "signed");

  if (allSigned) {
    // Vérifier que le locataire a un vrai profil lié
    const tenantSigner = signers.find(s => isTenantRole(s.role));
    if (!tenantSigner?.profile_id) {
      console.warn("[determineLeaseStatus] All signed but tenant has no profile_id - keeping partially_signed");
      return LEASE_STATUS.PARTIALLY_SIGNED;
    }
    // SOTA 2026: Le bail signé passe à "fully_signed", l'activation se fait après l'EDL
    console.log("[determineLeaseStatus] All signers signed with valid profiles, lease fully signed:", leaseId);
    return LEASE_STATUS.FULLY_SIGNED;
  }

  // Tous les locataires et garants ont signé, il manque le propriétaire
  if (allNonOwnersSigned && !ownerSigned && signedCount > 0) {
    console.log("[determineLeaseStatus] All tenants/guarantors signed, pending owner:", leaseId);
    return LEASE_STATUS.PENDING_OWNER_SIGNATURE;
  }

  // Au moins une personne a signé
  if (signedCount > 0) {
    return LEASE_STATUS.PARTIALLY_SIGNED;
  }

  // Personne n'a signé, mais le bail est en attente de signatures
  return LEASE_STATUS.PENDING_SIGNATURE;
}
