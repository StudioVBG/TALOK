import { Suspense } from "react";
import Link from "next/link";
import { ClipboardCheck, Hammer, Plus, Users, Wrench, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketListUnified } from "@/features/tickets/components/ticket-list-unified";
import { TicketKPIs } from "@/features/tickets/components/ticket-kpis";
import { getTickets, getTicketKPIs } from "@/features/tickets/server/data-fetching";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { TICKET_OPEN_STATUSES } from "@/lib/tickets/statuses";
import { TicketsTabNav } from "./TicketsTabNav";

const STATUS_LABELS: Record<string, string> = {
  open: "Ouverts",
  in_progress: "En cours",
  resolved: "Résolus",
};

const CATEGORY_LABELS: Record<string, string> = {
  plomberie: "Plomberie",
  electricite: "Électricité",
  serrurerie: "Serrurerie",
  chauffage: "Chauffage",
  humidite: "Humidité",
  nuisibles: "Nuisibles",
  bruit: "Bruit",
  parties_communes: "Parties communes",
  equipement: "Équipement",
  autre: "Autre",
  non_categorise: "Non catégorisé",
};

async function getPendingApprovalsCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) return 0;

    const { data: properties } = await serviceClient
      .from("properties")
      .select("id")
      .eq("owner_id", (profile as { id: string }).id);

    const propertyIds = (properties || []).map((p) => (p as { id: string }).id);
    if (propertyIds.length === 0) return 0;

    const { count } = await serviceClient
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .in("property_id", propertyIds)
      .eq("owner_approval_status", "pending")
      .eq("requester_role", "tenant");

    return count ?? 0;
  } catch {
    return 0;
  }
}

interface OwnerTicketsPageProps {
  searchParams?: Promise<{ status?: string; category?: string }>;
}

export default async function OwnerTicketsPage({ searchParams }: OwnerTicketsPageProps) {
  const params = (await searchParams) ?? {};
  const activeStatus = params.status ?? null;
  const activeCategory = params.category ?? null;

  const [allTickets, kpis, pendingApprovals] = await Promise.all([
    getTickets("owner"),
    getTicketKPIs(),
    getPendingApprovalsCount(),
  ]);

  const tickets = (allTickets as any[]).filter((t) => {
    if (activeStatus === "open") {
      if (!(TICKET_OPEN_STATUSES as readonly string[]).includes(t.statut)) return false;
    } else if (activeStatus === "in_progress") {
      if (t.statut !== "in_progress") return false;
    } else if (activeStatus === "resolved") {
      if (t.statut !== "resolved" && t.statut !== "closed") return false;
    }
    if (activeCategory) {
      const cat = t.category || "non_categorise";
      if (cat !== activeCategory) return false;
    }
    return true;
  });

  const hasActiveFilter = Boolean(activeStatus || activeCategory);

  return (
    <PullToRefreshContainer>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Tickets & travaux
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez les demandes d'intervention et de maintenance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pendingApprovals > 0 && (
              <Button asChild variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300">
                <Link href="/owner/approvals">
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {pendingApprovals} à valider
                  <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    {pendingApprovals}
                  </Badge>
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/owner/providers">
                <Users className="mr-2 h-4 w-4" /> Consulter les prestataires
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/owner/work-orders/create">
                <Hammer className="mr-2 h-4 w-4" /> Demander des travaux
              </Link>
            </Button>
            <Button asChild className="shadow-lg shadow-blue-500/20">
              <Link href="/owner/tickets/new">
                <Plus className="mr-2 h-4 w-4" /> Nouveau ticket
              </Link>
            </Button>
          </div>
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
          <TicketKPIs
            kpis={kpis}
            activeStatus={activeStatus}
            activeCategory={activeCategory}
            basePath="/owner/tickets"
          />
        </Suspense>

        {/* Active filters banner */}
        {hasActiveFilter && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Filtres actifs :
            </span>
            {activeStatus && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                {STATUS_LABELS[activeStatus] ?? activeStatus}
              </Badge>
            )}
            {activeCategory && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                {CATEGORY_LABELS[activeCategory] ?? activeCategory}
              </Badge>
            )}
            <span className="text-xs text-blue-700/70 dark:text-blue-300/70">
              {tickets.length} ticket{tickets.length > 1 ? "s" : ""}
            </span>
            <Button asChild size="sm" variant="ghost" className="ml-auto h-7 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40">
              <Link href="/owner/tickets">
                <X className="mr-1 h-3.5 w-3.5" />
                Réinitialiser
              </Link>
            </Button>
          </div>
        )}

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
