import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/supabase/database.types";
import { getSupabaseConfig } from "@/lib/supabase/config";

// Singleton pour éviter plusieurs instances GoTrueClient
let supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, anonKey } = getSupabaseConfig();
  supabaseClient = createBrowserClient<Database>(url, anonKey);

  return supabaseClient;
}

