/**
 * Types TypeScript pour le système GED (Gestion Électronique des Documents)
 * SOTA 2026
 *
 * Complète les types existants dans @/lib/types/index.ts
 * Ne redéfinit PAS DocumentType (déjà dans index.ts)
 */

import type { DocumentType } from "@/lib/types/index";

// ============================================
// CATÉGORIES GED
// ============================================

export type GedDocumentCategory =
  | "legal"
  | "diagnostic"
  | "insurance"
  | "financial"
  | "administrative"
  | "identity"
  | "edl"
  | "maintenance"
  | "other";

export const GED_CATEGORY_LABELS: Record<GedDocumentCategory, string> = {
  legal: "Légaux & Contrats",
  diagnostic: "Diagnostics",
  insurance: "Assurances",
  financial: "Finances",
  administrative: "Administratifs",
  identity: "Identité",
  edl: "États des lieux",
  maintenance: "Maintenance",
  other: "Autres",
};

export const GED_CATEGORY_ICONS: Record<GedDocumentCategory, string> = {
  legal: "FileText",
  diagnostic: "FileSearch",
  insurance: "Shield",
  financial: "Receipt",
  administrative: "Building",
  identity: "User",
  edl: "ClipboardCheck",
  maintenance: "Wrench",
  other: "File",
};

// ============================================
// STATUTS GED
// ============================================

export type GedStatus =
  | "draft"
  | "active"
  | "pending_signature"
  | "signed"
  | "archived"
  | "expired";

export const GED_STATUS_LABELS: Record<GedStatus, string> = {
  draft: "Brouillon",
  active: "Actif",
  pending_signature: "En attente de signature",
  signed: "Signé",
  archived: "Archivé",
  expired: "Expiré",
};

export const GED_STATUS_COLORS: Record<GedStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  draft: "neutral",
  active: "success",
  pending_signature: "warning",
  signed: "success",
  archived: "neutral",
  expired: "error",
};

// ============================================
// EXPIRATION
// ============================================

export type ExpiryStatus =
  | "expired"        // Expiré
  | "expiring_soon"  // < 30 jours
  | "expiring_notice" // < 90 jours
  | "valid"          // Valide
  | null;            // Pas de date d'expiration

export const EXPIRY_LABELS: Record<NonNullable<ExpiryStatus>, string> = {
  expired: "Expiré",
  expiring_soon: "Expire bientôt",
  expiring_notice: "À renouveler",
  valid: "Valide",
};

export const EXPIRY_COLORS: Record<NonNullable<ExpiryStatus>, "error" | "warning" | "info" | "success"> = {
  expired: "error",
  expiring_soon: "warning",
  expiring_notice: "info",
  valid: "success",
};

// ============================================
// TYPE DE DOCUMENT RÉFÉRENTIEL
// ============================================

export interface GedDocumentTypeRef {
  id: DocumentType;
  label: string;
  label_short: string | null;
  icon: string | null;
  category: GedDocumentCategory;
  is_expirable: boolean;
  default_validity_days: number | null;
  can_attach_to_entity: boolean;
  can_attach_to_property: boolean;
  can_attach_to_lease: boolean;
  is_auto_generated: boolean;
  is_mandatory_for_lease: boolean;
  retention_days: number | null;
  display_order: number;
}

// ============================================
// DOCUMENT GED (Vue enrichie)
// ============================================

export interface GedDocument {
  id: string;
  type: DocumentType;
  title: string | null;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  original_filename: string | null;

  // Rattachements
  owner_id: string | null;
  tenant_id: string | null;
  property_id: string | null;
  lease_id: string | null;
  entity_id: string | null;

  // Validité
  valid_from: string | null;
  valid_until: string | null;

  // Versioning
  version: number;
  parent_document_id: string | null;
  is_current_version: boolean;

  // Statut
  ged_status: GedStatus;
  signed_at: string | null;
  tags: string[];

  // IA
  ged_ai_data: Record<string, unknown> | null;
  ged_ai_processed_at: string | null;

  // Audit
  created_at: string;
  updated_at: string;
  created_by: string | null;

  // Enrichi depuis la vue (ged_document_types)
  type_label: string | null;
  type_label_short: string | null;
  type_icon: string | null;
  type_category: GedDocumentCategory | null;
  is_expirable: boolean | null;
  is_mandatory_for_lease: boolean | null;
  expiry_status: ExpiryStatus;
  days_until_expiry: number | null;

