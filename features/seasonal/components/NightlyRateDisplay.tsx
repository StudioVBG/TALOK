"use client";

import { Moon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeasonalRate, SeasonName } from "@/lib/types/seasonal";

const SEASON_CONFIG: Record<SeasonName, { label: string; icon: typeof TrendingUp; color: string }> = {
  haute: { label: "Haute", icon: TrendingUp, color: "text-red-600" },
  moyenne: { label: "Moyenne", icon: Moon, color: "text-amber-600" },
  basse: { label: "Basse", icon: TrendingDown, color: "text-green-600" },
  fetes: { label: "Fêtes", icon: TrendingUp, color: "text-purple-600" },
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

interface NightlyRateDisplayProps {
  rates: SeasonalRate[];
  className?: string;
}

export function NightlyRateDisplay({ rates, className }: NightlyRateDisplayProps) {
  if (rates.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Aucun tarif configuré
      </p>
    );
  }

  const minRate = Math.min(...rates.map((r) => r.nightly_rate_cents));
  const maxRate = Math.max(...rates.map((r) => r.nightly_rate_cents));

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-lg font-bold">
        {minRate === maxRate
          ? formatCents(minRate)
          : `${formatCents(minRate)} — ${formatCents(maxRate)}`}
        <span className="text-sm font-normal text-muted-foreground"> / nuit</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {rates.map((rate) => {
          const config = SEASON_CONFIG[rate.season_name];
          const Icon = config?.icon ?? Moon;
          return (
            <span
              key={rate.id}
              className={cn("inline-flex items-center gap-1 text-xs", config?.color)}
            >
              <Icon className="h-3 w-3" />
              {config?.label}: {formatCents(rate.nightly_rate_cents)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
