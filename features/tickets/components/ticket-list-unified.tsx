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
  ChevronRight
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

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
}

interface TicketListProps {
  tickets: Ticket[];
  variant: "owner" | "tenant" | "provider";
}

export function TicketListUnified({ tickets, variant }: TicketListProps) {
  
  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'urgente': return 'bg-red-100 text-red-700 border-red-200';
      case 'haute': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'basse': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const basePath = variant === 'owner' ? '/owner/tickets' 
                 : variant === 'tenant' ? '/tenant/requests' 
                 : '/provider/jobs';

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed">
        <Hammer className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <h3 className="font-medium text-slate-900">Aucun ticket</h3>
        <p className="text-slate-500 text-sm">Tout fonctionne parfaitement !</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {tickets.map((ticket) => (
        <Card key={ticket.id} className="group relative overflow-hidden transition-all hover:shadow-md">
          <div className="p-5 flex flex-col sm:flex-row gap-4">
            
            {/* Status Line Mobile */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 group-hover:bg-blue-500 transition-colors" />

            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={getPriorityColor(ticket.priorite)}>
                  {ticket.priorite}
                </Badge>
                <span className="text-xs text-slate-400">
                  {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                </span>
              </div>
              
              <h3 className="font-semibold text-lg text-slate-900 line-clamp-1">
                {ticket.titre}
              </h3>
              
              <p className="text-slate-500 text-sm line-clamp-2">
                {ticket.description}
              </p>

              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {ticket.property?.adresse_complete}
                </span>
                {ticket.messages?.[0]?.count ? (
                  <span className="flex items-center gap-1 text-blue-600 font-medium">
                    <MessageSquare className="h-3 w-3" />
                    {ticket.messages[0].count} message(s)
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 pl-4 border-l-0 sm:border-l border-slate-100">
              <StatusBadge status={ticket.statut} />
              
              <Button variant="ghost" size="sm" asChild className="gap-1 hover:bg-blue-50 hover:text-blue-600">
                <Link href={`${basePath}/${ticket.id}`}>
                  Voir <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
