"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface FinancialKPIsProps {
  /** Total collected this month in cents */
  collectedCents: number;
  /** Total pending (unpaid) this month in cents */
  pendingCents: number;
  /** Total overdue in cents */
  overdueCents: number;
  /** Number of paid invoices this month */
  paidCount: number;
  /** Number of overdue invoices */
  overdueCount: number;
  /** Collection rate percentage (0-100) */
  collectionRate: number;
  /** Month-over-month trend (positive = growth) */
  trend?: number;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function FinancialKPIs({
  collectedCents,
  pendingCents,
  overdueCents,
  paidCount,
  overdueCount,
  collectionRate,
  trend,
}: FinancialKPIsProps) {
  const kpis = [
    {
      label: "Encaissé ce mois",
      value: formatCents(collectedCents),
      icon: Banknote,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      subtitle: `${paidCount} facture${paidCount > 1 ? "s" : ""} réglée${paidCount > 1 ? "s" : ""}`,
    },
    {
      label: "En attente",
      value: formatCents(pendingCents),
      icon: Clock,
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
      subtitle: "En cours de traitement",
    },
    {
      label: "Impayés",
      value: formatCents(overdueCents),
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-900/20",
      subtitle: overdueCount > 0
        ? `${overdueCount} facture${overdueCount > 1 ? "s" : ""} en retard`
        : "Aucun impayé",
    },
    {
      label: "Taux d'encaissement",
      value: `${collectionRate}%`,
      icon: collectionRate >= 90 ? CheckCircle : TrendingDown,
      color:
        collectionRate >= 90
          ? "text-green-600 dark:text-green-400"
          : collectionRate >= 70
            ? "text-yellow-600 dark:text-yellow-400"
            : "text-red-600 dark:text-red-400",
      bgColor:
        collectionRate >= 90
          ? "bg-green-50 dark:bg-green-900/20"
          : collectionRate >= 70
            ? "bg-yellow-50 dark:bg-yellow-900/20"
            : "bg-red-50 dark:bg-red-900/20",
      subtitle:
        trend != null
          ? `${trend >= 0 ? "+" : ""}${trend}% vs mois dernier`
          : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.label}>
            <CardContent className="flex items-start gap-4 p-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${kpi.bgColor}`}
              >
                <Icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {kpi.label}
                </p>
                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                {kpi.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">
                    {kpi.subtitle}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
