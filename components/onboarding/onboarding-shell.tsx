"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Building2, Clock, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Step {
  id: string;
  label: string;
}

type OnboardingShellProps = {
  stepLabel: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  // Nouvelles props pour l'indicateur d'étape
  currentStep?: number;
  totalSteps?: number;
  steps?: Step[];
  estimatedMinutes?: number;
  showProgress?: boolean;
  // Option passer
  profileId?: string;
  role?: string;
  onSkip?: () => void;
};

// Composant barre de progression
function ProgressBar({ current, total }: { current: number; total: number }) {
  const percent = Math.round(((current) / total) * 100);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
        <span>{percent}% complété</span>
        <span>
          Étape {current + 1} / {total}
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
        />
      </div>
    </div>
  );
}

// Composant indicateur d'étapes horizontal
function StepIndicator({
  steps,
  currentStep,
}: {
  steps: Step[];
  currentStep: number;
}) {
  return (
    <div className="hidden sm:flex items-center justify-center gap-1 w-full max-w-2xl mx-auto">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isFuture = index > currentStep;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step dot */}
            <div className="flex flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.2 : 1,
                  backgroundColor: isCompleted
                    ? "#22c55e"
                    : isCurrent
                    ? "#3b82f6"
                    : "rgba(255,255,255,0.1)",
                }}
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                  isCompleted && "text-white",
                  isCurrent && "text-white ring-2 ring-blue-400/50",
                  isFuture && "text-slate-500"
                )}
              >
                {isCompleted ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </motion.div>
              <span
                className={cn(
                  "text-[10px] mt-1 whitespace-nowrap max-w-[60px] truncate",
                  isCurrent && "text-blue-400 font-medium",
                  isCompleted && "text-green-400",
                  isFuture && "text-slate-500"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {index < steps.length - 1 && (
              <div className="w-8 h-0.5 mx-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: isCompleted ? "100%" : "0%" }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-green-500"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OnboardingShell({
  stepLabel,
  title,
  subtitle,
  children,
  footer,
  currentStep = 0,
  totalSteps = 1,
  steps,
  estimatedMinutes,
  showProgress = true,
  profileId,
  role,
  onSkip,
}: OnboardingShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Background gradients */}
      <div className="absolute inset-0 opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(99,102,241,0.2),_transparent_60%)]" />
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col gap-8 px-4 pb-20 pt-12">
        {/* Step indicator / Progress bar */}
        {showProgress && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {steps && steps.length > 0 ? (
              <StepIndicator steps={steps} currentStep={currentStep} />
            ) : (
              <ProgressBar current={currentStep} total={totalSteps} />
            )}

            {/* Estimated time */}
            {estimatedMinutes && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                <span>Environ {estimatedMinutes} min restantes</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120 }}
          className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center px-4"
        >
          <Badge className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-white/10 backdrop-blur">
            {stepLabel}
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight break-words">
            {title}
          </h1>
          <p className="text-base sm:text-lg text-slate-300 break-words">
            {subtitle}
          </p>
        </motion.div>

        {/* Content card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 120 }}
          className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white shadow-2xl backdrop-blur"
        >
          {children}
        </motion.div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-4 text-sm text-slate-300">
          {footer}

          {/* Skip option */}
          {onSkip && (
            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors group"
            >
              <Clock className="w-4 h-4" />
              <span>Passer pour l'instant</span>
              <ChevronRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
            </button>
          )}

          {/* Support link */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>Besoin d'aide ? </span>
            <a
              href="mailto:support@talok.fr"
              className="text-white underline-offset-4 hover:underline"
            >
              support@talok.fr
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export le composant compact pour les pages internes
export function OnboardingProgress({
  currentStep,
  totalSteps,
  stepLabel,
  className,
}: {
  currentStep: number;
  totalSteps: number;
  stepLabel?: string;
  className?: string;
}) {
  const percent = Math.round(((currentStep) / totalSteps) * 100);

  return (
    <div className={cn("flex items-center gap-4 p-3 rounded-xl bg-slate-100 border", className)}>
      {/* Circular progress */}
      <div className="relative w-12 h-12">
        <svg className="w-12 h-12 transform -rotate-90">
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-slate-200"
          />
          <motion.circle
            cx="24"
            cy="24"
            r="20"
            stroke="url(#progressGradient)"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={125.6}
            initial={{ strokeDashoffset: 125.6 }}
            animate={{ strokeDashoffset: 125.6 - (125.6 * percent) / 100 }}
            transition={{ duration: 0.5 }}
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-700">
          {percent}%
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">
          Étape {currentStep + 1} sur {totalSteps}
        </p>
        {stepLabel && (
          <p className="text-xs text-slate-500 truncate">{stepLabel}</p>
        )}
      </div>
    </div>
  );
}

export default OnboardingShell;
