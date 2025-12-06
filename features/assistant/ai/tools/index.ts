/**
 * Index des Tools pour l'Assistant IA
 * SOTA Décembre 2025 - GPT-4o + LangGraph
 * 
 * Gestion des tools par rôle utilisateur
 */

import { searchTools } from "./search-tools";
import { actionTools } from "./action-tools";
import { tenantTools } from "./tenant-tools";
import { providerTools } from "./provider-tools";
import { adminTools } from "./admin-tools";
import type { UserRole } from "../types";

// ============================================
// TOOLS PAR RÔLE
// ============================================

/**
 * Configuration des tools disponibles par rôle
 * - owner: recherche + actions complètes
 * - tenant: tools spécifiques locataire
 * - provider: tools spécifiques prestataire
 * - admin: accès à tous les tools
 */
const toolsByRole: Record<UserRole, unknown[]> = {
  // Propriétaires : recherche et actions complètes
  owner: [
    ...searchTools,
    ...actionTools,
  ],
  
  // Locataires : tools spécifiques (consulter bail, paiements, signaler problèmes)
  tenant: [
    ...tenantTools,
  ],
  
  // Prestataires : tools spécifiques (interventions, statuts)
  provider: [
    ...providerTools,
  ],
  
  // Admins : accès complet à tous les tools
  admin: [
    ...searchTools,
    ...actionTools,
    ...tenantTools,
    ...providerTools,
    ...adminTools,
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Retourne les tools disponibles selon le rôle de l'utilisateur
 * @param role - Rôle de l'utilisateur (owner, tenant, provider, admin)
 * @returns Liste des tools disponibles pour ce rôle
 */
export function getToolsForRole(role: UserRole): unknown[] {
  return toolsByRole[role] || toolsByRole.owner;
}

/**
 * Retourne tous les tools disponibles (pour debug/admin)
 */
export function getAllTools(): unknown[] {
  return [
    ...searchTools,
    ...actionTools,
    ...tenantTools,
    ...providerTools,
    ...adminTools,
  ];
}

/**
 * Retourne les noms des tools disponibles pour un rôle
 */
export function getToolNamesForRole(role: UserRole): string[] {
  const tools = getToolsForRole(role);
  return tools.map((t: any) => t.name);
}

// ============================================
// EXPORTS
// ============================================

// Export des tools par catégorie
export { searchTools } from "./search-tools";
export { actionTools } from "./action-tools";
export { tenantTools } from "./tenant-tools";
export { providerTools } from "./provider-tools";
export { adminTools } from "./admin-tools";

// Export legacy pour compatibilité
export const allTools = [
  ...searchTools,
  ...actionTools,
];

export default {
  getToolsForRole,
  getAllTools,
  getToolNamesForRole,
  allTools,
  searchTools,
  actionTools,
  tenantTools,
  providerTools,
  adminTools,
};
