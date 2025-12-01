"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CircularProgress } from "@/components/ui/circular-progress";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { Check, ChevronLeft, Save, Sparkles, Home, MapPin, Settings2, LayoutGrid, Camera, FileCheck, Clock } from "lucide-react";
import { PreviewCard } from "./PreviewCard";

const STEP_CONFIG = [
  { key: "type_bien", label: "Type", icon: Home, duration: 1 },
  { key: "address", label: "Adresse", icon: MapPin, duration: 2 },
  { key: "details", label: "Détails", icon: Settings2, duration: 3 },
  { key: "rooms", label: "Pièces", icon: LayoutGrid, duration: 2 },
  { key: "photos", label: "Photos", icon: Camera, duration: 3 },
  { key: "recap", label: "Récap", icon: FileCheck, duration: 1 },
];

interface ImmersiveWizardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  stepIndex: number;
  totalSteps: number;
  canGoNext?: boolean;
  nextLabel?: string;
  backLabel?: string;
  onFinish?: () => void;
  hideSteps?: boolean;
  onNextStep?: () => void;
  onPrevStep?: () => void;
}

export function ImmersiveWizardLayout({
  children,
  title,
  subtitle,
  stepIndex,
  totalSteps,
  canGoNext = true,
  nextLabel = "Continuer",
  backLabel = "Retour",
  onFinish,
  hideSteps = false,
  onNextStep,
  onPrevStep,
}: ImmersiveWizardLayoutProps) {
  const { syncStatus, prevStep, nextStep, formData, rooms, photos } = usePropertyWizardStore();

  const applicableSteps = useMemo(() => STEP_CONFIG.slice(0, totalSteps), [totalSteps]);
  const estimatedTimeRemaining = useMemo(() => {
    return applicableSteps.slice(stepIndex - 1).reduce((acc, step) => acc + step.duration, 0);
  }, [applicableSteps, stepIndex]);
  const progressPercent = useMemo(() => Math.round((stepIndex / totalSteps) * 100), [stepIndex, totalSteps]);

  // Calcul des scores de complétion par étape
  const stepCompletionScores = useMemo(() => ({
    type_bien: formData.type ? 100 : 0,
    address: [formData.adresse_complete, formData.code_postal, formData.ville].filter(Boolean).length / 3 * 100,
    details: [formData.surface || formData.surface_habitable_m2, formData.loyer_hc].filter(v => v && v > 0).length / 2 * 100,
    rooms: rooms.length > 0 ? 100 : 0,
    photos: Math.min(photos.length * 25, 100),
    recap: 100,
  }), [formData, rooms, photos]);

  const handleNext = () => {
    if (onNextStep) { onNextStep(); return; }
    if (stepIndex === totalSteps && onFinish) { onFinish(); } 
    else { nextStep(); }
  };

  const handlePrev = () => {
    if (onPrevStep) { onPrevStep(); return; }
    prevStep();
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full bg-background overflow-hidden">
      
      {/* SIDEBAR - Responsive width */}
      {!hideSteps && (
        <aside className="hidden lg:flex w-64 xl:w-72 border-r bg-muted/5 p-4 flex-col relative flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <h1 className="text-base font-bold">Nouveau Bien</h1>
            </div>

            {/* Progress */}
            <div className="mb-3">
              <div className="flex justify-between items-center text-[11px] mb-1">
                <span className="font-medium">{progressPercent}% complété</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />~{estimatedTimeRemaining} min
                </span>
              </div>
              <Progress value={progressPercent} className="h-1" />
            </div>

            {/* Stepper - Avec indicateurs circulaires */}
            <div className="flex-1 space-y-0.5">
              {applicableSteps.map((step, idx) => {
                const isActive = idx + 1 === stepIndex;
                const isCompleted = idx + 1 < stepIndex;
                const StepIcon = step.icon;
                const completionScore = stepCompletionScores[step.key as keyof typeof stepCompletionScores] || 0;
                
                return (
                  <div 
                    key={step.key} 
                    className={`flex items-center gap-2 p-1.5 rounded-md transition-all
                      ${isActive ? "bg-primary/10" : ""}
                      ${isCompleted ? "opacity-60" : ""}
                    `}
                  >
                    {/* Indicateur circulaire avec icône */}
                    <CircularProgress
                      value={isCompleted ? 100 : completionScore}
                      size={28}
                      strokeWidth={2}
                      color={isCompleted ? "success" : isActive ? "primary" : "primary"}
                    >
                      <div className={`h-5 w-5 rounded flex items-center justify-center transition-colors
                        ${isActive ? "text-primary" : isCompleted ? "text-green-500" : "text-muted-foreground"}`}
                      >
                        {isCompleted ? <Check className="h-3 w-3" /> : <StepIcon className="h-3 w-3" />}
                      </div>
                    </CircularProgress>
                    <span className={`text-xs font-medium flex-1 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                    {!isCompleted && completionScore > 0 && completionScore < 100 && (
                      <span className="text-[9px] text-primary font-medium">{Math.round(completionScore)}%</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Preview Card - Aperçu en temps réel */}
            {formData.type && stepIndex > 1 && (
              <div className="mt-4 pt-4 border-t">
                <PreviewCard />
              </div>
            )}

            {/* Sync Status */}
            <div className="mt-auto pt-2">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background/50 p-2 rounded-md border">
                {syncStatus === 'saving' ? (
                  <><Save className="h-3 w-3 animate-pulse text-primary" />Sauvegarde...</>
                ) : syncStatus === 'saved' ? (
                  <><Check className="h-3 w-3 text-green-500" />Sauvegardé</>
                ) : (
                  <><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />Prêt</>
                )}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* MAIN - Flex grow to fill space */}
      <main className={`flex-1 flex flex-col min-w-0 ${hideSteps ? 'w-full' : ''}`}>
        {/* Mobile Progress */}
        <div className="lg:hidden h-1 w-full bg-muted flex-shrink-0">
          <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} />
        </div>

        {/* Content - Fills available space */}
        <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6">
          {/* Header - Fixed height */}
          <div className="flex-shrink-0 mb-4">
            <h2 className="text-lg md:text-xl font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>

          {/* Dynamic Content - Grows to fill space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={stepIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 p-3 border-t bg-background/95 backdrop-blur">
          <div className="flex justify-between items-center max-w-4xl mx-auto">
            <Button variant="ghost" size="sm" onClick={handlePrev} disabled={!onPrevStep && stepIndex === 1} className="h-8">
              <ChevronLeft className="h-4 w-4 mr-1" />{backLabel}
            </Button>
            <Button size="sm" onClick={handleNext} disabled={!canGoNext} className="h-8 rounded-full px-5">
              {nextLabel}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
