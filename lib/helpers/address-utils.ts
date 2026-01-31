/**
 * Utilitaires pour la gestion des adresses françaises (Métropole + DROM)
 */

/**
 * Mapping des noms de départements par code
 */
export const DEPARTEMENT_NAMES: Record<string, string> = {
  "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence",
  "05": "Hautes-Alpes", "06": "Alpes-Maritimes", "07": "Ardèche", "08": "Ardennes",
  "09": "Ariège", "10": "Aube", "11": "Aude", "12": "Aveyron",
  "13": "Bouches-du-Rhône", "14": "Calvados", "15": "Cantal", "16": "Charente",
  "17": "Charente-Maritime", "18": "Cher", "19": "Corrèze", "2A": "Corse-du-Sud",
  "2B": "Haute-Corse", "21": "Côte-d'Or", "22": "Côtes-d'Armor", "23": "Creuse",
  "24": "Dordogne", "25": "Doubs", "26": "Drôme", "27": "Eure",
  "28": "Eure-et-Loir", "29": "Finistère", "30": "Gard", "31": "Haute-Garonne",
  "32": "Gers", "33": "Gironde", "34": "Hérault", "35": "Ille-et-Vilaine",
  "36": "Indre", "37": "Indre-et-Loire", "38": "Isère", "39": "Jura",
  "40": "Landes", "41": "Loir-et-Cher", "42": "Loire", "43": "Haute-Loire",
  "44": "Loire-Atlantique", "45": "Loiret", "46": "Lot", "47": "Lot-et-Garonne",
  "48": "Lozère", "49": "Maine-et-Loire", "50": "Manche", "51": "Marne",
  "52": "Haute-Marne", "53": "Mayenne", "54": "Meurthe-et-Moselle", "55": "Meuse",
  "56": "Morbihan", "57": "Moselle", "58": "Nièvre", "59": "Nord",
  "60": "Oise", "61": "Orne", "62": "Pas-de-Calais", "63": "Puy-de-Dôme",
  "64": "Pyrénées-Atlantiques", "65": "Hautes-Pyrénées", "66": "Pyrénées-Orientales",
  "67": "Bas-Rhin", "68": "Haut-Rhin", "69": "Rhône", "70": "Haute-Saône",
  "71": "Saône-et-Loire", "72": "Sarthe", "73": "Savoie", "74": "Haute-Savoie",
  "75": "Paris", "76": "Seine-Maritime", "77": "Seine-et-Marne", "78": "Yvelines",
  "79": "Deux-Sèvres", "80": "Somme", "81": "Tarn", "82": "Tarn-et-Garonne",
  "83": "Var", "84": "Vaucluse", "85": "Vendée", "86": "Vienne",
  "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne", "90": "Territoire de Belfort",
  "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis", "94": "Val-de-Marne",
  "95": "Val-d'Oise",
  // DROM
  "971": "Guadeloupe", 
  "972": "Martinique", 
  "973": "Guyane", 
  "974": "La Réunion", 
  "976": "Mayotte",
};

/**
 * Extrait le code département depuis un code postal
 * 
 * @param codePostal - Le code postal (5 chiffres)
 * @returns Le code département (2 ou 3 caractères) ou null si invalide
 * 
 * @example
 * getDepartementCodeFromCP("97200") // "972" (Martinique)
 * getDepartementCodeFromCP("75001") // "75" (Paris)
 * getDepartementCodeFromCP("20000") // "2A" (Corse-du-Sud)
 * getDepartementCodeFromCP("20200") // "2B" (Haute-Corse)
 */
export function getDepartementCodeFromCP(codePostal: string | null | undefined): string | null {
  if (!codePostal || codePostal.length < 2) return null;
  
  // DROM: codes postaux commençant par 97
  if (codePostal.startsWith("97")) {
    return codePostal.substring(0, 3); // 971, 972, 973, 974, 976
  }
  
  // Corse: codes postaux commençant par 20
  if (codePostal.startsWith("20")) {
    const cp = parseInt(codePostal, 10);
    return cp < 20200 ? "2A" : "2B";
  }
  
  // Métropole: 2 premiers chiffres
  return codePostal.substring(0, 2);
}

/**
 * Obtient le nom du département depuis un code postal
 * 
 * @param codePostal - Le code postal (5 chiffres)
 * @returns Le nom du département ou null si non trouvé
 * 
 * @example
 * getDepartementNameFromCP("97200") // "Martinique"
 * getDepartementNameFromCP("75001") // "Paris"
 */
export function getDepartementNameFromCP(codePostal: string | null | undefined): string | null {
  const code = getDepartementCodeFromCP(codePostal);
  if (!code) return null;
  return DEPARTEMENT_NAMES[code] || null;
}

/**
 * Vérifie si un code postal est dans un DROM
 */
