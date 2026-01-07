/**
 * Types pour le système de signatures internes TALOK
 * Remplace l'intégration YouSign externe
 *
 * Le système utilise des signatures électroniques simples (SES)
 * avec capture d'image de signature + audit trail
 */

// ============================================
// WORKFLOW STATUTS
// ============================================

export type SignatureRequestStatus =
  | "draft"           // Brouillon en préparation
  | "pending"         // En attente de signatures
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

  // Signature
  signature_image_url?: string;
  signature_ip?: string;
  signature_user_agent?: string;

  // Dates
  notified_at?: string;
  opened_at?: string;
  signed_at?: string;
  refused_at?: string;
  refused_reason?: string;

  created_at: string;
  updated_at: string;
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
  deadline?: string;
  ordered_signers?: boolean;
}

export interface CreateSignerDTO {
  profile_id?: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: SignerRole;
  signing_order?: number;
}

export interface SignDocumentDTO {
  signature_image_base64: string;
  ip_address?: string;
  user_agent?: string;
}

// ============================================
// AUDIT TRAIL
// ============================================

export interface SignatureAuditEntry {
  id: string;
  signature_request_id: string;
  signer_id?: string;
  action: SignatureAction;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type SignatureAction =
  | "request_created"
  | "request_sent"
  | "request_canceled"
  | "signer_notified"
  | "document_opened"
  | "document_signed"
  | "signature_refused"
  | "request_completed"
  | "request_expired";
