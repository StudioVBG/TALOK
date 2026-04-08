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
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";
import { usePlanAccess } from "@/lib/hooks/use-plan-access";
import { useEntityStore } from "@/stores/useEntityStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Record<string, string>>({});
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);

  const hasAccounting = planAccess.hasFeature("hasAccounting");
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const entityParam = activeEntityId ? `&entityId=${encodeURIComponent(activeEntityId)}` : "";

  useEffect(() => {
    if (!hasAccounting) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/accounting/dashboard?year=${year}${entityParam}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/accounting/expenses?year=${year}${entityParam}`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([dashData, expData]) => {
        if (dashData) setData(dashData);
        if (expData) {
          setExpenses(expData.expenses || []);
          setExpenseCategories(expData.categories || {});
        }
      })
      .catch(() =>
        toast({
          title: "Erreur",
          description: "Impossible de charger les données comptables",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false));
  }, [year, hasAccounting, activeEntityId]);

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
      const res = await fetch(`/api/accounting/fec?year=${year}${entityParam}`);
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
      const res = await fetch(`/api/accounting/fiscal-summary?year=${year}${entityParam}`);
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

        {/* Expenses section */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-orange-500" />
                Dépenses et charges
              </CardTitle>
              <CardDescription>
                Travaux, assurances, taxes, et autres charges déductibles
              </CardDescription>
            </div>
            <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvelle dépense</DialogTitle>
                  <DialogDescription>
                    Ajoutez une dépense pour la retrouver dans vos exports FEC et votre récapitulatif fiscal.
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSavingExpense(true);
                    const form = e.target as HTMLFormElement;
                    const fd = new FormData(form);
                    try {
                      const res = await fetch("/api/accounting/expenses", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          description: fd.get("description"),
                          montant: parseFloat(fd.get("montant") as string),
                          category: fd.get("category"),
                          date_depense: fd.get("date_depense"),
                          fournisseur: fd.get("fournisseur") || null,
                          legal_entity_id: activeEntityId && activeEntityId !== "personal" ? activeEntityId : null,
                        }),
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || "Erreur");
                      }
                      const { expense } = await res.json();
                      setExpenses((prev) => [expense, ...prev]);
                      setShowAddExpense(false);
                      toast({ title: "Dépense ajoutée" });
                    } catch (err) {
                      toast({
                        title: "Erreur",
                        description: err instanceof Error ? err.message : "Impossible d'ajouter",
                        variant: "destructive",
                      });
                    } finally {
                      setSavingExpense(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="exp-desc">Description</Label>
                    <Input id="exp-desc" name="description" required placeholder="Ex: Remplacement chaudière" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="exp-amount">Montant HT (€)</Label>
                      <Input id="exp-amount" name="montant" type="number" step="0.01" min="0.01" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exp-date">Date</Label>
                      <Input id="exp-date" name="date_depense" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="exp-cat">Catégorie</Label>
                      <Select name="category" defaultValue="travaux">
                        <SelectTrigger id="exp-cat"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(expenseCategories).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                          {Object.keys(expenseCategories).length === 0 && (
                            <>
                              <SelectItem value="travaux">Travaux / réparations</SelectItem>
                              <SelectItem value="assurance">Assurance</SelectItem>
                              <SelectItem value="taxe_fonciere">Taxe foncière</SelectItem>
                              <SelectItem value="charges_copro">Charges copropriété</SelectItem>
                              <SelectItem value="entretien">Entretien</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exp-fourn">Fournisseur</Label>
                      <Input id="exp-fourn" name="fournisseur" placeholder="Optionnel" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowAddExpense(false)}>Annuler</Button>
                    <Button type="submit" disabled={savingExpense}>
                      {savingExpense ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Aucune dépense enregistrée</p>
                <p className="text-sm mt-1">
                  Ajoutez vos dépenses pour les retrouver dans votre export FEC et votre récapitulatif fiscal.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {expenses.slice(0, 20).map((exp: any) => (
                  <div
                    key={exp.id}
                    className="flex items-center gap-4 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{exp.description}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {expenseCategories[exp.category] || exp.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{new Date(exp.date_depense).toLocaleDateString("fr-FR")}</span>
                        {exp.fournisseur && <span>— {exp.fournisseur}</span>}
                        {exp.property?.adresse_complete && (
                          <span className="truncate">— {exp.property.adresse_complete}</span>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-sm tabular-nums shrink-0">
                      {formatCurrency(Number(exp.montant) || 0)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive h-8 w-8"
                      onClick={async () => {
                        const res = await fetch(`/api/accounting/expenses/${exp.id}`, { method: "DELETE" });
                        if (res.ok) {
                          setExpenses((prev) => prev.filter((e: any) => e.id !== exp.id));
                          toast({ title: "Dépense supprimée" });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {expenses.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    + {expenses.length - 20} dépenses supplémentaires
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

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
