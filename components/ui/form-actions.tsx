"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * FormActions - Responsive form action bar
 *
 * Mobile: sticky at bottom with safe area
 * Desktop: inline at the end of the form
 *
 * Usage:
 * ```tsx
 * <form>
 *   {/* form fields */}
 *   <FormActions>
 *     <Button variant="outline" type="button">Annuler</Button>
 *     <Button type="submit">Enregistrer</Button>
 *   </FormActions>
 * </form>
 * ```
 */
interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
  /** Stick to bottom on mobile (default: true) */
  sticky?: boolean;
  /** Alignment of the actions */
  align?: "start" | "center" | "end" | "between";
}

export function FormActions({
  children,
  className,
  sticky = true,
  align = "end",
}: FormActionsProps) {
  const alignClass = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
  }[align];

  if (!sticky) {
    return (
      <div className={cn("flex items-center gap-3 pt-6", alignClass, className)}>
        {children}
      </div>
    );
  }

  return (
    <>
      {/* Spacer to avoid content being hidden behind sticky bar on mobile */}
      <div className="h-20 md:hidden" aria-hidden="true" />
      <div
        className={cn(
          // Mobile: fixed at bottom
          "fixed bottom-0 left-0 right-0 z-30",
          "p-4 bg-background/95 backdrop-blur-sm border-t shadow-lg",
          "pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]",
          // Desktop: inline
          "md:static md:p-0 md:bg-transparent md:border-0 md:shadow-none md:backdrop-blur-none md:pt-6",
          // Layout
          "flex items-center gap-3",
          alignClass,
          className
        )}
      >
        {children}
      </div>
    </>
  );
}

/**
 * WizardStepActions - Actions for multi-step wizard forms
 *
 * Mobile: sticky bottom with step indicator
 * Desktop: inline
 */
interface WizardStepActionsProps {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isLastStep?: boolean;
  isSubmitting?: boolean;
  backLabel?: string;
  nextLabel?: string;
  submitLabel?: string;
  className?: string;
}

export function WizardStepActions({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSubmit,
  isLastStep = false,
  isSubmitting = false,
  backLabel = "Précédent",
  nextLabel = "Suivant",
  submitLabel = "Valider",
  className,
}: WizardStepActionsProps) {
  return (
    <>
      {/* Spacer on mobile */}
      <div className="h-24 md:hidden" aria-hidden="true" />
      <div
        className={cn(
          // Mobile: fixed bottom
          "fixed bottom-0 left-0 right-0 z-30",
          "px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] bg-background/95 backdrop-blur-sm border-t shadow-lg",
          // Desktop: inline
          "md:static md:px-0 md:pt-6 md:pb-0 md:bg-transparent md:border-0 md:shadow-none md:backdrop-blur-none",
          className
        )}
      >
        {/* Step indicator - Mobile only */}
        <div className="flex items-center justify-center gap-1.5 mb-3 md:hidden">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === currentStep
                  ? "w-6 bg-primary"
                  : i < currentStep
                  ? "w-1.5 bg-primary/50"
                  : "w-1.5 bg-muted-foreground/20"
              )}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={currentStep === 0}
            className={cn(
              "px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
              "min-h-[44px] min-w-[44px]",
              currentStep === 0
                ? "text-muted-foreground/50 cursor-not-allowed"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {backLabel}
          </button>

          {/* Step indicator - Desktop only */}
          <span className="hidden md:block text-sm text-muted-foreground">
            Étape {currentStep + 1} sur {totalSteps}
          </span>

          <button
            type={isLastStep ? "submit" : "button"}
            onClick={isLastStep ? onSubmit : onNext}
            disabled={isSubmitting}
            className={cn(
              "px-6 py-2.5 text-sm font-medium rounded-lg transition-colors",
              "min-h-[44px] min-w-[44px]",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-white border-t-transparent" />
                En cours...
              </span>
            ) : isLastStep ? (
              submitLabel
            ) : (
              nextLabel
            )}
          </button>
        </div>
      </div>
    </>
  );
}
