import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Parse une valeur en Date de manière sécurisée.
 * Retourne null si la valeur est absente, vide ou invalide (évite les RangeError).
 */
export function safeDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formate une date de manière sécurisée.
 * Retourne le fallback (défaut : "Date non renseignée") si la valeur est invalide.
 */
export function safeDateFormat(
  value: string | Date | null | undefined,
  pattern: string = "dd/MM/yyyy",
  fallback: string = "Date non renseignée"
): string {
  const d = safeDate(value);
  if (!d) return fallback;
  return format(d, pattern, { locale: fr });
}
