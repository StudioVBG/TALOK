"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────

export interface ExportFormat {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "default" | "teal";
}

interface ExportCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  formats: ExportFormat[];
}

// ── Component ───────────────────────────────────────────────────────

export function ExportCard({ title, description, icon, formats }: ExportCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-primary mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground font-[family-name:var(--font-manrope)]">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-auto pt-1">
        {formats.map((fmt) => (
          <button
            key={fmt.label}
            type="button"
            onClick={fmt.onClick}
            disabled={fmt.loading || fmt.disabled}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              fmt.variant === "teal"
                ? "bg-teal-600 hover:bg-teal-500 text-white border-teal-500"
                : "bg-muted/50 hover:bg-muted text-foreground border-border"
            )}
          >
            {fmt.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {fmt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ExportCard;
