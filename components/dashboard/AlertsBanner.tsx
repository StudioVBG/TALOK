"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, Info, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

type AlertType = "error" | "warning" | "info";

interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message?: string;
  action?: {
    label: string;
    href: string;
  };
}

interface AlertsBannerProps {
  alerts: Alert[];
  dismissible?: boolean;
  className?: string;
}

const alertStyles: Record<AlertType, { container: string; icon: typeof AlertCircle }> = {
  error: {
    container: "bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-200",
    icon: AlertCircle,
  },
  warning: {
    container: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/50 dark:border-amber-900 dark:text-amber-200",
    icon: AlertTriangle,
  },
  info: {
    container: "bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/50 dark:border-sky-900 dark:text-sky-200",
    icon: Info,
  },
};

export function AlertsBanner({ alerts: initialAlerts, dismissible = true, className }: AlertsBannerProps) {
  const [alerts, setAlerts] = useState(initialAlerts);

  if (alerts.length === 0) return null;

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  return (
    <div className={cn("space-y-3", className)}>
      {alerts.map((alert) => {
        const styles = alertStyles[alert.type];
        const Icon = styles.icon;

        return (
          <div
            key={alert.id}
            className={cn(
              "flex items-start gap-3 p-4 rounded-xl border",
              styles.container
            )}
          >
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />

            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-medium">{alert.title}</p>
              {alert.message && (
                <p className="text-sm opacity-90">{alert.message}</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {alert.action && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3"
                  asChild
                >
                  <Link href={alert.action.href}>
                    {alert.action.label}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
              {dismissible && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-60 hover:opacity-100"
                  onClick={() => dismissAlert(alert.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

