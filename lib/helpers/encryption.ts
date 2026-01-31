/**
 * Utilitaires de chiffrement pour les clés API
 * Utilise AES-256-GCM pour un chiffrement sécurisé
 *
 * @module lib/helpers/encryption
 * @security CRITICAL - Ne jamais utiliser de clé par défaut
 */

import crypto from "crypto";

/**
 * Récupère la clé maître de chiffrement
 * @throws Error si la clé n'est pas configurée ou trop courte
 */
function getMasterKey(): string {
  const masterKey = process.env.API_KEY_MASTER_KEY;

  if (!masterKey) {
    const errorMsg =
      "[CRITICAL] API_KEY_MASTER_KEY is required for encryption. " +
      "Set this environment variable with a secure 32+ character secret.";

    if (process.env.NODE_ENV === "production") {
      throw new Error(errorMsg);
    }

    console.error(errorMsg);
    throw new Error("Encryption not available: missing API_KEY_MASTER_KEY");
  }

  if (masterKey.length < 32) {
    throw new Error(
      `[CRITICAL] API_KEY_MASTER_KEY must be at least 32 characters (got ${masterKey.length})`
    );
  }

  return masterKey;
}

/**
 * Chiffre une clé API avec AES-256-GCM
 * @param plainKey - La clé en clair à chiffrer
 * @returns La clé chiffrée au format iv:authTag:encrypted
 * @throws Error si la clé maître n'est pas configurée
 */
export function encryptKey(plainKey: string): string {
  const masterKey = getMasterKey();
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
 * @param encryptedKey - La clé chiffrée au format iv:authTag:encrypted
 * @returns La clé déchiffrée en clair
 * @throws Error si la clé maître n'est pas configurée ou le format est invalide
 */
export function decryptKey(encryptedKey: string): string {
  const masterKey = getMasterKey();
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



