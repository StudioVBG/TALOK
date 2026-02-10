"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { AlertLevel, UsageMetric } from "@/types/billing";

const METRIC_LABELS: Record<UsageMetric, string> = {
  biens: "biens immobiliers",
  signatures: "signatures electroniques",
  utilisateurs: "utilisateurs",
  stockage_mb: "stockage",
};

interface UsageAlertProps {
  metric: UsageMetric;
  level: AlertLevel;
  current: number;
  max: number;
}

export function UsageAlert({ metric, level, current, max }: UsageAlertProps) {
  if (level === "normal") return null;

  const label = METRIC_LABELS[metric];

  const messages: Record<Exclude<AlertLevel, "normal">, string> = {
    warning: `Vous approchez de la limite de ${label} (${current}/${max})`,
    critical: `Limite de ${label} presque atteinte (${current}/${max})`,
    exceeded: `Limite de ${label} atteinte — Passez au forfait superieur`,
  };

  const styles: Record<Exclude<AlertLevel, "normal">, string> = {
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    critical: "bg-orange-500/10 border-orange-500/30 text-orange-300",
    exceeded: "bg-red-500/10 border-red-500/30 text-red-300",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("p-3 rounded-lg border flex items-center gap-3", styles[level])}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <p className="text-sm flex-1">{messages[level]}</p>
      {(level === "critical" || level === "exceeded") && (
        <Button size="sm" className="bg-violet-600 hover:bg-violet-500 flex-shrink-0" asChild>
          <Link href="/pricing">
            <ArrowUpRight className="w-3 h-3 mr-1" aria-hidden="true" />
            Upgrader
          </Link>
        </Button>
      )}
    </motion.div>
  );
}

interface UsageAlertBannerProps {
  items: { metric: UsageMetric; level: AlertLevel; current: number; max: number }[];
}

export function UsageAlertBanner({ items }: UsageAlertBannerProps) {
  const critical = items.filter((i) => i.level === "critical" || i.level === "exceeded");
  if (critical.length === 0) return null;

  return (
    <div className="space-y-2" aria-live="polite">
      {critical.map((item) => (
        <UsageAlert
          key={item.metric}
          metric={item.metric}
          level={item.level}
          current={item.current}
          max={item.max}
        />
      ))}
    </div>
  );
}
