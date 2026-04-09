"use client";

import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, AlertCircle, XCircle, CheckCircle } from "lucide-react";
import type { ExpiryStatus } from "@/lib/insurance/types";
import { formatDaysLeft } from "@/lib/insurance/helpers";

const STATUS_CONFIG: Record<ExpiryStatus, {
  variant: "success" | "warning" | "destructive" | "default" | null | undefined;
  Icon: typeof Shield;
  className: string;
}> = {
  ok: { variant: "success", Icon: CheckCircle, className: "" },
  warning: { variant: "warning", Icon: AlertTriangle, className: "" },
  critical: { variant: "destructive", Icon: AlertCircle, className: "animate-pulse" },
  expired: { variant: "destructive", Icon: XCircle, className: "" },
};

interface ExpiryBadgeProps {
  status: ExpiryStatus;
  daysLeft: number;
}

export function ExpiryBadge({ status, daysLeft }: ExpiryBadgeProps) {
  const config = STATUS_CONFIG[status];
  const { Icon } = config;

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {formatDaysLeft(daysLeft)}
    </Badge>
  );
}
