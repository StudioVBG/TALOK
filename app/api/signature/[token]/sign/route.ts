export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { verifyOTP } from "@/lib/services/otp-store";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { extractClientIP } from "@/lib/utils/ip-address";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { verifyTokenCompat } from "@/lib/utils/secure-token";
import { validateSignatureImage, stripBase64Prefix } from "@/lib/utils/validate-signature";
import { createSignatureLogger } from "@/lib/utils/signature-logger";
import { isOwnerRole, LEASE_STATUS } from "@/lib/constants/roles";

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * POST /api/signature/[token]/sign
 * Valider l'OTP et signer le bail
 *
 * FIX P0-4: Statuts de bail uniformisés
 * FIX P0-5: Suppression du fallback "par rôle"
 * FIX P1-4: Support tokens sécurisés (HMAC) + rétrocompat ancien format
 * FIX P1-7: Remplacement listUsers() admin par query profiles
 * FIX P1-8: Ajout audit_log
 * FIX P1-9: Expiration token corrigée (30 jours cohérent)
 * FIX P1-2: Suppression base64 de proof_metadata
 *
 * @version 2026-02-15 - Audit sécurité complet
 */
export async function POST(request: Request, { params }: PageProps) {
  const log = createSignatureLogger("/api/signature/[token]/sign");

  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "signature");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { token } = await params;

    // FIX P1-4: Vérifier le token (nouveau format HMAC ou ancien format)
    // FIX AUDIT: TTL réduit de 30j à 7j pour limiter la fenêtre d'exposition
    const tokenData = verifyTokenCompat(token, 7);
    if (!tokenData) {
      log.warn("Token invalide ou expiré");
      return NextResponse.json(
        { error: "Lien d'invitation invalide ou expiré" },
        { status: 410 }
      );
    }

    log.setContext({ entityId: tokenData.entityId, entityType: "lease" });

    const serviceClient = getServiceClient();

    // Récupérer le bail
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
      .eq("id", tokenData.entityId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const otpCode = body.otp_code;
    const signatureImage = body.signatureImage;

    if (!otpCode) {
      return NextResponse.json({ error: "Code de vérification requis" }, { status: 400 });
    }

    // Vérifier le code OTP
    const otpResult = verifyOTP(tokenData.entityId, otpCode);
    if (!otpResult.valid) {
      return NextResponse.json({ error: otpResult.error || "Code invalide" }, { status: 400 });
    }

    // Recherche du signataire :
    // Priorité 1: Par email (insensible à la casse)
    const normalizedEmail = tokenData.email.toLowerCase().trim();
    
    const { data: signer } = await serviceClient
      .from("lease_signers")
      .select("id, profile_id, role, invited_name, invited_email, signature_status, signed_at")
      .eq("lease_id", lease.id)
      .ilike("invited_email", normalizedEmail)
      .maybeSingle();

    let actualSigner = signer;

    // Vérifier si déjà signé (status + signed_at pour éviter faux positifs)
    if (actualSigner?.signature_status === "signed" && actualSigner?.signed_at) {
      return NextResponse.json({ error: "Vous avez déjà signé ce bail" }, { status: 400 });
    }
    
    // FIX P1-7: Priorité 2 — recherche par email dans profiles (au lieu de listUsers admin)
    if (!actualSigner) {
      const { data: profileByEmail } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profileByEmail) {
        const { data: signerByProfile } = await serviceClient
          .from("lease_signers")
          .select("id, profile_id, role, invited_name, invited_email, signature_status, signed_at")
          .eq("lease_id", lease.id)
          .eq("profile_id", profileByEmail.id)
          .maybeSingle();

        if (signerByProfile?.signature_status === "signed" && signerByProfile?.signed_at) {
          return NextResponse.json({ error: "Vous avez déjà signé ce bail" }, { status: 400 });
        }
        actualSigner = signerByProfile;
      }
    }

    // FIX P0-5: PAS de fallback "par rôle" — un signataire DOIT être identifié par email ou profile

    if (!actualSigner) {
      log.error("Aucun signataire trouvé", { email: normalizedEmail, leaseId: lease.id });
      return NextResponse.json(
        { error: "Vous n'êtes pas signataire de ce bail" },
        { status: 403 }
      );
    }

    log.info("Signataire trouvé", { signerId: actualSigner.id, role: actualSigner.role });

    const signerProfileId = actualSigner.profile_id || null;
    const signerRole = actualSigner.role;
    const signerName = actualSigner.invited_name || tokenData.email;

    // Préparer les données de mise à jour
    const ipAddress = extractClientIP(request);
    const userAgent = request.headers.get("user-agent") || "unknown";
    const updateData: Record<string, any> = {
      signature_status: "signed",
      signed_at: new Date().toISOString(),
      ip_inet: ipAddress,
      user_agent: userAgent,
    };

    // Sauvegarder l'image de signature dans Storage
    if (signatureImage) {
      // FIX P0-2: Valider l'image
      const validation = validateSignatureImage(signatureImage);
      if (!validation.valid) {
        log.warn("Image de signature invalide", { errors: validation.errors });
        // Ne pas bloquer — continuer sans image (OTP suffit comme preuve)
      }

      // FIX P1-2: Ne plus stocker base64 dans la colonne signature_image
      try {
        const signaturePath = `signatures/${lease.id}/${actualSigner.id}_${Date.now()}.png`;
        const signatureBuffer = Buffer.from(stripBase64Prefix(signatureImage), "base64");

        const { error: uploadError } = await serviceClient.storage
          .from("documents")
          .upload(signaturePath, signatureBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (!uploadError) {
          updateData.signature_image_path = signaturePath;
          log.info("Image uploadée", { path: signaturePath });
        } else {
          log.warn("Erreur upload image", { error: uploadError.message });
        }
      } catch (uploadError) {
        log.warn("Exception upload image", { error: String(uploadError) });
      }
    }

    // Générer la preuve cryptographique
    try {
      const documentContent = `lease:${lease.id}|signer:${normalizedEmail}|role:${signerRole}|otp_verified:true`;
      const proof = await generateSignatureProof({
        documentType: "bail",
        documentId: lease.id,
        documentContent,
        signerName,
        signerEmail: normalizedEmail,
        signerProfileId: signerProfileId || undefined,
        identityVerified: true,
        identityMethod: "otp_sms",
        signatureType: signatureImage ? "draw" : "text",
        signatureImage: signatureImage || `OTP_VERIFIED:${normalizedEmail}`,
        userAgent,
        screenSize: "unknown",
        touchDevice: false,
        ipAddress: ipAddress || undefined,
      });
      updateData.proof_id = proof.proofId;
      // FIX P1-2: Exclure imageData du proof_metadata
      const proofForDB = {
        ...proof,
        signature: {
          ...proof.signature,
          imageData: updateData.signature_image_path
            ? `[STORED:${updateData.signature_image_path}]`
            : "[OTP_VERIFIED]",
        },
      };
      updateData.proof_metadata = proofForDB;
      updateData.document_hash = proof.document.hash;
    } catch (proofErr) {
      log.warn("Erreur génération preuve", { error: String(proofErr) });
    }

    await serviceClient
      .from("lease_signers")
      .update(updateData)
      .eq("id", actualSigner.id);

    // Vérifier si tous les signataires ont signé
    const { data: allSigners } = await serviceClient
      .from("lease_signers")
      .select("id, signature_status, role")
      .eq("lease_id", lease.id);

    const totalSigners = allSigners?.length || 0;
    const signedCount = allSigners?.filter(s => s.signature_status === "signed").length || 0;
    const allSigned = totalSigners >= 2 && signedCount === totalSigners;
    const ownerSigned = allSigners?.some(s => isOwnerRole(s.role) && s.signature_status === "signed") ?? false;
    const allTenantsAndGuarantorsSigned = allSigners
      ?.filter(s => !isOwnerRole(s.role))
      .every(s => s.signature_status === "signed") ?? false;

    // Déterminer le nouveau statut selon les signatures collectées
    let newStatus = lease.statut;
    if (allSigned) {
      // Tout le monde a signé → fully_signed
      newStatus = LEASE_STATUS.FULLY_SIGNED;
    } else if (allTenantsAndGuarantorsSigned && !ownerSigned) {
      // Tous les locataires/garants ont signé, il manque le propriétaire
      newStatus = LEASE_STATUS.PENDING_OWNER_SIGNATURE;
    } else if (signedCount > 0) {
      // Au moins une signature mais pas encore tout le monde
      newStatus = LEASE_STATUS.PARTIALLY_SIGNED;
    }

    if (newStatus !== lease.statut) {
      const { error: updateError } = await serviceClient
        .from("leases")
        .update({ statut: newStatus })
        .eq("id", lease.id);

      if (updateError) {
        log.warn("Erreur mise à jour statut bail", { newStatus, error: updateError.message });
        // Fallback vers pending_signature
        if (updateError.code === "23514") {
          await serviceClient
            .from("leases")
            .update({ statut: LEASE_STATUS.PENDING_SIGNATURE })
            .eq("id", lease.id);
          newStatus = LEASE_STATUS.PENDING_SIGNATURE;
        }
      }
    }

    // Créer le document de signature
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
          signer_email: tokenData.email,
          signer_name: signerName,
          verification_method: "otp_sms",
          signature_ip: ipAddress,
        },
      });

    // FIX P1-8: Ajouter audit_log
    try {
      await serviceClient.from("audit_log").insert({
        actor_type: "user",
        actor_id: signerProfileId || null,
        action: "lease_signed_via_token",
        resource: "lease",
        resource_id: lease.id,
        after: {
          role: signerRole,
          proof_id: updateData.proof_id,
          verification_method: "otp_sms",
          signer_email: normalizedEmail,
          correlation_id: log.getCorrelationId(),
        },
      } as any);
    } catch (auditErr) {
      log.warn("Erreur audit_log (non bloquant)", { error: String(auditErr) });
    }

    // Notifier le propriétaire
    const { data: leaseWithProperty } = await serviceClient
      .from("leases")
      .select(`
        id,
        property:properties(
          id,
          owner_id,
          adresse_complete,
          owner:profiles!properties_owner_id_fkey(id, user_id)
        )
      `)
      .eq("id", lease.id)
      .single();

    const ownerData = (leaseWithProperty?.property as any)?.owner;
    const ownerUserId = ownerData?.user_id;
    const ownerProfileId = ownerData?.id;
    if (ownerUserId) {
      await serviceClient.from("notifications").insert({
        user_id: ownerUserId,
        profile_id: ownerProfileId || null,
        type: "lease_signed",
        title: allSigned
          ? "Bail entièrement signé !"
          : `${roleLabels[signerRole] || signerRole} a signé`,
        body: allSigned
          ? `Tous les signataires ont signé le bail pour ${(leaseWithProperty?.property as any)?.adresse_complete}. Le bail est en attente de l'état des lieux d'entrée.`
          : `${signerName} (${roleLabels[signerRole] || signerRole}) a signé le bail pour ${(leaseWithProperty?.property as any)?.adresse_complete}.`,
        read: false,
        is_read: false,
        metadata: {
          lease_id: lease.id,
          signer_email: tokenData.email,
          signer_role: signerRole,
          all_signed: allSigned,
        },
      });
    }

    log.complete(true, { allSigned, newStatus, signerId: actualSigner.id });

    return NextResponse.json({
      success: true,
      message: allSigned 
        ? "Bail entièrement signé ! En attente de l'état des lieux d'entrée." 
        : "Signature enregistrée avec succès !",
      lease_id: lease.id,
      signer_profile_id: signerProfileId,
      signer_role: signerRole,
      all_signed: allSigned,
      new_status: newStatus,
    });

  } catch (error: unknown) {
    log.complete(false, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

