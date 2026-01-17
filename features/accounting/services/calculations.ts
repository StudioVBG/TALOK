/**
 * Accounting Calculations - Pure functions
 * Extracted from accounting.service.ts
 *
 * These are pure calculation functions with no external dependencies.
 */

import { TAUX_HONORAIRES, getTauxTVA } from "../constants/plan-comptable";
import { CalculHonoraires, CalculReversement } from "../types";

/**
 * Calcule les honoraires de gestion sur un loyer
 */
export function calculateHonoraires(
  loyerHC: number,
  tauxHT: number = TAUX_HONORAIRES.GESTION_LOCATIVE,
  codePostal: string = "75000"
): CalculHonoraires {
  const tauxTVA = getTauxTVA(codePostal);
  const montantHT = loyerHC * tauxHT;
  const tvaMontant = montantHT * tauxTVA;
  const totalTTC = montantHT + tvaMontant;
  const netProprietaire = loyerHC - totalTTC;

  return {
    loyer_hc: Math.round(loyerHC * 100) / 100,
    taux_ht: tauxHT,
    montant_ht: Math.round(montantHT * 100) / 100,
    tva_taux: tauxTVA,
    tva_montant: Math.round(tvaMontant * 100) / 100,
    total_ttc: Math.round(totalTTC * 100) / 100,
    net_proprietaire: Math.round(netProprietaire * 100) / 100,
  };
}

/**
 * Calcule le montant à reverser au propriétaire
 */
export function calculateReversement(
  loyerEncaisse: number,
  chargesEncaissees: number,
  tauxHonoraires: number = TAUX_HONORAIRES.GESTION_LOCATIVE,
  travauxDeduits: number = 0,
  autresDeductions: number = 0,
  codePostal: string = "75000"
): CalculReversement {
  const honoraires = calculateHonoraires(loyerEncaisse, tauxHonoraires, codePostal);

  const montantReverse =
    loyerEncaisse +
    chargesEncaissees -
    honoraires.total_ttc -
    travauxDeduits -
    autresDeductions;

  return {
    loyer_encaisse: loyerEncaisse,
    charges_encaissees: chargesEncaissees,
    honoraires_ttc: honoraires.total_ttc,
    travaux_deduits: travauxDeduits,
    autres_deductions: autresDeductions,
    montant_reverse: Math.round(montantReverse * 100) / 100,
  };
}

/**
 * Calcule le prorata temporis pour les charges
 */
export function calculateProrata(
  dateDebut: string,
  dateFin: string,
  annee: number
): { jours_occupation: number; jours_annee: number; ratio: number } {
  const debut = new Date(
    Math.max(new Date(dateDebut).getTime(), new Date(`${annee}-01-01`).getTime())
  );
  const fin = new Date(
    Math.min(new Date(dateFin).getTime(), new Date(`${annee}-12-31`).getTime())
  );

  const joursOccupation =
    Math.ceil((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const joursAnnee = annee % 4 === 0 ? 366 : 365;

  return {
    jours_occupation: Math.max(0, joursOccupation),
    jours_annee: joursAnnee,
    ratio: Math.round((joursOccupation / joursAnnee) * 10000) / 10000,
  };
}

/**
 * Calcule les totaux des mouvements (débits/crédits)
 */
export function calculateTotauxMouvements(
  mouvements: Array<{ type: "credit" | "debit"; montant: number }>
): {
  total_debits: number;
  total_credits: number;
} {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const mouvement of mouvements) {
    if (mouvement.type === "credit") {
      totalCredits += mouvement.montant;
    } else {
      totalDebits += mouvement.montant;
    }
  }

  return {
    total_debits: Math.round(totalDebits * 100) / 100,
    total_credits: Math.round(totalCredits * 100) / 100,
  };
}

/**
 * Calcule le récapitulatif du CRG
 */
export function calculateRecapitulatif(
  mouvements: Array<{
    type: "credit" | "debit";
    montant: number;
    categorie: string;
  }>
): {
  loyers_encaisses: number;
  honoraires_preleves: number;
  travaux_interventions: number;
  reversements_effectues: number;
  solde_disponible: number;
} {
  let loyersEncaisses = 0;
  let honorairesPreleves = 0;
  let travauxInterventions = 0;
  let reversementsEffectues = 0;

  for (const mouvement of mouvements) {
    switch (mouvement.categorie) {
      case "loyer":
      case "charges":
        loyersEncaisses += mouvement.montant;
        break;
      case "honoraires":
        honorairesPreleves += mouvement.montant;
        break;
      case "travaux":
        travauxInterventions += mouvement.montant;
        break;
      case "reversement":
        reversementsEffectues += mouvement.montant;
        break;
    }
  }

  const soldeDisponible =
    loyersEncaisses - honorairesPreleves - travauxInterventions - reversementsEffectues;

  return {
    loyers_encaisses: Math.round(loyersEncaisses * 100) / 100,
    honoraires_preleves: Math.round(honorairesPreleves * 100) / 100,
    travaux_interventions: Math.round(travauxInterventions * 100) / 100,
    reversements_effectues: Math.round(reversementsEffectues * 100) / 100,
    solde_disponible: Math.round(soldeDisponible * 100) / 100,
  };
}
