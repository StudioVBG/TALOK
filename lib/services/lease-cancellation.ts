/**
 * Lease Cancellation Service — SOTA 2026
 *
 * Gère la logique d'annulation de bail avec matrice de transitions
 * et guards métier.
 */

import type { LeaseStatus } from "@/lib/types/status";

// ============================================
// TYPES
// ============================================

export type CancellationType =
  | "tenant_withdrawal"   // Rétractation locataire
  | "owner_withdrawal"    // Retrait propriétaire
  | "mutual_agreement"    // Accord mutuel
  | "never_activated"     // Jamais activé (timeout)
  | "error"               // Erreur de saisie
  | "duplicate";          // Bail en doublon

export const CANCELLATION_TYPE_LABELS: Record<CancellationType, string> = {
  tenant_withdrawal: "Rétractation du locataire",
  owner_withdrawal: "Retrait du propriétaire",
  mutual_agreement: "Accord mutuel",
  never_activated: "Jamais activé",
  error: "Erreur de saisie",
  duplicate: "Bail en doublon",
};

// ============================================
// MATRICE DE TRANSITIONS
// ============================================

/**
 * Transitions autorisées depuis chaque statut de bail.
 */
export const LEASE_STATUS_TRANSITIONS: Record<LeaseStatus, LeaseStatus[]> = {
  draft: ["sent", "pending_signature", "cancelled"],
  sent: ["pending_signature", "cancelled"],
  pending_signature: ["partially_signed", "pending_owner_signature", "fully_signed", "cancelled"],
  partially_signed: ["pending_owner_signature", "fully_signed", "cancelled"],
  pending_owner_signature: ["fully_signed", "cancelled"],
  fully_signed: ["active", "cancelled"],
  active: ["notice_given", "terminated", "amended", "archived", "cancelled"],
  notice_given: ["terminated"],
  amended: ["active"],
  terminated: [],     // État final
  archived: [],       // État final
  cancelled: [],      // État final
};

/**
 * Vérifie si une transition de statut est autorisée.
 */
export function canTransitionTo(from: LeaseStatus, to: LeaseStatus): boolean {
  return LEASE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================
// GUARDS D'ANNULATION
// ============================================

export interface LeaseForCancellation {
  id: string;
  statut: string;
  paymentCount: number;
}

export interface CancellationCheckResult {
  canCancel: boolean;
  reason?: string;
}

/**
 * Vérifie si un bail peut être annulé.
 *
 * Règles :
 * - État terminal (terminated, archived, cancelled) → NON
 * - Active AVEC paiements → NON (doit résilier normalement)
 * - Active SANS paiement → OUI (grace period)
 * - Tout autre état non-terminal → OUI
 */
export function canCancelLease(lease: LeaseForCancellation): CancellationCheckResult {
  const status = lease.statut as LeaseStatus;

  // États terminaux
  if (status === "cancelled") {
    return { canCancel: false, reason: "Ce bail est déjà annulé." };
  }
  if (status === "terminated") {
    return { canCancel: false, reason: "Ce bail est terminé. Utilisez la résiliation pour les baux actifs." };
  }
  if (status === "archived") {
    return { canCancel: false, reason: "Ce bail est archivé et ne peut plus être modifié." };
  }

  // Notice en cours → ne peut pas annuler, doit aller au bout du préavis
  if (status === "notice_given") {
    return { canCancel: false, reason: "Un préavis est en cours. Le bail sera terminé à la fin du préavis." };
  }

  // Actif avec paiements → doit résilier normalement
  if (status === "active" && lease.paymentCount > 0) {
    return {
      canCancel: false,
      reason: "Ce bail actif a des paiements enregistrés. Utilisez la résiliation normale.",
    };
  }

  // Tous les autres cas sont annulables
  return { canCancel: true };
}

/**
 * Statuts dans lesquels un bail est considéré comme "zombie"
 * (signé mais jamais activé).
 */
export const ZOMBIE_LEASE_STATUSES: LeaseStatus[] = [
  "pending_signature",
  "partially_signed",
  "pending_owner_signature",
  "fully_signed",
];

/**
 * Vérifie si un bail est un "zombie" (signé/en cours de signature mais jamais activé).
 */
export function isZombieLease(lease: { statut: string; created_at: string; paymentCount?: number }): boolean {
  const isInZombieStatus = ZOMBIE_LEASE_STATUSES.includes(lease.statut as LeaseStatus);
  if (!isInZombieStatus) return false;

  // Considéré zombie si créé depuis plus de 30 jours sans paiement
  const createdAt = new Date(lease.created_at);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return createdAt < thirtyDaysAgo && (lease.paymentCount ?? 0) === 0;
}
