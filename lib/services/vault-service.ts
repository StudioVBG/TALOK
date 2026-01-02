/**
 * Vault Service - SOTA 2026
 * Gère le chiffrement des données sensibles (IBAN, documents d'identité)
 * En production, ce service devrait utiliser Supabase Vault ou un KMS externe.
 */

import crypto from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || "default-dev-key-32-chars-long-!!!"; // À configurer en prod

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Chiffre une chaîne de caractères
 */
export function encrypt(text: string): EncryptedData {
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(MASTER_KEY, "salt", 32);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag
  };
}

/**
 * Déchiffre une chaîne de caractères
 */
export function decrypt(data: EncryptedData): string {
  const key = crypto.scryptSync(MASTER_KEY, "salt", 32);
  const iv = Buffer.from(data.iv, "hex");
  const authTag = Buffer.from(data.authTag, "hex");
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(data.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Helper pour stocker un IBAN de façon sécurisée (Last 4 visible)
 */
export function secureIBAN(iban: string) {
  const cleaned = iban.replace(/\s/g, "");
  const last4 = cleaned.slice(-4);
  const encrypted = encrypt(cleaned);
  
  // Format pour stockage BDD: "iv:authTag:encrypted"
  return {
    full_encrypted: `${encrypted.iv}:${encrypted.authTag}:${encrypted.encrypted}`,
    last4
  };
}

/**
 * Helper pour restaurer un IBAN
 */
export function restoreIBAN(encryptedString: string): string {
  const [iv, authTag, encrypted] = encryptedString.split(":");
  return decrypt({ iv, authTag, encrypted });
}

