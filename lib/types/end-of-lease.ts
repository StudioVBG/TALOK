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

// ============================================
// INSPECTION TYPES (EDL Sortie)
// ============================================

export type InspectionCategory =
  | "murs"
  | "sols"
  | "salle_de_bain"
  | "cuisine"
  | "fenetres_portes"
  | "electricite_plomberie"
  | "meubles";

export type InspectionStatus = "pending" | "ok" | "problem";

export const INSPECTION_CATEGORIES: InspectionCategory[] = [
  "murs",
  "sols",
  "salle_de_bain",
  "cuisine",
  "fenetres_portes",
  "electricite_plomberie",
  "meubles",
];

export interface EDLInspectionItem {
  category: InspectionCategory;
  label: string;
  icon: string;
  description: string;
  status: InspectionStatus;
  photos: string[];
  problemDescription?: string;
}

export interface LeaseEndProcess {
  id: string;
  lease_id: string;
  status: "in_progress" | "completed" | "cancelled";
  current_step: string;
  checklist_completed: boolean;
  edl_completed: boolean;
  damages_assessed: boolean;
  quotes_received: boolean;
  deposit_settled: boolean;
  dg_amount: number;
  dg_retention_amount: number;
  dg_refund_amount: number;
  tenant_damage_cost: number;
  vetusty_cost: number;
  renovation_cost: number;
  total_budget: number;
  ready_to_rent_date?: string;
  created_at: string;
  updated_at: string;
  // Relations
  lease?: {
    id: string;
    type_bail: string;
    loyer: number;
    depot_de_garantie: number;
  };
  property?: {
    id: string;
    adresse_complete: string;
    ville: string;
    surface?: number;
    type: string;
  };
}

export interface RenovationItem {
  id: string;
  category: InspectionCategory;
  description: string;
  estimated_cost: number;
  actual_cost?: number;
  status: "pending" | "quoted" | "approved" | "completed";
  provider_id?: string;
  quote_id?: string;
}

export interface LeaseEndTimelineItem {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "milestone" | "task" | "deadline";
  completed: boolean;
}

// ============================================
// GAP-002: INVENTAIRE MEUBLÉ (Décret 31/07/2015)
// ============================================

/**
 * Liste légale des éléments d'équipement obligatoires
 * pour un logement meublé (Décret n°2015-981 du 31/07/2015)
 */
export type FurnitureCategory =
  | "literie"
  | "occultation"
  | "cuisine"
  | "rangement"
  | "luminaire"
  | "vaisselle"
  | "entretien";

export type FurnitureCondition =
  | "neuf"
  | "tres_bon"
  | "bon"
  | "usage"
  | "mauvais"
  | "absent";

export interface FurnitureItem {
  id: string;
  category: FurnitureCategory;
  name: string;
  description: string;
  legal_requirement: string; // Référence légale
  is_mandatory: boolean;
  quantity: number;
  condition: FurnitureCondition;
  notes?: string;
  photos?: string[];
}

export interface FurnitureInventory {
  id: string;
  edl_id: string;
  lease_id: string;
  type: "entree" | "sortie";
  items: FurnitureItem[];
  is_complete: boolean;
  total_items: number;
  items_present: number;
  items_missing: number;
  created_at: string;
  updated_at: string;
}

/**
 * Équipements obligatoires selon le Décret n°2015-981 du 31/07/2015
 * Article 2 - Liste des éléments d'équipement
 */
