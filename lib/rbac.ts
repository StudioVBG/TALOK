// =====================================================
// RBAC Helpers côté application
// =====================================================

import type { 
  RoleCode, 
  PermissionCode, 
  UserRoleDetailed,
  UserPermission 
} from '@/lib/types/copro';

// =====================================================
// MAPPING RÔLES → PERMISSIONS
// =====================================================

export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  platform_admin: [
    'platform.admin',
    'platform.users.manage',
    'platform.billing.manage',
    'sites.create', 'sites.read', 'sites.read_own', 'sites.update', 'sites.delete', 'sites.manage',
    'buildings.manage', 'units.read', 'units.read_own', 'units.manage', 'tantiemes.manage',
    'owners.read', 'owners.manage', 'owners.invite',
    'charges.read', 'charges.read_own', 'charges.manage', 'charges.allocate', 'charges.validate',
    'services.read', 'services.manage', 'contracts.read', 'contracts.manage',
    'expenses.create', 'expenses.manage',
    'calls.read', 'calls.read_own', 'calls.manage', 'calls.send',
    'payments.read', 'payments.read_own', 'payments.create', 'payments.manage',
    'assemblies.read', 'assemblies.manage', 'assemblies.convoke', 'assemblies.vote', 'assemblies.proxy',
    'documents.read', 'documents.read_own', 'documents.manage', 'documents.upload',
    'tickets.read', 'tickets.read_own', 'tickets.create', 'tickets.manage',
    'locatif.charges.read', 'locatif.charges.manage', 'locatif.regularisation',
    'accounting.read', 'accounting.manage',
    'reports.read', 'reports.export',
  ],
  
  syndic: [
    'sites.read', 'sites.update', 'sites.manage',
    'buildings.manage', 'units.read', 'units.manage', 'tantiemes.manage',
    'owners.read', 'owners.manage', 'owners.invite',
    'charges.read', 'charges.manage', 'charges.allocate', 'charges.validate',
    'services.read', 'services.manage', 'contracts.read', 'contracts.manage',
    'expenses.create', 'expenses.manage',
    'calls.read', 'calls.manage', 'calls.send',
    'payments.read', 'payments.create', 'payments.manage',
    'assemblies.read', 'assemblies.manage', 'assemblies.convoke',
    'documents.read', 'documents.manage', 'documents.upload',
    'tickets.read', 'tickets.manage',
    'accounting.read', 'accounting.manage',
    'reports.read', 'reports.export',
  ],
  
  president_cs: [
    'sites.read',
    'units.read',
    'owners.read',
    'charges.read', 'charges.validate',
    'services.read', 'contracts.read',
    'calls.read',
    'payments.read',
    'assemblies.read', 'assemblies.vote', 'assemblies.proxy',
    'documents.read', 'documents.upload',
    'tickets.read', 'tickets.create',
    'accounting.read',
    'reports.read', 'reports.export',
  ],
  
  conseil_syndical: [
    'sites.read',
    'units.read',
    'owners.read',
    'charges.read',
    'services.read', 'contracts.read',
    'calls.read',
    'payments.read',
    'assemblies.read', 'assemblies.vote', 'assemblies.proxy',
    'documents.read',
    'tickets.read', 'tickets.create',
    'accounting.read',
    'reports.read',
  ],
  
  coproprietaire_occupant: [
    'sites.read_own',
    'units.read_own',
    'charges.read_own',
    'calls.read_own',
    'payments.read_own', 'payments.create',
    'assemblies.read', 'assemblies.vote', 'assemblies.proxy',
    'documents.read_own',
    'tickets.read_own', 'tickets.create',
  ],
  
  coproprietaire_bailleur: [
    'sites.read_own',
    'units.read_own',
    'charges.read_own',
    'calls.read_own',
    'payments.read_own', 'payments.create',
    'assemblies.read', 'assemblies.vote', 'assemblies.proxy',
    'documents.read_own',
    'tickets.read_own', 'tickets.create',
    'locatif.charges.read', 'locatif.charges.manage', 'locatif.regularisation',
  ],
  
  coproprietaire_nu: [
    'sites.read_own',
    'units.read_own',
    'charges.read_own',
    'documents.read_own',
  ],
  
  usufruitier: [
    'sites.read_own',
    'units.read_own',
    'charges.read_own',
    'calls.read_own',
    'payments.read_own', 'payments.create',
    'assemblies.read', 'assemblies.vote', 'assemblies.proxy',
    'documents.read_own',
    'tickets.read_own', 'tickets.create',
  ],
  
  locataire: [
    'sites.read_own',
    'charges.read_own',
    'documents.read_own',
    'tickets.read_own', 'tickets.create',
    'locatif.charges.read',
  ],
  
  occupant: [
    'tickets.read_own', 'tickets.create',
  ],
  
  prestataire: [
    'tickets.read',
    'documents.upload',
  ],
  
  gardien: [
    'sites.read_own',
    'units.read',
    'owners.read',
    'tickets.read', 'tickets.create', 'tickets.manage',
    'documents.read', 'documents.upload',
  ],
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Vérifie si l'utilisateur a un rôle donné
 */
