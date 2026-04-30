"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Euro,
  TrendingUp,
  Calendar,
  Download,
  CheckCircle,
  Clock,
  PiggyBank,
  BarChart3,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface CommissionRow {
  id: string;
  periode: string;
  ownerName: string;
  loyerEncaisse: number;
  tauxCommission: number;
  montantHT: number;
  tva: number;
  montantTTC: number;
  status: "pending" | "invoiced" | "paid";
}

interface CommissionsApiResponse {
  commissions: Array<{
    id: string;
    periode: string;
    loyer_encaisse: number | string | null;
    taux_commission: number | string | null;
    montant_commission: number | string | null;
    montant_tva: number | string | null;
    montant_total_ttc: number | string | null;
    statut: "pending" | "invoiced" | "paid";
    mandate?: {
      owner?: { prenom?: string | null; nom?: string | null } | null;
    } | null;
  }>;
  total: number;
  stats: { total: number; pending: number; paid: number };
}

const toNumber = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

const formatPeriodLabel = (periode: string): string => {
  const match = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!match) return periode;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

const buildCsv = (rows: CommissionRow[]): string => {
  const header = [
    "Période",
    "Propriétaire",
    "Loyers encaissés (€)",
    "Taux (%)",
    "Commission HT (€)",
    "TVA (€)",
    "Total TTC (€)",
    "Statut",
  ];
  const lines = rows.map((r) => [
    r.periode,
    r.ownerName,
    r.loyerEncaisse.toFixed(2),
    r.tauxCommission.toFixed(2),
    r.montantHT.toFixed(2),
    r.tva.toFixed(2),
    r.montantTTC.toFixed(2),
    r.status,
  ]);
  return [header, ...lines]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
};

