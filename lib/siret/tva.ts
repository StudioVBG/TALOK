/**
 * Calcule le numéro de TVA intracommunautaire à partir d'un SIREN français.
 *
 * Formule officielle :
 *   clé = (12 + 3 × (SIREN mod 97)) mod 97
 *   TVA = "FR" + clé sur 2 chiffres + SIREN
 *
 * Source : https://www.economie.gouv.fr/cedef/numero-tva-intracommunautaire
 */
export function computeTvaIntra(siren: string): string {
  const digits = siren.replace(/\D/g, "");
  if (!/^\d{9}$/.test(digits)) {
    throw new Error("SIREN invalide pour le calcul TVA");
  }
  const sirenNum = BigInt(digits);
  const key = (12n + ((3n * (sirenNum % 97n)) % 97n)) % 97n;
  const keyStr = key.toString().padStart(2, "0");
  return `FR${keyStr}${digits}`;
}
