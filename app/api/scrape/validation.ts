/**
 * Validation cross-fields post-scrape pour /api/scrape.
 *
 * Le scoring d'extraction (route.ts §8) compte UNIQUEMENT la présence des
 * champs ; il ne dit rien sur leur cohérence. Or un parsing à moitié cassé
 * peut ramener un loyer plausible accolé à une surface aberrante (ex : 12 m²
 * au lieu de 120, ou 5 000 € au lieu de 500). On veut alerter l'utilisateur
 * AVANT qu'il valide silencieusement.
 *
 * Ce module produit des warnings textuels — pas d'erreur dure : le scraper
 * ne BLOQUE jamais l'import (rule-based + LLM ont déjà fait leur effort).
 * On surface les warnings dans extraction_quality.warnings côté client.
 *
 * Toutes les bornes sont calibrées sur le marché locatif français
 * métropolitain + DROM. Hors plage = warning, pas rejet.
 */

import { findCityFromCP, normalizeText, type ExtractedData } from "./extractors";

export interface ValidationWarning {
  /** Identifiant court pour les tests + l'UI conditionnelle. */
  code: string;
  /** Message lisible (FR), affichable directement au propriétaire. */
  message: string;
  /** Sévérité : 'info' = à vérifier, 'warning' = très probable problème. */
  severity: "info" | "warning";
}

/**
 * Bornes du loyer au m² hors charges. Calibrées sur observations 2024-2026 :
 *   - Plancher 5 €/m² : zones rurales très détendues + parkings/box
 *     (les parkings sont déjà filtrés par le type côté wizard).
 *   - Plafond 60 €/m² : Paris hyper-centre / Côte d'Azur. Au-dessus =
 *     très probablement un parsing buggé (centimes interprétés comme euros).
 */
const RENT_PER_SQM_MIN = 5;
const RENT_PER_SQM_MAX = 60;

/**
 * Surface mini par pièce. En dessous, soit le nb_pieces est gonflé
 * (cuisine/sdb comptées), soit la surface est tronquée. Ex : un T3 en
 * dessous de 21 m² (3 × 7) est très improbable.
 */
const MIN_SQM_PER_ROOM = 7;

/**
 * Vérifie la cohérence du couple (loyer_hc, surface) via le €/m².
 * Skip si un des deux manque (rien à comparer).
 */
function checkRentPerSqm(data: ExtractedData): ValidationWarning | null {
  if (!data.loyer_hc || !data.surface) return null;
  const ratio = data.loyer_hc / data.surface;
  if (ratio < RENT_PER_SQM_MIN) {
    return {
      code: "RENT_PER_SQM_TOO_LOW",
      severity: "info",
      message: `Loyer très bas (${ratio.toFixed(1)} €/m²). Vérifiez la surface et le loyer hors charges.`,
    };
  }
  if (ratio > RENT_PER_SQM_MAX) {
    return {
      code: "RENT_PER_SQM_TOO_HIGH",
      severity: "warning",
      message: `Loyer très élevé (${ratio.toFixed(1)} €/m²). Probable erreur de parsing — vérifiez avant publication.`,
    };
  }
  return null;
}

/**
 * Détecte les surfaces aberrantes par rapport au nombre de pièces.
 * Un T4 à 25 m² ou un studio à 200 m² sont presque toujours des erreurs OCR.
 */
function checkSurfaceVsRooms(data: ExtractedData): ValidationWarning | null {
  if (!data.surface || !data.nb_pieces) return null;
  if (data.nb_pieces > 0 && data.surface / data.nb_pieces < MIN_SQM_PER_ROOM) {
    return {
      code: "SURFACE_TOO_SMALL_FOR_ROOMS",
      severity: "warning",
      message: `${data.surface} m² pour ${data.nb_pieces} pièces semble incohérent. Vérifiez la surface.`,
    };
  }
  return null;
}

