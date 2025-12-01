/**
 * Charts exports
 * Utiliser les versions Lazy pour une meilleure performance
 */

// Lazy-loaded versions (recommandées pour la plupart des cas)
export {
  LazyDonutChart,
  LazyAreaChartCard,
  LazyBarChartHorizontal,
  LazyFinanceChart,
  withLazyLoading,
} from "./lazy-charts";

// Direct imports (utiliser seulement si le graphique est critique pour le LCP)
export { DonutChart } from "./donut-chart";
export { AreaChartCard } from "./area-chart-card";
export { BarChartHorizontal } from "./bar-chart-horizontal";
