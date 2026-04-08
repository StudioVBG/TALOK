"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import {
  Zap,
  Droplet,
  Flame,
  Gauge,
  Calendar,
  Wifi,
  WifiOff,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MeterType, SyncStatus } from "@/lib/services/meters/types";

export const METER_CONFIG: Record<
  string,
  {
    label: string;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    gradient: string;
    unitLabel: string;
  }
> = {
  electricity: {
    label: "Electricite",
    icon: Zap,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    gradient: "from-amber-500 to-orange-600",
    unitLabel: "kWh",
  },
  gas: {
    label: "Gaz",
    icon: Flame,
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
    gradient: "from-orange-500 to-red-600",
    unitLabel: "m3",
  },
  water: {
    label: "Eau",
    icon: Droplet,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    gradient: "from-blue-500 to-indigo-600",
    unitLabel: "m3",
  },
  heating: {
    label: "Chauffage",
    icon: Flame,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    gradient: "from-red-500 to-rose-600",
    unitLabel: "kWh",
  },
  other: {
    label: "Autre",
    icon: Gauge,
    color: "text-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-900/20",
    gradient: "from-gray-500 to-slate-600",
    unitLabel: "",
  },
};

function getSyncBadge(isConnected: boolean, syncStatus: SyncStatus) {
  if (!isConnected) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1">
        <WifiOff className="h-3 w-3" /> Manuel
      </Badge>
    );
  }
  switch (syncStatus) {
    case "active":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] gap-1">
          <Wifi className="h-3 w-3" /> Connecte
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] gap-1">
          <AlertTriangle className="h-3 w-3" /> Erreur
        </Badge>
      );
    case "expired":
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] gap-1">
          <WifiOff className="h-3 w-3" /> Expire
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] gap-1">
          En attente
        </Badge>
      );
  }
}

interface MeterCardProps {
  meter: {
    id: string;
    meter_type: MeterType;
    meter_reference: string;
    is_connected: boolean;
    sync_status: SyncStatus;
    provider: string | null;
    last_reading?: { value: number; date: string; unit: string } | null;
    active_alerts_count?: number;
  };
  onViewDetail?: (id: string) => void;
  onAddReading?: (id: string) => void;
  className?: string;
}

export function MeterCard({ meter, onViewDetail, onAddReading, className }: MeterCardProps) {
  const config = METER_CONFIG[meter.meter_type] || METER_CONFIG.other;
  const Icon = config.icon;

  return (
    <GlassCard
      className={cn(
        "group hover:shadow-2xl transition-all duration-300 border-border p-6",
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-2xl shadow-inner transition-transform group-hover:scale-110", config.bgColor)}>
          <Icon className={cn("h-7 w-7", config.color)} />
        </div>
        <div className="flex flex-col items-end gap-1">
          {getSyncBadge(meter.is_connected, meter.sync_status)}
          {(meter.active_alerts_count ?? 0) > 0 && (
            <Badge className="bg-red-500 text-white text-[10px]">
              {meter.active_alerts_count} alerte{(meter.active_alerts_count ?? 0) > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <h3 className="text-sm font-bold text-foreground">{config.label}</h3>
        <p className="text-[10px] text-muted-foreground font-mono">
          Ref: {meter.meter_reference}
        </p>
      </div>

      <div className="p-3 rounded-xl bg-muted border border-border mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Dernier releve</span>
          <div className="text-right">
            <span className="text-2xl font-black text-foreground">
              {meter.last_reading?.value?.toLocaleString("fr-FR") || "--"}
            </span>
            <span className="text-xs font-bold text-muted-foreground ml-1">
              {meter.last_reading?.unit || config.unitLabel}
            </span>
          </div>
        </div>
        {meter.last_reading?.date && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
            <Calendar className="h-3 w-3" />
            {new Date(meter.last_reading.date).toLocaleDateString("fr-FR")}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {onViewDetail && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl text-xs font-bold"
            onClick={() => onViewDetail(meter.id)}
          >
            Detail <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        )}
        {onAddReading && (
          <Button
            size="sm"
            className="flex-1 bg-foreground hover:bg-foreground/90 text-background rounded-xl text-xs font-bold"
            onClick={() => onAddReading(meter.id)}
          >
            + Releve
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
