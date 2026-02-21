export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { generateSignatureProof, generateSignatureCertificate } from "@/lib/services/signature-proof.service";
import { extractClientIP } from "@/lib/utils/ip-address";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { verifyTokenCompat } from "@/lib/utils/secure-token";
import { validateSignatureImage, stripBase64Prefix } from "@/lib/utils/validate-signature";
import { createSignatureLogger } from "@/lib/utils/signature-logger";
import { LEASE_STATUS } from "@/lib/constants/roles";
import { verifyOTP } from "@/lib/services/otp-store";

interface PageProps {
  params: Promise<{ token: string }>;
}

/** Lease row with joined properties (from select) */
interface LeaseWithProperty {
  id: string;
  property_id: string | null;
  statut: string;
  type_bail: string;
  loyer: number;
  signatory_entity_id?: string | null;
  properties: {
    adresse_complete?: string;
    ville?: string;
    owner_id?: string;
  } | null;
}

/** Signer from lease_signers select */
interface LeaseSignerSelect {
  id: string;
  profile_id: string | null;
  role: string;
  signature_status: string;
}

/** Legal entity from legal_entities select */
interface LegalEntitySelect {
  nom?: string;
  siret?: string | null;
  entity_type?: string;
  gerant_nom?: string | null;
}

/**
 * POST /api/signature/[token]/sign-with-pad
 * Signature électronique avec tracé ou texte (sans OTP)
 *
 * FIX P0-4: Statuts de bail uniformisés (LEASE_STATUS)
 * FIX P0-5: Suppression du fallback "par rôle"
 * FIX P1-1: Ajout rate limiting
 * FIX P1-2: Suppression base64 de proof_metadata + colonne signature_image
 * FIX P1-4: Support tokens sécurisés HMAC + rétrocompat
 * FIX P1-8: Ajout audit_log
 * FIX P2-5: Logger structuré
 *
 * @version 2026-02-15 - Audit sécurité complet
 */
