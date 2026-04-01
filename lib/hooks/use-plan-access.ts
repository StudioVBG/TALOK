"use client";

/**
 * usePlanAccess — Hook centralisé pour vérifier les accès par forfait
 *
 * Combine useSubscription (context) avec PLAN_LIMITS (plan-limits.ts)
 * pour offrir une API unifiée de vérification des droits.
 */

import { useMemo } from 'react';
import { useSubscription } from '@/components/subscription/subscription-provider';
import {
  PLAN_LIMITS,
  type PlanLimits,
  getUpgradeTarget,
  getUpgradeCTA,
  getUpgradeReason,
} from '@/lib/subscriptions/plan-limits';
import type { PlanSlug } from '@/lib/subscriptions/plans';

export interface PlanAccess {
  plan: PlanSlug;
  limits: PlanLimits;
  loading: boolean;

  // Vérifications quantitatives
  canAddProperty: (currentCount: number) => boolean;
  canAddUser: (currentCount: number) => boolean;
  canSign: (currentMonthCount: number) => boolean;
  canUpload: (currentStorageMB: number, fileSizeMB: number) => boolean;

  // Vérifications booléennes
  hasFeature: (feature: keyof PlanLimits) => boolean;

  // Métadonnées upgrade
  upgradeTarget: PlanSlug;
  upgradeCTA: string;
  upgradeReason: (feature: keyof PlanLimits) => string;
}

export function usePlanAccess(): PlanAccess {
  const { currentPlan, loading } = useSubscription();
  const limits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.gratuit;

  return useMemo(() => ({
    plan: currentPlan,
    limits,
    loading,

    canAddProperty: (count: number) =>
      limits.maxProperties === -1 || count < limits.maxProperties,

    canAddUser: (count: number) =>
      limits.maxUsers === -1 || count < limits.maxUsers,

    canSign: (monthCount: number) =>
      limits.maxSignaturesPerMonth === -1 || monthCount < limits.maxSignaturesPerMonth,

    canUpload: (storageMB: number, fileMB: number) =>
      limits.maxStorageMB === -1 || (storageMB + fileMB) <= limits.maxStorageMB,

    hasFeature: (feature: keyof PlanLimits) => {
      const val = limits[feature];
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val !== 0;
      return false;
    },

    upgradeTarget: getUpgradeTarget(currentPlan),
    upgradeCTA: getUpgradeCTA(currentPlan),
    upgradeReason: (feature: keyof PlanLimits) => getUpgradeReason(feature, limits),
  }), [currentPlan, limits, loading]);
}
