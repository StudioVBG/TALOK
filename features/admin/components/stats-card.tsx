/**
 * @deprecated Utiliser KpiCard depuis @/components/ui/kpi-card à la place
 * Ce fichier est maintenu pour rétro-compatibilité.
 * Migration: import { KpiCard } from "@/components/ui/kpi-card"
 */

"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import { LucideIcon } from "lucide-react";

// Réexporter le composant unifié
export { KpiCard, KpiGrid, type KpiVariant } from "@/components/ui/kpi-card";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

/**
 * @deprecated Utiliser KpiCard depuis @/components/ui/kpi-card
 */
export function StatsCard({ title, value, description, icon: Icon, trend }: StatsCardProps) {
  return (
    <KpiCard
      title={title}
      value={value}
      description={description}
      icon={Icon?.displayName?.toLowerCase() as any}
      trend={trend ? {
        value: trend.value,
        direction: trend.isPositive ? "up" : "down",
        label: "par rapport au mois dernier"
      } : undefined}
    />
  );
}

