/**
 * lib/properties/constants.ts — SOURCE UNIQUE DE VERITE
 *
 * Types de biens, labels, icones, categories, et configuration
 * des champs conditionnels par type de bien.
 *
 * NE JAMAIS hardcoder de types de biens ailleurs dans le codebase.
 * Importer depuis ce fichier.
 *
 * Synchronise avec :
 *  - lib/types/property-v3.ts (PropertyTypeV3)
 *  - supabase/migrations/202502150000_property_model_v3.sql
 */

import type { PropertyTypeV3 } from '@/lib/types/property-v3';

// Re-export le type pour usage centralis
export type { PropertyTypeV3 } from '@/lib/types/property-v3';

// ============================================
// 1. LISTE CANONIQUE DES TYPES DE BIENS
// ============================================

export const PROPERTY_TYPES = [
  'appartement',
  'maison',
  'studio',
  'colocation',
  'parking',
  'box',
  'local_commercial',
  'bureaux',
  'entrepot',
  'fonds_de_commerce',
  'immeuble',
  'terrain_agricole',
  'exploitation_agricole',
] as const;

// ============================================
// 2. LABELS & ICONES
// ============================================

export const PROPERTY_TYPE_LABELS: Record<PropertyTypeV3, string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  studio: 'Studio',
  colocation: 'Colocation',
  saisonnier: 'Saisonnier',
  parking: 'Place de parking',
  box: 'Box ferme',
  local_commercial: 'Local commercial',
  bureaux: 'Bureaux',
  entrepot: 'Entrepot',
  fonds_de_commerce: 'Fonds de commerce',
  immeuble: 'Immeuble entier',
  terrain_agricole: 'Terrain agricole',
  exploitation_agricole: 'Exploitation agricole',
};

export const PROPERTY_TYPE_ICONS: Record<PropertyTypeV3, string> = {
  appartement: '🏢',
  maison: '🏠',
  studio: '🛏️',
  colocation: '👥',
  saisonnier: '🏖️',
  parking: '🚗',
  box: '🚙',
  local_commercial: '🏪',
  bureaux: '🧑‍💼',
  entrepot: '🏭',
  fonds_de_commerce: '🛍',
  immeuble: '🏗️',
  terrain_agricole: '🌾',
  exploitation_agricole: '🏚',
};

// ============================================
// 3. CATEGORIES
// ============================================

export const PROPERTY_CATEGORIES = {
  habitation: ['appartement', 'maison', 'studio', 'saisonnier'],
  colocation: ['colocation'],
  annexe: ['parking', 'box'],
  professionnel: ['local_commercial', 'bureaux', 'entrepot', 'fonds_de_commerce'],
  foncier: ['terrain_agricole', 'exploitation_agricole'],
  ensemble: ['immeuble'],
} as const;

export type PropertyCategory = keyof typeof PROPERTY_CATEGORIES;

export function getPropertyCategory(type: PropertyTypeV3): PropertyCategory {
  for (const [cat, types] of Object.entries(PROPERTY_CATEGORIES)) {
    if ((types as readonly string[]).includes(type)) return cat as PropertyCategory;
  }
  return 'habitation';
}

// ============================================
// 4. CHAMPS CONDITIONNELS PAR CATEGORIE
// ============================================

export type FieldVisibility = 'required' | 'optional' | 'hidden';

/**
 * Matrice de visibilite des champs selon la categorie du bien.
 *
 * Les champs d'adresse (adresse_complete, code_postal, ville, etc.)
 * sont TOUJOURS requis pour tous les types — ils ne sont pas dans
 * cette matrice car ils ne varient jamais.
 */
