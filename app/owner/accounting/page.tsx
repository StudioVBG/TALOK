"use client";

/**
 * Page Comptabilité propriétaire — SOTA 2026
 *
 * KPI cards + graphique barres Recharts + détail par bien + exports FEC / fiscal
 * Feature gate: hasAccounting (plan Confort+)
 */

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Euro,
  AlertTriangle,
  TrendingUp,
  Download,
  FileText,
  Building2,
  Loader2,
  ChevronDown,
  Landmark,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";
import { usePlanAccess } from "@/lib/hooks/use-plan-access";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Recharts — SSR-disabled
const RechartsBar = dynamic(
  () =>
    import("recharts").then((mod) => {
      const {
        ResponsiveContainer,
        BarChart,
        Bar,
        XAxis,
        YAxis,
        CartesianGrid,
        Tooltip,
        Legend,
      } = mod;

      function AccountingBarChart({
        data,
      }: {
        data: Array<{ name: string; attendu: number; encaisse: number }>;
      }) {
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <Tooltip
                formatter={(value: number) =>
                  new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(value)
                }
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                }}
              />
              <Legend />
              <Bar
                dataKey="attendu"
                name="Attendu"
                fill="#93c5fd"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="encaisse"
                name="Encaissé"
                fill="#2563EB"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      }
      return AccountingBarChart;
    }),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full rounded-xl" />,
  }
);

interface DashboardData {
  summary: {
    totalRentExpected: number;
    totalRentCollected: number;
    totalChargesCollected: number;
    totalCommissions: number;
    totalExpenses: number;
    netIncome: number;
    collectionRate: number;
    unpaidCount: number;
    unpaidAmount: number;
  };
  monthlyBreakdown: Array<{
    month: number;
    rentExpected: number;
    rentCollected: number;
    expenses: number;
    netIncome: number;
  }>;
  byProperty: Array<{
    propertyId: string;
    propertyName: string;
    rentExpected: number;
    rentCollected: number;
    collectionRate: number;
    unpaidAmount: number;
  }>;
}

const MONTHS_SHORT = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

export default function AccountingPage() {
  const { toast } = useToast();
  const planAccess = usePlanAccess();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"fec" | "fiscal" | null>(null);

  const hasAccounting = planAccess.hasFeature("hasAccounting");

  useEffect(() => {
    if (!hasAccounting) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/accounting/dashboard?year=${year}`)
      .then((r) => {
        if (!r.ok) throw new Error("Erreur chargement");
        return r.json();
      })
      .then(setData)
      .catch(() =>
        toast({
          title: "Erreur",
          description: "Impossible de charger les données comptables",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false));
  }, [year, hasAccounting]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.monthlyBreakdown.map((m) => ({
      name: MONTHS_SHORT[m.month - 1],
      attendu: m.rentExpected,
      encaisse: m.rentCollected,
    }));
  }, [data]);

  // ── Upgrade CTA ──
  if (!hasAccounting) {
    return (
      <PageTransition>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="border-2 border-dashed">
            <CardContent className="py-16 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                <Lock className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold">Comptabilité</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Suivez vos revenus fonciers, exportez votre FEC pour votre
                comptable et téléchargez votre récapitulatif fiscal.
              </p>
              <p className="text-sm text-muted-foreground">
                Disponible à partir du plan Confort.
              </p>
              <Button asChild className="mt-2">
                <Link href="/owner/settings?tab=subscription">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {planAccess.upgradeCTA}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  // ── Download handlers ──
  const handleExportFEC = async () => {
    setExporting("fec");
    try {
      const res = await fetch(`/api/accounting/fec?year=${year}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur export FEC");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ||
        `FEC_${year}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export FEC téléchargé" });
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Export impossible",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const handleExportFiscal = async () => {
    setExporting("fiscal");
    try {
      const res = await fetch(`/api/accounting/fiscal-summary?year=${year}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur export");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Recap_fiscal_${year}_Talok.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Récapitulatif fiscal téléchargé" });
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Export impossible",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <PageTransition>
        <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </PageTransition>
    );
  }

  const s = data?.summary;

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
              Comptabilité
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi financier et exports comptables
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Year selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  {year}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {Array.from({ length: 5 }, (_, i) => currentYear - i).map(
                  (y) => (
                    <DropdownMenuItem
                      key={y}
                      onClick={() => setYear(y)}
                      className={cn(y === year && "font-bold")}
                    >
                      {y}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export buttons */}
            <Button
              variant="outline"
              onClick={handleExportFEC}
              disabled={!!exporting}
              className="gap-2"
            >
              {exporting === "fec" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export FEC
            </Button>
            <Button
              variant="outline"
              onClick={handleExportFiscal}
              disabled={!!exporting}
              className="gap-2"
            >
              {exporting === "fiscal" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Récap fiscal
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card className="bg-card border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Euro className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Revenus encaissés
                  </span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(s?.totalRentCollected || 0)}
                </p>
                {s && s.collectionRate > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {s.collectionRate}% d&apos;encaissement
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-card border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Impayés
                  </span>
                </div>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    (s?.unpaidAmount || 0) > 0
                      ? "text-red-600"
                      : "text-muted-foreground"
                  )}
                >
                  {formatCurrency(s?.unpaidAmount || 0)}
                </p>
                {(s?.unpaidCount || 0) > 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    {s?.unpaidCount} facture{(s?.unpaidCount || 0) > 1 ? "s" : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="bg-card border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Charges
                  </span>
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(s?.totalChargesCollected || 0)}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-card border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Revenu net
                  </span>
                </div>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    (s?.netIncome || 0) >= 0
                      ? "text-blue-600"
                      : "text-red-600"
                  )}
                >
                  {formatCurrency(s?.netIncome || 0)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bar chart */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-lg">
              Revenus par mois — {year}
            </CardTitle>
            <CardDescription>
              Comparaison entre montants attendus et encaissés
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <RechartsBar data={chartData} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée pour cette année
              </div>
            )}
          </CardContent>
        </Card>

        {/* Property breakdown */}
        {data?.byProperty && data.byProperty.length > 0 && (
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-500" />
                Détail par bien
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium text-muted-foreground">
                        Bien
                      </th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">
                        Encaissé
                      </th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">
                        Attendu
                      </th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">
                        Taux
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byProperty.map((p) => (
                      <tr key={p.propertyId} className="border-b last:border-0">
                        <td className="py-3 font-medium max-w-[200px] truncate">
                          {p.propertyName}
                        </td>
                        <td className="py-3 text-right tabular-nums">
                          {formatCurrency(p.rentCollected)}
                        </td>
                        <td className="py-3 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(p.rentExpected)}
                        </td>
                        <td className="py-3 text-right">
                          <Badge
                            className={cn(
                              "text-xs",
                              p.collectionRate >= 90
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : p.collectionRate >= 70
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            )}
                          >
                            {p.collectionRate}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export section */}
        <Card className="bg-card border-dashed">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-semibold">Exports comptables</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Téléchargez l&apos;export pour votre comptable ou votre récapitulatif fiscal annuel.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportFEC}
                  disabled={!!exporting}
                  className="gap-2"
                >
                  {exporting === "fec" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export FEC {year}
                </Button>
                <Button
                  onClick={handleExportFiscal}
                  disabled={!!exporting}
                  className="gap-2"
                >
                  {exporting === "fiscal" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Récap fiscal {year}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
