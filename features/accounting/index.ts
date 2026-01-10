/**
 * Module Comptabilité - Gestion Locative
 *
 * Ce module fournit toutes les fonctionnalités comptables pour Talok :
 * - Calcul des honoraires de gestion
 * - Génération du Compte Rendu de Gestion (CRG)
 * - Balance des mandants
 * - Récapitulatif fiscal (aide déclaration 2044)
 * - Situation locataire
 * - Export FEC (Fichier des Écritures Comptables)
 */

// Service principal
export { accountingService, AccountingService } from "./services/accounting.service";

// Types
export type {
  // Types de base
  DocumentComptableType,
  MouvementType,
  MouvementCategorie,
  PeriodeType,
  ExportFormat,
  Periode,

  // Mouvements
  MouvementMandant,
  DetailHonoraires,

  // CRG
  CRGData,
  GestionnaireInfo,
  ProprietaireInfo,
  BienInfo,
  LocataireInfo,
  LoyerMensuel,
  RecapitulatifCRG,

  // Balance
  BalanceMandants,
  CompteMandant,
  VerificationEquilibre,

  // Grand Livre
  GrandLivreMandant,
  EcritureGrandLivre,

  // Situation Locataire
  SituationLocataire,
  HistoriquePaiement,

  // Fiscal
  RecapitulatifFiscal,
  BienFiscal,
  ChargesDeductibles,

  // Régularisation
  RegularisationCharges,
  ChargeReelle,

  // FEC
  EcritureFEC,

  // Calculs
  CalculHonoraires,
  CalculReversement,

  // API Responses
  CRGResponse,
  BalanceResponse,
  FiscalResponse,
  ExportResponse,
} from "./types";

// Constantes Plan Comptable
export {
  JOURNAUX,
  COMPTES_TIERS,
  COMPTES_FINANCIERS,
  COMPTES_CHARGES,
  COMPTES_PRODUITS,
  PLAN_COMPTABLE,
  TAUX_TVA,
  TAUX_HONORAIRES,
  CATEGORIES_CHARGES_DEDUCTIBLES,
  CHARGES_RECUPERABLES,
  generateCompteProprietaire,
  generateCompteLocataire,
  getTauxTVA,
  formatDateFEC,
  formatMontant,
} from "./constants/plan-comptable";

// Types des constantes
export type { JournalCode, NumeroCompte } from "./constants/plan-comptable";
