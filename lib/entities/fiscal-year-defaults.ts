/**
 * Calcul des dates d'exercice fiscal par défaut pour une entité juridique.
 *
 * Règles métier :
 * - Régime IR (particulier, SCI-IR, SARL de famille à l'IR) :
 *   exercice = année civile stricte (01/01 → 31/12)
 * - Régime IS : par défaut année civile, mais peut être décalé.
 * - Entité créée en cours d'année : le premier exercice court de
 *   `date_creation` jusqu'au 31/12 de la même année.
 * - `date_cloture_exercice` dérive de `premier_exercice_fin` au format 'MM-DD'.
 */

export interface FiscalYearDefaults {
  premierExerciceDebut: string; // YYYY-MM-DD
  premierExerciceFin: string; // YYYY-MM-DD
  dateClotureExercice: string; // MM-DD
}

const IR_REGIMES = new Set(["ir", "ir_option_is", "micro_foncier"]);

function isCalendarYearForced(regimeFiscal?: string | null): boolean {
  if (!regimeFiscal) return true;
  return IR_REGIMES.has(regimeFiscal);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Calcule les dates d'exercice fiscal par défaut.
 *
 * @param regimeFiscal - Régime fiscal de l'entité
 * @param dateCreation - Date de création (optionnelle). Si absente, on utilise aujourd'hui.
 * @param referenceDate - Date de référence pour les tests (aujourd'hui par défaut).
 */
export function computeFiscalYearDefaults(
  regimeFiscal: string | null | undefined,
  dateCreation?: string | null,
  referenceDate: Date = new Date()
): FiscalYearDefaults {
  const creation = parseIsoDate(dateCreation || "") ?? referenceDate;
  const year = creation.getUTCFullYear();

  const forcedCalendar = isCalendarYearForced(regimeFiscal);

  const debutIso = forcedCalendar
    ? `${year}-01-01`
    : toIsoDate(creation);

  const finIso = `${year}-12-31`;

  return {
    premierExerciceDebut: debutIso,
    premierExerciceFin: finIso,
    dateClotureExercice: "12-31",
  };
}

/**
 * Dérive `date_cloture_exercice` ('MM-DD') depuis `premier_exercice_fin`.
 */
export function deriveDateCloture(premierExerciceFin: string): string {
  const d = parseIsoDate(premierExerciceFin);
  if (!d) return "12-31";
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

/**
 * Vérifie que debut < fin et que les deux sont des dates ISO valides.
 */
export function validateFiscalYearRange(
  debut: string,
  fin: string
): { valid: boolean; error?: string } {
  const d1 = parseIsoDate(debut);
  const d2 = parseIsoDate(fin);
  if (!d1) return { valid: false, error: "Date de début d'exercice invalide" };
  if (!d2) return { valid: false, error: "Date de fin d'exercice invalide" };
  if (d2.getTime() <= d1.getTime()) {
    return { valid: false, error: "La fin d'exercice doit être postérieure au début" };
  }
  return { valid: true };
}
