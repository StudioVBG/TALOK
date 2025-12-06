/**
 * Types TypeScript pour le module Garant
 */

// ============================================
// ENUMS
// ============================================

export type GuarantorRelation =
  | "parent"
  | "grand_parent"
  | "oncle_tante"
  | "frere_soeur"
  | "employeur"
  | "ami"
  | "autre";

export type GuarantorSituationPro =
  | "cdi"
  | "cdd"
  | "fonctionnaire"
  | "independant"
  | "retraite"
  | "profession_liberale"
  | "chef_entreprise"
  | "autre";

export type CautionType = "simple" | "solidaire";

export type EngagementStatus =
  | "pending_signature"
  | "active"
  | "terminated"
  | "called"
  | "released";

export type GuarantorDocumentType =
  | "piece_identite"
  | "justificatif_domicile"
  | "avis_imposition"
  | "bulletins_salaire"
  | "contrat_travail"
  | "attestation_employeur"
  | "releve_bancaire"
  | "titre_propriete"
  | "acte_caution_signe"
  | "autre";

export type PaymentIncidentType =
  | "late_payment"
  | "unpaid"
  | "partial_payment"
  | "call_caution";

// ============================================
// INTERFACES
// ============================================

export interface GuarantorProfile {
  profile_id: string;
  relation_to_tenant: GuarantorRelation;
  relation_details: string | null;
  situation_pro: GuarantorSituationPro | null;
  employeur_nom: string | null;
  employeur_adresse: string | null;
  anciennete_mois: number | null;
  revenus_mensuels_nets: number | null;
  revenus_fonciers: number;
  autres_revenus: number;
  charges_mensuelles: number;
  credits_en_cours: number;
  est_proprietaire: boolean;
  valeur_patrimoine_immobilier: number | null;
  adresse_complete: string | null;
  code_postal: string | null;
  ville: string | null;
  documents_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  verification_notes: string | null;
  consent_garant: boolean;
  consent_garant_at: string | null;
  consent_data_processing: boolean;
  consent_data_processing_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuarantorEngagement {
  id: string;
  guarantor_profile_id: string;
  lease_id: string;
  tenant_profile_id: string;
  caution_type: CautionType;
  montant_garanti: number | null;
  duree_engagement_mois: number | null;
  status: EngagementStatus;
  signature_request_id: string | null;
  signed_at: string | null;
  document_id: string | null;
  called_at: string | null;
  called_amount: number | null;
  called_reason: string | null;
  released_at: string | null;
  released_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuarantorDocument {
  id: string;
  guarantor_profile_id: string;
  document_type: GuarantorDocumentType;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GuarantorPaymentIncident {
  id: string;
  engagement_id: string;
  invoice_id: string;
  incident_type: PaymentIncidentType;
  amount_due: number;
  days_late: number | null;
  notified_at: string | null;
  notification_method: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

// ============================================
// DTOs
// ============================================

export interface CreateGuarantorProfileDTO {
  relation_to_tenant: GuarantorRelation;
  relation_details?: string | null;
  situation_pro?: GuarantorSituationPro | null;
  employeur_nom?: string | null;
  employeur_adresse?: string | null;
  anciennete_mois?: number | null;
  revenus_mensuels_nets?: number | null;
  revenus_fonciers?: number;
  autres_revenus?: number;
  charges_mensuelles?: number;
  credits_en_cours?: number;
  est_proprietaire?: boolean;
  valeur_patrimoine_immobilier?: number | null;
  adresse_complete?: string | null;
  code_postal?: string | null;
  ville?: string | null;
}

export interface UpdateGuarantorProfileDTO extends Partial<CreateGuarantorProfileDTO> {
  consent_garant?: boolean;
  consent_data_processing?: boolean;
}

export interface CreateEngagementDTO {
  guarantor_profile_id: string;
  lease_id: string;
  tenant_profile_id: string;
  caution_type?: CautionType;
  montant_garanti?: number | null;
  duree_engagement_mois?: number | null;
}

export interface UploadGuarantorDocumentDTO {
  document_type: GuarantorDocumentType;
  file: File;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface GuarantorDashboardEngagement {
  id: string;
  lease_id: string;
  caution_type: CautionType;
  montant_garanti: number | null;
  status: EngagementStatus;
  signed_at: string | null;
  created_at: string;
  tenant: {
    id: string;
    name: string;
  };
  property: {
    id: string;
    adresse: string;
    ville: string;
  };
  lease: {
    loyer: number;
    charges: number;
    date_debut: string;
  };
}

export interface GuarantorDashboardIncident {
  id: string;
  incident_type: PaymentIncidentType;
  amount_due: number;
  days_late: number | null;
  notified_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface GuarantorDashboardStats {
  total_engagements: number;
  pending_signatures: number;
  total_amount_guaranteed: number;
  active_incidents: number;
}

export interface GuarantorDashboardData {
  profile_id: string;
  engagements: GuarantorDashboardEngagement[];
  incidents: GuarantorDashboardIncident[];
  stats: GuarantorDashboardStats;
}

// ============================================
// ELIGIBILITY CHECK
// ============================================

export interface GuarantorEligibilityResult {
  eligible: boolean;
  income_ratio: number;
  total_rent: number;
  guarantor_income: number | null;
  reasons: string[];
}

// ============================================
// LABELS & DISPLAY
// ============================================

export const GUARANTOR_RELATION_LABELS: Record<GuarantorRelation, string> = {
  parent: "Parent (père/mère)",
  grand_parent: "Grand-parent",
  oncle_tante: "Oncle/Tante",
  frere_soeur: "Frère/Sœur",
  employeur: "Employeur",
  ami: "Ami(e)",
  autre: "Autre",
};

export const GUARANTOR_SITUATION_LABELS: Record<GuarantorSituationPro, string> = {
  cdi: "CDI",
  cdd: "CDD",
  fonctionnaire: "Fonctionnaire",
  independant: "Indépendant",
  retraite: "Retraité(e)",
  profession_liberale: "Profession libérale",
  chef_entreprise: "Chef d'entreprise",
  autre: "Autre",
};

export const CAUTION_TYPE_LABELS: Record<CautionType, string> = {
  simple: "Caution simple",
  solidaire: "Caution solidaire",
};

export const ENGAGEMENT_STATUS_LABELS: Record<EngagementStatus, string> = {
  pending_signature: "En attente de signature",
  active: "Actif",
  terminated: "Résilié",
  called: "Caution appelée",
  released: "Libéré",
};

export const GUARANTOR_DOCUMENT_TYPE_LABELS: Record<GuarantorDocumentType, string> = {
  piece_identite: "Pièce d'identité",
  justificatif_domicile: "Justificatif de domicile",
  avis_imposition: "Avis d'imposition",
  bulletins_salaire: "Bulletins de salaire (3 derniers)",
  contrat_travail: "Contrat de travail",
  attestation_employeur: "Attestation employeur",
  releve_bancaire: "Relevé bancaire",
  titre_propriete: "Titre de propriété",
  acte_caution_signe: "Acte de caution signé",
  autre: "Autre document",
};

export const INCIDENT_TYPE_LABELS: Record<PaymentIncidentType, string> = {
  late_payment: "Retard de paiement",
  unpaid: "Impayé",
  partial_payment: "Paiement partiel",
  call_caution: "Appel de la caution",
};

// Documents requis pour un garant
export const REQUIRED_GUARANTOR_DOCUMENTS: GuarantorDocumentType[] = [
  "piece_identite",
  "justificatif_domicile",
  "avis_imposition",
  "bulletins_salaire",
];

export const OPTIONAL_GUARANTOR_DOCUMENTS: GuarantorDocumentType[] = [
  "contrat_travail",
  "attestation_employeur",
  "releve_bancaire",
  "titre_propriete",
];







