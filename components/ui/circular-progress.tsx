"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
  showValue?: boolean;
  color?: "primary" | "success" | "warning" | "destructive";
}

export function CircularProgress({
  value,
  size = 36,
  strokeWidth = 3,
  className,
  children,
  showValue = false,
  color = "primary",
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const colorClasses = {
    primary: "stroke-primary",
    success: "stroke-green-500",
    warning: "stroke-amber-500",
    destructive: "stroke-destructive",
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-500 ease-out", colorClasses[color])}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (showValue && (
          <span className="text-[10px] font-bold">{Math.round(value)}%</span>
        ))}
      </div>
    </div>
  );
}

