/**
 * Logique pure de calcul du score locataire (0-5) et génération d'identifiants.
 * Utilisée par fetchOwnerTenants et testable unitairement.
 */

/**
 * Calcule le score locataire (0-5) à partir des stats de paiement.
 * - Par défaut 5.
 * - Si des paiements existent : round((paymentsOnTime / paymentsTotal) * 5).
 * - Si balance > 0 : score - 1 (min 1).
 */
export function computeTenantScore(
  paymentsOnTime: number,
  paymentsLate: number,
  currentBalance: number
): number {
  const paymentsTotal = paymentsOnTime + paymentsLate;
  let score = 5;
  if (paymentsTotal > 0) {
    const onTimeRate = paymentsOnTime / paymentsTotal;
    score = Math.round(onTimeRate * 5);
  }
  if (currentBalance > 0) {
    score = Math.max(1, score - 1);
  }
  return score;
}

/**
 * Génère l'id unique affiché pour un locataire (linked vs invité).
 */
export function getTenantDisplayId(
  leaseId: string,
  isLinked: boolean,
  profileId: string,
  invitedEmail: string
): string {
  if (isLinked && profileId) {
    return `${leaseId}-${profileId}`;
  }
  return `${leaseId}-invited-${invitedEmail ?? ""}`;
}

/**
 * Détermine le statut de bail affiché (invitation_pending vs statut réel).
 */
export function getTenantLeaseStatus(
  isLinked: boolean,
  leaseStatut: string
): string {
  return !isLinked ? "invitation_pending" : leaseStatut;
}
