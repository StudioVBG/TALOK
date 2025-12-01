// @ts-nocheck
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { verifyOTP, deleteOTP } from "@/lib/services/otp-store";

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
  return Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000;
}

/**
 * POST /api/signature/[token]/sign
 * Valider l'OTP et signer le bail
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

    // Récupérer le bail
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, property_id, statut")
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

    // 1. Récupérer le signataire locataire
    const { data: tenantSigner, error: signerError } = await serviceClient
      .from("lease_signers")
      .select("id, profile_id")
      .eq("lease_id", lease.id)
      .eq("role", "locataire_principal")
      .maybeSingle();

    const tenantProfileId = tenantSigner?.profile_id || null;

    // 2. Mettre à jour le signataire avec la signature
    if (tenantSigner) {
      await serviceClient
        .from("lease_signers")
        .update({
          signature_status: "signed",
          signed_at: new Date().toISOString(),
        })
        .eq("id", tenantSigner.id);
    }

    // 3. Mettre à jour le bail
    const { error: updateError } = await serviceClient
      .from("leases")
      .update({
        statut: "pending_owner_signature", // Attend la signature du propriétaire
      })
      .eq("id", lease.id);

    if (updateError) {
      console.error("Erreur mise à jour bail:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de la signature" },
        { status: 500 }
      );
    }

    // 4. Créer un document de signature dans la table documents
    await serviceClient
      .from("documents")
      .insert({
        type: "bail_signe_locataire",
        property_id: lease.property_id,
        lease_id: lease.id,
        tenant_id: tenantProfileId,
        metadata: {
          signed_at: new Date().toISOString(),
          signer_role: "locataire",
          signer_email: tokenData.tenantEmail,
          verification_method: "otp_sms",
          signature_ip: request.headers.get("x-forwarded-for") || "unknown",
        },
      });

    // 5. Notifier le propriétaire (TODO: implémenter les notifications)
    console.log(`📧 Notifier le propriétaire que le bail ${lease.id} a été signé par ${tokenData.tenantEmail}`);

    return NextResponse.json({
      success: true,
      message: "Bail signé avec succès !",
      lease_id: lease.id,
      tenant_profile_id: tenantProfileId,
    });

  } catch (error: any) {
    console.error("Erreur API sign:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

