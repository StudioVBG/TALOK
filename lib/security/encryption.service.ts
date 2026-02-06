/**
 * Service de chiffrement pour les données sensibles
 * 
 * SOTA 2026 - Chiffrement AES-256-GCM
 * ===================================
 * 
 * Ce service gère le chiffrement/déchiffrement des données sensibles :
 * - IBAN des propriétaires
 * - Secrets 2FA
 * - Clés API internes
 * 
 * Le chiffrement utilise AES-256-GCM qui fournit :
 * - Confidentialité (chiffrement)
 * - Intégrité (authentification via tag GCM)
 * - Non-répudiation
 */

import crypto from "crypto";

// Configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Récupère la clé de chiffrement depuis les variables d'environnement
 * En production, utiliser un service de gestion des secrets (Vault, AWS KMS, etc.)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY n'est pas configurée. " +
      "Générez une clé avec: openssl rand -base64 32"
    );
  }
  
  // La clé peut être en base64 ou hex
  const keyBuffer = key.length === 64 
    ? Buffer.from(key, "hex") 
    : Buffer.from(key, "base64");
  
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `Clé de chiffrement invalide. Longueur attendue: ${KEY_LENGTH} bytes, ` +
      `reçue: ${keyBuffer.length} bytes`
    );
  }
  
  return keyBuffer;
}

/**
 * Chiffre une donnée sensible
 * 
 * @param plaintext - Donnée en clair à chiffrer
 * @returns Donnée chiffrée au format: iv:tag:ciphertext (base64)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return "";
  }
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const tag = cipher.getAuthTag();
  
  // Format: iv:tag:ciphertext (tout en base64)
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted}`;
}

/**
 * Déchiffre une donnée sensible
 * 
 * @param ciphertext - Donnée chiffrée au format iv:tag:ciphertext
 * @returns Donnée en clair
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    return "";
  }
  
  // Rejeter les données non chiffrées — jamais de fallback plaintext
  if (!ciphertext.includes(":")) {
    throw new Error(
      "[Encryption] Donnée non chiffrée détectée. " +
      "Les données sensibles doivent être chiffrées avant stockage. " +
      "Lancez une migration pour chiffrer les données existantes."
    );
  }
  
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Format de donnée chiffrée invalide");
  }
  
  const [ivBase64, tagBase64, encryptedData] = parts;
  
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Hash une donnée pour comparaison (sans pouvoir la déchiffrer)
 * Utilisé pour les recherches sur données chiffrées
 * 
 * @param data - Donnée à hasher
 * @returns Hash SHA-256 en hex
 */
export function hash(data: string): string {
  if (!data) {
    return "";
  }
  
  return crypto
    .createHash("sha256")
    .update(data.toLowerCase().replace(/\s/g, ""))
    .digest("hex");
}

/**
 * Génère un hash HMAC pour vérification d'intégrité
 * 
 * @param data - Donnée à signer
 * @returns HMAC-SHA256 en hex
 */
export function hmac(data: string): string {
  if (!data) {
    return "";
  }
  
  const key = getEncryptionKey();
  return crypto
    .createHmac("sha256", key)
    .update(data)
    .digest("hex");
}

/**
 * Vérifie si une donnée est chiffrée
 * 
 * @param data - Donnée à vérifier
 * @returns true si la donnée semble chiffrée
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false;
  
  const parts = data.split(":");
  if (parts.length !== 3) return false;
  
  // Vérifier que chaque partie ressemble à du base64
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  return parts.every((part) => base64Regex.test(part));
}

// ============================================
// FONCTIONS SPÉCIFIQUES IBAN
// ============================================

/**
 * Chiffre un IBAN
 * Stocke aussi un hash pour les recherches
 * 
 * @param iban - IBAN en clair
 * @returns { encrypted, hash, last4 }
 */
export function encryptIBAN(iban: string): {
  encrypted: string;
  hash: string;
  last4: string;
} {
  if (!iban) {
    return { encrypted: "", hash: "", last4: "" };
  }
  
  // Normaliser l'IBAN (majuscules, sans espaces)
  const normalizedIBAN = iban.toUpperCase().replace(/\s/g, "");
  
  return {
    encrypted: encrypt(normalizedIBAN),
    hash: hash(normalizedIBAN),
    last4: normalizedIBAN.slice(-4),
  };
}

/**
 * Déchiffre un IBAN
 * 
 * @param encryptedIBAN - IBAN chiffré
 * @returns IBAN en clair formaté
 */
export function decryptIBAN(encryptedIBAN: string): string {
  const iban = decrypt(encryptedIBAN);
  
  // Formatter l'IBAN avec des espaces tous les 4 caractères
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Masque un IBAN pour affichage
 * Ex: FR76 **** **** **** **** ***1 234
 * 
 * @param iban - IBAN en clair ou chiffré
 * @returns IBAN masqué
 */
export function maskIBAN(iban: string): string {
  if (!iban) return "";
  
  // Si chiffré, déchiffrer d'abord
  const clearIBAN = isEncrypted(iban) ? decrypt(iban) : iban;
  const normalized = clearIBAN.replace(/\s/g, "");
  
  if (normalized.length < 10) return "****";
  
  // Garder les 4 premiers et 4 derniers caractères
  const prefix = normalized.slice(0, 4);
  const suffix = normalized.slice(-4);
  const middleLength = normalized.length - 8;
  const masked = "*".repeat(middleLength);
  
  // Formatter avec espaces
  const full = prefix + masked + suffix;
  return full.replace(/(.{4})/g, "$1 ").trim();
}

// ============================================
// ROTATION DE CLÉ
// ============================================

/**
 * Re-chiffre une donnée avec une nouvelle clé
 * À utiliser lors de la rotation des clés
 * 
 * @param encryptedData - Donnée chiffrée avec l'ancienne clé
 * @param oldKey - Ancienne clé (base64 ou hex)
 * @param newKey - Nouvelle clé (base64 ou hex)
 * @returns Donnée re-chiffrée
 */
export function rotateEncryption(
  encryptedData: string,
  oldKey: string,
  newKey: string
): string {
  // Décrypter avec l'ancienne clé
  const oldKeyBuffer = oldKey.length === 64 
    ? Buffer.from(oldKey, "hex") 
    : Buffer.from(oldKey, "base64");
  
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Format invalide");
  }
  
  const [ivBase64, tagBase64, encrypted] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, oldKeyBuffer, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  // Re-chiffrer avec la nouvelle clé
  const newKeyBuffer = newKey.length === 64 
    ? Buffer.from(newKey, "hex") 
    : Buffer.from(newKey, "base64");
  
  const newIv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, newKeyBuffer, newIv);
  
  let reEncrypted = cipher.update(decrypted, "utf8", "base64");
  reEncrypted += cipher.final("base64");
  
  const newTag = cipher.getAuthTag();
  
  return `${newIv.toString("base64")}:${newTag.toString("base64")}:${reEncrypted}`;
}

// ============================================
// EXPORT
// ============================================

export const encryptionService = {
  encrypt,
  decrypt,
  hash,
  hmac,
  isEncrypted,
  encryptIBAN,
  decryptIBAN,
  maskIBAN,
  rotateEncryption,
};

export default encryptionService;

