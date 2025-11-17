import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/supabase/database.types";

// Singleton pour éviter plusieurs instances GoTrueClient
let supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  // Réutiliser l'instance existante si elle existe
  if (supabaseClient) {
    return supabaseClient;
  }

  // Validation de l'URL Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Please configure it in your environment variables."
    );
  }

  // Détecter les URLs incorrectes (dashboard Supabase au lieu de l'API)
  if (supabaseUrl.includes("supabase.com/dashboard") || supabaseUrl.includes("/settings/api-keys")) {
    throw new Error(
      `Invalid NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}". ` +
      `It should be your Supabase API URL (e.g., https://xxxxx.supabase.co), ` +
      `not the dashboard URL. Get it from: Supabase Dashboard → Settings → API → Project URL`
    );
  }

  // Validation de la clé
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Please configure it in your environment variables."
    );
  }

  // Créer une nouvelle instance uniquement si elle n'existe pas
  supabaseClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

  return supabaseClient;
}

