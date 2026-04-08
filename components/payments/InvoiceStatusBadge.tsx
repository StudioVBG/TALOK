"use client";

import { Badge } from "@/components/ui/badge";
import { getStatusDisplay } from "@/lib/payments/invoice-state-machine";
import {
  FileEdit,
  Send,
  Clock,
  CheckCircle,
  FileCheck,
  AlertTriangle,
  Bell,
  Gavel,
  XCircle,
  HelpCircle,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  FileEdit,
  Send,
  Clock,
  CheckCircle,
  FileCheck,
  AlertTriangle,
  Bell,
  Gavel,
  XCircle,
  HelpCircle,
};

interface InvoiceStatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function InvoiceStatusBadge({
  status,
  showIcon = true,
  size = "sm",
}: InvoiceStatusBadgeProps) {
  const display = getStatusDisplay(status);
  const Icon = ICON_MAP[display.icon] || HelpCircle;

  const sizeClasses =
    size === "md"
      ? "px-3 py-1 text-sm gap-1.5"
      : "px-2 py-0.5 text-xs gap-1";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${display.badgeClass} ${sizeClasses}`}
    >
      {showIcon && <Icon className={size === "md" ? "h-4 w-4" : "h-3 w-3"} />}
      {display.label}
    </span>
  );
}
