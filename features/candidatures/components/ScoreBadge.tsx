"use client";

import { Sparkles } from "lucide-react";

interface ScoreBadgeProps {
  score: number; // 0-100
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const getVariant = (score: number) => {
    if (score >= 80) return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
    if (score >= 60) return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
    if (score >= 40) return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
    return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
  };

  const getLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Bon";
    if (score >= 40) return "Moyen";
    return "Faible";
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getVariant(score)}`}
    >
      <Sparkles className="h-3 w-3" />
      <span>{score}/100</span>
      <span className="text-[10px] opacity-75">({getLabel(score)})</span>
    </div>
  );
}
