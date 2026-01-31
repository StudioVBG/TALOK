export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Vérifie la signature HMAC du webhook Yousign
 * @see https://developers.yousign.com/docs/webhooks#signature-verification
 *
 * @security CRITICAL - Ne jamais bypasser la vérification de signature
 */
function verifyWebhookSignature(rawBody: string, signature: string | null): { valid: boolean; error?: string } {
  const secret = process.env.YOUSIGN_WEBHOOK_SECRET;

  // Le secret est toujours requis - pas de bypass en dev
  if (!secret) {
    const errorMsg = "[SECURITY] YOUSIGN_WEBHOOK_SECRET non configuré - webhook rejeté";
    console.error(errorMsg);
    return { valid: false, error: "Webhook secret not configured" };
  }

  if (!signature) {
    console.error("[Webhook] Signature manquante dans les headers");
    return { valid: false, error: "Missing signature" };
  }

  try {
    // Yousign utilise HMAC-SHA256
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");

    // Comparaison timing-safe pour éviter les attaques par timing
    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      console.warn("[Webhook] Signature length mismatch");
      return { valid: false, error: "Invalid signature format" };
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    if (!isValid) {
      console.warn("[Webhook] Signature verification failed - possible attack");
    }
    return { valid: isValid, error: isValid ? undefined : "Signature mismatch" };
  } catch (error) {
    console.error("[Webhook] Erreur lors de la vérification de signature:", error);
    return { valid: false, error: "Signature verification error" };
  }
}

/**
 * POST /api/signatures/webhook - Handler pour les webhooks des providers de signature (Yousign/DocuSign)
 */
export async function POST(request: Request) {
  try {
    // Lire le body brut pour la vérification de signature
    const rawBody = await request.text();
    const signature = request.headers.get("x-signature") || request.headers.get("yousign-signature");

    // Vérifier la signature du webhook - AUCUN BYPASS AUTORISÉ
    const signatureResult = verifyWebhookSignature(rawBody, signature);
    if (!signatureResult.valid) {
      console.error(`[Webhook] Signature invalide - requête rejetée: ${signatureResult.error}`);
      return NextResponse.json(
        { error: "Signature invalide", details: signatureResult.error },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const body = JSON.parse(rawBody);
    const eventType = body.type || body.event_type;

    console.log("[Webhook] Événement reçu:", eventType);

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
  } catch (error: unknown) {
    console.error("Erreur webhook signature:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
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





