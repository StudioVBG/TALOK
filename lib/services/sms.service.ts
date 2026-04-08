/**
 * Service d'envoi de SMS
 * 
 * Compatible avec :
 * - Twilio (recommandé pour la France)
 * - Vonage (Nexmo)
 * 
 * Récupère automatiquement les credentials depuis la DB (Admin > Intégrations)
 * ou utilise les variables d'environnement en fallback
 */

import { getTwilioCredentials } from "./credentials-service";

// Types
export type SMSProvider = "twilio" | "vonage" | "simulation";

export interface SMSOptions {
  to: string;
  message: string;
  from?: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
  details?: string;
}

// Configuration de base
const baseConfig = {
  provider: (process.env.SMS_PROVIDER as SMSProvider) || "twilio",
};

/**
 * Indicatifs des territoires français
 */
const FRENCH_TERRITORIES = {
  // Martinique
  "0696": "+596",
  "0697": "+596",
  // Guadeloupe
  "0690": "+590",
  "0691": "+590",
  // Réunion
  "0692": "+262",
  "0693": "+262",
  // Guyane
  "0694": "+594",
  // Mayotte
  "0639": "+262",
  // France métropolitaine (mobiles)
  "06": "+33",
  "07": "+33",
} as const;

/**
 * Détecte le territoire français à partir du préfixe
 */
export function detectTerritory(phone: string): { code: string; name: string } | null {
  const cleaned = phone.replace(/[^0-9]/g, "");
  
  if (cleaned.length < 4) return null;
  
  const prefix4 = cleaned.substring(0, 4);
  const prefix2 = cleaned.substring(0, 2);
  
  // Vérifier les préfixes DROM (4 chiffres)
  if (["0696", "0697"].includes(prefix4)) {
    return { code: "596", name: "Martinique" };
  }
  if (["0690", "0691"].includes(prefix4)) {
    return { code: "590", name: "Guadeloupe" };
  }
  if (["0692", "0693"].includes(prefix4)) {
    return { code: "262", name: "Réunion" };
  }
  if (prefix4 === "0694") {
    return { code: "594", name: "Guyane" };
  }
  if (prefix4 === "0639") {
    return { code: "262", name: "Mayotte" };
  }
  
  // France métropolitaine
  if (prefix2 === "06" || prefix2 === "07") {
    return { code: "33", name: "France" };
  }
  
  return null;
}

/**
 * Formate un numéro de téléphone au format international
 * Supporte automatiquement la France métropolitaine et les DROM
 * 
 * @param phone - Le numéro de téléphone
 * @param countryCode - Code pays optionnel (ex: "596" pour Martinique)
 */
function formatPhoneNumber(phone: string, countryCode?: string): string {
  // Nettoyer le numéro
  let cleaned = phone.replace(/[^0-9+]/g, "");
  
  // Si déjà au format international, retourner tel quel
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  
  // Si le code pays est fourni explicitement
  if (countryCode) {
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    return `+${countryCode}${cleaned}`;
  }
  
  // Détection automatique pour les numéros français (10 chiffres)
  if (cleaned.length === 10 && cleaned.startsWith("0")) {
    const territory = detectTerritory(cleaned);
    if (territory) {
      return `+${territory.code}${cleaned.substring(1)}`;
    }
  }
  
  // Fallback : France métropolitaine
  if (cleaned.startsWith("0")) {
    return "+33" + cleaned.substring(1);
  }
  
  // Si pas de préfixe, ajouter +33 par défaut
  return "+33" + cleaned;
}

/**
 * Valide un numéro de téléphone
 */
function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  // Format international: +[code pays][numéro]
  return /^\+[1-9]\d{6,14}$/.test(formatted);
}

/**
 * Envoie un SMS via Twilio
 * Récupère les credentials depuis la DB (Admin > Intégrations) ou l'environnement
 */
