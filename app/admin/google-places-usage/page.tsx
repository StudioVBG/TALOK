"use client";

// =====================================================
// Page admin : Monitoring Google Places API
// /admin/google-places-usage
// =====================================================

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  DollarSign,
  Gauge,
  RefreshCw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UsageStats {
  summary: {
    free_credit_usd: number;
    month_calls: number;
    month_google_calls: number;
    month_cache_hits: number;
    month_demo_calls: number;
    month_errors: number;
    month_cost_usd: number;
    quota_percent: number;
    projected_cost_usd: number;
    projected_quota_percent: number;
    cache_hit_ratio: number;
    day_calls: number;
    day_cost_usd: number;
    day_of_month: number;
    days_in_month: number;
    api_key_configured: boolean;
  };
  by_endpoint: Record<string, { calls: number; cost_usd: number }>;
  top_categories: Array<{ category: string; calls: number }>;
  daily_series: Array<{
    day: string;
    calls: number;
    cost_usd: number;
    cache_hits: number;
  }>;
  recent: Array<{
    called_at: string;
    endpoint: string;
    source: string;
    status: string;
    category: string | null;
    results_count: number;
    estimated_cost_cents: number;
    cache_hit: boolean;
  }>;
}

const ENDPOINT_LABELS: Record<string, string> = {
  text_search: "Text Search",
  nearby_search: "Nearby Search",
  place_details: "Place Details",
  geocoding: "Geocoding",
  place_photo: "Place Photo",
};

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  google: { label: "Google", className: "bg-blue-100 text-blue-700" },
  cache: { label: "Cache", className: "bg-emerald-100 text-emerald-700" },
  demo: { label: "Démo", className: "bg-amber-100 text-amber-700" },
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-emerald-100 text-emerald-700" },
  zero_results: { label: "0 résultat", className: "bg-slate-100 text-slate-700" },
  error: { label: "Erreur", className: "bg-red-100 text-red-700" },
};

export default function GooglePlacesUsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/google-places-usage", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les statistiques");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <p>{error || "Aucune donnée"}</p>
            <Button onClick={() => load()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = stats.summary;

  // Couleur de la barre de progression selon le pourcentage
  const quotaColor =
    s.quota_percent >= 90
      ? "bg-red-500"
      : s.quota_percent >= 70
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            Monitoring Google Places API
          </h1>
          <p className="text-sm text-muted-foreground">
            Suivi du quota gratuit Maps Platform (200 $/mois) et anticipation du
            passage payant.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {s.api_key_configured ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Clé API configurée
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Clé API manquante
            </Badge>
          )}
          <Button
            onClick={() => load(true)}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Quota gauge */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Crédit gratuit consommé ce mois
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <span className="text-3xl font-bold">
                {s.month_cost_usd.toFixed(2)} $
              </span>
              <span className="text-muted-foreground"> / {s.free_credit_usd} $</span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold">
                {s.quota_percent.toFixed(1)} %
              </div>
              <div className="text-xs text-muted-foreground">
                Jour {s.day_of_month}/{s.days_in_month}
              </div>
            </div>
          </div>

          <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full ${quotaColor} transition-all`}
              style={{ width: `${Math.min(100, s.quota_percent)}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2 rounded-lg border p-3">
              <TrendingUp className="h-4 w-4 mt-0.5 text-primary" />
              <div>
                <div className="font-medium">
                  Projection fin de mois : {s.projected_cost_usd.toFixed(2)} $
                </div>
                <div className="text-muted-foreground text-xs">
                  Soit {s.projected_quota_percent.toFixed(1)} % du crédit gratuit.{" "}
                  {s.projected_quota_percent >= 100
                    ? "⚠️ Dépassement prévu — plan payant à anticiper."
                    : "Sous le seuil gratuit."}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border p-3">
              <Database className="h-4 w-4 mt-0.5 text-primary" />
              <div>
                <div className="font-medium">
                  Cache : {s.cache_hit_ratio.toFixed(1)} % de hits
                </div>
                <div className="text-muted-foreground text-xs">
                  {s.month_cache_hits} appels servis depuis le cache 24 h
                  (économisés).
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Appels ce mois
              </span>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold mt-2">{s.month_calls}</div>
            <div className="text-xs text-muted-foreground mt-1">
              dont {s.month_google_calls} Google
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Aujourd'hui</span>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold mt-2">{s.day_calls}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {s.day_cost_usd.toFixed(2)} $
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Mode démo</span>
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold mt-2">{s.month_demo_calls}</div>
            <div className="text-xs text-muted-foreground mt-1">
              clé absente / fallback
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Erreurs</span>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className={`text-2xl font-bold mt-2 ${s.month_errors > 0 ? "text-red-600" : ""}`}>
              {s.month_errors}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ce mois
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appels sur 30 jours</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.daily_series.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Pas encore de données.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.daily_series}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(v) => v.slice(5)}
                  fontSize={11}
                />
                <YAxis fontSize={11} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  labelFormatter={(v) => `Jour ${v}`}
                />
                <Line
                  type="monotone"
                  dataKey="calls"
                  stroke="#2563EB"
                  name="Appels"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="cache_hits"
                  stroke="#10B981"
                  name="Cache"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* By endpoint + categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Par endpoint</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.by_endpoint).length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucun appel</div>
              ) : (
                Object.entries(stats.by_endpoint)
                  .sort((a, b) => b[1].calls - a[1].calls)
                  .map(([endpoint, v]) => (
                    <div
                      key={endpoint}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{ENDPOINT_LABELS[endpoint] || endpoint}</span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{v.calls} appels</span>
                        <Badge variant="secondary">
                          {v.cost_usd.toFixed(2)} $
                        </Badge>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top métiers recherchés</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.top_categories.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Aucune donnée
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.top_categories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis
                    dataKey="category"
                    type="category"
                    fontSize={11}
                    width={90}
                  />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="calls" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent calls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">20 derniers appels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Métier</TableHead>
                  <TableHead className="text-right">Résultats</TableHead>
                  <TableHead className="text-right">Coût</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recent.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-sm text-muted-foreground py-6"
                    >
                      Aucun appel pour l'instant.
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.recent.map((r, i) => {
                    const src = SOURCE_BADGE[r.source] || {
                      label: r.source,
                      className: "",
                    };
                    const st = STATUS_BADGE[r.status] || {
                      label: r.status,
                      className: "",
                    };
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(r.called_at).toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {ENDPOINT_LABELS[r.endpoint] || r.endpoint}
                        </TableCell>
                        <TableCell>
                          <Badge className={src.className}>{src.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={st.className}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.category || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {r.results_count}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {(Number(r.estimated_cost_cents) / 100).toFixed(4)} $
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
