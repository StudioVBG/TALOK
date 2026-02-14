/**
 * Fonction centralisée pour obtenir l'URL du dashboard d'un rôle.
 * Source de vérité unique pour toutes les redirections par rôle.
 * Gère tous les rôles et sous-rôles (copropriétaires, platform_admin, etc.)
 */
export function getRoleDashboardUrl(role: string | null | undefined): string {
  if (!role) return "/auth/signin";

  switch (role) {
    case "admin":
    case "platform_admin":
      return "/admin/dashboard";
    case "owner":
      return "/owner/dashboard";
    case "tenant":
      return "/tenant/dashboard";
    case "provider":
      return "/provider/dashboard";
    case "agency":
      return "/agency/dashboard";
    case "syndic":
      return "/syndic/dashboard";
    case "guarantor":
      return "/guarantor/dashboard";
    // Tous les sous-rôles copropriété → espace copro
    case "coproprietaire":
    case "coproprietaire_occupant":
    case "coproprietaire_bailleur":
    case "coproprietaire_nu":
    case "usufruitier":
    case "president_cs":
    case "conseil_syndical":
      return "/copro/dashboard";
    default:
      return "/";
  }
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
