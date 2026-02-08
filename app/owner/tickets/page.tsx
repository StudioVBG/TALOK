import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketListUnified } from "@/features/tickets/components/ticket-list-unified";
import { getTickets } from "@/features/tickets/server/data-fetching";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";

export default async function OwnerTicketsPage() {
  const tickets = await getTickets("owner");

  return (
    <PullToRefreshContainer>
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Tickets</h1>
          <p className="text-muted-foreground mt-1">Gérez les demandes d'intervention et de maintenance</p>
        </div>
        
        <Button asChild className="shadow-lg shadow-blue-500/20">
          <Link href="/owner/tickets/new">
            <Plus className="mr-2 h-4 w-4" /> Nouveau ticket
          </Link>
        </Button>
      </div>

      {/* Stats Cards (Placeholder pour le futur) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Tickets ouverts</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {tickets.filter((t: any) => t.statut === 'open').length}
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">En cours</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">
            {tickets.filter((t: any) => t.statut === 'in_progress').length}
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Résolus</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">
            {tickets.filter((t: any) => t.statut === 'resolved' || t.statut === 'closed').length}
          </p>
        </div>
      </div>

      {/* Liste Unifiée */}
      <Suspense fallback={<div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>}>
        <TicketListUnified tickets={tickets as any} variant="owner" />
      </Suspense>
    </div>
    </PullToRefreshContainer>
  );
}
