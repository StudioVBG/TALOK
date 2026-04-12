"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Clock, Play, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

interface CronDefinition {
  name: string;
  route: string;
  description: string;
  frequency: string;
  method: "GET" | "POST";
}

const CRON_DEFINITIONS: CronDefinition[] = [
  { name: "generate-invoices", route: "/api/cron/generate-invoices", description: "Generation des factures mensuelles", frequency: "1er du mois", method: "GET" },
  { name: "payment-reminders", route: "/api/cron/payment-reminders", description: "Relances de paiement (J-3 a J+30)", frequency: "Quotidien 9h", method: "GET" },
  { name: "overdue-check", route: "/api/cron/overdue-check", description: "Detection retards + penalites legales", frequency: "Quotidien 9h", method: "GET" },
  { name: "subscription-alerts", route: "/api/cron/subscription-alerts", description: "Alertes abonnements expirants", frequency: "Quotidien 10h", method: "GET" },
  { name: "lease-expiry-alerts", route: "/api/cron/lease-expiry-alerts", description: "Alertes baux arrivant a expiration", frequency: "Lundi 8h", method: "GET" },
  { name: "check-cni-expiry", route: "/api/cron/check-cni-expiry", description: "Verification expiration CNI", frequency: "Quotidien", method: "GET" },
  { name: "cni-expiry-reminders", route: "/api/cron/cni-expiry-reminders", description: "Rappels CNI J-30", frequency: "Quotidien", method: "GET" },
  { name: "process-outbox", route: "/api/cron/process-outbox", description: "Traitement evenements outbox", frequency: "Toutes les min", method: "GET" },
  { name: "process-webhooks", route: "/api/cron/process-webhooks", description: "Traitement webhooks en attente", frequency: "Toutes les min", method: "GET" },
  { name: "notifications", route: "/api/cron/notifications", description: "Envoi rappels paiement et baux", frequency: "Quotidien", method: "GET" },
  { name: "onboarding-reminders", route: "/api/cron/onboarding-reminders", description: "Rappels onboarding incomplet", frequency: "Quotidien", method: "GET" },
  { name: "irl-indexation", route: "/api/cron/irl-indexation", description: "Calcul indexations IRL annuelles", frequency: "1er du mois", method: "GET" },
  { name: "refresh-analytics", route: "/api/cron/refresh-analytics", description: "Rafraichir vues materialisees", frequency: "Quotidien 4h", method: "GET" },
  { name: "zombie-lease-cleanup", route: "/api/cron/zombie-lease-cleanup", description: "Annulation baux zombies (>30j)", frequency: "Quotidien", method: "GET" },
  { name: "seasonal-cleaning", route: "/api/cron/seasonal-cleaning", description: "Rappels menage saisonnier", frequency: "Mensuel", method: "POST" },
  { name: "meters-sync", route: "/api/cron/meters-sync", description: "Synchronisation compteurs Enedis", frequency: "Quotidien", method: "GET" },
  { name: "visit-reminders", route: "/api/cron/visit-reminders", description: "Rappels visites H-24 et H-1", frequency: "Toutes les 30min", method: "GET" },
  { name: "rent-reminders", route: "/api/cron/rent-reminders", description: "(Deprecated) Remplace par payment-reminders", frequency: "Desactive", method: "GET" },
  { name: "copro-assembly-countdown", route: "/api/cron/copro-assembly-countdown", description: "Rappels AG copropriete", frequency: "Quotidien", method: "GET" },
  { name: "copro-convocation-reminders", route: "/api/cron/copro-convocation-reminders", description: "Rappels convocations copro", frequency: "Quotidien", method: "GET" },
  { name: "copro-fund-call-reminders", route: "/api/cron/copro-fund-call-reminders", description: "Rappels appels de fonds copro", frequency: "Quotidien", method: "GET" },
  { name: "copro-overdue-alerts", route: "/api/cron/copro-overdue-alerts", description: "Alertes impayes copro", frequency: "Quotidien", method: "GET" },
  { name: "copro-pv-distribution", route: "/api/cron/copro-pv-distribution", description: "Distribution PV assemblees copro", frequency: "Quotidien", method: "GET" },
];

export default function AdminCronsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [runningCron, setRunningCron] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "crons"],
    queryFn: async () => {
      const res = await fetch("/api/admin/crons");
      if (!res.ok) throw new Error("Erreur de chargement");
      return res.json();
    },
  });

  const logs = data?.logs || [];

  const getLastRun = (cronName: string) => {
    return logs.find((l: any) => l.cron_name === cronName);
  };

  const handleRunCron = async (cron: CronDefinition) => {
    setRunningCron(cron.name);
    try {
      const res = await fetch(cron.route, { method: cron.method });
      const result = await res.json().catch(() => ({}));

      if (res.ok) {
        toast({ title: "Succes", description: `${cron.name} execute avec succes` });
      } else {
        toast({
          title: "Erreur",
          description: result.error || `Echec de ${cron.name}`,
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "crons"] });
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible de lancer le cron", variant: "destructive" });
    } finally {
      setRunningCron(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Taches planifiees</h1>
        <p className="text-muted-foreground">
          {CRON_DEFINITIONS.length} crons configures — declenchement via Supabase pg_cron + pg_net
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total crons</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{CRON_DEFINITIONS.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Derniers logs</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-muted-foreground">
              {logs.length === 0 ? "Table cron_logs non configuree" : "Entrees dans cron_logs"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Erreurs recentes</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter((l: any) => l.status === "error").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Crons table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des crons</CardTitle>
          <CardDescription>Cliquez sur &quot;Lancer&quot; pour executer manuellement un cron</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Frequence</TableHead>
                  <TableHead>Dernier run</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CRON_DEFINITIONS.map((cron) => {
                  const lastRun = getLastRun(cron.name);
                  const isRunning = runningCron === cron.name;
                  const isDeprecated = cron.frequency === "Desactive";

                  return (
                    <TableRow key={cron.name} className={isDeprecated ? "opacity-50" : ""}>
                      <TableCell className="font-medium font-mono text-xs">
                        {cron.name}
                      </TableCell>
                      <TableCell className="text-sm">{cron.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{cron.frequency}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lastRun
                          ? new Date(lastRun.started_at).toLocaleString("fr-FR")
                          : <span className="text-muted-foreground/50">Non tracke</span>}
                      </TableCell>
                      <TableCell>
                        {lastRun ? (
                          <Badge variant={lastRun.status === "success" ? "default" : "destructive"} className="text-xs">
                            {lastRun.status === "success" ? (
                              <><CheckCircle className="h-3 w-3 mr-1" />OK</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" />Erreur</>
                            )}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />N/A
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRunCron(cron)}
                          disabled={isRunning || isDeprecated}
                        >
                          {isRunning ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><Play className="h-3 w-3 mr-1" />Lancer</>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
