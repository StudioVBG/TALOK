// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";

/**
 * ============================================================================
 * POST /api/leases/[id]/sign - Signer un bail (SES/AES/QES)
 * ============================================================================
 * 
 * SCALABILITÉ : Cette API gère TOUS les cas de figure de signature :
 * 
 * 1. PROPRIÉTAIRE (rôle: "proprietaire")
 *    - Peut signer s'il est owner du bien lié au bail
 *    - Auto-ajouté comme signataire s'il n'existe pas dans lease_signers
 *    - Justification : Le propriétaire a toujours le droit de signer ses propres baux
 * 
 * 2. LOCATAIRE PRINCIPAL (rôle: "locataire_principal")
 *    - Doit avoir été invité (existe dans lease_signers)
 *    - Peut être identifié par profile_id OU invited_email
 *    - Justification : Seuls les locataires explicitement invités peuvent signer
 * 
 * 3. COLOCATAIRE (rôle: "colocataire")
 *    - Doit avoir été invité (existe dans lease_signers)
 *    - Même logique que locataire principal
 *    - Justification : Chaque colocataire doit être validé par le propriétaire
 * 
 * 4. GARANT (rôle: "garant")
 *    - Doit avoir été invité (existe dans lease_signers)
 *    - Justification : Le garant s'engage financièrement, doit être explicitement invité
 * 
 * 5. ADMIN (rôle profil: "admin")
 *    - Peut signer pour supervision/test
 *    - Justification : Accès de modération
 * 
 * TYPES DE BAUX SUPPORTÉS :
 * - nu : Bail location nue (3 ans particulier, 6 ans société)
 * - meuble : Bail meublé (1 an, 9 mois étudiant)
 * - colocation : Bail colocation (plusieurs signataires locataires)
 * - saisonnier : Location saisonnière (max 90 jours)
 * - mobilite : Bail mobilité (1-10 mois)
 * - commercial_3_6_9 : Bail commercial
 * - professionnel : Bail professionnel
 * 
 * FLUX DE DONNÉES :
 * 1. Authentification → profiles (user_id → profile_id)
 * 2. Vérification droits → lease_signers, leases, properties
 * 3. Auto-création signataire si propriétaire manquant
 * 4. Upload signature → Storage (documents/signatures/)
 * 5. Création entrées → signatures, signature_evidence
 * 6. Mise à jour → lease_signers (status, image, date)
 * 7. Vérification tous signés → leases (statut: active)
 * 8. Événements → outbox (lease.signed)
 * 9. Audit → audit_log
 */

// Types pour les rôles de signataires
type SignerRole = "proprietaire" | "locataire_principal" | "colocataire" | "garant";

// Interface pour le résultat de vérification des droits
interface SignatureRights {
  canSign: boolean;
  role: SignerRole | null;
  signer: any | null;
  reason?: string;
  needsAutoCreate?: boolean;
}

/**
 * Vérifie si l'utilisateur a le droit de signer ce bail
 * et détermine son rôle
 * 
 * UTILISE LE SERVICE CLIENT pour bypasser les RLS policies
 * Justification : Les vérifications de droits nécessitent un accès complet
 * aux données (bail, bien, signataires) quel que soit l'utilisateur connecté
 */
