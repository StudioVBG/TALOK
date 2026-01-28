"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ticketsService } from "@/features/tickets/services/tickets.service";
import type { Ticket } from "@/lib/types";
import { formatDateShort } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/use-auth";
import { WorkOrdersList } from "@/features/tickets/components/work-orders-list";

function TicketDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchTicket(params.id as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function fetchTicket(id: string) {
    try {
      setLoading(true);
      const data = await ticketsService.getTicketById(id);
      setTicket(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger le ticket.",
        variant: "destructive",
      });
      // Rediriger selon le rôle
      if (profile?.role === "owner") {
        router.push("/owner/tickets");
      } else if (profile?.role === "tenant") {
        router.push("/tenant/requests");
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = async (newStatus: Ticket["statut"]) => {
    if (!ticket) return;

    try {
      await ticketsService.changeTicketStatus(ticket.id, newStatus);
      toast({
        title: "Statut mis à jour",
        description: "Le statut du ticket a été modifié.",
      });
      fetchTicket(ticket.id);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de modifier le statut.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

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

  const canManage = profile?.role === "owner" || profile?.role === "admin";

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{ticket.titre}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(ticket.priorite)}`}>
              {getPriorityLabel(ticket.priorite)}
            </span>
            <span className="text-sm text-muted-foreground">
              {getStatusLabel(ticket.statut)}
            </span>
          </div>
        </div>
        <Button variant="ghost" onClick={() => {
          if (profile?.role === "owner") {
            router.push("/owner/tickets");
          } else if (profile?.role === "tenant") {
            router.push("/tenant/requests");
          } else {
            router.push("/dashboard");
          }
        }}>Retour</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{ticket.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Créé le</p>
            <p className="font-medium">{formatDateShort(ticket.created_at)}</p>
          </div>
          {ticket.property_id && (
            <div>
              <p className="text-sm text-muted-foreground">Logement</p>
              <Link
                href={`/owner/properties/${ticket.property_id}`}
                className="font-medium text-primary hover:underline"
              >
                Voir le logement →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Modifier le statut du ticket</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {ticket.statut !== "open" && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("open")}
                >
                  Rouvrir
                </Button>
              )}
              {ticket.statut !== "in_progress" && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("in_progress")}
                >
                  Mettre en cours
                </Button>
              )}
              {ticket.statut !== "resolved" && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("resolved")}
                >
                  Marquer comme résolu
                </Button>
              )}
              {ticket.statut !== "closed" && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("closed")}
                >
                  Fermer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Interventions associées</h2>
        <WorkOrdersList ticketId={ticket.id} />
      </div>
    </div>
  );
}

export default function TicketDetailPage() {
  return (
    <ProtectedRoute>
      <TicketDetailPageContent />
    </ProtectedRoute>
  );
}

