import { getServiceRoleClient } from "./service-role-client";

export const PROPERTY_SHARE_SELECT = [
  "id",
  "type",
  "type_bien",
  "usage_principal",
  "adresse_complete",
  "code_postal",
  "ville",
  "surface_habitable_m2",
  "surface",
  "nb_pieces",
  "nb_chambres",
  "etage",
  "ascenseur",
  "meuble",
  "parking_details",
  "parking_badge_count",
  "gabarit",
  "type_location_parking",
  "numero_place",
  "niveau",
  "loyer_hc",
  "charges_mensuelles",
  "depot_garantie",
  "charges_forfaitaires",
  "type_bail",
  "chauffage_type",
  "chauffage_energie",
  "clim_presence",
  "clim_type",
  "dpe_classe_energie",
  "dpe_classe_climat",
  "has_irve",
].join(",");

export async function fetchShareToken(token: string) {
  const { client } = getServiceRoleClient();

  const { data, error } = await client
    .from("property_share_tokens")
    .select("*, property:properties!inner(id, owner_id)")
    .eq("token", token)
    .single();

  if (error || !data) {
    throw new Error("Lien de partage introuvable.");
  }

  return { share: data, client };
}

export async function fetchPropertyForShare(propertyId: string, columns = PROPERTY_SHARE_SELECT) {
  const { client } = getServiceRoleClient();
  const { data, error } = await client.from("properties").select(columns).eq("id", propertyId).single();
  if (error || !data) {
    throw new Error("Logement introuvable.");
  }
  return data;
}

export function isShareActive(share: { expires_at: string; revoked_at?: string | null }) {
  if (share.revoked_at) return false;
  return new Date(share.expires_at) > new Date();
}