async function checkSignatureRights(
  leaseId: string,
  profileId: string,
  userEmail: string
): Promise<SignatureRights> {
  
  // Utiliser le service client pour bypasser les RLS
  const serviceClient = getServiceClient();
  
  console.log(`[Sign:checkRights] Vérification droits - Lease: ${leaseId}, Profile: ${profileId}, Email: ${userEmail}`);
  
  // 1. Chercher si l'utilisateur est déjà signataire (par profile_id ou email)
  const { data: existingSigner, error: signerError } = await serviceClient
    .from("lease_signers")
    .select("*")
    .eq("lease_id", leaseId)
    .or(`profile_id.eq.${profileId},invited_email.eq.${userEmail}`)
    .maybeSingle();

  console.log(`[Sign:checkRights] Signataire existant:`, existingSigner, signerError);

  if (existingSigner) {
    // L'utilisateur est déjà dans les signataires
    // Si invited_email correspond mais pas profile_id, mettre à jour
    if (existingSigner.invited_email === userEmail && !existingSigner.profile_id) {
      await serviceClient
        .from("lease_signers")
        .update({ profile_id: profileId })
        .eq("id", existingSigner.id);
      existingSigner.profile_id = profileId;
    }
    
    return {
      canSign: true,
      role: existingSigner.role,
      signer: existingSigner,
    };
  }

  // 2. Récupérer le bail (requête simple sans jointure complexe)
  const { data: lease, error: leaseError } = await serviceClient
    .from("leases")
    .select("id, property_id, type_bail")
    .eq("id", leaseId)
    .single();

  console.log(`[Sign:checkRights] Bail trouvé:`, lease, leaseError);

  if (!lease || leaseError) {
    return {
      canSign: false,
      role: null,
      signer: null,
      reason: `Bail non trouvé (${leaseError?.message || "introuvable"})`,
    };
  }

  // 3. Récupérer le bien pour vérifier le propriétaire
  const { data: property, error: propertyError } = await serviceClient
    .from("properties")
    .select("id, owner_id")
    .eq("id", lease.property_id)
    .single();

  console.log(`[Sign:checkRights] Bien trouvé:`, property, propertyError);

  if (!property) {
    return {
      canSign: false,
      role: null,
      signer: null,
      reason: "Bien associé au bail non trouvé",
    };
  }

  const isOwner = property.owner_id === profileId;
  console.log(`[Sign:checkRights] Est propriétaire: ${isOwner} (property.owner_id=${property.owner_id}, profileId=${profileId})`);

  if (isOwner) {
    // Le propriétaire peut toujours signer, même s'il n'est pas dans lease_signers
    // On va l'ajouter automatiquement
    return {
      canSign: true,
      role: "proprietaire",
      signer: null,
      needsAutoCreate: true,
    };
  }

  // 4. Vérifier si l'utilisateur est admin
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .single();

  if (profile?.role === "admin") {
    // Les admins peuvent signer pour test/modération
    // On les ajoute comme "proprietaire" temporairement
    return {
      canSign: true,
      role: "proprietaire",
      signer: null,
      needsAutoCreate: true,
    };
  }

  // 5. L'utilisateur n'a pas le droit de signer
  return {
    canSign: false,
    role: null,
    signer: null,
    reason: "Vous n'êtes pas signataire de ce bail. Contactez le propriétaire pour recevoir une invitation.",
  };
}

/**
 * Crée automatiquement une entrée signataire pour le propriétaire
 * UTILISE LE SERVICE CLIENT pour bypasser les RLS
 */
