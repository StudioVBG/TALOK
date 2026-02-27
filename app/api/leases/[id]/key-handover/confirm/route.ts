/**
 * POST /api/leases/[id]/key-handover/confirm — Locataire confirme la réception des clés
 *
 * Le locataire scanne le QR code, vérifie la liste des clés, et signe.
 * Génère une preuve horodatée + géolocalisée + signée.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { extractClientIP } from "@/lib/utils/ip-address";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { stripBase64Prefix } from "@/lib/utils/validate-signature";
import { revalidatePath } from "next/cache";
import { verifyHandoverToken } from "@/lib/services/handover-token.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Vérifier que l'utilisateur est locataire
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role, prenom, nom, email")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "tenant") {
      return NextResponse.json({ error: "Seul le locataire peut confirmer la réception" }, { status: 403 });
    }

    const body = await request.json();
    const { token, signature, metadata: clientMetadata, geolocation } = body;

    if (!token || !signature) {
      return NextResponse.json({ error: "Token et signature requis" }, { status: 400 });
    }

    // Vérifier le token
    const tokenData = verifyHandoverToken(token);
    if (!tokenData || tokenData.leaseId !== leaseId) {
      return NextResponse.json({ error: "Token invalide ou expiré. Demandez un nouveau QR code au propriétaire." }, { status: 410 });
    }

    // Trouver la remise des clés en DB
    const { data: handoverRaw } = await (serviceClient
      .from("key_handovers") as any)
      .select("*")
      .eq("lease_id", leaseId)
      .eq("token", token)
      .is("confirmed_at", null)
      .single();

    if (!handoverRaw) {
      return NextResponse.json({ error: "Remise des clés introuvable ou déjà confirmée" }, { status: 404 });
    }

    const handover = handoverRaw as {
      id: string;
      lease_id: string;
      property_id: string | null;
      owner_profile_id: string | null;
      keys_list: any[];
      token: string;
    };

    // Upload de la signature du locataire
    const base64Data = stripBase64Prefix(signature);
    const fileName = `key-handover/${leaseId}/${user.id}_${Date.now()}.png`;

    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(fileName, Buffer.from(base64Data, "base64"), {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[key-handover confirm] Upload error:", uploadError);
      throw new Error("Erreur lors de l'enregistrement de la signature");
    }

    // Générer la preuve cryptographique
    const proof = await generateSignatureProof({
      documentType: "KEY_HANDOVER",
      documentId: handover.id,
      documentContent: JSON.stringify({
        lease_id: leaseId,
        keys: handover.keys_list,
        handover_id: handover.id,
      }),
      signerName: `${profile.prenom} ${profile.nom}`,
      signerEmail: profile.email || user.email || "",
      signerProfileId: profile.id,
      identityVerified: true,
      identityMethod: "Compte locataire authentifié + QR code",
      signatureType: "draw",
      signatureImage: signature,
      userAgent: request.headers.get("user-agent") || "Inconnu",
      ipAddress: extractClientIP(request),
      screenSize: clientMetadata?.screenSize || "Non spécifié",
      touchDevice: clientMetadata?.touchDevice || false,
      geolocation: geolocation || undefined,
    });

    // Mettre à jour la remise des clés
    const { error: updateError } = await (serviceClient
      .from("key_handovers") as any)
      .update({
        confirmed_at: new Date().toISOString(),
        tenant_profile_id: profile.id,
        tenant_signature_path: fileName,
        tenant_ip: extractClientIP(request),
        tenant_user_agent: request.headers.get("user-agent"),
        geolocation: geolocation || null,
        proof_id: proof.proofId,
        proof_metadata: {
          ...proof,
          signature: { ...proof.signature, imageData: `[STORED:${fileName}]` },
        },
      })
      .eq("id", handover.id);

    if (updateError) {
      console.error("[key-handover confirm] Update error:", updateError);
      throw updateError;
    }

    // Créer l'entrée document "Attestation de remise des clés"
    try {
      await serviceClient.from("documents").insert({
        type: "attestation_remise_cles",
        property_id: handover.property_id,
        lease_id: leaseId,
        owner_id: handover.owner_profile_id,
        tenant_id: profile.id,
        title: "Attestation de remise des clés",
        storage_path: `key-handover/${leaseId}/attestation.pdf`,
        is_archived: false,
        metadata: {
          handover_id: handover.id,
          confirmed_at: new Date().toISOString(),
          keys_count: Array.isArray(handover.keys_list) ? handover.keys_list.length : 0,
          proof_id: proof.proofId,
          final: true,
        },
      } as any);
    } catch (docErr) {
      console.warn("[key-handover confirm] Document insert error (non-blocking):", docErr);
    }

    // Audit log
    try {
      await serviceClient.from("audit_log").insert({
        user_id: user.id,
        profile_id: profile.id,
        action: "key_handover_confirmed",
        entity_type: "lease",
        entity_id: leaseId,
        ip_address: extractClientIP(request) || null,
        user_agent: request.headers.get("user-agent") || null,
        metadata: {
          handover_id: handover.id,
          proof_id: proof.proofId,
          keys_count: Array.isArray(handover.keys_list) ? handover.keys_list.length : 0,
          geolocation: geolocation || null,
        },
      } as any);
    } catch (auditErr) {
      console.warn("[key-handover confirm] Audit error (non-blocking):", auditErr);
    }

    // Outbox event
    await serviceClient.from("outbox").insert({
      event_type: "KeyHandover.Confirmed",
      payload: {
        lease_id: leaseId,
        handover_id: handover.id,
        tenant_profile_id: profile.id,
        confirmed_at: new Date().toISOString(),
      },
    } as any);

    // Invalider le cache
    revalidatePath(`/owner/leases/${leaseId}`);
    revalidatePath("/tenant/dashboard");
    revalidatePath("/tenant/documents");
    revalidatePath("/owner/documents");

    return NextResponse.json({
      success: true,
      proof_id: proof.proofId,
      handover_id: handover.id,
    });
  } catch (error: unknown) {
    console.error("[key-handover confirm]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
