/**
 * Service de géocodage côté client.
 * Passe par /api/geocode (Google Geocoding si clé configurée, sinon Nominatim).
 * Garde un fallback direct Nominatim côté serveur (SSR/scripts).
 */

import {
  extractPostalCode,
  postalCodeToCountryCodes,
} from "@/lib/properties/address";

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  boundingBox?: [string, string, string, string];
}

export interface GeocodingOptions {
  countryCode?: string; // ex: "fr" pour France
  limit?: number;
}

async function geocodeViaApiRoute(
  address: string,
  countryCode: string,
): Promise<GeocodingResult | null> {
  const params = new URLSearchParams({ address, country: countryCode });
  const response = await fetch(`/api/geocode?${params.toString()}`);
  if (!response.ok) return null;
  const data = await response.json();
  if (typeof data?.latitude !== "number" || typeof data?.longitude !== "number") {
    return null;
  }
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    displayName: data.displayName ?? address,
  };
}

async function geocodeViaNominatimDirect(
  address: string,
  countryCode: string,
  limit: number,
): Promise<GeocodingResult | null> {
  // Élargir aux codes pays DROM-COM si le code postal est 97xxx, sinon
  // Nominatim filtre l'adresse à la métropole.
  const postal = extractPostalCode(address);
  const countries =
    postal && postal.startsWith("97")
      ? postalCodeToCountryCodes(postal)
      : countryCode;
  const encodedAddress = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=${countries}&limit=${limit}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Talok/1.0 (contact@talok.fr)",
      "Accept-Language": "fr",
    },
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data?.length) return null;
  const result = data[0];
  return {
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
    displayName: result.display_name,
    boundingBox: result.boundingbox,
  };
}

/**
 * Géocode une adresse.
 * Côté navigateur : passe par /api/geocode (Google -> Nominatim).
 * Côté serveur : appel direct Nominatim.
 */
export async function geocodeAddress(
  address: string,
  options: GeocodingOptions = {}
): Promise<GeocodingResult | null> {
  const { countryCode = "fr", limit = 1 } = options;

  try {
    if (typeof window !== "undefined") {
      return await geocodeViaApiRoute(address, countryCode);
    }
    return await geocodeViaNominatimDirect(address, countryCode, limit);
  } catch (error) {
    console.error("[geocodeAddress] Error:", error);
    return null;
  }
}

/**
 * Géocodage inverse - convertit des coordonnées en adresse
 * @param latitude - Latitude
 * @param longitude - Longitude
 * @returns L'adresse ou null si non trouvé
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodingResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Talok/1.0 (contact@talok.fr)",
        "Accept-Language": "fr",
      },
    });

    if (!response.ok) {
      console.error("[reverseGeocode] HTTP Error:", response.status);
      return null;
    }

    const data = await response.json();

    if (data && data.lat && data.lon) {
      return {
        latitude: parseFloat(data.lat),
        longitude: parseFloat(data.lon),
        displayName: data.display_name,
        boundingBox: data.boundingbox,
      };
    }

    return null;
  } catch (error) {
    console.error("[reverseGeocode] Error:", error);
    return null;
  }
}

/**
 * Vérifie si des coordonnées sont valides
 */
export function isValidCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  if (latitude == null || longitude == null) return false;
  if (isNaN(latitude) || isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}