/**
 * Vérifie que charges ≤ loyer_hc. Au-dessus, le parsing a probablement
 * inversé les deux ou pris la TVA pour les charges.
 */
function checkChargesNotAboveRent(data: ExtractedData): ValidationWarning | null {
  if (!data.charges || !data.loyer_hc) return null;
  if (data.charges > data.loyer_hc) {
    return {
      code: "CHARGES_ABOVE_RENT",
      severity: "warning",
      message: `Charges (${data.charges} €) supérieures au loyer hors charges (${data.loyer_hc} €). Probable inversion.`,
    };
  }
  return null;
}

/**
 * Vérifie que ville et code postal sont cohérents via le mapping
 * CP→Ville. Compare en texte normalisé (sans accents, lowercase).
 * Tolère les communes inconnues du mapping (renvoie null sans warning).
 */
function checkCityVsPostalCode(data: ExtractedData): ValidationWarning | null {
  if (!data.code_postal || !data.ville) return null;
  const expectedCity = findCityFromCP(data.code_postal);
  if (!expectedCity) return null; // CP non mappé : on ne peut rien dire
  const normalizedExpected = normalizeText(expectedCity);
  const normalizedActual = normalizeText(data.ville);
  // Tolère le préfixe "Paris" pour les arrondissements ("Paris 11ème" → "Paris")
  if (
    normalizedActual !== normalizedExpected &&
    !normalizedActual.startsWith(normalizedExpected) &&
    !normalizedExpected.startsWith(normalizedActual)
  ) {
    return {
      code: "CITY_POSTAL_MISMATCH",
      severity: "warning",
      message: `Le code postal ${data.code_postal} correspond à "${expectedCity}", pas "${data.ville}". Vérifiez l'adresse.`,
    };
  }
  return null;
}

/**
 * Année de construction plausible (1700 → année courante + 5 pour les VEFA).
 */
function checkConstructionYear(data: ExtractedData): ValidationWarning | null {
  if (!data.annee_construction) return null;
  const currentYear = new Date().getFullYear();
  if (data.annee_construction < 1700 || data.annee_construction > currentYear + 5) {
    return {
      code: "CONSTRUCTION_YEAR_INVALID",
      severity: "warning",
      message: `Année de construction "${data.annee_construction}" invalide. Vérifiez la donnée.`,
    };
  }
  return null;
}

/**
 * DPE G interdit à la location depuis 2025 (sauf colocation, gérée plus loin
 * dans le wizard via type_bail). On émet un info pour rappeler la contrainte ;
 * la décision reste côté propriétaire.
 */
function checkDpeRentability(data: ExtractedData): ValidationWarning | null {
  if (data.dpe_classe_energie === "G") {
    return {
      code: "DPE_G_RESTRICTION",
      severity: "info",
      message: "Logement classé G : interdiction de location depuis 2025 (sauf colocation). Vérifiez l'éligibilité avant publication.",
    };
  }
  return null;
}

/**
 * Lance toutes les vérifications et renvoie la liste des warnings non-null.
 */
export function validateExtractedData(data: ExtractedData): ValidationWarning[] {
  const checks = [
    checkRentPerSqm,
    checkSurfaceVsRooms,
    checkChargesNotAboveRent,
    checkCityVsPostalCode,
    checkConstructionYear,
    checkDpeRentability,
  ];
  const warnings: ValidationWarning[] = [];
  for (const check of checks) {
    const result = check(data);
    if (result) warnings.push(result);
  }
  return warnings;
}

/**
 * Normalise une adresse pour la comparaison de doublon : minuscules, sans
 * accents, espaces collapsés, tirets et virgules retirés. Permet de matcher
 * "10, Avenue de la République" et "10 avenue de la republique".
 *
 * Exporté pour les tests + la route.
 */
export function normalizeAddressForDuplicate(address: string | null | undefined): string {
  if (!address) return "";
  return normalizeText(address)
    .replace(/[,;]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "");
}