  // Relations optionnelles (peuplées par join)
  property?: {
    id: string;
    adresse_complete: string;
    ville: string;
  } | null;
  lease?: {
    id: string;
    type_bail: string;
    date_debut: string;
    date_fin: string | null;
  } | null;
  entity?: {
    id: string;
    nom: string;
    entity_type: string;
  } | null;
}

// ============================================
// ALERTES DOCUMENTS
// ============================================

export type DocumentAlertType =
  | "expiring_soon"
  | "expired"
  | "missing"
  | "action_required";

export type DocumentAlertStatus =
  | "pending"
  | "sent"
  | "dismissed"
  | "resolved";

export interface DocumentAlert {
  id: string;
  document_id: string;
  alert_type: DocumentAlertType;
  days_before_expiry: number | null;
  message: string | null;
  status: DocumentAlertStatus;
  notified_at: string | null;
  notification_channel: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;

  // Relations
  document?: GedDocument | null;
}

export interface DocumentAlertsSummary {
  expired_count: number;
  expiring_soon_count: number;
  expiring_notice_count: number;
  alert_documents: Array<{
    id: string;
    type: DocumentType;
    title: string | null;
    valid_until: string;
    expiry_status: ExpiryStatus;
    days_until_expiry: number;
    property_id: string | null;
    lease_id: string | null;
  }>;
}

// ============================================
// PARTAGES
// ============================================

export type ShareType = "link" | "email";

export interface DocumentShare {
  id: string;
  document_id: string;
  share_type: ShareType;
  recipient_email: string | null;
  recipient_name: string | null;
  share_token: string;
  password_hash: string | null;
  expires_at: string;
  max_downloads: number | null;
  download_count: number;
  created_at: string;
  created_by: string;
  last_accessed_at: string | null;
}

// ============================================
// AUDIT LOG
// ============================================

export type GedAuditAction =
  | "created"
  | "viewed"
  | "downloaded"
  | "updated"
  | "signed"
  | "shared"
  | "archived"
  | "deleted"
  | "restored"
  | "version_created"
  | "alert_created"
  | "alert_dismissed"
  | "ai_analyzed";

export interface GedAuditLogEntry {
  id: string;
  document_id: string;
  action: GedAuditAction;
  details: Record<string, unknown> | null;
  performed_by: string | null;
  ip_address: string | null;
  user_agent: string | null;
  performed_at: string;
}

// ============================================
// FILTRES
// ============================================

export interface GedDocumentFilters {
  propertyId?: string | null;
  leaseId?: string | null;
  entityId?: string | null;
  type?: DocumentType | null;
  category?: GedDocumentCategory | null;
  gedStatus?: GedStatus | null;
  expiryStatus?: ExpiryStatus | null;
  search?: string | null;
  includeArchived?: boolean;
  tags?: string[];
}

// ============================================
// UPLOAD
// ============================================

export interface GedUploadInput {
  file: File;
  type: DocumentType;
  title?: string;
  property_id?: string | null;
  lease_id?: string | null;
  entity_id?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  tags?: string[];
}

// ============================================
// VUES (modes d'affichage)
// ============================================

export type GedViewMode = "quick" | "entity" | "type" | "alerts";

export const GED_VIEW_LABELS: Record<GedViewMode, string> = {
  quick: "Par bien",
  entity: "Par entité",
  type: "Par type",
  alerts: "Alertes",
};

// ============================================
// GROUPEMENTS
// ============================================

export interface GedPropertyGroup {
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
  };
  leases: Array<{
    lease: {
      id: string;
      type_bail: string;
      date_debut: string;
      date_fin: string | null;
      statut?: string;
    };
    documents: GedDocument[];
  }>;
  propertyDocuments: GedDocument[];  // Diagnostics, photos, etc.
}

export interface GedEntityGroup {
  entity: {
    id: string;
    nom: string;
    entity_type: string;
  };
  entityDocuments: GedDocument[];   // Statuts, K-bis, PV AG
  properties: GedPropertyGroup[];
}

export interface GedTypeGroup {
  category: GedDocumentCategory;
  categoryLabel: string;
  types: Array<{
    type: DocumentType;
    typeLabel: string;
    documents: GedDocument[];
    alertCount: number;
  }>;
}
