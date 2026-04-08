import { Suspense } from "react";
import { Wrench } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { TicketListUnified } from "@/features/tickets/components/ticket-list-unified";
import { getTickets } from "@/features/tickets/server/data-fetching";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";

export default async function ProviderTicketsPage() {
  const tickets = await getTickets("provider");

  return (
    <PullToRefreshContainer>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Tickets assignés
            </h1>
          </div>
          <p className="text-muted-foreground">
            Tickets et interventions qui vous sont assignés.
          </p>
        </div>

        {/* List */}
        <Suspense
          fallback={
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          }
        >
          <TicketListUnified tickets={tickets as any} variant="provider" />
        </Suspense>
      </div>
    </PullToRefreshContainer>
  );
}
