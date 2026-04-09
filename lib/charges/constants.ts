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
