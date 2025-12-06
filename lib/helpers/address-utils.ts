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

