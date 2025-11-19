/**
 * Data fetching pour les propriétés (Owner)
 * Server-side uniquement - utilisé dans Server Components
 */

import { createClient } from "@/lib/supabase/server";
import type { PropertyRow } from "@/lib/supabase/typed-client";

export interface FetchPropertiesOptions {
  ownerId?: string;
  includeLeases?: boolean;
  includeStats?: boolean;
}

export interface PropertiesWithStats {
  properties: PropertyRow[];
  propertiesCount: number;
  leasesCount: number;
  totalValue?: number;
}

/**
 * Récupère toutes les propriétés d'un propriétaire
 */
export async function fetchProperties(
  ownerId: string,
  options: FetchPropertiesOptions = {}
): Promise<PropertiesWithStats> {
  const supabase = await createClient();
  
  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Non authentifié");
  }

  // Vérifier que l'utilisateur est bien le propriétaire
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner" || profile.id !== ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Récupérer les propriétés
  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (propertiesError) {
    throw new Error(`Erreur lors de la récupération des propriétés: ${propertiesError.message}`);
  }

  // Compter les baux si demandé
  let leasesCount = 0;
  if (options.includeStats || options.includeLeases) {
    const { count } = await supabase
      .from("leases")
      .select("*", { count: "exact", head: true })
      .in(
        "property_id",
        properties?.map((p) => p.id) || []
      );

    leasesCount = count || 0;
  }

  return {
    properties: (properties as PropertyRow[]) || [],
    propertiesCount: properties?.length || 0,
    leasesCount,
  };
}

/**
 * Récupère une propriété par ID avec ses relations
 */
export async function fetchProperty(
  propertyId: string,
  ownerId: string
): Promise<PropertyRow | null> {
  const supabase = await createClient();

  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Non authentifié");
  }

  // Vérifier les permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner" || profile.id !== ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Récupérer la propriété
  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .eq("owner_id", ownerId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Non trouvé
    }
    throw new Error(`Erreur lors de la récupération de la propriété: ${error.message}`);
  }

  return property as PropertyRow;
}

