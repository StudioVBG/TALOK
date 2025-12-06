// =====================================================
// Hook React pour la gestion des permissions RBAC
// =====================================================

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/use-auth';
import type { 
  RoleCode, 
  PermissionCode, 
  UserRoleDetailed 
} from '@/lib/types/copro';
import {
  hasRole as checkHasRole,
  hasPermission as checkHasPermission,
  getEffectivePermissions,
  isPlatformAdmin,
  isSyndicOf,
  isCoproprietaire,
  getAccessibleSiteIds,
  getHighestRole,
  canVoteInAssembly,
  canManageCharges,
  canDoRegularisation,
  getDefaultRouteForRole,
  ROLE_PERMISSIONS,
} from '@/lib/rbac';

export interface UsePermissionsReturn {
  // État
  userRoles: UserRoleDetailed[];
  isLoading: boolean;
  error: Error | null;
  
  // Fonctions de vérification
  hasRole: (roleCode: RoleCode, siteId?: string) => boolean;
  hasPermission: (permissionCode: PermissionCode, siteId?: string) => boolean;
  
  // Helpers
  isPlatformAdmin: boolean;
  isSyndic: (siteId?: string) => boolean;
  isCoproprietaire: boolean;
  isConseilSyndical: (siteId?: string) => boolean;
  
  // Permissions spécifiques
  canVote: (siteId: string) => boolean;
  canManageCharges: (siteId: string) => boolean;
  canRegularise: boolean;
  
  // Données
  effectivePermissions: PermissionCode[];
  accessibleSiteIds: string[];
  highestRole: UserRoleDetailed | null;
  defaultRoute: string;
  
