import { Suspense } from "react";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketListUnified } from "@/features/tickets/components/ticket-list-unified";
import { TicketKPIs } from "@/features/tickets/components/ticket-kpis";
import { getTickets, getTicketKPIs } from "@/features/tickets/server/data-fetching";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";
import { TicketsTabNav } from "./TicketsTabNav";

export default async function OwnerTicketsPage() {
  const [tickets, kpis] = await Promise.all([
    getTickets("owner"),
    getTicketKPIs(),
  ]);

  return (
    <PullToRefreshContainer>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Tickets & travaux
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez les demandes d'intervention et de maintenance
            </p>
          </div>

          <Button asChild className="shadow-lg shadow-blue-500/20">
            <Link href="/owner/tickets/new">
              <Plus className="mr-2 h-4 w-4" /> Nouveau ticket
            </Link>
          </Button>
        </div>

        {/* Tab navigation */}
        <TicketsTabNav activeTab="tickets" />

        {/* KPIs Dashboard */}
        <Suspense
          fallback={
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          }
        >
          <TicketKPIs kpis={kpis} />
        </Suspense>

        {/* Ticket list */}
        {!tickets || tickets.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border">
            <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucun ticket</h2>
            <p className="text-muted-foreground mb-4">
              Ajoutez un bien et un bail pour commencer à gérer vos tickets de
              maintenance.
            </p>
            <Button asChild>
              <Link href="/owner/properties">Mes biens</Link>
            </Button>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            }
          >
            <TicketListUnified tickets={tickets as any} variant="owner" />
          </Suspense>
        )}
      </div>
    </PullToRefreshContainer>
  );
}
