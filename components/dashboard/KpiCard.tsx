/**
 * @deprecated Utiliser KpiCard depuis @/components/ui/kpi-card à la place
 * Ce fichier est maintenu pour rétro-compatibilité.
 * Migration: import { KpiCard } from "@/components/ui/kpi-card"
 */

"use client";

// Réexporter le composant unifié SOTA 2026
export { KpiCard, KpiGrid, type KpiVariant } from "@/components/ui/kpi-card";

// Alias pour la compatibilité avec l'ancienne API
export default function DeprecatedKpiCard(props: {
  title: string;
  value: string | number;
  iconName: string;
  variant?: "blue" | "green" | "orange" | "red" | "purple";
  subtitle?: string;
  trend?: { value: number; label?: string };
  href?: string;
  className?: string;
}) {
  // Mapper iconName vers icon pour le nouveau composant
  const { KpiCard } = require("@/components/ui/kpi-card");
  const { iconName, ...rest } = props;

  return <KpiCard {...rest} icon={iconName as any} />;
}
