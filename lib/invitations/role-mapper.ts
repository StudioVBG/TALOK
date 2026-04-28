import type { UserRole } from "@/lib/types";

/**
 * Rôles stockés dans la table `invitations` (français, hérité du modèle bail).
 */
export type InvitationRole = "locataire_principal" | "colocataire" | "garant";

/**
 * Source de vérité unique pour la conversion FR → EN entre la taxonomie
 * `invitations.role` et la taxonomie applicative `profiles.role` (UserRole).
 *
 * Doit être appelée côté serveur à chaque fois qu'un flow signup ou
 * acceptation consomme une invitation, pour empêcher un rôle d'invitation
 * d'être détourné vers un rôle applicatif différent.
 */
export function mapInvitationRoleToUserRole(role: InvitationRole): Extract<UserRole, "tenant" | "guarantor"> {
  switch (role) {
    case "locataire_principal":
    case "colocataire":
      return "tenant";
    case "garant":
      return "guarantor";
  }
}

/**
 * Libellé UI court pour afficher le rôle d'une invitation (bannière signup,
 * page acceptation, emails).
 */
export function getInvitationRoleLabel(role: InvitationRole): string {
  switch (role) {
    case "locataire_principal":
      return "Locataire principal";
    case "colocataire":
      return "Colocataire";
    case "garant":
      return "Garant";
  }
}
