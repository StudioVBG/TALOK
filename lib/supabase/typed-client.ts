/**
 * Client Supabase typé avec les types générés depuis la BDD
 *
 * Utilise les types Database générés via MCP Supabase
 * pour une connexion type-safe entre BDD et Frontend
 *
 * NOTE : Plus de validation d'env vars au top-level du module.
 * La config est validée paresseusement dans getSupabaseConfig()
 * (build-safe : renvoie un placeholder pendant `next build`).
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { createClient as createBrowserClient } from "./client";
import { getSupabaseConfig } from "./config";

/**
 * Client Supabase typé pour le frontend
 * Utilise le singleton createClient() pour éviter les instances multiples
 *
 * @deprecated Utiliser createClient() de ./client.ts à la place pour éviter les instances multiples
 */
export const typedSupabaseClient = createBrowserClient() as ReturnType<typeof createClient<Database>>;

/**
 * Client Supabase avec service role (backend uniquement)
 * ⚠️ Ne jamais exposer ce client au frontend
 */
export function createTypedServiceClient() {
  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service client");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Types helpers pour faciliter l'utilisation
 */
export type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
export type PropertyInsert = Database["public"]["Tables"]["properties"]["Insert"];
export type PropertyUpdate = Database["public"]["Tables"]["properties"]["Update"];

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type LeaseRow = Database["public"]["Tables"]["leases"]["Row"];
export type LeaseInsert = Database["public"]["Tables"]["leases"]["Insert"];
export type LeaseUpdate = Database["public"]["Tables"]["leases"]["Update"];

export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceInsert = Database["public"]["Tables"]["invoices"]["Insert"];
export type InvoiceUpdate = Database["public"]["Tables"]["invoices"]["Update"];

export type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];
export type TicketInsert = Database["public"]["Tables"]["tickets"]["Insert"];
export type TicketUpdate = Database["public"]["Tables"]["tickets"]["Update"];

// Note: La table "charges" n'existe pas encore dans les types générés
// Utiliser les types Zod validés directement (chargeSchema)

// Types pour rooms et photos
// Note: Ces tables n'existent pas encore dans la BDD actuelle
// Utiliser les types RoomV3 et PhotoV3 de lib/types/property-v3.ts
// TODO: Créer les tables rooms et photos dans la BDD, puis utiliser :
// export type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
// export type PhotoRow = Database["public"]["Tables"]["photos"]["Row"];
