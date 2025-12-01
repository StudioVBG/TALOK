/**
 * Protection CSRF (Cross-Site Request Forgery)
 * Génère et valide des tokens pour les actions sensibles
 */

import { cookies } from "next/headers";
import { randomBytes, createHmac } from "crypto";

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";
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
 */
export function generateCsrfToken(): string {
  const token = randomBytes(TOKEN_LENGTH).toString("hex");
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  const data = `${token}:${expiry}`;
  const signature = createHmac("sha256", CSRF_SECRET).update(data).digest("hex");
  return `${data}:${signature}`;
}

/**
 * Valide un token CSRF
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

  // Vérifier la signature
  const data = `${value}:${expiryStr}`;
  const expectedSignature = createHmac("sha256", CSRF_SECRET).update(data).digest("hex");

  // Comparaison constante pour éviter les timing attacks
  if (signature.length !== expectedSignature.length) return false;
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  
  return result === 0;
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


