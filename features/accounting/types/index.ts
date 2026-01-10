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

// ============================================================================
// DATABASE ENTITY TYPES
// ============================================================================

/**
 * Journal comptable (VE, AC, BQ, BM, OD, AN)
 */
export interface AccountingJournal {
  id: string;
  code: string; // 'VE' | 'AC' | 'BQ' | 'BM' | 'OD' | 'AN'
  libelle: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Compte du plan comptable
 */
export interface AccountingAccount {
  id: string;
  numero: string;
  libelle: string;
  classe: number; // 1-9
  sens: 'debit' | 'credit' | 'mixte';
  is_active: boolean;
  parent_numero?: string;
  created_at: string;
}

/**
 * Écriture comptable (table accounting_entries)
 */
export interface AccountingEntry {
  id: string;
  journal_code: string;
  ecriture_num: string;
  ecriture_date: string;
  compte_num: string;
  compte_lib: string;
  compte_aux_num?: string;
  compte_aux_lib?: string;
  piece_ref: string;
  piece_date: string;
  ecriture_lib: string;
  debit: number;
  credit: number;
  ecriture_let?: string;
  date_let?: string;
  valid_date?: string;
  montant_devise: number;
  idevise: string;
  owner_id?: string;
  property_id?: string;
  invoice_id?: string;
  payment_id?: string;
  created_at: string;
  created_by?: string;
}

/**
 * Compte mandant (propriétaire ou locataire)
 */
export interface MandantAccount {
  id: string;
  account_number: string;
  account_type: 'proprietaire' | 'locataire';
  profile_id: string;
  property_id?: string;
  solde_debit: number;
  solde_credit: number;
  solde_net: number; // Calculated: credit - debit
  last_movement_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Régularisation des charges (table charge_regularisations)
 */
export interface ChargeRegularisation {
  id: string;
  lease_id: string;
  property_id: string;
  tenant_id: string;
  // Colonnes françaises (originales)
  annee: number;
  date_debut: string;
  date_fin: string;
  provisions_versees: number;
  charges_reelles: number;
  solde: number;
  detail_charges: object;
  statut: 'draft' | 'sent' | 'paid' | 'disputed' | 'cancelled';
  // Colonnes anglaises (aliases)
  year: number;
  period_start: string;
  period_end: string;
  provisions_received: number;
  actual_charges: number;
  balance: number;
  status: 'draft' | 'sent' | 'applied' | 'paid' | 'disputed' | 'cancelled';
  details?: {
    charges_reelles?: ChargeReelleDetail[];
    detail_provisions?: { periode: string; montant: number }[];
    prorata?: { jours_occupation: number; jours_annee: number; ratio: number };
  };
  date_emission?: string;
  date_echeance?: string;
  date_paiement?: string;
  nouvelle_provision?: number;
  date_effet_nouvelle_provision?: string;
  applied_at?: string;
  invoice_id?: string;
  credit_note_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ChargeReelleDetail {
  type: string;
  libelle: string;
  montant_total: number;
  quote_part: number;
  prorata?: number;
  montant_du?: number;
}

/**
 * Opération sur dépôt de garantie
 */
export interface DepositOperation {
  id: string;
  lease_id: string;
  property_id: string;
  tenant_id: string;
  owner_id: string;
  operation_type: 'reception' | 'restitution' | 'retenue' | 'complement';
  montant: number;
  motif_retenue?: string;
  detail_retenues?: {
    type: string;
    libelle: string;
    montant: number;
  }[];
  payment_id?: string;
  edl_sortie_id?: string;
  date_operation: string;
  date_limite_restitution?: string;
  statut: 'pending' | 'completed' | 'disputed' | 'cancelled';
  documents?: { type: string; url: string }[];
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

/**
 * Rapprochement bancaire
 */
export interface BankReconciliation {
  id: string;
  periode: string; // YYYY-MM
  date_reconciliation: string;
  compte_type: 'agence' | 'mandant';
  solde_banque: number;
  solde_comptable: number;
  ecart: number; // Calculated: banque - comptable
  operations_non_pointees?: {
    id: string;
    date: string;
    libelle: string;
    montant: number;
    type: 'debit' | 'credit';
  }[];
  statut: 'draft' | 'validated' | 'locked';
  is_balanced: boolean; // Calculated: |ecart| < 0.01
  validated_at?: string;
  validated_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

/**
 * Charge récurrente sur propriété (table charges)
 */
export interface PropertyCharge {
  id: string;
  property_id: string;
  type: 'eau' | 'electricite' | 'copro' | 'taxe' | 'ordures' | 'assurance' | 'travaux' | 'energie' | 'autre';
  libelle?: string;
  montant: number;
  periodicite: 'mensuelle' | 'trimestrielle' | 'annuelle';
  refacturable_locataire: boolean;
  quote_part?: number; // 0-100
  date_debut?: string;
  date_fin?: string;
  categorie_charge?: 'charges_locatives' | 'charges_non_recuperables' | 'taxes' | 'travaux_proprietaire' | 'travaux_locataire' | 'assurances' | 'energie';
  eligible_pinel?: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SERVICE INPUT/OUTPUT TYPES
// ============================================================================

export interface RecordPaymentInput {
  invoiceId: string;
  leaseId: string;
  ownerId: string;
  tenantId: string;
  periode: string;
  montantLoyer: number;
  montantCharges: number;
  montantTotal: number;
  paymentDate: string;
  propertyCodePostal?: string;
}

export interface HonorairesResult {
  montantHT: number;
  tauxTVA: number;
  tvaMontant: number;
  totalTTC: number;
  netProprietaire: number;
}

export interface RegularisationInput {
  leaseId: string;
  annee: number;
  chargesReelles?: ChargeReelleDetail[];
}

export interface DepositOperationInput {
  leaseId: string;
  operationType: 'reception' | 'restitution' | 'retenue' | 'complement';
  montant: number;
  dateOperation: string;
  motifRetenue?: string;
  detailRetenues?: { type: string; libelle: string; montant: number }[];
  notes?: string;
}

export interface ReconciliationInput {
  periode: string;
  compteType: 'agence' | 'mandant';
  soldeBanque: number;
  soldeComptable: number;
  operationsNonPointees?: object[];
}
