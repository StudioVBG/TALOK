/**
 * Géocodage des prestataires Talok (table `providers`).
 * Utilisé après création/mise à jour de l'adresse pour pouvoir trier
 * par distance dans la marketplace et fusionner avec la recherche externe.
 *
 * Côté serveur uniquement.
 */

import { geocodeAddress } from "@/lib/services/geocoding.service";
import {
  extractPostalCode,
  postalCodeToCountryCodes,
} from "@/lib/properties/address";
import { getServiceClient } from "@/lib/supabase/service-client";

interface ProviderAddressInput {
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
}

export function buildFullProviderAddress(input: ProviderAddressInput): string | null {
  const parts = [input.address, input.postal_code, input.city]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(", ");
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
  source: "google" | "nominatim";
}

/**
 * Géocode une adresse en respectant les codes pays DROM-COM.
 * Retourne null en cas d'échec — l'appelant doit gérer le cas no-op.
 */
export async function geocodeProviderAddress(
  input: ProviderAddressInput,
): Promise<GeocodeResult | null> {
  const fullAddress = buildFullProviderAddress(input);
  if (!fullAddress) return null;

  // Détection DROM-COM via le code postal pour éviter Nominatim qui filtre
  // l'adresse à la métropole et géocode à 4500 km du vrai bien.
  const postal =
    input.postal_code?.trim() || extractPostalCode(fullAddress) || null;
  const countryCode =
    postal && postal.startsWith("97")
      ? postalCodeToCountryCodes(postal)
      : "fr";

  const result = await geocodeAddress(fullAddress, { countryCode });
  if (!result) return null;

  return {
    latitude: result.latitude,
    longitude: result.longitude,
    // `geocodeAddress` côté serveur tape Nominatim directement ; côté client
    // ce serait Google via /api/geocode mais ce helper n'est jamais appelé
    // depuis le navigateur.
    source: "nominatim",
  };
}

/**
 * Géocode l'adresse d'un prestataire et persiste lat/lng + métadonnées.
 * Non-bloquant : on log et on retourne false en cas d'échec.
 */
export async function geocodeAndSaveProvider(providerId: string): Promise<boolean> {
  const supabase = getServiceClient();

  const { data: provider, error: fetchErr } = await supabase
    .from("providers")
    .select("id, address, postal_code, city")
    .eq("id", providerId)
    .single();

  if (fetchErr || !provider) {
    console.warn("[provider-geocoding] provider not found:", providerId, fetchErr);
    return false;
  }

  const result = await geocodeProviderAddress(provider);
  if (!result) {
    console.warn(
      "[provider-geocoding] geocoding failed for provider",
      providerId,
      buildFullProviderAddress(provider),
    );
    return false;
  }

  const { error: updateErr } = await supabase
    .from("providers")
    .update({
      latitude: result.latitude,
      longitude: result.longitude,
      geocoded_at: new Date().toISOString(),
      geocode_source: result.source,
    })
    .eq("id", providerId);

  if (updateErr) {
    console.error("[provider-geocoding] update failed:", updateErr);
    return false;
  }

  return true;
}
