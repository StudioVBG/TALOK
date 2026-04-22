/**
 * Composant Server pour injecter le token CSRF dans la page
 *
 * Ce composant doit être placé dans les layouts authentifiés (owner, tenant, admin, etc.)
 * Il réutilise le cookie `csrf_token` existant s'il est toujours valide, et n'en
 * génère un nouveau (+ set cookie) que s'il est absent ou expiré. Cette
 * idempotence évite la divergence meta ↔ cookie sur soft nav / RSC prefetch
 * (où `cookies().set()` depuis un Server Component est non fiable).
 *
 * Côté client, utiliser `fetchWithCsrf()` depuis `@/lib/security/csrf`
 * pour envoyer automatiquement le token dans les requêtes.
 *
 * @module components/security/CsrfTokenInjector
 */

import { cookies } from "next/headers";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

async function resolveCsrfToken(): Promise<string | null> {
  try {
    const { generateCsrfToken, validateCsrfToken } = await import("@/lib/security/csrf");

    const cookieStore = await cookies();
    const existing = cookieStore.get(CSRF_COOKIE_NAME)?.value;

    // Réutiliser le cookie existant s'il est valide (HMAC + expiry) : meta et
    // cookie restent en phase entre soft navs.
    if (existing && validateCsrfToken(existing)) {
      return existing;
    }

    const fresh = generateCsrfToken();
    const isProduction = process.env.NODE_ENV === "production";
    try {
      cookieStore.set({
        name: CSRF_COOKIE_NAME,
        value: fresh,
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: isProduction,
        maxAge: CSRF_COOKIE_MAX_AGE_SECONDS,
      });
    } catch {
      // Server Component en lecture seule : la pose du cookie peut échouer.
      // La validation côté API retombe sur un check HMAC-only si le cookie
      // est absent (cf. lib/security/csrf.ts).
    }
    return fresh;
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn("[CsrfTokenInjector] CSRF_SECRET non configuré. Protection CSRF désactivée en dev.");
    }
    return null;
  }
}

export default async function CsrfTokenInjector() {
  const token = await resolveCsrfToken();
  if (!token) return null;
  return <meta name="csrf-token" content={token} />;
}
