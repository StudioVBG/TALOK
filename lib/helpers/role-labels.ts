/**
 * Traduction des rôles utilisateur
 *
 * Centralise les labels affichés pour les rôles dans l'application.
 */

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  tenant: "Locataire",
  admin: "Administrateur",
  platform_admin: "Admin plateforme",
  provider: "Prestataire",
  guarantor: "Garant",
  agent: "Agent",
  manager: "Gestionnaire",
  colocataire: "Colocataire",
  garant: "Garant",
};

/**
 * Retourne le label traduit pour un rôle donné.
 * @param role - Le rôle brut depuis la BDD (ex: "owner")
 * @returns Le label traduit (ex: "Propriétaire")
 */
export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role] || role;
}
