"use client";

/**
 * ScoreGauge - Jauge de score circulaire animée
 * Design SOTA 2025 avec glassmorphism et animations fluides
 * 
 * Sources design:
 * - Apple Human Interface Guidelines 2024
 * - Material Design 3.0
 * - Vercel Design System
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { diameter: 80, strokeWidth: 6, fontSize: "text-lg" },
  md: { diameter: 120, strokeWidth: 8, fontSize: "text-2xl" },
  lg: { diameter: 180, strokeWidth: 10, fontSize: "text-4xl" },
  xl: { diameter: 240, strokeWidth: 12, fontSize: "text-5xl" },
};

function getScoreColor(score: number): { primary: string; glow: string; bg: string } {
  if (score >= 80) {
    return {
      primary: "#10b981", // emerald-500
      glow: "rgba(16, 185, 129, 0.4)",
      bg: "rgba(16, 185, 129, 0.1)",
    };
  }
  if (score >= 60) {
    return {
      primary: "#f59e0b", // amber-500
      glow: "rgba(245, 158, 11, 0.4)",
      bg: "rgba(245, 158, 11, 0.1)",
    };
  }
  if (score >= 40) {
    return {
      primary: "#f97316", // orange-500
      glow: "rgba(249, 115, 22, 0.4)",
      bg: "rgba(249, 115, 22, 0.1)",
    };
  }
  return {
    primary: "#ef4444", // red-500
    glow: "rgba(239, 68, 68, 0.4)",
    bg: "rgba(239, 68, 68, 0.1)",
  };
}

function getScoreLabel(score: number): { label: string; emoji: string } {
  if (score >= 80) return { label: "Excellent", emoji: "✨" };
  if (score >= 60) return { label: "Bon", emoji: "👍" };
  if (score >= 40) return { label: "À étudier", emoji: "⚠️" };
  return { label: "Risqué", emoji: "🚨" };
}

export function ScoreGauge({
  score,
  size = "lg",
  showLabel = true,
  animated = true,
  className,
}: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const config = sizeConfig[size];
  const colors = getScoreColor(score);
  const { label, emoji } = getScoreLabel(score);

  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  // Animation du score
  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }

    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(score, Math.round(increment * step));
      setDisplayScore(current);

      if (step >= steps) {
        clearInterval(timer);
        setDisplayScore(score);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score, animated]);

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ backgroundColor: colors.glow }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.6, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />

      {/* SVG Gauge */}
      <div
        className="relative"
        style={{ width: config.diameter, height: config.diameter }}
      >
        <svg
          width={config.diameter}
          height={config.diameter}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-muted/20"
          />

          {/* Animated progress circle */}
          <motion.circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke={colors.primary}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{
              duration: animated ? 1.5 : 0,
              ease: [0.4, 0, 0.2, 1],
            }}
            style={{
              filter: `drop-shadow(0 0 8px ${colors.glow})`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={cn(
              "font-bold tabular-nums tracking-tight",
              config.fontSize
            )}
            style={{ color: colors.primary }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5, ease: "backOut" }}
          >
            {displayScore}
          </motion.span>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">
            / 100
          </span>
        </div>
      </div>

      {/* Label */}
      <AnimatePresence>
        {showLabel && (
          <motion.div
            className="mt-4 flex items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: 0.5 }}
          >
            <span className="text-2xl">{emoji}</span>
            <span
              className="font-semibold text-lg"
              style={{ color: colors.primary }}
            >
              {label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

