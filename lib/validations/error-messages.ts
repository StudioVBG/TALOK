/**
 * Messages d'erreur centralisés pour les validations
 * 
 * Centralise tous les messages d'erreur pour faciliter la maintenance
 * et la traduction future.
 */

export const ValidationMessages = {
  // ============================================
  // ADRESSE
  // ============================================
  address: {
    required: "L'adresse complète est requise",
    postalCode: "Le code postal doit contenir 5 chiffres",
    city: "La ville est requise",
    department: "Le département doit contenir 2 caractères",
    latitude: "La latitude doit être entre -90 et 90",
    longitude: "La longitude doit être entre -180 et 180",
  },

  // ============================================
  // SURFACE & PIÈCES
  // ============================================
  surface: {
    required: "La surface est requise",
    positive: "La surface doit être strictement positive",
    nonNegative: "La surface ne peut pas être négative",
    habitablePositive: "La surface habitable doit être strictement positive",
  },
  rooms: {
    required: "Le nombre de pièces est requis",
    positive: "Le nombre de pièces doit être au moins 1",
    nonNegative: "Le nombre de pièces ne peut pas être négatif",
    bedroomsNonNegative: "Le nombre de chambres ne peut pas être négatif",
    parkingNoRooms: "Un parking ne doit pas avoir de nombre de pièces",
  },

  // ============================================
  // FINANCIER
  // ============================================
  financial: {
    loyerHcPositive: "Le loyer hors charges doit être strictement positif",
    loyerPositive: "Le loyer doit être positif",
    chargesNonNegative: "Les charges ne peuvent pas être négatives",
    depotNonNegative: "Le dépôt de garantie ne peut pas être négatif",
    loyerReferencePositive: "Le loyer de référence doit être positif",
    complementNonNegative: "Le complément ne peut pas être négatif",
    encadrementRequired: "Le loyer de référence majoré est requis en cas d'encadrement",
  },

  // ============================================
  // CHAUFFAGE & CONFORT
  // ============================================
  heating: {
    energieRequired: "L'énergie du chauffage est requise si le chauffage n'est pas 'aucun'",
    energieEmpty: "L'énergie doit être vide si aucun chauffage n'est présent",
    climTypeRequired: "Le type de climatisation est requis si la climatisation est fixe",
    climTypeEmpty: "Le type de clim doit être vide si aucune clim n'est installée",
    climTypeMobile: "Le type de clim fixe n'est pas requis pour un équipement mobile",
  },

  // ============================================
  // PARKING
  // ============================================
  parking: {
    detailsRequired: "Les détails du parking sont requis",
    accessRequired: "Au moins un type d'accès doit être sélectionné",
    numeroMaxLength: "Le numéro de parking ne peut pas dépasser 50 caractères",
    niveauMaxLength: "Le niveau de parking ne peut pas dépasser 20 caractères",
  },

  // ============================================
  // LOCAUX PRO
  // ============================================
  localPro: {
    surfacePositive: "La surface totale doit être strictement positive",
    typeRequired: "Le type de local est requis",
  },

  // ============================================
  // PERMIS DE LOUER
  // ============================================
  permisLouer: {
    dateFormat: "Format date invalide (YYYY-MM-DD)",
  },

  // ============================================
  // PRÉAVIS
  // ============================================
  preavis: {
    min: "Le préavis doit être d'au moins 1 mois",
    max: "Le préavis ne peut pas dépasser 12 mois",
  },

  // ============================================
  // GÉNÉRAL
  // ============================================
  general: {
    required: "Ce champ est requis",
    invalidFormat: "Format invalide",
    invalidValue: "Valeur invalide",
    tooLong: "Ce champ est trop long",
    tooShort: "Ce champ est trop court",
  },
} as const;

/**
 * Helper pour obtenir un message d'erreur avec fallback
 */
export function getValidationMessage(
  category: keyof typeof ValidationMessages,
  key: string,
  fallback?: string
): string {
  const categoryMessages = ValidationMessages[category] as Record<string, string>;
  return categoryMessages[key] || fallback || ValidationMessages.general.invalidValue;
}