export function hasRole(
  userRoles: UserRoleDetailed[],
  roleCode: RoleCode,
  siteId?: string
): boolean {
  return userRoles.some(role => 
    role.role_code === roleCode &&
    role.is_active &&
    (siteId === undefined || role.site_id === null || role.site_id === siteId)
  );
}

/**
 * Vérifie si l'utilisateur a une permission donnée
 */
export function hasPermission(
  userRoles: UserRoleDetailed[],
  permissionCode: PermissionCode,
  siteId?: string
): boolean {
  // Vérifier chaque rôle de l'utilisateur
  for (const userRole of userRoles) {
    if (!userRole.is_active) continue;
    
    // Vérifier le scope du site
    if (siteId && userRole.site_id && userRole.site_id !== siteId) continue;
    
    // Récupérer les permissions du rôle
    const rolePerms = ROLE_PERMISSIONS[userRole.role_code as RoleCode];
    if (rolePerms && rolePerms.includes(permissionCode)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Récupère toutes les permissions effectives d'un utilisateur
 */
export function getEffectivePermissions(
  userRoles: UserRoleDetailed[],
  siteId?: string
): PermissionCode[] {
  const permissions = new Set<PermissionCode>();
  
  for (const userRole of userRoles) {
    if (!userRole.is_active) continue;
    if (siteId && userRole.site_id && userRole.site_id !== siteId) continue;
    
    const rolePerms = ROLE_PERMISSIONS[userRole.role_code as RoleCode];
    if (rolePerms) {
      rolePerms.forEach(perm => permissions.add(perm));
    }
  }
  
  return Array.from(permissions);
}

/**
 * Vérifie si l'utilisateur est admin plateforme
 */
export function isPlatformAdmin(userRoles: UserRoleDetailed[]): boolean {
  return hasRole(userRoles, 'platform_admin');
}

/**
 * Vérifie si l'utilisateur est syndic d'un site
 */
export function isSyndicOf(
  userRoles: UserRoleDetailed[],
  siteId: string
): boolean {
  return hasRole(userRoles, 'syndic', siteId) || isPlatformAdmin(userRoles);
}

/**
 * Vérifie si l'utilisateur est copropriétaire (occupant ou bailleur)
 */
export function isCoproprietaire(userRoles: UserRoleDetailed[]): boolean {
  return hasRole(userRoles, 'coproprietaire_occupant') || 
         hasRole(userRoles, 'coproprietaire_bailleur') ||
         hasRole(userRoles, 'coproprietaire_nu') ||
         hasRole(userRoles, 'usufruitier');
}

/**
 * Récupère les IDs de sites accessibles par l'utilisateur
 */
export function getAccessibleSiteIds(userRoles: UserRoleDetailed[]): string[] {
  if (isPlatformAdmin(userRoles)) {
    return []; // Empty = tous les sites (à gérer côté API)
  }
  
  const siteIds = new Set<string>();
  
  for (const role of userRoles) {
    if (role.is_active && role.site_id) {
      siteIds.add(role.site_id);
    }
  }
  
  return Array.from(siteIds);
}

/**
 * Récupère le rôle le plus élevé de l'utilisateur
 */
export function getHighestRole(userRoles: UserRoleDetailed[]): UserRoleDetailed | null {
  if (userRoles.length === 0) return null;
  
  // Trier par hierarchy_level décroissant
  const sorted = [...userRoles]
    .filter(r => r.is_active)
    .sort((a, b) => b.hierarchy_level - a.hierarchy_level);
  
  return sorted[0] || null;
}

/**
 * Récupère les rôles pour un site spécifique
 */
export function getRolesForSite(
  userRoles: UserRoleDetailed[],
  siteId: string
): UserRoleDetailed[] {
  return userRoles.filter(role => 
    role.is_active && 
    (role.site_id === siteId || role.site_id === null)
  );
}

/**
 * Vérifie si l'utilisateur peut voter en AG
 */
export function canVoteInAssembly(
  userRoles: UserRoleDetailed[],
  siteId: string
): boolean {
  return hasPermission(userRoles, 'assemblies.vote', siteId);
}

/**
 * Vérifie si l'utilisateur peut gérer les charges
 */
export function canManageCharges(
  userRoles: UserRoleDetailed[],
  siteId: string
): boolean {
  return hasPermission(userRoles, 'charges.manage', siteId);
}

/**
 * Vérifie si l'utilisateur peut effectuer des régularisations
 */
export function canDoRegularisation(
  userRoles: UserRoleDetailed[]
): boolean {
  return hasPermission(userRoles, 'locatif.regularisation');
}

// =====================================================
// HELPERS POUR L'AFFICHAGE UI
// =====================================================

export const ROLE_HIERARCHY: Record<RoleCode, number> = {
  platform_admin: 100,
  syndic: 80,
  president_cs: 70,
  conseil_syndical: 60,
  coproprietaire_occupant: 40,
  coproprietaire_bailleur: 40,
  coproprietaire_nu: 30,
  usufruitier: 30,
  gardien: 35,
  prestataire: 30,
  locataire: 20,
  occupant: 10,
};

export const ROLE_COLORS: Record<RoleCode, string> = {
  platform_admin: 'bg-red-500 text-white',
  syndic: 'bg-purple-500 text-white',
  president_cs: 'bg-indigo-500 text-white',
  conseil_syndical: 'bg-blue-500 text-white',
  coproprietaire_occupant: 'bg-emerald-500 text-white',
  coproprietaire_bailleur: 'bg-teal-500 text-white',
  coproprietaire_nu: 'bg-cyan-500 text-white',
  usufruitier: 'bg-sky-500 text-white',
  gardien: 'bg-orange-500 text-white',
  prestataire: 'bg-amber-500 text-white',
  locataire: 'bg-lime-500 text-white',
  occupant: 'bg-gray-500 text-white',
};

export const ROLE_ICONS: Record<RoleCode, string> = {
  platform_admin: '👑',
  syndic: '🏛️',
  president_cs: '⭐',
  conseil_syndical: '📋',
  coproprietaire_occupant: '🏠',
  coproprietaire_bailleur: '🏘️',
  coproprietaire_nu: '📜',
  usufruitier: '🔑',
  gardien: '🛡️',
  prestataire: '🔧',
  locataire: '🚪',
  occupant: '👤',
};

/**
 * Récupère la route de redirection après connexion selon le rôle
 */
export function getDefaultRouteForRole(roleCode: RoleCode): string {
  switch (roleCode) {
    case 'platform_admin':
      return '/admin/dashboard';
    case 'syndic':
      return '/syndic/dashboard';
    case 'president_cs':
    case 'conseil_syndical':
      return '/copro/dashboard';
    case 'coproprietaire_occupant':
    case 'coproprietaire_bailleur':
    case 'coproprietaire_nu':
    case 'usufruitier':
      return '/copro/dashboard';
    case 'locataire':
      return '/tenant/dashboard';
    case 'gardien':
      return '/copro/tickets';
    case 'prestataire':
      return '/provider/dashboard';
    default:
      return '/dashboard';
  }
}

