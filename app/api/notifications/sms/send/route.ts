export const runtime = 'nodejs';

/**
 * API Route pour envoyer des SMS via Twilio
 * POST /api/notifications/sms/send
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { z } from "zod";

const sendSmsSchema = z.object({
  profile_id: z.string().uuid().optional(),
  phone_number: z.string().optional(),
  message: z.string().min(1).max(1600), // Max 10 segments de 160 caractères
  template: z.enum([
    "payment_reminder",
    "payment_late",
    "ticket_urgent",
    "edl_reminder",
    "lease_expiring",
    "custom"
  ]).optional(),
  template_data: z.record(z.any()).optional(),
});

// Configuration Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

// Templates SMS
const SMS_TEMPLATES: Record<string, (data: any) => string> = {
  payment_reminder: (data) =>
    `[Talok] Rappel: Votre loyer de ${data.amount}€ est dû le ${data.dueDate}. Réglez via votre espace locataire.`,
  payment_late: (data) =>
    `[Talok] URGENT: Votre loyer de ${data.amount}€ est en retard de ${data.daysLate} jour(s). Merci de régulariser rapidement.`,
  ticket_urgent: (data) =>
    `[Talok] Incident urgent signalé: ${data.title}. Connectez-vous pour plus de détails.`,
  edl_reminder: (data) =>
    `[Talok] Rappel: État des lieux prévu le ${data.date} à ${data.time} pour ${data.property}.`,
  lease_expiring: (data) =>
    `[Talok] Votre bail pour ${data.property} expire dans ${data.daysLeft} jours. Contactez votre propriétaire.`,
  custom: (data) => data.message || "",
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Vérifier le rôle (admin ou owner)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["admin", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Valider les données
    const body = await request.json();
    const validatedData = sendSmsSchema.parse(body);

    if (!validatedData.profile_id && !validatedData.phone_number) {
      return NextResponse.json(
        { error: "profile_id ou phone_number requis" },
        { status: 400 }
      );
    }

    // Vérifier la configuration Twilio
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return NextResponse.json(
        { error: "Twilio non configuré" },
        { status: 500 }
      );
    }

    const serviceClient = createServiceRoleClient();
    let phoneNumber = validatedData.phone_number;
    let targetProfileId = validatedData.profile_id;

    // Récupérer le numéro de téléphone si profile_id fourni
    if (validatedData.profile_id && !phoneNumber) {
      const { data: targetProfile } = await serviceClient
        .from("profiles")
        .select("id, telephone")
        .eq("id", validatedData.profile_id)
        .single();

      if (!targetProfile?.telephone) {
        return NextResponse.json(
          { error: "Numéro de téléphone non trouvé pour ce profil" },
          { status: 400 }
        );
      }

      phoneNumber = targetProfile.telephone;
      targetProfileId = targetProfile.id;
    }

    // Vérifier les préférences de notification
    if (targetProfileId) {
      const { data: prefs } = await serviceClient
        .from("notification_preferences")
        .select("sms_enabled")
        .eq("profile_id", targetProfileId)
        .maybeSingle();

      if (prefs && !prefs.sms_enabled) {
        return NextResponse.json({
          success: false,
          reason: "SMS désactivé par l'utilisateur",
        });
      }
    }

    // Formater le numéro de téléphone
    const formattedPhone = formatPhoneNumber(phoneNumber!);

    // Générer le message
    let message = validatedData.message;
    if (validatedData.template && validatedData.template !== "custom") {
      const templateFn = SMS_TEMPLATES[validatedData.template];
      if (templateFn) {
        message = templateFn(validatedData.template_data || {});
      }
    }

    // Envoyer le SMS via Twilio
    const twilioResponse = await sendTwilioSms(formattedPhone, message);

    // Enregistrer le SMS en base
    const { data: smsRecord, error: insertError } = await serviceClient
      .from("sms_messages")
      .insert({
        profile_id: targetProfileId,
        from_number: TWILIO_PHONE_NUMBER || "Talok",
        to_number: formattedPhone,
        message: message,
        twilio_sid: twilioResponse.sid,
        twilio_status: twilioResponse.status,
        status: twilioResponse.success ? "queued" : "failed",
        error_code: twilioResponse.errorCode,
        error_message: twilioResponse.errorMessage,
        segments: Math.ceil(message.length / 160),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erreur enregistrement SMS:", insertError);
    }

    if (!twilioResponse.success) {
      return NextResponse.json({
        success: false,
        error: twilioResponse.errorMessage,
        error_code: twilioResponse.errorCode,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sms_id: smsRecord?.id,
      twilio_sid: twilioResponse.sid,
      status: twilioResponse.status,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur envoi SMS:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

// Formater un numéro de téléphone pour Twilio
function formatPhoneNumber(phone: string): string {
  // Supprimer tous les caractères non numériques sauf le +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // Si commence par 0, remplacer par +33 (France)
  if (cleaned.startsWith("0")) {
    cleaned = "+33" + cleaned.slice(1);
  }

  // Si ne commence pas par +, ajouter +
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

// Envoyer un SMS via Twilio
async function sendTwilioSms(
  to: string,
  body: string
): Promise<{
  success: boolean;
  sid?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
}> {
  try {
    const fromNumber = TWILIO_MESSAGING_SERVICE_SID || TWILIO_PHONE_NUMBER;

    const formData = new URLSearchParams();
    formData.append("To", to);
    formData.append("Body", body);

    if (TWILIO_MESSAGING_SERVICE_SID) {
      formData.append("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
    } else if (TWILIO_PHONE_NUMBER) {
      formData.append("From", TWILIO_PHONE_NUMBER);
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString(
              "base64"
            ),
        },
        body: formData.toString(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        errorCode: data.code?.toString(),
        errorMessage: data.message,
      };
    }

    return {
      success: true,
      sid: data.sid,
      status: data.status,
    };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error.message,
    };
  }
}







