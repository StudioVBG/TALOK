/**
 * Parseur MRZ TD1 pour la CNI française (post-2021)
 *
 * Format TD1 (ICAO 9303 Part 5) : 3 lignes de 30 caractères
 *
 * Ligne 1 : IDFRA[doc_number 9][check_digit][optional 15 chars filler <]
 * Ligne 2 : [date_naissance YYMMDD][check][sexe M/F][date_expiration YYMMDD][check][nationalité 3][optional 11][check_composite]
 * Ligne 3 : [NOM<<PRENOM<PRENOM<...]
 *
 * Algorithme check digit : modulus 10, poids 7-3-1 répétés
 */

export interface MRZData {
  document_type: string;
  country_code: string;
  document_number: string;
  date_of_birth: string; // YYYY-MM-DD
  sex: "M" | "F";
  expiry_date: string; // YYYY-MM-DD
  nationality: string;
  last_name: string;
  first_name: string;
  is_valid: boolean;
}

const CHAR_VALUE: Record<string, number> = {};
// 0-9 -> 0-9
for (let i = 0; i <= 9; i++) CHAR_VALUE[String(i)] = i;
// A-Z -> 10-35
for (let i = 0; i < 26; i++) CHAR_VALUE[String.fromCharCode(65 + i)] = i + 10;
// < -> 0
CHAR_VALUE["<"] = 0;

const WEIGHTS = [7, 3, 1];

/**
 * Calcule le check digit modulus 10 avec poids 7-3-1
 */
export function computeCheckDigit(data: string): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data[i].toUpperCase();
    const val = CHAR_VALUE[char] ?? 0;
    sum += val * WEIGHTS[i % 3];
  }
  return sum % 10;
}

/**
 * Valide un check digit
 */
export function validateCheckDigit(
  data: string,
  expectedDigit: string
): boolean {
  return computeCheckDigit(data) === parseInt(expectedDigit, 10);
}

/**
 * Convertit une date YYMMDD en YYYY-MM-DD
 * Pour les dates de naissance : 00-99 -> 1930-2029
 * Pour les dates d'expiration : 00-99 -> 2000-2099
 */
function parseMRZDate(yymmdd: string, isExpiry: boolean): string {
  const yy = parseInt(yymmdd.substring(0, 2), 10);
  const mm = yymmdd.substring(2, 4);
  const dd = yymmdd.substring(4, 6);

  let century: number;
  if (isExpiry) {
    century = 2000;
  } else {
    century = yy <= 29 ? 2000 : 1900;
  }

  const yyyy = century + yy;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse les noms depuis la ligne 3 du MRZ
 * Format : NOM<<PRENOM<DEUXIEME_PRENOM<...
 */
function parseName(line3: string): { last_name: string; first_name: string } {
  const cleaned = line3.replace(/[^A-Z<]/g, "");
  const parts = cleaned.split("<<");

  const lastName = (parts[0] || "").replace(/</g, " ").trim();
  const firstName = (parts[1] || "").replace(/</g, " ").trim();

  return { last_name: lastName, first_name: firstName };
}

/**
 * Détecte les lignes MRZ dans un texte OCR brut.
 * Cherche 3 lignes consécutives d'environ 30 caractères contenant
 * uniquement [A-Z0-9<].
 */
export function detectMRZ(ocrText: string): string[] | null {
  const lines = ocrText
    .split(/\r?\n/)
    .map((l) => l.trim().toUpperCase())
    .filter((l) => l.length > 0);

  for (let i = 0; i <= lines.length - 3; i++) {
    const candidate = [lines[i], lines[i + 1], lines[i + 2]];

    const allValid = candidate.every((line) => {
      // Nettoyer les espaces et caractères parasites de l'OCR
      const cleaned = line.replace(/\s/g, "").replace(/[O]/g, (ch, idx) => {
        // Garder le O qui fait partie des noms, ne pas le remplacer en 0
        return ch;
      });
      // Tolérance : accepter entre 28 et 32 chars (OCR peut rater/ajouter des chars)
      return cleaned.length >= 28 && cleaned.length <= 32 && /^[A-Z0-9<]{28,32}$/.test(cleaned);
    });

    if (allValid) {
      // Normaliser chaque ligne à exactement 30 chars
      return candidate.map((line) => {
        const cleaned = line.replace(/\s/g, "");
        if (cleaned.length > 30) return cleaned.substring(0, 30);
        if (cleaned.length < 30) return cleaned.padEnd(30, "<");
        return cleaned;
      });
    }
  }

  return null;
}

/**
 * Parse un MRZ TD1 (3 lignes de 30 caractères) pour la CNI française
 */
export function parseTD1(lines: string[]): MRZData | null {
  if (lines.length !== 3) return null;

  const [line1, line2, line3] = lines;

  // Ligne 1 : document type + country + doc number + check digit
  const docType = line1.substring(0, 2).replace(/</g, "");
  const countryCode = line1.substring(2, 5).replace(/</g, "");
  const docNumber = line1.substring(5, 14).replace(/</g, "");
  const docNumberCheck = line1[14];

  // Ligne 2 : date de naissance + check + sexe + date expiration + check + nationalité
  const dob = line2.substring(0, 6);
  const dobCheck = line2[6];
  const sex = line2[7] as "M" | "F";
  const expiry = line2.substring(8, 14);
  const expiryCheck = line2[14];
  const nationality = line2.substring(15, 18).replace(/</g, "");

  // Ligne 3 : noms
  const { last_name, first_name } = parseName(line3);

  // Validation des check digits
  const docNumberValid = validateCheckDigit(
    line1.substring(5, 14),
    docNumberCheck
  );
  const dobValid = validateCheckDigit(dob, dobCheck);
  const expiryValid = validateCheckDigit(expiry, expiryCheck);
  const isValid = docNumberValid && dobValid && expiryValid;

  return {
    document_type: docType,
    country_code: countryCode,
    document_number: docNumber,
    date_of_birth: parseMRZDate(dob, false),
    sex,
    expiry_date: parseMRZDate(expiry, true),
    nationality,
    last_name,
    first_name,
    is_valid: isValid,
  };
}

/**
 * Tente d'extraire les données MRZ d'un texte OCR.
 * Retourne null si aucun MRZ n'est détecté.
 */
export function extractMRZFromOCR(ocrText: string): MRZData | null {
  const lines = detectMRZ(ocrText);
  if (!lines) return null;
  return parseTD1(lines);
}