export function isDROM(codePostal: string | null | undefined): boolean {
  if (!codePostal) return false;
  return codePostal.startsWith("97");
}

/**
 * Vérifie si un code postal est en Corse
 */
export function isCorse(codePostal: string | null | undefined): boolean {
  if (!codePostal) return false;
  return codePostal.startsWith("20");
}

// ============================================
// DIAGNOSTIC IMMOBILIER DOM-TOM (SOTA 2026)
// ============================================
// Source: Réglementation française sur les diagnostics immobiliers
// Les DOM-TOM ont des spécificités réglementaires importantes

/**
 * Codes DROM par région
 */
export const DROM_CODES = {
  GUADELOUPE: "971",
  MARTINIQUE: "972",
  GUYANE: "973",
  REUNION: "974",
  MAYOTTE: "976",
} as const;

/**
 * Zones termites (communes concernées par le diagnostic termites obligatoire)
 * Tous les DOM-TOM sont en zone termites
 */
export const ZONES_TERMITES_DROM = ["971", "972", "973", "974", "976"];

/**
 * Zones sismiques par DROM (pour diagnostic risques naturels)
 */
export const ZONES_SISMIQUES: Record<string, { niveau: number; label: string }> = {
  "971": { niveau: 5, label: "Fort" },      // Guadeloupe
  "972": { niveau: 5, label: "Fort" },      // Martinique
  "973": { niveau: 2, label: "Faible" },    // Guyane
  "974": { niveau: 2, label: "Faible" },    // Réunion
  "976": { niveau: 4, label: "Moyen" },     // Mayotte
};

/**
 * Type de diagnostic obligatoire
 */
export interface DiagnosticObligation {
  code: string;
  label: string;
  obligatoire: boolean;
  condition?: string;
  priorite: "bloquant" | "recommande" | "informatif";
}

/**
 * Obtenir les diagnostics obligatoires selon le code postal et le type de bien
 *
 * @param codePostal - Code postal du bien
 * @param typeBien - Type de bien (habitation, parking, local_pro)
 * @param anneeConstruction - Année de construction (optionnel)
 * @returns Liste des diagnostics obligatoires avec leur statut
 *
 * @example
 * getDiagnosticsObligatoires("97200", "habitation", 1990)
 * // → [{ code: "DPE", obligatoire: true, ... }, { code: "TERMITES", obligatoire: true, ... }]
 */
export function getDiagnosticsObligatoires(
  codePostal: string | null | undefined,
  typeBien: "habitation" | "parking" | "local_pro" | "immeuble",
  anneeConstruction?: number | null
): DiagnosticObligation[] {
  const diagnostics: DiagnosticObligation[] = [];
  const isDrom = isDROM(codePostal);
  const deptCode = getDepartementCodeFromCP(codePostal);

  // ===== DPE (Diagnostic de Performance Énergétique) =====
  // Obligatoire depuis 2023 pour toutes les locations d'habitation
  if (typeBien === "habitation" || typeBien === "immeuble") {
    diagnostics.push({
      code: "DPE",
      label: "Diagnostic de Performance Énergétique",
      obligatoire: true,
      condition: isDrom
        ? "Obligatoire même en DOM-TOM depuis 2023"
        : "Obligatoire pour toute location",
      priorite: "bloquant",
    });
  }

  // ===== GES (Gaz à Effet de Serre) =====
  // Inclus dans le DPE
  if (typeBien === "habitation" || typeBien === "immeuble") {
    diagnostics.push({
      code: "GES",
      label: "Émissions de Gaz à Effet de Serre",
      obligatoire: true,
      condition: "Inclus dans le DPE",
      priorite: "bloquant",
    });
  }

  // ===== TERMITES =====
  // Obligatoire dans les zones déclarées (tous les DOM-TOM)
  if (isDrom || isZoneTermites(deptCode)) {
    diagnostics.push({
      code: "TERMITES",
      label: "État relatif aux termites",
      obligatoire: true,
      condition: isDrom
        ? "Obligatoire dans tous les DOM-TOM"
        : "Zone classée à risque termites",
      priorite: "bloquant",
    });
  }

  // ===== ERP (État des Risques et Pollutions) =====
  // Obligatoire pour toutes les locations
  diagnostics.push({
    code: "ERP",
    label: "État des Risques et Pollutions",
    obligatoire: true,
    condition: isDrom
      ? `Zone sismique niveau ${ZONES_SISMIQUES[deptCode || ""]?.niveau || "N/A"} (${ZONES_SISMIQUES[deptCode || ""]?.label || "N/A"})`
      : "Obligatoire pour toute location",
    priorite: "bloquant",
  });

  // ===== AMIANTE =====
  // Obligatoire si construction avant 1997
  if (anneeConstruction && anneeConstruction < 1997) {
    diagnostics.push({
      code: "AMIANTE",
      label: "État d'amiante",
      obligatoire: true,
      condition: `Construction avant 1997 (année: ${anneeConstruction})`,
      priorite: "bloquant",
    });
  } else {
    diagnostics.push({
      code: "AMIANTE",
      label: "État d'amiante",
      obligatoire: false,
      condition: anneeConstruction
        ? `Non requis (construction ${anneeConstruction} > 1997)`
        : "Vérifier l'année de construction",
      priorite: "recommande",
    });
  }

  // ===== PLOMB (CREP) =====
  // Obligatoire si construction avant 1949
  if (anneeConstruction && anneeConstruction < 1949) {
    diagnostics.push({
      code: "CREP",
      label: "Constat de Risque d'Exposition au Plomb",
      obligatoire: true,
      condition: `Construction avant 1949 (année: ${anneeConstruction})`,
      priorite: "bloquant",
    });
  } else {
    diagnostics.push({
      code: "CREP",
      label: "Constat de Risque d'Exposition au Plomb",
      obligatoire: false,
      condition: anneeConstruction
        ? `Non requis (construction ${anneeConstruction} > 1949)`
        : "Vérifier l'année de construction",
      priorite: "recommande",
    });
  }

  // ===== ÉLECTRICITÉ =====
  // Obligatoire si installation > 15 ans
  if (typeBien === "habitation" || typeBien === "immeuble") {
    diagnostics.push({
      code: "ELEC",
      label: "Diagnostic électricité",
      obligatoire: true,
      condition: "Obligatoire si installation > 15 ans",
      priorite: "recommande",
    });
  }

  // ===== GAZ =====
  // Obligatoire si installation > 15 ans
  if (typeBien === "habitation" || typeBien === "immeuble") {
    diagnostics.push({
      code: "GAZ",
      label: "Diagnostic gaz",
      obligatoire: false,
      condition: "Obligatoire si installation gaz > 15 ans",
      priorite: "recommande",
    });
  }

  // ===== SURFACE (Carrez / habitable) =====
  if (typeBien === "habitation" || typeBien === "immeuble") {
    diagnostics.push({
      code: "SURFACE",
      label: "Mesurage surface habitable",
      obligatoire: true,
      condition: "Obligatoire pour les lots en copropriété (> 8 m²)",
      priorite: "recommande",
    });
  }

  return diagnostics;
}

