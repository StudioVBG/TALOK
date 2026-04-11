/**
 * Traduction et style des rôles utilisateur — SSOT
 *
 * Centralise les labels, couleurs et options affichés pour les rôles
 * dans l'application. Couvre les 8 valeurs de USER_ROLES
 * (lib/constants/roles.ts) plus coproprietaire (rôle copro).
 *
 * IMPORTANT: Ne jamais dupliquer ROLE_LABELS / ROLE_COLORS dans d'autres
 * fichiers. Tout passe par ce module.
 */

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  platform_admin: "Admin plateforme",
  owner: "Propriétaire",
  tenant: "Locataire",
  provider: "Prestataire",
  guarantor: "Garant",
  agency: "Agence",
  syndic: "Syndic",
  coproprietaire: "Copropriétaire",
  // Alias historiques
  agent: "Agent",
  manager: "Gestionnaire",
  colocataire: "Colocataire",
  garant: "Garant",
};

/**
 * Classes Tailwind (light + dark) pour le badge de chaque rôle.
 * Une couleur distincte par rôle principal pour une lecture visuelle immédiate.
 */
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
  platform_admin: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  owner: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  tenant: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  provider: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  guarantor: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400",
  agency: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400",
  syndic: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400",
  coproprietaire: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400",
};

const DEFAULT_ROLE_COLOR =
  "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400";

/**
 * Options pour les <Select> de filtrage par rôle.
 * Ordre = priorité d'affichage dans les dropdowns admin.
 */
export const ROLE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "owner", label: "Propriétaires" },
  { value: "tenant", label: "Locataires" },
  { value: "provider", label: "Prestataires" },
  { value: "agency", label: "Agences" },
  { value: "syndic", label: "Syndics" },
  { value: "guarantor", label: "Garants" },
  { value: "admin", label: "Admins" },
  { value: "platform_admin", label: "Super admins" },
];

/**
 * Retourne le label traduit pour un rôle donné.
 * @param role - Le rôle brut depuis la BDD (ex: "owner")
 * @returns Le label traduit (ex: "Propriétaire")
 */
export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role] || role;
}

/**
 * Retourne les classes Tailwind pour le badge de rôle.
 * @param role - Le rôle brut depuis la BDD
 * @returns Les classes Tailwind light + dark
 */
export function getRoleColor(role: string | null | undefined): string {
  if (!role) return DEFAULT_ROLE_COLOR;
  return ROLE_COLORS[role] || DEFAULT_ROLE_COLOR;
}
