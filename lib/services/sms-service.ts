/**
 * Service d'envoi de SMS via Twilio
 *
 * @deprecated Ce service est obsolète. Utilisez plutôt `sms.service.ts` qui offre :
 * - Gestion centralisée des credentials via `credentials-service.ts`
 * - Meilleur support des territoires français (DROM-COM)
 * - Validation des numéros de téléphone
 * - Support de la librairie officielle Twilio
 *
 * Migration :
 * - `sendSms` -> `sendSMS` from './sms.service'
 * - `sendOtpSms` -> `sendOTPSMS` from './sms.service'
 * - `SmsOptions` -> `SMSOptions` from './sms.service'
 * - `SmsResult` -> `SMSResult` from './sms.service'
 *
 * Ce fichier sera supprimé dans une future version.
 */

import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// Types
export interface SmsOptions {
  to: string;
  message: string;
  from?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

// Fonction de déchiffrement des clés
function decryptKey(encryptedKey: string): string {
  const masterKey = process.env.API_KEY_MASTER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "default-key-for-dev-only-32chars!";
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(masterKey, "external-api-salt", 32);
  const [ivHex, authTagHex, encrypted] = encryptedKey.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Récupérer les credentials Twilio depuis la DB
async function getTwilioCredentials(): Promise<{
  accountSid: string;
  authToken: string;
  phoneNumber: string;
} | null> {
  try {
    const supabase = await createClient();
    
    // Récupérer le provider Twilio
    const { data: provider } = await supabase
      .from("api_providers")
      .select("id")
      .eq("name", "Twilio")
      .single();

    if (!provider) return null;

    // Récupérer les credentials
    const { data: credential } = await supabase
      .from("api_credentials")
      .select("secret_ref, scope")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!credential?.secret_ref) return null;

    // Déchiffrer et parser
    const authToken = decryptKey(credential.secret_ref);
    let config: any = {};
    try {
      if (credential.scope) {
        config = JSON.parse(credential.scope);
      }
    } catch {
      // Pas du JSON
    }

    return {
      accountSid: config.account_sid || process.env.TWILIO_ACCOUNT_SID || "",
      authToken,
      phoneNumber: config.phone_number || process.env.TWILIO_PHONE_NUMBER || "",
    };
  } catch (error) {
    console.error("[SMS] Erreur récupération credentials:", error);
    return null;
  }
}

/**
 * Envoie un SMS via Twilio
 */
export async function sendSms(options: SmsOptions): Promise<SmsResult> {
  // Mode développement - simulation
  if (process.env.NODE_ENV === "development" && process.env.SMS_FORCE_SEND !== "true") {
    console.log("[SMS] 📱 Envoi simulé (mode dev):", {
      to: options.to,
      message: options.message.substring(0, 50) + "...",
    });
    return { success: true, messageId: `dev-sms-${Date.now()}`, simulated: true };
  }

  // Récupérer les credentials
  const credentials = await getTwilioCredentials();
  
  if (!credentials || !credentials.accountSid || !credentials.authToken) {
    // Fallback sur les variables d'environnement
    const envAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const envAuthToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!envAccountSid || !envAuthToken) {
      return {
        success: false,
        error: "Twilio n'est pas configuré. Ajoutez vos credentials dans Admin > Intégrations.",
      };
    }
  }

  const accountSid = credentials?.accountSid || process.env.TWILIO_ACCOUNT_SID!;
  const authToken = credentials?.authToken || process.env.TWILIO_AUTH_TOKEN!;
  const fromNumber = options.from || credentials?.phoneNumber || process.env.TWILIO_PHONE_NUMBER;

  if (!fromNumber) {
    return {
      success: false,
      error: "Numéro d'envoi Twilio non configuré.",
    };
  }

  try {
    // Formater le numéro de destination
    const toNumber = formatPhoneNumber(options.to);
    
    // Appel API Twilio
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          To: toNumber,
          From: fromNumber,
          Body: options.message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || `Erreur Twilio: ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.sid,
    };
  } catch (error: unknown) {
    console.error("[SMS] Erreur envoi:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur d'envoi SMS",
    };
  }
}

/**
 * Formate un numéro de téléphone au format international
 */
function formatPhoneNumber(phone: string): string {
  // Supprimer les espaces et caractères spéciaux
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, "");
  
  // Si commence par 0, remplacer par +33 (France)
  if (cleaned.startsWith("0")) {
    cleaned = "+33" + cleaned.substring(1);
  }
  
  // Ajouter + si absent
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  
  return cleaned;
}

// Templates SMS prédéfinis
export const SMS_TEMPLATES = {
  // Code OTP pour signature
  signature_otp: (code: string) => 
    `Votre code de signature Talok : ${code}. Valable 10 minutes.`,
  
  // Rappel de loyer
  rent_reminder: (amount: number, dueDate: string) =>
    `Rappel: Votre loyer de ${amount}€ est dû le ${dueDate}. Talok`,
  
  // Confirmation de paiement
  payment_confirmation: (amount: number) =>
    `Paiement de ${amount}€ reçu. Merci ! Talok`,
  
  // Nouveau ticket maintenance
  maintenance_ticket: (ticketId: string) =>
    `Ticket #${ticketId} créé. Nous vous contacterons sous 48h. Talok`,
  
  // RDV intervention
  intervention_scheduled: (date: string, time: string) =>
    `RDV intervention confirmé le ${date} à ${time}. Talok`,
};

/**
 * Envoie un SMS de code OTP pour signature
 */
export async function sendOtpSms(to: string, code: string): Promise<SmsResult> {
  return sendSms({
    to,
    message: SMS_TEMPLATES.signature_otp(code),
  });
}

/**
 * Envoie un rappel de loyer par SMS
 */
export async function sendRentReminderSms(
  to: string,
  amount: number,
  dueDate: string
): Promise<SmsResult> {
  return sendSms({
    to,
    message: SMS_TEMPLATES.rent_reminder(amount, dueDate),
  });
}

