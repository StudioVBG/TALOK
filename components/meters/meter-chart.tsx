"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { METER_CONFIG } from "./meter-card";
import type { MeterType, ConsumptionChartData } from "@/lib/services/meters/types";

interface MeterChartProps {
  data: ConsumptionChartData[];
  meterType: MeterType;
  className?: string;
}

/**
 * Simple bar chart for consumption data.
 * Uses pure CSS/SVG instead of Recharts to avoid dependency.
 */
export function MeterChart({ data, meterType, className }: MeterChartProps) {
  const config = METER_CONFIG[meterType] || METER_CONFIG.other;

  const { bars, maxValue } = useMemo(() => {
    if (data.length === 0) return { bars: [], maxValue: 0 };
    const max = Math.max(...data.map((d) => d.value), 1);
    return {
      bars: data.map((d) => ({
        ...d,
        height: (d.value / max) * 100,
        label: new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      })),
      maxValue: max,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <GlassCard className={cn("p-6", className)}>
        <p className="text-sm text-muted-foreground text-center py-8">
          Pas de donnees de consommation disponibles
        </p>
      </GlassCard>
    );
  }

  const totalConsumption = data.reduce((sum, d) => sum + d.value, 0);
  const totalCostCents = data.reduce((sum, d) => sum + (d.estimated_cost_cents || 0), 0);

  return (
    <GlassCard className={cn("p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Consommation
        </h3>
        <div className="text-right">
          <span className="text-lg font-black text-foreground">
            {totalConsumption.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
          </span>
          <span className="text-xs text-muted-foreground ml-1">{config.unitLabel}</span>
          {totalCostCents > 0 && (
            <p className="text-[10px] text-muted-foreground">
              ~{(totalCostCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
            </p>
          )}
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1 h-32">
        {bars.slice(-30).map((bar, idx) => (
          <div
            key={`${bar.date}-${idx}`}
            className="flex-1 flex flex-col items-center justify-end"
            title={`${bar.label}: ${bar.value.toLocaleString("fr-FR")} ${config.unitLabel}`}
          >
            <div
              className={cn(
                "w-full rounded-t transition-all duration-300 min-h-[2px]",
                `bg-gradient-to-t ${config.gradient}`
              )}
              style={{ height: `${Math.max(bar.height, 2)}%` }}
            />
          </div>
        ))}
      </div>

      {/* X-axis labels (first and last) */}
      {bars.length > 0 && (
        <div className="flex justify-between mt-2">
          <span className="text-[9px] text-muted-foreground">{bars[0]?.label}</span>
          <span className="text-[9px] text-muted-foreground">{bars[bars.length - 1]?.label}</span>
        </div>
      )}
    </GlassCard>
  );
}
