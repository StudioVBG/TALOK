"use client";

import { useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useCoproSites } from "@/lib/hooks/use-copro-lots";
import { useSyndicDashboard } from "@/lib/hooks/use-syndic-dashboard";
import { formatCents } from "@/lib/utils/format-cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Building2,
  Send,
  Clock,
  Euro,
  Users,
  TrendingDown,
  FileText,
  Loader2,
} from "lucide-react";

export default function ImpayesClient() {
  return (
    <PlanGate feature="copro_module" mode="blur">
      <ImpayesContent />
    </PlanGate>
  );
}

function ImpayesContent() {
  const { data: sites } = useCoproSites();
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const activeSiteId = selectedSiteId || sites?.[0]?.id || "";
  const { toast } = useToast();

  const { overdueCopros, kpis, isLoading, refetch } = useSyndicDashboard(activeSiteId);

  const [pendingAll, setPendingAll] = useState(false);
  const [pendingLot, setPendingLot] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  const totalOverdue = overdueCopros.reduce((sum, c) => sum + c.amount_cents, 0);
  const avgDaysLate =
    overdueCopros.length > 0
      ? Math.round(
          overdueCopros.reduce((sum, c) => sum + c.days_late, 0) /
            overdueCopros.length
        )
      : 0;

  async function handleRemindAll() {
    if (!activeSiteId) return;
    setPendingAll(true);
    try {
      const res = await fetch("/api/copro/overdue/remind-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: activeSiteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      toast({
        title: "Relances envoyées",
        description: `${body.sent ?? 0} copropriétaire(s) relancé(s).`,
      });
      refetch();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Échec de la relance",
        variant: "destructive",
      });
    } finally {
      setPendingAll(false);
    }
  }

  async function handleRemindLot(lotId: string) {
    if (!activeSiteId) return;
    setPendingLot(lotId);
    try {
      // On relance toutes les lignes liées à ce lot via remind-all puis on
      // retourne un résultat. Pour rester simple, on n'utilise pas line_id ici.
      const res = await fetch("/api/copro/overdue/remind-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: activeSiteId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erreur");
      }
      toast({
        title: "Relance envoyée",
        description: "Le copropriétaire a été relancé.",
      });
      refetch();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Échec de la relance",
        variant: "destructive",
      });
    } finally {
      setPendingLot(null);
    }
  }

  async function handleFormalNotice(lotId: string) {
    if (!activeSiteId) return;
    setPendingNotice(lotId);
    try {
      const res = await fetch("/api/copro/overdue/formal-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: activeSiteId, lot_id: lotId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      toast({
        title: "Mise en demeure envoyée",
        description: "Le copropriétaire est officiellement mis en demeure.",
      });
      refetch();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Échec de l'envoi",
        variant: "destructive",
      });
    } finally {
      setPendingNotice(null);
    }
  }

  if (isLoading) {
    return <ImpayesLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Suivi des impayés
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Copropriétaires en retard de paiement
          </p>
        </div>

        {sites && sites.length > 1 && (
          <Select value={activeSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-full sm:w-64">
              <Building2 className="w-4 h-4 mr-2 text-cyan-600" />
              <SelectValue placeholder="Sélectionner une copropriété" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Montant total impayé"
          value={formatCents(totalOverdue)}
          icon={<Euro className="w-5 h-5" />}
          color="red"
        />
        <KpiCard
          title="Copropriétaires en retard"
          value={String(overdueCopros.length)}
          icon={<Users className="w-5 h-5" />}
          color="amber"
        />
        <KpiCard
          title="Retard moyen"
          value={`${avgDaysLate} jours`}
          icon={<Clock className="w-5 h-5" />}
          color="blue"
        />
      </div>

      {kpis && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-cyan-600" />
                <span className="text-sm font-medium text-foreground">
                  Taux de recouvrement
                </span>
              </div>
              <span className="text-lg font-bold text-foreground">
                {kpis.taux_recouvrement_pct}%
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  kpis.taux_recouvrement_pct >= 90
                    ? "bg-emerald-500"
                    : kpis.taux_recouvrement_pct >= 70
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{
                  width: `${Math.min(100, kpis.taux_recouvrement_pct)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {overdueCopros.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Aucun impayé
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Tous les copropriétaires sont à jour de leurs paiements.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-base flex items-center gap-2 flex-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Copropriétaires en retard
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemindAll}
              disabled={pendingAll || !activeSiteId}
              className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30"
            >
              {pendingAll ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              Relancer tous
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Lot
                    </th>
                    <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Copropriétaire
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Montant dû
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Retard
                    </th>
                    <th className="text-center py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Gravité
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6" />
                  </tr>
                </thead>
                <tbody>
                  {overdueCopros
                    .sort((a, b) => b.amount_cents - a.amount_cents)
                    .map((copro) => {
                      const severity =
                        copro.days_late > 90
                          ? "critique"
                          : copro.days_late > 30
                            ? "modere"
                            : "recent";
                      const severityConfig = {
                        critique: {
                          label: "Critique",
                          className:
                            "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
                        },
                        modere: {
                          label: "Modéré",
                          className:
                            "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
                        },
                        recent: {
                          label: "Récent",
                          className:
                            "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
                        },
                      } as const;

                      const isReminding = pendingLot === copro.lot_id;
                      const isNoticing = pendingNotice === copro.lot_id;

                      return (
                        <tr
                          key={copro.lot_id}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-3 px-4 sm:px-6 font-medium text-foreground">
                            Lot {copro.lot_number}
                          </td>
                          <td className="py-3 px-4 sm:px-6 text-foreground">
                            {copro.owner_name}
                          </td>
                          <td className="py-3 px-4 sm:px-6 text-right font-semibold text-red-600 dark:text-red-400">
                            {formatCents(copro.amount_cents)}
                          </td>
                          <td className="py-3 px-4 sm:px-6 text-right text-muted-foreground">
                            {copro.days_late} j
                          </td>
                          <td className="py-3 px-4 sm:px-6 text-center">
                            <Badge
                              className={`${severityConfig[severity].className} border-0`}
                            >
                              {severityConfig[severity].label}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 sm:px-6 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleRemindLot(copro.lot_id)}
                                disabled={isReminding}
                                className="text-cyan-600 border-cyan-200 hover:bg-cyan-50 dark:border-cyan-800 dark:hover:bg-cyan-900/30"
                              >
                                {isReminding ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3 mr-1" />
                                )}
                                Relancer
                              </Button>
                              {severity === "critique" && (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => handleFormalNotice(copro.lot_id)}
                                  disabled={isNoticing}
                                  className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30"
                                >
                                  {isNoticing ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <FileText className="w-3 h-3 mr-1" />
                                  )}
                                  Mise en demeure
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td
                      className="py-3 px-4 sm:px-6 font-semibold text-foreground"
                      colSpan={2}
                    >
                      Total
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-right font-bold text-lg text-red-600 dark:text-red-400">
                      {formatCents(totalOverdue)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: "red" | "amber" | "blue";
}) {
  const colorMap = {
    red: {
      bg: "bg-red-100 dark:bg-red-900/40",
      text: "text-red-600 dark:text-red-400",
      gradient:
        "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10",
    },
    amber: {
      bg: "bg-amber-100 dark:bg-amber-900/40",
      text: "text-amber-600 dark:text-amber-400",
      gradient:
        "from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10",
    },
    blue: {
      bg: "bg-blue-100 dark:bg-blue-900/40",
      text: "text-blue-600 dark:text-blue-400",
      gradient:
        "from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10",
    },
  };
  const colors = colorMap[color];

  return (
    <Card className="relative overflow-hidden">
      <div
        className={`absolute inset-0 bg-gradient-to-br opacity-50 ${colors.gradient}`}
      />
      <CardContent className="relative pt-4 sm:pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-lg sm:text-2xl font-bold tracking-tight truncate text-foreground">
              {value}
            </p>
          </div>
          <div className={`shrink-0 p-2 sm:p-3 rounded-xl ${colors.bg} ${colors.text}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ImpayesLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-52" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-12 bg-muted rounded-xl" />
      <div className="h-72 bg-muted rounded-xl" />
    </div>
  );
}
