"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { workOrdersService } from "@/features/tickets/services/work-orders.service";
import type { WorkOrder } from "@/lib/types";
import { formatDateShort } from "@/lib/helpers/format";
import { formatCurrency } from "@/lib/helpers/format";
import { Eye, Edit } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/hooks/use-auth";

interface WorkOrdersListProps {
  ticketId?: string;
  providerId?: string;
}

export function WorkOrdersList({ ticketId, providerId }: WorkOrdersListProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    loadWorkOrders();
  }, [ticketId, providerId]);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      let data: WorkOrder[];
      if (ticketId) {
        data = await workOrdersService.getWorkOrdersByTicket(ticketId);
      } else if (providerId) {
        data = await workOrdersService.getWorkOrdersByProvider(providerId);
      } else {
        data = await workOrdersService.getWorkOrders();
      }
      setWorkOrders(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger les interventions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (workOrders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Interventions</CardTitle>
          <CardDescription>Aucune intervention enregistrée</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getStatusLabel = (statut: string) => {
    const labels: Record<string, string> = {
      assigned: "Assigné",
      scheduled: "Planifié",
      done: "Terminé",
      cancelled: "Annulé",
    };
    return labels[statut] || statut;
  };

  const getStatusColor = (statut: string) => {
    const colors: Record<string, string> = {
      assigned: "bg-blue-100 text-blue-800",
      scheduled: "bg-yellow-100 text-yellow-800",
      done: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[statut] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {workOrders.map((workOrder) => (
          <Card key={workOrder.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Intervention #{workOrder.id.slice(0, 8)}</CardTitle>
                  <CardDescription>
                    Statut: <span className={`px-2 py-1 rounded text-xs ${getStatusColor(workOrder.statut)}`}>
                      {getStatusLabel(workOrder.statut)}
                    </span>
                  </CardDescription>
                </div>
                <Link href={`/work-orders/${workOrder.id}`}>
                  <Button variant="outline" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    Voir
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {workOrder.date_intervention_prevue && (
                  <div>
                    <p className="text-sm text-muted-foreground">Date prévue</p>
                    <p className="font-medium">{formatDateShort(workOrder.date_intervention_prevue)}</p>
                  </div>
                )}
                {workOrder.date_intervention_reelle && (
                  <div>
                    <p className="text-sm text-muted-foreground">Date réelle</p>
                    <p className="font-medium">{formatDateShort(workOrder.date_intervention_reelle)}</p>
                  </div>
                )}
                {workOrder.cout_estime && (
                  <div>
                    <p className="text-sm text-muted-foreground">Coût estimé</p>
                    <p className="font-medium">{formatCurrency(workOrder.cout_estime)}</p>
                  </div>
                )}
                {workOrder.cout_final && (
                  <div>
                    <p className="text-sm text-muted-foreground">Coût final</p>
                    <p className="font-medium">{formatCurrency(workOrder.cout_final)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

