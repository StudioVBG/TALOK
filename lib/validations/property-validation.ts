/**
 * Validation des propriétés par type de bien
 * 
 * Ces fonctions valident les données d'une propriété selon son type
 * et retournent des erreurs ciblées pour chaque champ/étape.
 */

import type { PropertyRow, PhotoRow } from "@/lib/supabase/database.types";

type PropertyData = Partial<PropertyRow> & { type_bien?: string; type_bail?: string };

interface RoomData {
  id?: string;
  type_piece?: string;
  surface?: number;
  [key: string]: unknown;
}

type PhotoData = Partial<PhotoRow>;

type ValidationResult = {
  isValid: boolean;
  stepId?: string;
  fieldErrors: Record<string, string>;
  globalErrors: string[];
};

function baseResult(): ValidationResult {
  return { isValid: true, fieldErrors: {}, globalErrors: [] };
}

function finalizeResult(res: ValidationResult, stepId: string): ValidationResult {
  if (Object.keys(res.fieldErrors).length || res.globalErrors.length) {
    res.isValid = false;
    res.stepId = stepId;
  }
  return res;
}

/**
 * Validation pour les biens d'habitation (appartement, maison, studio, colocation)
 */
export function validateHabitation(
  property: PropertyData,
  rooms: RoomData[],
  photos: PhotoData[]
): ValidationResult {
  const res = baseResult();

  // Étape "adresse"
  if (!property.adresse_complete) res.fieldErrors["adresse_complete"] = "Adresse obligatoire.";
  if (!property.code_postal) res.fieldErrors["code_postal"] = "Code postal obligatoire.";
  if (!property.ville) res.fieldErrors["ville"] = "Ville obligatoire.";

  // Étape "infos_essentielles"
  if (!property.surface_habitable_m2 || property.surface_habitable_m2 <= 0) {
    res.fieldErrors["surface_habitable_m2"] = "Surface obligatoire.";
  }
  if (!property.nb_pieces || property.nb_pieces <= 0) {
    res.fieldErrors["nb_pieces"] = "Nombre de pièces obligatoire.";
  }
  if (property.nb_chambres === null || property.nb_chambres === undefined) {
    res.fieldErrors["nb_chambres"] = "Nombre de chambres obligatoire.";
  }
  if (property.meuble === null || property.meuble === undefined) {
    res.fieldErrors["meuble"] = "Précisez si le logement est meublé.";
  }

  // Chauffage / eau chaude / clim
  if (!property.chauffage_type) {
    res.fieldErrors["chauffage_type"] = "Type de chauffage obligatoire.";
  } else if (property.chauffage_type !== "aucun" && !property.chauffage_energie) {
    res.fieldErrors["chauffage_energie"] = "Énergie de chauffage obligatoire.";
  }

  if (!property.eau_chaude_type) {
    res.fieldErrors["eau_chaude_type"] = "Type d'eau chaude obligatoire.";
  }

  if (!property.clim_presence) {
    res.fieldErrors["clim_presence"] = "Précisez la présence de climatisation.";
  } else if (property.clim_presence === "fixe" && !property.clim_type) {
    res.fieldErrors["clim_type"] = "Précisez le type de climatisation fixe.";
  }

  // Étape "pièces & photos"
  const hasSejour = rooms.some((r) => r.type_piece === "sejour");
  if (!hasSejour) {
    // Ce n'est pas un field direct, on met en global
    res.globalErrors.push("Ajoutez au moins une pièce de type Séjour.");
  }

  const hasAnyPhoto = photos.length > 0;
  if (!hasAnyPhoto) {
    res.globalErrors.push("Ajoutez au moins une photo du logement.");
  }

  // Étape "conditions_location"
  if (!property.loyer_hc || property.loyer_hc <= 0) {
    res.fieldErrors["loyer_hc"] = "Loyer hors charges obligatoire.";
  }
  if (property.charges_mensuelles === null || property.charges_mensuelles === undefined) {
    res.fieldErrors["charges_mensuelles"] = "Charges mensuelles obligatoires (0 si aucune).";
  }
  if (property.depot_garantie === null || property.depot_garantie === undefined) {
    res.fieldErrors["depot_garantie"] = "Dépôt de garantie obligatoire.";
  }
  if (!property.type_bail) {
    res.fieldErrors["type_bail"] = "Type de bail obligatoire.";
  }

  return finalizeResult(res, "conditions_location");
}

/**
 * Validation pour les biens saisonniers
 */
export function validateSaisonnier(
  property: PropertyData,
  rooms: RoomData[],
  photos: PhotoData[]
): ValidationResult {
  const res = validateHabitation(property, rooms, photos);

  if (!property.loyer_hc || property.loyer_hc <= 0) {
    res.fieldErrors["loyer_hc"] = "Tarif par nuit/semaine obligatoire.";
  }

  return finalizeResult(res, "conditions_location");
}

/**
 * Validation pour les immeubles (multi-lots)
 */
