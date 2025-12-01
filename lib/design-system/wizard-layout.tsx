"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Zap, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

type WizardMode = "fast" | "full" | "unified";

interface WizardStepLayoutProps {
  // Header
  title: string;
  description?: string;
  stepNumber: number;
  totalSteps: number;
  
  // Mode
  mode?: WizardMode;
  onModeChange?: (mode: WizardMode) => void;
  
  // Progress
  progressValue: number;
  
  // Footer
  onBack?: () => void;
  onNext?: () => void;
  canGoNext?: boolean;
  nextLabel?: string;
  backLabel?: string;
  microCopy?: string;
  
  // Content
  children: React.ReactNode;
  
  // Options
  showModeSwitch?: boolean;
  className?: string;
}

export function WizardStepLayout({
  title,
  description,
  stepNumber,
  totalSteps,
  mode = "full",
  onModeChange,
  progressValue,
  onBack,
  onNext,
  canGoNext = true,
      nextLabel = "Suivant",
  backLabel = "Précédent",
  microCopy,
  children,
  showModeSwitch = true,
  className,
}: WizardStepLayoutProps) {
  return (
    <div className={cn("mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pb-24", className)}>
      {/* Sticky Header with Mode Toggle */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {showModeSwitch && onModeChange && (
            <ModeSwitch value={mode} onChange={onModeChange} />
          )}
        </div>

        {/* Sticky Progress */}
        <ProgressLinear 
          value={progressValue} 
          label={`Étape ${stepNumber} sur ${totalSteps}`} 
        />
      </div>

      {/* Content */}
      <div className="mt-8">
        {children}
      </div>

      {/* Sticky Footer */}
      <StickyFooter
        onBack={onBack}
        onNext={onNext}
        canGoNext={canGoNext}
        nextLabel={nextLabel}
        backLabel={backLabel}
        microCopy={microCopy}
      />
    </div>
  );
}

function ModeSwitch({
  value = "full",
  onChange,
}: { value?: WizardMode; onChange?: (v: WizardMode) => void }) {
  return (
    <div className="inline-flex select-none items-center rounded-full border p-1 text-xs bg-muted/50">
      <button
        type="button"
        className={cn(
          "rounded-full px-3 py-1.5 transition-all min-h-[44px] min-w-[44px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          value === "fast" 
            ? "bg-primary text-primary-foreground shadow-sm" 
            : "hover:bg-muted text-muted-foreground"
        )}
        onClick={() => onChange?.("fast")}
        aria-pressed={value === "fast"}
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
          value === "full" 
            ? "bg-primary text-primary-foreground shadow-sm" 
            : "hover:bg-muted text-muted-foreground"
        )}
        onClick={() => onChange?.("full")}
        aria-pressed={value === "full"}
        aria-label="Mode complet"
      >
        <Settings className="inline h-3 w-3 mr-1" />
        Complet
      </button>
    </div>
  );
}

function ProgressLinear({ value, label }: { value: number; label?: string }) {
  const reducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion ?? false;

  return (
    <div className="flex items-center gap-3 mt-3">
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-2 rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ 
            duration: shouldReduceMotion ? 0 : 0.4, 
            ease: "easeOut" 
          }}
        />
      </div>
      {label && (
        <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
          {label}
        </span>
      )}
    </div>
  );
}

function StickyFooter({
  onBack,
  onNext,
  canGoNext = true,
      nextLabel = "Suivant",
  backLabel = "Précédent",
  microCopy,
}: {
  onBack?: () => void;
  onNext?: () => void;
  canGoNext?: boolean;
  nextLabel?: string;
  backLabel?: string;
  microCopy?: string;
}) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion ?? false;

  // Prefetch next step on hover/focus of Continue button
  const handleContinueHover = () => {
    if (typeof window !== "undefined" && canGoNext) {
      router.prefetch("/app/owner/properties/new?step=adresse");
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div className="pointer-events-auto mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-4 pb-safe">
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
          className="rounded-2xl border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg"
        >
          <div className="flex flex-col items-stretch gap-3 p-3 sm:flex-row sm:items-center">
            {microCopy && (
              <p className="text-xs text-muted-foreground">{microCopy}</p>
            )}
            <div className="ml-auto flex items-center gap-2">
              {onBack && (
                <Button 
                  variant="ghost" 
                  onClick={onBack}
                  className="min-h-[44px] min-w-[44px]"
                >
                  {backLabel}
                </Button>
              )}
              {onNext && (
                <Button
                  disabled={!canGoNext}
                  onClick={onNext}
                  onMouseEnter={handleContinueHover}
                  onFocus={handleContinueHover}
                  className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {nextLabel}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

