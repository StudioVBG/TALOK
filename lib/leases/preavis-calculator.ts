/**
 * PreavisCalculator — Calcul des préavis légaux selon type de bail
 *
 * Implémente les durées de préavis conformément à :
 * - Loi du 6 juillet 1989 (article 15)
 * - Loi ALUR (zone tendue)
 * - Code civil pour les baux spéciaux
 */

export type BailType =
  | "nu"
  | "meuble"
  | "etudiant"
  | "mobilite"
  | "saisonnier"
  | "colocation";

export type Initiateur = "owner" | "tenant";

export interface PreavisConfig {
  /** Durée standard en mois */
  standardMonths: number;
  /** Durée réduite en mois (zone tendue ou motif légitime) */
  reducedMonths: number;
  /** Label du type de bail */
  label: string;
  /** Le préavis réduit est-il possible pour ce type? */
  canReduce: boolean;
}

/**
 * Configuration des préavis locataire par type de bail.
 * Conforme à la loi du 6 juillet 1989 et la loi ALUR.
 */
export const TENANT_NOTICE_PERIODS: Record<BailType, PreavisConfig> = {
  nu: {
    standardMonths: 3,
    reducedMonths: 1,
    label: "Location nue",
    canReduce: true,
  },
  meuble: {
    standardMonths: 1,
    reducedMonths: 1,
    label: "Location meublée",
    canReduce: false,
  },
  etudiant: {
    standardMonths: 1,
    reducedMonths: 1,
    label: "Bail étudiant",
    canReduce: false,
  },
  mobilite: {
    standardMonths: 1,
    reducedMonths: 1,
    label: "Bail mobilité",
    canReduce: false,
  },
  saisonnier: {
    standardMonths: 0,
    reducedMonths: 0,
    label: "Location saisonnière",
    canReduce: false,
  },
  colocation: {
    standardMonths: 1,
    reducedMonths: 1,
    label: "Colocation",
    canReduce: false,
  },
};

/**
 * Configuration des préavis bailleur (congé bailleur).
 */
export const OWNER_NOTICE_PERIODS: Record<BailType, PreavisConfig> = {
  nu: {
    standardMonths: 6,
    reducedMonths: 6,
    label: "Location nue",
    canReduce: false,
  },
  meuble: {
    standardMonths: 3,
    reducedMonths: 3,
    label: "Location meublée",
    canReduce: false,
  },
  etudiant: {
    standardMonths: 0, // Pas de renouvellement, bail de 9 mois
    reducedMonths: 0,
    label: "Bail étudiant",
    canReduce: false,
  },
  mobilite: {
    standardMonths: 0, // Pas de renouvellement
    reducedMonths: 0,
    label: "Bail mobilité",
    canReduce: false,
  },
  saisonnier: {
    standardMonths: 0,
    reducedMonths: 0,
    label: "Location saisonnière",
    canReduce: false,
  },
  colocation: {
    standardMonths: 3,
    reducedMonths: 3,
    label: "Colocation",
    canReduce: false,
  },
};

/**
 * Motifs légaux ouvrant droit au préavis réduit (1 mois) pour location nue.
 * Article 15 de la loi du 6 juillet 1989.
 */
export const REDUCED_NOTICE_REASONS = [
  { key: "zone_tendue", label: "Logement en zone tendue" },
  { key: "mutation_professionnelle", label: "Mutation professionnelle" },
  { key: "perte_emploi", label: "Perte d'emploi" },
  { key: "nouvel_emploi", label: "Obtention d'un premier emploi" },
  { key: "raison_sante", label: "Raisons de santé justifiées" },
  { key: "rsa_beneficiaire", label: "Bénéficiaire du RSA" },
  { key: "aah_beneficiaire", label: "Bénéficiaire de l'AAH" },
  { key: "violence_conjugale", label: "Violences conjugales" },
] as const;

/**
 * Motifs légaux pour congé bailleur.
 */