/**
 * Vérifie si le département est en zone termites
 */
export function isZoneTermites(deptCode: string | null | undefined): boolean {
  if (!deptCode) return false;
  // Tous les DOM-TOM sont en zone termites
  if (ZONES_TERMITES_DROM.includes(deptCode)) return true;
  // En métropole, certains départements sont classés (liste non exhaustive)
  const METROPOLE_TERMITES = [
    "13", "17", "30", "31", "32", "33", "34", "40", "47", "64", "65", "66",
    "82", "83", "84", "85"
  ];
  return METROPOLE_TERMITES.includes(deptCode);
}

/**
 * Vérifie si le DPE est obligatoire pour la publication
 *
 * @param typeBien - Type de bien
 * @returns true si le DPE est obligatoire pour publier l'annonce
 */
export function isDPEObligatoire(typeBien: string): boolean {
  const TYPES_AVEC_DPE = [
    "appartement", "maison", "studio", "colocation", "saisonnier", "immeuble"
  ];
  return TYPES_AVEC_DPE.includes(typeBien);
}

/**
 * Message d'erreur DPE selon la région
 *
 * @param codePostal - Code postal du bien
 * @returns Message d'erreur contextualisé
 */
export function getDPEErrorMessage(codePostal: string | null | undefined): string {
  if (isDROM(codePostal)) {
    const deptName = getDepartementNameFromCP(codePostal);
    return `Le DPE est obligatoire pour les locations en ${deptName || "DOM-TOM"} depuis 2023. Veuillez renseigner la classe énergie.`;
  }
  return "Le DPE est obligatoire pour publier une annonce de location d'habitation. Veuillez renseigner la classe énergie.";
}

/**
 * Obtenir un résumé des diagnostics obligatoires manquants
 *
 * @param formData - Données du formulaire
 * @returns Liste des diagnostics manquants bloquants
 */
export function getDiagnosticsManquants(formData: {
  code_postal?: string | null;
  type?: string | null;
  type_bien?: string | null;
  dpe_classe_energie?: string | null;
  annee_construction?: number | null;
}): string[] {
  const manquants: string[] = [];
  const typeBien = formData.type || formData.type_bien || "";

  // Vérifier si habitation nécessitant DPE
  if (isDPEObligatoire(typeBien)) {
    if (!formData.dpe_classe_energie || formData.dpe_classe_energie === "NC") {
      manquants.push("DPE (Diagnostic de Performance Énergétique)");
    }
  }

  return manquants;
}

