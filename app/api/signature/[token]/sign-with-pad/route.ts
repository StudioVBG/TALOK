// @ts-nocheck
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { generateSignatureProof, generateSignatureCertificate } from "@/lib/services/signature-proof.service";

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
    const ipAddress = request.headers.get("x-forwarded-for") || 
                      request.headers.get("x-real-ip") || 
                      "unknown";

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

    // Générer le certificat texte
    const certificate = generateSignatureCertificate(proof);

    // Récupérer ou créer le signataire locataire
    const { data: tenantSigner, error: signerError } = await serviceClient
      .from("lease_signers")
      .select("id, profile_id")
      .eq("lease_id", lease.id)
      .eq("role", "locataire_principal")
      .maybeSingle();

    const tenantProfileId = signerProfileId || tenantSigner?.profile_id || null;

    // Mettre à jour le signataire avec la signature ET l'image
    if (tenantSigner) {
      await serviceClient
        .from("lease_signers")
        .update({
          signature_status: "signed",
          signed_at: new Date().toISOString(),
          signature_image: signatureImage, // Stocker l'image de signature (base64)
        })
        .eq("id", tenantSigner.id);
    }

    // Mettre à jour le bail avec le nouveau statut
    // Essayer d'abord pending_owner_signature, sinon fallback vers pending_signature
    let leaseUpdateSuccess = false;
    
    const { error: updateError } = await serviceClient
      .from("leases")
      .update({ statut: "pending_owner_signature" })
      .eq("id", lease.id);

    if (updateError) {
      // Si le statut n'est pas autorisé, essayer avec pending_signature
      if (updateError.message?.includes("check") || updateError.code === "23514") {
        console.log("[Signature] Statut pending_owner_signature non autorisé, fallback...");
        const { error: fallbackError } = await serviceClient
          .from("leases")
          .update({ statut: "pending_signature" })
          .eq("id", lease.id);
        
        if (!fallbackError) {
          leaseUpdateSuccess = true;
        } else {
          console.error("[Signature] Erreur mise à jour bail (fallback):", fallbackError);
        }
      } else {
        console.error("[Signature] Erreur mise à jour bail:", updateError);
      }
    } else {
      leaseUpdateSuccess = true;
    }

    if (!leaseUpdateSuccess) {
      // Ne pas bloquer la signature même si le statut n'est pas mis à jour
      console.warn("[Signature] Statut du bail non mis à jour, mais signature enregistrée");
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

    // Sauvegarder l'image de signature séparément si besoin
    try {
      const signatureBuffer = Buffer.from(
        proof.signature.imageData.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );
      
      const signaturePath = `leases/${lease.id}/signatures/tenant_${Date.now()}.png`;
      
      await serviceClient.storage
        .from("documents")
        .upload(signaturePath, signatureBuffer, {
          contentType: "image/png",
          upsert: true,
        });
    } catch (uploadError) {
      console.warn("[Signature] Erreur upload image:", uploadError);
    }

    console.log(`✅ Bail ${lease.id} signé par ${signerName} - Preuve: ${proof.proofId}`);

    return NextResponse.json({
      success: true,
      message: "Bail signé avec succès !",
      proof_id: proof.proofId,
      lease_id: lease.id,
      tenant_profile_id: tenantProfileId,
    });

  } catch (error: any) {
    console.error("Erreur API sign-with-pad:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

