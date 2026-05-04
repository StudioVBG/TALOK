/**
 * Mapping nature_juridique INSEE (code 4 chiffres) → forme juridique courte.
 *
 * Couvre les formes les plus fréquentes pour les artisans/prestataires.
 * Pour les autres, on retombe sur le libellé fourni par l'API ou "Autre".
 *
 * Référentiel officiel :
 *   https://www.insee.fr/fr/information/2028129
 */
const SHORT_FORM_BY_CODE: Record<string, string> = {
  "1000": "EI",
  "5202": "SNC",
  "5306": "SCS",
  "5410": "SARL",
  "5415": "SARL",
  "5422": "SARL",
  "5426": "SARL",
  "5430": "EURL",
  "5485": "SARL",
  "5498": "SARL",
  "5499": "SARL",
  "5505": "SA",
  "5510": "SA",
  "5515": "SA",
  "5520": "SA",
  "5530": "SA",
  "5599": "SA",
  "5710": "SAS",
  "5720": "SASU",
  "6540": "SCI",
  "6541": "SCI",
  "6542": "SCI",
  "9220": "Association",
};

export function shortFormeJuridique(
  code: string | null | undefined,
  libelle: string | null | undefined,
): string | null {
  if (code && SHORT_FORM_BY_CODE[code]) {
    return SHORT_FORM_BY_CODE[code];
  }
  if (libelle) {
    return libelle;
  }
  return null;
}
