/**
 * Utilitaires de chiffrement pour les clés API
 * Utilise AES-256-GCM pour un chiffrement sécurisé
 */

import crypto from "crypto";

/**
 * Chiffre une clé API avec AES-256-GCM
 */
export function encryptKey(plainKey: string): string {
  const masterKey = process.env.API_KEY_MASTER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "default-key-for-dev-only-32chars!";
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(masterKey, "external-api-salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(plainKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

/**
 * Déchiffre une clé API chiffrée
 */
export function decryptKey(encryptedKey: string): string {
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



