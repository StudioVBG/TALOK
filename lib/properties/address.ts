/**
 * lib/properties/address.ts — Utilitaires adresse et geocoding
 *
 * Autocompletion via l'API Adresse data.gouv.fr (gratuite, sans cle).
 * Geocoding automatique lat/lng.
 * Validation codes postaux metropole + DROM-COM.
 */

const API_ADRESSE_URL = 'https://api-adresse.data.gouv.fr/search';

// ============================================
// 1. TYPES
// ============================================

export interface AddressSuggestion {
  /** Label complet affiche a l'utilisateur */
  label: string;
  /** Numero + voie (ex: "12 rue de la Paix") */
  address: string;
  /** Ville */
  city: string;
  /** Code postal (5 chiffres) */
  postal_code: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Departement (ex: "75", "971") */
  department: string;
  /** Region calculee depuis le code postal */
  region: AddressRegion;
}

export type AddressRegion =
  | 'metropole'
  | 'guadeloupe'
  | 'martinique'
  | 'guyane'
  | 'reunion'
  | 'mayotte';

// ============================================
// 2. AUTOCOMPLETION
// ============================================

/**
 * Recherche d'adresses via l'API Adresse data.gouv.fr.
 * Retourne jusqu'a 5 suggestions.
 *
 * @param query - Texte saisi par l'utilisateur (min 3 caracteres)
 * @param postalCode - Code postal optionnel pour filtrer les resultats
 */
export async function searchAddress(
  query: string,
  postalCode?: string,
): Promise<AddressSuggestion[]> {
  if (query.length < 3) return [];

  const params = new URLSearchParams({
    q: query,
    limit: '5',
  });

  if (postalCode) {
    params.set('postcode', postalCode);
  }

  const res = await fetch(`${API_ADRESSE_URL}?${params.toString()}`);

  if (!res.ok) {
    console.error('[searchAddress] API Adresse error:', res.status, res.statusText);
    return [];
  }

  const data = await res.json();

  return (data.features ?? []).map((f: GeoJSONFeature) => ({
    label: f.properties.label,
    address: f.properties.name,
    city: f.properties.city,
    postal_code: f.properties.postcode,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    department: extractDepartment(f.properties.postcode),
    region: getRegionFromPostalCode(f.properties.postcode),
  }));
}

// ============================================
// 3. GEOCODING
// ============================================

/**
 * Geocode une adresse complete et retourne les coordonnees.
 * Retourne null si l'adresse n'est pas trouvee.
 */
export async function geocodeAddress(
  address: string,
  city: string,
  postalCode: string,
): Promise<{ lat: number; lng: number } | null> {
  const query = `${address}, ${postalCode} ${city}`;
  const results = await searchAddress(query, postalCode);

  if (results.length === 0) return null;

  return { lat: results[0].lat, lng: results[0].lng };
}

// ============================================
// 4. VALIDATION CODE POSTAL
// ============================================

/**
 * Regex pour codes postaux France : metropole (01000-95999) + DROM-COM (97100-97699).
 */
export const POSTAL_CODE_REGEX = /^((0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})$/;

/**
 * Valide un code postal francais (metropole + DROM-COM).
 */
export function isValidPostalCode(postalCode: string): boolean {
  return POSTAL_CODE_REGEX.test(postalCode);
}

// ============================================
// 5. REGION DEPUIS CODE POSTAL
// ============================================

/**
 * Determine la region depuis un code postal.
 * Utilisee pour le calcul TVA (voir talok-stripe-pricing).
 */
export function getRegionFromPostalCode(postalCode: string): AddressRegion {
  if (postalCode.startsWith('971')) return 'guadeloupe';
  if (postalCode.startsWith('972')) return 'martinique';
  if (postalCode.startsWith('973')) return 'guyane';
  if (postalCode.startsWith('974')) return 'reunion';
  if (postalCode.startsWith('976')) return 'mayotte';
  return 'metropole';
}

/**
 * Extrait le numero de departement depuis un code postal.
 * Gere les cas speciaux : Corse (2A/2B), DROM-COM (3 chiffres).
 */
export function extractDepartment(postalCode: string): string {
  if (postalCode.startsWith('97')) {
    return postalCode.substring(0, 3);
  }
  // Corse : 20000-20999
  if (postalCode.startsWith('20')) {
    const commune = parseInt(postalCode, 10);
    // Corse-du-Sud : 20000-20190, Haute-Corse : 20200-20290
    return commune < 20200 ? '2A' : '2B';
  }
  return postalCode.substring(0, 2);
}

/**
 * Formate une adresse complete a partir de ses composants.
 */
export function formatFullAddress(
  address: string,
  complement: string | null | undefined,
  postalCode: string,
  city: string,
): string {
  const parts = [address];
  if (complement) parts.push(complement);
  parts.push(`${postalCode} ${city}`);
  return parts.join(', ');
}

// ============================================
// TYPES INTERNES (API Adresse GeoJSON)
// ============================================

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    label: string;
    name: string;
    city: string;
    postcode: string;
    context: string;
    [key: string]: unknown;
  };
}
