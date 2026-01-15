"use client";

import { motion } from "framer-motion";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
export interface Step {
  id: string;
  label: string;
  description?: string;
}

export interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps?: number[];
  variant?: "horizontal" | "vertical" | "compact";
  showLabels?: boolean;
  showEstimatedTime?: boolean;
  estimatedMinutes?: number;
  className?: string;
}

// Composant indicateur horizontal
function HorizontalIndicator({
  steps,
  currentStep,
  completedSteps = [],
  showLabels,
}: {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  showLabels?: boolean;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = index === currentStep;
          const isPast = index < currentStep;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <div className="relative flex flex-col items-center">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                    backgroundColor: isCompleted
                      ? "#22c55e"
                      : isCurrent
                      ? "#3b82f6"
                      : "#e2e8f0",
                  }}
                  className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all",
                    isCompleted || isCurrent ? "text-white" : "text-slate-500"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </motion.div>

                {/* Label */}
                {showLabels && (
                  <span
                    className={cn(
                      "absolute top-full mt-2 text-xs font-medium whitespace-nowrap max-w-[80px] truncate text-center",
                      isCurrent
                        ? "text-blue-600"
                        : isCompleted
                        ? "text-green-600"
                        : "text-slate-500"
                    )}
                  >
                    {step.label}
                  </span>
                )}
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-1 mx-2 sm:mx-4 rounded-full bg-slate-200 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: isPast || isCompleted ? "100%" : "0%",
                    }}
                    transition={{ duration: 0.3 }}
                    className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Composant indicateur vertical
function VerticalIndicator({
  steps,
  currentStep,
  completedSteps = [],
  showLabels,
}: {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  showLabels?: boolean;
}) {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(index);
        const isCurrent = index === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex">
            {/* Step indicator column */}
            <div className="flex flex-col items-center mr-4">
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  backgroundColor: isCompleted
                    ? "#22c55e"
                    : isCurrent
                    ? "#3b82f6"
                    : "#e2e8f0",
                }}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                  isCompleted || isCurrent ? "text-white" : "text-slate-500"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </motion.div>

              {/* Connector line */}
              {!isLast && (
                <div className="w-0.5 flex-1 min-h-[40px] bg-slate-200 my-2">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{
                      height: isCompleted ? "100%" : "0%",
                    }}
                    transition={{ duration: 0.3 }}
                    className="w-full bg-green-500"
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div className={cn("pb-8", isLast && "pb-0")}>
              <h4
                className={cn(
                  "font-medium",
                  isCurrent
                    ? "text-blue-600"
                    : isCompleted
                    ? "text-green-600"
                    : "text-slate-700"
                )}
              >
                {step.label}
              </h4>
              {step.description && showLabels && (
                <p className="text-sm text-slate-500 mt-1">{step.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Composant indicateur compact (badge style)
function CompactIndicator({
  steps,
  currentStep,
  completedSteps = [],
  estimatedMinutes,
}: {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  estimatedMinutes?: number;
}) {
  const progressPercent = Math.round(
    ((completedSteps.length + (currentStep === completedSteps.length ? 0.5 : 0)) /
      steps.length) *
      100
  );

  return (
    <div className="flex items-center gap-4">
      {/* Badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
        <span className="text-sm font-medium text-blue-700">
          Étape {currentStep + 1}/{steps.length}
        </span>
        <span className="text-xs text-blue-500">• {steps[currentStep]?.label}</span>
      </div>

      {/* Progress bar mini */}
      <div className="hidden sm:flex items-center gap-2">
        <div className="w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
          />
        </div>
        <span className="text-xs font-medium text-slate-500">
          {progressPercent}%
        </span>
      </div>

      {/* Estimated time */}
      {estimatedMinutes && (
        <div className="hidden md:flex items-center gap-1 text-xs text-slate-500">
          <Clock className="w-3 h-3" />
          <span>~{estimatedMinutes} min restantes</span>
        </div>
      )}
    </div>
  );
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps = [],
  variant = "horizontal",
  showLabels = true,
  showEstimatedTime = false,
  estimatedMinutes,
  className,
}: StepIndicatorProps) {
  // Calculer les étapes complétées si non fournies
  const completed =
    completedSteps.length > 0
      ? completedSteps
      : Array.from({ length: currentStep }, (_, i) => i);

  return (
    <div className={cn("w-full", className)}>
      {variant === "horizontal" && (
        <HorizontalIndicator
          steps={steps}
          currentStep={currentStep}
          completedSteps={completed}
          showLabels={showLabels}
        />
      )}

      {variant === "vertical" && (
        <VerticalIndicator
          steps={steps}
          currentStep={currentStep}
          completedSteps={completed}
          showLabels={showLabels}
        />
      )}

      {variant === "compact" && (
        <CompactIndicator
          steps={steps}
          currentStep={currentStep}
          completedSteps={completed}
          estimatedMinutes={estimatedMinutes}
        />
      )}

      {/* Estimated time pour horizontal */}
      {variant === "horizontal" && showEstimatedTime && estimatedMinutes && (
        <div className="flex items-center justify-center gap-1 mt-8 text-xs text-slate-500">
          <Clock className="w-3 h-3" />
          <span>Environ {estimatedMinutes} minutes restantes</span>
        </div>
      )}
    </div>
  );
}

// Export par défaut pour les étapes d'onboarding par rôle
export const ONBOARDING_STEPS = {
  owner: [
    { id: "profile", label: "Profil", description: "Vos informations personnelles" },
    { id: "finance", label: "Finances", description: "Coordonnées bancaires" },
    { id: "property", label: "Bien", description: "Votre premier logement" },
    { id: "automation", label: "Automatisation", description: "Préférences" },
    { id: "invite", label: "Invitations", description: "Inviter des locataires" },
    { id: "review", label: "Validation", description: "Vérification finale" },
  ],
  tenant: [
    { id: "context", label: "Contexte", description: "Type de location" },
    { id: "file", label: "Dossier", description: "Vos documents" },
    { id: "identity", label: "Identité", description: "Vérification" },
    { id: "payment", label: "Paiement", description: "Mode de paiement" },
    { id: "sign", label: "Signature", description: "Signer le bail" },
  ],
  provider: [
    { id: "profile", label: "Profil", description: "Vos informations" },
    { id: "services", label: "Services", description: "Vos prestations" },
    { id: "ops", label: "Zone", description: "Zone d'intervention" },
    { id: "review", label: "Validation", description: "Vérification" },
  ],
  guarantor: [
    { id: "context", label: "Identité", description: "Vos informations" },
    { id: "financial", label: "Finances", description: "Votre capacité" },
    { id: "sign", label: "Signature", description: "Acte de caution" },
  ],
};

export default StepIndicator;
