"use client";

/**
 * ReconciliationStats — dumb KPI header for the bank reconciliation page.
 *
 * Displays three counters (matched / suggested / orphan) and a horizontal
 * progress bar that visualizes the share of each bucket. All state lives
 * in the parent; this component only consumes the `stats` shape exposed
 * by useReconciliation().
 */

import type { ReactNode } from "react";
import { Check, Clock, AlertTriangle } from "lucide-react";

export interface ReconciliationStatsValue {
  total: number;
  matched: number;
  suggested: number;
  orphan: number;
}

interface StatCardProps {
  label: string;
  count: number;
  color: "green" | "orange" | "red";
  icon: ReactNode;
}

function StatCard({ label, count, color, icon }: StatCardProps) {
  const colorMap = {
    green:
      "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900",
    orange:
      "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900",
    red: "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900",
  } as const;

  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-manrope)]">
        {count}
      </p>
    </div>
  );
}

export function ReconciliationStats({
  stats,
}: {
  stats: ReconciliationStatsValue;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Rapproches"
          count={stats.matched}
          color="green"
          icon={<Check className="w-4 h-4" />}
        />
        <StatCard
          label="A valider"
          count={stats.suggested}
          color="orange"
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="Non identifies"
          count={stats.orphan}
          color="red"
          icon={<AlertTriangle className="w-4 h-4" />}
        />
      </div>

      {stats.total > 0 && (
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
          {stats.matched > 0 && (
            <div
              className="h-full bg-green-500"
              style={{ width: `${(stats.matched / stats.total) * 100}%` }}
            />
          )}
          {stats.suggested > 0 && (
            <div
              className="h-full bg-orange-500"
              style={{ width: `${(stats.suggested / stats.total) * 100}%` }}
            />
          )}
          {stats.orphan > 0 && (
            <div
              className="h-full bg-red-500"
              style={{ width: `${(stats.orphan / stats.total) * 100}%` }}
            />
          )}
        </div>
      )}
    </>
  );
}
