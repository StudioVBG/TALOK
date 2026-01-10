/**
 * @deprecated Utiliser KpiCard depuis @/components/ui/kpi-card à la place
 * Ce fichier est maintenu pour rétro-compatibilité.
 * Migration: import { KpiCard } from "@/components/ui/kpi-card"
 */

"use client";

import { KpiCard } from "@/components/ui/kpi-card";

// Réexporter les types du composant unifié
export { KpiCard, KpiGrid, type KpiVariant } from "@/components/ui/kpi-card";

interface OwnerKpiCardProps {
  label: string;
  value: number;
  diff?: number;
  expected?: number;
  percentage?: number;
  isArrears?: boolean;
  gradient?: string;
  index?: number;
}

/**
 * @deprecated Utiliser KpiCard depuis @/components/ui/kpi-card
 * Alias de compatibilité pour l'ancienne API OwnerKpiCard
 */
export function OwnerKpiCard({
  label,
  value,
  diff,
  expected,
  percentage,
  isArrears = false,
  gradient,
  index = 0,
}: OwnerKpiCardProps) {
  return (
    <KpiCard
      title={label}
      value={value}
      formatAsCurrency={true}
      diff={diff}
      expected={expected}
      percentage={percentage}
      isArrears={isArrears}
      gradient={gradient}
      animationIndex={index}
    />
  );
}

