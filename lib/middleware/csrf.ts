/**
 * CSRF Protection SOTA 2026
 *
 * Double Submit Cookie Pattern + Origin Check
 * Compatible avec Edge Runtime et Node.js
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Utiliser une clé d'environnement, JAMAIS de fallback en production
const CSRF_SECRET = process.env.CSRF_SECRET;

if (!CSRF_SECRET && process.env.NODE_ENV === "production") {
  console.error("CRITICAL: CSRF_SECRET must be set in production!");
}

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32;

/**
 * Génère un token CSRF sécurisé
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Crée un hash HMAC du token pour validation
 */
async function hashToken(token: string): Promise<string> {
  const secret = CSRF_SECRET || "dev-only-not-for-production";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(token)
  );
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Définit le cookie CSRF avec les bonnes options de sécurité
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true, // CRITIQUE: Empêche XSS de lire le cookie
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 heures
  });
}

/**
 * Vérifie l'origin de la requête
 */
function verifyOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Pas d'origin = requête same-origin (OK)
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const expectedHost = host?.split(":")[0];
    return originUrl.hostname === expectedHost ||
           originUrl.hostname === "localhost" ||
           originUrl.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

/**
 * Valide le token CSRF
 */
export async function validateCsrfToken(request: NextRequest): Promise<{
  valid: boolean;
  error?: string;
}> {
  // 1. Vérifier l'origin
  if (!verifyOrigin(request)) {
    return { valid: false, error: "Origin non autorisé" };
  }

  // 2. Méthodes sûres n'ont pas besoin de CSRF
  const safeMethod = ["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (safeMethod) {
    return { valid: true };
  }

  // 3. Récupérer le token du cookie
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!cookieToken) {
    return { valid: false, error: "Token CSRF manquant dans le cookie" };
  }

  // 4. Récupérer le token du header
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!headerToken) {
    return { valid: false, error: "Token CSRF manquant dans le header" };
  }

  // 5. Comparer les hashs (timing-safe)
  try {
    const cookieHash = await hashToken(cookieToken);
    const headerHash = await hashToken(headerToken);

    // Comparaison timing-safe
    if (cookieHash.length !== headerHash.length) {
      return { valid: false, error: "Token CSRF invalide" };
    }

    let match = true;
    for (let i = 0; i < cookieHash.length; i++) {
      if (cookieHash[i] !== headerHash[i]) match = false;
    }

    if (!match) {
      return { valid: false, error: "Token CSRF invalide" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Erreur de validation CSRF" };
  }
}

/**
 * Middleware CSRF pour les routes API
 * Retourne null si OK, NextResponse si erreur
 */
export async function withCsrfProtection(
  request: NextRequest
): Promise<NextResponse | null> {
  const result = await validateCsrfToken(request);

  if (!result.valid) {
    return NextResponse.json(
      { error: result.error, code: "CSRF_ERROR" },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Route handler pour obtenir un nouveau token CSRF
 * GET /api/csrf - Retourne un nouveau token
 */
export async function getCsrfTokenHandler(): Promise<NextResponse> {
  const token = generateCsrfToken();
  const response = NextResponse.json({ token });
  setCsrfCookie(response, token);
  return response;
}
