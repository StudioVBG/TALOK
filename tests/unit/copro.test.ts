// =====================================================
// Tests unitaires: Module COPRO
// =====================================================

import { describe, it, expect } from 'vitest';
import {
  formatTantiemes,
  calculatePercentage,
  getFloorLabel,
} from '@/lib/types/copro';
import {
  formatAmount,
  getQuarterLabel,
  DEFAULT_RECUPERABLE_SERVICES,
} from '@/lib/types/copro-charges';
import {
  getDefaultMajorityForCategory,
  canVoteOnMotion,
  getRequiredPercentageForMajority,
} from '@/lib/types/copro-assemblies';
import {
  calculateProrata,
  determineRegularisationType,
} from '@/lib/types/copro-locatif';
import {
  hasRole,
  hasPermission,
  isPlatformAdmin,
  getDefaultRouteForRole,
  ROLE_PERMISSIONS,
} from '@/lib/rbac';
import type { UserRoleDetailed } from '@/lib/types/copro';

// =====================================================
// Tests: Types COPRO de base
// =====================================================

describe('Types COPRO de base', () => {
  describe('formatTantiemes', () => {
    it('formate correctement les tantièmes', () => {
      expect(formatTantiemes(100, 10000)).toContain('100');
      expect(formatTantiemes(100, 10000)).toContain('1.00%');
    });

    it('gère le total personnalisé', () => {
      expect(formatTantiemes(500, 1000)).toContain('50.00%');
    });
  });

  describe('calculatePercentage', () => {
    it('calcule le pourcentage correct', () => {
      expect(calculatePercentage(100, 10000)).toBe(1);
      expect(calculatePercentage(2500, 10000)).toBe(25);
    });

    it('gère la division par zéro', () => {
      expect(calculatePercentage(100, 0)).toBe(0);
    });
  });

  describe('getFloorLabel', () => {
    it('retourne les bons labels', () => {
      expect(getFloorLabel(-2)).toBe('Sous-sol 2');
      expect(getFloorLabel(-1)).toBe('Sous-sol 1');
      expect(getFloorLabel(0)).toBe('Rez-de-chaussée');
      expect(getFloorLabel(1)).toBe('1er étage');
      expect(getFloorLabel(2)).toBe('2ème étage');
      expect(getFloorLabel(15)).toBe('15ème étage');
    });
  });
});

// =====================================================
// Tests: Charges COPRO
// =====================================================

describe('Charges COPRO', () => {
  describe('formatAmount', () => {
    it('formate les montants en EUR', () => {
      const result = formatAmount(1234.56);
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('€');
    });
  });

  describe('getQuarterLabel', () => {
    it('retourne le bon trimestre', () => {
      expect(getQuarterLabel(new Date('2025-01-15'))).toContain('1er trimestre 2025');
      expect(getQuarterLabel(new Date('2025-04-15'))).toContain('2ème trimestre 2025');
      expect(getQuarterLabel(new Date('2025-07-15'))).toContain('3ème trimestre 2025');
      expect(getQuarterLabel(new Date('2025-10-15'))).toContain('4ème trimestre 2025');
    });
  });

  describe('DEFAULT_RECUPERABLE_SERVICES', () => {
    it('eau est 100% récupérable', () => {
      expect(DEFAULT_RECUPERABLE_SERVICES.eau.recuperable).toBe(true);
      expect(DEFAULT_RECUPERABLE_SERVICES.eau.ratio).toBe(1.0);
    });

    it('gardiennage est 75% récupérable', () => {
      expect(DEFAULT_RECUPERABLE_SERVICES.gardiennage.recuperable).toBe(true);
      expect(DEFAULT_RECUPERABLE_SERVICES.gardiennage.ratio).toBe(0.75);
    });

    it('honoraires syndic non récupérable', () => {
      expect(DEFAULT_RECUPERABLE_SERVICES.honoraires_syndic.recuperable).toBe(false);
      expect(DEFAULT_RECUPERABLE_SERVICES.honoraires_syndic.ratio).toBe(0);
    });
  });
});

