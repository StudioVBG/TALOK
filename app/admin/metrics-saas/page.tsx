"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Activity,
} from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SaasMetrics {
  mrr_history: { month: string; mrr: number }[];
  current_mrr: number;
  arr: number;
  arpu: number;
  paying_users: number;
  estimated_ltv: number | null;
  churn: {
    last_30_days: number;
    last_90_days: number;
    canceled_30_days: number;
    canceled_90_days: number;
    active_at_30d_start: number;
    active_at_90d_start: number;
  };
  churn_by_plan: {
    plan_slug: string;
    name: string;
    active: number;
    canceled: number;
    rate: number;
  }[];
  cohorts: {
    cohort_month: string;
    signups: number;
    retained_m1: number;
    retained_m3: number;
    retained_m6: number;
  }[];
}

export default function MetricsSaasPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "platform_admin"]}>
      <MetricsSaasContent />
    </ProtectedRoute>
  );
}

const formatEur = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);

function MetricsSaasContent() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<SaasMetrics>({
    queryKey: ["admin", "metrics-saas"],
    queryFn: async () => {
      const res = await fetch("/api/admin/metrics/saas");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur chargement métriques");
      }
      return res.json();
    },
  });

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6" /> Métriques SaaS
          </h1>
          <p className="text-muted-foreground">
            MRR, ARPU, churn, LTV et rétention par cohorte.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Actualiser
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1">{(error as Error).message}</p>
        </div>
      )}

      {isLoading && (
        <Card className="bg-card border-border">
          <CardContent className="p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              label="MRR actuel"
              value={formatEur(data.current_mrr)}
              icon={DollarSign}
              accent="text-violet-600"
            />
            <KpiCard
              label="ARR"
              value={formatEur(data.arr)}
              icon={TrendingUp}
              accent="text-emerald-600"
            />
            <KpiCard
              label="ARPU"
              value={formatEur(data.arpu)}
              icon={Users}
              accent="text-blue-600"
            />
            <KpiCard
              label="Churn 30 j"
              value={`${data.churn.last_30_days} %`}
              icon={data.churn.last_30_days > 5 ? TrendingDown : Activity}
              accent={
                data.churn.last_30_days > 5
                  ? "text-red-600"
                  : data.churn.last_30_days > 2
                    ? "text-amber-600"
                    : "text-emerald-600"
              }
              hint={`${data.churn.canceled_30_days} annulations / ${data.churn.active_at_30d_start} actifs`}
            />
            <KpiCard
              label="LTV estimé"
              value={data.estimated_ltv ? formatEur(data.estimated_ltv) : "—"}
              icon={TrendingUp}
              accent="text-amber-600"
              hint="ARPU / churn mensuel"
            />
          </div>

          {/* MRR trend */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Évolution du MRR — 12 mois</CardTitle>
              <CardDescription>
                MRR récurrent estimé par mois (abonnés payants actifs)
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.mrr_history}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={(v) => formatEur(v as number)} className="text-xs" />
                  <Tooltip
                    formatter={(v: number) => [formatEur(v), "MRR"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Line type="monotone" dataKey="mrr" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Churn per plan */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Churn par plan (30 j)</CardTitle>
                <CardDescription>Taux d&apos;annulation sur 30 jours glissants</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.churn_by_plan.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune donnée</p>
                )}
                {data.churn_by_plan.map((p) => (
                  <div key={p.plan_slug} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">{p.name}</span>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {p.canceled} / {p.active}
                      </Badge>
                      <span
                        className={cn(
                          "font-mono font-semibold text-sm",
                          p.rate > 5
                            ? "text-red-600"
                            : p.rate > 2
                              ? "text-amber-600"
                              : "text-emerald-600"
                        )}
                      >
                        {p.rate} %
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Comparatif churn</CardTitle>
                <CardDescription>30 jours vs 90 jours</CardDescription>
              </CardHeader>
              <CardContent className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { period: "30 jours", churn: data.churn.last_30_days },
                      { period: "90 jours", churn: data.churn.last_90_days },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="period" className="text-xs" />
                    <YAxis tickFormatter={(v) => `${v} %`} className="text-xs" />
                    <Tooltip
                      formatter={(v: number) => [`${v} %`, "Churn"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Bar dataKey="churn" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Cohorts */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Rétention par cohorte</CardTitle>
              <CardDescription>
                Signups par mois · abonnés actifs M+1, M+3, M+6 (— = pas encore évaluable)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Cohorte</th>
                      <th className="py-2 pr-4 font-medium">Signups</th>
                      <th className="py-2 pr-4 font-medium">M+1</th>
                      <th className="py-2 pr-4 font-medium">M+3</th>
                      <th className="py-2 pr-4 font-medium">M+6</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cohorts.map((c) => (
                      <tr key={c.cohort_month} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium text-foreground">{c.cohort_month}</td>
                        <td className="py-2 pr-4">{c.signups}</td>
                        <CohortCell total={c.signups} retained={c.retained_m1} />
                        <CohortCell total={c.signups} retained={c.retained_m3} />
                        <CohortCell total={c.signups} retained={c.retained_m6} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  hint?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
            <p className="text-xl lg:text-2xl font-bold text-foreground mt-1">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <Icon className={cn("w-5 h-5 shrink-0", accent)} />
        </div>
      </CardContent>
    </Card>
  );
}

function CohortCell({ total, retained }: { total: number; retained: number }) {
  if (retained < 0) {
    return <td className="py-2 pr-4 text-muted-foreground">—</td>;
  }
  if (total === 0) {
    return <td className="py-2 pr-4 text-muted-foreground">—</td>;
  }
  const pct = Math.round((retained / total) * 100);
  return (
    <td className="py-2 pr-4">
      <span className="inline-flex items-center gap-2">
        <span className="font-mono">{retained}</span>
        <span className="text-xs text-muted-foreground">({pct} %)</span>
      </span>
    </td>
  );
}
