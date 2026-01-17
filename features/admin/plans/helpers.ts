/**
 * Helper functions for Admin Plans
 * Extracted from app/admin/plans/page.tsx
 */

import { PLAN_COLORS } from "./config";
import type { PlanFeatures, PlanColorScheme } from "./types";

export function formatEuros(cents: number): string {
  if (cents === 0) return "Gratuit";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function centsToEuros(cents: number): number {
  return cents / 100;
}

export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

export function getPlanColor(slug: string): PlanColorScheme {
  return PLAN_COLORS[slug] || PLAN_COLORS.solo;
}

export function countActiveFeatures(features: PlanFeatures): number {
  if (!features) return 0;
  return Object.values(features).filter(
    (v) =>
      v === true ||
      (typeof v === "string" && v !== "none") ||
      (typeof v === "number" && v !== 0)
  ).length;
}
