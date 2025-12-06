/**
 * Types TypeScript pour le module Fin de Bail
 * Préavis, Solde de tout compte, Retenues DG
 */

// ============================================
// ENUMS
// ============================================

export type DepartureInitiator = "tenant" | "owner";

export type DepartureReason =
  | "standard"
  | "zone_tendue"
  | "mutation_professionnelle"
  | "perte_emploi"
  | "nouvel_emploi"
  | "raison_sante"
  | "rsa_beneficiaire"
  | "aah_beneficiaire"
  | "premier_logement"
  | "conge_vente"
  | "conge_reprise"
  | "motif_legitime"
  | "autre";

export type DepartureNoticeStatus =
  | "pending"
  | "accepted"
  | "contested"
  | "withdrawn"
  | "completed";

export type AcknowledgmentMethod =
  | "lettre_recommandee"
  | "acte_huissier"
  | "remise_main_propre"
  | "email_certifie";

export type SettlementStatus =
  | "draft"
  | "pending_validation"
  | "contested"
  | "validated"
  | "paid"
  | "collected";

export type DeductionType =
  | "unpaid_rent"
  | "unpaid_charges"
  | "repair"
  | "cleaning"
  | "missing_equipment"
  | "damage"
  | "key_replacement"
  | "charge_regularization"
  | "other";

export type PaymentMethod = "virement" | "cheque" | "especes";

// ============================================
// INTERFACES
// ============================================

