/**
 * Normalisation unique des numéros de téléphone vers E.164.
 *
 * Supporte métropole + DROM-COM en détectant les préfixes mobiles locaux
 * (ex: 0696 en Martinique → +596) avant de retomber sur 'FR' (+33).
 */

import {
  parsePhoneNumberWithError,
  isValidPhoneNumber,
  type CountryCode,
} from 'libphonenumber-js';

export type Territory =
  | 'FR' // Métropole
  | 'MQ' // Martinique (+596)
  | 'GP' // Guadeloupe (+590, inclut Saint-Martin & Saint-Barthélemy)
  | 'GF' // Guyane (+594)
  | 'RE' // La Réunion (+262)
  | 'YT' // Mayotte (+262)
  | 'PM' // Saint-Pierre-et-Miquelon (+508)
  | 'NC' // Nouvelle-Calédonie (+687)
  | 'PF' // Polynésie française (+689)
  | 'WF' // Wallis-et-Futuna (+681)
  | 'BL' // Saint-Barthélemy (+590)
  | 'MF'; // Saint-Martin (+590)

/**
 * Préfixes 4 chiffres pour numéros mobiles saisis en format national
 * (ex: "0696..." pour la Martinique). Couvre uniquement les DROM où
 * les utilisateurs saisissent couramment leur numéro avec un 0 initial.
 */
const DROM_PREFIXES: Record<string, Territory> = {
  // Martinique : mobiles 0596 / 0696 / 0697
  '0596': 'MQ',
  '0696': 'MQ',
  '0697': 'MQ',
  // Guadeloupe / Saint-Martin / Saint-Barthélemy : 0590 / 0690 / 0691
  '0590': 'GP',
  '0690': 'GP',
  '0691': 'GP',
  // Guyane : 0594 / 0694
  '0594': 'GF',
  '0694': 'GF',
  // La Réunion : 0262 / 0692 / 0693
  '0262': 'RE',
  '0692': 'RE',
  '0693': 'RE',
  // Mayotte : 0269 / 0639
  '0269': 'YT',
  '0639': 'YT',
  // Saint-Pierre-et-Miquelon : 0508
  '0508': 'PM',
};

function stripSeparators(raw: string): string {
  return raw.replace(/[\s.\-()\u00A0]/g, '');
}

/**
 * Normalise un numéro vers E.164.
 *
 * - `+<code>...` E.164 valide → inchangé
 * - Préfixe national DROM connu → indicatif pays local
 * - Sinon → FR métropole
 *
 * @throws si le numéro est invalide après normalisation.
 */
export function normalizePhoneE164(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Numéro de téléphone vide');
  }
  const cleaned = stripSeparators(raw);

  if (cleaned.startsWith('+')) {
    if (!isValidPhoneNumber(cleaned)) {
      throw new Error(`Numéro E.164 invalide : ${raw}`);
    }
    return parsePhoneNumberWithError(cleaned).number;
  }

  const prefix4 = cleaned.slice(0, 4);
  const territory = DROM_PREFIXES[prefix4];
  const country: CountryCode = (territory as CountryCode) ?? 'FR';

  const parsed = parsePhoneNumberWithError(cleaned, country);
  if (!parsed.isValid()) {
    throw new Error(`Numéro invalide : ${raw}`);
  }
  return parsed.number;
}

/**
 * Détecte le territoire (code pays ISO) à partir d'un numéro E.164.
 * Retourne null si non déterminable ou hors périmètre FR/DROM-COM.
 */
export function detectTerritory(e164: string): Territory | null {
  try {
    const parsed = parsePhoneNumberWithError(e164);
    const c = parsed.country as Territory | undefined;
    if (!c) return null;
    const allowed: Territory[] = ['FR', 'MQ', 'GP', 'GF', 'RE', 'YT', 'PM', 'NC', 'PF', 'WF', 'BL', 'MF'];
    return allowed.includes(c) ? c : null;
  } catch {
    return null;
  }
}

/**
 * Masque un numéro pour les logs (garde indicatif + 3 derniers chiffres).
 * Ex: +596696123456 → +596696***456
 */
export function maskPhone(e164: string): string {
  if (!e164 || e164.length < 7) return '***';
  const head = e164.slice(0, 7);
  const tail = e164.slice(-3);
  return `${head}***${tail}`;
}

/**
 * Vérifie qu'un numéro peut être normalisé (sans lancer).
 */
export function isNormalizablePhone(raw: string): boolean {
  try {
    normalizePhoneE164(raw);
    return true;
  } catch {
    return false;
  }
}
