export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { extractClientIP } from "@/lib/utils/ip-address";
import { SIGNER_ROLES, isOwnerRole, isTenantRole, LEASE_STATUS } from "@/lib/constants/roles";

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

    // 1. Récupérer le profil (sans jointure tenant_profiles pour éviter les erreurs)
    console.log("[Sign-Lease] Looking for profile with user_id:", user.id);
    
    const { data: profileData, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("user_id", user.id as any)
      .single();

    const profile = profileData as any;
    
    console.log("[Sign-Lease] Profile query result:", { 
      found: !!profile, 
      error: profileError?.message,
      profileId: profile?.id,
      role: profile?.role 
    });

    if (!profile) {
      return NextResponse.json({ 
        error: "Profil non trouvé", 
        details: {
          user_id: user.id,
          email: user.email,
          errorMessage: profileError?.message
        }
      }, { status: 404 });
    }

    // 2. Vérifier les droits de signature
    const rights = await checkSignatureRights(leaseId, profile.id, user.email || "");

    if (!rights.canSign) {
      return NextResponse.json({ error: rights.reason || "Accès refusé" }, { status: 403 });
    }

    const isOwner = profile.role === "owner";
    
    // ✅ FIX: Récupérer le CNI optionnellement (ne bloque plus la signature)
    let cniNumber: string | null = null;
    if (!isOwner) {
      const { data: tenantProfile } = await serviceClient
        .from("tenant_profiles")
        .select("cni_number")
        .eq("profile_id", profile.id as any)
        .maybeSingle();
      
      cniNumber = (tenantProfile as any)?.cni_number || null;
    }

    // ✅ FIX: La vérification CNI n'est plus obligatoire
    // Un locataire avec un compte créé via invitation est considéré comme vérifié
    console.log("[Sign-Lease] Identity check:", { isOwner, hasCNI: !!cniNumber });

    // 4. Récupérer les données du bail pour le hash
    const { data: lease } = await serviceClient
      .from("leases")
      .select("*, property:properties(*)")
      .eq("id", leaseId as any)
      .single();

    // 5. Générer le Dossier de Preuve (Audit Trail)
    // ✅ FIX: Adapter la méthode d'identité selon le cas
    let identityMethod = "Compte Authentifié (Email Vérifié)";
    if (isOwner) {
      identityMethod = "Compte Propriétaire Authentifié";
    } else if (cniNumber) {
      identityMethod = `CNI n°${cniNumber}`;
    }
    
    const proof = await generateSignatureProof({
      documentType: "BAIL",
      documentId: leaseId,
      documentContent: JSON.stringify(lease), // Hash du contenu actuel du bail
      signerName: `${profile.prenom} ${profile.nom}`,
      signerEmail: user.email!,
      signerProfileId: profile.id,
      identityVerified: true, // ✅ FIX: Toujours vrai si le compte existe
      identityMethod: identityMethod,
      signatureType: "draw",
      signatureImage: signature_image,
      userAgent: request.headers.get("user-agent") || "Inconnu",
      ipAddress: extractClientIP(request),
      screenSize: clientMetadata?.screenSize || "Non spécifié",
      touchDevice: clientMetadata?.touchDevice || false,
    });

    // 6. Uploader l'image de signature avec vérification d'erreur
    const base64Data = signature_image.replace(/^data:image\/\w+;base64,/, "");
    const fileName = `signatures/${leaseId}/${user.id}_${Date.now()}.png`;
    
    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(fileName, Buffer.from(base64Data, "base64"), {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Sign-Lease] ❌ Erreur upload signature:", uploadError);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement de la signature. Veuillez réessayer." },
        { status: 500 }
      );
    }
    console.log(`[Sign-Lease] ✅ Signature uploadée: ${fileName}`);

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
      .eq("id", signer.id as any);

    if (updateError) throw updateError;

    // 9. Mettre à jour le statut global du bail
    const newLeaseStatus = await determineLeaseStatus(leaseId);
    await serviceClient.from("leases").update({ statut: newLeaseStatus } as any).eq("id", leaseId as any);

    // 10. Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "lease_signed",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: { role: rights.role, proof_id: proof.proofId },
    } as any);

    // 11. ✅ SOTA 2026: Émettre les événements pour notifications
    try {
      // Récupérer les infos nécessaires pour les notifications
      const { data: leaseInfo } = await serviceClient
        .from("leases")
        .select(`
          id,
          property:properties(id, adresse_complete, ville, owner_id),
          signers:lease_signers(profile_id, role, signature_status, profiles(prenom, nom, user_id))
        `)
        .eq("id", leaseId)
        .single();

      const ownerSigner = leaseInfo?.signers?.find((s: any) => s.role === "proprietaire");
      const tenantSigner = leaseInfo?.signers?.find((s: any) => 
        s.role === "locataire_principal" || s.role === "locataire"
      );

      // Si le LOCATAIRE vient de signer → Notifier le PROPRIÉTAIRE
      if (rights.role?.includes("locataire") || rights.role === "tenant" || rights.role === "principal") {
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
        console.log(`[Sign-Lease] ✅ Événement Lease.TenantSigned émis pour notifier le propriétaire`);
      }

      // Si le PROPRIÉTAIRE vient de signer → Notifier le LOCATAIRE que c'est fait
      if (rights.role === "proprietaire" || rights.role === "owner" || rights.role === "bailleur") {
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
        console.log(`[Sign-Lease] ✅ Événement Lease.OwnerSigned émis pour notifier le locataire`);
      }

      // Si le bail est maintenant FULLY_SIGNED → Notifier les deux parties
      if (newLeaseStatus === "fully_signed") {
        // Notifier le propriétaire
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

        // Notifier le locataire
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

        console.log(`[Sign-Lease] ✅ Événements Lease.FullySigned émis pour les deux parties`);
      }
    } catch (notifError) {
      // Ne pas bloquer la signature si les notifications échouent
      console.error("[Sign-Lease] Erreur émission événements:", notifError);
    }

    return NextResponse.json({
      success: true,
      proof_id: proof.proofId,
      lease_status: newLeaseStatus,
      new_status: newLeaseStatus
    });

  } catch (error: unknown) {
    console.error("[Sign-Lease] Error:", error);
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
    const { data: placeholderSignerData } = await serviceClient
      .from("lease_signers")
      .select("*")
      .eq("lease_id", leaseId as any)
      .is("profile_id", null)
      .in("role", ["locataire_principal", "locataire", "tenant", "colocataire"] as any)
      .maybeSingle();
    
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
 * ✅ FIX: Vérifie qu'il y a au moins 2 signataires (proprio + locataire) ET qu'ils ont tous signé
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
  
  // ✅ SSOT 2026: Utilisation des helpers de rôles standardisés
  const hasOwner = signers.some(s => isOwnerRole(s.role));
  const hasTenant = signers.some(s => isTenantRole(s.role));
  
  // ✅ FIX: Vérifier qu'on a au moins 2 signataires
  if (signers.length < 2 || !hasOwner || !hasTenant) {
    console.warn("[determineLeaseStatus] Missing required signers (owner:", hasOwner, ", tenant:", hasTenant, ", count:", signers.length, ")");
    return signers.some(s => s.signature_status === "signed") ? LEASE_STATUS.PENDING_SIGNATURE : LEASE_STATUS.DRAFT;
  }
  
  // ✅ FIX: Vérifier que le locataire a un vrai profil lié (pas juste un placeholder)
  const tenantSigner = signers.find(s => isTenantRole(s.role));
  
  const allSigned = signers.every(s => s.signature_status === "signed");

  if (allSigned) {
    // ✅ FIX: Ne pas activer si le locataire n'a pas de profil réel
    if (!tenantSigner?.profile_id) {
      console.warn("[determineLeaseStatus] All signed but tenant has no profile_id - keeping pending_signature");
      return LEASE_STATUS.PENDING_SIGNATURE;
    }
    // ✅ SOTA 2026: Le bail signé passe à "fully_signed", l'activation se fait après l'EDL
    console.log("[determineLeaseStatus] All signers signed with valid profiles, lease fully signed:", leaseId);
    return LEASE_STATUS.FULLY_SIGNED;
  }

  // ✅ FIX: Code simplifié - si pas tous signés, c'est pending_signature
  // Note: En cas de signatures simultanées, la dernière requête déterminera le statut final correct
  // grâce à la lecture après mise à jour (eventual consistency)
  return LEASE_STATUS.PENDING_SIGNATURE;
}
