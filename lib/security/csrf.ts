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

/**
 * Middleware de validation CSRF pour les API routes
 * À utiliser pour les routes sensibles (POST, PUT, DELETE)
 */
export async function validateCsrfFromRequest(request: Request): Promise<boolean> {
  // Les requêtes GET sont safe
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return true;
  }

  // Récupérer le token du header
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  
  // Récupérer le token du cookie
  const cookieHeader = request.headers.get("cookie");
  const cookieToken = cookieHeader
    ?.split(";")
    .find((c) => c.trim().startsWith(`${CSRF_COOKIE_NAME}=`))
    ?.split("=")[1]
    ?.trim();

  // Les deux tokens doivent être présents et correspondre
  if (!headerToken || !cookieToken) {
    return false;
  }

  if (headerToken !== cookieToken) {
    return false;
  }

  return validateCsrfToken(headerToken);
}

/**
 * Crée une réponse avec le token CSRF en cookie
 */
export function setCsrfCookie(response: Response): Response {
  const token = generateCsrfToken();
  
  // Clone la réponse pour pouvoir modifier les headers
  const newResponse = new Response(response.body, response);
  
  newResponse.headers.set(
    "Set-Cookie",
    `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly=false; SameSite=Strict; Max-Age=${Math.floor(TOKEN_EXPIRY_MS / 1000)}`
  );
  
  return newResponse;
}

/**
 * Helper pour obtenir le token CSRF côté client
 */
export function getClientCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  
  const match = document.cookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
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
  setCsrfCookie,
  getClientCsrfToken,
  fetchWithCsrf,
  withCsrfProtection,
};


