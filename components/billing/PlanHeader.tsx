"use client";

import { Building2, ArrowUpRight, Eye, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/billing-utils";
import Link from "next/link";
import type {
  BillingCycle,
  PlanDefinition,
  SubscriptionStatus,
  UsageSummary,
} from "@/types/billing";

const STATUS_DISPLAY: Record<
  SubscriptionStatus,
  { label: string; classes: string }
> = {
  active: {
    label: "Actif",
    classes: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  trialing: {
    label: "Essai",
    classes: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  },
  paused: {
    label: "Suspendu",
    classes: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  past_due: {
    label: "Impaye",
    classes: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  canceled: {
    label: "Annule",
    classes: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  },
  incomplete: {
    label: "Incomplet",
    classes: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
};

interface PlanHeaderProps {
  plan: PlanDefinition;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  usage: UsageSummary;
  tvaTaux: number;
  onUpgrade: () => void;
  upgradeLoading?: boolean;
}

export function PlanHeader({
  plan,
  status,
  billingCycle,
  usage,
  tvaTaux,
  onUpgrade,
  upgradeLoading,
}: PlanHeaderProps) {
  const statusDisplay = STATUS_DISPLAY[status];

  const price = billingCycle === "yearly" ? plan.price_yearly_ht : plan.price_monthly_ht;
  const priceLabel = billingCycle === "yearly" ? "HT/an" : "HT/mois";
  const ttc = Math.round(price * (1 + tvaTaux / 100));

  const usageSummary = [
    { label: "biens", current: usage.biens.current_value, max: usage.biens.max_value },
    { label: "signatures", current: usage.signatures.current_value, max: usage.signatures.max_value },
    { label: "utilisateurs", current: usage.utilisateurs.current_value, max: usage.utilisateurs.max_value },
  ].filter((item) => item.max !== -1);

  const hasNearLimit = usageSummary.some((item) => item.current / item.max >= 0.8);

  return (
    <div className="p-4 sm:p-6 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Icon */}
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-7 h-7 text-white" aria-hidden="true" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-white">{plan.name}</h2>
            <Badge className={cn("text-xs", statusDisplay.classes)} role="status">
              {statusDisplay.label}
            </Badge>
          </div>
          <p className="text-sm text-slate-300">{plan.description}</p>

          {/* Inline usage summary */}
          <p
            className={cn(
              "text-xs mt-2",
              hasNearLimit ? "text-amber-400" : "text-slate-400"
            )}
            aria-live="polite"
          >
            {usageSummary.map((item, i) => (
              <span key={item.label}>
                {i > 0 && " · "}
                {item.current}/{item.max === -1 ? "\u221E" : item.max} {item.label}
              </span>
            ))}
          </p>
        </div>

        {/* Price */}
        <div className="text-left sm:text-right flex-shrink-0">
          <div className="text-2xl font-bold text-white">
            {formatPrice(price)}
            <span className="text-sm font-normal text-slate-400 ml-1">{priceLabel}</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            soit {formatPrice(ttc)} TTC (TVA {tvaTaux}%)
          </p>
          {billingCycle === "yearly" && (
            <p className="text-xs text-slate-400">
              equiv. {formatPrice(Math.round(price / 12))} HT/mois
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-violet-500/20">
        <Button
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
          onClick={onUpgrade}
          disabled={upgradeLoading}
        >
          {upgradeLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <ArrowUpRight className="w-4 h-4 mr-2" aria-hidden="true" />
          )}
          Changer de forfait
        </Button>
        <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white" asChild>
          <Link href="/pricing">
            <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
            Comparer les forfaits
          </Link>
        </Button>
      </div>
    </div>
  );
}