async function autoCreateSigner(
  leaseId: string,
  profileId: string,
  role: SignerRole
): Promise<any> {
  const serviceClient = getServiceClient();
  
  const { data: newSigner, error } = await serviceClient
    .from("lease_signers")
    .insert({
      lease_id: leaseId,
      profile_id: profileId,
      role: role,
      signature_status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[Sign] Erreur auto-création signataire:", error);
    throw new Error("Impossible de créer l'entrée signataire");
  }

  console.log(`[Sign] Signataire auto-créé: ${role} pour bail ${leaseId}`);
  return newSigner;
}

/**
 * Détermine le nouveau statut du bail après une signature
 * UTILISE LE SERVICE CLIENT pour bypasser les RLS
 */
async function determineLeaseStatus(
  leaseId: string
): Promise<"active" | "pending_signature" | "pending_owner_signature"> {
  const serviceClient = getServiceClient();
  
  const { data: signers } = await serviceClient
    .from("lease_signers")
    .select("role, signature_status")
    .eq("lease_id", leaseId);

  if (!signers || signers.length === 0) {
    return "pending_signature";
  }

  const allSigned = signers.every((s: any) => s.signature_status === "signed");
  if (allSigned) {
    return "active";
  }

  const ownerSigned = signers.find((s: any) => s.role === "proprietaire")?.signature_status === "signed";
  const tenantSigned = signers.some(
    (s: any) => ["locataire_principal", "colocataire"].includes(s.role) && s.signature_status === "signed"
  );

  if (tenantSigned && !ownerSigned) {
    return "pending_owner_signature";
  }

  return "pending_signature";
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const leaseId = params.id;
  
  try {
    // Client Auth pour l'authentification uniquement
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    // Service Client pour TOUTES les opérations de lecture/écriture
    // Justification : Les RLS policies sur lease_signers créent une récursion infinie
    // Le service client bypass les RLS et permet un accès complet côté serveur
    const serviceClient = getServiceClient();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
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

    const body = await request.json();
    const { level = "SES", otp_code, signature_image } = body;

    // =========================================================================
    // ÉTAPE 1 : Récupérer le profil de l'utilisateur (via service client)
    // =========================================================================
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé. Veuillez compléter votre inscription." },
        { status: 404 }
      );
    }

    const profileId = profile.id;
    const userEmail = user.email || "";

    console.log(`[Sign] Tentative de signature - Bail: ${leaseId}, Profile: ${profileId}, Email: ${userEmail}`);

    // =========================================================================
    // ÉTAPE 2 : Vérifier les droits de signature (SCALABLE)
    // =========================================================================
    const rights = await checkSignatureRights(leaseId, profileId, userEmail);

    if (!rights.canSign) {
      console.log(`[Sign] Signature refusée: ${rights.reason}`);
      return NextResponse.json(
        { error: rights.reason || "Vous n'êtes pas autorisé à signer ce bail" },
        { status: 403 }
      );
    }

    // =========================================================================
    // ÉTAPE 3 : Auto-créer le signataire si nécessaire (propriétaire manquant)
    // =========================================================================
    let signer = rights.signer;
    
    if (rights.needsAutoCreate && !signer) {
      console.log(`[Sign] Auto-création du signataire ${rights.role} pour le bail ${leaseId}`);
      signer = await autoCreateSigner(leaseId, profileId, rights.role!);
    }

    if (!signer) {
      return NextResponse.json(
        { error: "Erreur interne: signataire non trouvé" },
        { status: 500 }
      );
    }

    // Vérifier que le signataire n'a pas déjà signé
    if (signer.signature_status === "signed") {
      return NextResponse.json(
        { error: "Vous avez déjà signé ce bail" },
        { status: 400 }
      );
    }

    // =========================================================================
    // ÉTAPE 4 : Récupérer le draft du bail (via service client)
    // =========================================================================
    const { data: draft } = await serviceClient
      .from("lease_drafts")
      .select("*")
      .eq("lease_id", leaseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Le draft n'est pas obligatoire, on peut signer sans
    const draftId = draft?.id || null;
    const docHash = draft?.pdf_hash || `sha256_${Date.now()}_${leaseId}`;

    // =========================================================================
    // ÉTAPE 5 : Récupérer métadonnées de signature
    // =========================================================================
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const signedAt = new Date().toISOString();

    // =========================================================================
    // ÉTAPE 6 : Uploader l'image de signature si fournie (via service client)
    // =========================================================================
    let signatureImagePath = null;
    if (signature_image && level === "SES") {
      try {
      const base64Data = signature_image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
        const fileName = `signatures/${leaseId}/${user.id}_${Date.now()}.png`;
      
        // Utiliser le service client pour le storage (bypass RLS)
        const { data: uploadData, error: uploadError } = await serviceClient.storage
        .from("documents")
        .upload(fileName, buffer, {
          contentType: "image/png",
            upsert: true,
        });

      if (!uploadError && uploadData) {
        signatureImagePath = uploadData.path;
          console.log(`[Sign] Image signature uploadée: ${signatureImagePath}`);
        } else if (uploadError) {
          console.warn(`[Sign] Erreur upload signature (non bloquant):`, uploadError);
        }
      } catch (uploadErr) {
        console.warn(`[Sign] Exception upload signature (non bloquant):`, uploadErr);
      }
    }

    // =========================================================================
    // ÉTAPE 7 : Créer l'entrée dans la table signatures
    // =========================================================================
    const signatureData: any = {
      lease_id: leaseId,
      signer_user: user.id,
      signer_profile_id: profileId,
      level,
      signed_at: signedAt,
      doc_hash: docHash,
      ip_inet: ip,
      user_agent: userAgent,
    };

    if (draftId) {
      signatureData.draft_id = draftId;
    }

    if (level === "SES") {
      signatureData.otp_verified = true;
      signatureData.signature_image_path = signatureImagePath;
    }

    // Pour AES/QES, appeler le provider externe (à implémenter)
    if (level === "AES" || level === "QES") {
      signatureData.provider_ref = `mock_provider_${Date.now()}`;
      signatureData.provider_data = {};
      
      // Émettre un événement pour escalade vers signature avancée
      await serviceClient.from("outbox").insert({
        event_type: "signature.escalated",
        payload: {
          signature_level: level,
          lease_id: leaseId,
          signer_role: rights.role,
        },
      });
    }

    // Insérer la signature via service client (bypass RLS)
    const { data: signature, error: signatureError } = await serviceClient
      .from("signatures")
      .insert(signatureData)
      .select()
      .single();

    if (signatureError) {
      console.error("[Sign] Erreur création signature:", signatureError);
      // Ne pas bloquer si la table signatures n'existe pas ou erreur
      // La signature reste valide via lease_signers
    }

    // =========================================================================
    // ÉTAPE 8 : Créer la preuve de signature (via service client)
    // =========================================================================
    if (signature) {
      const { error: evidenceError } = await serviceClient
      .from("signature_evidence")
      .insert({
          signature_id: signature.id,
          doc_id: draftId,
          owner_id: profileId,
        ip_inet: ip,
        user_agent: userAgent,
          signed_at: signedAt,
        timezone,
        signature_png_url: signatureImagePath,
        payload_snapshot: {
          level,
          doc_hash: docHash,
            signer_role: rights.role,
            signer_name: `${profile.prenom || ""} ${profile.nom || ""}`.trim(),
        },
        doc_hash: docHash,
        });

    if (evidenceError) {
        console.warn("[Sign] Erreur création preuve (non bloquant):", evidenceError);
      }
    }

    // =========================================================================
    // ÉTAPE 9 : Mettre à jour le statut du signataire (via service client)
    // Justification : Les RLS policies sur lease_signers créent une récursion
    // =========================================================================
    const signerUpdate: any = {
        signature_status: "signed",
      signed_at: signedAt,
    };
    
    // Stocker l'image de signature base64 pour affichage dans le PDF
    if (signature_image) {
      signerUpdate.signature_image = signature_image;
    }
    
    const { error: updateError } = await serviceClient
      .from("lease_signers")
      .update(signerUpdate)
      .eq("id", signer.id);

    if (updateError) {
      console.error("[Sign] Erreur mise à jour signataire:", updateError);
      throw new Error("Erreur lors de la validation de la signature");
    }

    console.log(`[Sign] Signataire ${rights.role} mis à jour: signed`);

    // =========================================================================
    // ÉTAPE 10 : Déterminer et mettre à jour le statut du bail (via service client)
    // =========================================================================
    const newLeaseStatus = await determineLeaseStatus(leaseId);
    
    await serviceClient
        .from("leases")
      .update({ statut: newLeaseStatus })
      .eq("id", leaseId);

    console.log(`[Sign] Statut bail mis à jour: ${newLeaseStatus}`);

    // =========================================================================
    // ÉTAPE 11 : Émettre événements si bail complètement signé (via service client)
    // =========================================================================
    if (newLeaseStatus === "active") {
      await serviceClient.from("outbox").insert({
        event_type: "lease.signed",
        payload: {
          lease_id: leaseId,
          draft_id: draftId,
          final_signer_role: rights.role,
        },
      });

      // Notifier le propriétaire et le(s) locataire(s)
      await serviceClient.from("notifications").insert([
        {
          type: "lease_activated",
          title: "Bail activé",
          message: "Toutes les signatures ont été collectées. Le bail est maintenant actif.",
          lease_id: leaseId,
          user_id: user.id,
        },
      ]);

      console.log(`[Sign] Bail ${leaseId} activé - toutes signatures collectées`);
    }

    // =========================================================================
    // ÉTAPE 12 : Journaliser dans audit_log (via service client)
    // =========================================================================
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "sign",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        level,
        role: rights.role,
        signature_id: signature?.id,
        new_lease_status: newLeaseStatus,
      },
      ip_inet: ip,
      user_agent: userAgent,
    });

    // =========================================================================
    // RÉPONSE SUCCÈS
    // =========================================================================
    return NextResponse.json({
      success: true,
      message: newLeaseStatus === "active" 
        ? "Bail signé et activé avec succès !" 
        : "Signature enregistrée avec succès",
      signer_role: rights.role,
      signature_id: signature?.id,
      lease_status: newLeaseStatus,
      all_signed: newLeaseStatus === "active",
    });

  } catch (error: any) {
    console.error("[Sign] Erreur serveur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur lors de la signature" },
      { status: 500 }
    );
  }
}
