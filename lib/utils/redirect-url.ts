/**
 * Utilitaires pour les URLs de redirection Supabase Auth
 * Utilise NEXT_PUBLIC_APP_URL en production, window.location.origin en développement
 */

function isLocalUrl(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

/**
 * Obtenir l'URL de base de l'application
 * Ignore NEXT_PUBLIC_APP_URL si c'est une URL localhost pour éviter
 * que les emails de confirmation/reset pointent vers localhost en production.
 */
export function getBaseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Utiliser la variable d'environnement uniquement si ce n'est pas localhost
  if (appUrl && !isLocalUrl(appUrl)) {
    return appUrl.replace(/\/+$/, "");
  }

  // Côté client, utiliser l'origin réelle du navigateur (toujours correcte)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Fallback production pour les contextes server-side sans env var correcte
  return 'https://talok.fr';
}

/**
 * Obtenir l'URL complète pour le callback d'authentification
 */
export function getAuthCallbackUrl(): string {
  return `${getBaseUrl()}/auth/callback`;
}

/**
 * Obtenir l'URL complète pour la réinitialisation de mot de passe
 */
export function getResetPasswordUrl(): string {
  return `${getBaseUrl()}/auth/reset-password`;
}

/**
 * Obtenir l'URL complète pour la vérification d'email
 */
export function getVerifyEmailUrl(): string {
  return `${getBaseUrl()}/auth/verify-email`;
}
