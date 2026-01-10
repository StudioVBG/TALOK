/**
 * Types pour le module comptabilité Talok
 * Gestion locative - Comptabilité mandants
 */

// ============================================================================
// TYPES DE BASE
// ============================================================================

export type DocumentComptableType =
  | 'avis_echeance'
  | 'quittance_loyer'
  | 'compte_rendu_gestion'
  | 'balance_mandants'
  | 'grand_livre_mandant'
  | 'situation_locataire'
  | 'recapitulatif_fiscal'
  | 'regularisation_charges'
  | 'export_fec';

export type MouvementType = 'credit' | 'debit';

export type MouvementCategorie =
  | 'loyer'
  | 'charges'
  | 'honoraires'
  | 'reversement'
  | 'travaux'
  | 'depot_garantie'
  | 'regularisation'
  | 'autre';

export type PeriodeType = 'mensuel' | 'trimestriel' | 'annuel';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'fec' | 'json';

// ============================================================================
// PÉRIODE
// ============================================================================

export interface Periode {
  debut: string; // ISO date YYYY-MM-DD
  fin: string;   // ISO date YYYY-MM-DD
  libelle?: string;
}

// ============================================================================
// MOUVEMENT COMPTABLE
// ============================================================================

export interface MouvementMandant {
  id: string;
  date: string;
  piece?: string;
  libelle: string;
  type: MouvementType;
  montant: number;
  categorie: MouvementCategorie;
  solde_cumule?: number;
  detail_honoraires?: DetailHonoraires;
  ticket_id?: string;
  invoice_id?: string;
  payment_id?: string;
}

export interface DetailHonoraires {
  base_ht: number;
  taux_ht: number;
  montant_ht: number;
  tva_taux: number;
  tva_montant: number;
  total_ttc: number;
}

// ============================================================================
// COMPTE RENDU DE GESTION (CRG)
// ============================================================================

export interface CRGData {
  numero: string;
  date_emission: string;
  periode: Periode;
  gestionnaire: GestionnaireInfo;
  proprietaire: ProprietaireInfo;
  bien: BienInfo;
  locataire?: LocataireInfo;
  loyer_mensuel: LoyerMensuel;
  solde_debut_periode: number;
  mouvements: MouvementMandant[];
  totaux: {
    total_debits: number;
    total_credits: number;
  };
  solde_fin_periode: number;
  recapitulatif: RecapitulatifCRG;
}

export interface GestionnaireInfo {
  raison_sociale: string;
  adresse: string;
  siret: string;
  carte_g?: string;
  telephone?: string;
  email?: string;
}

export interface ProprietaireInfo {
  id: string;
  nom: string;
  prenom?: string;
  raison_sociale?: string;
  adresse: string;
  type: 'particulier' | 'societe';
  siret?: string;
  email?: string;
}

export interface BienInfo {
  id: string;
  reference: string;
  type: string;
  adresse: string;
  ville: string;
  code_postal: string;
  surface?: number;
  nb_pieces?: number;
}

export interface LocataireInfo {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  bail: {
    debut: string;
    fin: string;
    type: string;
  };
}

export interface LoyerMensuel {
  loyer_hc: number;
  provisions_charges: number;
  loyer_cc: number;
}

export interface RecapitulatifCRG {
  loyers_encaisses: number;
  honoraires_preleves: number;
  travaux_interventions: number;
  reversements_effectues: number;
  solde_disponible: number;
}

// ============================================================================
// BALANCE DES MANDANTS
// ============================================================================

export interface BalanceMandants {
  date: string;
  comptes_proprietaires: CompteMandant[];
  comptes_locataires: CompteMandant[];
  total_proprietaires: { debit: number; credit: number };
  total_locataires: { debit: number; credit: number };
  verification: VerificationEquilibre;
}

export interface CompteMandant {
  compte: string;
  id: string;
  nom: string;
  bien?: string;
  debit: number;
  credit: number;
}

export interface VerificationEquilibre {
  solde_banque_mandant: number;
  total_dettes_proprietaires: number;
  total_creances_locataires: number;
  ecart: number;
  equilibre: boolean;
}

// ============================================================================
// GRAND LIVRE MANDANT
// ============================================================================

export interface GrandLivreMandant {
  proprietaire: {
    id: string;
    compte: string;
    nom: string;
  };
  bien?: BienInfo;
  periode: Periode;
  report_nouveau: number;
  ecritures: EcritureGrandLivre[];
  totaux: {
    debit: number;
    credit: number;
  };
  solde_final: number;
  sens_solde: 'debiteur' | 'crediteur';
}

