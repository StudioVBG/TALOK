/**
 * Helper: résout les property_ids à filtrer selon l'entité sélectionnée.
 *
 * Pattern standard :
 * - entityId absent / "all" → toutes les properties de l'owner
 * - entityId = "personal"  → properties.legal_entity_id IS NULL et owner_id = profileId
 * - entityId = UUID         → properties.legal_entity_id = entityId
 *
 * Retourne un tableau de property_ids (vide = pas de filtre → tout l'owner).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolvePropertyIdsForEntity(
  supabase: SupabaseClient,
  ownerId: string,
  entityId: string | null
): Promise<string[] | null> {
  // Pas de filtre entité → null = pas de restriction
  if (!entityId || entityId === "all") return null;

  if (entityId === "personal") {
    const { data } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", ownerId)
      .is("legal_entity_id", null);
    return (data || []).map((p: any) => p.id);
  }

  // UUID d'entité spécifique
  const { data } = await supabase
    .from("properties")
    .select("id")
    .eq("legal_entity_id", entityId);
  return (data || []).map((p: any) => p.id);
}
