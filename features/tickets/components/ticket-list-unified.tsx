"use client";

import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Hammer,
  ChevronRight,
  Wrench,
  User
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

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
  titre: string;
  description: string;
  statut: string;
  priorite: string;
  created_at: string;
  property?: { adresse_complete: string };
  creator?: { nom: string; prenom: string };
  messages?: { count: number }[];
  work_orders?: WorkOrder[];
}

interface TicketListProps {
  tickets: Ticket[];
  variant: "owner" | "tenant" | "provider";
}

const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  assigned: "Assigné",
  scheduled: "Planifié",
  done: "Terminé",
  cancelled: "Annulé",
};

export function TicketListUnified({ tickets, variant }: TicketListProps) {
  
  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'urgente': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'haute': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800';
      case 'basse': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const basePath = variant === 'owner' ? '/owner/tickets' 
                 : variant === 'tenant' ? '/tenant/requests' 
                 : '/provider/jobs';

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 bg-muted rounded-xl border border-dashed border-border">
        <Hammer className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="font-medium text-foreground">Aucun ticket</h3>
        <p className="text-muted-foreground text-sm">Tout fonctionne parfaitement !</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {tickets.map((ticket) => {
        const activeWorkOrder = ticket.work_orders?.find(wo => wo.statut !== 'cancelled');
        
        return (
          <Card key={ticket.id} className="group relative overflow-hidden transition-all hover:shadow-md">
            <div className="p-5 flex flex-col sm:flex-row gap-4">
              
              {/* Status Line Mobile */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-border group-hover:bg-blue-500 transition-colors" />

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={getPriorityColor(ticket.priorite)}>
                    {ticket.priorite}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
                
                <h3 className="font-semibold text-lg text-foreground line-clamp-1">
                  {ticket.titre}
                </h3>
                
                <p className="text-muted-foreground text-sm line-clamp-2">
                  {ticket.description}
                </p>

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {ticket.property?.adresse_complete}
                  </span>
                  {ticket.messages?.[0]?.count ? (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                      <MessageSquare className="h-3 w-3" />
                      {ticket.messages[0].count} message(s)
                    </span>
                  ) : null}
                </div>

                {/* Prestataire assigné */}
                {activeWorkOrder && activeWorkOrder.provider && (
                  <div className="mt-3 p-2.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-800/50 flex items-center justify-center flex-shrink-0">
                      <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 truncate">
                        {activeWorkOrder.provider.prenom} {activeWorkOrder.provider.nom}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-indigo-500 dark:text-indigo-400/70">
                        <span>{WORK_ORDER_STATUS_LABELS[activeWorkOrder.statut] || activeWorkOrder.statut}</span>
                        {activeWorkOrder.date_intervention_prevue && (
                          <>
                            <span>•</span>
                            <span>
                              Prévu le {format(new Date(activeWorkOrder.date_intervention_prevue), "d MMM", { locale: fr })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Wrench className="h-3.5 w-3.5 text-indigo-400 dark:text-indigo-500 flex-shrink-0" />
                  </div>
                )}
              </div>

              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 pl-4 border-l-0 sm:border-l border-border">
                <StatusBadge status={ticket.statut} type="info" />
                
                <Button variant="ghost" size="sm" asChild className="gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400">
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
