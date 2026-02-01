"use client";
// @ts-nocheck

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";
import type { ExpiryStatus } from "@/lib/types/ged";
import { EXPIRY_LABELS } from "@/lib/types/ged";

interface ExpiryBadgeProps {
  status: ExpiryStatus;
  daysUntilExpiry?: number | null;
  className?: string;
  showDays?: boolean;
}

const expiryConfig: Record<
  NonNullable<ExpiryStatus>,
  {
    icon: typeof AlertTriangle;
    bgClass: string;
    textClass: string;
    borderClass: string;
    dotClass: string;
  }
> = {
  expired: {
    icon: XCircle,
    bgClass: "bg-rose-50 dark:bg-rose-900/30",
    textClass: "text-rose-700 dark:text-rose-400",
    borderClass: "border-rose-200 dark:border-rose-800",
    dotClass: "bg-rose-500",
  },
  expiring_soon: {
    icon: AlertTriangle,
    bgClass: "bg-amber-50 dark:bg-amber-900/30",
    textClass: "text-amber-700 dark:text-amber-400",
    borderClass: "border-amber-200 dark:border-amber-800",
    dotClass: "bg-amber-500",
  },
  expiring_notice: {
    icon: Clock,
    bgClass: "bg-blue-50 dark:bg-blue-900/30",
    textClass: "text-blue-700 dark:text-blue-400",
    borderClass: "border-blue-200 dark:border-blue-800",
    dotClass: "bg-blue-500",
  },
  valid: {
    icon: CheckCircle,
    bgClass: "bg-emerald-50 dark:bg-emerald-900/30",
    textClass: "text-emerald-700 dark:text-emerald-400",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    dotClass: "bg-emerald-500",
  },
};

export function ExpiryBadge({ status, daysUntilExpiry, className, showDays = true }: ExpiryBadgeProps) {
  if (!status) return null;

  const config = expiryConfig[status];
  const Icon = config.icon;

  let label = EXPIRY_LABELS[status];
  if (showDays && daysUntilExpiry !== null && daysUntilExpiry !== undefined) {
    if (daysUntilExpiry < 0) {
      label = `Expiré depuis ${Math.abs(daysUntilExpiry)}j`;
    } else if (daysUntilExpiry === 0) {
      label = "Expire aujourd'hui";
    } else {
      label = `${daysUntilExpiry}j restants`;
    }
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 px-2 py-0.5 font-medium text-xs transition-colors",
        config.bgClass,
        config.textClass,
        config.borderClass,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
