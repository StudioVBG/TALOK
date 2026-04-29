"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Euro,
  TrendingUp,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Clock,
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

type Period = "week" | "month" | "quarter" | "year";

interface FinanceTransaction {
  id: string;
  type: "loyer" | "commission" | "virement";
  description: string;
  amount: number;
  date: string;
  status: "completed" | "pending";
}

interface ApiResponse {
  stats: {
    loyersEncaisses: number;
    loyersEnAttente: number;
    commissionsGenerees: number;
    virementsEffectues: number;
  };
  transactions: FinanceTransaction[];
  period: Period;
}

const PERIOD_LABELS: Record<Period, string> = {
  week: "Cette semaine",
  month: "Ce mois",
  quarter: "Ce trimestre",
  year: "Cette année",
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const buildCsv = (transactions: FinanceTransaction[]): string => {
  const header = ["Date", "Description", "Type", "Montant", "Statut"];
  const lines = transactions.map((t) => [
    formatDate(t.date),
    t.description,
    t.type,
    t.amount.toFixed(2),
    t.status,
  ]);
  return [header, ...lines]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
};

export default function AgencyFinancesPage() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("month");
  const [stats, setStats] = useState<ApiResponse["stats"]>({
    loyersEncaisses: 0,
    loyersEnAttente: 0,
    commissionsGenerees: 0,
    virementsEffectues: 0,
  });
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/agency/finances?period=${period}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Erreur de chargement");
        }
        const data = (await response.json()) as ApiResponse;
        if (cancelled) return;
        setStats(data.stats);
        setTransactions(data.transactions ?? []);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur inconnue");
          setTransactions([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const handleExport = () => {
    if (transactions.length === 0) {
      toast({
        title: "Aucune donnée à exporter",
        description: "Sélectionnez une autre période ou attendez le chargement.",
      });
      return;
    }
    const csv = buildCsv(transactions);
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finances-agence-${period}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pendingCount = useMemo(
    () => transactions.filter((t) => t.status === "pending" && t.type === "loyer").length,
    [transactions],
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Finances
          </h1>
          <p className="text-muted-foreground mt-1">Vue d'ensemble des flux financiers</p>
        </div>
        <div className="flex gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={isLoading || transactions.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exporter CSV
          </Button>
        </div>
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
                <p className="text-sm text-white/80">Loyers encaissés</p>
                <p className="text-3xl font-bold mt-1">
                  {stats.loyersEncaisses.toLocaleString("fr-FR")}€
                </p>
                <div className="flex items-center gap-1 mt-2 text-emerald-200 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  {PERIOD_LABELS[period]}
                </div>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <ArrowDownRight className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">En attente</p>
                <p className="text-3xl font-bold mt-1">
                  {stats.loyersEnAttente.toLocaleString("fr-FR")}€
                </p>
                <p className="text-amber-200 text-sm mt-2">
                  {pendingCount} paiement{pendingCount > 1 ? "s" : ""}
                </p>
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
                <p className="text-sm text-white/80">Commissions</p>
                <p className="text-3xl font-bold mt-1">
                  {stats.commissionsGenerees.toLocaleString("fr-FR")}€
                </p>
                <div className="flex items-center gap-1 mt-2 text-indigo-200 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  {PERIOD_LABELS[period]}
                </div>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <PiggyBank className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-slate-600 to-slate-700 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Virements effectués</p>
                <p className="text-3xl font-bold mt-1">
                  {stats.virementsEffectues.toLocaleString("fr-FR")}€
                </p>
                <p className="text-slate-300 text-sm mt-2">
                  {stats.virementsEffectues === 0 ? "Module en cours" : "Vers propriétaires"}
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <ArrowUpRight className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Dernières transactions</CardTitle>
          <CardDescription>Mouvements financiers récents</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Chargement…
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Aucune transaction sur la période sélectionnée.
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3 p-4">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(transaction.date)}</p>
                      </div>
                      <span
                        className={cn(
                          "font-bold",
                          transaction.amount > 0 ? "text-emerald-600" : "text-slate-600",
                        )}
                      >
                        {transaction.amount > 0 ? "+" : ""}
                        {transaction.amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}€
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          transaction.type === "loyer" && "border-emerald-500 text-emerald-600",
                          transaction.type === "commission" && "border-indigo-500 text-indigo-600",
                          transaction.type === "virement" && "border-slate-500 text-slate-600",
                        )}
                      >
                        {transaction.type === "loyer"
                          ? "Loyer"
                          : transaction.type === "commission"
                            ? "Commission"
                            : "Virement"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          transaction.status === "completed"
                            ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                            : "border-amber-500 text-amber-600 bg-amber-50",
                        )}
                      >
                        {transaction.status === "completed" ? "Effectué" : "En attente"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Description</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Montant</th>
                      <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-4 px-6 text-sm">{formatDate(transaction.date)}</td>
                        <td className="py-4 px-4 font-medium">{transaction.description}</td>
                        <td className="py-4 px-4">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              transaction.type === "loyer" && "border-emerald-500 text-emerald-600",
                              transaction.type === "commission" && "border-indigo-500 text-indigo-600",
                              transaction.type === "virement" && "border-slate-500 text-slate-600",
                            )}
                          >
                            {transaction.type === "loyer"
                              ? "Loyer"
                              : transaction.type === "commission"
                                ? "Commission"
                                : "Virement"}
                          </Badge>
                        </td>
                        <td
                          className={cn(
                            "py-4 px-4 text-right font-bold",
                            transaction.amount > 0 ? "text-emerald-600" : "text-slate-600",
                          )}
                        >
                          {transaction.amount > 0 ? "+" : ""}
                          {transaction.amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}€
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              transaction.status === "completed"
                                ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                                : "border-amber-500 text-amber-600 bg-amber-50",
                            )}
                          >
                            {transaction.status === "completed" ? "Effectué" : "En attente"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold">Résumé — {PERIOD_LABELS[period]}</h3>
              <p className="text-white/80 text-sm mt-1">
                Vous avez encaissé {stats.loyersEncaisses.toLocaleString("fr-FR")}€ de loyers et
                généré {stats.commissionsGenerees.toLocaleString("fr-FR")}€ de commissions.
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">
                {stats.loyersEncaisses + stats.loyersEnAttente > 0
                  ? `${Math.round(
                      (stats.loyersEncaisses /
                        (stats.loyersEncaisses + stats.loyersEnAttente)) *
                        100,
                    )}%`
                  : "—"}
              </p>
              <p className="text-xs text-white/70">Taux d'encaissement</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
