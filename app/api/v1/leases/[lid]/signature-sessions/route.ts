export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  requireRole,
  logAudit,
} from "@/lib/api/middleware";

interface RouteParams {
  params: Promise<{ lid: string }>;
}

/**
 * POST /api/v1/leases/:lid/signature-sessions
 * Create signature session and send for signing
 * Events: Lease.Sent, Signature.Requested
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { lid } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const supabase = await createClient();

    // Get lease with property and signers
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        *,
        properties!inner(owner_id, adresse_complete),
        lease_signers(
          id,
          profile_id,
          role,
          signature_status,
          profiles(id, user_id, prenom, nom)
        )
      `)
      .eq("id", lid)
      .single();

    if (leaseError || !lease) {
      return apiError("Bail non trouvé", 404);
    }

    // Verify ownership
    if (auth.profile.role === "owner" && lease.properties.owner_id !== auth.profile.id) {
      return apiError("Accès non autorisé", 403);
    }

    // Check lease status
    if (lease.statut !== "draft") {
      return apiError("Le bail doit être en brouillon pour envoyer pour signature", 400);
    }

    // Check we have at least 2 signers (owner + tenant)
    const signers = lease.lease_signers || [];
    if (signers.length < 2) {
      return apiError("Au moins 2 signataires requis (propriétaire + locataire)", 400);
    }

    const hasTenant = signers.some(
      (s: any) => s.role === "locataire_principal" || s.role === "colocataire"
    );
    if (!hasTenant) {
      return apiError("Au moins un locataire doit être signataire", 400);
    }

    // Generate session ID
    const sessionId = crypto.randomUUID();

    // Generate document hash from lease data for integrity verification
    const encoder = new TextEncoder();
    const leaseContent = JSON.stringify({
      id: lid,
      property: lease.properties?.adresse_complete,
      signers: signers.map((s: any) => s.profile_id),
      timestamp: new Date().toISOString(),
    });
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(leaseContent));
    const docHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Determine signature provider: Yousign (env configured) or internal
    const yousignApiKey = process.env.YOUSIGN_API_KEY;
    const yousignSandbox = process.env.YOUSIGN_SANDBOX === "true";
    let signingUrls: Record<string, string> = {};

    if (yousignApiKey) {
      // Yousign eIDAS integration (AES level)
      const yousignBaseUrl = yousignSandbox
        ? "https://api-sandbox.yousign.app/v3"
        : "https://api.yousign.app/v3";

      // Create Yousign signature request
      const yousignResponse = await fetch(`${yousignBaseUrl}/signature_requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${yousignApiKey}`,
        },
        body: JSON.stringify({
          name: `Bail - ${lease.properties?.adresse_complete || lid}`,
          delivery_mode: "email",
          timezone: "Europe/Paris",
          signers: signers.map((s: any) => ({
            info: {
              first_name: s.profiles?.prenom || "",
              last_name: s.profiles?.nom || "",
              locale: "fr",
            },
            signature_level: "electronic_signature",
            signature_authentication_mode: "otp_email",
          })),
        }),
      });

      if (yousignResponse.ok) {
        const yousignData = await yousignResponse.json();
        // Map signing URLs per signer
        if (yousignData.signers) {
          for (let i = 0; i < signers.length && i < yousignData.signers.length; i++) {
            const profileId = signers[i].profile_id;
            if (profileId) {
              signingUrls[profileId] = yousignData.signers[i].signature_link || "";
            }
          }
        }
      } else {
        console.error("[signature-sessions] Yousign error:", await yousignResponse.text());
        // Fall back to internal signature if Yousign fails
      }
    }

    // Create signature records for each signer
    for (const signer of signers) {
      await supabase.from("signatures").insert({
        lease_id: lid,
        signer_user: signer.profiles?.user_id,
        signer_profile_id: signer.profile_id,
        level: yousignApiKey ? "AES" : "SES",
        otp_verified: false,
        doc_hash: docHash,
        provider: yousignApiKey ? "yousign" : "internal",
        signing_url: signer.profile_id ? (signingUrls[signer.profile_id] || null) : null,
      } as any);
    }

    // Update lease status
    await supabase
      .from("leases")
      .update({ statut: "pending_signature" })
      .eq("id", lid);

    // Emit events
    await supabase.from("outbox").insert([
      {
        event_type: "Lease.Sent",
        payload: { lease_id: lid, session_id: sessionId },
      },
      {
        event_type: "Signature.Requested",
        payload: {
          lease_id: lid,
          session_id: sessionId,
          provider: yousignApiKey ? "yousign" : "internal",
          signers: signers.map((s: any) => ({
            profile_id: s.profile_id,
            role: s.role,
          })),
        },
      },
    ]);

    // Audit log
    await logAudit(
      supabase,
      "lease.sent_for_signature",
      "leases",
      lid,
      auth.user.id,
      { statut: "draft" },
      { statut: "pending_signature" }
    );

    return apiSuccess({
      session_id: sessionId,
      lease_id: lid,
      status: "pending_signature",
      provider: yousignApiKey ? "yousign" : "internal",
      signers: signers.map((s: any) => ({
        id: s.id,
        role: s.role,
        name: `${s.profiles?.prenom || ""} ${s.profiles?.nom || ""}`.trim(),
        status: "pending",
        signing_url: signingUrls[s.profile_id] || null,
      })),
    }, 201);
  } catch (error: unknown) {
    console.error("[POST /signature-sessions] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

