/**
 * SSOT 2026 - Constantes de rôles standardisées
 * 
 * Ces constantes sont la SOURCE UNIQUE de vérité pour tous les rôles
 * de signataires et d'utilisateurs dans l'application.
 * 
 * IMPORTANT: Utiliser UNIQUEMENT ces constantes dans tout le code.
 * Ne jamais hardcoder de chaînes comme "locataire", "owner", etc.
 */

// ============================================
// RÔLES DES SIGNATAIRES DE BAIL
// ============================================

export const SIGNER_ROLES = {
  /** Propriétaire / Bailleur */
  OWNER: "proprietaire",
  
  /** Locataire principal (titulaire du bail) */
  TENANT_PRINCIPAL: "locataire_principal",
  
  /** Colocataire (bail colocation) */
  CO_TENANT: "colocataire",
  
  /** Garant / Caution */
  GUARANTOR: "garant",
} as const;

export type SignerRole = typeof SIGNER_ROLES[keyof typeof SIGNER_ROLES];

// ============================================
// RÔLES DES UTILISATEURS (profils)
// ============================================

export const USER_ROLES = {
  ADMIN: "admin",
  OWNER: "owner",
  TENANT: "tenant",
  PROVIDER: "provider",
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// ============================================
// HELPERS DE DÉTECTION DE RÔLE
// ============================================

/**
 * Liste des variantes possibles pour un rôle de propriétaire
 * (pour compatibilité avec les données existantes)
 */
const OWNER_ROLE_VARIANTS = [
  "proprietaire",
  "owner",
  "bailleur",
  "Proprietaire",
  "PROPRIETAIRE",
];

/**
 * Liste des variantes possibles pour un rôle de locataire
 */
const TENANT_ROLE_VARIANTS = [
  "locataire_principal",
  "locataire",
  "tenant",
  "principal",
  "Locataire",
  "LOCATAIRE",
];

/**
 * Liste des variantes possibles pour un colocataire
 */
const CO_TENANT_ROLE_VARIANTS = [
  "colocataire",
  "co_locataire",
  "cotenant",
  "Colocataire",
];

/**
 * Liste des variantes possibles pour un garant
 */
const GUARANTOR_ROLE_VARIANTS = [
  "garant",
  "caution",
  "guarantor",
  "Garant",
];

/**
 * Vérifie si un rôle correspond à un propriétaire/bailleur
 */
export function isOwnerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return OWNER_ROLE_VARIANTS.some(v => v.toLowerCase() === normalized);
}

/**
 * Vérifie si un rôle correspond à un locataire principal
 */
export function isTenantRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return TENANT_ROLE_VARIANTS.some(v => v.toLowerCase() === normalized);
}

/**
 * Vérifie si un rôle correspond à un colocataire
 */
export function isCoTenantRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return CO_TENANT_ROLE_VARIANTS.some(v => v.toLowerCase() === normalized);
}

/**
 * Vérifie si un rôle correspond à un garant
 */
export function isGuarantorRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return GUARANTOR_ROLE_VARIANTS.some(v => v.toLowerCase() === normalized);
}

/**
 * Vérifie si un rôle est un signataire locataire (principal ou colocataire)
 */
export function isAnyTenantRole(role: string | null | undefined): boolean {
  return isTenantRole(role) || isCoTenantRole(role);
}

/**
 * Normalise un rôle vers la valeur standard
 * Utile pour la migration et l'uniformisation
 */
export function normalizeSignerRole(role: string | null | undefined): SignerRole | null {
  if (!role) return null;
  
  if (isOwnerRole(role)) return SIGNER_ROLES.OWNER;
  if (isTenantRole(role)) return SIGNER_ROLES.TENANT_PRINCIPAL;
  if (isCoTenantRole(role)) return SIGNER_ROLES.CO_TENANT;
  if (isGuarantorRole(role)) return SIGNER_ROLES.GUARANTOR;
  
  return null;
}

/**
 * Retourne le libellé français d'un rôle de signataire
 */
export function getSignerRoleLabel(role: string | null | undefined): string {
  if (isOwnerRole(role)) return "Bailleur";
  if (isTenantRole(role)) return "Locataire principal";
  if (isCoTenantRole(role)) return "Colocataire";
  if (isGuarantorRole(role)) return "Garant";
  return "Signataire";
}

/**
 * Retourne le libellé français d'un rôle utilisateur
 */
export function getUserRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case USER_ROLES.ADMIN: return "Administrateur";
    case USER_ROLES.OWNER: return "Propriétaire";
    case USER_ROLES.TENANT: return "Locataire";
    case USER_ROLES.PROVIDER: return "Prestataire";
    default: return "Utilisateur";
  }
}

// ============================================
// STATUTS DE SIGNATURE
// ============================================

export const SIGNATURE_STATUS = {
  PENDING: "pending",
  SIGNED: "signed",
  REFUSED: "refused",
} as const;

export type SignatureStatus = typeof SIGNATURE_STATUS[keyof typeof SIGNATURE_STATUS];

// ============================================
// STATUTS DE BAIL
// ============================================

// Ré-export du type canonique
export type { LeaseStatus } from "@/lib/types";

/**
 * Constantes pour les statuts de bail les plus courants
 * @see LeaseStatus pour tous les statuts disponibles
 */
export const LEASE_STATUS = {
  DRAFT: "draft",
  PENDING_SIGNATURE: "pending_signature",
  PARTIALLY_SIGNED: "partially_signed",
  FULLY_SIGNED: "fully_signed",
  ACTIVE: "active",
  NOTICE_GIVEN: "notice_given",
  TERMINATED: "terminated",
  ARCHIVED: "archived",
} as const satisfies Record<string, import("@/lib/types").LeaseStatus>;

/**
 * Retourne le libellé français d'un statut de bail
 */
export function getLeaseStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case LEASE_STATUS.DRAFT: return "Brouillon";
    case LEASE_STATUS.PENDING_SIGNATURE: return "En attente de signature";
    case LEASE_STATUS.PARTIALLY_SIGNED: return "Partiellement signé";
    case LEASE_STATUS.FULLY_SIGNED: return "Entièrement signé";
    case LEASE_STATUS.ACTIVE: return "Actif";
    case LEASE_STATUS.TERMINATED: return "Résilié";
    default: return "Inconnu";
  }
}

