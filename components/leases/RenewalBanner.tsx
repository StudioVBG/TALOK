"use client";

import { useState } from "react";
import { CalendarClock, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RenewalBannerProps {
  leaseId: string;
  dateFin: string | null;
  typeBail: string;
  statut: string;
  onRenew?: () => void;
  className?: string;
}

/**
 * Banner displayed on active leases approaching their end date.
 * Prompts the owner to renew or take action.
 */
export function RenewalBanner({
  leaseId,
  dateFin,
  typeBail,
  statut,
  onRenew,
  className,
}: RenewalBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || statut !== "active" || !dateFin) return null;

  const endDate = new Date(dateFin);
  const today = new Date();
  const daysRemaining = Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Only show banner within 90 days of end date
  if (daysRemaining > 90 || daysRemaining < 0) return null;

  // Non-renewable bail types
  const nonRenewable = ["etudiant", "mobilite", "saisonnier", "bail_mobilite"];
  const isRenewable = !nonRenewable.includes(typeBail);

  const urgency =
    daysRemaining <= 30
      ? "urgent"
      : daysRemaining <= 60
        ? "warning"
        : "info";

  const bgClass = {
    urgent: "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800",
    warning: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
    info: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
  };

  const textClass = {
    urgent: "text-rose-700 dark:text-rose-400",
    warning: "text-amber-700 dark:text-amber-400",
    info: "text-blue-700 dark:text-blue-400",
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 px-4 py-3 rounded-lg border",
        bgClass[urgency],
        className
      )}
    >
      <CalendarClock className={cn("h-5 w-5 flex-shrink-0", textClass[urgency])} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", textClass[urgency])}>
          {daysRemaining <= 0
            ? "Le bail a expiré"
            : `Le bail expire dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Fin prévue le{" "}
          {endDate.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {!isRenewable && " — Ce type de bail n'est pas renouvelable"}
        </p>
      </div>
      {isRenewable && onRenew && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRenew}
          className={cn("flex-shrink-0 gap-1", textClass[urgency])}
        >
          Renouveler
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-1 right-1 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Fermer"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}
