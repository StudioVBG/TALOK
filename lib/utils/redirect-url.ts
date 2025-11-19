/**
 * Utilitaires pour les URLs de redirection Supabase Auth
 * Utilise NEXT_PUBLIC_APP_URL en production, window.location.origin en développement
 */

/**
 * Obtenir l'URL de base de l'application
 */
export function getBaseUrl(): string {
  // En production, utiliser la variable d'environnement
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // En développement, utiliser window.location.origin si disponible
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Fallback pour les contextes server-side
  return 'http://localhost:3000';
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
