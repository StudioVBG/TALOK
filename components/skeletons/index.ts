/**
 * Skeletons - Composants de chargement réutilisables
 *
 * Utilisez ces composants dans les loading.tsx pour afficher
 * des états de chargement cohérents et éviter le CLS (Cumulative Layout Shift)
 *
 * @example
 * // Dans app/owner/properties/loading.tsx
 * import { PropertiesListSkeleton } from "@/components/skeletons";
 * export default function Loading() {
 *   return <PropertiesListSkeleton />;
 * }
 */

// Dashboard
export {
  DashboardSkeleton,
  StatCardSkeleton,
  StatsGridSkeleton,
  ChartSkeleton,
} from "./dashboard-skeleton";

// Properties
export {
  PropertyCardSkeleton,
  PropertyCardGridSkeleton,
} from "./property-card-skeleton";

export { PropertiesListSkeleton } from "./properties-list-skeleton";

// Leases
export { LeasesListSkeleton } from "./leases-list-skeleton";

// Tickets
export {
  TicketCardSkeleton,
  TicketCardGridSkeleton,
} from "./ticket-card-skeleton";

export { TicketsListSkeleton } from "./tickets-list-skeleton";

// Invoices
export { InvoiceRowSkeleton, InvoicesListSkeleton } from "./invoices-list-skeleton";

// Documents
export {
  DocumentCardSkeleton,
  DocumentListSkeleton,
  FolderSkeleton,
  FolderGridSkeleton,
} from "./document-skeleton";

// Tables
export {
  TableRowSkeleton,
  TableSkeleton,
  TablePageSkeleton,
} from "./table-skeleton";

// Forms
export {
  FormFieldSkeleton,
  TextareaSkeleton,
  FormSkeleton,
  FormCardSkeleton,
  FormPageSkeleton,
  WizardSkeleton,
} from "./form-skeleton";

// Money / Finance
export {
  TransactionCardSkeleton,
  TransactionListSkeleton,
  MoneyDashboardSkeleton,
} from "./money-skeleton";

// Tenants
export {
  TenantCardSkeleton,
  TenantListSkeleton,
  TenantProfileSkeleton,
} from "./tenant-skeleton";
