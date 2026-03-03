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

// ============================================
// IBAN VALIDATION (ISO 7064 / MOD-97-10)
// ============================================

/**
 * Valide un IBAN selon la norme ISO 13616 (MOD-97-10).
 *
 * Étapes :
 * 1. Retirer les espaces, mettre en majuscules
 * 2. Vérifier la longueur (15-34) et le format (2 lettres + 2 chiffres + alphanum)
 * 3. Déplacer les 4 premiers caractères à la fin
 * 4. Remplacer les lettres par leur valeur numérique (A=10, B=11, ..., Z=35)
 * 5. Calculer le modulo 97 — doit être égal à 1
 */
export function isValidIban(iban: string): boolean {
  const clean = iban.replace(/\s/g, "").toUpperCase();

  // Longueur: 15-34 caractères
  if (clean.length < 15 || clean.length > 34) return false;

  // Format: 2 lettres (pays) + 2 chiffres (clé) + reste alphanumérique
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(clean)) return false;

  // Déplacer les 4 premiers caractères à la fin
  const rearranged = clean.substring(4) + clean.substring(0, 4);

  // Convertir les lettres en chiffres (A=10, B=11, ..., Z=35)
  let numericStr = "";
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      // A-Z → 10-35
      numericStr += (code - 55).toString();
    } else {
      numericStr += ch;
    }
  }

  // Calculer MOD-97 en morceaux (pour éviter les dépassements de Number)
  let remainder = 0;
  for (let i = 0; i < numericStr.length; i += 7) {
    const chunk = numericStr.substring(i, i + 7);
    remainder = parseInt(remainder.toString() + chunk, 10) % 97;
  }

  return remainder === 1;
}

/**
 * Formate un IBAN pour l'affichage : FR76 1234 5678 9012 3456 7890 123
 */
export function formatIban(iban: string): string {
  const clean = iban.replace(/\s/g, "").toUpperCase();
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Masque un IBAN pour l'affichage sécurisé : FR76 •••• •••• •••• •••• •••• 123
 */
export function maskIban(iban: string): string {
  const clean = iban.replace(/\s/g, "").toUpperCase();
  if (clean.length < 7) return "••••";
  const prefix = clean.substring(0, 4);
  const suffix = clean.substring(clean.length - 3);
  const maskedMiddle = "•".repeat(clean.length - 7);
  const full = prefix + maskedMiddle + suffix;
  return full.replace(/(.{4})/g, "$1 ").trim();
}
