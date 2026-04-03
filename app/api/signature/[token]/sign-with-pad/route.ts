export const runtime = "nodejs";

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { extractClientIP } from "@/lib/utils/ip-address";
import { verifyTokenCompat } from "@/lib/utils/secure-token";
import { verifyOTP } from "@/lib/services/otp-store";
import { createSignatureLogger } from "@/lib/utils/signature-logger";
import { findSigner, executeSignature } from "@/lib/services/lease-signing.service";

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * POST /api/signature/[token]/sign-with-pad — Signature bail via lien + OTP + dessin
 * SOTA 2026: Adaptateur leger delegant a LeaseSigningService
 */
export async function POST(request: Request, { params }: PageProps) {
  const log = createSignatureLogger("/api/signature/[token]/sign-with-pad");

  try {
    const rateLimitResponse = applyRateLimit(request, "signature");
    if (rateLimitResponse) return rateLimitResponse;

    const { token } = await params;
    const tokenData = verifyTokenCompat(token, 30);
    if (!tokenData) return NextResponse.json({ error: "Lien d'invitation invalide ou expiré" }, { status: 410 });

    const body = await request.json();
    const { signatureImage, signerName, otp_code } = body;

    if (!signatureImage || !signerName) {
      return NextResponse.json({ error: "Données de signature manquantes" }, { status: 400 });
    }
    if (!otp_code) {
      return NextResponse.json({ error: "Code de vérification requis." }, { status: 400 });
    }

    const otpResult = verifyOTP(tokenData.entityId, otp_code);
    if (!otpResult.valid) return NextResponse.json({ error: otpResult.error || "Code invalide" }, { status: 400 });

    const serviceClient = getServiceClient();

    // Find signer
    const signer = await findSigner(serviceClient, tokenData.entityId, { email: tokenData.email });
    if (!signer) return NextResponse.json({ error: "Vous n'êtes pas signataire de ce bail" }, { status: 403 });
    if (signer.signature_status === "signed") return NextResponse.json({ error: "Vous avez déjà signé ce bail" }, { status: 400 });

    const result = await executeSignature({
      leaseId: tokenData.entityId,
      signer,
      signatureImage,
      signerName,
      signerEmail: tokenData.email,
      signerProfileId: body.signerProfileId ?? signer.profile_id,
      identityMethod: "otp_verified_pad",
      ipAddress: extractClientIP(request),
      userAgent: body.userAgent || request.headers.get("user-agent") || "unknown",
      screenSize: body.screenSize,
      touchDevice: body.touchDevice,
    });

    // Notify owner
    try {
      const { data: leaseWithProperty } = await serviceClient
        .from("leases")
        .select("id, property:properties(id, owner_id, adresse_complete, owner:profiles!properties_owner_id_fkey(id, user_id))")
        .eq("id", tokenData.entityId)
        .single();

      const ownerProfile = (leaseWithProperty?.property as any)?.owner;
      if (ownerProfile?.user_id) {
        const roleLabels: Record<string, string> = { locataire_principal: "locataire", colocataire: "colocataire", garant: "garant", proprietaire: "propriétaire" };
        await serviceClient.from("notifications").insert({
          user_id: ownerProfile.user_id,
          profile_id: ownerProfile.id,
          type: "lease_signed",
          title: result.allSigned ? "Bail entièrement signé !" : `${roleLabels[signer.role] || signer.role} a signé`,
          body: result.allSigned
            ? `Tous les signataires ont signé le bail pour ${(leaseWithProperty?.property as any)?.adresse_complete}.`
            : `${signerName} (${roleLabels[signer.role] || signer.role}) a signé le bail pour ${(leaseWithProperty?.property as any)?.adresse_complete}.`,
          read: false,
          is_read: false,
          metadata: { lease_id: tokenData.entityId, signer_email: tokenData.email, signer_role: signer.role, all_signed: result.allSigned },
        });
      }
    } catch { /* non-blocking */ }

    revalidatePath("/owner/leases");
    revalidatePath(`/owner/leases/${tokenData.entityId}`);
    revalidatePath("/owner/tenants");
    revalidatePath("/tenant/signatures");

    return NextResponse.json({
      success: true,
      message: result.allSigned ? "Bail entièrement signé !" : "Signature enregistrée avec succès !",
      proof_id: result.proofId,
      lease_id: tokenData.entityId,
      tenant_profile_id: signer.profile_id,
      all_signed: result.allSigned,
      new_status: result.newStatus,
    });
  } catch (error: unknown) {
    log.complete(false, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}
