/**
 * SOTA 2026 — Service unifie de signature de bail
 *
 * Centralise toute la logique metier de signature partagee par les 3 routes :
 * - POST /api/leases/[id]/sign         (auth Supabase)
 * - POST /api/signature/[token]/sign    (token + OTP)
 * - POST /api/signature/[token]/sign-with-pad (token + OTP + pad)
 */

import { getServiceClient } from "@/lib/supabase/service-client";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { validateSignatureImage, stripBase64Prefix } from "@/lib/utils/validate-signature";
import { isOwnerRole, isTenantRole, LEASE_STATUS } from "@/lib/constants/roles";
import { handleLeaseFullySigned } from "@/lib/services/lease-post-signature.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignerIdentifier {
  profileId?: string | null;
  email?: string | null;
}

export interface FoundSigner {
  id: string;
  profile_id: string | null;
  role: string;
  signature_status: string;
  invited_email?: string | null;
  invited_name?: string | null;
  needsAutoCreate?: boolean;
}

export interface SigningContext {
  leaseId: string;
  signer: FoundSigner;
  signatureImage: string;
  signerName: string;
  signerEmail: string;
  signerProfileId?: string | null;
  identityMethod: string;
  ipAddress: string;
  userAgent: string;
  screenSize?: string;
  touchDevice?: boolean;
  documentContentOverride?: string;
}

export interface SigningResult {
  success: boolean;
  newStatus: string;
  allSigned: boolean;
  proofId: string;
  signerId: string;
  postSignatureHandled: boolean;
}

type SupabaseClient = ReturnType<typeof getServiceClient>;

// ---------------------------------------------------------------------------
// findSigner — Recherche unifiee du signataire
// ---------------------------------------------------------------------------

