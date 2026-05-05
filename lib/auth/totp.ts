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
 * Configure TOTP pour un utilisateur (génère secret + URI otpauth://).
 * Le QR code est généré côté serveur dans la route /api/auth/2fa/setup
 * via lib/qr/generator.ts (logo Talok au centre).
 */
export function setupTOTP(email: string): TOTPSetup {
  const secret = generateTOTPSecret();
  const uri = generateTOTPUri(secret, email);

  return {
    secret,
    uri,
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
 * Génère des codes de récupération en clair (à montrer une fois à l'utilisateur).
 * Le stockage DB se fait via la fonction SQL `hash_2fa_recovery_codes` qui
 * applique bcrypt — les codes en clair ne doivent JAMAIS être persistés.
 */
export function generatePlainRecoveryCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Format: XXXX-XXXX-XXXX (12 caractères alphanumériques)
    const code = Array.from({ length: 3 }, () =>
      crypto.randomBytes(3).toString("hex").substring(0, 4).toUpperCase()
    ).join("-");
    codes.push(code);
  }
  return codes;
}

/**
 * Compte les codes de récupération non utilisés. Compatible avec l'ancien format
 * ({ code, used }) ET le nouveau format hashé ({ code_hash, used }).
 */
export function countRemainingRecoveryCodes(
  codes: Array<{ code?: string; code_hash?: string; used?: boolean }> | null | undefined
): number {
  if (!Array.isArray(codes)) return 0;
  return codes.filter((c) => !c?.used).length;
}
