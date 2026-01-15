"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ticketsService } from "../services/tickets.service";
import type { Ticket } from "@/lib/types";
import { formatDateShort } from "@/lib/helpers/format";
import { Sparkles } from "lucide-react";

interface TicketCardProps {
  ticket: Ticket;
  onDelete?: () => void;
}

export function TicketCard({ ticket, onDelete }: TicketCardProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce ticket ?")) return;

    setDeleting(true);
    try {
      await ticketsService.deleteTicket(ticket.id);
      toast({
        title: "Ticket supprimé",
        description: "Le ticket a été supprimé avec succès.",
      });
      onDelete?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      basse: "Basse",
      normale: "Normale",
      haute: "Haute",
    };
    return labels[priority] || priority;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      basse: "bg-gray-100 text-gray-800",
      normale: "bg-blue-100 text-blue-800",
      haute: "bg-red-100 text-red-800",
    };
    return colors[priority] || "bg-gray-100 text-gray-800";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: "Ouvert",
      in_progress: "En cours",
      resolved: "Résolu",
      closed: "Fermé",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-blue-100 text-blue-800",
      resolved: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{ticket.titre}</CardTitle>
            <CardDescription className="line-clamp-2">{ticket.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(ticket.priorite)}`}>
            {getPriorityLabel(ticket.priorite)}
          </span>
          <span className={`text-xs px-2 py-1 rounded ${getStatusColor(ticket.statut)}`}>
            {getStatusLabel(ticket.statut)}
          </span>
        </div>

        <div className="text-sm text-muted-foreground mb-4">
          Créé le {formatDateShort(ticket.created_at)}
        </div>

        {(ticket as any).ai_summary && (
           <div className="bg-blue-50 border border-blue-100 rounded-md p-2 mb-4 text-xs text-blue-800 flex items-start gap-2">
              <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0 text-blue-500" />
              <div>
                <span className="font-medium block mb-1">Analyse IA</span>
                {(ticket as any).ai_summary}
                {(ticket as any).ai_suggested_action && (
                  <div className="mt-1 pt-1 border-t border-blue-200">
                    Action: {(ticket as any).ai_suggested_action}
                  </div>
                )}
              </div>
           </div>
        )}

        <div className="flex gap-2">
          <Link href={`/tickets/${ticket.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              Voir détails
            </Button>
          </Link>
          <Button variant="destructive" size="icon" onClick={handleDelete} disabled={deleting} aria-label="Supprimer le ticket">
            {deleting ? "..." : "🗑️"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

