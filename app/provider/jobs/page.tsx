import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketListUnified } from "@/features/tickets/components/ticket-list-unified";
import { getTickets } from "@/features/tickets/server/data-fetching";

// Helper pour compter les tickets selon le statut des work_orders du prestataire
function countByWorkOrderStatus(tickets: any[], ...statuses: string[]) {
  return tickets.filter((t: any) =>
    t.work_orders?.some((wo: any) => statuses.includes(wo.statut))
  ).length;
}

export default async function VendorJobsPage() {
  const tickets = await getTickets("provider");

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Missions</h1>
        <p className="text-muted-foreground mt-1">Interventions à réaliser et historique</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">À planifier</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
            {countByWorkOrderStatus(tickets, 'assigned')}
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">En cours</p>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {countByWorkOrderStatus(tickets, 'scheduled', 'in_progress')}
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Terminés</p>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {countByWorkOrderStatus(tickets, 'done')}
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>}>
        <TicketListUnified tickets={tickets as any} variant="provider" />
      </Suspense>
    </div>
  );
}
