"use client";

import { Building2, PenTool, Users, HardDrive, HelpCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AlertLevel, UsageMetric, UsageSummary } from "@/types/billing";

const METER_CONFIG: Record<
  UsageMetric,
  { icon: React.ElementType; label: string; unit: string; tooltip: string }
> = {
  biens: {
    icon: Building2,
    label: "Biens immobiliers",
    unit: "",
    tooltip: "Nombre de biens (lots) geres dans votre compte",
  },
  signatures: {
    icon: PenTool,
    label: "Signatures ce mois",
    unit: "",
    tooltip: "Nombre de signatures electroniques utilisees ce mois-ci",
  },
  utilisateurs: {
    icon: Users,
    label: "Utilisateurs",
    unit: "",
    tooltip: "Nombre de collaborateurs sur votre compte",
  },
  stockage_mb: {
    icon: HardDrive,
    label: "Stockage",
    unit: " Go",
    tooltip: "Espace utilise par vos documents (baux, EDL, photos...)",
  },
};

const ALERT_COLORS: Record<AlertLevel, { bar: string; text: string }> = {
  normal: { bar: "[&>div]:bg-emerald-500", text: "text-slate-400" },
  warning: { bar: "[&>div]:bg-amber-500", text: "text-amber-400 font-medium" },
  critical: { bar: "[&>div]:bg-orange-500", text: "text-orange-400 font-semibold" },
  exceeded: { bar: "[&>div]:bg-red-500", text: "text-red-400 font-semibold" },
};

interface UsageMeterProps {
  metric: UsageMetric;
  current: number;
  max: number;
  alertLevel: AlertLevel;
}

function UsageMeter({ metric, current, max, alertLevel }: UsageMeterProps) {
  const config = METER_CONFIG[metric];
  const Icon = config.icon;
  const isUnlimited = max === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, (current / max) * 100);
  const colors = ALERT_COLORS[alertLevel];

  const displayCurrent = metric === "stockage_mb"
    ? `${(current / 1024).toFixed(1)}`
    : `${current}`;
  const displayMax = isUnlimited
    ? "Illimite"
    : metric === "stockage_mb"
      ? `${max}${config.unit}`
      : `${max}`;

  const statusLabel =
    alertLevel === "exceeded"
      ? "Limite atteinte"
      : alertLevel === "critical"
        ? "Limite presque atteinte"
        : alertLevel === "warning"
          ? "Proche de la limite"
          : "Normal";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
              <span className="text-slate-300 truncate">{config.label}</span>
              <HelpCircle className="w-3 h-3 text-slate-400 flex-shrink-0" aria-hidden="true" />
            </div>
            <span className={cn("flex-shrink-0 tabular-nums", colors.text)}>
              {isUnlimited
                ? "Illimite"
                : `${displayCurrent}${config.unit} / ${displayMax}`}
            </span>
          </div>
          {!isUnlimited && (
            <div
              role="meter"
              aria-valuenow={current}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuetext={`${displayCurrent}${config.unit} sur ${displayMax} ${config.label} utilises — ${statusLabel}`}
              aria-label={`Utilisation ${config.label}`}
            >
              <Progress value={percentage} className={cn("h-2", colors.bar)} />
            </div>
          )}
          {!isUnlimited && alertLevel === "normal" && (
            <p className="text-xs text-slate-500">
              {Math.round(percentage)}% utilise
            </p>
          )}
          {alertLevel === "warning" && (
            <p className="text-xs text-amber-400">
              {Math.round(percentage)}% utilise — proche de la limite
            </p>
          )}
          {(alertLevel === "exceeded" || alertLevel === "critical") && (
            <p className={cn("text-xs", alertLevel === "exceeded" ? "text-red-400" : "text-orange-400")}>
              {alertLevel === "exceeded"
                ? "Limite atteinte — passez au forfait superieur"
                : `${Math.round(percentage)}% utilise — limite bientot atteinte`}
            </p>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-sm">{config.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface UsageMetersProps {
  usage: UsageSummary;
}

export function UsageMeters({ usage }: UsageMetersProps) {
  const metrics: UsageMetric[] = ["biens", "signatures", "utilisateurs", "stockage_mb"];

  return (
    <div className="space-y-5">
      {metrics.map((metric) => {
        const record = usage[metric];
        return (
          <UsageMeter
            key={metric}
            metric={metric}
            current={record.current_value}
            max={record.max_value}
            alertLevel={record.alert_level}
          />
        );
      })}
    </div>
  );
}
