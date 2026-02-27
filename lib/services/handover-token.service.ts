/**
 * Service de génération et vérification de tokens pour la remise des clés
 *
 * Le token est un JWT simplifié signé avec HMAC-SHA256.
 * Format : base64url(payload).hmac
 */

import { randomUUID } from "crypto";
import { createHmac } from "crypto";

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "talok-key-handover-secret";
}

export function generateHandoverToken(leaseId: string, expiresAt: string): string {
  const payload = JSON.stringify({ leaseId, expiresAt, nonce: randomUUID() });
  const hmac = createHmac("sha256", getSecret()).update(payload).digest("hex");
  const b64 = Buffer.from(payload).toString("base64url");
  return `${b64}.${hmac}`;
}

export function verifyHandoverToken(token: string): { leaseId: string; expiresAt: string } | null {
  try {
    const [b64, hmac] = token.split(".");
    if (!b64 || !hmac) return null;
    const payload = Buffer.from(b64, "base64url").toString("utf-8");
    const expectedHmac = createHmac("sha256", getSecret()).update(payload).digest("hex");
    if (hmac !== expectedHmac) return null;
    const data = JSON.parse(payload);
    if (new Date(data.expiresAt) < new Date()) return null;
    return { leaseId: data.leaseId, expiresAt: data.expiresAt };
  } catch {
    return null;
  }
}
