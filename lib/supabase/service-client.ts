/**
 * Client Supabase avec Service Role
 * Bypass les RLS policies - À UTILISER UNIQUEMENT CÔTÉ SERVEUR
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseConfig } from "./config";

let serviceClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Retourne un client Supabase avec le service role key
 * Ce client bypass toutes les RLS policies
 * À utiliser uniquement côté serveur pour les opérations qui nécessitent un accès complet
 */
// Alias pour compatibilité
export const createServiceRoleClient = () => getServiceClient();

export function getServiceClient() {
  if (serviceClient) {
    return serviceClient;
  }

  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY n'est pas défini. Ce client ne peut être utilisé que côté serveur."
    );
  }

  serviceClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serviceClient;
}

