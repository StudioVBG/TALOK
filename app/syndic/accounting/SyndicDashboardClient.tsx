"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated

import { useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useSyndicDashboard } from "@/lib/hooks/use-syndic-dashboard";
import { useCoproSites } from "@/lib/hooks/use-copro-lots";
import { formatCents } from "@/lib/utils/format-cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  BarChart3,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Send,
  PlusCircle,
  FileText,
  Download,
  Euro,
  Building2,
  ArrowRight,
  Hammer,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

export default function SyndicDashboardClient() {
  return (
    <PlanGate feature="copro_module" mode="blur">
      <SyndicDashboardContent />
    </PlanGate>
  );
}

function SyndicDashboardContent() {
  const { data: sites } = useCoproSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");

  const activeSiteId = selectedSiteId || sites?.[0]?.id || "";

  const {
    kpis,
    budgetVsRealise,
    nextFundCall,
    overdueCopros,
    worksFund,
    isLoading,
    error,
  } = useSyndicDashboard(activeSiteId);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
          Comptabilite Syndic
        </h1>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive">
              Erreur lors du chargement du tableau de bord. Veuillez reessayer.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <SyndicDashboardLoadingSkeleton />;
  }

  const chartData = budgetVsRealise.map((item) => ({
    poste: item.poste,
    Budget: item.budget_cents / 100,
    Realise: item.realise_cents / 100,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Comptabilite Syndic
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tableau de bord copropriete
          </p>
        </div>

        {/* Copro selector */}
        {sites && sites.length > 1 && (
          <Select value={activeSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-full sm:w-64">
              <Building2 className="w-4 h-4 mr-2 text-cyan-600" />
              <SelectValue placeholder="Selectionner une copropriete" />
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Budget execute"
          value={`${kpis?.budget_execution_pct ?? 0}%`}
          icon={<BarChart3 className="w-5 h-5" />}
          color="cyan"
          subtitle="de l'exercice en cours"
        />
        <KpiCard
          title="Tresorerie"
          value={formatCents(kpis?.tresorerie_cents ?? 0)}
          icon={<Wallet className="w-5 h-5" />}
          color="blue"
          subtitle="solde bancaire"
        />
        <KpiCard
          title="Taux recouvrement"
          value={`${kpis?.taux_recouvrement_pct ?? 0}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
          subtitle="des appels emis"
        />
        <KpiCard
          title="Impayes"
          value={formatCents(kpis?.impayes_cents ?? 0)}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          subtitle={`${kpis?.impayes_count ?? 0} coproprietaire${(kpis?.impayes_count ?? 0) > 1 ? "s" : ""}`}
          isAlert={(kpis?.impayes_count ?? 0) > 0}
        />
      </div>

      {/* Budget vs Realise chart + Next fund call */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Budget vs Realise par poste
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 4, right: 20, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      tickFormatter={(v: number) =>
                        new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 0,
                        }).format(v)
                      }
                    />
                    <YAxis
                      dataKey="poste"
                      type="category"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) => [
                        new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(value),
                        name,
                      ]}
                    />
                    <Legend />
                    <Bar
                      dataKey="Budget"
                      fill="hsl(var(--muted-foreground) / 0.3)"
                      radius={[0, 4, 4, 0]}
                      barSize={14}
                    />
                    <Bar
                      dataKey="Realise"
                      fill="hsl(199 89% 48%)"
                      radius={[0, 4, 4, 0]}
                      barSize={14}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                Aucune donnee budgetaire disponible
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next fund call + Works fund */}
        <div className="space-y-4">
          {/* Next Fund Call */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Euro className="w-4 h-4 text-cyan-600" />
                Prochain appel de fonds
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextFundCall ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {nextFundCall.period_label}
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {formatCents(nextFundCall.total_cents)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Echeance : {new Date(nextFundCall.due_date).toLocaleDateString("fr-FR")}
                  </p>
                  {!nextFundCall.is_sent && (
                    <Button className="w-full bg-cyan-600 hover:bg-cyan-700" size="sm">
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer les appels
                    </Button>
                  )}
                  {nextFundCall.is_sent && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                      Envoye
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun appel de fonds programme
                </p>
              )}
            </CardContent>
          </Card>

          {/* Works Fund Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Hammer className="w-4 h-4 text-cyan-600" />
                Fonds travaux
              </CardTitle>
            </CardHeader>
            <CardContent>
              {worksFund ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Solde</span>
                    <span className="text-lg font-bold text-foreground">
                      {formatCents(worksFund.balance_cents)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Taux</span>
                    <span className="text-sm font-medium text-foreground">
                      {worksFund.rate_pct}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Evolution
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        worksFund.evolution_cents >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {worksFund.evolution_cents >= 0 ? "+" : ""}
                      {formatCents(worksFund.evolution_cents)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune donnee disponible
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Overdue copros */}
      {overdueCopros.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Coproprietaires en retard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Lot
                    </th>
                    <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Nom
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Montant
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Retard
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6" />
                  </tr>
                </thead>
                <tbody>
                  {overdueCopros.map((copro) => (
                    <tr
                      key={copro.lot_id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-3 px-4 sm:px-6 font-medium text-foreground">
                        {copro.lot_number}
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
                      <td className="py-3 px-4 sm:px-6 text-right">
                        <Button
                          variant="outline"
                          size="xs"
                          className="text-cyan-600 border-cyan-200 hover:bg-cyan-50 dark:border-cyan-800 dark:hover:bg-cyan-900/30"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Relancer
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <QuickAction
          href="/syndic/accounting/entries"
          icon={<PlusCircle className="w-5 h-5" />}
          label="Enregistrer depense"
        />
        <QuickAction
          href="/syndic/accounting/appels"
          icon={<Euro className="w-5 h-5" />}
          label="Appels de fonds"
        />
        <QuickAction
          href="/syndic/accounting/budget"
          icon={<BarChart3 className="w-5 h-5" />}
          label="Budget"
        />
        <QuickAction
          href="/syndic/fonds-travaux"
          icon={<Hammer className="w-5 h-5" />}
          label="Fonds travaux"
        />
        <QuickAction
          href="/syndic/accounting/close"
          icon={<Download className="w-5 h-5" />}
          label="Exports / Cloture"
        />
      </div>
    </div>
  );
}

// -- KPI Card ----------------------------------------------------------------

function KpiCard({
  title,
  value,
  icon,
  color,
  subtitle,
  isAlert,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: "cyan" | "blue" | "green" | "red";
  subtitle?: string;
  isAlert?: boolean;
}) {
  const colorMap = {
    cyan: {
      bg: "bg-cyan-100 dark:bg-cyan-900/40",
      text: "text-cyan-600 dark:text-cyan-400",
      gradient: "from-cyan-50 to-cyan-100/50 dark:from-cyan-900/20 dark:to-cyan-800/10",
    },
    blue: {
      bg: "bg-blue-100 dark:bg-blue-900/40",
      text: "text-blue-600 dark:text-blue-400",
      gradient: "from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10",
    },
    green: {
      bg: "bg-emerald-100 dark:bg-emerald-900/40",
      text: "text-emerald-600 dark:text-emerald-400",
      gradient: "from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10",
    },
    red: {
      bg: "bg-red-100 dark:bg-red-900/40",
      text: "text-red-600 dark:text-red-400",
      gradient: "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10",
    },
  };

  const colors = colorMap[color];

  return (
    <Card
      className={`relative overflow-hidden ${
        isAlert ? "border-red-200 dark:border-red-900" : ""
      }`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br opacity-50 ${colors.gradient}`}
      />
      <CardContent className="relative pt-4 sm:pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p
              className={`text-lg sm:text-2xl font-bold tracking-tight truncate ${
                isAlert ? "text-red-600 dark:text-red-400" : "text-foreground"
              }`}
            >
              {value}
            </p>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div
            className={`shrink-0 p-2 sm:p-3 rounded-xl ${colors.bg} ${colors.text}`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Quick action ------------------------------------------------------------

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 bg-card rounded-xl border border-border p-4 text-center hover:bg-muted/50 transition-colors"
    >
      <span className="text-cyan-600 dark:text-cyan-400">{icon}</span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </Link>
  );
}

// -- Loading skeleton --------------------------------------------------------

function SyndicDashboardLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 bg-muted rounded-xl" />
        <div className="h-72 bg-muted rounded-xl" />
      </div>
    </div>
  );
}
