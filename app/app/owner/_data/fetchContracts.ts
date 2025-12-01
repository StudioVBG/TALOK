// @ts-nocheck
/**
 * Data fetching pour les baux (Owner)
 * Server-side uniquement
 */

import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { LeaseRow } from "@/lib/supabase/typed-client";
import type { Database } from "@/lib/supabase/database.types";

export interface FetchContractsOptions {
  ownerId: string;
  propertyId?: string;
  status?: string;
}

/**
 * Récupère tous les baux d'un propriétaire
 * Utilise le service role pour contourner les RLS problématiques
 */
async function getElevatedClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    return createServiceRoleClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  console.warn("[fetchContracts] SUPABASE_SERVICE_ROLE_KEY manquant - fallback sur client session (RLS actif)");
  return createClient();
}

export async function fetchContracts(
  options: FetchContractsOptions
): Promise<LeaseRow[]> {
  const supabaseAuth = await createClient();

  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    throw new Error("Non authentifié");
  }

  const supabase = await getElevatedClient();

  // Vérifier les permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner" || profile.id !== options.ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Construire la requête (service role contourne RLS)
  let query = supabase
    .from("leases")
    .select("*")
    .order("created_at", { ascending: false });

  // Filtrer par propriété si spécifié
  if (options.propertyId) {
    query = query.eq("property_id", options.propertyId);
  } else {
    // Filtrer par propriétés du propriétaire
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", options.ownerId);

    if (properties && properties.length > 0) {
      query = query.in(
        "property_id",
        properties.map((p) => p.id)
      );
    } else {
      // Aucune propriété, retourner tableau vide
      return [];
    }
  }

  // Filtrer par statut si spécifié
  if (options.status) {
    query = query.eq("statut", options.status);
  }

  const { data: leases, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des baux: ${error.message}`);
  }

  return (leases as LeaseRow[]) || [];
}

/**
 * Récupère un bail par ID
 */
export async function fetchContract(
  leaseId: string,
  ownerId: string
): Promise<LeaseRow | null> {
  const supabaseAuth = await createClient();

  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    throw new Error("Non authentifié");
  }

  const supabase = await getElevatedClient();

  // Vérifier les permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner" || profile.id !== ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Vérifier que le bail appartient à une propriété du propriétaire
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("*, properties!inner(owner_id)")
    .eq("id", leaseId)
    .single();

  if (leaseError) {
    if (leaseError.code === "PGRST116") {
      return null;
    }
    throw new Error(`Erreur lors de la récupération du bail: ${leaseError.message}`);
  }

  // Vérifier que la propriété appartient au propriétaire
  const property = (lease as any).properties;
  if (!property || property.owner_id !== ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Retourner le bail sans la relation
  const { properties, ...leaseData } = lease as any;
  return leaseData as LeaseRow;
}

