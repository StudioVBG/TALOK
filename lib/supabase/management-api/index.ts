/**
 * Export centralisé pour l'API Management de Supabase
 */

import { SupabaseManagementClient } from "./client";

export { SupabaseManagementClient } from "./client";
export * from "./types";

/**
 * Crée une instance du client Management API
 * 
 * @example
 * ```ts
 * import { createManagementClient } from "@/lib/supabase/management-api";
 * 
 * const client = createManagementClient();
 * const projects = await client.listProjects();
 * ```
 */
export function createManagementClient(): SupabaseManagementClient {
  const accessToken = process.env.SUPABASE_MANAGEMENT_API_TOKEN;

  if (!accessToken) {
    throw new Error(
      "SUPABASE_MANAGEMENT_API_TOKEN n'est pas défini dans les variables d'environnement. " +
      "Créez un Personal Access Token (PAT) sur https://app.supabase.com/account/tokens"
    );
  }

  return new SupabaseManagementClient(accessToken);
}

