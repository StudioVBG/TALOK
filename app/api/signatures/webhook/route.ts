export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/signatures/webhook - Handler pour les webhooks des providers de signature (Yousign/DocuSign)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const eventType = body.type || body.event_type;
    const signature = request.headers.get("x-signature") || request.headers.get("yousign-signature");

    // Vérifier la signature du webhook (à implémenter selon le provider)
    // const isValid = verifyWebhookSignature(body, signature);
    // if (!isValid) {
    //   return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    // }

    // Traiter selon le type d'événement
    switch (eventType) {
      case "signature.completed":
      case "signature.signed": {
        const signatureId = body.data?.signature_id || body.signature_id;
        const providerRef = body.data?.provider_ref || body.provider_ref;
        await handleSignatureCompleted(supabase, signatureId, providerRef, body);
        break;
      }

      case "signature.failed":
      case "signature.rejected": {
        const signatureId = body.data?.signature_id || body.signature_id;
        await handleSignatureFailed(supabase, signatureId, body);
        break;
      }

      default:
        console.log("Événement signature non géré:", eventType);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Erreur webhook signature:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

async function handleSignatureCompleted(supabase: any, signatureId: string, providerRef: string, webhookData: any) {
  // Trouver la signature
  const { data: signature } = await supabase
    .from("signatures")
    .select("*")
    .eq("provider_ref", providerRef)
    .maybeSingle();

  if (!signature) {
    console.error("Signature non trouvée:", providerRef);
    return;
  }

  // Mettre à jour la signature
  await supabase
    .from("signatures")
    .update({
      signed_at: new Date().toISOString(),
      provider_data: webhookData.data || webhookData,
    } as any)
    .eq("id", signature.id);

  // Mettre à jour le signataire
  await supabase
    .from("lease_signers")
    .update({
      signature_status: "signed",
      signed_at: new Date().toISOString(),
    } as any)
    .eq("lease_id", signature.lease_id)
    .eq("profile_id", signature.signer_profile_id);

  // Vérifier si tous les signataires ont signé
  const { data: allSigners } = await supabase
    .from("lease_signers")
    .select("signature_status")
    .eq("lease_id", signature.lease_id);

  const allSigned = allSigners?.every((s: any) => s.signature_status === "signed");

  if (allSigned) {
    // ✅ SOTA 2026: Passer à "fully_signed" - activation après EDL via /activate
    await supabase
      .from("leases")
      .update({ statut: "fully_signed" } as any)
      .eq("id", signature.lease_id);

    // Émettre des événements - NOTA: Bail fully_signed, pas encore activé
    await supabase.from("outbox").insert({
      event_type: "Lease.FullySigned",
      payload: {
        lease_id: signature.lease_id,
        next_step: "edl_entree_required",
      },
    } as any);
  }

  await supabase.from("outbox").insert({
    event_type: "Signature.Completed",
    payload: {
      signature_id: signature.id,
      lease_id: signature.lease_id,
      all_signed: allSigned,
    },
  } as any);
}

async function handleSignatureFailed(supabase: any, signatureId: string, webhookData: any) {
  const { data: signature } = await supabase
    .from("signatures")
    .select("*")
    .eq("id", signatureId)
    .maybeSingle();

  if (!signature) return;

  await supabase
    .from("signatures")
    .update({
      provider_data: webhookData.data || webhookData,
    } as any)
    .eq("id", signatureId);

  await supabase.from("outbox").insert({
    event_type: "Signature.Failed",
    payload: {
      signature_id: signatureId,
      lease_id: signature.lease_id,
      reason: webhookData.reason || "Unknown",
    },
  } as any);
}





