/**
 * TOTP (Time-based One-Time Password) - 2FA SOTA 2026
 * Authentification à deux facteurs via applications comme Google Authenticator
 */

import { authenticator } from "otplib";
import crypto from "crypto";

// Configuration TOTP conforme RFC 6238
authenticator.options = {
  digits: 6,
  step: 30, // 30 secondes
  window: 1, // Tolère 1 période avant/après
};

export interface TOTPSetup {
  secret: string;
  uri: string;
  qrCodeUrl: string;
}

export interface RecoveryCode {
  code: string;
  used: boolean;
  used_at?: string;
}

/**
 * Génère un nouveau secret TOTP pour l'utilisateur
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Génère l'URI otpauth:// pour les apps d'authentification
 */
export function generateTOTPUri(
  secret: string,
  email: string,
  issuer: string = "Talok"
): string {
  return authenticator.keyuri(email, issuer, secret);
}

/**
 * Génère l'URL du QR code via l'API Google Charts
 */
export function generateQRCodeUrl(uri: string): string {
  const encodedUri = encodeURIComponent(uri);
  return `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodedUri}`;
}

/**
 * Configure TOTP pour un utilisateur (génère secret + URI + QR)
 */
export function setupTOTP(email: string): TOTPSetup {
  const secret = generateTOTPSecret();
  const uri = generateTOTPUri(secret, email);
  const qrCodeUrl = generateQRCodeUrl(uri);

  return {
    secret,
    uri,
    qrCodeUrl,
  };
}

/**
 * Vérifie un code TOTP
 */
export function verifyTOTPCode(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Génère des codes de récupération (backup codes)
 */
export function generateRecoveryCodes(count: number = 10): RecoveryCode[] {
  const codes: RecoveryCode[] = [];

  for (let i = 0; i < count; i++) {
    // Format: XXXX-XXXX-XXXX (12 caractères alphanumériques)
    // Utilise crypto.randomBytes pour la sécurité cryptographique
    const code = Array.from({ length: 3 }, () =>
      crypto.randomBytes(3).toString("hex").substring(0, 4).toUpperCase()
    ).join("-");

    codes.push({
      code,
      used: false,
    });
  }

  return codes;
}

/**
 * Vérifie un code de récupération
 */
export function verifyRecoveryCode(
  codes: RecoveryCode[],
  inputCode: string
): { valid: boolean; updatedCodes: RecoveryCode[] } {
  const normalizedInput = inputCode.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const updatedCodes = codes.map((c) => {
    const normalizedCode = c.code.replace(/[^A-Z0-9]/g, "");
    if (normalizedCode === normalizedInput && !c.used) {
      return {
        ...c,
        used: true,
        used_at: new Date().toISOString(),
      };
    }
    return c;
  });

  const valid = updatedCodes.some(
    (c, i) => c.used !== codes[i].used
  );

  return { valid, updatedCodes };
}

/**
 * Compte les codes de récupération restants
 */
export function countRemainingRecoveryCodes(codes: RecoveryCode[]): number {
  return codes.filter((c) => !c.used).length;
}