export async function POST(request: Request, { params }: PageProps) {
  const log = createSignatureLogger("/api/signature/[token]/sign-with-pad");

  try {
    // FIX P1-1: Ajout du rate limiting (manquait totalement)
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

    // Récupérer le bail avec ses informations + entité signataire
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        property_id,
        statut,
        type_bail,
        loyer,
        signatory_entity_id,
        properties (
          adresse_complete,
          ville,
          owner_id
        )
      `)
      .eq("id", tokenData.entityId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const typedLease = lease as unknown as LeaseWithProperty;

    // Récupérer l'entité juridique si applicable
    let entityInfo: { nom: string; siret: string | null; type: string; representant: string | null } | null = null;
    const signatoryEntityId = typedLease.signatory_entity_id;
    if (signatoryEntityId) {
      const { data: entity } = await serviceClient
        .from("legal_entities")
        .select("nom, siret, entity_type, gerant_nom")
        .eq("id", signatoryEntityId)
        .single();
      const typedEntity = entity as LegalEntitySelect | null;
      if (typedEntity) {
        entityInfo = {
          nom: typedEntity.nom ?? "",
          siret: typedEntity.siret ?? null,
          type: typedEntity.entity_type ?? "",
          representant: typedEntity.gerant_nom ?? null,
        };
      }
    }

    // Récupérer les données de signature
    const body = await request.json();
    const {
      signatureType,
      signatureImage,
      signerName,
      signerProfileId,
      userAgent,
      screenSize,
      touchDevice,
      otp_code,
    } = body;

    if (!signatureImage || !signerName) {
      return NextResponse.json({ error: "Données de signature manquantes" }, { status: 400 });
    }

    // FIX AUDIT P1-7: Vérification OTP obligatoire (alignement avec /sign)
    // Le code OTP assure que le signataire a bien accès à son email/téléphone
    if (!otp_code) {
      return NextResponse.json(
        { error: "Code de vérification requis. Veuillez saisir le code reçu par SMS ou email." },
        { status: 400 }
      );
    }

    const otpResult = verifyOTP(tokenData.entityId, otp_code);
    if (!otpResult.valid) {
      log.warn("OTP invalide pour sign-with-pad", { leaseId: tokenData.entityId });
      return NextResponse.json(
        { error: otpResult.error || "Code de vérification invalide ou expiré" },
        { status: 400 }
      );
    }

    log.info("OTP vérifié avec succès pour sign-with-pad");

    // FIX P0-2: Valider l'image de signature côté serveur
    const validation = validateSignatureImage(signatureImage);
    if (!validation.valid) {
      log.warn("Image de signature invalide", { errors: validation.errors });
      return NextResponse.json(
        { error: validation.errors[0] ?? "Données de signature invalides", validation_errors: validation.errors },
        { status: 400 }
      );
    }

    const ipAddress = extractClientIP(request);

    // Contenu pour le hash du document
    const documentContent = JSON.stringify({
      leaseId: typedLease.id,
      type: typedLease.type_bail,
      loyer: typedLease.loyer,
      property: typedLease.properties,
      signerEmail: tokenData.email,
      entity: entityInfo,
      timestamp: Date.now(),
    });

    // FIX: identityVerified et identityMethod ne viennent plus du body client
    const proof = await generateSignatureProof({
      documentType: "bail",
      documentId: typedLease.id,
      documentContent,
      signerName,
      signerEmail: tokenData.email,
      signerProfileId,
      identityVerified: true, // OTP vérifié en amont (alignement avec /sign)
      identityMethod: "otp_verified_pad",
      signatureType: signatureType === "text" ? "text" : "draw",
      signatureImage,
      userAgent: userAgent || request.headers.get("user-agent") || "unknown",
      screenSize: screenSize || "unknown",
      touchDevice: touchDevice || false,
      ipAddress,
    });

    const certificate = generateSignatureCertificate(proof);

    // Recherche du signataire — Priorité 1: Par email
    const normalizedEmail = tokenData.email.toLowerCase().trim();
    let tenantSigner: LeaseSignerSelect | null = null;
    
    const { data: signerByEmail } = await serviceClient
      .from("lease_signers")
      .select("id, profile_id, role, signature_status")
      .eq("lease_id", typedLease.id)
      .eq("invited_email", normalizedEmail)
      .maybeSingle();
    
    const typedSignerByEmail = signerByEmail as LeaseSignerSelect | null;
    if (typedSignerByEmail) {
      if (typedSignerByEmail.signature_status === "signed") {
        return NextResponse.json({ error: "Vous avez déjà signé ce bail" }, { status: 400 });
      }
      tenantSigner = typedSignerByEmail;
      log.info("Signataire trouvé par email", { signerId: typedSignerByEmail.id, role: typedSignerByEmail.role });
    }

    // Priorité 2: Par profile via email dans profiles
    if (!tenantSigner) {
      const { data: profileByEmail } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();
      
      const profileId = profileByEmail?.id;
      if (profileId) {
        const { data: signerByProfile } = await serviceClient
          .from("lease_signers")
          .select("id, profile_id, role, signature_status")
          .eq("lease_id", typedLease.id)
          .eq("profile_id", profileId)
          .maybeSingle();
        
        const typedSignerByProfile = signerByProfile as LeaseSignerSelect | null;
        if (typedSignerByProfile?.signature_status === "signed") {
          return NextResponse.json({ error: "Vous avez déjà signé ce bail" }, { status: 400 });
        }
        tenantSigner = typedSignerByProfile ?? null;
      }
    }

    // FIX P0-5: PAS de fallback "par rôle" — risque de mauvais signataire

    if (!tenantSigner) {
      log.error("Aucun signataire trouvé", { email: normalizedEmail, leaseId: typedLease.id });
      return NextResponse.json(
        { error: "Vous n'êtes pas signataire de ce bail" },
        { status: 403 }
      );
    }

    const tenantProfileId = signerProfileId ?? tenantSigner.profile_id ?? null;

    // Upload image de signature dans Storage
    const signaturePath = `signatures/${typedLease.id}/${tenantSigner.id}_${Date.now()}.png`;
    let uploadSuccess = false;
    
    try {
      const signatureBuffer = Buffer.from(stripBase64Prefix(signatureImage), "base64");
      
      const { error: uploadError } = await serviceClient.storage
        .from("documents")
        .upload(signaturePath, signatureBuffer, {
          contentType: "image/png",
          upsert: true,
        });
      
      if (!uploadError) {
        uploadSuccess = true;
        log.info("Image uploadée", { path: signaturePath });
      } else {
        log.warn("Erreur upload image", { error: uploadError?.message ?? String(uploadError) });
      }
    } catch (uploadError) {
      log.warn("Exception upload image", { error: String(uploadError) });
    }

    // FIX P1-2: Exclure base64 du proof_metadata et ne plus écrire signature_image
    const proofForDB = {
      ...proof,
      signature: {
        ...proof.signature,
        imageData: uploadSuccess ? `[STORED:${signaturePath}]` : "[UPLOAD_FAILED]",
      },
    };

    const updateData: Record<string, unknown> = {
      signature_status: "signed",
      signed_at: proof.timestamp.iso,
      // FIX P1-3: Ne plus écrire signature_image (base64) — utiliser uniquement signature_image_path
      ip_inet: proof.metadata.ipAddress ?? null,
      user_agent: proof.metadata.userAgent,
      proof_id: proof.proofId,
      proof_metadata: proofForDB as Record<string, unknown>,
      document_hash: proof.document.hash,
    };
    
    if (uploadSuccess) {
      updateData.signature_image_path = signaturePath;
    }
    
    const { error: signerUpdateError } = await serviceClient
      .from("lease_signers")
      .update(updateData)
      .eq("id", tenantSigner.id);
    
    // FIX AUDIT 2026-02-16: Si la mise à jour du signataire échoue, on ne doit PAS
    // continuer à mettre à jour le statut du bail — risque d'incohérence.
    if (signerUpdateError) {
      log.error("Erreur mise à jour signataire — abandon", { error: signerUpdateError?.message ?? String(signerUpdateError) });
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement de la signature. Veuillez réessayer." },
        { status: 500 }
      );
    }

    // Déterminer le nouveau statut — FIX P0-4: Utiliser UNIQUEMENT LEASE_STATUS
    const { data: allSigners } = await serviceClient
      .from("lease_signers")
      .select("id, role, signature_status")
      .eq("lease_id", typedLease.id);
    
    const signersList = allSigners ?? [];
    const totalSigners = signersList.length;
    const signedCount = signersList.filter((s: { signature_status?: string }) => s.signature_status === "signed").length;
    const allSigned = totalSigners >= 2 && signedCount === totalSigners;
    
    // ✅ SOTA BIC 2026: Détermination correcte du statut après signature partielle
    let newStatus: string;
    if (allSigned) {
      newStatus = LEASE_STATUS.FULLY_SIGNED;
    } else if (signedCount > 0) {
      // Au moins une signature → "partially_signed" (pas "pending_signature")
      const ownerSigners = signersList.filter((s: { role?: string }) => 
        s.role === "proprietaire" || s.role === "owner" || s.role === "bailleur"
      );
      const allNonOwnersSigned = signersList
        .filter((s: { role?: string }) => !["proprietaire", "owner", "bailleur"].includes(s.role ?? ""))
        .every((s: { signature_status?: string }) => s.signature_status === "signed");
      const ownerSigned = ownerSigners.every((s: { signature_status?: string }) => s.signature_status === "signed");
      
      if (allNonOwnersSigned && !ownerSigned) {
        newStatus = LEASE_STATUS.PENDING_OWNER_SIGNATURE;
      } else {
        newStatus = LEASE_STATUS.PARTIALLY_SIGNED;
      }
    } else {
      newStatus = typedLease.statut ?? LEASE_STATUS.PENDING_SIGNATURE;
    }

    // Mettre à jour le statut du bail
    if (newStatus !== typedLease.statut) {
      const { error: updateError } = await serviceClient
        .from("leases")
        .update({ statut: newStatus })
        .eq("id", typedLease.id);

      if (updateError) {
        if (String(updateError.code) === "23514") {
          log.warn("Statut non autorisé, fallback", { attempted: newStatus });
          await serviceClient
            .from("leases")
            .update({ statut: LEASE_STATUS.PENDING_SIGNATURE })
            .eq("id", typedLease.id);
          newStatus = LEASE_STATUS.PENDING_SIGNATURE;
        } else {
          log.error("Erreur mise à jour bail", { error: updateError?.message ?? String(updateError) });
        }
      }
    }

    // Sauvegarder la preuve de signature comme document
    const { error: docInsertError } = await serviceClient
      .from("documents")
      .insert({
        type: "bail_signe_locataire",
        owner_id: typedLease.properties?.owner_id ?? null,
        property_id: typedLease.property_id,
        lease_id: typedLease.id,
        tenant_id: tenantProfileId,
        metadata: {
          proof_id: proof.proofId,
          signature_type: proof.signature.type,
          signature_hash: proof.signature.hash,
          document_hash: proof.document.hash,
          timestamp: proof.timestamp,
          signer: proof.signer,
          entity: entityInfo,
          integrity: proof.integrity,
          certificate: certificate,
        },
      });

    if (docInsertError) {
      log.warn("Erreur insertion document preuve (non bloquant)", { error: docInsertError.message });
    }

    // FIX P1-8: Audit log
    await serviceClient.from("audit_log").insert({
      user_id: tenantProfileId ?? null,
      action: "lease_signed_via_pad",
      entity_type: "lease",
      entity_id: typedLease.id,
      metadata: {
        role: tenantSigner.role,
        proof_id: proof.proofId,
        verification_method: "otp_verified_pad",
        signer_email: normalizedEmail,
        correlation_id: log.getCorrelationId(),
      },
    });

    // ✅ FIX: Notifier le propriétaire (manquait dans sign-with-pad contrairement à /sign)
    const roleLabels: Record<string, string> = {
      locataire_principal: "locataire",
      colocataire: "colocataire",
      garant: "garant",
      proprietaire: "propriétaire",
    };

    try {
      const { data: leaseWithOwner } = await serviceClient
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
        .eq("id", typedLease.id)
        .single();

      const ownerProfile = (leaseWithOwner?.property as any)?.owner;
      if (ownerProfile?.user_id) {
        await serviceClient.from("notifications").insert({
          user_id: ownerProfile.user_id,
          profile_id: ownerProfile.id,
          type: "lease_signed",
          title: allSigned
            ? "Bail entièrement signé !"
            : `${roleLabels[tenantSigner.role] || tenantSigner.role} a signé`,
          body: allSigned
            ? `Tous les signataires ont signé le bail pour ${(leaseWithOwner?.property as any)?.adresse_complete}. Le bail est en attente de l'état des lieux d'entrée.`
            : `${signerName} (${roleLabels[tenantSigner.role] || tenantSigner.role}) a signé le bail pour ${(leaseWithOwner?.property as any)?.adresse_complete}.`,
          read: false,
          is_read: false,
          metadata: {
            lease_id: typedLease.id,
            signer_email: tokenData.email,
            signer_role: tenantSigner.role,
            all_signed: allSigned,
          },
        });
      }
    } catch (notifErr) {
      log.warn("Erreur notification propriétaire (non bloquant)", { error: String(notifErr) });
    }

    // FIX AUDIT 2026-02-16: Invalider le cache pour les pages liées
    revalidatePath("/owner");
    revalidatePath("/owner/leases");
    revalidatePath(`/owner/leases/${typedLease.id}`);
    revalidatePath("/owner/tenants");
    revalidatePath("/tenant/signatures");
    revalidatePath("/owner/dashboard");
    if (typedLease.property_id) {
      revalidatePath(`/owner/properties/${typedLease.property_id}`);
    }

    log.complete(true, { allSigned, newStatus, proofId: proof.proofId });

    return NextResponse.json({
      success: true,
      message: allSigned 
        ? "Bail entièrement signé ! En attente de l'état des lieux d'entrée." 
        : "Signature enregistrée avec succès !",
      proof_id: proof.proofId,
      lease_id: typedLease.id,
      tenant_profile_id: tenantProfileId,
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

