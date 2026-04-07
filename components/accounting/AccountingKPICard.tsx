"use client";

import { type ReactNode } from "react";
import { formatCents } from "@/lib/utils/format-cents";
import { cn } from "@/lib/utils";

interface AccountingKPICardProps {
  title: string;
  value: number;
  trend?: number;
  color: "green" | "blue" | "red" | "orange";
  icon: ReactNode;
}

const colorMap: Record<AccountingKPICardProps["color"], string> = {
  green: "text-emerald-500",
  blue: "text-blue-500",
  red: "text-red-500",
  orange: "text-orange-500",
};

const trendBg: Record<"up" | "down", string> = {
  up: "bg-emerald-500/10 text-emerald-500",
  down: "bg-red-500/10 text-red-500",
};

export function AccountingKPICard({
  title,
  value,
  trend,
  color,
  icon,
}: AccountingKPICardProps) {
  const direction = trend !== undefined && trend >= 0 ? "up" : "down";

  return (
    <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
        <span className={cn("shrink-0", colorMap[color])}>{icon}</span>
      </div>

      <p className="text-xl sm:text-2xl font-bold text-foreground">
        {formatCents(value)}
      </p>

      {trend !== undefined && (
        <span
          className={cn(
            "inline-flex items-center self-start text-xs font-medium px-2 py-0.5 rounded-full",
            trendBg[direction]
          )}
        >
          {direction === "up" ? "+" : ""}
          {trend.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

export default AccountingKPICard;
