/**
 * Protection CSRF (Cross-Site Request Forgery)
 * Génère et valide des tokens pour les actions sensibles
 *
 * @module lib/security/csrf
 * @security CRITICAL - Ne jamais utiliser de secret par défaut
 */

import { cookies } from "next/headers";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";

/**
 * Récupère le secret CSRF
 * @throws Error si le secret n'est pas configuré ou trop court
 */
function getCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET;

  if (!secret) {
    const errorMsg =
      "[CRITICAL] CSRF_SECRET is required. " +
      "Set this environment variable with a secure 32+ character secret.";

    if (process.env.NODE_ENV === "production") {
      throw new Error(errorMsg);
    }

    console.error(errorMsg);
    throw new Error("CSRF protection not available: missing CSRF_SECRET");
  }

  if (secret.length < 32) {
    throw new Error(
      `[CRITICAL] CSRF_SECRET must be at least 32 characters (got ${secret.length})`
    );
  }

  return secret;
}
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const TOKEN_LENGTH = 32;
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 heures

interface CsrfToken {
  value: string;
  expiry: number;
}

/**
 * Génère un token CSRF sécurisé
 * @returns Token au format value:expiry:signature
 * @throws Error si le secret n'est pas configuré
 */
export function generateCsrfToken(): string {
  const secret = getCsrfSecret();
  const token = randomBytes(TOKEN_LENGTH).toString("hex");
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  const data = `${token}:${expiry}`;
  const signature = createHmac("sha256", secret).update(data).digest("hex");
  return `${data}:${signature}`;
}

/**
 * Valide un token CSRF avec timing-safe comparison
 * @param token - Le token à valider
 * @returns true si le token est valide
 */
export function validateCsrfToken(token: string | null): boolean {
  if (!token) return false;

  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [value, expiryStr, signature] = parts;
  const expiry = parseInt(expiryStr, 10);

  // Vérifier l'expiration
  if (isNaN(expiry) || expiry < Date.now()) {
    return false;
  }

  // Vérifier la signature avec timing-safe comparison
  try {
    const secret = getCsrfSecret();
    const data = `${value}:${expiryStr}`;
    const expectedSignature = createHmac("sha256", secret).update(data).digest("hex");

    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export type CsrfFailureReason =
  | "missing_header"
  | "invalid_signature_or_expired"
  | "cookie_mismatch";

export interface CsrfValidationResult {
  valid: boolean;
  reason?: CsrfFailureReason;
}

/**
 * Variante détaillée : renvoie la raison précise d'un échec, pour permettre
 * aux route handlers (ou au HOC `withSecurity`) de logger via Sentry.
 */
export async function validateCsrfFromRequestDetailed(
  request: Request
): Promise<CsrfValidationResult> {
  // Les requêtes GET sont safe
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return { valid: true };
  }

  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!headerToken) {
    return { valid: false, reason: "missing_header" };
  }

  if (!validateCsrfToken(headerToken)) {
    return { valid: false, reason: "invalid_signature_or_expired" };
  }

  // Defense-in-depth : si le cookie est présent et diffère du header, on
  // rejette. Le cookie peut être absent si `cookies().set()` depuis un Server
  // Component a échoué silencieusement — dans ce cas on retombe sur la seule
  // vérif HMAC+expiry du header (suffisante en same-origin).
  const cookieHeader = request.headers.get("cookie");
  const cookieToken = cookieHeader
    ?.split(";")
    .find((c) => c.trim().startsWith(`${CSRF_COOKIE_NAME}=`))
    ?.split("=")[1]
    ?.trim();

  if (cookieToken && cookieToken !== headerToken) {
    return { valid: false, reason: "cookie_mismatch" };
  }

  return { valid: true };
}

/**
 * Middleware de validation CSRF pour les API routes
 * À utiliser pour les routes sensibles (POST, PUT, DELETE)
 */
export async function validateCsrfFromRequest(request: Request): Promise<boolean> {
  const result = await validateCsrfFromRequestDetailed(request);
  return result.valid;
}

/**
 * Logue un échec CSRF via Sentry + console (format JSON structuré).
 * À appeler côté route handler lorsque `validateCsrfFromRequestDetailed`
 * renvoie `valid: false`.
 */
export async function logCsrfFailure(
  request: Request,
  reason: CsrfFailureReason,
  endpoint: string
): Promise<void> {
  const payload = {
    level: "warn",
    type: "csrf_violation",
    endpoint,
    reason,
    method: request.method,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    timestamp: new Date().toISOString(),
  };
  console.warn(JSON.stringify(payload));
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage(`CSRF rejected: ${reason}`, {
      level: "warning",
      tags: { type: "csrf_violation", endpoint, reason },
      extra: payload,
    });
  } catch {
    // Sentry indisponible — le console.warn suffit.
  }
}

/**
 * Crée une réponse avec le token CSRF en cookie
 */
export function setCsrfCookie(response: Response): Response {
  const token = generateCsrfToken();
  
  // Clone la réponse pour pouvoir modifier les headers
  const newResponse = new Response(response.body, response);
  
  const isProduction = process.env.NODE_ENV === "production";
  newResponse.headers.set(
    "Set-Cookie",
    `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict${isProduction ? "; Secure" : ""}; Max-Age=${Math.floor(TOKEN_EXPIRY_MS / 1000)}`
  );
  // Expose token via custom header so client can read it without cookie access
  newResponse.headers.set("X-CSRF-Token", token);
  
  return newResponse;
}

/**
 * Helper pour obtenir le token CSRF côté client.
 * Le token est lu depuis une meta tag injectée par le serveur,
 * car le cookie est HttpOnly et inaccessible via JavaScript.
 */
export function getClientCsrfToken(): string | null {
  if (typeof document === "undefined") return null;

  // Lire depuis la meta tag injectée par le layout serveur
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute("content") ?? null;
}

/**
 * Wrapper pour fetch avec CSRF token automatique
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getClientCsrfToken();
  
  const headers = new Headers(options.headers);
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
}

/**
 * HOC pour protéger une route API avec CSRF
 */
export function withCsrfProtection(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const isValid = await validateCsrfFromRequest(request);
    
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid CSRF token" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    return handler(request);
  };
}

export default {
  generateCsrfToken,
  validateCsrfToken,
  validateCsrfFromRequest,
  validateCsrfFromRequestDetailed,
  logCsrfFailure,
  setCsrfCookie,
  getClientCsrfToken,
  fetchWithCsrf,
  withCsrfProtection,
};