export interface DepartureNotice {
  id: string;
  lease_id: string;
  initiated_by: DepartureInitiator;
  initiator_profile_id: string;
  notice_date: string;
  expected_departure_date: string;
  actual_departure_date: string | null;
  notice_period_months: number;
  reason: DepartureReason | null;
  reason_details: string | null;
  reason_document_id: string | null;
  status: DepartureNoticeStatus;
  contested_at: string | null;
  contest_reason: string | null;
  contest_resolved_at: string | null;
  acknowledgment_date: string | null;
  acknowledgment_method: AcknowledgmentMethod | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DGSettlement {
  id: string;
  lease_id: string;
  departure_notice_id: string | null;
  deposit_amount: number;
  total_deductions: number;
  deductions: DeductionItem[];
  charge_regularization_amount: number;
  unpaid_rent_amount: number;
  repair_amount: number;
  cleaning_amount: number;
  other_deductions_amount: number;
  amount_to_return: number;
  amount_to_pay: number;
  edl_entry_id: string | null;
  edl_exit_id: string | null;
  comparison_document_id: string | null;
  status: SettlementStatus;
  validated_at: string | null;
  validated_by: string | null;
  contested_at: string | null;
  contest_reason: string | null;
  payment_date: string | null;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  legal_deadline: string;
  is_overdue: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DeductionItem {
  id?: string;
  settlement_id?: string;
  deduction_type: DeductionType;
  description: string;
  amount: number;
  document_id?: string | null;
  invoice_reference?: string | null;
  edl_item_id?: string | null;
  is_validated?: boolean;
  is_contested?: boolean;
  contest_reason?: string | null;
}

export interface SettlementDeductionItem extends DeductionItem {
  id: string;
  settlement_id: string;
  validated_at: string | null;
  created_at: string;
}

// ============================================
// DTOs
// ============================================

export interface CreateDepartureNoticeDTO {
  lease_id: string;
  initiated_by: DepartureInitiator;
  notice_date: string;
  expected_departure_date: string;
  notice_period_months?: number;
  reason?: DepartureReason;
  reason_details?: string;
  acknowledgment_method?: AcknowledgmentMethod;
  notes?: string;
}

export interface UpdateDepartureNoticeDTO {
  expected_departure_date?: string;
  actual_departure_date?: string;
  reason?: DepartureReason;
  reason_details?: string;
  status?: DepartureNoticeStatus;
  acknowledgment_date?: string;
  acknowledgment_method?: AcknowledgmentMethod;
  notes?: string;
}

export interface ContestDepartureDTO {
  contest_reason: string;
}

export interface CreateSettlementDTO {
  lease_id: string;
  deposit_amount: number;
  deductions?: DeductionItem[];
  charge_regularization_amount?: number;
  unpaid_rent_amount?: number;
  repair_amount?: number;
  cleaning_amount?: number;
  other_deductions_amount?: number;
  edl_entry_id?: string;
  edl_exit_id?: string;
  notes?: string;
}

export interface UpdateSettlementDTO {
  deductions?: DeductionItem[];
  charge_regularization_amount?: number;
  repair_amount?: number;
  cleaning_amount?: number;
  other_deductions_amount?: number;
  status?: SettlementStatus;
  payment_date?: string;
  payment_method?: PaymentMethod;
  payment_reference?: string;
  notes?: string;
}

export interface AddDeductionDTO {
  deduction_type: DeductionType;
  description: string;
  amount: number;
  document_id?: string;
  invoice_reference?: string;
  edl_item_id?: string;
}

// ============================================
// CALCULATION TYPES
// ============================================

export interface SettlementCalculation {
  lease_id: string;
  deposit_amount: number;
  unpaid_rent: number;
  total_deductions: number;
  amount_to_return: number;
  amount_to_pay: number;
  legal_deadline: string;
  edl_identical: boolean;
  departure_date: string | null;
}

// ============================================
// VIEW TYPES (avec relations)
// ============================================

export interface DepartureNoticeWithDetails extends DepartureNotice {
  lease?: {
    id: string;
    loyer: number;
    charges_forfaitaires: number;
    date_debut: string;
    property?: {
      id: string;
      adresse_complete: string;
      ville: string;
    };
  };
  initiator?: {
    id: string;
    prenom: string;
    nom: string;
  };
}

export interface SettlementWithDetails extends DGSettlement {
  lease?: {
    id: string;
    loyer: number;
    depot_de_garantie: number;
    property?: {
      id: string;
      adresse_complete: string;
      ville: string;
    };
  };
  tenant?: {
    id: string;
    prenom: string;
    nom: string;
  };
  deduction_items?: SettlementDeductionItem[];
}

// ============================================
// LABELS
// ============================================

export const DEPARTURE_REASON_LABELS: Record<DepartureReason, string> = {
  standard: "Préavis standard",
  zone_tendue: "Zone tendue (1 mois)",
  mutation_professionnelle: "Mutation professionnelle",
  perte_emploi: "Perte d'emploi",
  nouvel_emploi: "Nouvel emploi",
  raison_sante: "Raison de santé",
  rsa_beneficiaire: "Bénéficiaire du RSA",
  aah_beneficiaire: "Bénéficiaire de l'AAH",
  premier_logement: "Attribution d'un logement social",
  conge_vente: "Congé pour vendre",
  conge_reprise: "Congé pour reprise",
  motif_legitime: "Motif légitime et sérieux",
  autre: "Autre motif",
};

export const DEPARTURE_STATUS_LABELS: Record<DepartureNoticeStatus, string> = {
  pending: "En attente",
  accepted: "Accepté",
  contested: "Contesté",
  withdrawn: "Retiré",
  completed: "Terminé",
};

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  draft: "Brouillon",
  pending_validation: "En attente de validation",
  contested: "Contesté",
  validated: "Validé",
  paid: "Remboursé",
  collected: "Encaissé",
};

export const DEDUCTION_TYPE_LABELS: Record<DeductionType, string> = {
  unpaid_rent: "Loyers impayés",
  unpaid_charges: "Charges impayées",
  repair: "Réparations locatives",
  cleaning: "Nettoyage",
  missing_equipment: "Équipement manquant",
  damage: "Dégradations",
  key_replacement: "Remplacement de clés",
  charge_regularization: "Régularisation des charges",
  other: "Autre",
};

export const ACKNOWLEDGMENT_METHOD_LABELS: Record<AcknowledgmentMethod, string> = {
  lettre_recommandee: "Lettre recommandée AR",
  acte_huissier: "Acte d'huissier",
  remise_main_propre: "Remise en main propre",
  email_certifie: "Email certifié",
};

// Raisons de préavis réduit (1 mois)
export const REDUCED_NOTICE_REASONS: DepartureReason[] = [
  "zone_tendue",
  "mutation_professionnelle",
  "perte_emploi",
  "nouvel_emploi",
  "raison_sante",
  "rsa_beneficiaire",
  "aah_beneficiaire",
  "premier_logement",
];

// Raisons congé propriétaire
export const OWNER_NOTICE_REASONS: DepartureReason[] = [
  "conge_vente",
  "conge_reprise",
  "motif_legitime",
];
