"use client";

import { cn } from "@/lib/utils";

interface ReconciliationBadgeProps {
  count: number;
}

/**
 * Badge affichant le nombre de transactions a traiter (suggested + orphan).
 * S'affiche uniquement si count > 0.
 */
export function ReconciliationBadge({ count }: ReconciliationBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        "min-w-[1.25rem] h-5 px-1.5 rounded-full",
        "bg-orange-500 text-white text-xs font-bold",
        "animate-in fade-in zoom-in-50"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default ReconciliationBadge;
