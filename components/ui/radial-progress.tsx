"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RadialProgressProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: "primary" | "success" | "warning" | "destructive" | "info";
  label?: string;
  showValue?: boolean;
  className?: string;
  animate?: boolean;
}

const colorMap = {
  primary: {
    stroke: "stroke-blue-500",
    text: "text-blue-600",
  },
  success: {
    stroke: "stroke-emerald-500",
    text: "text-emerald-600",
  },
  warning: {
    stroke: "stroke-amber-500",
    text: "text-amber-600",
  },
  destructive: {
    stroke: "stroke-red-500",
    text: "text-red-600",
  },
  info: {
    stroke: "stroke-cyan-500",
    text: "text-cyan-600",
  },
};

export function RadialProgress({
  value,
  size = 120,
  strokeWidth = 10,
  color = "primary",
  label,
  showValue = true,
  className,
  animate = true,
}: RadialProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const normalizedValue = Math.min(100, Math.max(0, value));
  const offset = circumference - (normalizedValue / 100) * circumference;

  const colors = colorMap[color];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Progress circle */}
        {animate ? (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={colors.stroke}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            style={{
              strokeDasharray: circumference,
            }}
          />
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={colors.stroke}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        )}
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {animate ? (
            <motion.span
              className={cn("text-2xl font-bold", colors.text)}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.3 }}
            >
              {normalizedValue}%
            </motion.span>
          ) : (
            <span className={cn("text-2xl font-bold", colors.text)}>
              {normalizedValue}%
            </span>
          )}
          {label && (
            <span className="text-xs text-muted-foreground mt-1">{label}</span>
          )}
        </div>
      )}
    </div>
  );
}

