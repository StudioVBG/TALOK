/**
 * Feature gates pour le module colocation
 * SOTA 2026
 *
 * Colocation disponible des Confort (colocation: true dans plans.ts)
 * SEPA individuel debloque en Pro+
 */

import type { PlanSlug } from "@/lib/subscriptions/plans";

export interface ColocationGates {
  canCreateColocation: boolean;
  maxRooms: number;
  hasExpenseSharing: boolean;
  hasTaskPlanning: boolean;
  hasRulesEditor: boolean;
  hasIndividualSEPA: boolean;
}

const COLOCATION_GATES: Record<string, ColocationGates> = {
  gratuit: {
    canCreateColocation: false,
    maxRooms: 0,
    hasExpenseSharing: false,
    hasTaskPlanning: false,
    hasRulesEditor: false,
    hasIndividualSEPA: false,
  },
  starter: {
    canCreateColocation: false,
    maxRooms: 0,
    hasExpenseSharing: false,
    hasTaskPlanning: false,
    hasRulesEditor: false,
    hasIndividualSEPA: false,
  },
  confort: {
    canCreateColocation: true,
    maxRooms: 10,
    hasExpenseSharing: true,
    hasTaskPlanning: true,
    hasRulesEditor: true,
    hasIndividualSEPA: false,
  },
  pro: {
    canCreateColocation: true,
    maxRooms: 50,
    hasExpenseSharing: true,
    hasTaskPlanning: true,
    hasRulesEditor: true,
    hasIndividualSEPA: true,
  },
  enterprise_s: {
    canCreateColocation: true,
    maxRooms: 999,
    hasExpenseSharing: true,
    hasTaskPlanning: true,
    hasRulesEditor: true,
    hasIndividualSEPA: true,
  },
  enterprise_m: {
    canCreateColocation: true,
    maxRooms: 999,
    hasExpenseSharing: true,
    hasTaskPlanning: true,
    hasRulesEditor: true,
    hasIndividualSEPA: true,
  },
  enterprise_l: {
    canCreateColocation: true,
    maxRooms: 999,
    hasExpenseSharing: true,
    hasTaskPlanning: true,
    hasRulesEditor: true,
    hasIndividualSEPA: true,
  },
  enterprise_xl: {
    canCreateColocation: true,
    maxRooms: 999,
    hasExpenseSharing: true,
    hasTaskPlanning: true,
    hasRulesEditor: true,
    hasIndividualSEPA: true,
  },
};

/**
 * Get colocation feature gates for a plan
 */
export function getColocationGates(plan: string): ColocationGates {
  return COLOCATION_GATES[plan] || COLOCATION_GATES.gratuit;
}

/**
 * Check if a plan can create colocations
 */
export function canCreateColocation(plan: string): boolean {
  return getColocationGates(plan).canCreateColocation;
}

/**
 * Check if individual SEPA is available for a plan
 */
export function hasIndividualSEPA(plan: string): boolean {
  return getColocationGates(plan).hasIndividualSEPA;
}
