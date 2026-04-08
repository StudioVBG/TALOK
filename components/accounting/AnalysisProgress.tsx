"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AnalysisStatus =
  | "uploading"
  | "analyzing"
  | "detecting"
  | "extracting"
  | "completed"
  | "failed";

interface AnalysisProgressProps {
  status: AnalysisStatus;
}

const CHECKMARKS = [
  { key: "type", label: "Type detecte", delay: 1000 },
  { key: "montant", label: "Montant extrait", delay: 2000 },
  { key: "fournisseur", label: "Fournisseur identifie", delay: 3000 },
] as const;

export function AnalysisProgress({ status }: AnalysisProgressProps) {
  const [visibleChecks, setVisibleChecks] = useState<number>(0);

  useEffect(() => {
    if (status === "failed") return;

    const timers: NodeJS.Timeout[] = [];
    CHECKMARKS.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleChecks((prev) => Math.max(prev, index + 1));
      }, CHECKMARKS[index].delay);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [status]);

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Spinner */}
      <div className="relative">
        <Loader2 className="w-12 h-12 text-[#2563EB] animate-spin" />
      </div>

      <p className="text-sm text-muted-foreground font-medium">
        Analyse en cours...
      </p>

      {/* Progressive checkmarks */}
      <div className="space-y-3 w-full max-w-xs">
        {CHECKMARKS.map((item, index) => {
          const isVisible = visibleChecks > index;
          return (
            <div
              key={item.key}
              className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-500",
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full shrink-0 transition-colors",
                  isVisible
                    ? "bg-green-500/20 text-green-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm text-foreground">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
