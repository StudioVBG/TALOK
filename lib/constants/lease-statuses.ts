/**
 * Statuts de bail visibles sur la page locataires.
 * Source de vérité unique — aligné sur la contrainte DB leases_statut_check.
 */
export const TENANT_VISIBLE_LEASE_STATUSES = [
  "sent",
  "partially_signed",
  "fully_signed",
  "active",
  "amended",
] as const;

export type TenantVisibleLeaseStatus = (typeof TENANT_VISIBLE_LEASE_STATUSES)[number];
