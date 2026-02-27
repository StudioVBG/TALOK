/**
 * Configuration centralisée Supabase
 * Permet de valider l'environnement une seule fois
 *
 * Note : Pendant `next build` (phase "Collecting page data"), certains modules
 * créent des clients Supabase au top-level (ex: singletons de service).
 * Dans cet environnement, les variables d'env peuvent ne pas être disponibles.
 * On renvoie alors un placeholder pour éviter de casser le build.
 * En production (runtime), les variables seront toujours présentes.
 */

type SupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
};

let cachedConfig: SupabaseConfig | null = null;

/**
 * Détecte si on est dans la phase de build (`next build`) et non au runtime.
 * Pendant le build, `NEXT_PHASE` est défini à "phase-production-build".
 */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function getSupabaseConfig(): SupabaseConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Pendant le build sans env vars, renvoyer un placeholder
  // pour ne pas casser "Collecting page data"
  if (!url || !anonKey) {
    if (isBuildPhase()) {
      return {
        url: url || "https://placeholder.supabase.co",
        anonKey: anonKey || "placeholder-anon-key",
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      };
    }
  }

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







