"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ConfidenceFieldProps {
  label: string;
  value?: string | number;
  onChange?: (value: string) => void;
  confidence: number;
  children?: React.ReactNode;
}

export function ConfidenceField({
  label,
  confidence,
  children,
}: ConfidenceFieldProps) {
  const isLowConfidence = confidence < 0.8;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {isLowConfidence && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400">
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>
      <div
        className={cn(
          "rounded-md",
          isLowConfidence && "ring-2 ring-orange-500/60"
        )}
      >
        {children}
      </div>
    </div>
  );
}
