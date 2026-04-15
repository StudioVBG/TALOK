import { match, P } from "ts-pattern";

/**
 * Rôles publics pour lesquels un parcours d'inscription est proposé.
 */
export const PUBLIC_ROLES = [
  "owner",
  "tenant",
  "provider",
  "guarantor",
  "syndic",
  "agency",
] as const;

export type PublicRole = (typeof PUBLIC_ROLES)[number];

export function isPublicRole(role: string | null | undefined): role is PublicRole {
  return !!role && (PUBLIC_ROLES as readonly string[]).includes(role);
}

/**
 * Fonction centralisée pour obtenir l'URL du dashboard d'un rôle.
 * Source de vérité unique pour toutes les redirections par rôle.
 * Gère tous les rôles et sous-rôles (copropriétaires, platform_admin, etc.)
 */
export function getRoleDashboardUrl(role: string | null | undefined): string {
  return match(role)
    .with(P.nullish, () => "/auth/signin")
    .with("admin", "platform_admin", () => "/admin/dashboard")
    .with("owner", () => "/owner/dashboard")
    .with("tenant", () => "/tenant/dashboard")
    .with("provider", () => "/provider/dashboard")
    .with("agency", () => "/agency/dashboard")
    .with("syndic", () => "/syndic/dashboard")
    .with("guarantor", () => "/guarantor/dashboard")
    .with(
      "coproprietaire", "coproprietaire_occupant", "coproprietaire_bailleur",
      "coproprietaire_nu", "usufruitier", "president_cs", "conseil_syndical",
      () => "/copro/dashboard"
    )
    .otherwise(() => "/");
}

/**
 * Première étape d'onboarding pour un rôle donné.
 * Source unique de vérité pour toutes les redirections post-confirmation d'email
 * et post-étape account_creation. À utiliser partout où l'on doit envoyer un
 * utilisateur vers sa première étape d'onboarding (callback, signup/account,
 * signup/verify-email, /dashboard gating, etc.).
 *
 * Note : le rôle admin n'a pas d'onboarding — il est envoyé directement au
 * dashboard admin. Les rôles inconnus/copropriétaires dérivés retombent sur
 * le dashboard correspondant via getRoleDashboardUrl.
 */
export function getOnboardingStartPath(
  role: string | null | undefined,
  options?: { inviteToken?: string | null; propertyCode?: string | null }
): string {
  const invite = options?.inviteToken?.trim() || null;
  const code = options?.propertyCode?.trim() || null;

  return match(role)
    .with("owner", () => "/signup/plan?role=owner")
    .with("tenant", () => {
      if (invite) return `/tenant/onboarding/context?invite=${encodeURIComponent(invite)}`;
      if (code) return `/tenant/onboarding/context?code=${encodeURIComponent(code)}`;
      return "/tenant/onboarding/context";
    })
    .with("provider", () => "/provider/onboarding/profile")
    .with("guarantor", () =>
      invite
        ? `/guarantor/onboarding/context?invite=${encodeURIComponent(invite)}`
        : "/guarantor/onboarding/context"
    )
    .with("syndic", () => "/syndic/onboarding/profile")
    .with("agency", () => "/agency/onboarding/profile")
    .with("admin", "platform_admin", () => "/admin/dashboard")
    .otherwise(() => getRoleDashboardUrl(role));
}

/**
 * Redirige vers le dashboard approprié si le rôle ne fait pas partie des rôles autorisés.
 * Retourne l'URL de redirection ou null si le rôle est autorisé.
 */
export function getRedirectIfUnauthorized(
  role: string | null | undefined,
  allowedRoles: string[]
): string | null {
  if (!role) return "/auth/signin";
  if (allowedRoles.includes(role)) return null;
  return getRoleDashboardUrl(role);
}

/**
 * Rôles qui donnent accès à l'espace copropriétaire.
 */
export const COPRO_ROLES = [
  "coproprietaire",
  "coproprietaire_occupant",
  "coproprietaire_bailleur",
  "coproprietaire_nu",
  "usufruitier",
  "president_cs",
  "conseil_syndical",
  "syndic",
  "admin",
  "platform_admin",
] as const;

/**
 * Rôles qui donnent accès à l'espace admin.
 */
export const ADMIN_ROLES = ["admin", "platform_admin"] as const;

/**
 * Rôles qui donnent accès à l'espace syndic.
 */
export const SYNDIC_ROLES = ["syndic", "admin", "platform_admin"] as const;

/**
 * Rôles qui donnent accès à l'espace agence.
 */
export const AGENCY_ROLES = ["agency", "admin", "platform_admin"] as const;
