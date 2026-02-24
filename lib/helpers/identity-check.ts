/**
 * Helper centralisé pour la vérification d'identité (CNI/KYC) du locataire.
 * Utilisé par Dashboard, Settings, Identity page, Onboarding Sign pour une logique cohérente.
 */

export interface TenantProfileIdentityFields {
  kyc_status?: string | null;
  cni_verified_at?: string | null;
  cni_number?: string | null;
  cni_recto_path?: string | null;
  cni_verso_path?: string | null;
}

/**
 * Détermine si l'identité du locataire est considérée comme vérifiée.
 * Une identité est vérifiée si :
 * - kyc_status === "verified", ou
 * - cni_verified_at est renseigné ET cni_number est renseigné.
 */
export function isIdentityVerified(
  tenantProfile: TenantProfileIdentityFields | null
): boolean {
  if (!tenantProfile) return false;
  if (tenantProfile.kyc_status === "verified") return true;
  if (tenantProfile.cni_verified_at && tenantProfile.cni_number?.trim?.()) return true;
  return false;
}