export const MANDATORY_FURNITURE_LIST: Omit<FurnitureItem, "id" | "condition" | "quantity" | "notes" | "photos">[] = [
  // 1° Literie
  {
    category: "literie",
    name: "Literie avec couette ou couverture",
    description: "Lit avec matelas, couette ou couverture adaptée",
    legal_requirement: "Décret 2015-981 Art.2 - 1°",
    is_mandatory: true,
  },
  // 2° Dispositif d'occultation
  {
    category: "occultation",
    name: "Volets ou rideaux occultants",
    description: "Dispositif d'occultation des fenêtres dans les pièces destinées à être utilisées comme chambre à coucher",
    legal_requirement: "Décret 2015-981 Art.2 - 2°",
    is_mandatory: true,
  },
  // 3° Plaques de cuisson
  {
    category: "cuisine",
    name: "Plaques de cuisson",
    description: "Plaques de cuisson (gaz ou électrique)",
    legal_requirement: "Décret 2015-981 Art.2 - 3°",
    is_mandatory: true,
  },
  // 4° Four ou four à micro-ondes
  {
    category: "cuisine",
    name: "Four ou micro-ondes",
    description: "Four traditionnel ou four à micro-ondes",
    legal_requirement: "Décret 2015-981 Art.2 - 4°",
    is_mandatory: true,
  },
  // 5° Réfrigérateur et congélateur ou compartiment
  {
    category: "cuisine",
    name: "Réfrigérateur avec compartiment congélation",
    description: "Réfrigérateur et congélateur ou réfrigérateur avec compartiment de congélation (température ≤ -6°C)",
    legal_requirement: "Décret 2015-981 Art.2 - 5°",
    is_mandatory: true,
  },
  // 6° Vaisselle
  {
    category: "vaisselle",
    name: "Vaisselle pour prendre les repas",
    description: "Vaisselle nécessaire à la prise des repas (assiettes, verres, couverts)",
    legal_requirement: "Décret 2015-981 Art.2 - 6°",
    is_mandatory: true,
  },
  // 7° Ustensiles de cuisine
  {
    category: "vaisselle",
    name: "Ustensiles de cuisine",
    description: "Ustensiles de cuisine (casseroles, poêle, etc.)",
    legal_requirement: "Décret 2015-981 Art.2 - 7°",
    is_mandatory: true,
  },
  // 8° Table et sièges
  {
    category: "rangement",
    name: "Table et sièges",
    description: "Table et sièges en nombre suffisant",
    legal_requirement: "Décret 2015-981 Art.2 - 8°",
    is_mandatory: true,
  },
  // 9° Étagères de rangement
  {
    category: "rangement",
    name: "Étagères de rangement",
    description: "Étagères de rangement",
    legal_requirement: "Décret 2015-981 Art.2 - 9°",
    is_mandatory: true,
  },
  // 10° Luminaires
  {
    category: "luminaire",
    name: "Luminaires",
    description: "Luminaires suffisants dans chaque pièce",
    legal_requirement: "Décret 2015-981 Art.2 - 10°",
    is_mandatory: true,
  },
  // 11° Matériel d'entretien
  {
    category: "entretien",
    name: "Matériel d'entretien ménager",
    description: "Matériel d'entretien ménager adapté aux caractéristiques du logement (balai, serpillière, etc.)",
    legal_requirement: "Décret 2015-981 Art.2 - 11°",
    is_mandatory: true,
  },
];

export const FURNITURE_CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  literie: "Literie",
  occultation: "Occultation fenêtres",
  cuisine: "Équipements cuisine",
  rangement: "Mobilier / Rangement",
  luminaire: "Éclairage",
  vaisselle: "Vaisselle & Ustensiles",
  entretien: "Entretien ménager",
};

export const FURNITURE_CONDITION_LABELS: Record<FurnitureCondition, string> = {
  neuf: "Neuf",
  tres_bon: "Très bon état",
  bon: "Bon état",
  usage: "Usagé",
  mauvais: "Mauvais état",
  absent: "Absent / Manquant",
};

export const FURNITURE_CONDITION_COLORS: Record<FurnitureCondition, string> = {
  neuf: "#3b82f6", // blue-500
  tres_bon: "#22c55e", // green-500
  bon: "#84cc16", // lime-500
  usage: "#eab308", // yellow-500
  mauvais: "#f97316", // orange-500
  absent: "#ef4444", // red-500
};
