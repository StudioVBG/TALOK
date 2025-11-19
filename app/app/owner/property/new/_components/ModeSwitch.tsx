"use client";

import { Button } from "@/components/ui/button";
import { Zap, Settings } from "lucide-react";
import { useNewProperty } from "../_store/useNewProperty";
import { cn } from "@/lib/utils";

export default function ModeSwitch() {
  const { mode, setMode } = useNewProperty();

  return (
    <div className="inline-flex select-none items-center rounded-full border p-1 text-xs bg-muted/50">
      <button
        type="button"
        className={cn(
          "rounded-full px-3 py-1.5 transition-all min-h-[44px] min-w-[44px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          mode === "FAST" 
            ? "bg-primary text-primary-foreground shadow-sm" 
            : "hover:bg-muted text-muted-foreground"
        )}
        onClick={() => setMode("FAST")}
        aria-pressed={mode === "FAST"}
        aria-label="Mode rapide"
      >
        <Zap className="inline h-3 w-3 mr-1" />
        Rapide
      </button>
      <button
        type="button"
        className={cn(
          "rounded-full px-3 py-1.5 transition-all min-h-[44px] min-w-[44px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          mode === "FULL" 
            ? "bg-primary text-primary-foreground shadow-sm" 
            : "hover:bg-muted text-muted-foreground"
        )}
        onClick={() => setMode("FULL")}
        aria-pressed={mode === "FULL"}
        aria-label="Mode complet"
      >
        <Settings className="inline h-3 w-3 mr-1" />
        Complet
      </button>
    </div>
  );
}