  // Actions
  refreshRoles: () => Promise<void>;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, profile } = useAuth();
  const [userRoles, setUserRoles] = useState<UserRoleDetailed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Charger les rôles de l'utilisateur
  const loadUserRoles = useCallback(async () => {
    if (!user) {
      setUserRoles([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      const { data, error: fetchError } = await supabase
        .from('v_user_roles_detailed')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (fetchError) throw fetchError;

      setUserRoles(data || []);
    } catch (err) {
      console.error('Erreur chargement rôles:', err);
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
      setUserRoles([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserRoles();
  }, [loadUserRoles]);

  // Fonctions de vérification mémorisées
  const hasRole = useCallback(
    (roleCode: RoleCode, siteId?: string) => {
      return checkHasRole(userRoles, roleCode, siteId);
    },
    [userRoles]
  );

  const hasPermission = useCallback(
    (permissionCode: PermissionCode, siteId?: string) => {
      return checkHasPermission(userRoles, permissionCode, siteId);
    },
    [userRoles]
  );

  const isSyndic = useCallback(
    (siteId?: string) => {
      if (siteId) {
        return isSyndicOf(userRoles, siteId);
      }
      return checkHasRole(userRoles, 'syndic');
    },
    [userRoles]
  );

  const isConseilSyndical = useCallback(
    (siteId?: string) => {
      return checkHasRole(userRoles, 'conseil_syndical', siteId) ||
             checkHasRole(userRoles, 'president_cs', siteId);
    },
    [userRoles]
  );

  const canVote = useCallback(
    (siteId: string) => canVoteInAssembly(userRoles, siteId),
    [userRoles]
  );

  const canManageChargesForSite = useCallback(
    (siteId: string) => canManageCharges(userRoles, siteId),
    [userRoles]
  );

  // Valeurs calculées mémorisées
  const effectivePermissions = useMemo(
    () => getEffectivePermissions(userRoles),
    [userRoles]
  );

  const accessibleSiteIds = useMemo(
    () => getAccessibleSiteIds(userRoles),
    [userRoles]
  );

  const highestRole = useMemo(
    () => getHighestRole(userRoles),
    [userRoles]
  );

  const defaultRoute = useMemo(() => {
    if (highestRole) {
      return getDefaultRouteForRole(highestRole.role_code as RoleCode);
    }
    return '/dashboard';
  }, [highestRole]);

  const isPlatformAdminValue = useMemo(
    () => isPlatformAdmin(userRoles),
    [userRoles]
  );

  const isCoproprietaireValue = useMemo(
    () => isCoproprietaire(userRoles),
    [userRoles]
  );

  const canRegulariseValue = useMemo(
    () => canDoRegularisation(userRoles),
    [userRoles]
  );

  return {
    // État
    userRoles,
    isLoading,
    error,
    
    // Fonctions de vérification
    hasRole,
    hasPermission,
    
    // Helpers
    isPlatformAdmin: isPlatformAdminValue,
    isSyndic,
    isCoproprietaire: isCoproprietaireValue,
    isConseilSyndical,
    
    // Permissions spécifiques
    canVote,
    canManageCharges: canManageChargesForSite,
    canRegularise: canRegulariseValue,
    
    // Données
    effectivePermissions,
    accessibleSiteIds,
    highestRole,
    defaultRoute,
    
    // Actions
    refreshRoles: loadUserRoles,
  };
}

// =====================================================
// HOOKS DÉRIVÉS
// =====================================================

/**
 * Hook pour vérifier l'accès à un site spécifique
 */
export function useSiteAccess(siteId: string | undefined) {
  const { hasRole, hasPermission, isLoading } = usePermissions();

  const canAccess = useMemo(() => {
    if (!siteId) return false;
    return hasPermission('sites.read', siteId) || 
           hasPermission('sites.read_own', siteId);
  }, [siteId, hasPermission]);

  const canManage = useMemo(() => {
    if (!siteId) return false;
    return hasPermission('sites.manage', siteId);
  }, [siteId, hasPermission]);

  const isSyndic = useMemo(() => {
    if (!siteId) return false;
    return hasRole('syndic', siteId) || hasRole('platform_admin');
  }, [siteId, hasRole]);

  return {
    canAccess,
    canManage,
    isSyndic,
    isLoading,
  };
}

/**
 * Hook pour les permissions sur les charges
 */
export function useChargesPermissions(siteId: string | undefined) {
  const { hasPermission, isLoading } = usePermissions();

  const canRead = useMemo(() => {
    if (!siteId) return false;
    return hasPermission('charges.read', siteId) || 
           hasPermission('charges.read_own', siteId);
  }, [siteId, hasPermission]);

  const canManage = useMemo(() => {
    if (!siteId) return false;
    return hasPermission('charges.manage', siteId);
  }, [siteId, hasPermission]);

  const canAllocate = useMemo(() => {
    if (!siteId) return false;
    return hasPermission('charges.allocate', siteId);
  }, [siteId, hasPermission]);

  const canValidate = useMemo(() => {
    if (!siteId) return false;
    return hasPermission('charges.validate', siteId);
  }, [siteId, hasPermission]);

  return {
    canRead,
    canManage,
    canAllocate,
    canValidate,
    isLoading,
  };
}

/**
 * Hook pour les permissions sur les AG
 */
export function useAssemblyPermissions(siteId: string | undefined) {
  const { hasPermission, isLoading } = usePermissions();

  const canRead = useMemo(() => {
    if (!siteId) return false;
    return hasPermission('assemblies.read', siteId);
  }, [siteId, hasPermission]);

  const canManage = useMemo(() => {
    if (!siteId) return false;
    return hasPermission('assemblies.manage', siteId);
  }, [siteId, hasPermission]);

  const canConvoke = useMemo(() => {
    if (!siteId) return false;
    return hasPermission('assemblies.convoke', siteId);
  }, [siteId, hasPermission]);

  const canVote = useMemo(() => {
    if (!siteId) return false;
    return hasPermission('assemblies.vote', siteId);
  }, [siteId, hasPermission]);

  const canGiveProxy = useMemo(() => {
    if (!siteId) return false;
    return hasPermission('assemblies.proxy', siteId);
  }, [siteId, hasPermission]);

  return {
    canRead,
    canManage,
    canConvoke,
    canVote,
    canGiveProxy,
    isLoading,
  };
}

/**
 * Composant HOC pour protéger les routes par permission
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermission: PermissionCode,
  FallbackComponent?: React.ComponentType
) {
  return function PermissionGuard(props: P) {
    const { hasPermission, isLoading } = usePermissions();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        </div>
      );
    }

    if (!hasPermission(requiredPermission)) {
      if (FallbackComponent) {
        return <FallbackComponent />;
      }
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Accès refusé
          </h2>
          <p className="text-gray-600">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}

export default usePermissions;

