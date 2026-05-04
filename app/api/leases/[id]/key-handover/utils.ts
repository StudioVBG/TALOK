import { createHmac, timingSafeEqual } from "crypto";
import { getKeyHandoverSecret } from "./secret";

/**
 * Vérifie et décode un token de remise des clés.
 * Retourne les données décodées si le token est valide, sinon null.
 */
export function verifyHandoverToken(token: string): { leaseId: string; expiresAt: string } | null {
  try {
    const [b64, hmac] = token.split(".");
    if (!b64 || !hmac) return null;
    const payload = Buffer.from(b64, "base64url").toString("utf-8");
    const expectedHmac = createHmac("sha256", getKeyHandoverSecret()).update(payload).digest("hex");

    const received = Buffer.from(hmac, "hex");
    const expected = Buffer.from(expectedHmac, "hex");
    if (received.length !== expected.length) return null;
    if (!timingSafeEqual(received, expected)) return null;

    const data = JSON.parse(payload);
    if (new Date(data.expiresAt) < new Date()) return null;
    return { leaseId: data.leaseId, expiresAt: data.expiresAt };
  } catch {
    return null;
  }
}
