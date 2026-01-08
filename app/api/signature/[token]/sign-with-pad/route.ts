export const runtime = 'nodejs';

// @ts-nocheck
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { generateSignatureProof, generateSignatureCertificate } from "@/lib/services/signature-proof.service";
import { extractClientIP } from "@/lib/utils/ip-address";

interface PageProps {
  params: Promise<{ token: string }>;
}

// Décoder le token
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
 * POST /api/signature/[token]/sign-with-pad
 * Signature électronique avec tracé ou texte (sans OTP)
 */
export async function POST(request: Request, { params }: PageProps) {
  try {
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

    // Récupérer le bail avec ses informations
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id, 
        property_id, 
        statut, 
        type_bail, 
        loyer,
        properties (
          adresse_complete,
          ville,
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

    // Récupérer les données de signature
    const body = await request.json();
    const {
      signatureType,
      signatureImage,
      signerName,
      signerProfileId,
      identityVerified,
      identityMethod,
      userAgent,
      screenSize,
      touchDevice,
    } = body;

    if (!signatureImage || !signerName) {
      return NextResponse.json(
        { error: "Données de signature manquantes" },
        { status: 400 }
      );
    }

    // Générer la preuve de signature
    const ipAddress = extractClientIP(request);

    // Créer un contenu de document pour le hash
    const documentContent = JSON.stringify({
      leaseId: lease.id,
      type: lease.type_bail,
      loyer: lease.loyer,
      property: lease.properties,
      signerEmail: tokenData.tenantEmail,
      timestamp: Date.now(),
    });

    const proof = await generateSignatureProof({
      documentType: "bail",
      documentId: lease.id,
      documentContent,
      signerName,
      signerEmail: tokenData.tenantEmail,
      signerProfileId,
      identityVerified: identityVerified || false,
      identityMethod: identityMethod || "cni",
      signatureType: signatureType || "draw",
      signatureImage,
      userAgent: userAgent || request.headers.get("user-agent") || "unknown",
      screenSize: screenSize || "unknown",
      touchDevice: touchDevice || false,
      ipAddress,
    });

    // 135. Générer le certificat texte
    const certificate = generateSignatureCertificate(proof);

    // ✅ SOTA 2026: Recherche flexible du signataire par email OU par rôle
    // Priorité 1: Par email (le plus fiable)
    let tenantSigner = null;
    
    const { data: signerByEmail } = await serviceClient
      .from("lease_signers")
      .select("id, profile_id, role")
      .eq("lease_id", lease.id)
      .eq("invited_email", tokenData.tenantEmail.toLowerCase())
      .maybeSingle();
    
    if (signerByEmail) {
      tenantSigner = signerByEmail;
      console.log(`[Signature] ✅ Signataire trouvé par email: ${tokenData.tenantEmail}, role: ${signerByEmail.role}`);
    } else {
      // Priorité 2: Par rôle flexible (fallback)
      const { data: signerByRole } = await serviceClient
        .from("lease_signers")
        .select("id, profile_id, role")
        .eq("lease_id", lease.id)
        .in("role", ["locataire_principal", "locataire", "tenant", "colocataire", "principal"])
        .is("signature_status", null)  // Non encore signé
        .limit(1)
        .maybeSingle();
      
      if (signerByRole) {
        tenantSigner = signerByRole;
        console.log(`[Signature] ✅ Signataire trouvé par rôle: ${signerByRole.role}`);
      }
    }

    if (!tenantSigner) {
      console.error(`[Signature] ❌ Aucun signataire trouvé pour ${tokenData.tenantEmail} sur le bail ${lease.id}`);
      return NextResponse.json(
        { error: "Vous n'êtes pas signataire de ce bail" },
        { status: 403 }
      );
    }

    const tenantProfileId = signerProfileId || tenantSigner?.profile_id || null;

    // Sauvegarder l'image de signature dans Storage
    // ✅ FIX: Utiliser le même format de path que /leases/[id]/sign pour cohérence
    const signaturePath = `signatures/${lease.id}/${tenantSigner.id}_${Date.now()}.png`;
    let uploadSuccess = false;
    
    try {
      const signatureBuffer = Buffer.from(
        proof.signature.imageData.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );
      
      const { error: uploadError } = await serviceClient.storage
        .from("documents")
        .upload(signaturePath, signatureBuffer, {
          contentType: "image/png",
          upsert: true,
        });
      
      if (!uploadError) {
        uploadSuccess = true;
        console.log(`[Signature] ✅ Image uploadée: ${signaturePath}`);
      } else {
        console.warn("[Signature] ⚠️ Erreur upload image:", uploadError);
      }
    } catch (uploadError) {
      console.warn("[Signature] ⚠️ Exception upload image:", uploadError);
    }

    // Mettre à jour le signataire avec la signature ET l'image
    const updateData: Record<string, any> = {
      signature_status: "signed",
      signed_at: proof.timestamp.iso,
      signature_image: signatureImage, // Base64 comme fallback
      ip_inet: proof.metadata.ipAddress as any,
      user_agent: proof.metadata.userAgent,
      proof_id: proof.proofId,
      proof_metadata: proof as any,
      document_hash: proof.document.hash,
    };
    
    // ✅ Ajouter le path Storage seulement si l'upload a réussi
    if (uploadSuccess) {
      updateData.signature_image_path = signaturePath;
    }
    
    const { error: signerUpdateError } = await serviceClient
      .from("lease_signers")
      .update(updateData as any)
      .eq("id", tenantSigner.id);
    
    if (signerUpdateError) {
      console.error("[Signature] ❌ Erreur mise à jour signataire:", signerUpdateError);
    } else {
      console.log(`[Signature] ✅ Signataire ${tenantSigner.id} mis à jour avec signature`);
    }

    // ✅ SOTA 2026: Déterminer le nouveau statut du bail
    // Vérifier si TOUS les signataires ont signé
    const { data: allSigners } = await serviceClient
      .from("lease_signers")
      .select("id, role, signature_status")
      .eq("lease_id", lease.id);
    
    const totalSigners = allSigners?.length || 0;
    const signedCount = allSigners?.filter(s => s.signature_status === "signed").length || 0;
    const ownerSigned = allSigners?.some(s => 
      ["proprietaire", "owner", "bailleur"].includes(s.role?.toLowerCase() || "") && 
      s.signature_status === "signed"
    );
    const allSigned = totalSigners >= 2 && signedCount === totalSigners;
    
    console.log(`[Signature] État: ${signedCount}/${totalSigners} signatures, owner=${ownerSigned}, all=${allSigned}`);

    // Déterminer le nouveau statut
    let newStatus: string;
    if (allSigned) {
      newStatus = "fully_signed"; // ✅ Prêt pour EDL, pas encore active
    } else if (ownerSigned) {
      newStatus = "partially_signed";
    } else {
      newStatus = "pending_owner_signature";
    }

    // Mettre à jour le statut du bail
    const { error: updateError } = await serviceClient
      .from("leases")
      .update({ statut: newStatus })
      .eq("id", lease.id);

    if (updateError) {
      // Fallback si le statut n'est pas autorisé par la contrainte CHECK
      if (updateError.message?.includes("check") || updateError.code === "23514") {
        console.log(`[Signature] Statut ${newStatus} non autorisé, fallback vers pending_signature`);
        await serviceClient
          .from("leases")
          .update({ statut: "pending_signature" })
          .eq("id", lease.id);
      } else {
        console.error("[Signature] Erreur mise à jour bail:", updateError);
      }
    } else {
      console.log(`[Signature] ✅ Bail ${lease.id} passé à ${newStatus}`);
    }

    // Sauvegarder la preuve de signature comme document
    const { error: docError } = await serviceClient
      .from("documents")
      .insert({
        type: "bail_signe_locataire",
        owner_id: (lease.properties as any)?.owner_id,
        property_id: lease.property_id,
        lease_id: lease.id,
        tenant_id: tenantProfileId,
        metadata: {
          proof_id: proof.proofId,
          signature_type: proof.signature.type,
          signature_hash: proof.signature.hash,
          document_hash: proof.document.hash,
          timestamp: proof.timestamp,
          signer: proof.signer,
          integrity: proof.integrity,
          certificate: certificate,
        },
      });

    if (docError) {
      console.warn("[Signature] Erreur sauvegarde preuve:", docError);
    }

    console.log(`✅ Bail ${lease.id} signé par ${signerName} - Preuve: ${proof.proofId} - Status: ${newStatus}`);

    return NextResponse.json({
      success: true,
      message: allSigned 
        ? "✅ Bail entièrement signé ! En attente de l'état des lieux d'entrée." 
        : "Signature enregistrée avec succès !",
      proof_id: proof.proofId,
      lease_id: lease.id,
      tenant_profile_id: tenantProfileId,
      all_signed: allSigned,
      new_status: newStatus,
    });

  } catch (error: any) {
    console.error("Erreur API sign-with-pad:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

