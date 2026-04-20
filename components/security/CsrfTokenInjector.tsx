/**
 * Composant Server pour injecter le token CSRF dans la page
 * 
 * Ce composant doit être placé dans les layouts authentifiés (owner, tenant, admin, etc.)
 * Il génère un token CSRF côté serveur et l'injecte via :
 * - Une meta tag <meta name="csrf-token"> lisible par le JS client
 * - Un cookie HttpOnly pour la double-vérification côté API
 *
 * Côté client, utiliser `fetchWithCsrf()` depuis `@/lib/security/csrf`
 * pour envoyer automatiquement le token dans les requêtes.
 *
 * @module components/security/CsrfTokenInjector
 */

import { cookies } from "next/headers";

/**
 * Génère un token CSRF de manière sûre.
 * Si CSRF_SECRET n'est pas configuré, retourne null (mode dégradé).
 */
async function generateSafeCsrfToken(): Promise<string | null> {
  try {
    const { generateCsrfToken } = await import("@/lib/security/csrf");
    return generateCsrfToken();
  } catch {
    // CSRF_SECRET non configuré — mode dégradé
    if (process.env.NODE_ENV === "development") {
      console.warn("[CsrfTokenInjector] CSRF_SECRET non configuré. Protection CSRF désactivée en dev.");
    }
    return null;
  }
}

export default async function CsrfTokenInjector() {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  // Réutiliser le token existant du cookie s'il est encore valide
  const existingToken = cookieStore.get("csrf_token")?.value ?? null;

  let token: string | null = null;

  if (existingToken) {
    // Vérifier que le token existant est encore valide (signature + expiry)
    try {
      const { validateCsrfToken } = await import("@/lib/security/csrf");
      if (validateCsrfToken(existingToken)) {
        token = existingToken;
      }
    } catch {
      // Validation impossible, on régénère
    }
  }

  if (!token) {
    token = await generateSafeCsrfToken();
    if (!token) return null;

    // Écrire le cookie seulement quand on génère un nouveau token
    try {
      cookieStore.set({
        name: "csrf_token",
        value: token,
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: isProduction,
        maxAge: 24 * 60 * 60, // 24h
      });
    } catch {
      // En Server Component read-only, le set cookie peut échouer silencieusement
    }
  }

  // La meta tag doit TOUJOURS correspondre au cookie
  return (
    <meta name="csrf-token" content={token} />
  );
}
