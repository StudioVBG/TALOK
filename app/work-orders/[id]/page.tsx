"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { workOrdersService } from "@/features/tickets/services/work-orders.service";
import type { WorkOrder } from "@/lib/types";
import { formatDateShort } from "@/lib/helpers/format";
import { formatCurrency } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function WorkOrderDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    statut: "",
    date_intervention_reelle: "",
    cout_final: 0,
  });

  useEffect(() => {
    if (params.id) {
      fetchWorkOrder(params.id as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (workOrder) {
      setFormData({
        statut: workOrder.statut,
        date_intervention_reelle: workOrder.date_intervention_reelle || "",
        cout_final: workOrder.cout_final || 0,
      });
    }
  }, [workOrder]);

  async function fetchWorkOrder(id: string) {
    try {
      setLoading(true);
      const data = await workOrdersService.getWorkOrderById(id);
      setWorkOrder(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger l'intervention.",
        variant: "destructive",
      });
      router.push("/work-orders");
    } finally {
      setLoading(false);
    }
  }

  const handleUpdate = async () => {
    if (!workOrder) return;

    setUpdating(true);
    try {
      await workOrdersService.updateWorkOrder(workOrder.id, {
        statut: formData.statut as any,
        date_intervention_reelle: formData.date_intervention_reelle || null,
        cout_final: formData.cout_final || null,
      });
      toast({
        title: "Intervention mise à jour",
        description: "L'intervention a été mise à jour avec succès.",
      });
      fetchWorkOrder(workOrder.id);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de mettre à jour l'intervention.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!workOrder) {
    return null;
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

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Intervention #{workOrder.id.slice(0, 8)}</h1>
          <p className="text-muted-foreground">Détails de l&apos;ordre de travail</p>
        </div>
        <Link href="/work-orders">
          <Button variant="ghost">Retour</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Statut</p>
              <p className="font-medium">{getStatusLabel(workOrder.statut)}</p>
            </div>
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
            <div>
              <p className="text-sm text-muted-foreground">Créé le</p>
              <p className="font-medium">{formatDateShort(workOrder.created_at)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mettre à jour</CardTitle>
            <CardDescription>Modifiez le statut et les informations de l&apos;intervention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="statut">Statut</Label>
              <Select value={formData.statut} onValueChange={(value) => setFormData({ ...formData, statut: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned">Assigné</SelectItem>
                  <SelectItem value="scheduled">Planifié</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_intervention_reelle">Date d&apos;intervention réelle</Label>
              <Input
                id="date_intervention_reelle"
                type="date"
                value={formData.date_intervention_reelle}
                onChange={(e) => setFormData({ ...formData, date_intervention_reelle: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cout_final">Coût final (€)</Label>
              <Input
                id="cout_final"
                type="number"
                step="0.01"
                min="0"
                value={formData.cout_final}
                onChange={(e) => setFormData({ ...formData, cout_final: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <Button onClick={handleUpdate} disabled={updating} className="w-full">
              {updating ? "Mise à jour..." : "Mettre à jour"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ticket associé</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href={`/tickets/${workOrder.ticket_id}`}>
            <Button variant="outline">Voir le ticket</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WorkOrderDetailPage() {
  return (
    <ProtectedRoute allowedRoles={["provider", "admin"]}>
      <WorkOrderDetailPageContent />
    </ProtectedRoute>
  );
}

