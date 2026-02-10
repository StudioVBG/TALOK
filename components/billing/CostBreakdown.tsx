"use client";

import { Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPrice, computeTTC, computeYearlySavings, getTvaLabel } from "@/lib/billing-utils";
import type { BillingCycle, PlanDefinition, Territoire } from "@/types/billing";

interface CostLineProps {
  label: string;
  amount: number;
  prefix?: string;
  muted?: boolean;
  bold?: boolean;
  accent?: boolean;
}

function CostLine({ label, amount, prefix = "", muted, bold, accent }: CostLineProps) {
  return (
    <div className="flex justify-between text-sm">
      <span className={muted ? "text-slate-500" : bold ? "text-white font-medium" : "text-slate-300"}>
        {label}
      </span>
      <span className={accent ? "text-emerald-400 font-semibold" : bold ? "text-white font-semibold" : muted ? "text-slate-500" : "text-slate-200"}>
        {prefix}{formatPrice(amount)}
      </span>
    </div>
  );
}

interface CostBreakdownProps {
  plan: PlanDefinition;
  billingCycle: BillingCycle;
  territoire: Territoire;
  tvaTaux: number;
  extraLots?: number;
  extraLotPrice?: number;
  addons?: { name: string; price_ht: number }[];
}

export function CostBreakdown({
  plan,
  billingCycle,
  territoire,
  tvaTaux,
  extraLots = 0,
  extraLotPrice = 0,
  addons = [],
}: CostBreakdownProps) {
  const basePrice = billingCycle === "yearly"
    ? Math.round(plan.price_yearly_ht / 12)
    : plan.price_monthly_ht;

  const extraLotsTotal = extraLots * extraLotPrice;
  const addonsTotal = addons.reduce((sum, a) => sum + a.price_ht, 0);

  const isDOM = territoire !== "metropole";
  const domDiscount = isDOM ? Math.round((basePrice + extraLotsTotal + addonsTotal) * 0.2) : 0;

  const subtotalHT = basePrice + extraLotsTotal + addonsTotal - domDiscount;
  const { tva, ttc } = computeTTC(subtotalHT, tvaTaux);

  const isYearly = billingCycle === "yearly";
  const { savingsPercent, savingsAmount } = computeYearlySavings(
    plan.price_monthly_ht,
    plan.price_yearly_ht
  );

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <Receipt className="w-5 h-5 text-violet-400" aria-hidden="true" />
          Detail du cout mensuel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <CostLine label={`Forfait ${plan.name}`} amount={basePrice} />

        {extraLots > 0 && (
          <CostLine
            label={`${extraLots} lot(s) suppl. x ${formatPrice(extraLotPrice)}`}
            amount={extraLotsTotal}
            prefix="+"
          />
        )}

        {addons.map((addon) => (
          <CostLine
            key={addon.name}
            label={`Module ${addon.name}`}
            amount={addon.price_ht}
            prefix="+"
          />
        ))}

        {isDOM && (
          <CostLine
            label={`Remise DOM-TOM -20% (${getTvaLabel(territoire)})`}
            amount={domDiscount}
            prefix="-"
            accent
          />
        )}

        <Separator className="bg-slate-700 my-2" />

        <CostLine label="Sous-total HT" amount={subtotalHT} bold />
        <CostLine
          label={`TVA ${tvaTaux}% (${getTvaLabel(territoire)})`}
          amount={tva}
          muted
        />
        <div className="flex justify-between text-base pt-1">
          <span className="text-white font-bold">Total TTC</span>
          <span className="text-violet-400 font-bold">{formatPrice(ttc)}/mois</span>
        </div>

        {isYearly && savingsPercent > 0 && (
          <p className="text-xs text-emerald-400 pt-2">
            Economisez {savingsPercent}% soit {formatPrice(savingsAmount)}/an vs facturation mensuelle
          </p>
        )}
      </CardContent>
    </Card>
  );
}
