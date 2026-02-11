export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { extractClientIP } from "@/lib/utils/ip-address";

/**
 * POST /api/leases/[id]/amendments/[amendmentId]/sign
 * Signer un avenant au bail
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; amendmentId: string }> }
) {
  const { id: leaseId, amendmentId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Récupérer le profil
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer l'avenant
    const { data: amendment } = await serviceClient
      .from("lease_amendments")
      .select("*")
      .eq("id", amendmentId)
      .eq("lease_id", leaseId)
      .single();

    if (!amendment) {
      return NextResponse.json({ error: "Avenant non trouvé" }, { status: 404 });
    }

    if (!["pending_signature", "partially_signed"].includes(amendment.status)) {
      return NextResponse.json({
        error: "L'avenant n'est pas en attente de signature",
        status: amendment.status,
      }, { status: 400 });
    }

    const body = await request.json();
    const { signature_image, metadata: clientMetadata } = body;

    if (!signature_image) {
      return NextResponse.json({ error: "Signature requise" }, { status: 400 });
    }

    const isOwner = profile.role === "owner";

    // Vérifier qu'on n'a pas déjà signé
    if (isOwner && amendment.signed_by_owner) {
      return NextResponse.json({ error: "Vous avez déjà signé cet avenant" }, { status: 400 });
    }
    if (!isOwner && amendment.signed_by_tenant) {
      return NextResponse.json({ error: "Vous avez déjà signé cet avenant" }, { status: 400 });
    }

    // Générer la preuve
    const proof = await generateSignatureProof({
      documentType: "AVENANT",
      documentId: amendmentId,
      documentContent: JSON.stringify(amendment),
      signerName: `${profile.prenom} ${profile.nom}`,
      signerEmail: user.email!,
      signerProfileId: profile.id,
      identityVerified: true,
      identityMethod: isOwner ? "Compte Propriétaire Authentifié" : "Compte Locataire Authentifié",
      signatureType: "draw",
      signatureImage: signature_image,
      userAgent: request.headers.get("user-agent") || "Inconnu",
      ipAddress: extractClientIP(request),
      screenSize: clientMetadata?.screenSize || "Non spécifié",
      touchDevice: clientMetadata?.touchDevice || false,
    });

    // Upload de la signature
    const base64Data = signature_image.replace(/^data:image\/\w+;base64,/, "");
    const fileName = `amendments/${amendmentId}/${user.id}_${Date.now()}.png`;

    await serviceClient.storage
      .from("documents")
      .upload(fileName, Buffer.from(base64Data, "base64"), {
        contentType: "image/png",
        upsert: true,
      });

    // Mettre à jour l'avenant
    const updateData: Record<string, unknown> = {};
    if (isOwner) {
      updateData.signed_by_owner = true;
      updateData.owner_signed_at = proof.timestamp.iso;
      updateData.owner_signature_path = fileName;
      updateData.owner_proof_metadata = proof;
    } else {
      updateData.signed_by_tenant = true;
      updateData.tenant_signed_at = proof.timestamp.iso;
      updateData.tenant_signature_path = fileName;
      updateData.tenant_proof_metadata = proof;
    }

    // Déterminer le nouveau statut
    const otherPartySigned = isOwner ? amendment.signed_by_tenant : amendment.signed_by_owner;
    if (otherPartySigned) {
      updateData.status = "signed";
      updateData.sealed_at = new Date().toISOString();
    } else {
      updateData.status = "partially_signed";
    }

    const { error: updateError } = await serviceClient
      .from("lease_amendments")
      .update(updateData)
      .eq("id", amendmentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Si entièrement signé, appliquer les modifications au bail
    if (updateData.status === "signed") {
      await applyAmendmentToLease(serviceClient, leaseId, amendment);
    }

    // Audit
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "amendment_signed",
      entity_type: "lease_amendment",
      entity_id: amendmentId,
      metadata: {
        lease_id: leaseId,
        role: isOwner ? "owner" : "tenant",
        proof_id: proof.proofId,
        fully_signed: updateData.status === "signed",
      },
    } as any);

    return NextResponse.json({
      success: true,
      amendment_id: amendmentId,
      new_status: updateData.status,
      proof_id: proof.proofId,
      applied: updateData.status === "signed",
    });
  } catch (error: unknown) {
    console.error("[Amendment Sign] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Applique les modifications de l'avenant au bail une fois signé par les deux parties.
 */
async function applyAmendmentToLease(
  supabase: any,
  leaseId: string,
  amendment: any
) {
  const newValues = amendment.new_values || {};
  const updateData: Record<string, unknown> = {};

  switch (amendment.amendment_type) {
    case "loyer":
      if (newValues.loyer != null) updateData.loyer = newValues.loyer;
      break;
    case "charges":
      if (newValues.charges_forfaitaires != null) updateData.charges_forfaitaires = newValues.charges_forfaitaires;
      break;
    case "depot_garantie":
      if (newValues.depot_de_garantie != null) updateData.depot_de_garantie = newValues.depot_de_garantie;
      break;
    case "duree":
      if (newValues.date_fin != null) updateData.date_fin = newValues.date_fin;
      break;
  }

  if (Object.keys(updateData).length > 0) {
    updateData.updated_at = new Date().toISOString();
    await supabase
      .from("leases")
      .update(updateData)
      .eq("id", leaseId);

    console.log(`[Amendment] Applied changes to lease ${leaseId}:`, updateData);
  }

  // Émettre un événement
  await supabase.from("outbox").insert({
    event_type: "Lease.AmendmentApplied",
    payload: {
      lease_id: leaseId,
      amendment_id: amendment.id,
      amendment_type: amendment.amendment_type,
      changes: updateData,
    },
  } as any);
}
