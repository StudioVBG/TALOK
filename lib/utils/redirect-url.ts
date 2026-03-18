/**
 * Utilitaires pour les URLs de redirection Supabase Auth.
 * Normalise la base d'application pour éviter les config du type https://domaine/auth.
 */

function normalizeUrl(rawUrl: string): string {
  const trimmedUrl = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;
  const url = new URL(withProtocol);

  // Les liens d'auth sont servis à la racine de l'app, pas sous /auth.
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (url.pathname === "/auth") {
    url.pathname = "";
  }

  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

/**
 * Obtenir l'URL de base de l'application.
 */
export function getBaseUrl(overrideUrl?: string): string {
  const rawUrl =
    overrideUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  return normalizeUrl(rawUrl);
}

/**
 * Obtenir l'URL complète pour le callback d'authentification.
 */
export function getAuthCallbackUrl(overrideUrl?: string): string {
  return `${getBaseUrl(overrideUrl)}/auth/callback`;
}

/**
 * Obtenir l'URL de callback utilisée par le recovery de mot de passe.
 */
export function getPasswordRecoveryCallbackUrl(overrideUrl?: string): string {
  return `${getAuthCallbackUrl(overrideUrl)}?next=${encodeURIComponent("/auth/reset-password")}`;
}

/**
 * Obtenir l'URL complète pour la réinitialisation de mot de passe.
 */
export function getResetPasswordUrl(overrideUrl?: string): string {
  return `${getBaseUrl(overrideUrl)}/auth/reset-password`;
}

/**
 * Obtenir l'URL complète pour la vérification d'email.
 */
export function getVerifyEmailUrl(overrideUrl?: string): string {
  return `${getBaseUrl(overrideUrl)}/auth/verify-email`;
}
