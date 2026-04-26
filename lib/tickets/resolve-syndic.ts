/**
 * Résolution du syndic pour les tickets "parties communes".
 *
 * Chaîne : property.building_id → buildings.site_id → sites.syndic_profile_id
 *
 * Si la propriété n'est pas rattachée à une copropriété (pas de building_id),
 * le retour est vide et l'appelant retombe sur le flux propriétaire standard.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SyndicRouting {
  /** site_id = identifiant du syndicat de copropriété (table sites) */
  entity_id: string | null;
  /** profile_id du syndic (sur lequel assigner le ticket) */
  syndic_profile_id: string | null;
  /** auth user_id du syndic (pour la notification outbox) */
  syndic_user_id: string | null;
}

const EMPTY: SyndicRouting = {
  entity_id: null,
  syndic_profile_id: null,
  syndic_user_id: null,
};

export async function resolveSyndicForProperty(
  supabase: SupabaseClient<any>,
  propertyId: string | null
): Promise<SyndicRouting> {
  if (!propertyId) return EMPTY;

  const { data: property } = await supabase
    .from("properties")
    .select("building_id")
    .eq("id", propertyId)
    .maybeSingle();

  const buildingId = (property as { building_id: string | null } | null)?.building_id;
  if (!buildingId) return EMPTY;

  const { data: building } = await supabase
    .from("buildings")
    .select("site_id")
    .eq("id", buildingId)
    .maybeSingle();

  const siteId = (building as { site_id: string | null } | null)?.site_id;
  if (!siteId) return EMPTY;

  const { data: site } = await supabase
    .from("sites")
    .select("syndic_profile_id")
    .eq("id", siteId)
    .maybeSingle();

  const syndicProfileId =
    (site as { syndic_profile_id: string | null } | null)?.syndic_profile_id ?? null;

  if (!syndicProfileId) {
    // Site trouvé mais pas de syndic affecté — on expose tout de même l'entity_id
    // pour tracer la copropriété.
    return { entity_id: siteId, syndic_profile_id: null, syndic_user_id: null };
  }

  const { data: syndicProfile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", syndicProfileId)
    .maybeSingle();

  return {
    entity_id: siteId,
    syndic_profile_id: syndicProfileId,
    syndic_user_id: (syndicProfile as { user_id: string | null } | null)?.user_id ?? null,
  };
}
