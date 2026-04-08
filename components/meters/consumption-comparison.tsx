"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { METER_CONFIG } from "./meter-card";
import type { MeterType } from "@/lib/services/meters/types";

interface ConsumptionComparisonProps {
  currentYear: number;
  currentTotal: number;
  previousTotal: number;
  meterType: MeterType;
  className?: string;
}

export function ConsumptionComparison({
  currentYear,
  currentTotal,
  previousTotal,
  meterType,
  className,
}: ConsumptionComparisonProps) {
  const config = METER_CONFIG[meterType] || METER_CONFIG.other;
  const diff = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
  const isUp = diff > 2;
  const isDown = diff < -2;

  return (
    <GlassCard className={cn("p-5", className)}>
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
        Comparaison annuelle
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-xl bg-muted border border-border">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">{currentYear}</p>
          <p className="text-xl font-black text-foreground">
            {currentTotal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-muted-foreground">{config.unitLabel}</p>
        </div>

        <div className="p-3 rounded-xl bg-muted border border-border">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">{currentYear - 1}</p>
          <p className="text-xl font-black text-foreground">
            {previousTotal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-muted-foreground">{config.unitLabel}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {isUp ? (
          <>
            <TrendingUp className="h-4 w-4 text-red-500" />
            <span className="text-sm font-bold text-red-500">+{diff.toFixed(1)}%</span>
            <span className="text-xs text-muted-foreground">vs annee precedente</span>
          </>
        ) : isDown ? (
          <>
            <TrendingDown className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold text-emerald-500">{diff.toFixed(1)}%</span>
            <span className="text-xs text-muted-foreground">vs annee precedente</span>
          </>
        ) : (
          <>
            <Minus className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold text-muted-foreground">Stable</span>
          </>
        )}
      </div>
    </GlassCard>
  );
}
