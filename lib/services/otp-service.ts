/**
 * Service de gestion des codes OTP (One-Time Password)
 * Utilisé pour la vérification par SMS lors des signatures électroniques
 */

import { createClient } from "@/lib/supabase/server";
import { sendOTPSMS, type SMSResult } from "./sms.service";
import { logger } from "@/lib/monitoring";
import crypto from "crypto";

// Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const COOLDOWN_SECONDS = 60; // Délai entre deux envois

export interface OtpGenerationResult {
  success: boolean;
  message: string;
  expiresAt?: Date;
  cooldownRemaining?: number;
}

export interface OtpValidationResult {
  success: boolean;
  message: string;
  attemptsRemaining?: number;
}

/**
 * Génère un code OTP aléatoire
 */
function generateOtpCode(): string {
  // Utiliser crypto pour une génération sécurisée
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0);
  const code = (num % Math.pow(10, OTP_LENGTH)).toString().padStart(OTP_LENGTH, "0");
  return code;
}

/**
 * Hash un code OTP pour le stockage
 */
function hashOtp(code: string, salt: string): string {
  return crypto.pbkdf2Sync(code, salt, 10000, 32, "sha256").toString("hex");
}

/**
 * Génère et envoie un code OTP par SMS
 */
export async function sendOtp(
  phoneNumber: string,
  context: { leaseId: string; userId?: string; purpose?: string }
): Promise<OtpGenerationResult> {
  try {
    const supabase = await createClient();

    // Vérifier le cooldown
    const { data: recentOtp } = await supabase
      .from("otp_codes")
      .select("created_at")
      .eq("phone_number", phoneNumber)
      .eq("lease_id", context.leaseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recentOtp) {
      const createdAt = new Date(recentOtp.created_at);
      const cooldownEnd = new Date(createdAt.getTime() + COOLDOWN_SECONDS * 1000);
      
      if (cooldownEnd > new Date()) {
        const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
        return {
          success: false,
          message: `Veuillez attendre ${remaining} secondes avant de demander un nouveau code.`,
          cooldownRemaining: remaining,
        };
      }
    }

    // Générer le code
    const code = generateOtpCode();
    const salt = crypto.randomBytes(16).toString("hex");
    const hashedCode = hashOtp(code, salt);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalider les anciens codes
    await supabase
      .from("otp_codes")
      .update({ is_used: true })
      .eq("phone_number", phoneNumber)
      .eq("lease_id", context.leaseId)
      .eq("is_used", false);

    // Stocker le nouveau code
    const { error: insertError } = await supabase.from("otp_codes").insert({
      phone_number: phoneNumber,
      lease_id: context.leaseId,
      user_id: context.userId,
      purpose: context.purpose || "signature",
      code_hash: hashedCode,
      salt,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      is_used: false,
    });

    if (insertError) {
      logger.error("Failed to store OTP", { error: insertError });
      return {
        success: false,
        message: "Erreur lors de la génération du code.",
      };
    }

    // Envoyer le SMS
    const smsResult = await sendOTPSMS(phoneNumber, code);

    if (!smsResult.success) {
      logger.error("Failed to send OTP SMS", { error: smsResult.error });
      return {
        success: false,
        message: smsResult.error || "Erreur lors de l'envoi du SMS.",
      };
    }

    logger.info("OTP sent successfully", {
      phoneNumber: phoneNumber.slice(0, 6) + "****",
      leaseId: context.leaseId,
      simulated: smsResult.simulated,
    });

    return {
      success: true,
      message: smsResult.simulated
        ? `Code de test : ${code} (mode développement)`
        : "Un code de vérification a été envoyé par SMS.",
      expiresAt,
    };
  } catch (error) {
    logger.error("OTP generation failed", { error });
    return {
      success: false,
      message: "Une erreur est survenue.",
    };
  }
}

/**
 * Valide un code OTP
 */
export async function validateOtp(
  phoneNumber: string,
  code: string,
  leaseId: string
): Promise<OtpValidationResult> {
  try {
    const supabase = await createClient();

    // Récupérer le code actif
    const { data: otpRecord, error } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone_number", phoneNumber)
      .eq("lease_id", leaseId)
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !otpRecord) {
      return {
        success: false,
        message: "Code expiré ou invalide. Veuillez demander un nouveau code.",
      };
    }

    // Vérifier le nombre de tentatives
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      // Marquer comme utilisé (bloqué)
      await supabase
        .from("otp_codes")
        .update({ is_used: true })
        .eq("id", otpRecord.id);

      return {
        success: false,
        message: "Nombre maximal de tentatives atteint. Demandez un nouveau code.",
        attemptsRemaining: 0,
      };
    }

    // Vérifier le code
    const hashedInput = hashOtp(code, otpRecord.salt);
    const isValid = hashedInput === otpRecord.code_hash;

    // Incrémenter les tentatives
    await supabase
      .from("otp_codes")
      .update({ 
        attempts: otpRecord.attempts + 1,
        is_used: isValid, // Marquer comme utilisé si valide
      })
      .eq("id", otpRecord.id);

    if (!isValid) {
      const remaining = MAX_ATTEMPTS - (otpRecord.attempts + 1);
      return {
        success: false,
        message: `Code incorrect. ${remaining} tentative(s) restante(s).`,
        attemptsRemaining: remaining,
      };
    }

    logger.info("OTP validated successfully", {
      phoneNumber: phoneNumber.slice(0, 6) + "****",
      leaseId,
    });

    return {
      success: true,
      message: "Code vérifié avec succès.",
    };
  } catch (error) {
    logger.error("OTP validation failed", { error });
    return {
      success: false,
      message: "Une erreur est survenue lors de la vérification.",
    };
  }
}

/**
 * Vérifie si un numéro de téléphone est valide
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Format français ou international
  const cleaned = phone.replace(/[\s\-\.\(\)]/g, "");
  const frenchPattern = /^(0|\+33)[1-9]\d{8}$/;
  const internationalPattern = /^\+\d{10,15}$/;
  
  return frenchPattern.test(cleaned) || internationalPattern.test(cleaned);
}

export default { sendOtp, validateOtp, isValidPhoneNumber };

