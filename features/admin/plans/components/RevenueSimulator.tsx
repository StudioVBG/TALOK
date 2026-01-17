"use client";

/**
 * RevenueSimulator component
 * Simulates revenue impact of price changes
 * Extracted from app/admin/plans/page.tsx
 */

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calculator, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan } from "../types";
import { formatEuros, getPlanColor } from "../helpers";

interface RevenueSimulatorProps {
  plans: Plan[];
  originalPlans: Plan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RevenueSimulator({
  plans,
  originalPlans,
  open,
  onOpenChange,
}: RevenueSimulatorProps) {
  const [churnRate, setChurnRate] = useState([5]); // 5% par défaut

  const simulation = useMemo(() => {
    const results: Array<{
      plan: Plan;
      original: Plan;
      subscribers: number;
      oldMRR: number;
      newMRR: number;
      mrrDelta: number;
      mrrDeltaPercent: number;
      estimatedChurn: number;
      netMRRDelta: number;
    }> = [];

    let totalOldMRR = 0;
    let totalNewMRR = 0;
    let totalSubscribers = 0;
    let totalChurn = 0;

    plans.forEach((plan, index) => {
      const original = originalPlans[index];
      if (!original) return;

      const subscribers = plan.active_subscribers_count || 0;
      const oldMRR = (original.price_monthly / 100) * subscribers;
      const newMRR = (plan.price_monthly / 100) * subscribers;
      const mrrDelta = newMRR - oldMRR;
      const mrrDeltaPercent = oldMRR > 0 ? (mrrDelta / oldMRR) * 100 : 0;

      // Estimation du churn basée sur l'augmentation de prix
      let estimatedChurnPercent = 0;
      if (mrrDeltaPercent > 0) {
        estimatedChurnPercent = Math.min(churnRate[0] + mrrDeltaPercent / 5, 20);
      }
      const estimatedChurn = Math.round(
        subscribers * (estimatedChurnPercent / 100)
      );
      const netMRRDelta =
        mrrDelta - estimatedChurn * (plan.price_monthly / 100);

      totalOldMRR += oldMRR;
      totalNewMRR += newMRR;
      totalSubscribers += subscribers;
      totalChurn += estimatedChurn;

      if (plan.price_monthly !== original.price_monthly) {
        results.push({
          plan,
          original,
          subscribers,
          oldMRR,
          newMRR,
          mrrDelta,
          mrrDeltaPercent,
          estimatedChurn,
          netMRRDelta,
        });
      }
    });

    return {
      results,
      totalOldMRR,
      totalNewMRR,
      totalMRRDelta: totalNewMRR - totalOldMRR,
      totalSubscribers,
      totalChurn,
      totalNetMRRDelta:
        totalNewMRR -
        totalOldMRR -
        totalChurn *
          (plans.reduce((sum, p) => sum + p.price_monthly, 0) /
            plans.length /
            100),
    };
  }, [plans, originalPlans, churnRate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-violet-500" />
            Simulateur de revenus
          </DialogTitle>
          <DialogDescription>
            Estimez l'impact des changements de prix sur votre MRR
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Churn rate slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Taux de churn estimé</Label>
              <Badge variant="outline">{churnRate[0]}%</Badge>
            </div>
            <Slider
              value={churnRate}
              onValueChange={setChurnRate}
              min={0}
              max={20}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Pourcentage d'abonnés susceptibles de résilier suite aux
              changements
            </p>
          </div>

          <Separator />

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-muted-foreground">
                  {simulation.totalOldMRR.toFixed(0)}€
                </div>
                <div className="text-xs text-muted-foreground">MRR actuel</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-500/10 border-emerald-500/30">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-emerald-600 flex items-center gap-1">
                  {simulation.totalNewMRR.toFixed(0)}€
                  {simulation.totalMRRDelta > 0 && (
                    <TrendingUp className="h-4 w-4" />
                  )}
                  {simulation.totalMRRDelta < 0 && (
                    <TrendingDown className="h-4 w-4" />
                  )}
                </div>
                <div className="text-xs text-emerald-600">MRR projeté</div>
              </CardContent>
            </Card>
            <Card
              className={cn(
                "border",
                simulation.totalNetMRRDelta >= 0
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
              )}
            >
              <CardContent className="pt-4">
                <div
                  className={cn(
                    "text-2xl font-bold flex items-center gap-1",
                    simulation.totalNetMRRDelta >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  )}
                >
                  {simulation.totalNetMRRDelta >= 0 ? "+" : ""}
                  {simulation.totalNetMRRDelta.toFixed(0)}€
                </div>
                <div className="text-xs text-muted-foreground">
                  Δ Net (après churn)
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed results */}
          {simulation.results.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Détail par plan</h4>
              {simulation.results.map(
                ({
                  plan,
                  original,
                  subscribers,
                  oldMRR,
                  newMRR,
                  mrrDeltaPercent,
                  estimatedChurn,
                }) => (
                  <Card key={plan.id} className="bg-muted/20">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className={getPlanColor(plan.slug).text}
                          >
                            {plan.name}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {subscribers} abonné{subscribers > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground line-through">
                            {formatEuros(original.price_monthly)}
                          </span>
                          <span className="font-medium">→</span>
                          <span className="font-bold text-emerald-600">
                            {formatEuros(plan.price_monthly)}
                          </span>
                          <Badge
                            className={cn(
                              mrrDeltaPercent >= 0
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-red-500/10 text-red-600"
                            )}
                          >
                            {mrrDeltaPercent >= 0 ? "+" : ""}
                            {mrrDeltaPercent.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>
                          MRR: {oldMRR.toFixed(0)}€ → {newMRR.toFixed(0)}€
                        </span>
                        <span className="text-amber-600">
                          Churn estimé: ~{estimatedChurn} abonné
                          {estimatedChurn > 1 ? "s" : ""}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Aucun changement de prix détecté</p>
              <p className="text-sm mt-1">
                Modifiez le prix d'un plan pour voir la simulation
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
