// =====================================================
// Types pour le système de Compliance Prestataire SOTA 2025
// =====================================================

/**
 * Type de prestataire (détermine les documents requis)
 */
export type ProviderType = 'independant' | 'entreprise' | 'btp';

/**
 * Types de documents compliance
 */
export type ComplianceDocumentType =
  | 'rc_pro'           // Responsabilité Civile Pro
  | 'decennale'        // Garantie décennale (BTP)
  | 'kbis'             // Extrait Kbis
  | 'id_card_recto'    // Pièce d'identité (recto)
  | 'id_card_verso'    // Pièce d'identité (verso)
  | 'rib'              // RIB/IBAN
  | 'urssaf'           // Attestation URSSAF
  | 'qualification'    // Certifications
  | 'insurance_other'  // Autre assurance
  | 'other';           // Autre

/**
 * Statut de vérification d'un document
 */
export type DocumentVerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

/**
 * Statut KYC global du prestataire
 */
export type KYCStatus = 'incomplete' | 'pending_review' | 'verified' | 'suspended' | 'rejected';

/**
 * Document de compliance prestataire
 */
export interface ProviderComplianceDocument {
  id: string;
  provider_profile_id: string;
  document_type: ComplianceDocumentType;
  storage_path: string;
  original_filename: string | null;
  file_size: number | null;
  mime_type: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  verification_status: DocumentVerificationStatus;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  extracted_data: Record<string, unknown>;
  ocr_confidence: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Formulaire de création de document
 */
export interface CreateComplianceDocumentData {
  document_type: ComplianceDocumentType;
  storage_path: string;
  original_filename?: string;
  file_size?: number;
  mime_type?: string;
  issue_date?: string;
  expiration_date?: string;
  notes?: string;
}

/**
 * Compte de paiement prestataire
 */
export interface ProviderPayoutAccount {
  id: string;
  provider_profile_id: string;
  iban: string;
  bic: string | null;
  bank_name: string | null;
  account_holder_name: string;
  stripe_account_id: string | null;
  stripe_account_status: 'pending' | 'enabled' | 'restricted' | 'disabled' | null;
  stripe_capabilities: Record<string, unknown>;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Formulaire de création de compte paiement
 */
export interface CreatePayoutAccountData {
  iban: string;
  bic?: string;
  bank_name?: string;
  account_holder_name: string;
  is_default?: boolean;
}

/**
 * Exigence KYC (document requis)
 */
export interface KYCRequirement {
  id: string;
  provider_type: ProviderType;
  document_type: ComplianceDocumentType;
  is_required: boolean;
  has_expiration: boolean;
  max_age_months: number | null;
  description: string | null;
  help_text: string | null;
}

/**
 * Document manquant
 */
export interface MissingDocument {
  document_type: ComplianceDocumentType;
  description: string;
  help_text: string;
  is_required: boolean;
  has_expiration: boolean;
}

/**
 * Document qui expire bientôt
 */
export interface ExpiringDocument {
  provider_profile_id: string;
  provider_name: string;
  provider_email: string;
  document_type: ComplianceDocumentType;
  document_id: string;
  expiration_date: string;
  days_until_expiry: number;
}

/**
 * Statut de compliance complet d'un prestataire
 */
export interface ProviderComplianceStatus {
  profile_id: string;
  provider_name: string;
  provider_type: ProviderType;
  raison_sociale: string | null;
  siret: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  kyc_status: KYCStatus;
  compliance_score: number;
  kyc_completed_at: string | null;
  suspension_reason: string | null;
  suspension_until: string | null;
  documents: DocumentStatusSummary[];
  missing_documents: ComplianceDocumentType[];
  can_receive_missions: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Résumé du statut d'un document
 */
export interface DocumentStatusSummary {
  type: ComplianceDocumentType;
  status: DocumentVerificationStatus;
  expiration_date: string | null;
  is_expired: boolean;
  expires_soon: boolean;
}

/**
 * Profil prestataire étendu avec compliance
 */
export interface ProviderProfileExtended {
  profile_id: string;
  type_services: string[];
  certifications: string | null;
  zones_intervention: string | null;
  status: 'pending' | 'approved' | 'rejected';
  validated_at: string | null;
  validated_by: string | null;
  rejection_reason: string | null;
  // Nouveaux champs KYC
  kyc_status: KYCStatus;
  kyc_completed_at: string | null;
  suspension_reason: string | null;
  suspension_until: string | null;
  provider_type: ProviderType;
  raison_sociale: string | null;
  siren: string | null;
  siret: string | null;
  tva_intra: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  compliance_score: number;
  created_at: string;
  updated_at: string;
}

/**
 * Labels des types de documents
 */
export const DOCUMENT_TYPE_LABELS: Record<ComplianceDocumentType, string> = {
  rc_pro: 'Responsabilité Civile Professionnelle',
  decennale: 'Garantie décennale',
  kbis: 'Extrait Kbis',
  id_card_recto: 'Pièce d\'identité (recto)',
  id_card_verso: 'Pièce d\'identité (verso)',
  rib: 'RIB',
  urssaf: 'Attestation URSSAF',
  qualification: 'Qualification professionnelle',
  insurance_other: 'Autre assurance',
  other: 'Autre document',
};

/**
 * Labels des statuts de vérification
 */
export const VERIFICATION_STATUS_LABELS: Record<DocumentVerificationStatus, string> = {
  pending: 'En attente',
  verified: 'Vérifié',
  rejected: 'Rejeté',
  expired: 'Expiré',
};

/**
 * Labels des statuts KYC
 */
export const KYC_STATUS_LABELS: Record<KYCStatus, string> = {
  incomplete: 'Incomplet',
  pending_review: 'En attente de validation',
  verified: 'Vérifié',
  suspended: 'Suspendu',
  rejected: 'Rejeté',
};

/**
 * Couleurs des statuts KYC (Tailwind classes)
 */
export const KYC_STATUS_COLORS: Record<KYCStatus, { bg: string; text: string }> = {
  incomplete: { bg: 'bg-gray-100', text: 'text-gray-700' },
  pending_review: { bg: 'bg-amber-100', text: 'text-amber-700' },
  verified: { bg: 'bg-green-100', text: 'text-green-700' },
  suspended: { bg: 'bg-red-100', text: 'text-red-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
};

/**
 * Labels des types de prestataires
 */
export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  independant: 'Indépendant / Auto-entrepreneur',
  entreprise: 'Entreprise',
  btp: 'Entreprise BTP',
};

/**
 * Icônes des types de documents (Lucide icons)
 */
export const DOCUMENT_TYPE_ICONS: Record<ComplianceDocumentType, string> = {
  rc_pro: 'Shield',
  decennale: 'Building2',
  kbis: 'FileText',
  id_card_recto: 'CreditCard',
  id_card_verso: 'CreditCard',
  rib: 'Landmark',
  urssaf: 'FileCheck',
  qualification: 'Award',
  insurance_other: 'ShieldCheck',
  other: 'File',
};

