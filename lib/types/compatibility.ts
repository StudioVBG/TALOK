/**
 * Fonctions de compatibilité pour migration Legacy → V3
 * 
 * Ce fichier fournit des fonctions pour convertir les types legacy vers V3
 * et vice versa, permettant une migration progressive sans breaking changes.
 */

import type { PropertyType } from "./index";
import type {
  PropertyTypeV3,
  PropertyV3,
  RoomTypeV3,
  PhotoTagV3,
  PropertyStatusV3,
} from "./property-v3";
import type { Property, RoomType, PhotoTag, PropertyStatus } from "./index";

// ============================================
// PROPERTY TYPE CONVERSION
// ============================================

/**
 * Convertit PropertyType legacy vers PropertyTypeV3
 * Les deux types sont identiques maintenant, donc c'est une conversion identitaire
 */
export function toPropertyTypeV3(type: PropertyType): PropertyTypeV3 {
  // Les types sont identiques, conversion directe
  return type as PropertyTypeV3;
}

/**
 * Convertit PropertyTypeV3 vers PropertyType legacy
 * Pour compatibilité descendante
 */
export function fromPropertyTypeV3(type: PropertyTypeV3): PropertyType {
  return type as PropertyType;
}

/**
 * Vérifie si un PropertyType est valide pour V3
 */
export function isValidPropertyTypeV3(type: string): type is PropertyTypeV3 {
  const validTypes: PropertyTypeV3[] = [
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
  ];
  return validTypes.includes(type as PropertyTypeV3);
}

// ============================================
// ROOM TYPE CONVERSION
// ============================================

/**
 * Convertit RoomType legacy vers RoomTypeV3
 * RoomTypeV3 ajoute "jardin", "bureau", "dressing" qui ne sont pas dans legacy
 */
export function toRoomTypeV3(type: RoomType): RoomTypeV3 {
  // Les types legacy sont tous valides dans V3
  return type as RoomTypeV3;
}

/**
 * Convertit RoomTypeV3 vers RoomType legacy
 * Si le type n'existe pas dans legacy, retourne "autre"
 */
export function fromRoomTypeV3(type: RoomTypeV3): RoomType {
  const legacyTypes: RoomType[] = [
    "sejour",
    "chambre",
    "cuisine",
    "salle_de_bain",
    "wc",
    "entree",
    "couloir",
    "balcon",
    "terrasse",
    "cave",
    "autre",
  ];
  
  if (legacyTypes.includes(type as RoomType)) {
    return type as RoomType;
  }
  
  // Types V3 qui n'existent pas dans legacy → mapper vers "autre"
  return "autre";
}

// ============================================
// PHOTO TAG CONVERSION
// ============================================

/**
 * Convertit PhotoTag legacy vers PhotoTagV3
 * PhotoTagV3 ajoute "emplacement", "acces", "façade", "interieur", "vitrine", "autre"
 */
export function toPhotoTagV3(tag: PhotoTag): PhotoTagV3 | null {
  if (tag === null) return null;
  
  // Mapping des tags legacy vers V3
  const tagMap: Record<NonNullable<PhotoTag>, PhotoTagV3> = {
    vue_generale: "vue_generale",
    plan: "plan", // "plan" existe dans V3 aussi
    detail: "detail",
    exterieur: "exterieur",
  };
  
  return tagMap[tag] ?? "autre";
}

/**
 * Convertit PhotoTagV3 vers PhotoTag legacy
 * Si le tag n'existe pas dans legacy, retourne null ou "detail"
 */
export function fromPhotoTagV3(tag: PhotoTagV3 | null): PhotoTag {
  if (tag === null) return null;
  
  const legacyTags: NonNullable<PhotoTag>[] = [
    "vue_generale",
    "plan",
    "detail",
    "exterieur",
  ];
  
  if (legacyTags.includes(tag as NonNullable<PhotoTag>)) {
    return tag as PhotoTag;
  }
  
  // Tags V3 qui n'existent pas dans legacy → mapper vers "detail"
  return "detail";
}

// ============================================
// PROPERTY STATUS CONVERSION
// ============================================

/**
 * Convertit PropertyStatus legacy vers PropertyStatusV3
 * PropertyStatus legacy a des valeurs dupliquées (fr/en)
 */
