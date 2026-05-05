/**
 * QR session token : HMAC signing/verification
 *
 * Token = base64url(payload) + "." + hex(hmac_sha256(payload))
 * Le payload contient { sessionId, kind, expiresAt, nonce } pour permettre
 * la validation rapide côté serveur sans round-trip DB.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const isProduction = process.env.NODE_ENV === "production";
let warned = false;

export function getQRSessionSecret(): string {
  const secret = process.env.QR_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (isProduction) {
    throw new Error(
      "[CRITICAL] QR_SESSION_SECRET is required in production (min 32 chars). " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  if (!warned) {
    console.warn(
      "[qr-session] QR_SESSION_SECRET non configuré — utilisation d'un secret de développement. " +
        "Configure-le pour la prod : openssl rand -hex 32"
    );
    warned = true;
  }
  return "dev-only-qr-session-secret-do-not-use-in-production-32chars!!";
}

export interface QRSessionTokenPayload {
  sessionId: string;
  kind: string;
  expiresAt: string; // ISO 8601
  nonce: string;
}

export function signQRSessionToken(input: Omit<QRSessionTokenPayload, "nonce">): string {
  const payload: QRSessionTokenPayload = {
    ...input,
    nonce: randomBytes(8).toString("hex"),
  };
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  const hmac = createHmac("sha256", getQRSessionSecret()).update(json).digest("hex");
  return `${b64}.${hmac}`;
}

export function verifyQRSessionToken(token: string): QRSessionTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64, providedHmac] = parts;

  let json: string;
  try {
    json = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedHmac = createHmac("sha256", getQRSessionSecret()).update(json).digest("hex");

  // timing-safe compare
  const a = Buffer.from(providedHmac, "hex");
  const b = Buffer.from(expectedHmac, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: QRSessionTokenPayload;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  if (!payload.sessionId || !payload.kind || !payload.expiresAt || !payload.nonce) return null;

  if (new Date(payload.expiresAt).getTime() < Date.now()) return null;

  return payload;
}
