/**
 * Constants for charges locatives module.
 * Décret 87-713 du 26 août 1987 : liste des charges récupérables.
 */

import type { ChargeCategoryCode } from "./types";

export interface ChargeCategoryDefinition {
  code: ChargeCategoryCode;
  label: string;
  description: string;
  examples: string[];
}

/**
 * Les 6 catégories de charges récupérables (décret 87-713)
 */
export const CHARGE_CATEGORIES: ChargeCategoryDefinition[] = [
  {
    code: "ascenseurs",
    label: "Ascenseurs et monte-charge",
    description: "Dépenses liées aux ascenseurs et monte-charge de l'immeuble",
    examples: [
      "Électricité ascenseur",
      "Contrat d'entretien ascenseur",
      "Inspection périodique",
      "Réparations menues (< 400€)",
    ],
  },
  {
    code: "eau_chauffage",
    label: "Eau et chauffage collectif",
    description: "Eau froide, eau chaude, chauffage collectif et entretien chaudière",
    examples: [
      "Eau froide collective",
      "Eau chaude sanitaire",
      "Chauffage collectif",
      "Entretien chaudière",
      "Traitement de l'eau",
    ],
  },
  {
    code: "installations_individuelles",
    label: "Installations individuelles",
    description: "Entretien des équipements individuels du logement",
    examples: [
      "Relevé compteurs individuels",
      "Entretien robinetterie",
      "Remplacement joints/clapets",
    ],
  },
  {
    code: "parties_communes",
    label: "Parties communes intérieures",
    description: "Entretien et petites réparations des parties communes",
    examples: [
      "Électricité parties communes",
      "Produits d'entretien",
      "Entretien minuterie",
      "Nettoyage parties communes",
      "Menues réparations",
    ],
  },
  {
    code: "espaces_exterieurs",
    label: "Espaces extérieurs",
    description: "Entretien des espaces verts, voies de circulation et aires de stationnement",
    examples: [
      "Entretien jardins",
      "Élagage arbres",
      "Entretien voirie privée",
      "Nettoyage parking",
    ],
  },
  {
    code: "taxes_redevances",
    label: "Taxes et redevances",
    description: "Taxes récupérables : ordures ménagères, assainissement, balayage",
    examples: [
      "Taxe d'enlèvement des ordures ménagères (TEOM)",
      "Redevance assainissement",
      "Taxe de balayage",
    ],
  },
];

/**
 * Get category definition by code
 */
export function getCategoryDefinition(
  code: ChargeCategoryCode
): ChargeCategoryDefinition | undefined {
  return CHARGE_CATEGORIES.find((c) => c.code === code);
}

/**
 * Get category label by code
 */
export function getCategoryLabel(code: ChargeCategoryCode): string {
  return getCategoryDefinition(code)?.label ?? code;
}

/**
 * Regularization status labels
 */
export const REGULARIZATION_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  calculated: "Calculée",
  sent: "Envoyée",
  acknowledged: "Reçue",
  contested: "Contestée",
  settled: "Soldée",
};

/**
 * Regularization status colors for badges
 */
export const REGULARIZATION_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  calculated: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  sent: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  acknowledged: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  contested: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  settled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

// ---------------------------------------------------------------------------
// Sprint 1 — Engine thresholds & PCG account codes
// ---------------------------------------------------------------------------

/**
 * Default management fees percentage applied on TEOM brut.
 * "Frais de gestion de la fiscalité directe locale" (~8%) — non recoverable
 * (DGFiP — décret 87-713 interprétation courante).
 * EPCI-specific rates (see `epci_reference.teom_rate_pct`) may override
 * this default when the real rate is known.
 */
export const FRAIS_GESTION_TEOM_PCT_DEFAULT = 8;

/**
 * Regularization prescription window in years.
 * Article 7-1 de la loi n° 89-462 du 6 juillet 1989 (introduit par loi ALUR 2014).
 * Passé ce délai, le propriétaire ne peut plus exiger le paiement de la régul.
 */
export const PRESCRIPTION_YEARS = 3;

/**
 * Number of months over which a tenant can legally spread a late regularization.
 * Si la régul intervient plus d'1 an après l'exigibilité, le locataire peut
 * exiger un échelonnement sur 12 mois (loi ALUR).
 */
export const ECHELEMENT_MONTHS = 12;

/**
 * Days in a standard (non-leap) year — used as default denominator for
 * prorata calculations. Callers may override when computing against a specific
 * calendar year (see `diffDays(periodStart, periodEnd)` for exact duration).
 */
export const DEFAULT_JOURS_ANNEE = 365;

/**
 * Talok PCG account codes used by the charges regularization engine
 * (see "Mapping PCG Talok" section in the skill).
 * Source of truth: `PCG_OWNER_ACCOUNTS` in `lib/accounting/chart-amort-ocr.ts`.
 *
 * Substitutions vs. theoretical PCG (skill):
 *   skill `4191`   → Talok `419100`
 *   skill `614`    → Talok `614100`
 *   skill `654`    → Talok `654000`
 *   skill `708300` → Talok `708000`
 */
export const PCG_ACCOUNTS = {
  /** Dette envers locataire — provisions reçues en attente de régularisation. */
  PROVISIONS_RECUES: "419100",
  /** Charges réelles récupérables — charges payées par le propriétaire. */
  CHARGES_RECUPERABLES: "614100",
  /** Charges non récupérées (renonciation propriétaire — déductible revenus fonciers). */
  CHARGES_NON_RECUPEREES: "654000",
  /** Produit refacturé au locataire (contrepartie de 4191). */
  CHARGES_REFACTUREES: "708000",
  /** Compte tiers — locataire (créance de régul en complément). */
  LOCATAIRE: "411000",
  /** Banque — compte courant (encaissement régul). */
  BANQUE: "512100",
  /** Charge TEOM propriétaire (informatif — TF globale côté proprio). */
  TEOM_CHARGE: "635200",
} as const;

export type PcgAccountCode = (typeof PCG_ACCOUNTS)[keyof typeof PCG_ACCOUNTS];
