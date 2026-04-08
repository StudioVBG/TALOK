"use client";

import { MessageSquare } from "lucide-react";

interface SMSUsageSummaryProps {
  count: number;
  month: string;
  pricePerSMS?: number; // in euros, default 0.08
}

export function SMSUsageSummary({
  count,
  month,
  pricePerSMS = 0.08,
}: SMSUsageSummaryProps) {
  const estimatedCost = (count * pricePerSMS).toFixed(2).replace(".", ",");

  // Format month label: "2026-04" → "avril 2026"
  const monthLabel = new Date(`${month}-01`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
        <MessageSquare className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">SMS envoyés en {monthLabel}</p>
        <p className="text-xs text-muted-foreground">
          {count} SMS — coût estimé : {estimatedCost} €
        </p>
      </div>
    </div>
  );
}
