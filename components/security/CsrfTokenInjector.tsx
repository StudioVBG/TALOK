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
  const token = await generateSafeCsrfToken();
  
  if (!token) {
    return null;
  }

  // Injecter le cookie CSRF (HttpOnly, SameSite=Strict)
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  
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

  // Injecter la meta tag pour que le JS client puisse lire le token
  return (
    <meta name="csrf-token" content={token} />
  );
}
