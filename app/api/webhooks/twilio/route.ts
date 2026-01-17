export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhook Twilio pour les statuts de livraison SMS
 * POST /api/webhooks/twilio
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import crypto from "crypto";

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

export async function POST(request: NextRequest) {
  try {
    // Vérifier la signature Twilio
    const twilioSignature = request.headers.get("x-twilio-signature");
    const url = request.url;
    const body = await request.text();

    if (TWILIO_AUTH_TOKEN && twilioSignature) {
      const isValid = verifyTwilioSignature(url, body, twilioSignature);
      if (!isValid) {
        console.error("Signature Twilio invalide");
        return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
      }
    }

    // Parser les données du webhook
    const params = new URLSearchParams(body);
    const messageSid = params.get("MessageSid");
    const messageStatus = params.get("MessageStatus");
    const errorCode = params.get("ErrorCode");
    const errorMessage = params.get("ErrorMessage");

    if (!messageSid || !messageStatus) {
      return NextResponse.json(
        { error: "Paramètres manquants" },
        { status: 400 }
      );
    }

    console.log(`[Twilio Webhook] SID: ${messageSid}, Status: ${messageStatus}`);

    const supabase = createServiceRoleClient();

    // Mapper le statut Twilio vers notre statut
    const statusMap: Record<string, string> = {
      queued: "queued",
      sending: "queued",
      sent: "sent",
      delivered: "delivered",
      undelivered: "undelivered",
      failed: "failed",
    };

    const mappedStatus = statusMap[messageStatus] || messageStatus;

    // Mettre à jour le SMS en base
    const updateData: any = {
      twilio_status: messageStatus,
      status: mappedStatus,
    };

    if (messageStatus === "delivered") {
      updateData.delivered_at = new Date().toISOString();
    }

    if (messageStatus === "sent") {
      updateData.sent_at = new Date().toISOString();
    }

    if (errorCode) {
      updateData.error_code = errorCode;
      updateData.error_message = errorMessage;
    }

    const { error: updateError } = await supabase
      .from("sms_messages")
      .update(updateData)
      .eq("twilio_sid", messageSid);

    if (updateError) {
      console.error("Erreur mise à jour SMS:", updateError);
    }

    // Gérer les erreurs spécifiques
    if (messageStatus === "undelivered" || messageStatus === "failed") {
      // Log pour analyse
      console.error(
        `[Twilio] SMS non livré - SID: ${messageSid}, Code: ${errorCode}, Message: ${errorMessage}`
      );

      // Potentiellement désactiver les SMS pour ce numéro si erreur permanente
      const permanentErrors = ["30003", "30004", "30005", "30006", "21211"];
      if (errorCode && permanentErrors.includes(errorCode)) {
        // Le numéro est invalide ou bloqué
        const { data: smsRecord } = await supabase
          .from("sms_messages")
          .select("profile_id")
          .eq("twilio_sid", messageSid)
          .single();

        if (smsRecord?.profile_id) {
          await supabase
            .from("notification_preferences")
            .update({ sms_enabled: false })
            .eq("profile_id", smsRecord.profile_id);

          console.log(
            `[Twilio] SMS désactivé pour le profil ${smsRecord.profile_id} (erreur ${errorCode})`
          );
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("Erreur webhook Twilio:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

// Vérifier la signature Twilio
function verifyTwilioSignature(
  url: string,
  body: string,
  signature: string
): boolean {
  if (!TWILIO_AUTH_TOKEN) return false;

  const params = new URLSearchParams(body);
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + value)
    .join("");

  const data = url + sortedParams;
  const expectedSignature = crypto
    .createHmac("sha1", TWILIO_AUTH_TOKEN)
    .update(data)
    .digest("base64");

  return signature === expectedSignature;
}







