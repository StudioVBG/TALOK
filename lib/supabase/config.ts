/**
 * Configuration centralisée Supabase
 * Permet de valider l'environnement une seule fois
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

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL n'est pas défini");
  }

  if (url.includes("supabase.com/dashboard") || !url.includes(".supabase.co")) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL invalide: ${url}. Utilisez l'URL d'API (…supabase.co)`
    );
  }

  if (!anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY n'est pas défini");
  }

  cachedConfig = {
    url,
    anonKey,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  return cachedConfig;
}