export function validateImmeuble(
  property: PropertyData,
  photos: PhotoData[]
): ValidationResult {
  const res = baseResult();

  if (!property.adresse_complete) res.fieldErrors["adresse_complete"] = "Adresse obligatoire.";
  if (!property.code_postal) res.fieldErrors["code_postal"] = "Code postal obligatoire.";
  if (!property.ville) res.fieldErrors["ville"] = "Ville obligatoire.";

  if (!property.surface || property.surface <= 0) {
    res.fieldErrors["surface"] = "Surface totale de l'immeuble obligatoire.";
  }
  if (!property.nb_etages_immeuble || property.nb_etages_immeuble <= 0) {
    res.fieldErrors["nb_etages_immeuble"] = "Nombre d'étages obligatoire.";
  }

  if (!photos.length) {
    res.globalErrors.push("Ajoutez au moins une photo de l'immeuble.");
  }

  return finalizeResult(res, "infos_essentielles");
}

/**
 * Validation pour les parkings et boxes
 */
export function validateParking(property: PropertyData, photos: PhotoData[]): ValidationResult {
  const res = baseResult();

  // Adresse
  if (!property.adresse_complete) res.fieldErrors["adresse_complete"] = "Adresse obligatoire.";
  if (!property.code_postal) res.fieldErrors["code_postal"] = "Code postal obligatoire.";
  if (!property.ville) res.fieldErrors["ville"] = "Ville obligatoire.";

  // Infos parking
  if (!property.parking_type) {
    res.fieldErrors["parking_type"] = "Type de stationnement obligatoire.";
  }
  if (!property.parking_gabarit) {
    res.fieldErrors["parking_gabarit"] = "Gabarit du véhicule obligatoire.";
  }

  // Photos
  if (!photos.length) {
    res.globalErrors.push("Ajoutez au moins une photo du parking / box.");
  }

  // Conditions de location
  if (!property.loyer_hc || property.loyer_hc <= 0) {
    res.fieldErrors["loyer_hc"] = "Loyer obligatoire.";
  }
  if (property.depot_garantie === null || property.depot_garantie === undefined) {
    res.fieldErrors["depot_garantie"] = "Dépôt de garantie obligatoire.";
  }
  if (!property.type_bail) {
    res.fieldErrors["type_bail"] = "Type de location obligatoire.";
  }

  return finalizeResult(res, "conditions_location");
}

/**
 * Validation pour les locaux commerciaux (local_commercial, bureaux, entrepot, fonds_de_commerce)
 */
export function validateCommercial(property: PropertyData, photos: PhotoData[]): ValidationResult {
  const res = baseResult();

  // Adresse
  if (!property.adresse_complete) res.fieldErrors["adresse_complete"] = "Adresse obligatoire.";
  if (!property.code_postal) res.fieldErrors["code_postal"] = "Code postal obligatoire.";
  if (!property.ville) res.fieldErrors["ville"] = "Ville obligatoire.";

  // Infos locales
  if (!property.local_surface_totale || property.local_surface_totale <= 0) {
    res.fieldErrors["local_surface_totale"] = "Surface totale obligatoire.";
  }
  if (!property.local_type) {
    res.fieldErrors["local_type"] = "Type de local obligatoire.";
  }

  // Photos
  if (!photos.length) {
    res.globalErrors.push("Ajoutez au moins une photo du local.");
  }

  // Conditions
  if (!property.loyer_hc || property.loyer_hc <= 0) {
    res.fieldErrors["loyer_hc"] = "Loyer HT obligatoire.";
  }
  if (property.depot_garantie === null || property.depot_garantie === undefined) {
    res.fieldErrors["depot_garantie"] = "Dépôt de garantie HT obligatoire.";
  }
  if (!property.type_bail) {
    res.fieldErrors["type_bail"] = "Type de bail obligatoire.";
  }

  return finalizeResult(res, "conditions_location");
}

/**
 * Fonction principale de validation selon le type de bien
 */
export function validateProperty(
  property: PropertyData,
  rooms: RoomData[] = [],
  photos: PhotoData[] = []
): ValidationResult {
  const typeBien = property.type_bien || property.type;

  if (["appartement", "maison", "studio", "colocation"].includes(typeBien ?? "")) {
    return validateHabitation(property, rooms, photos);
  }

  if (typeBien === "saisonnier") {
    return validateSaisonnier(property, rooms, photos);
  }

  if (typeBien === "immeuble") {
    return validateImmeuble(property, photos);
  }

  if (["parking", "box"].includes(typeBien ?? "")) {
    return validateParking(property, photos);
  }

  if (["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(typeBien ?? "")) {
    return validateCommercial(property, photos);
  }

  if (["terrain_agricole", "exploitation_agricole"].includes(typeBien ?? "")) {
    return validateCommercial(property, photos);
  }

  return {
    isValid: false,
    fieldErrors: { type_bien: "Type de bien non reconnu." },
    globalErrors: [],
  };
}

