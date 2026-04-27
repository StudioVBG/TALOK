/**
 * Helpers TEOM extraits de l'OCR d'un avis de taxe foncière.
 *
 * Le moteur OCR (cf. OCR_EXTRACTION_SYSTEM_PROMPT) renvoie un objet
 * `taxe_fonciere` { teom_cents, taxe_fonciere_part_cents, ... } quand le
 * document est un avis de taxe foncière. Ces helpers normalisent l'extrait
 * pour les callers (route /validate, UI upload).
 *
 * Aucune valeur fabriquée : si la TEOM n'est pas extraite ou vaut 0, on
 * renvoie null. La règle décret 87-713 (récupérabilité TEOM uniquement)
 * reste vérifiée côté caller.
 */

export interface TeomExtraction {
  teomCents: number;
  taxeFonciereTotalCents: number;
  /** Année fiscale, si fournie par l'OCR. */
  annee: number | null;
}

const TAXE_FONCIERE_DOCUMENT_TYPES = new Set([
  "taxe_fonciere",
  "avis_impot",
  "avis_imposition",
]);

interface ExtractedDataLike {
  document_type?: unknown;
  montant_ttc_cents?: unknown;
  taxe_fonciere?: unknown;
}

interface TaxeFonciereSubObject {
  teom_cents?: unknown;
  taxe_fonciere_part_cents?: unknown;
  annee?: unknown;
}

function asPositiveInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const v = Math.round(value);
  return v > 0 ? v : 0;
}

function asYear(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const v = Math.round(value);
  return v >= 1900 && v <= 2999 ? v : null;
}

/**
 * Extract a normalized TEOM block from the OCR `extracted_data` payload.
 * Returns null if the document is not a tax notice or no TEOM was detected.
 */
export function extractTeomFromAnalysis(
  extracted: ExtractedDataLike | null | undefined,
): TeomExtraction | null {
  if (!extracted) return null;

  const docType =
    typeof extracted.document_type === "string"
      ? extracted.document_type.toLowerCase()
      : "";
  if (!TAXE_FONCIERE_DOCUMENT_TYPES.has(docType)) {
    return null;
  }

  const sub = extracted.taxe_fonciere as TaxeFonciereSubObject | null;
  if (!sub || typeof sub !== "object") return null;

  const teomCents = asPositiveInt(sub.teom_cents);
  if (teomCents <= 0) return null;

  const ttcCents = asPositiveInt(extracted.montant_ttc_cents);
  const partCents = asPositiveInt(sub.taxe_fonciere_part_cents);
  const totalCents = ttcCents > 0 ? ttcCents : partCents + teomCents;

  // Garde-fou : la TEOM ne peut pas dépasser le total de l'avis.
  if (totalCents > 0 && teomCents > totalCents) {
    return null;
  }

  return {
    teomCents,
    taxeFonciereTotalCents: totalCents,
    annee: asYear(sub.annee),
  };
}
