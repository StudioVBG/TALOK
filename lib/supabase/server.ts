import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseConfig } from "@/lib/supabase/config";

/**
 * Crée un client Supabase pour les Server Components et Route Handlers.
 * RÈGLE SOTA : Pas d'appel à cookies() au top-level.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Ignoré si appelé depuis un Server Component (lecture seule)
          }
        },
        remove(name: string, options?: any) {
          try {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          } catch {
            // Ignoré
          }
        },
      },
    }
  );
}

// Re-export du service client pour les opérations administratives
export { createServiceRoleClient } from "./service-client";

// Alias pour compatibilité descendante
export { createClient as createServerClient };
export const createRouteHandlerClient = async () => createClient();
