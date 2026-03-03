/**
 * Validation IBAN selon ISO 13616
 *
 * L'IBAN est validé en 3 étapes :
 * 1. Format : 2 lettres (pays) + 2 chiffres (clé) + 10-30 alphanum (BBAN)
 * 2. Longueur par pays (ex: FR = 27 caractères)
 * 3. Clé de contrôle : modulo 97
 */

/** Longueurs IBAN par pays (ISO 3166-1 alpha-2) — pays les plus courants */
const IBAN_LENGTHS: Record<string, number> = {
  FR: 27, // France
  DE: 22, // Allemagne
  ES: 24, // Espagne
  IT: 27, // Italie
  BE: 16, // Belgique
  LU: 20, // Luxembourg
  CH: 21, // Suisse
  GB: 22, // Royaume-Uni
  PT: 25, // Portugal
  NL: 18, // Pays-Bas
  AT: 20, // Autriche
  MC: 27, // Monaco (même format que FR)
  AD: 24, // Andorre
  GP: 27, // Guadeloupe (FR)
  MQ: 27, // Martinique (FR)
  GF: 27, // Guyane française (FR)
  RE: 27, // Réunion (FR)
  YT: 27, // Mayotte (FR)
  PM: 27, // Saint-Pierre-et-Miquelon (FR)
  WF: 27, // Wallis-et-Futuna (FR)
  PF: 27, // Polynésie française (FR)
  NC: 27, // Nouvelle-Calédonie (FR)
  BL: 27, // Saint-Barthélemy (FR)
  MF: 27, // Saint-Martin (FR)
};

/**
 * Calcule le modulo 97 d'un grand nombre représenté en chaîne
 * (les IBAN convertis en nombre peuvent dépasser Number.MAX_SAFE_INTEGER)
 */
function mod97(numStr: string): number {
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numStr[i], 10)) % 97;
  }
  return remainder;
}

/**
 * Valide un IBAN selon ISO 13616
 * @param iban - L'IBAN à valider (avec ou sans espaces)
 * @returns true si l'IBAN est valide
 */
export function isValidIban(iban: string): boolean {
  // Nettoyer : supprimer espaces et mettre en majuscules
  const clean = iban.replace(/\s/g, "").toUpperCase();

  // Vérifier le format de base : 2 lettres + 2 chiffres + reste alphanum
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(clean)) {
    return false;
  }

  // Vérifier la longueur totale
  if (clean.length < 15 || clean.length > 34) {
    return false;
  }

  // Vérifier la longueur spécifique au pays (si connue)
  const countryCode = clean.substring(0, 2);
  const expectedLength = IBAN_LENGTHS[countryCode];
  if (expectedLength && clean.length !== expectedLength) {
    return false;
  }

  // Étape clé : vérification modulo 97
  // 1. Déplacer les 4 premiers caractères à la fin
  const rearranged = clean.substring(4) + clean.substring(0, 4);

  // 2. Convertir les lettres en chiffres (A=10, B=11, ..., Z=35)
  let numericStr = "";
  for (const char of rearranged) {
    if (char >= "A" && char <= "Z") {
      numericStr += (char.charCodeAt(0) - 55).toString();
    } else {
      numericStr += char;
    }
  }

  // 3. Calculer modulo 97 — doit être égal à 1
  return mod97(numericStr) === 1;
}

/**
 * Formate un IBAN pour l'affichage (groupes de 4 caractères)
 * Ex: FR7630006000011234567890189 → FR76 3000 6000 0112 3456 7890 189
 */
export function formatIban(iban: string): string {
  const clean = iban.replace(/\s/g, "").toUpperCase();
  return clean.replace(/(.{4})/g, "$1 ").trim();
}
