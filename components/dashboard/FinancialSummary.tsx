"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, Euro, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/design-system/utils";

interface FinancialData {
  currentMonth: {
    collected: number;
    expected: number;
  };
  lastMonth?: {
    collected: number;
    expected: number;
  };
  arrears?: number;
  upcoming?: number;
}

interface FinancialSummaryProps {
  data: FinancialData;
  viewAllHref?: string;
  className?: string;
}

export function FinancialSummary({ data, viewAllHref = "/owner/money", className }: FinancialSummaryProps) {
  const { currentMonth, lastMonth, arrears = 0, upcoming = 0 } = data;

  const collectionRate = currentMonth.expected > 0
    ? Math.round((currentMonth.collected / currentMonth.expected) * 100)
    : 0;

  const lastMonthRate = lastMonth && lastMonth.expected > 0
    ? Math.round((lastMonth.collected / lastMonth.expected) * 100)
    : null;

  const trendValue = lastMonthRate !== null ? collectionRate - lastMonthRate : null;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Euro className="h-5 w-5 text-emerald-600" />
          Vue financière
        </CardTitle>
        {viewAllHref && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={viewAllHref}>
              Détails
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Revenus du mois */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Revenus du mois</span>
            {trendValue !== null && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trendValue >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {trendValue >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trendValue >= 0 ? "+" : ""}{trendValue}%
              </div>
            )}
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-bold text-emerald-600">
                {formatCurrency(currentMonth.collected)}
              </p>
              <p className="text-sm text-muted-foreground">
                sur {formatCurrency(currentMonth.expected)} attendus
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold">{collectionRate}%</p>
              <p className="text-xs text-muted-foreground">taux de collecte</p>
            </div>
          </div>

          <Progress value={collectionRate} className="h-2" />
        </div>

        {/* Métriques secondaires */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          {arrears > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Impayés
              </p>
              <p className="text-lg font-semibold text-rose-600">
                {formatCurrency(arrears)}
              </p>
            </div>
          )}

          {upcoming > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                À venir
              </p>
              <p className="text-lg font-semibold text-amber-600">
                {formatCurrency(upcoming)}
              </p>
            </div>
          )}

          {arrears === 0 && upcoming === 0 && (
            <div className="col-span-2 text-center py-2">
              <p className="text-sm text-muted-foreground">
                ✨ Tout est à jour !
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

