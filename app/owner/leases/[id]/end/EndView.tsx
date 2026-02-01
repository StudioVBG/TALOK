"use client";
// @ts-nocheck

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CalendarOff,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ClipboardCheck,
  ArrowRight,
  Banknote,
  Calendar,
  FileText,
  Home,
} from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";

interface EndProcess {
  id: string;
  status: string;
  lease_end_date: string;
  departure_notice_date?: string;
  total_budget?: number;
  created_at: string;
  updated_at: string;
}

interface ExitEdl {
  id: string;
  status: string;
  type: string;
  scheduled_at?: string | null;
  completed_date?: string | null;
  created_at: string;
}

interface EndViewProps {
  leaseId: string;
  leaseStatus: string;
  propertyId: string;
  dateFin: string | null;
  depotGarantie: number;
  endProcess: EndProcess | null;
  exitEdl: ExitEdl | null;
}

const PROCESS_STATUS: Record<string, { label: string; color: string }> = {
  triggered: { label: "Démarré", color: "bg-blue-100 text-blue-700" },
  edl_in_progress: { label: "EDL en cours", color: "bg-amber-100 text-amber-700" },
  renovation_in_progress: { label: "Travaux en cours", color: "bg-orange-100 text-orange-700" },
  ready_to_rent: { label: "Prêt à louer", color: "bg-emerald-100 text-emerald-700" },
  completed: { label: "Terminé", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulé", color: "bg-slate-100 text-slate-500" },
};

const EDL_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700" },
  scheduled: { label: "Programmé", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700" },
  completed: { label: "Complété", color: "bg-emerald-100 text-emerald-700" },
  signed: { label: "Signé", color: "bg-green-100 text-green-700" },
};

export function EndView({
  leaseId,
  leaseStatus,
  propertyId,
  dateFin,
  depotGarantie,
  endProcess,
  exitEdl,
}: EndViewProps) {
  const canStartProcess = ["active", "notice_given"].includes(leaseStatus) && !endProcess;

  const daysUntilEnd = dateFin
    ? Math.ceil((new Date(dateFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const isUrgent = daysUntilEnd !== null && daysUntilEnd <= 30 && daysUntilEnd > 0;
  const isExpired = daysUntilEnd !== null && daysUntilEnd <= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fin de bail</h2>
        {canStartProcess && (
          <Button size="sm" asChild>
            <Link href={`/owner/end-of-lease?lease_id=${leaseId}`}>
              <CalendarOff className="h-4 w-4 mr-2" />
              Démarrer le processus
            </Link>
          </Button>
        )}
      </div>

      {/* Urgency alert */}
      {(isUrgent || isExpired) && !endProcess && (
        <Card className={`border-2 ${isExpired ? "border-red-300 bg-red-50/50" : "border-amber-300 bg-amber-50/50"}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${isExpired ? "text-red-600" : "text-amber-600"}`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${isExpired ? "text-red-800" : "text-amber-800"}`}>
                {isExpired
                  ? "Le bail a expiré"
                  : `Le bail se termine dans ${daysUntilEnd} jour${daysUntilEnd! > 1 ? "s" : ""}`}
              </p>
              <p className={`text-xs ${isExpired ? "text-red-600" : "text-amber-600"}`}>
                Pensez à démarrer le processus de fin de bail pour organiser la transition.
              </p>
            </div>
            <Button size="sm" variant={isExpired ? "destructive" : "default"} asChild>
              <Link href={`/owner/end-of-lease?lease_id=${leaseId}`}>
                Démarrer
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!endProcess && !exitEdl && !isUrgent && !isExpired ? (
        <EmptyState
          icon={CalendarOff}
          title="Pas de processus de fin de bail"
          description={
            ["active", "notice_given"].includes(leaseStatus)
              ? "Lancez le processus de fin de bail quand le locataire donne son congé."
              : "Le processus de fin de bail sera disponible quand le bail sera actif."
          }
          action={
            canStartProcess
              ? {
                  label: "Démarrer le processus",
                  href: `/owner/end-of-lease?lease_id=${leaseId}`,
                }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* End-of-lease process card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  Processus de fin de bail
                </span>
                {endProcess && (
                  <Badge
                    className={PROCESS_STATUS[endProcess.status]?.color || "bg-slate-100 text-slate-700"}
                    variant="outline"
                  >
                    {PROCESS_STATUS[endProcess.status]?.label || endProcess.status}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {endProcess ? (
                <div className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date de fin</span>
                      <span className="font-medium">
                        {new Date(endProcess.lease_end_date).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    {endProcess.departure_notice_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Préavis</span>
                        <span className="font-medium">
                          {new Date(endProcess.departure_notice_date).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    )}
                    {endProcess.total_budget !== undefined && endProcess.total_budget > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Budget travaux</span>
                        <span className="font-medium">{formatCurrency(endProcess.total_budget)}</span>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/owner/end-of-lease/${endProcess.id}`}>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Gérer le processus
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Pas encore démarré</p>
                  {canStartProcess && (
                    <Button size="sm" asChild>
                      <Link href={`/owner/end-of-lease?lease_id=${leaseId}`}>
                        Démarrer
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Exit EDL card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  EDL de sortie
                </span>
                {exitEdl && (
                  <Badge
                    className={EDL_STATUS[exitEdl.status]?.color || "bg-slate-100 text-slate-700"}
                    variant="outline"
                  >
                    {EDL_STATUS[exitEdl.status]?.label || exitEdl.status}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {exitEdl ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {exitEdl.completed_date ? (
                      <p>Complété le {new Date(exitEdl.completed_date).toLocaleDateString("fr-FR")}</p>
                    ) : exitEdl.scheduled_at ? (
                      <p>Programmé le {new Date(exitEdl.scheduled_at).toLocaleDateString("fr-FR")}</p>
                    ) : (
                      <p>Créé le {new Date(exitEdl.created_at).toLocaleDateString("fr-FR")}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/owner/inspections/${exitEdl.id}`}>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      {["draft", "scheduled", "in_progress"].includes(exitEdl.status)
                        ? "Continuer l'EDL"
                        : "Voir l'EDL"}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <ClipboardCheck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Pas encore créé</p>
                  {["active", "notice_given"].includes(leaseStatus) && (
                    <Button size="sm" asChild>
                      <Link href={`/owner/inspections/new?lease_id=${leaseId}&property_id=${propertyId}&type=sortie`}>
                        Créer l'EDL de sortie
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deposit card */}
          {depotGarantie > 0 && (
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  Dépôt de garantie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(depotGarantie)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      À restituer dans les 2 mois suivant la remise des clés (1 mois si EDL conforme)
                    </p>
                  </div>
                  {endProcess && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/owner/end-of-lease/${endProcess.id}`}>
                        <Banknote className="h-4 w-4 mr-2" />
                        Solde de tout compte
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dates summary */}
      {dateFin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Échéances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fin du bail</span>
                <span className="font-medium">{new Date(dateFin).toLocaleDateString("fr-FR")}</span>
              </div>
              {daysUntilEnd !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jours restants</span>
                  <Badge variant={isExpired ? "destructive" : isUrgent ? "secondary" : "outline"}>
                    {isExpired ? "Expiré" : `${daysUntilEnd} jour${daysUntilEnd > 1 ? "s" : ""}`}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
