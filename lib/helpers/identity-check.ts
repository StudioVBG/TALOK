/**
 * Helper centralisé pour la vérification d'identité (CNI/KYC) du locataire.
 * Utilisé par Dashboard, Settings, Identity page, Onboarding Sign, signature EDL/bail.
 */

export interface TenantProfileIdentityFields {
  kyc_status?: string | null;
  cni_verified_at?: string | null;
  cni_number?: string | null;
  cni_recto_path?: string | null;
  cni_verso_path?: string | null;
  cni_expiry_date?: string | null;
}

/**
 * Nombre de jours avant la date d'expiration de la CNI à partir desquels
 * on exige un renouvellement pour signer (bail, EDL). 0 = refuser dès le jour d'expiration.
 */
export const CNI_EXPIRY_GRACE_DAYS = 0;

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

export interface IsIdentityValidForSignatureOptions {
  /** Exiger que la CNI ne soit pas expirée (et éventuellement pas dans la fenêtre "à renouveler"). Défaut: true. */
  requireNotExpired?: boolean;
  /** Jours avant expiration à partir desquels on refuse (ex. 30 = refuser si expire dans ≤30 jours). Défaut: CNI_EXPIRY_GRACE_DAYS. */
  expiryGraceDays?: number;
}

/**
 * Détermine si l'identité est valide pour une action de signature (bail, EDL).
 * Combine isIdentityVerified et, si requireNotExpired, vérifie que cni_expiry_date
 * est renseigné et strictement supérieur à (today + expiryGraceDays).
 */
export function isIdentityValidForSignature(
  tenantProfile: TenantProfileIdentityFields | null,
  options: IsIdentityValidForSignatureOptions = {}
): boolean {
  if (!isIdentityVerified(tenantProfile)) return false;
  const { requireNotExpired = true, expiryGraceDays = CNI_EXPIRY_GRACE_DAYS } = options;
  if (!requireNotExpired) return true;
  const expiry = tenantProfile?.cni_expiry_date;
  if (!expiry || typeof expiry !== "string" || !expiry.trim()) return true;
  const expiryDate = new Date(expiry.trim());
  if (Number.isNaN(expiryDate.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + expiryGraceDays);
  cutoff.setHours(23, 59, 59, 999);
  return expiryDate > cutoff;
}

/**
 * Indique si la CNI est expirée ou dans la fenêtre "à renouveler" (pour affichage message dédié).
 */
export function isCniExpiredOrExpiringSoon(
  tenantProfile: TenantProfileIdentityFields | null,
  graceDays: number = CNI_EXPIRY_GRACE_DAYS
): boolean {
  if (!tenantProfile?.cni_expiry_date?.trim()) return false;
  const expiryDate = new Date(tenantProfile.cni_expiry_date.trim());
  if (Number.isNaN(expiryDate.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + graceDays);
  cutoff.setHours(23, 59, 59, 999);
  return expiryDate <= cutoff;
}
