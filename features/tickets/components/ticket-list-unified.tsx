"use client";

import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronRight,
  Wrench,
  User,
  MessageSquare,
  Hammer,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { getWorkOrderStatusLabel } from "@/lib/tickets/statuses";
import { TicketStatusBadge } from "./ticket-status-badge";
import { PriorityBadge } from "./priority-badge";

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
};

interface WorkOrder {
  id: string;
  statut: string;
  date_intervention_prevue?: string | null;
  cout_estime?: number | null;
  cout_final?: number | null;
  provider?: { id: string; nom: string; prenom: string; telephone?: string } | null;
}

interface Ticket {
  id: string;
  reference?: string | null;
  titre: string;
  description: string;
  statut: string;
  priorite: string;
  category?: string | null;
  created_at: string;
  lease_id?: string | null;
  assigned_to?: string | null;
  property?: { adresse_complete: string };
  lease?: { id: string; date_debut: string; date_fin?: string; statut: string } | null;
  creator?: { nom: string; prenom: string };
  assignee?: { nom: string; prenom: string } | null;
  messages?: { count: number }[];
  ticket_comments?: unknown[];
  work_orders?: WorkOrder[];
}

interface TicketListProps {
  tickets: Ticket[];
  variant: "owner" | "tenant" | "provider";
}

export function TicketListUnified({ tickets, variant }: TicketListProps) {
  const basePath =
    variant === "owner"
      ? "/owner/tickets"
      : variant === "tenant"
        ? "/tenant/requests"
        : "/provider/tickets";

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={Hammer}
        title="Aucun ticket"
        description="Tout fonctionne parfaitement ! Signalez un problème si nécessaire."
        action={
          variant === "tenant"
            ? { label: "Signaler un problème", href: "/tenant/requests/new" }
            : undefined
        }
      />
    );
  }

  return (
    <div className="grid gap-4">
      {tickets.map((ticket) => {
        const activeWorkOrder = ticket.work_orders?.find(
          (wo) => wo.statut !== "cancelled"
        );
        const commentCount =
          ticket.ticket_comments?.length ||
          ticket.messages?.[0]?.count ||
          0;

        return (
          <Card
            key={ticket.id}
            className="group relative overflow-hidden transition-all hover:shadow-md"
          >
            <div className="p-5 flex flex-col sm:flex-row gap-4">
              {/* Status indicator */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-border group-hover:bg-blue-500 transition-colors" />

              <div className="flex-1 space-y-1">
                {/* Reference + Priority + Category + Date */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {ticket.reference && (
                    <span className="font-mono text-[11px] font-bold text-muted-foreground tracking-wide">
                      {ticket.reference}
                    </span>
                  )}
                  <PriorityBadge priority={ticket.priorite} size="sm" />
                  {ticket.category && (
                    <Badge variant="secondary" className="text-[10px] py-0 capitalize">
                      {CATEGORY_LABELS[ticket.category] || ticket.category}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {(() => {
                      const d = new Date(ticket.created_at);
                      return isNaN(d.getTime())
                        ? "—"
                        : format(d, "d MMM yyyy", { locale: fr });
                    })()}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-lg text-foreground line-clamp-1">
                  {ticket.titre}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground text-sm line-clamp-2">
                  {ticket.description}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                  {ticket.property && (
                    <span className="flex items-center gap-1">
                      {ticket.property.adresse_complete}
                    </span>
                  )}
                  {ticket.lease && (
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400"
                    >
                      Bail{" "}
                      {ticket.lease.statut === "active" ? "actif" : ticket.lease.statut}
                    </Badge>
                  )}
                  {commentCount > 0 && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                      <MessageSquare className="h-3 w-3" />
                      {commentCount}
                    </span>
                  )}
                </div>

                {/* Assigned provider */}
                {activeWorkOrder && activeWorkOrder.provider && (
                  <div className="mt-3 p-2.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-800/50 flex items-center justify-center flex-shrink-0">
                      <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 truncate">
                        {activeWorkOrder.provider.prenom}{" "}
                        {activeWorkOrder.provider.nom}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-indigo-500 dark:text-indigo-400/70">
                        <span>
                          {getWorkOrderStatusLabel(activeWorkOrder.statut)}
                        </span>
                        {activeWorkOrder.date_intervention_prevue && (
                          <>
                            <span>•</span>
                            <span>
                              Prévu le{" "}
                              {format(
                                new Date(activeWorkOrder.date_intervention_prevue),
                                "d MMM",
                                { locale: fr }
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Wrench className="h-3.5 w-3.5 text-indigo-400 dark:text-indigo-500 flex-shrink-0" />
                  </div>
                )}
              </div>

              {/* Right: status + action */}
              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 pl-4 border-l-0 sm:border-l border-border">
                <TicketStatusBadge status={ticket.statut} />
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <Link href={`${basePath}/${ticket.id}`}>
                    Voir <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
