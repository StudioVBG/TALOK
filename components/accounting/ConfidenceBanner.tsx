"use client";

import { Check, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfidenceBannerProps {
  score: number;
}

export function ConfidenceBanner({ score }: ConfidenceBannerProps) {
  const config = getConfig(score);

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium",
        config.className
      )}
    >
      <config.icon className="w-4 h-4 shrink-0" />
      <span>{config.message}</span>
      <span className="ml-auto text-xs opacity-80">{score}%</span>
    </div>
  );
}

function getConfig(score: number) {
  if (score >= 90) {
    return {
      icon: Check,
      message: "Pret a valider",
      className: "bg-green-500/15 text-green-400 border border-green-500/30",
    };
  }
  if (score >= 70) {
    return {
      icon: AlertTriangle,
      message: "Verifiez les informations",
      className: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    };
  }
  return {
    icon: XCircle,
    message: "Saisie manuelle recommandee",
    className: "bg-red-500/15 text-red-400 border border-red-500/30",
  };
}
