export const runtime = 'nodejs';

// @ts-nocheck
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { verifyOTP, deleteOTP } from "@/lib/services/otp-store";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { extractClientIP } from "@/lib/utils/ip-address";

interface PageProps {
  params: Promise<{ token: string }>;
}

// Décoder le token (format: leaseId:email:timestamp en base64url)
function decodeToken(token: string): { leaseId: string; tenantEmail: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [leaseId, tenantEmail, timestampStr] = decoded.split(":");
    if (!leaseId || !tenantEmail || !timestampStr) return null;
    return { leaseId, tenantEmail, timestamp: parseInt(timestampStr, 10) };
  } catch {
    return null;
  }
}

// Vérifier si le token est expiré (7 jours)
function isTokenExpired(timestamp: number): boolean {
  return Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000;
}

/**
 * POST /api/signature/[token]/sign
 * Valider l'OTP et signer le bail
 */
export async function POST(request: Request, { params }: PageProps) {
  try {
    // Rate limiting pour les signatures (10/minute max)
    const rateLimitResponse = applyRateLimit(request, "signature");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { token } = await params;

    // Décoder le token
    const tokenData = decodeToken(token);
    if (!tokenData) {
      return NextResponse.json(
        { error: "Lien d'invitation invalide" },
        { status: 404 }
      );
    }

    // Vérifier expiration
    if (isTokenExpired(tokenData.timestamp)) {
      return NextResponse.json(
        { error: "Le lien d'invitation a expiré" },
        { status: 410 }
      );
    }

    const serviceClient = getServiceClient();

    // Récupérer le bail avec owner_id
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id, 
        property_id, 
        statut,
        properties (
          owner_id
        )
      `)
      .eq("id", tokenData.leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const otpCode = body.otp_code;
    const signatureImage = body.signatureImage; // Image de signature optionnelle

    if (!otpCode) {
      return NextResponse.json(
        { error: "Code de vérification requis" },
        { status: 400 }
      );
    }

    // Vérifier le code OTP avec le service
    const otpResult = verifyOTP(tokenData.leaseId, otpCode);
    
    if (!otpResult.valid) {
      return NextResponse.json(
        { error: otpResult.error || "Code invalide" },
        { status: 400 }
      );
    }

    // ✅ CODE VALIDE - Le service a déjà supprimé le code

    // ✅ CODE VALIDE - Procéder à la signature

    // ✅ SOTA 2026: Recherche flexible du signataire
    // Priorité 1: Par email (insensible à la casse)
    const normalizedEmail = tokenData.tenantEmail.toLowerCase().trim();
    
    const { data: signer } = await serviceClient
      .from("lease_signers")
      .select("id, profile_id, role, invited_name, invited_email")
      .eq("lease_id", lease.id)
      .ilike("invited_email", normalizedEmail)
      .maybeSingle();

    let actualSigner = signer;
    
    // Priorité 2: Par profile_id via un profil existant
    if (!actualSigner) {
      const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (existingUser) {
        const { data: profile } = await serviceClient
          .from("profiles")
          .select("id")
          .eq("user_id", existingUser.id)
          .single();

        if (profile) {
          const { data: signerByProfile } = await serviceClient
            .from("lease_signers")
            .select("id, profile_id, role, invited_name, invited_email")
            .eq("lease_id", lease.id)
            .eq("profile_id", profile.id)
            .maybeSingle();

          actualSigner = signerByProfile;
        }
      }
    }
    
    // Priorité 3: Par rôle flexible (dernier recours)
    if (!actualSigner) {
      const { data: signerByRole } = await serviceClient
        .from("lease_signers")
        .select("id, profile_id, role, invited_name, invited_email")
        .eq("lease_id", lease.id)
        .in("role", ["locataire_principal", "locataire", "tenant", "colocataire", "principal"])
        .is("signature_status", null)
        .limit(1)
        .maybeSingle();
      
      actualSigner = signerByRole;
    }

    if (!actualSigner) {
      console.error(`[Signature OTP] ❌ Aucun signataire trouvé pour ${normalizedEmail} sur le bail ${lease.id}`);
      return NextResponse.json(
        { error: "Vous n'êtes pas signataire de ce bail" },
        { status: 403 }
      );
    }

    console.log(`[Signature OTP] ✅ Signataire trouvé: ${actualSigner.id}, role: ${actualSigner.role}`);

    const signerProfileId = actualSigner.profile_id || null;
    const signerRole = actualSigner.role;
    const signerName = actualSigner.invited_name || tokenData.tenantEmail;

    // 2. Préparer les données de mise à jour
    const updateData: Record<string, any> = {
      signature_status: "signed",
      signed_at: new Date().toISOString(),
      ip_inet: extractClientIP(request),
    };
    
    // ✅ FIX: Sauvegarder l'image de signature dans Storage + base64
    if (signatureImage) {
      updateData.signature_image = signatureImage; // Base64 comme fallback
      
      // Uploader aussi dans Storage pour cohérence
      try {
        const signaturePath = `signatures/${lease.id}/${actualSigner.id}_${Date.now()}.png`;
        const signatureBuffer = Buffer.from(
          signatureImage.replace(/^data:image\/\w+;base64,/, ""),
          "base64"
        );
        
        const { error: uploadError } = await serviceClient.storage
          .from("documents")
          .upload(signaturePath, signatureBuffer, {
            contentType: "image/png",
            upsert: true,
          });
        
        if (!uploadError) {
          updateData.signature_image_path = signaturePath;
          console.log(`[Signature OTP] ✅ Image uploadée: ${signaturePath}`);
        }
      } catch (uploadError) {
        console.warn("[Signature OTP] ⚠️ Erreur upload image:", uploadError);
      }
    }
    
    await serviceClient
      .from("lease_signers")
      .update(updateData)
      .eq("id", actualSigner.id);

    // 3. Vérifier si tous les signataires ont signé
    const { data: allSigners } = await serviceClient
      .from("lease_signers")
      .select("id, signature_status, role")
      .eq("lease_id", lease.id);

    const totalSigners = allSigners?.length || 0;
    const signedCount = allSigners?.filter(s => s.signature_status === "signed").length || 0;
    const allSigned = totalSigners >= 2 && signedCount === totalSigners;
    
    // ✅ FIX: Recherche flexible du propriétaire
    const ownerSigned = allSigners?.some(s => 
      ["proprietaire", "owner", "bailleur"].includes(s.role?.toLowerCase() || "") && 
      s.signature_status === "signed"
    ) ?? false;

    // 4. Mettre à jour le bail avec le nouveau statut
    // ✅ SOTA 2026: Le bail signé passe à "fully_signed", l'activation se fait après l'EDL
    let newStatus = lease.statut;
    if (allSigned) {
      newStatus = "fully_signed";  // Activation après EDL via /activate
    } else if (!ownerSigned) {
      newStatus = "pending_owner_signature";
    }

    if (newStatus !== lease.statut) {
      const { error: updateError } = await serviceClient
        .from("leases")
        .update({ statut: newStatus })
        .eq("id", lease.id);

      if (updateError) {
        // Si le statut n'est pas autorisé, garder pending_signature
        if (updateError.message?.includes("check") || updateError.code === "23514") {
          console.log("[Signature] Statut", newStatus, "non autorisé, fallback vers pending_signature");
          await serviceClient
            .from("leases")
            .update({ statut: "pending_signature" })
            .eq("id", lease.id);
        } else {
          console.error("[Signature] Erreur mise à jour bail:", updateError);
        }
      }
    }

    // 5. Créer un document de signature dans la table documents
    const roleLabels: Record<string, string> = {
      locataire_principal: "locataire",
      colocataire: "colocataire",
      garant: "garant",
      proprietaire: "propriétaire",
    };

    await serviceClient
      .from("documents")
      .insert({
        type: signerRole === "garant" ? "engagement_garant" : "bail_signe_locataire",
        owner_id: (lease.properties as any)?.owner_id,
        property_id: lease.property_id,
        lease_id: lease.id,
        tenant_id: signerProfileId,
        metadata: {
          signed_at: new Date().toISOString(),
          signer_role: roleLabels[signerRole] || signerRole,
          signer_email: tokenData.tenantEmail,
          signer_name: signerName,
          verification_method: "otp_sms",
          signature_ip: extractClientIP(request),
        },
      });

    // 6. Notifier le propriétaire
    const { data: leaseWithProperty } = await serviceClient
      .from("leases")
      .select(`
        id,
        property:properties(
          id,
          owner_id,
          adresse_complete,
          owner:profiles!properties_owner_id_fkey(
            id,
            user_id
          )
        )
      `)
      .eq("id", lease.id)
      .single();

    const ownerUserId = (leaseWithProperty?.property as any)?.owner?.user_id;
    if (ownerUserId) {
      await serviceClient.from("notifications").insert({
        user_id: ownerUserId,
        type: "lease_signed",
        title: allSigned 
          ? "✅ Bail entièrement signé !" 
          : `📝 ${roleLabels[signerRole] || signerRole} a signé`,
        body: allSigned
          ? `Tous les signataires ont signé le bail pour ${(leaseWithProperty?.property as any)?.adresse_complete}. Le bail est maintenant actif.`
          : `${signerName} (${roleLabels[signerRole] || signerRole}) a signé le bail pour ${(leaseWithProperty?.property as any)?.adresse_complete}.`,
        read: false,
        metadata: {
          lease_id: lease.id,
          signer_email: tokenData.tenantEmail,
          signer_role: signerRole,
          all_signed: allSigned,
        },
      });
    }

    console.log(`📧 Propriétaire notifié: bail ${lease.id} signé par ${tokenData.tenantEmail} (${signerRole})`);

    return NextResponse.json({
      success: true,
      message: allSigned 
        ? "✅ Bail entièrement signé ! En attente de l'état des lieux d'entrée." 
        : "Signature enregistrée avec succès !",
      lease_id: lease.id,
      signer_profile_id: signerProfileId,
      signer_role: signerRole,
      all_signed: allSigned,
      new_status: newStatus,
    });

  } catch (error: any) {
    console.error("Erreur API sign:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

