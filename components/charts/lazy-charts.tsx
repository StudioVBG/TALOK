"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { ComponentType } from "react";

/**
 * Skeleton de chargement pour les graphiques
 */
const ChartSkeleton = ({ height = 300 }: { height?: number }) => (
  <div className="w-full animate-pulse">
    <Skeleton className="w-full rounded-lg" style={{ height }} />
  </div>
);

/**
 * Lazy-loaded Chart Components
 * Ces composants sont chargés uniquement quand nécessaire pour réduire le bundle initial
 */

// Donut Chart (camembert)
export const LazyDonutChart = dynamic(
  () => import("./donut-chart").then((mod) => mod.DonutChart),
  {
    loading: () => <ChartSkeleton height={250} />,
    ssr: false,
  }
);

// Area Chart (graphique en aire)
export const LazyAreaChartCard = dynamic(
  () => import("./area-chart-card").then((mod) => mod.AreaChartCard),
  {
    loading: () => <ChartSkeleton height={350} />,
    ssr: false,
  }
);

// Bar Chart Horizontal
export const LazyBarChartHorizontal = dynamic(
  () => import("./bar-chart-horizontal").then((mod) => mod.BarChartHorizontal),
  {
    loading: () => <ChartSkeleton height={200} />,
    ssr: false,
  }
);

// Finance Chart (pour owner dashboard)
export const LazyFinanceChart = dynamic(
  () => import("@/components/owner/dashboard/finance-chart").then((mod) => mod.FinanceChart),
  {
    loading: () => <ChartSkeleton height={300} />,
    ssr: false,
  }
);

// Export un composant générique pour wrapper n'importe quel graphique
export function withLazyLoading<T extends object>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  height: number = 300
) {
  return dynamic(importFn, {
    loading: () => <ChartSkeleton height={height} />,
    ssr: false,
  });
}



