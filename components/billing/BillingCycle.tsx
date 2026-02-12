"use client";

import { Calendar, Clock, AlertCircle, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, formatDateLong, daysUntil, computeYearlySavings } from "@/lib/billing-utils";
import type { BillingCycle as BillingCycleType, PlanDefinition } from "@/types/billing";
import Link from "next/link";

interface BillingCycleProps {
  cycle: BillingCycleType;
  periodEnd: string;
  plan: PlanDefinition;
  tvaTaux: number;
}

export function BillingCycle({ cycle, periodEnd, plan, tvaTaux }: BillingCycleProps) {
  const daysLeft = daysUntil(periodEnd);
  const isOverdue = new Date(periodEnd).getTime() < Date.now();
  const isUrgent = !isOverdue && daysLeft <= 7;
  const { savingsPercent } = computeYearlySavings(plan.price_monthly_ht, plan.price_yearly_ht);

  const monthlyEquivalent = cycle === "yearly"
    ? Math.round(plan.price_yearly_ht / 12)
    : plan.price_monthly_ht;
  const monthlyCostTTC = Math.round(monthlyEquivalent * (1 + tvaTaux / 100));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Cycle */}
      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span className="text-xs text-slate-400">Cycle de facturation</span>
        </div>
        <p className="text-sm font-medium text-white">
          {cycle === "yearly" ? "Annuel" : "Mensuel"}
        </p>
        {cycle === "monthly" && savingsPercent > 0 && (
          <Link
            href="/pricing"
            className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2 mt-1 inline-block transition-colors"
          >
            Economisez {savingsPercent}% en annuel &rarr;
          </Link>
        )}
      </div>

      {/* Next billing date */}
      <div className={cn(
        "p-4 rounded-lg border",
        isOverdue
          ? "bg-amber-500/10 border-amber-500/30"
          : "bg-slate-900/50 border-slate-700/50"
      )}>
        <div className="flex items-center gap-2 mb-1">
          {isOverdue ? (
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          )}
          <span className={cn("text-xs", isOverdue ? "text-amber-400" : "text-slate-400")}>
            Prochaine facturation
          </span>
        </div>
        <p className={cn("text-sm font-medium", isOverdue ? "text-amber-400" : "text-white")}>
          {formatDateLong(periodEnd)}
        </p>
        {isOverdue ? (
          <p className="text-xs text-amber-400 mt-1">
            Renouvellement en cours
          </p>
        ) : isUrgent ? (
          <p className="text-xs text-red-400 mt-1">
            Dans {daysLeft} jour{daysLeft > 1 ? "s" : ""}
          </p>
        ) : (
          <p className="text-xs text-slate-400 mt-1">
            Dans {daysLeft} jour{daysLeft > 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Monthly cost */}
      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-1">
          <Receipt className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span className="text-xs text-slate-400">Cout mensuel{cycle === "yearly" ? " equiv." : ""}</span>
        </div>
        <p className="text-sm font-medium text-white">{formatPrice(monthlyEquivalent)} HT</p>
        <p className="text-xs mt-0.5 text-slate-400">
          {formatPrice(monthlyCostTTC)} TTC
        </p>
      </div>
    </div>
  );
}
