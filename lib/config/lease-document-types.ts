/**
 * Configuration des types de documents liés à un bail
 *
 * Utilise les types DocumentType existants de @/lib/types/index.ts
 * Mapping des noms simplifiés vers les valeurs du champ `type` en BDD
 */

import type { DocumentType } from "@/lib/types";

// ============================================
// CONFIGURATION PAR TYPE
// ============================================

export interface LeaseDocumentTypeConfig {
  /** Valeur du champ `type` en BDD (DocumentType) */
  type: DocumentType;
  /** Label affiché en français */
  label: string;
  /** Nom Lucide de l'icône */
  icon: string;
  /** Document requis pour le bail */
  required: boolean;
  /** Le document peut expirer (expiry_date pertinent) */
  hasExpiry: boolean;
  /** Jours avant expiration pour alerter */
  expiryWarningDays: number;
  /** Catégorie d'affichage */
  category: "contractuel" | "diagnostic" | "administratif" | "financier";
  /** Visible par le locataire par défaut */
  visibleTenantDefault: boolean;
  /** Peut être supprimé manuellement */
  canDelete: boolean;
  /** Peut être remplacé (archive l'ancien) */
  canReplace: boolean;
}

/**
 * Types de documents obligatoires et optionnels pour un bail
 * Ordre = ordre d'affichage dans l'onglet Documents
 */
export const LEASE_DOCUMENT_TYPES: LeaseDocumentTypeConfig[] = [
  // — Documents obligatoires —
  {
    type: "bail",
    label: "Contrat de bail",
    icon: "FileText",
    required: true,
    hasExpiry: false,
    expiryWarningDays: 0,
    category: "contractuel",
    visibleTenantDefault: true,
    canDelete: false,
    canReplace: false,
  },
  {
    type: "diagnostic_performance",
    label: "DPE (Énergie)",
    icon: "Zap",
    required: true,
    hasExpiry: true,
    expiryWarningDays: 30,
    category: "diagnostic",
    visibleTenantDefault: true,
    canDelete: false,
    canReplace: true,
  },
  {
    type: "attestation_assurance",
    label: "Attestation assurance",
    icon: "Shield",
    required: true,
    hasExpiry: true,
    expiryWarningDays: 30,
    category: "administratif",
    visibleTenantDefault: false,
    canDelete: true,
    canReplace: true,
  },
  {
    type: "EDL_entree",
    label: "État des lieux d'entrée",
    icon: "ClipboardCheck",
    required: true,
    hasExpiry: false,
    expiryWarningDays: 0,
    category: "contractuel",
    visibleTenantDefault: true,
    canDelete: false,
    canReplace: false,
  },
  // — Documents optionnels —
  {
    type: "diagnostic_amiante",
    label: "Diagnostic amiante",
    icon: "AlertTriangle",
    required: false,
    hasExpiry: true,
    expiryWarningDays: 30,
    category: "diagnostic",
    visibleTenantDefault: true,
    canDelete: true,
    canReplace: true,
  },
  {
    type: "EDL_sortie",
    label: "État des lieux de sortie",
    icon: "ClipboardCheck",
    required: false,
    hasExpiry: false,
    expiryWarningDays: 0,
    category: "contractuel",
    visibleTenantDefault: true,
    canDelete: false,
    canReplace: false,
  },
  {
    type: "quittance",
    label: "Quittance de loyer",
    icon: "Receipt",
    required: false,
    hasExpiry: false,
    expiryWarningDays: 0,
    category: "financier",
    visibleTenantDefault: true,
    canDelete: false,
    canReplace: false,
  },
  {
    type: "annexe_pinel",
    label: "Annexe Loi Pinel",
    icon: "FileText",
    required: false,
    hasExpiry: false,
    expiryWarningDays: 0,
    category: "contractuel",
    visibleTenantDefault: true,
    canDelete: true,
    canReplace: true,
  },
  {
    type: "etat_travaux",
    label: "État des travaux",
    icon: "Wrench",
    required: false,
    hasExpiry: false,
    expiryWarningDays: 0,
    category: "contractuel",
    visibleTenantDefault: true,
    canDelete: true,
    canReplace: true,
  },
  {
    type: "pv_remise_cles",
    label: "Procès-verbal de remise des clés",
    icon: "Key",
    required: false,
    hasExpiry: false,
    expiryWarningDays: 0,
    category: "contractuel",
    visibleTenantDefault: true,
    canDelete: false,
    canReplace: false,
  },
  {
    type: "autre",
    label: "Document annexe",
    icon: "File",
    required: false,
    hasExpiry: false,
    expiryWarningDays: 0,
    category: "administratif",
    visibleTenantDefault: false,
    canDelete: true,
    canReplace: true,
  },
];

// Lookup par type pour accès O(1)
export const LEASE_DOCUMENT_TYPE_MAP: Record<string, LeaseDocumentTypeConfig> =
  Object.fromEntries(LEASE_DOCUMENT_TYPES.map((c) => [c.type, c]));

// Types requis uniquement
export const REQUIRED_LEASE_DOCUMENT_TYPES = LEASE_DOCUMENT_TYPES.filter(
  (c) => c.required
);

// Types optionnels uniquement
export const OPTIONAL_LEASE_DOCUMENT_TYPES = LEASE_DOCUMENT_TYPES.filter(
  (c) => !c.required
);

// ============================================
// STATUT UI (calculé, pas stocké en BDD)
// ============================================

export type LeaseDocumentUIStatus =
  | "valid"
  | "expiring_soon"
  | "expired"
  | "missing";

export interface LeaseDocumentUIStatusConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export const LEASE_DOCUMENT_STATUS_CONFIG: Record<
  LeaseDocumentUIStatus,
  LeaseDocumentUIStatusConfig
> = {
  valid: {
    label: "Valide",
    color: "green",
    bgColor: "bg-emerald-100",
    textColor: "text-emerald-700",
  },
  expiring_soon: {
    label: "Expire bientôt",
    color: "orange",
    bgColor: "bg-amber-100",
    textColor: "text-amber-700",
  },
  expired: {
    label: "Expiré",
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
  },
  missing: {
    label: "Manquant",
    color: "orange",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
  },
};

/**
 * Calcule le statut UI d'un document à partir de ses données et sa config.
 * Statut calculé à chaque rendu — jamais stocké en BDD.
 */
export function getLeaseDocumentUIStatus(
  doc: { expiry_date?: string | null; is_archived?: boolean },
  config: LeaseDocumentTypeConfig
): LeaseDocumentUIStatus {
  if (doc.is_archived) return "expired";
  if (!config.hasExpiry || !doc.expiry_date) return "valid";

  const today = new Date();
  const expiry = new Date(doc.expiry_date);
  const daysUntilExpiry = Math.floor(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= config.expiryWarningDays) return "expiring_soon";
  return "valid";
}
