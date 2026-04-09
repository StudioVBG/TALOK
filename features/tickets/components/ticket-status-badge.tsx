"use client";

import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  UserCheck,
  Wrench,
  XCircle,
  RotateCcw,
  PauseCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof AlertCircle }
> = {
  open: {
    label: "Ouvert",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    icon: AlertCircle,
  },
  acknowledged: {
    label: "Pris en compte",
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
    icon: Eye,
  },
  assigned: {
    label: "Assigné",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    icon: UserCheck,
  },
  in_progress: {
    label: "En cours",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    icon: Wrench,
  },
  resolved: {
    label: "Résolu",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  closed: {
    label: "Clôturé",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejeté",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    icon: XCircle,
  },
  reopened: {
    label: "Rouvert",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    icon: RotateCcw,
  },
  paused: {
    label: "En pause",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
    icon: PauseCircle,
  },
};

interface TicketStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
}

export function TicketStatusBadge({ status, size = "md", className }: TicketStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-bold",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        config.color,
        className
      )}
    >
      <Icon className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {config.label}
    </Badge>
  );
}

export { STATUS_CONFIG };
