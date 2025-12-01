/**
 * Dashboard Components - SOTA 2025
 * Composants réutilisables pour tous les dashboards
 */

export { KpiCard } from "./KpiCard";
export { KpiGrid } from "./KpiGrid";
export { DashboardHeader } from "./DashboardHeader";
export { AlertsBanner } from "./AlertsBanner";
export { QuickActions } from "./QuickActions";
export { RecentActivity } from "./RecentActivity";
export { EmptyState } from "./EmptyState";
export { FinancialSummary } from "./FinancialSummary";
export { ProfileCompletion } from "./ProfileCompletion";

// Profile tasks utilities (Server-compatible)
export { 
  createOwnerProfileTasks, 
  createTenantProfileTasks,
  type ProfileTask,
} from "./profile-tasks";

