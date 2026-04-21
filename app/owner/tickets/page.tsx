import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Hammer, Plus, Users, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketListUnified } from "@/features/tickets/components/ticket-list-unified";
import { TicketKPIs } from "@/features/tickets/components/ticket-kpis";
import {
  getTickets,
  getTicketKPIs,
  getTicketsActionStats,
} from "@/features/tickets/server/data-fetching";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";
import { TicketsTabNav } from "./TicketsTabNav";

export default async function OwnerTicketsPage() {
  const [tickets, kpis, actionStats] = await Promise.all([
    getTickets("owner"),
    getTicketKPIs(),
    getTicketsActionStats(),
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

          <Button asChild className="shadow-lg shadow-blue-500/20 w-full sm:w-auto">
            <Link href="/owner/tickets/new">
              <Plus className="mr-2 h-4 w-4" /> Nouveau ticket
            </Link>
          </Button>
        </div>

        {/* Tab navigation */}
        <TicketsTabNav activeTab="tickets" />

        {/* Actions rapides — Travaux & Prestataires */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/owner/work-orders/create"
            className="group relative flex items-center gap-4 rounded-2xl border bg-card p-5 transition hover:border-primary hover:shadow-md"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Hammer className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">
                Demander des travaux
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {actionStats.workOrdersInProgress > 0
                  ? `${actionStats.workOrdersInProgress} ${
                      actionStats.workOrdersInProgress > 1
                        ? "travaux en cours"
                        : "intervention en cours"
                    } · Créer un nouvel ordre`
                  : "Créez un ordre de travail et assignez-le à un prestataire"}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
          </Link>

          <Link
            href="/owner/providers"
            className="group relative flex items-center gap-4 rounded-2xl border bg-card p-5 transition hover:border-primary hover:shadow-md"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">
                Consulter les prestataires
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {actionStats.providersAvailable > 0
                  ? `${actionStats.providersAvailable} ${
                      actionStats.providersAvailable > 1
                        ? "prestataires vérifiés disponibles"
                        : "prestataire vérifié disponible"
                    }`
                  : "Parcourez la marketplace et trouvez un artisan qualifié"}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
          </Link>
        </div>

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
          <div className="text-center py-16 bg-card rounded-2xl border px-4">
            <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucun ticket</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Signalez un incident, planifiez des travaux ou découvrez des
              prestataires qualifiés pour intervenir sur vos biens.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild className="shadow-lg shadow-blue-500/20">
                <Link href="/owner/tickets/new">
                  <Plus className="mr-2 h-4 w-4" /> Nouveau ticket
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/owner/work-orders/create">
                  <Hammer className="mr-2 h-4 w-4" /> Demander des travaux
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/owner/providers">
                  <Users className="mr-2 h-4 w-4" /> Consulter les prestataires
                </Link>
              </Button>
            </div>
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
