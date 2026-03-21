export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
import { createSignatureLogger } from "@/lib/utils/signature-logger";
import { isOwnerRole, isTenantRole, LEASE_STATUS } from "@/lib/constants/roles";
import { findSigner, executeSignature } from "@/lib/services/lease-signing.service";
import { extractClientIP } from "@/lib/utils/ip-address";

/**
 * POST /api/leases/[id]/sign — Signature bail (utilisateur connecte)
 * SOTA 2026: Adaptateur leger delegant a LeaseSigningService
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;
  const log = createSignatureLogger("/api/leases/[id]/sign", leaseId);

  try {
    // Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    // Rate limit
    const limiter = getRateLimiterByUser(rateLimitPresets.api);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

    const body = await request.json();
    const { signature_image, metadata: clientMetadata } = body;
    if (!signature_image) return NextResponse.json({ error: "La signature tactile est obligatoire" }, { status: 400 });

    const serviceClient = getServiceClient();

    // Resolve profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("user_id", user.id as any)
      .single();
    if (!profile) return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });

    // Find signer
    const signer = await findSigner(serviceClient, leaseId, {
      profileId: (profile as any).id,
      email: user.email,
    });
    if (!signer) return NextResponse.json({ error: "Vous n'êtes pas autorisé à signer ce bail" }, { status: 403 });
    if (signer.signature_status === "signed") return NextResponse.json({ error: "Vous avez déjà signé ce bail" }, { status: 400 });

    // Quota check (non-blocking)
    try {
      const { checkSignatureQuota } = await import("@/lib/subscriptions/signature-tracking");
      const { data: leaseForQuota } = await serviceClient
        .from("leases")
        .select("property:properties(owner_id)")
        .eq("id", leaseId as any)
        .single();
      const ownerId = (leaseForQuota as any)?.property?.owner_id;
      if (ownerId) {
        const quota = await checkSignatureQuota(ownerId);
        if (!quota.canSign && !quota.isUnlimited) {
          return NextResponse.json({ error: "Quota de signatures mensuel atteint." }, { status: 403 });
        }
      }
    } catch { /* non-blocking */ }

    const isOwner = (profile as any).role === "owner";
    const identityMethod = isOwner ? "Compte Propriétaire Authentifié" : "Compte Authentifié (Email Vérifié)";

    // Execute signature via unified service
    const result = await executeSignature({
      leaseId,
      signer,
      signatureImage: signature_image,
      signerName: `${(profile as any).prenom} ${(profile as any).nom}`,
      signerEmail: user.email!,
      signerProfileId: (profile as any).id,
      identityMethod,
      ipAddress: extractClientIP(request),
      userAgent: request.headers.get("user-agent") || "unknown",
      screenSize: clientMetadata?.screenSize,
      touchDevice: clientMetadata?.touchDevice,
    });

    // Increment quota (non-blocking)
    try {
      const { incrementSignatureUsage } = await import("@/lib/subscriptions/signature-tracking");
      const { data: lease } = await serviceClient
        .from("leases")
        .select("property:properties(owner_id)")
        .eq("id", leaseId as any)
        .single();
      const ownerId = (lease as any)?.property?.owner_id;
      if (ownerId) await incrementSignatureUsage(ownerId, 1, { document_type: "bail", document_id: leaseId });
    } catch { /* non-blocking */ }

    // Outbox events
    try {
      const signerRole = signer.role;
      const { data: leaseInfo } = await serviceClient
        .from("leases")
        .select("id, property:properties(id, adresse_complete, ville, owner_id), signers:lease_signers(profile_id, role, signature_status, profiles(prenom, nom, user_id))")
        .eq("id", leaseId)
        .single();

      const ownerSigner = (leaseInfo as any)?.signers?.find((s: any) => isOwnerRole(s.role));
      const tenantSigner = (leaseInfo as any)?.signers?.find((s: any) => isTenantRole(s.role));

      if (isTenantRole(signerRole) || signerRole === "tenant" || signerRole === "principal") {
        await serviceClient.from("outbox").insert({
          event_type: "Lease.TenantSigned",
          payload: { lease_id: leaseId, owner_user_id: ownerSigner?.profiles?.user_id, tenant_name: `${tenantSigner?.profiles?.prenom || ""} ${tenantSigner?.profiles?.nom || ""}`.trim(), property_address: (leaseInfo as any)?.property?.adresse_complete },
        } as any);
      }
      if (isOwnerRole(signerRole)) {
        await serviceClient.from("outbox").insert({
          event_type: "Lease.OwnerSigned",
          payload: { lease_id: leaseId, tenant_user_id: tenantSigner?.profiles?.user_id, owner_name: `${ownerSigner?.profiles?.prenom || ""} ${ownerSigner?.profiles?.nom || ""}`.trim(), property_address: (leaseInfo as any)?.property?.adresse_complete },
        } as any);
      }
      if (result.allSigned) {
        for (const s of [ownerSigner, tenantSigner].filter(Boolean)) {
          if (s?.profiles?.user_id) {
            await serviceClient.from("outbox").insert({
              event_type: "Lease.FullySigned",
              payload: { lease_id: leaseId, user_id: s.profiles.user_id, profile_id: s.profile_id, is_owner: isOwnerRole(s.role), property_address: (leaseInfo as any)?.property?.adresse_complete, next_step: isOwnerRole(s.role) ? "edl_entree" : "await_edl" },
            } as any);
          }
        }
      }
    } catch { /* non-blocking */ }

    revalidatePath("/owner/leases");
    revalidatePath(`/owner/leases/${leaseId}`);
    revalidatePath("/tenant/signatures");
    revalidatePath("/tenant/documents");

    return NextResponse.json({ success: true, proof_id: result.proofId, lease_status: result.newStatus, new_status: result.newStatus, all_signed: result.allSigned });
  } catch (error: unknown) {
    log.complete(false, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}
