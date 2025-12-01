/**
 * Types pour l'intégration Yousign
 * Documentation: https://developers.yousign.com/
 */

// ============================================
// WORKFLOW STATUTS
// ============================================

export type SignatureRequestStatus = 
  | "draft"           // Brouillon en préparation
  | "pending_validation" // En attente de validation hiérarchique
  | "validated"       // Validé, prêt pour envoi
  | "ongoing"         // En cours de signature
  | "done"            // Toutes signatures reçues
  | "expired"         // Expiré sans signatures
  | "canceled"        // Annulé
  | "rejected";       // Refusé par un signataire

export type SignerStatus = 
  | "pending"         // En attente
  | "notified"        // Notifié par email
  | "opened"          // Document ouvert
  | "signed"          // Signé
  | "refused"         // Refusé
  | "error";          // Erreur technique

export type ValidationStatus = 
  | "pending"
  | "approved"
  | "rejected";

// ============================================
// ENTITÉS PRINCIPALES
// ============================================

export interface SignatureRequest {
  id: string;
  // Métadonnées
  name: string;
  description?: string;
  document_type: DocumentType;
  related_entity_type: "lease" | "inspection" | "quote" | "internal";
  related_entity_id?: string;
  
  // Workflow
  status: SignatureRequestStatus;
  created_by: string;         // profile_id du créateur
  owner_id: string;           // profile_id du propriétaire du dossier
  
  // Validation
  validation_required: boolean;
  validated_by?: string;      // profile_id du valideur
  validated_at?: string;
  validation_comment?: string;
  
  // Yousign
  yousign_procedure_id?: string;
  yousign_webhook_subscription_id?: string;
  
  // Documents
  source_document_id: string; // Document source (non signé)
  signed_document_id?: string; // Document signé final
  proof_document_id?: string;  // Journal des preuves
  
  // Dates
  deadline?: string;
  sent_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SignatureRequestSigner {
  id: string;
  signature_request_id: string;
  
  // Identité
  profile_id?: string;        // Si utilisateur de la plateforme
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  
  // Rôle et ordre
  role: SignerRole;
  signing_order: number;      // 1, 2, 3... pour signatures séquentielles
  
  // Statut
  status: SignerStatus;
  yousign_signer_id?: string;
  
  // Dates
  notified_at?: string;
  opened_at?: string;
  signed_at?: string;
  refused_at?: string;
  refused_reason?: string;
  
  created_at: string;
  updated_at: string;
}

export interface SignatureValidation {
  id: string;
  signature_request_id: string;
  
  // Valideur
  validator_profile_id: string;
  validator_role: ValidatorRole;
  
  // Décision
  status: ValidationStatus;
  comment?: string;
  validated_at?: string;
  
  created_at: string;
}

// ============================================
// RÔLES
// ============================================

export type SignerRole = 
  | "proprietaire"      // Propriétaire du bien
  | "locataire_principal"
  | "colocataire"
  | "garant"
  | "representant_legal" // Pour les sociétés
  | "temoin"
  | "autre";

export type ValidatorRole = 
  | "hierarchique"      // N+1, responsable
  | "juridique"
  | "rh"
  | "finance"
  | "direction";

export type DocumentType = 
  | "bail"
  | "avenant"
  | "edl_entree"
  | "edl_sortie"
  | "quittance"
  | "caution"
  | "devis"
  | "facture"
  | "note_service"
  | "reglement_interieur"
  | "autre";

// ============================================
// YOUSIGN API TYPES
// ============================================

export interface YousignSignatureRequest {
  id: string;
  status: string;
  name: string;
  delivery_mode: "email" | "none";
  ordered_signers: boolean;
  reminder_settings?: {
    interval_in_days: number;
    max_occurrences: number;
  };
  timezone: string;
  expiration_date?: string;
  signers: YousignSigner[];
  documents: YousignDocument[];
  external_id?: string;
  custom_experience_id?: string;
  created_at: string;
}

export interface YousignSigner {
  id?: string;
  info: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    locale: string;
  };
  signature_level: "electronic_signature" | "advanced_electronic_signature" | "qualified_electronic_signature";
  signature_authentication_mode?: "otp_email" | "otp_sms" | "no_otp";
  redirect_urls?: {
    success?: string;
    error?: string;
  };
  custom_text?: {
    request_subject?: string;
    request_body?: string;
  };
  fields?: YousignField[];
}

export interface YousignDocument {
  id?: string;
  nature: "signable_document" | "attachment";
  content_base64?: string;
  filename?: string;
}

export interface YousignField {
  type: "signature" | "mention" | "text" | "checkbox";
  document_id: string;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  mention?: string;
}

// ============================================
// WEBHOOK EVENTS
// ============================================

export interface YousignWebhookEvent {
  id: string;
  event_name: YousignEventType;
  event_time: string;
  sandbox: boolean;
  data: {
    signature_request: {
      id: string;
      status: string;
    };
    signer?: {
      id: string;
      status: string;
    };
  };
}

export type YousignEventType = 
  | "signature_request.activated"
  | "signature_request.done"
  | "signature_request.expired"
  | "signer.notified"
  | "signer.document_opened"
  | "signer.signed"
  | "signer.signature_declined";

// ============================================
// DTOs
// ============================================

export interface CreateSignatureRequestDTO {
  name: string;
  description?: string;
  document_type: DocumentType;
  related_entity_type: "lease" | "inspection" | "quote" | "internal";
  related_entity_id?: string;
  source_document_id: string;
  signers: CreateSignerDTO[];
  validation_required?: boolean;
  deadline?: string;
  ordered_signers?: boolean;
  reminder_interval_days?: number;
}

export interface CreateSignerDTO {
  profile_id?: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: SignerRole;
  signing_order?: number;
  signature_level?: "electronic_signature" | "advanced_electronic_signature" | "qualified_electronic_signature";
}

export interface ValidateRequestDTO {
  approved: boolean;
  comment?: string;
}