export const OWNER_NOTICE_MOTIFS = [
  { key: "conge_vente", label: "Congé pour vendre" },
  { key: "conge_reprise", label: "Congé pour reprise (habitation personnelle)" },
  { key: "conge_motif_legitime", label: "Congé pour motif légitime et sérieux" },
  { key: "non_renouvellement", label: "Non-renouvellement du bail" },
] as const;

export type ReducedNoticeReason = typeof REDUCED_NOTICE_REASONS[number]["key"];
export type OwnerNoticeMotif = typeof OWNER_NOTICE_MOTIFS[number]["key"];

export interface PreavisResult {
  /** Durée du préavis en mois */
  months: number;
  /** Durée du préavis en jours (approximation) */
  days: number;
  /** Date de fin effective du préavis */
  effectiveEndDate: Date;
  /** Si le préavis est réduit */
  isReduced: boolean;
  /** Label du type de bail */
  bailLabel: string;
  /** Méthode d'envoi obligatoire */
  requiredMethod: "rar" | "huissier" | "rar_ou_huissier" | "libre";
}

/**
 * Calcule le préavis applicable pour un bail donné.
 */
export function calculatePreavis(params: {
  typeBail: BailType;
  initiateur: Initiateur;
  isZoneTendue?: boolean;
  reducedReason?: string | null;
  startDate?: Date;
}): PreavisResult {
  const {
    typeBail,
    initiateur,
    isZoneTendue = false,
    reducedReason,
    startDate = new Date(),
  } = params;

  const periods =
    initiateur === "owner" ? OWNER_NOTICE_PERIODS : TENANT_NOTICE_PERIODS;
  const config = periods[typeBail] || periods.meuble;

  // Déterminer si le préavis est réduit
  let isReduced = false;
  if (initiateur === "tenant" && typeBail === "nu") {
    if (isZoneTendue || (reducedReason && REDUCED_NOTICE_REASONS.some(r => r.key === reducedReason))) {
      isReduced = true;
    }
  }

  const months = isReduced ? config.reducedMonths : config.standardMonths;
  const days = months * 30; // Approximation légale

  // Calculer la date de fin effective
  const effectiveEndDate = new Date(startDate);
  effectiveEndDate.setMonth(effectiveEndDate.getMonth() + months);

  // Méthode d'envoi requise
  let requiredMethod: PreavisResult["requiredMethod"] = "libre";
  if (initiateur === "owner") {
    requiredMethod = "rar_ou_huissier"; // RAR ou huissier obligatoire pour le bailleur
  } else if (initiateur === "tenant") {
    requiredMethod = "rar"; // RAR recommandé pour le locataire (non obligatoire mais conseillé)
  }

  return {
    months,
    days,
    effectiveEndDate,
    isReduced,
    bailLabel: config.label,
    requiredMethod,
  };
}

/**
 * Durées légales de bail par type.
 */
export const BAIL_DURATIONS: Record<BailType, { minMonths: number; maxMonths: number | null; renewable: boolean }> = {
  nu: { minMonths: 36, maxMonths: null, renewable: true },          // 3 ans (6 pour SCI)
  meuble: { minMonths: 12, maxMonths: null, renewable: true },      // 1 an
  etudiant: { minMonths: 9, maxMonths: 9, renewable: false },       // 9 mois non renouvelable
  mobilite: { minMonths: 1, maxMonths: 10, renewable: false },      // 1-10 mois non renouvelable
  saisonnier: { minMonths: 1, maxMonths: 3, renewable: false },     // Max 90 jours
  colocation: { minMonths: 12, maxMonths: null, renewable: true },  // Comme meublé (variable)
};

/**
 * Dépôt de garantie maximum par type de bail.
 * En nombre de mois de loyer HC.
 */
export const DEPOT_GARANTIE_MAX: Record<BailType, number> = {
  nu: 1,          // 1 mois HC
  meuble: 2,      // 2 mois HC
  etudiant: 2,    // 2 mois HC
  mobilite: 0,    // Interdit
  saisonnier: 0,  // Variable, pas de max légal strict
  colocation: 2,  // Comme le type de bail sous-jacent
};