export async function findSigner(
  supabase: SupabaseClient,
  leaseId: string,
  identifier: SignerIdentifier
): Promise<FoundSigner | null> {
  // Priority 1: by profile_id
  if (identifier.profileId) {
    const { data } = await supabase
      .from("lease_signers")
      .select("id, profile_id, role, signature_status, invited_email, invited_name")
      .eq("lease_id", leaseId)
      .eq("profile_id", identifier.profileId)
      .maybeSingle();

    if (data) return data as FoundSigner;
  }

  // Priority 2: by invited_email
  if (identifier.email) {
    const normalizedEmail = identifier.email.toLowerCase().trim();

    const { data: byEmail } = await supabase
      .from("lease_signers")
      .select("id, profile_id, role, signature_status, invited_email, invited_name")
      .eq("lease_id", leaseId)
      .ilike("invited_email", normalizedEmail)
      .maybeSingle();

    if (byEmail) return byEmail as FoundSigner;

    // Priority 3: email → profiles → profile_id → lease_signers
    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profileByEmail) {
      const { data: byProfile } = await supabase
        .from("lease_signers")
        .select("id, profile_id, role, signature_status, invited_email, invited_name")
        .eq("lease_id", leaseId)
        .eq("profile_id", profileByEmail.id)
        .maybeSingle();

      if (byProfile) return byProfile as FoundSigner;
    }

    // Priority 4: placeholder signer without profile_id (invited tenant)
    const { data: placeholder } = await supabase
      .from("lease_signers")
      .select("id, profile_id, role, signature_status, invited_email, invited_name")
      .eq("lease_id", leaseId)
      .is("profile_id", null)
      .in("role", ["locataire_principal", "locataire", "tenant", "colocataire"])
      .maybeSingle();

    if (placeholder) return placeholder as FoundSigner;
  }

  // Priority 5 (owner-only): check property ownership
  if (identifier.profileId) {
    const { data: lease } = await supabase
      .from("leases")
      .select("property:properties(owner_id)")
      .eq("id", leaseId)
      .single();

    const ownerId = (lease as any)?.property?.owner_id;
    if (ownerId === identifier.profileId) {
      const { data: ownerSigner } = await supabase
        .from("lease_signers")
        .select("id, profile_id, role, signature_status, invited_email, invited_name")
        .eq("lease_id", leaseId)
        .in("role", ["proprietaire", "owner"])
        .maybeSingle();

      if (ownerSigner) {
        if (!ownerSigner.profile_id) {
          await supabase
            .from("lease_signers")
            .update({ profile_id: identifier.profileId })
            .eq("id", ownerSigner.id);
        }
        return { ...(ownerSigner as FoundSigner), profile_id: identifier.profileId };
      }

      return {
        id: "",
        profile_id: identifier.profileId,
        role: "proprietaire",
        signature_status: "pending",
        needsAutoCreate: true,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// determineLeaseStatus — Calcul unifie du statut
// ---------------------------------------------------------------------------

export async function determineLeaseStatus(
  supabase: SupabaseClient,
  leaseId: string
): Promise<string> {
  const { data: signers, error } = await supabase
    .from("lease_signers")
    .select("signature_status, role, profile_id")
    .eq("lease_id", leaseId);

  if (error || !signers || signers.length === 0) {
    return LEASE_STATUS.DRAFT;
  }

  const hasOwner = signers.some((s) => isOwnerRole(s.role));
  const hasTenant = signers.some((s) => isTenantRole(s.role));

  if (signers.length < 2 || !hasOwner || !hasTenant) {
    return signers.some((s) => s.signature_status === "signed")
      ? LEASE_STATUS.PARTIALLY_SIGNED
      : LEASE_STATUS.DRAFT;
  }

  const signedCount = signers.filter((s) => s.signature_status === "signed").length;
  const allSigned = signedCount === signers.length;
  const ownerSigned = signers.filter((s) => isOwnerRole(s.role)).every((s) => s.signature_status === "signed");
  const allNonOwnersSigned = signers.filter((s) => !isOwnerRole(s.role)).every((s) => s.signature_status === "signed");

  if (allSigned) {
    const tenantSigner = signers.find((s) => isTenantRole(s.role));
    if (!tenantSigner?.profile_id) {
      return LEASE_STATUS.PARTIALLY_SIGNED;
    }
    return LEASE_STATUS.FULLY_SIGNED;
  }

  if (allNonOwnersSigned && !ownerSigned && signedCount > 0) {
    return LEASE_STATUS.PENDING_OWNER_SIGNATURE;
  }

  if (signedCount > 0) {
    return LEASE_STATUS.PARTIALLY_SIGNED;
  }

  return LEASE_STATUS.PENDING_SIGNATURE;
}

// ---------------------------------------------------------------------------
// executeSignature — Orchestration complete de la signature
// ---------------------------------------------------------------------------

export async function executeSignature(ctx: SigningContext): Promise<SigningResult> {
  const supabase = getServiceClient();
  const { leaseId, signer, signatureImage, signerName, signerEmail } = ctx;

  // 1. Validate image
  const validation = validateSignatureImage(signatureImage);
  if (!validation.valid) {
    throw new Error(validation.errors[0] ?? "Image de signature invalide");
  }

  // 2. Auto-create signer if needed (owner first sign)
  let signerId = signer.id;
  if (signer.needsAutoCreate && !signerId) {
    const { data: created, error } = await supabase
      .from("lease_signers")
      .insert({
        lease_id: leaseId,
        profile_id: signer.profile_id,
        role: signer.role,
        signature_status: "pending",
      } as any)
      .select("id")
      .single();
    if (error || !created) throw new Error("Impossible de créer le signataire: " + (error?.message ?? "unknown"));
    signerId = (created as any).id;
  }

  // 3. Link invited signer to profile if profile_id was missing
  const profileId = ctx.signerProfileId ?? signer.profile_id ?? null;
  if (profileId && !signer.profile_id && signerId) {
    await supabase
      .from("lease_signers")
      .update({ profile_id: profileId } as any)
      .eq("id", signerId);
  }

  // 4. Generate document content for hash
  const documentContent = ctx.documentContentOverride ?? JSON.stringify({
    leaseId,
    signerEmail,
    signerRole: signer.role,
    timestamp: Date.now(),
  });

  // 5. Generate cryptographic proof
  const proof = await generateSignatureProof({
    documentType: "bail",
    documentId: leaseId,
    documentContent,
    signerName,
    signerEmail,
    signerProfileId: profileId || undefined,
    identityVerified: true,
    identityMethod: ctx.identityMethod,
    signatureType: "draw",
    signatureImage,
    userAgent: ctx.userAgent,
    screenSize: ctx.screenSize || "unknown",
    touchDevice: ctx.touchDevice || false,
    ipAddress: ctx.ipAddress,
  });

  // 6. Upload signature image
  const signaturePath = `signatures/${leaseId}/${signerId}_${Date.now()}.png`;
  let uploadSuccess = false;
  try {
    const buffer = Buffer.from(stripBase64Prefix(signatureImage), "base64");
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(signaturePath, buffer, { contentType: "image/png", upsert: true });
    uploadSuccess = !uploadError;
  } catch {
    // non-blocking
  }

  // 7. Update lease_signers
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
    ip_inet: proof.metadata.ipAddress ?? null,
    user_agent: proof.metadata.userAgent,
    proof_id: proof.proofId,
    proof_metadata: proofForDB as Record<string, unknown>,
    document_hash: proof.document.hash,
  };
  if (uploadSuccess) updateData.signature_image_path = signaturePath;

  const { error: signerUpdateError } = await supabase
    .from("lease_signers")
    .update(updateData)
    .eq("id", signerId);

  if (signerUpdateError) {
    throw new Error("Erreur enregistrement signature: " + signerUpdateError.message);
  }

  // 8. Determine new lease status
  const newStatus = await determineLeaseStatus(supabase, leaseId);

  // 9. Update lease status
  const { data: currentLease } = await supabase
    .from("leases")
    .select("statut")
    .eq("id", leaseId)
    .single();

  if (newStatus !== (currentLease as any)?.statut) {
    const { error: leaseUpdateError } = await supabase
      .from("leases")
      .update({ statut: newStatus })
      .eq("id", leaseId);

    if (leaseUpdateError) {
      if (String(leaseUpdateError.code) === "23514") {
        await supabase.from("leases").update({ statut: LEASE_STATUS.PENDING_SIGNATURE }).eq("id", leaseId);
      } else {
        throw new Error("Erreur mise à jour statut bail: " + leaseUpdateError.message);
      }
    }
  }

  const allSigned = newStatus === LEASE_STATUS.FULLY_SIGNED;

  // 10. Post-signature automation
  let postSignatureHandled = false;
  if (allSigned) {
    try {
      await handleLeaseFullySigned(leaseId);
      postSignatureHandled = true;
    } catch {
      // non-blocking — self-healing or outbox retry will catch it
    }
  }

  // 11. Audit log
  try {
    await supabase.from("audit_log").insert({
      actor_type: "user",
      actor_id: profileId ?? null,
      action: "lease_signed",
      resource: "lease",
      resource_id: leaseId,
      after: {
        role: signer.role,
        proof_id: proof.proofId,
        verification_method: ctx.identityMethod,
        signer_email: signerEmail,
        all_signed: allSigned,
      },
    } as any);
  } catch {
    // non-blocking
  }

  return {
    success: true,
    newStatus,
    allSigned,
    proofId: proof.proofId,
    signerId,
    postSignatureHandled,
  };
}
