"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import type { AlertSeverity, AlertType } from "@/lib/services/meters/types";

const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; border: string; text: string; icon: typeof AlertTriangle }> = {
  critical: {
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-800 dark:text-red-200",
    icon: AlertTriangle,
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-200",
    icon: AlertCircle,
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-200",
    icon: Info,
  },
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  overconsumption: "Surconsommation",
  no_reading: "Releve manquant",
  anomaly: "Anomalie",
  contract_expiry: "Contrat expire",
};

interface MeterAlertBannerProps {
  alert: {
    id: string;
    alert_type: AlertType;
    severity: AlertSeverity;
    message: string;
    created_at: string;
  };
  onAcknowledge?: (id: string) => void;
  className?: string;
}

export function MeterAlertBanner({ alert, onAcknowledge, className }: MeterAlertBannerProps) {
  const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-2xl border",
        style.bg,
        style.border,
        className
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", style.text)} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-bold uppercase tracking-wider mb-0.5", style.text)}>
          {ALERT_TYPE_LABELS[alert.alert_type]}
        </p>
        <p className={cn("text-sm", style.text)}>{alert.message}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {new Date(alert.created_at).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      {onAcknowledge && (
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 h-8 w-8 p-0 rounded-full"
          onClick={() => onAcknowledge(alert.id)}
          title="Acquitter"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
