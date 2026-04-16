/**
 * Constantes pour les types de biens immobiliers
 * Centralisées pour éviter la duplication dans le codebase
 */

/**
 * Types de biens résidentiels (habitation)
 */
export const HABITATION_TYPES = [
  "appartement",
  "maison",
  "studio",
  "colocation",
  "saisonnier",
] as const;

/**
 * Types de parkings et box
 */
export const PARKING_TYPES = ["parking", "box"] as const;

/**
 * Types de locaux professionnels
 */
export const PRO_TYPES = [
  "local_commercial",
  "bureaux",
  "entrepot",
  "fonds_de_commerce",
] as const;

/**
 * Tous les types de biens
 */
export const ALL_PROPERTY_TYPES = [
  ...HABITATION_TYPES,
  ...PARKING_TYPES,
  ...PRO_TYPES,
  "immeuble",
] as const;

/**
 * Types de biens sans étape "pièces" dans le wizard
 */
export const TYPES_WITHOUT_ROOMS_STEP = [...PARKING_TYPES] as const;

/**
 * Types de biens pour lesquels la surface n'est PAS obligatoire.
 * Aligné avec le CHECK constraint `properties_surface_required_for_habitable` en DB.
 */
export const TYPES_WITHOUT_SURFACE = [
  'parking',
  'box',
  'terrain_agricole',
  'fonds_de_commerce',
] as const;

/**
 * Retourne true si le type de bien nécessite obligatoirement une surface.
 */
export const requiresSurface = (type: string): boolean =>
  !(TYPES_WITHOUT_SURFACE as readonly string[]).includes(type);

/**
 * Types de biens pour lesquels nb_pieces n'est PAS obligatoire.
 * Aligné avec le CHECK constraint `properties_nb_pieces_required_for_rooms` en DB.
 */
export const TYPES_WITHOUT_ROOMS = [
  'parking',
  'box',
  'terrain_agricole',
  'fonds_de_commerce',
] as const;

/**
 * Retourne true si le type de bien nécessite obligatoirement un nb_pieces.
 * Aligné avec le CHECK constraint `properties_nb_pieces_required_for_rooms` en DB.
 */
export const requiresRooms = (type: string): boolean =>
  !(TYPES_WITHOUT_ROOMS as readonly string[]).includes(type);

/**
 * Types de biens avec étage
 */
export const TYPES_WITH_FLOOR = [
  "appartement",
  "studio",
  "colocation",
  "local_commercial",
  "bureaux",
  "entrepot",
] as const;

/**
 * Options DPE (Diagnostic de Performance Énergétique)
 */
export const DPE_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "NC"] as const;

/**
 * États de publication d'un bien
 */
export const PROPERTY_STATES = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "archived",
] as const;

/**
 * Helpers pour vérifier le type de bien
 */
export function isHabitationType(type: string): boolean {
  return (HABITATION_TYPES as readonly string[]).includes(type);
}

export function isParkingType(type: string): boolean {
  return (PARKING_TYPES as readonly string[]).includes(type);
}

export function isProType(type: string): boolean {
  return (PRO_TYPES as readonly string[]).includes(type);
}

export function hasFloor(type: string): boolean {
  return (TYPES_WITH_FLOOR as readonly string[]).includes(type);
}
