/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanGate } from "@/components/subscription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Wrench, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Calendar,
  Euro,
  User,
  Building2,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";

interface WorkOrder {
  id: string;
  ticket_id: string;
  provider_id: string;
  date_intervention_prevue: string | null;
  date_intervention_reelle: string | null;
  cout_estime: number | null;
  cout_final: number | null;
  statut: "assigned" | "scheduled" | "done" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  ticket?: {
    id: string;
    titre: string;
    description: string;
    priorite: string;
    statut: string;
    property?: {
      id: string;
      adresse_complete: string;
      ville: string;
    };
  };
  provider?: {
    id: string;
    prenom: string;
    nom: string;
  };
}

const statusConfig = {
  assigned: {
    label: "Assigné",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    icon: User,
  },
  scheduled: {
    label: "Planifié",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    icon: Calendar,
  },
  done: {
    label: "Terminé",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Annulé",
    color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
    icon: XCircle,
  },
};

const priorityConfig = {
  basse: "bg-slate-100 text-slate-700",
  normale: "bg-blue-100 text-blue-700",
  haute: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  async function fetchWorkOrders() {
    try {
      setLoading(true);
      const response = await fetch("/api/work-orders");
      if (!response.ok) {
        throw new Error("Erreur lors du chargement des interventions");
      }
      const data = await response.json();
      setWorkOrders(data.workOrders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const filteredWorkOrders = workOrders.filter((wo) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return ["assigned", "scheduled"].includes(wo.statut);
    if (activeTab === "completed") return wo.statut === "done";
    if (activeTab === "cancelled") return wo.statut === "cancelled";
    return true;
  });

  const stats = {
    total: workOrders.length,
    pending: workOrders.filter((wo) => ["assigned", "scheduled"].includes(wo.statut)).length,
    completed: workOrders.filter((wo) => wo.statut === "done").length,
    cancelled: workOrders.filter((wo) => wo.statut === "cancelled").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchWorkOrders}>Réessayer</Button>
      </div>
    );
  }

  return (
    <PlanGate feature="work_orders" mode="blur">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interventions</h1>
          <p className="text-muted-foreground">
            Gérez les interventions des prestataires sur vos logements
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">En cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Terminées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <XCircle className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.cancelled}</p>
                <p className="text-sm text-muted-foreground">Annulées</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & List */}
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">Toutes ({stats.total})</TabsTrigger>
              <TabsTrigger value="pending">En cours ({stats.pending})</TabsTrigger>
              <TabsTrigger value="completed">Terminées ({stats.completed})</TabsTrigger>
              <TabsTrigger value="cancelled">Annulées ({stats.cancelled})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {filteredWorkOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wrench className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Aucune intervention</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Les interventions apparaîtront ici lorsque des prestataires seront assignés à vos tickets.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredWorkOrders.map((workOrder) => {
                const status = statusConfig[workOrder.statut];
                const StatusIcon = status.icon;
                
                return (
                  <div
                    key={workOrder.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        {/* Ticket Title & Status */}
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${status.color}`}>
                            <StatusIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium">
                                {workOrder.ticket?.titre || "Intervention sans ticket"}
                              </h4>
                              <Badge variant="outline" className={status.color}>
                                {status.label}
                              </Badge>
                              {workOrder.ticket?.priorite && (
                                <Badge 
                                  variant="outline" 
                                  className={priorityConfig[workOrder.ticket.priorite as keyof typeof priorityConfig]}
                                >
                                  {workOrder.ticket.priorite}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                              {workOrder.ticket?.description}
                            </p>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground ml-11">
                          {workOrder.ticket?.property && (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              <span>{workOrder.ticket.property.adresse_complete}</span>
                            </div>
                          )}
                          {workOrder.provider && (
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>
                                {workOrder.provider.prenom} {workOrder.provider.nom}
                              </span>
                            </div>
                          )}
                          {workOrder.date_intervention_prevue && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {format(new Date(workOrder.date_intervention_prevue), "dd MMM yyyy", { locale: fr })}
                              </span>
                            </div>
                          )}
                          {(workOrder.cout_final || workOrder.cout_estime) && (
                            <div className="flex items-center gap-1">
                              <Euro className="h-4 w-4" />
                              <span>
                                {workOrder.cout_final 
                                  ? `${workOrder.cout_final.toFixed(2)} €` 
                                  : `~${workOrder.cout_estime?.toFixed(2)} € (estimé)`
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-11 sm:ml-0">
                        {workOrder.ticket_id && (
                          <Link href={`/owner/tickets/${workOrder.ticket_id}`}>
                            <Button variant="outline" size="sm">
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Voir ticket
                            </Button>
                          </Link>
                        )}
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Notes */}
                    {workOrder.notes && (
                      <div className="mt-3 ml-11 p-3 bg-muted/50 rounded-md text-sm">
                        <p className="text-muted-foreground">{workOrder.notes}</p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-3 ml-11 text-xs text-muted-foreground">
                      Créé {formatDistanceToNow(new Date(workOrder.created_at), { addSuffix: true, locale: fr })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </PlanGate>
  );
}