export interface EcritureGrandLivre {
  date: string;
  piece?: string;
  libelle: string;
  debit: number | null;
  credit: number | null;
  solde: number;
}

// ============================================================================
// SITUATION LOCATAIRE
// ============================================================================

export interface SituationLocataire {
  date_edition: string;
  locataire: LocataireInfo;
  bien: BienInfo;
  bail: {
    date_debut: string;
    date_fin: string;
    loyer_hc: number;
    provisions_charges: number;
    total_mensuel: number;
    depot_garantie: number;
    mode_paiement: string;
  };
  historique: HistoriquePaiement[];
  situation: {
    nb_mois_bail: number;
    total_appele: number;
    total_paye: number;
    solde_du: number;
    a_jour: boolean;
  };
}

export interface HistoriquePaiement {
  periode: string;
  date_echeance: string;
  montant_appele: number;
  montant_paye: number;
  solde: number;
  statut: 'solde' | 'partiel' | 'impaye';
  date_paiement?: string;
}

// ============================================================================
// RÉCAPITULATIF FISCAL
// ============================================================================

export interface RecapitulatifFiscal {
  annee: number;
  proprietaire: ProprietaireInfo;
  biens: BienFiscal[];
  revenus_bruts: {
    loyers: number;
    charges_recuperees: number;
    total: number;
  };
  charges_deductibles: ChargesDeductibles;
  regularisation_n_moins_1?: {
    provisions_deduites: number;
    charges_reelles: number;
    regularisation: number;
  };
  revenu_foncier_net: number;
}

export interface BienFiscal {
  id: string;
  adresse: string;
  locataire?: string;
  loyers_bruts: number;
  charges_recuperees: number;
}

export interface ChargesDeductibles {
  ligne_221_honoraires_gestion: number;
  ligne_222_frais_gestion_forfait: number;
  ligne_223_assurances: number;
  ligne_224_reparations: {
    date: string;
    libelle: string;
    montant: number;
  }[];
  ligne_224_total: number;
  ligne_225_charges_non_recuperees: number;
  ligne_226_indemnites: number;
  ligne_227_taxe_fonciere: number;
  ligne_229_provisions_copro: number;
  total: number;
}

// ============================================================================
// RÉGULARISATION DES CHARGES
// ============================================================================

export interface RegularisationCharges {
  annee: number;
  date_emission: string;
  locataire: LocataireInfo;
  bien: BienInfo;
  periode: Periode;
  provisions_versees: {
    mensuel: number;
    nb_mois: number;
    total: number;
  };
  charges_reelles: ChargeReelle[];
  total_charges_reelles: number;
  solde: {
    montant: number;
    sens: 'du_locataire' | 'du_proprietaire';
    libelle: string;
  };
  ajustement_provisions?: {
    nouvelle_provision: number;
    date_effet: string;
    motif: string;
  };
}

export interface ChargeReelle {
  categorie: string;
  libelle: string;
  montant: number;
  recuperable: boolean;
  taux_recuperation?: number;
}

// ============================================================================
// EXPORT FEC
// ============================================================================

export interface EcritureFEC {
  JournalCode: string;
  JournalLib: string;
  EcritureNum: string;
  EcritureDate: string; // AAAAMMJJ
  CompteNum: string;
  CompteLib: string;
  CompAuxNum?: string;
  CompAuxLib?: string;
  PieceRef: string;
  PieceDate: string; // AAAAMMJJ
  EcritureLib: string;
  Debit: number;
  Credit: number;
  EcritureLet?: string;
  DateLet?: string;
  ValidDate?: string;
  Montantdevise: number;
  Idevise: string;
}

// ============================================================================
// CALCULS
// ============================================================================

export interface CalculHonoraires {
  loyer_hc: number;
  taux_ht: number;
  montant_ht: number;
  tva_taux: number;
  tva_montant: number;
  total_ttc: number;
  net_proprietaire: number;
}

export interface CalculReversement {
  loyer_encaisse: number;
  charges_encaissees: number;
  honoraires_ttc: number;
  travaux_deduits: number;
  autres_deductions: number;
  montant_reverse: number;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface CRGResponse {
  crg: CRGData;
  periode: Periode;
  owner_id: string;
}

export interface BalanceResponse {
  balance: CompteMandant[];
  totals: { debit: number; credit: number };
  date: string;
  equilibre: boolean;
}

export interface FiscalResponse {
  recap: RecapitulatifFiscal;
  year: number;
  owner_id: string;
}

export interface ExportResponse {
  data: string | Blob;
  format: ExportFormat;
  filename: string;
  count: number;
}
