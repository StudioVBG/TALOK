/**
 * Configuration centralisée Supabase
 * Permet de valider l'environnement une seule fois
 *
 * Build-safe : pendant `next build`, les variables d'environnement
 * peuvent ne pas être disponibles (phase "Collecting page data").
 * On retourne des valeurs placeholder qui ne seront jamais utilisées
 * en production (les vraies valeurs sont injectées par Netlify au runtime).
 */

type SupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
};

let cachedConfig: SupabaseConfig | null = null;

/** Placeholder renvoyé pendant le build quand les env vars sont absentes */
const BUILD_PLACEHOLDER: SupabaseConfig = {
  url: "https://placeholder.supabase.co",
  anonKey: "placeholder-anon-key",
};

export function getSupabaseConfig(): SupabaseConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Pendant le build Next.js, les env vars runtime ne sont pas toujours
  // disponibles. On renvoie un placeholder sans le mettre en cache
  // pour que le runtime réévalue avec les vraies valeurs.
  if (!url || !anonKey) {
    return BUILD_PLACEHOLDER;
  }

  if (url.includes("supabase.com/dashboard") || !url.includes(".supabase.co")) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL invalide: ${url}. Utilisez l'URL d'API (…supabase.co)`
    );
  }

  cachedConfig = {
    url,
    anonKey,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  return cachedConfig;
}