export function toPropertyStatusV3(status: PropertyStatus | string): PropertyStatusV3 {
  const statusMap: Partial<Record<PropertyStatus, PropertyStatusV3>> = {
    brouillon: "draft",
    en_attente: "pending_review",
    published: "published",
    publie: "published", // Dupliqué
    rejected: "rejected",
    rejete: "rejected", // Dupliqué
    archived: "archived",
    archive: "archived", // Dupliqué
  };
  
  // Si c'est déjà une valeur V3, retourner directement
  if (status === "draft" || status === "pending_review" || status === "published" || status === "rejected" || status === "archived") {
    return status as PropertyStatusV3;
  }
  
  return statusMap[status as PropertyStatus] ?? "draft";
}

/**
 * Convertit PropertyStatusV3 vers PropertyStatus legacy
 * Utilise les valeurs anglaises (standard)
 */
export function fromPropertyStatusV3(status: PropertyStatusV3): PropertyStatus {
  const legacyMap: Record<PropertyStatusV3, PropertyStatus> = {
    draft: "brouillon",
    pending_review: "en_attente",
    published: "published",
    rejected: "rejected",
    archived: "archived",
  };
  
  return legacyMap[status] ?? "brouillon";
}

// ============================================
// PROPERTY INTERFACE CONVERSION
// ============================================

/**
 * Convertit Property legacy vers PropertyV3
 * Cette fonction mappe les champs communs et gère les différences
 */
export function toPropertyV3(property: Property): PropertyV3 {
  // Déterminer l'état V3
  const etatV3: PropertyStatusV3 = property.etat 
    ? toPropertyStatusV3(property.etat)
    : "draft";
  
  return {
    // Champs communs (mapping direct)
    id: property.id,
    owner_id: property.owner_id,
    type: toPropertyTypeV3(property.type),
    etat: etatV3,
    adresse_complete: property.adresse_complete,
    code_postal: property.code_postal,
    ville: property.ville,
    departement: property.departement,
    latitude: property.latitude ?? null,
    longitude: property.longitude ?? null,
    surface: property.surface,
    surface_habitable_m2: property.surface_habitable_m2 ?? null,
    nb_pieces: property.nb_pieces,
    nb_chambres: property.nb_chambres ?? null,
    etage: property.etage,
    ascenseur: property.ascenseur,
    meuble: property.meuble ?? false,
    energie: property.energie,
    ges: property.ges,
    
    // Nouveaux champs V3 (valeurs par défaut)
    complement_adresse: null,
    has_balcon: false,
    has_terrasse: false,
    has_jardin: false,
    has_cave: false,
    equipments: [],
    
    // Parking (extrait de parking_details JSONB si présent)
    parking_type: null,
    parking_numero: null,
    parking_niveau: null,
    parking_gabarit: null,
    parking_acces: [],
    parking_portail_securise: false,
    parking_video_surveillance: false,
    parking_gardien: false,
    
    // Locaux pro (valeurs par défaut)
    local_surface_totale: null,
    local_type: null,
    local_has_vitrine: false,
    local_access_pmr: false,
    local_clim: false,
    local_fibre: false,
    local_alarme: false,
    local_rideau_metal: false,
    local_acces_camion: false,
    local_parking_clients: false,
    
    // Conditions de location
    type_bail: null,
    preavis_mois: null,
    
    // Chauffage & confort
    chauffage_type: property.chauffage_type ?? null,
    chauffage_energie: property.chauffage_energie ?? null,
    eau_chaude_type: property.eau_chaude_type ?? null,
    clim_presence: property.clim_presence ?? "aucune",
    clim_type: property.clim_type ?? null,
    
    // Financier
    loyer_base: property.loyer_base,
    loyer_hc: property.loyer_hc ?? null,
    charges_mensuelles: property.charges_mensuelles,
    depot_garantie: property.depot_garantie,
    
    // Métadonnées
    unique_code: property.unique_code,
    status: property.status,
    submitted_at: property.submitted_at,
    validated_at: property.validated_at,
    validated_by: property.validated_by,
    rejection_reason: property.rejection_reason,
    created_at: property.created_at,
    updated_at: property.updated_at,
    
    // Compatibilité : conserver parking_details pour migration progressive
    parking_details: property.parking_details,
  };
}

/**
 * Type guard pour vérifier si un objet est PropertyV3
 */
export function isPropertyV3(obj: any): obj is PropertyV3 {
  return (
    obj &&
    typeof obj === "object" &&
    "type" in obj &&
    "etat" in obj &&
    typeof obj.type === "string" &&
    typeof obj.etat === "string"
  );
}