// =====================================================
// Tests: Assemblées Générales
// =====================================================

describe('Assemblées Générales', () => {
  describe('getDefaultMajorityForCategory', () => {
    it('retourne majorité simple pour gestion courante', () => {
      expect(getDefaultMajorityForCategory('general')).toBe('simple');
      expect(getDefaultMajorityForCategory('budget')).toBe('simple');
    });

    it('retourne majorité absolue pour gros travaux', () => {
      expect(getDefaultMajorityForCategory('travaux_majeurs')).toBe('absolute');
    });

    it('retourne double majorité pour vente', () => {
      expect(getDefaultMajorityForCategory('vente_parties_communes')).toBe('double');
    });
  });

  describe('getRequiredPercentageForMajority', () => {
    it('retourne les bons seuils', () => {
      expect(getRequiredPercentageForMajority('simple', 10000)).toBeGreaterThan(50);
      expect(getRequiredPercentageForMajority('absolute', 10000)).toBeGreaterThan(50);
      expect(getRequiredPercentageForMajority('double', 10000)).toBeGreaterThan(66);
      expect(getRequiredPercentageForMajority('unanimity', 10000)).toBe(100);
    });
  });

  describe('canVoteOnMotion', () => {
    it('permet le vote si quorum atteint et AG en cours', () => {
      const motion = { status: 'pending' } as any;
      const assembly = { status: 'in_progress', quorum_reached: true } as any;
      expect(canVoteOnMotion(motion, assembly)).toBe(true);
    });

    it('empêche le vote si quorum non atteint', () => {
      const motion = { status: 'pending' } as any;
      const assembly = { status: 'in_progress', quorum_reached: false } as any;
      expect(canVoteOnMotion(motion, assembly)).toBe(false);
    });

    it('empêche le vote si motion déjà votée', () => {
      const motion = { status: 'voted' } as any;
      const assembly = { status: 'in_progress', quorum_reached: true } as any;
      expect(canVoteOnMotion(motion, assembly)).toBe(false);
    });
  });
});

// =====================================================
// Tests: Bridge Locatif
// =====================================================

describe('Bridge COPRO-Locatif', () => {
  describe('calculateProrata', () => {
    it('calcule le prorata correct pour une période complète', () => {
      const result = calculateProrata(
        new Date('2025-01-01'),
        new Date('2025-03-31'),
        new Date('2025-01-01'),
        new Date('2025-12-31')
      );
      expect(result).toBe(1);
    });

    it('calcule le prorata pour une période partielle', () => {
      const result = calculateProrata(
        new Date('2025-01-01'),
        new Date('2025-03-31'),
        new Date('2025-02-01'),
        new Date('2025-12-31')
      );
      // 59 jours sur 90 (février + mars sur le trimestre)
      expect(result).toBeGreaterThan(0.6);
      expect(result).toBeLessThan(0.7);
    });

    it('retourne 0 si pas de chevauchement', () => {
      const result = calculateProrata(
        new Date('2025-01-01'),
        new Date('2025-03-31'),
        new Date('2025-05-01'),
        new Date('2025-12-31')
      );
      expect(result).toBe(0);
    });
  });

  describe('determineRegularisationType', () => {
    it('détecte un complément à payer', () => {
      expect(determineRegularisationType(1000, 800)).toBe('due_by_tenant');
    });

    it('détecte un remboursement', () => {
      expect(determineRegularisationType(800, 1000)).toBe('refund_to_tenant');
    });

    it('détecte un équilibre', () => {
      expect(determineRegularisationType(1000, 1000)).toBe('balanced');
      expect(determineRegularisationType(1000.005, 1000)).toBe('balanced');
    });
  });
});

// =====================================================
// Tests: RBAC
// =====================================================

