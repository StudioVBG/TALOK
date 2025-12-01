"use client";

/**
 * ScoreFactorCard - Carte de facteur de scoring
 * Design SOTA 2025 avec glassmorphism et micro-interactions
 */

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { ScoreFactor } from "@/lib/scoring/types";

interface ScoreFactorCardProps {
  factor: ScoreFactor;
  index?: number;
  expanded?: boolean;
  onClick?: () => void;
}

const statusConfig = {
  pass: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  fail: {
    icon: XCircle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    gradient: "from-red-500/20 to-red-500/5",
  },
};

function getScoreTrend(score: number): { icon: typeof TrendingUp; label: string } {
  if (score >= 80) return { icon: TrendingUp, label: "Excellent" };
  if (score >= 50) return { icon: Minus, label: "Moyen" };
  return { icon: TrendingDown, label: "Faible" };
}

export function ScoreFactorCard({
  factor,
  index = 0,
  expanded = false,
  onClick,
}: ScoreFactorCardProps) {
  const config = statusConfig[factor.status];
  const StatusIcon = config.icon;
  const { icon: TrendIcon, label: trendLabel } = getScoreTrend(factor.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.1,
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border backdrop-blur-sm",
        "cursor-pointer transition-all duration-300",
        "hover:shadow-lg hover:shadow-black/5",
        config.borderColor,
        config.bgColor
      )}
    >
      {/* Gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50",
          config.gradient
        )}
      />

      {/* Content */}
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left side */}
          <div className="flex items-start gap-4 flex-1">
            {/* Status icon */}
            <motion.div
              className={cn(
                "flex-shrink-0 p-2.5 rounded-xl",
                config.bgColor
              )}
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.4 }}
            >
              <StatusIcon className={cn("w-5 h-5", config.color)} />
            </motion.div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-base">
                {factor.name}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {factor.description}
              </p>
            </div>
          </div>

          {/* Right side - Score */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  config.color
                )}
              >
                {factor.score}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>

            {/* Trend indicator */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendIcon className="w-3 h-3" />
              <span>{trendLabel}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 bg-muted/30 rounded-full overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full", config.bgColor)}
            style={{ backgroundColor: config.color.replace("text-", "") }}
            initial={{ width: 0 }}
            animate={{ width: `${factor.score}%` }}
            transition={{
              delay: 0.2 + index * 0.1,
              duration: 0.8,
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        </div>

        {/* Weight indicator */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Poids: {Math.round(factor.weight * 100)}%</span>
          <span>
            Contribution: +{factor.weightedScore.toFixed(1)} pts
          </span>
        </div>

        {/* Expand indicator */}
        <motion.div
          className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
          animate={{ x: expanded ? 0 : [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </div>
    </motion.div>
  );
}

