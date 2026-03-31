/**
 * lib/properties/constants.ts — SOURCE UNIQUE DE VÉRITÉ
 *
 * Toute modification des types de biens passe par ce fichier
 * + migration SQL correspondante (CHECK constraint).
 *
 * Les 14 types sont synchronisés avec :
 * - SQL : supabase/migrations/20260331100000_add_agricultural_property_types.sql
 * - Zod : lib/validations/property-v3.ts (PropertyTypeV3)
 * - TS V3 : lib/types/property-v3.ts (PropertyTypeV3)
 */

// ============================================
// 1. TYPES DE BIENS (14 types, 5 catégories)
// ============================================

export const PROPERTY_TYPES = [
  "appartement",
  "maison",
  "studio",
  "colocation",
  "saisonnier",
  "parking",
  "box",
  "local_commercial",
  "bureaux",
  "entrepot",
  "fonds_de_commerce",
  "immeuble",
  "terrain_agricole",
  "exploitation_agricole",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

// ============================================
// 2. CATÉGORIES
// ============================================

export type PropertyCategory =
  | "habitation"
  | "parking"
  | "professionnel"
  | "agricole"
  | "ensemble";

export const HABITATION_TYPES: PropertyType[] = [
  "appartement",
  "maison",
  "studio",
  "colocation",
  "saisonnier",
];

export const PARKING_TYPES: PropertyType[] = ["parking", "box"];

export const PRO_TYPES: PropertyType[] = [
  "local_commercial",
  "bureaux",
  "entrepot",
  "fonds_de_commerce",
];

export const AGRICOLE_TYPES: PropertyType[] = [
  "terrain_agricole",
  "exploitation_agricole",
];

export const ENSEMBLE_TYPES: PropertyType[] = ["immeuble"];

export const PROPERTY_CATEGORIES: Record<PropertyCategory, PropertyType[]> = {
  habitation: HABITATION_TYPES,
  parking: PARKING_TYPES,
  professionnel: PRO_TYPES,
  agricole: AGRICOLE_TYPES,
  ensemble: ENSEMBLE_TYPES,
};

// ============================================
// 3. LABELS FR
// ============================================

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  appartement: "Appartement",
  maison: "Maison",
  studio: "Studio",
  colocation: "Colocation",
  saisonnier: "Saisonnier",
  parking: "Parking",
  box: "Box",
  local_commercial: "Local commercial",
  bureaux: "Bureaux",
  entrepot: "Entrepôt",
  fonds_de_commerce: "Fonds de commerce",
  immeuble: "Immeuble",
  terrain_agricole: "Terrain agricole",
  exploitation_agricole: "Exploitation agricole",
};

export const PROPERTY_CATEGORY_LABELS: Record<PropertyCategory, string> = {
  habitation: "Habitation",
  parking: "Stationnement",
  professionnel: "Professionnel",
  agricole: "Agricole",
  ensemble: "Immeuble / Ensemble",
};

// ============================================
// 4. HELPERS
// ============================================

export function getPropertyCategory(type: PropertyType): PropertyCategory {
  if (HABITATION_TYPES.includes(type)) return "habitation";
  if (PARKING_TYPES.includes(type)) return "parking";
  if (PRO_TYPES.includes(type)) return "professionnel";
  if (AGRICOLE_TYPES.includes(type)) return "agricole";
  if (ENSEMBLE_TYPES.includes(type)) return "ensemble";
  return "habitation";
}

export function isHabitationType(type: PropertyType): boolean {
  return HABITATION_TYPES.includes(type);
}

export function isParkingType(type: PropertyType): boolean {
  return PARKING_TYPES.includes(type);
}

export function isProType(type: PropertyType): boolean {
  return PRO_TYPES.includes(type);
}

export function isAgricoleType(type: PropertyType): boolean {
  return AGRICOLE_TYPES.includes(type);
}

export function isEnsembleType(type: PropertyType): boolean {
  return ENSEMBLE_TYPES.includes(type);
}

// ============================================
// 5. CHAMPS CONDITIONNELS PAR TYPE
// ============================================

/**
 * Types qui n'ont pas d'étape "pièces" dans le wizard.
 * Importé par le wizard V3 au lieu d'être hardcodé.
 */
export const TYPES_WITHOUT_ROOMS: PropertyType[] = [
  "parking",
  "box",
  "local_commercial",
  "bureaux",
  "entrepot",
  "fonds_de_commerce",
  "immeuble",
  "terrain_agricole",
  "exploitation_agricole",
];

/**
 * Types nécessitant un DPE (diagnostic de performance énergétique).
 */
export const TYPES_WITH_DPE: PropertyType[] = [
  "appartement",
  "maison",
  "studio",
  "colocation",
  "saisonnier",
  "local_commercial",
  "bureaux",
];

/**
 * Types nécessitant des infos de chauffage.
 */
export const TYPES_WITH_HEATING: PropertyType[] = [
  "appartement",
  "maison",
  "studio",
  "colocation",
  "saisonnier",
  "local_commercial",
  "bureaux",
];
