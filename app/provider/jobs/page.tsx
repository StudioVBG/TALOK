import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketListUnified } from "@/features/tickets/components/ticket-list-unified";
import { getTickets } from "@/features/tickets/server/data-fetching";

export default async function VendorJobsPage() {
  const tickets = await getTickets("provider");

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Missions</h1>
        <p className="text-slate-500 mt-1">Interventions à réaliser et historique</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <p className="text-sm font-medium text-slate-500">À planifier</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {tickets.filter((t: any) => t.statut === 'assigned').length}
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <p className="text-sm font-medium text-slate-500">En cours</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">
            {tickets.filter((t: any) => t.statut === 'scheduled' || t.statut === 'in_progress').length}
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Terminés</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">
            {tickets.filter((t: any) => t.statut === 'done' || t.statut === 'resolved').length}
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>}>
        <TicketListUnified tickets={tickets as any} variant="provider" />
      </Suspense>
    </div>
  );
}
