/**
 * Génération et vérification de tokens sécurisés pour les invitations de signature.
 *
 * Remplace le format précédent (base64url de leaseId:email:timestamp)
 * par un token signé via HMAC-SHA256 pour empêcher la forge.
 *
 * Format du token : base64url( payload_json + "." + hmac_hex )
 *
 * @module lib/utils/secure-token
 */

import { createHmac } from "crypto";

// Clé secrète pour signer les tokens — DOIT être configurée en env
function getTokenSecret(): string {
  const secret = process.env.SIGNATURE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // Fallback pour ne pas casser en dev, mais log un avertissement
    console.warn(
      "[secure-token] ⚠️ SIGNATURE_TOKEN_SECRET non configuré. Utilisation d'une clé par défaut (NON SÉCURISÉ EN PRODUCTION)."
    );
    return "dev-fallback-secret-do-not-use-in-production";
  }
  return secret;
}

export interface TokenPayload {
  /** ID du bail ou de l'EDL */
  entityId: string;
  /** Type d'entité (lease, edl) */
  entityType: "lease" | "edl";
  /** Email du signataire invité */
  email: string;
  /** Timestamp de création (ms) */
  createdAt: number;
  /** Durée de validité en jours */
  expirationDays: number;
}

/**
 * Génère un token sécurisé signé HMAC-SHA256.
 */
export function generateSecureToken(payload: Omit<TokenPayload, "createdAt"> & { createdAt?: number }): string {
  const fullPayload: TokenPayload = {
    ...payload,
    createdAt: payload.createdAt ?? Date.now(),
  };

  const payloadJson = JSON.stringify(fullPayload);
  const hmac = createHmac("sha256", getTokenSecret()).update(payloadJson).digest("hex");

  // Combiner payload + signature
  const combined = `${payloadJson}.${hmac}`;
  return Buffer.from(combined).toString("base64url");
}

/**
 * Vérifie et décode un token sécurisé.
 * Retourne null si invalide ou expiré.
 */
export function verifySecureToken(token: string): TokenPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const lastDotIndex = decoded.lastIndexOf(".");
    if (lastDotIndex === -1) return null;

    const payloadJson = decoded.substring(0, lastDotIndex);
    const receivedHmac = decoded.substring(lastDotIndex + 1);

    // Vérifier la signature HMAC
    const expectedHmac = createHmac("sha256", getTokenSecret()).update(payloadJson).digest("hex");

    // Comparaison à temps constant pour éviter les timing attacks
    if (receivedHmac.length !== expectedHmac.length) return null;
    let mismatch = 0;
    for (let i = 0; i < receivedHmac.length; i++) {
      mismatch |= receivedHmac.charCodeAt(i) ^ expectedHmac.charCodeAt(i);
    }
    if (mismatch !== 0) return null;

    const payload: TokenPayload = JSON.parse(payloadJson);

    // Vérifier l'expiration
    const expirationMs = payload.expirationDays * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.createdAt > expirationMs) {
      return null; // Expiré
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Rétrocompatibilité : décoder un ancien token (format leaseId:email:timestamp).
 * Retourne null si le format ne correspond pas.
 */
export function decodeLegacyToken(token: string): { leaseId: string; tenantEmail: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [leaseId, tenantEmail, timestampStr] = decoded.split(":");
    if (!leaseId || !tenantEmail || !timestampStr) return null;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return null;
    return { leaseId, tenantEmail, timestamp };
  } catch {
    return null;
  }
}

/**
 * Vérifie un token (nouveau format OU ancien format).
 * Retourne les données normalisées ou null si invalide/expiré.
 *
 * @param expirationDays - Durée de validité pour les anciens tokens (30 jours par défaut)
 */
export function verifyTokenCompat(
  token: string,
  expirationDays: number = 30
): { entityId: string; email: string; entityType: "lease" | "edl"; createdAt: number } | null {
  // Essayer d'abord le nouveau format
  const newPayload = verifySecureToken(token);
  if (newPayload) {
    return {
      entityId: newPayload.entityId,
      email: newPayload.email,
      entityType: newPayload.entityType,
      createdAt: newPayload.createdAt,
    };
  }

  // Fallback sur l'ancien format
  const legacy = decodeLegacyToken(token);
  if (legacy) {
    // Vérifier expiration
    if (Date.now() - legacy.timestamp > expirationDays * 24 * 60 * 60 * 1000) {
      return null;
    }
    return {
      entityId: legacy.leaseId,
      email: legacy.tenantEmail,
      entityType: "lease",
      createdAt: legacy.timestamp,
    };
  }

  return null;
}