export const FIELD_VISIBILITY: Record<PropertyCategory, Record<string, FieldVisibility>> = {
  habitation: {
    surface_habitable_m2: 'required',
    nb_pieces: 'required',
    nb_chambres: 'optional',
    nb_bathrooms: 'optional',
    etage: 'optional',
    total_floors: 'hidden',
    has_elevator: 'optional',
    meuble: 'required',
    dpe_classe_energie: 'required',
    dpe_classe_climat: 'optional',
    construction_year: 'optional',
    chauffage_type: 'optional',
    chauffage_energie: 'optional',
    loyer_reference: 'optional',
    lot_number: 'optional',
    cadastral_ref: 'hidden',
    nb_units: 'hidden',
    parking_type: 'hidden',
    has_balcon: 'optional',
    has_terrasse: 'optional',
    has_jardin: 'optional',
    has_cave: 'optional',
    equipments: 'optional',
    description: 'optional',
  },
  colocation: {
    surface_habitable_m2: 'required',
    nb_pieces: 'required',
    nb_chambres: 'required',
    nb_bathrooms: 'optional',
    etage: 'optional',
    total_floors: 'hidden',
    has_elevator: 'optional',
    meuble: 'required',
    dpe_classe_energie: 'required',
    dpe_classe_climat: 'optional',
    construction_year: 'optional',
    chauffage_type: 'optional',
    chauffage_energie: 'optional',
    loyer_reference: 'optional',
    lot_number: 'optional',
    cadastral_ref: 'hidden',
    nb_units: 'hidden',
    parking_type: 'hidden',
    has_balcon: 'optional',
    has_terrasse: 'optional',
    has_jardin: 'optional',
    has_cave: 'optional',
    equipments: 'optional',
    description: 'optional',
  },
  annexe: {
    surface_habitable_m2: 'hidden',
    nb_pieces: 'hidden',
    nb_chambres: 'hidden',
    nb_bathrooms: 'hidden',
    etage: 'optional',
    total_floors: 'hidden',
    has_elevator: 'hidden',
    meuble: 'hidden',
    dpe_classe_energie: 'hidden',
    dpe_classe_climat: 'hidden',
    construction_year: 'hidden',
    chauffage_type: 'hidden',
    chauffage_energie: 'hidden',
    loyer_reference: 'hidden',
    lot_number: 'optional',
    cadastral_ref: 'hidden',
    nb_units: 'hidden',
    parking_type: 'required',
    has_balcon: 'hidden',
    has_terrasse: 'hidden',
    has_jardin: 'hidden',
    has_cave: 'hidden',
    equipments: 'hidden',
    description: 'optional',
  },
  professionnel: {
    surface_habitable_m2: 'required',
    nb_pieces: 'optional',
    nb_chambres: 'hidden',
    nb_bathrooms: 'hidden',
    etage: 'optional',
    total_floors: 'hidden',
    has_elevator: 'hidden',
    meuble: 'hidden',
    dpe_classe_energie: 'required',
    dpe_classe_climat: 'optional',
    construction_year: 'optional',
    chauffage_type: 'optional',
    chauffage_energie: 'optional',
    loyer_reference: 'hidden',
    lot_number: 'optional',
    cadastral_ref: 'hidden',
    nb_units: 'hidden',
    parking_type: 'hidden',
    has_balcon: 'hidden',
    has_terrasse: 'hidden',
    has_jardin: 'hidden',
    has_cave: 'hidden',
    equipments: 'hidden',
    description: 'optional',
  },
  foncier: {
    surface_habitable_m2: 'optional',
    nb_pieces: 'hidden',
    nb_chambres: 'hidden',
    nb_bathrooms: 'hidden',
    etage: 'hidden',
    total_floors: 'hidden',
    has_elevator: 'hidden',
    meuble: 'hidden',
    dpe_classe_energie: 'hidden',
    dpe_classe_climat: 'hidden',
    construction_year: 'hidden',
    chauffage_type: 'hidden',
    chauffage_energie: 'hidden',
    loyer_reference: 'hidden',
    lot_number: 'hidden',
    cadastral_ref: 'optional',
    nb_units: 'hidden',
    parking_type: 'hidden',
    has_balcon: 'hidden',
    has_terrasse: 'hidden',
    has_jardin: 'hidden',
    has_cave: 'hidden',
    equipments: 'hidden',
    description: 'optional',
  },
  ensemble: {
    surface_habitable_m2: 'required',
    nb_pieces: 'hidden',
    nb_chambres: 'hidden',
    nb_bathrooms: 'hidden',
    etage: 'hidden',
    total_floors: 'required',
    has_elevator: 'optional',
    meuble: 'hidden',
    dpe_classe_energie: 'optional',
    dpe_classe_climat: 'hidden',
    construction_year: 'optional',
    chauffage_type: 'hidden',
    chauffage_energie: 'hidden',
    loyer_reference: 'hidden',
    lot_number: 'hidden',
    cadastral_ref: 'optional',
    nb_units: 'required',
    parking_type: 'hidden',
    has_balcon: 'hidden',
    has_terrasse: 'hidden',
    has_jardin: 'hidden',
    has_cave: 'hidden',
    equipments: 'hidden',
    description: 'optional',
  },
};

/**
 * Retourne la matrice de visibilite des champs pour un type de bien donne.
 * La colocation a sa propre config ; les autres types utilisent leur categorie.
 */
export function getFieldsForType(type: PropertyTypeV3): Record<string, FieldVisibility> {
  if (type === 'colocation') return FIELD_VISIBILITY.colocation;
  return FIELD_VISIBILITY[getPropertyCategory(type)];
}

/**
 * Verifie si un champ est visible (required ou optional) pour un type donne.
 */
export function isFieldVisible(type: PropertyTypeV3, field: string): boolean {
  const fields = getFieldsForType(type);
  const visibility = fields[field];
  return visibility !== undefined && visibility !== 'hidden';
}

/**
 * Verifie si un champ est requis pour un type donne.
 */
export function isFieldRequired(type: PropertyTypeV3, field: string): boolean {
  const fields = getFieldsForType(type);
  return fields[field] === 'required';
}