async function sendViaTwilio(options: SMSOptions): Promise<SMSResult> {
  try {
    // Récupérer les credentials depuis la DB ou l'environnement
    const credentials = await getTwilioCredentials();
    
    if (!credentials || !credentials.accountSid || !credentials.authToken) {
      return {
        success: false,
        error: "Twilio n'est pas configuré. Ajoutez vos credentials dans Admin > Intégrations ou via les variables d'environnement.",
      };
    }

    const { accountSid, authToken, phoneNumber } = credentials;
    const fromNumber = options.from || phoneNumber;
    
    if (!fromNumber) {
      return {
        success: false,
        error: "Numéro d'expédition Twilio non configuré (TWILIO_PHONE_NUMBER ou phone_number dans Admin).",
      };
    }

    // Import dynamique de Twilio
    const twilio = await import("twilio");
    const client = twilio.default(accountSid, authToken);
    
    const formattedTo = formatPhoneNumber(options.to);
    
    const message = await client.messages.create({
      body: options.message,
      from: fromNumber,
      to: formattedTo,
    });

    // TODO: replace with structured logger once available
    console.log(`[SMS] Envoyé à ${formattedTo} - SID: ${message.sid}`);
    
    return {
      success: true,
      messageId: message.sid,
    };
  } catch (error: unknown) {
    console.error("[SMS] ❌ Erreur Twilio:", (error as Error).message);
    return {
      success: false,
      error: error instanceof Error ? (error as Error).message : "Erreur d'envoi SMS",
    };
  }
}

/**
 * Simule l'envoi d'un SMS (développement)
 */
async function simulateSMS(options: SMSOptions): Promise<SMSResult> {
  const formattedTo = formatPhoneNumber(options.to);
  
  console.log("\n" + "=".repeat(50));
  console.log("📱 SMS SIMULÉ (Mode développement)");
  console.log("=".repeat(50));
  console.log(`   À: ${formattedTo}`);
  console.log(`   Message: ${options.message}`);
  console.log("=".repeat(50) + "\n");
  
  // Simuler un délai réseau
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  return {
    success: true,
    messageId: `sim_${Date.now()}`,
    simulated: true,
    details: `SMS simulé vers ${formattedTo}`,
  };
}

/**
 * Vérifie si Twilio est configuré (DB ou env)
 */
async function hasTwilioCredentials(): Promise<boolean> {
  try {
    const credentials = await getTwilioCredentials();
    return credentials !== null && !!credentials.accountSid && !!credentials.authToken;
  } catch {
    return false;
  }
}

/**
 * Envoie un SMS
 * Utilise les credentials de la DB (Admin > Intégrations) ou simule en développement
 */
export async function sendSMS(options: SMSOptions): Promise<SMSResult> {
  // Valider le numéro
  if (!isValidPhoneNumber(options.to)) {
    return {
      success: false,
      error: `Numéro de téléphone invalide: ${options.to}`,
    };
  }

  // Vérifier si on a des credentials configurés
  const hasCredentials = await hasTwilioCredentials();
  
  // Mode simulation si pas de credentials en développement
  if (!hasCredentials && process.env.NODE_ENV === "development") {
    // TODO: replace with structured logger once available
    console.log("[SMS] Twilio non configuré - Mode simulation activé");
    return simulateSMS(options);
  }
  
  // Si pas de credentials en production, retourner une erreur
  if (!hasCredentials) {
    return {
      success: false,
      error: "Service SMS non configuré. Configurez Twilio dans Admin > Intégrations.",
    };
  }

  // Envoyer via le provider configuré
  switch (baseConfig.provider) {
    case "twilio":
      return sendViaTwilio(options);
    case "simulation":
      return simulateSMS(options);
    default:
      return {
        success: false,
        error: `Provider SMS non supporté: ${baseConfig.provider}`,
      };
  }
}

/**
 * Envoie un code OTP par SMS
 */
export async function sendOTPSMS(
  phone: string,
  code: string,
  options?: {
    appName?: string;
    expiryMinutes?: number;
  }
): Promise<SMSResult> {
  const appName = options?.appName || "Talok";
  const expiry = options?.expiryMinutes || 10;
  
  const message = `${appName}: Votre code de vérification est ${code}. Valable ${expiry} minutes. Ne le partagez avec personne.`;
  
  return sendSMS({
    to: phone,
    message,
  });
}

/**
 * Envoie une notification SMS
 */
export async function sendNotificationSMS(
  phone: string,
  title: string,
  body: string
): Promise<SMSResult> {
  const message = `${title}\n${body}`;
  
  return sendSMS({
    to: phone,
    message: message.substring(0, 160), // Limite SMS standard
  });
}

/**
 * Vérifie si le service SMS est disponible
 */
export async function isSMSServiceAvailable(): Promise<boolean> {
  return hasTwilioCredentials();
}

// Export des utilitaires
export const smsUtils = {
  formatPhoneNumber,
  isValidPhoneNumber,
};
