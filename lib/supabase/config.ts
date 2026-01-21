/**
 * Configuration centralisée Supabase
 * Permet de valider l'environnement une seule fois
 *
 * Note: En mode build (sans variables d'env), retourne des valeurs factices
 * pour permettre la compilation. Les vraies valeurs sont utilisées au runtime.
 */

type SupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
};

let cachedConfig: SupabaseConfig | null = null;

export function getSupabaseConfig(): SupabaseConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Pendant le build sans variables d'env, retourner des valeurs factices
  if (!url || !anonKey) {
    // Retourne des valeurs factices pour le build statique
    // Les vraies valeurs seront utilisées au runtime
    return {
      url: "https://placeholder.supabase.co",
      anonKey: "placeholder-anon-key",
      serviceRoleKey: undefined,
    };
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







