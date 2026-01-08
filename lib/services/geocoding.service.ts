/**
 * Service de géocodage via Nominatim (OpenStreetMap) - Gratuit
 * Convertit une adresse en coordonnées GPS (latitude/longitude)
 */

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

/**
 * Géocode une adresse en utilisant l'API Nominatim (OpenStreetMap)
 * @param address - L'adresse à géocoder
 * @param options - Options de géocodage
 * @returns Les coordonnées GPS ou null si non trouvé
 */
export async function geocodeAddress(
  address: string,
  options: GeocodingOptions = {}
): Promise<GeocodingResult | null> {
  const { countryCode = "fr", limit = 1 } = options;

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=${countryCode}&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Talok/1.0 (contact@talok.fr)",
        "Accept-Language": "fr",
      },
    });

    if (!response.ok) {
      console.error("[geocodeAddress] HTTP Error:", response.status);
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const result = data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
        boundingBox: result.boundingbox,
      };
    }

    console.log("[geocodeAddress] No results found for:", address);
    return null;
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

