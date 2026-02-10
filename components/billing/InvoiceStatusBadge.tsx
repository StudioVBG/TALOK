"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, FileEdit, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/types/billing";

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; icon: React.ElementType; classes: string }
> = {
  paid: {
    label: "Payee",
    icon: CheckCircle,
    classes: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  open: {
    label: "En attente",
    icon: Clock,
    classes: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  draft: {
    label: "Brouillon",
    icon: FileEdit,
    classes: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  },
  void: {
    label: "Annulee",
    icon: XCircle,
    classes: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  },
  uncollectible: {
    label: "Irrecouvrable",
    icon: AlertTriangle,
    classes: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge className={cn("gap-1", config.classes)} role="status">
      <Icon className="w-3 h-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
