/**
 * Classification "charges récupérables" d'un ticket / work_order.
 *
 * Règle métier : décret n° 87-713 du 26 août 1987 (liste limitative des
 * charges récupérables sur le locataire).
 *
 * Le helper renvoie une **suggestion** pour une catégorie d'intervention
 * donnée. Le propriétaire reste libre de confirmer ou modifier au cas par
 * cas — une fuite de plomberie peut être causée par la vétusté (non
 * récupérable) ou par un mauvais usage du locataire (récupérable).
 *
 * Convention :
 *   - `suggested = true`  : par défaut on coche "à charge du locataire"
 *   - `suggested = false` : par défaut on laisse à charge du propriétaire
 *   - `suggested = null`  : ambigu, on n'impose pas de default → l'owner décide
 */

import type { TenantBookableCategory } from "./tenant-service-permissions";

/** Catégories canoniques du système de régularisation (décret 87-713). */
export type CanonicalChargeCategory =
  | "ascenseurs"
  | "eau_chauffage"
  | "installations_individuelles"
  | "parties_communes"
  | "espaces_exterieurs"
  | "taxes_redevances";

export interface ChargeClassificationSuggestion {
  /** Suggestion initiale ; null = à décider par le propriétaire. */
  is_tenant_chargeable: boolean | null;
  /** Catégorie canonique à utiliser quand la charge est récupérable. */
  charge_category_code: CanonicalChargeCategory | null;
  /** Raison synthétique (pour tooltip UI / audit). */
  rationale: string;
}

const AMBIGUOUS: ChargeClassificationSuggestion = {
  is_tenant_chargeable: null,
  charge_category_code: null,
  rationale:
    "Ambigu : dépend de la cause (vétusté = propriétaire, usage = locataire). À décider au cas par cas.",
};

/**
 * Suggère la classification pour une catégorie de TICKET (tickets.category).
 * Valeurs acceptées : les 10 catégories de tickets_module_sota.
 */
export function suggestForTicketCategory(
  category: string | null | undefined
): ChargeClassificationSuggestion {
  switch (category) {
    // Entretien sanitaire courant, mais beaucoup de cas vétusté → ambigu
    case "plomberie":
    case "electricite":
    case "serrurerie":
    case "chauffage":
      return AMBIGUOUS;

    // Problème structurel, toujours à la charge du propriétaire
    case "humidite":
      return {
        is_tenant_chargeable: false,
        charge_category_code: null,
        rationale: "Humidité/infiltration = défaut du bâti, à la charge du propriétaire.",
      };

    // Traitement nuisibles ponctuel = entretien récupérable (jurisprudence
    // constante si l'infestation n'est pas liée à un défaut du bâti)
    case "nuisibles":
      return {
        is_tenant_chargeable: true,
        charge_category_code: "parties_communes",
        rationale:
          "Traitement nuisibles ponctuel = entretien récupérable (décret 87-713 art. 2).",
      };

    // Pas une intervention matérielle — ne se classe pas en charge
    case "bruit":
      return {
        is_tenant_chargeable: false,
        charge_category_code: null,
        rationale: "Pas une dépense récupérable.",
      };

    // Géré par le syndic ; le coût passe par la copropriété, pas par le ticket
    case "parties_communes":
      return {
        is_tenant_chargeable: false,
        charge_category_code: null,
        rationale:
          "Les interventions sur parties communes sont refacturées par le syndic via l'état des charges.",
      };

    case "equipement":
    case "autre":
    default:
      return AMBIGUOUS;
  }
}

/**
 * Suggère la classification pour une catégorie de SELF-SERVICE locataire
 * (TENANT_BOOKABLE_CATEGORIES). Par construction ces catégories sont
 * toutes récupérables : le locataire réserve lui-même → le coût doit
 * lui être imputé.
 */
export function suggestForTenantBookableCategory(
  category: TenantBookableCategory
): ChargeClassificationSuggestion {
  switch (category) {
    case "jardinage":
      return {
        is_tenant_chargeable: true,
        charge_category_code: "espaces_exterieurs",
        rationale:
          "Entretien des espaces verts = charge récupérable (décret 87-713 art. 3).",
      };
    case "nettoyage":
      return {
        is_tenant_chargeable: true,
        charge_category_code: "parties_communes",
        rationale:
          "Nettoyage courant = charge récupérable (décret 87-713 art. 2).",
      };
    case "petits_travaux":
      return {
        is_tenant_chargeable: true,
        charge_category_code: "installations_individuelles",
        rationale:
          "Menues réparations = charge récupérable (décret 87-713 art. 4).",
      };
    case "peinture":
      return {
        is_tenant_chargeable: true,
        charge_category_code: "installations_individuelles",
        rationale:
          "Rafraîchissement peinture à l'initiative du locataire = à sa charge.",
      };
    case "demenagement":
      return {
        is_tenant_chargeable: true,
        charge_category_code: null,
        rationale: "Frais de déménagement = toujours à la charge du locataire.",
      };
    default:
      return AMBIGUOUS;
  }
}