export default function CommissionsPage() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [stats, setStats] = useState<{ total: number; pending: number; paid: number }>({
    total: 0,
    pending: 0,
    paid: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ limit: "200" });
        if (selectedMonth !== "all") params.set("periode", selectedMonth);
        const response = await fetch(`/api/agency/commissions?${params.toString()}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Erreur lors du chargement");
        }
        const data = (await response.json()) as CommissionsApiResponse;
        if (cancelled) return;
        const mapped: CommissionRow[] = (data.commissions ?? []).map((c) => {
          const ownerName = c.mandate?.owner
            ? `${c.mandate.owner.prenom ?? ""} ${c.mandate.owner.nom ?? ""}`.trim() || "—"
            : "—";
          return {
            id: c.id,
            periode: c.periode,
            ownerName,
            loyerEncaisse: toNumber(c.loyer_encaisse),
            tauxCommission: toNumber(c.taux_commission),
            montantHT: toNumber(c.montant_commission),
            tva: toNumber(c.montant_tva),
            montantTTC: toNumber(c.montant_total_ttc),
            status: c.statut,
          };
        });
        setRows(mapped);
        setStats(data.stats ?? { total: 0, pending: 0, paid: 0 });
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur inconnue");
          setRows([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  const periodOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.periode));
    return Array.from(set)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: formatPeriodLabel(value) }));
  }, [rows]);

  const tauxMoyen = useMemo(() => {
    if (rows.length === 0) return 0;
    const sum = rows.reduce((acc, r) => acc + r.tauxCommission, 0);
    return sum / rows.length;
  }, [rows]);

  const moyenneMensuelle = useMemo(() => {
    const buckets = new Map<string, number>();
    rows.forEach((r) => {
      buckets.set(r.periode, (buckets.get(r.periode) ?? 0) + r.montantTTC);
    });
    if (buckets.size === 0) return 0;
    const total = Array.from(buckets.values()).reduce((acc, v) => acc + v, 0);
    return total / buckets.size;
  }, [rows]);

  const handleExport = () => {
    if (rows.length === 0) {
      toast({
        title: "Aucune donnée à exporter",
        description: "Ajustez le filtre de période ou attendez le chargement.",
      });
      return;
    }
    const csv = buildCsv(rows);
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `commissions-${selectedMonth === "all" ? "toutes" : selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Commissions
          </h1>
          <p className="text-muted-foreground mt-1">Suivi de vos honoraires de gestion</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={isLoading || rows.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Exporter CSV
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50/60 dark:bg-red-900/20">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Total encaissé</p>
                <p className="text-3xl font-bold mt-1">{stats.paid.toFixed(2)}€</p>
                <div className="flex items-center gap-1 mt-2 text-emerald-200 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  Cumul commissions encaissées
                </div>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <PiggyBank className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">En attente</p>
                <p className="text-3xl font-bold mt-1">{stats.pending.toFixed(2)}€</p>
                <p className="text-amber-200 text-sm mt-2">À encaisser</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Moyenne mensuelle</p>
                <p className="text-3xl font-bold mt-1">{moyenneMensuelle.toFixed(2)}€</p>
                <p className="text-indigo-200 text-sm mt-2">
                  Sur {periodOptions.length || 0} période{periodOptions.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <BarChart3 className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-pink-500 to-rose-500 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Taux moyen</p>
                <p className="text-3xl font-bold mt-1">{tauxMoyen.toFixed(1)}%</p>
                <p className="text-pink-200 text-sm mt-2">Commission</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Euro className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les périodes</SelectItem>
                {periodOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Détail des commissions</CardTitle>
          <CardDescription>Commissions par propriétaire et par période</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Chargement…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              Aucune commission pour cette période.
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3 p-4">
                {rows.map((commission) => (
                  <div key={commission.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{formatPeriodLabel(commission.periode)}</p>
                        <p className="text-sm text-muted-foreground">{commission.ownerName}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          commission.status === "paid"
                            ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                            : "border-amber-500 text-amber-600 bg-amber-50",
                        )}
                      >
                        {commission.status === "paid" ? "Encaissé" : commission.status === "invoiced" ? "Facturé" : "En attente"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Loyers encaissés</p>
                        <p className="font-medium">{commission.loyerEncaisse.toLocaleString("fr-FR")}€</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Taux</p>
                        <p className="font-semibold text-indigo-600">{commission.tauxCommission}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Commission HT</p>
                        <p>{commission.montantHT.toFixed(2)}€</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total TTC</p>
                        <p className="font-bold text-indigo-600">{commission.montantTTC.toFixed(2)}€</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4 font-semibold flex justify-between">
                  <span>Total TTC</span>
                  <span className="text-indigo-600">
                    {rows.reduce((sum, c) => sum + c.montantTTC, 0).toFixed(2)}€
                  </span>
                </div>
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Période</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Propriétaire</th>
                      <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Loyers encaissés</th>
                      <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Taux</th>
                      <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Commission HT</th>
                      <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">TVA</th>
                      <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Total TTC</th>
                      <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((commission) => (
                      <tr
                        key={commission.id}
                        className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-4 px-6">
                          <span className="font-medium">{formatPeriodLabel(commission.periode)}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-medium">{commission.ownerName}</span>
                        </td>
                        <td className="py-4 px-4 text-right font-medium">
                          {commission.loyerEncaisse.toLocaleString("fr-FR")}€
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge variant="outline" className="border-indigo-500 text-indigo-600">
                            {commission.tauxCommission}%
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-right">{commission.montantHT.toFixed(2)}€</td>
                        <td className="py-4 px-4 text-right text-muted-foreground">
                          {commission.tva.toFixed(2)}€
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-indigo-600">
                          {commission.montantTTC.toFixed(2)}€
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              commission.status === "paid"
                                ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                                : "border-amber-500 text-amber-600 bg-amber-50",
                            )}
                          >
                            {commission.status === "paid" ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" /> Encaissé
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 mr-1" />{" "}
                                {commission.status === "invoiced" ? "Facturé" : "En attente"}
                              </>
                            )}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
                      <td className="py-4 px-6" colSpan={4}>
                        Total
                      </td>
                      <td className="py-4 px-4 text-right">
                        {rows.reduce((sum, c) => sum + c.montantHT, 0).toFixed(2)}€
                      </td>
                      <td className="py-4 px-4 text-right">
                        {rows.reduce((sum, c) => sum + c.tva, 0).toFixed(2)}€
                      </td>
                      <td className="py-4 px-4 text-right text-indigo-600">
                        {rows.reduce((sum, c) => sum + c.montantTTC, 0).toFixed(2)}€
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