describe('RBAC', () => {
  const mockAdminRoles: UserRoleDetailed[] = [
    {
      id: '1',
      user_id: 'user-1',
      role_code: 'platform_admin',
      role_label: 'Admin',
      role_category: 'platform',
      hierarchy_level: 100,
      site_id: null,
      site_name: null,
      unit_id: null,
      lot_number: null,
      is_active: true,
      granted_at: '2025-01-01',
      expires_at: null,
    } as UserRoleDetailed,
  ];

  const mockSyndicRoles: UserRoleDetailed[] = [
    {
      id: '2',
      user_id: 'user-2',
      role_code: 'syndic',
      role_label: 'Syndic',
      role_category: 'copro',
      hierarchy_level: 80,
      site_id: 'site-1',
      site_name: 'Test Site',
      unit_id: null,
      lot_number: null,
      is_active: true,
      granted_at: '2025-01-01',
      expires_at: null,
    } as UserRoleDetailed,
  ];

  const mockCoproRoles: UserRoleDetailed[] = [
    {
      id: '3',
      user_id: 'user-3',
      role_code: 'coproprietaire_occupant',
      role_label: 'Copropriétaire',
      role_category: 'copro',
      hierarchy_level: 40,
      site_id: 'site-1',
      site_name: 'Test Site',
      unit_id: 'unit-1',
      lot_number: '001',
      is_active: true,
      granted_at: '2025-01-01',
      expires_at: null,
    } as UserRoleDetailed,
  ];

  describe('hasRole', () => {
    it('détecte un rôle admin', () => {
      expect(hasRole(mockAdminRoles, 'platform_admin')).toBe(true);
      expect(hasRole(mockAdminRoles, 'syndic')).toBe(false);
    });

    it('détecte un rôle syndic sur un site', () => {
      expect(hasRole(mockSyndicRoles, 'syndic')).toBe(true);
      expect(hasRole(mockSyndicRoles, 'syndic', 'site-1')).toBe(true);
      expect(hasRole(mockSyndicRoles, 'syndic', 'site-2')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('admin a toutes les permissions', () => {
      expect(hasPermission(mockAdminRoles, 'platform.admin')).toBe(true);
      expect(hasPermission(mockAdminRoles, 'sites.manage')).toBe(true);
    });

    it('syndic a les permissions de gestion', () => {
      expect(hasPermission(mockSyndicRoles, 'sites.manage', 'site-1')).toBe(true);
      expect(hasPermission(mockSyndicRoles, 'charges.manage', 'site-1')).toBe(true);
    });

    it('copropriétaire a des permissions limitées', () => {
      expect(hasPermission(mockCoproRoles, 'charges.read_own')).toBe(true);
      expect(hasPermission(mockCoproRoles, 'charges.manage')).toBe(false);
    });
  });

  describe('isPlatformAdmin', () => {
    it('détecte correctement les admins', () => {
      expect(isPlatformAdmin(mockAdminRoles)).toBe(true);
      expect(isPlatformAdmin(mockSyndicRoles)).toBe(false);
      expect(isPlatformAdmin(mockCoproRoles)).toBe(false);
    });
  });

  describe('getDefaultRouteForRole', () => {
    it('retourne les bonnes routes', () => {
      expect(getDefaultRouteForRole('platform_admin')).toBe('/admin/dashboard');
      expect(getDefaultRouteForRole('syndic')).toBe('/syndic/dashboard');
      expect(getDefaultRouteForRole('coproprietaire_occupant')).toBe('/copro/dashboard');
      expect(getDefaultRouteForRole('locataire')).toBe('/tenant/dashboard');
    });
  });

  describe('ROLE_PERMISSIONS mapping', () => {
    it('syndic a les bonnes permissions', () => {
      const syndicPerms = ROLE_PERMISSIONS.syndic;
      expect(syndicPerms).toContain('sites.manage');
      expect(syndicPerms).toContain('charges.manage');
      expect(syndicPerms).toContain('assemblies.manage');
      expect(syndicPerms).not.toContain('platform.admin');
    });

    it('copropriétaire bailleur a les permissions locatives', () => {
      const bailleurPerms = ROLE_PERMISSIONS.coproprietaire_bailleur;
      expect(bailleurPerms).toContain('locatif.charges.read');
      expect(bailleurPerms).toContain('locatif.regularisation');
    });
  });
});

