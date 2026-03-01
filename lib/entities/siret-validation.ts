/**
 * Validation SIRET/SIREN selon l'algorithme de Luhn
 *
 * Le SIRET (14 chiffres) = SIREN (9 premiers) + NIC (5 derniers).
 * L'algorithme de Luhn est appliqué sur les 14 chiffres du SIRET
 * et séparément sur les 9 chiffres du SIREN.
 *
 * Exceptions connues : La Poste (SIREN 356000000) utilise un checksum
 * différent. On le gère en fallback.
 */

/**
 * Vérifie la validité d'un numéro via l'algorithme de Luhn
 */
function luhnCheck(digits: string): boolean {
  let sum = 0;
  const len = digits.length;
  for (let i = 0; i < len; i++) {
    let digit = parseInt(digits[len - 1 - i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * Valide un numéro SIREN (9 chiffres)
 * @returns true si le SIREN est valide
 */
export function isValidSiren(siren: string): boolean {
  const digits = siren.replace(/\s/g, "");
  if (!/^\d{9}$/.test(digits)) return false;
  // Exception La Poste
  if (digits === "356000000") return true;
  return luhnCheck(digits);
}

/**
 * Valide un numéro SIRET (14 chiffres)
 * @returns true si le SIRET est valide
 */
export function isValidSiret(siret: string): boolean {
  const digits = siret.replace(/\s/g, "");
  if (!/^\d{14}$/.test(digits)) return false;

  // Vérifier le SIREN (9 premiers chiffres)
  const siren = digits.substring(0, 9);
  if (!isValidSiren(siren)) return false;

  // Exception La Poste : somme des chiffres % 5 === 0
  if (siren === "356000000") {
    const sum = digits.split("").reduce((s, c) => s + parseInt(c, 10), 0);
    return sum % 5 === 0;
  }

  // Vérifier le SIRET complet (14 chiffres)
  return luhnCheck(digits);
}

/**
 * Extrait le SIREN d'un SIRET (9 premiers chiffres)
 */
export function siretToSiren(siret: string): string | null {
  const digits = siret.replace(/\s/g, "");
  if (digits.length < 9) return null;
  return digits.substring(0, 9);
}

/**
 * Formate un SIRET pour l'affichage : 123 456 789 01234
 */
export function formatSiret(siret: string): string {
  const digits = siret.replace(/\D/g, "");
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4");
}

/**
 * Formate un SIREN pour l'affichage : 123 456 789
 */
export function formatSiren(siren: string): string {
  const digits = siren.replace(/\D/g, "");
  return digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
}
