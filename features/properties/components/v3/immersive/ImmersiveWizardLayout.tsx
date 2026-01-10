"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CircularProgress } from "@/components/ui/circular-progress";
import { usePropertyWizardStore, WizardStep } from "@/features/properties/stores/wizard-store";
import {
  Check, ChevronLeft, ChevronDown, ChevronUp, Save, Sparkles, Home, MapPin,
  Settings2, LayoutGrid, Camera, FileCheck, Clock, Building, Star, Wrench, CalendarDays
} from "lucide-react";
import { PreviewCard } from "./PreviewCard";
import { cn } from "@/lib/utils";

// SOTA 2026: Configuration des étapes avec tous les nouveaux steps
const STEP_CONFIG: Array<{ key: WizardStep; label: string; labelShort: string; icon: React.ElementType; duration: number }> = [
  { key: "type_bien", label: "Type de bien", labelShort: "Type", icon: Home, duration: 1 },
  { key: "address", label: "Adresse", labelShort: "Adresse", icon: MapPin, duration: 2 },
  { key: "building_config", label: "Configuration immeuble", labelShort: "Immeuble", icon: Building, duration: 4 },
  { key: "details", label: "Caractéristiques", labelShort: "Détails", icon: Settings2, duration: 3 },
  { key: "rooms", label: "Pièces & Espaces", labelShort: "Pièces", icon: LayoutGrid, duration: 2 },
  { key: "photos", label: "Photos", labelShort: "Photos", icon: Camera, duration: 3 },
  { key: "features", label: "Équipements", labelShort: "Équip.", icon: Star, duration: 2 },
  { key: "publish", label: "Publication", labelShort: "Publier", icon: CalendarDays, duration: 1 },
  { key: "recap", label: "Récapitulatif", labelShort: "Récap", icon: FileCheck, duration: 1 },
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
  const { syncStatus, prevStep, nextStep, formData, rooms, photos, currentStep } = usePropertyWizardStore();

  // SOTA 2026: État pour le panneau mobile dépliable
  const [mobileStepsExpanded, setMobileStepsExpanded] = useState(false);

  // SOTA 2026: Filtrer les étapes selon le contexte actuel
  const applicableSteps = useMemo(() => {
    // Trouver les étapes qui correspondent aux index
    return STEP_CONFIG.filter((_, idx) => idx < totalSteps);
  }, [totalSteps]);

  const currentStepConfig = useMemo(() => {
    return STEP_CONFIG.find(s => s.key === currentStep) || STEP_CONFIG[0];
  }, [currentStep]);

  const estimatedTimeRemaining = useMemo(() => {
    const currentIdx = applicableSteps.findIndex(s => s.key === currentStep);
    return applicableSteps.slice(currentIdx).reduce((acc, step) => acc + step.duration, 0);
  }, [applicableSteps, currentStep]);

  const progressPercent = useMemo(() => Math.round((stepIndex / totalSteps) * 100), [stepIndex, totalSteps]);

  // SOTA 2026: Calcul des scores de complétion par étape
  const stepCompletionScores = useMemo(() => ({
    type_bien: formData.type ? 100 : 0,
    address: [formData.adresse_complete, formData.code_postal, formData.ville].filter(Boolean).length / 3 * 100,
    building_config: (formData.building_units?.length || 0) > 0 ? 100 : ((formData.building_floors || 0) > 0 ? 50 : 0),
    details: [formData.surface || formData.surface_habitable_m2, formData.loyer_hc].filter(v => v && Number(v) > 0).length / 2 * 100,
    rooms: rooms.length > 0 ? 100 : 0,
    photos: Math.min(photos.length * 25, 100),
    features: (formData.equipments?.length || 0) > 0 ? 100 : 0,
    publish: formData.visibility ? 100 : 0,
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
    // SOTA 2026: Utiliser 100dvh pour support mobile + safe area
    <div className="flex h-[calc(100dvh-64px)] w-full bg-background overflow-hidden">
      
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
        {/* SOTA 2026: Indicateur de progression mobile amélioré */}
        <div className="lg:hidden flex-shrink-0 border-b bg-background/95 backdrop-blur-sm">
          {/* Barre de progression */}
          <div className="h-1 w-full bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Header mobile cliquable */}
          <button
            onClick={() => setMobileStepsExpanded(!mobileStepsExpanded)}
            className="w-full px-4 py-2.5 flex items-center justify-between touch-manipulation"
            aria-expanded={mobileStepsExpanded}
            aria-label="Afficher les étapes"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <currentStepConfig.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">{currentStepConfig.label}</p>
                <p className="text-xs text-muted-foreground">
                  Étape {stepIndex}/{totalSteps} • ~{estimatedTimeRemaining} min
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary">{progressPercent}%</span>
              {mobileStepsExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
          </button>

          {/* Liste des étapes dépliable */}
          <AnimatePresence>
            {mobileStepsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t bg-muted/30"
              >
                <div className="px-4 py-2 space-y-1">
                  {applicableSteps.map((step, idx) => {
                    const isActive = idx + 1 === stepIndex;
                    const isCompleted = idx + 1 < stepIndex;
                    const StepIcon = step.icon;
                    const score = stepCompletionScores[step.key as keyof typeof stepCompletionScores] || 0;

                    return (
                      <div
                        key={step.key}
                        className={cn(
                          "flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors",
                          isActive && "bg-primary/10",
                          isCompleted && "opacity-60"
                        )}
                      >
                        <div className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-xs",
                          isCompleted ? "bg-green-500 text-white" :
                          isActive ? "bg-primary text-white" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {isCompleted ? (
                            <Check className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <StepIcon className="h-3 w-3" aria-hidden="true" />
                          )}
                        </div>
                        <span className={cn(
                          "text-sm flex-1",
                          isActive ? "font-medium" : "text-muted-foreground"
                        )}>
                          {step.labelShort}
                        </span>
                        {!isCompleted && score > 0 && score < 100 && (
                          <span className="text-[10px] text-primary font-medium">{Math.round(score)}%</span>
                        )}
                        {isCompleted && (
                          <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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

        {/* Footer - Fixed avec safe area pour iOS */}
        <div className="flex-shrink-0 p-3 pb-safe border-t bg-background/95 backdrop-blur lg:pb-3">
          <div className="flex justify-between items-center max-w-4xl mx-auto">
            <Button variant="ghost" size="sm" onClick={handlePrev} disabled={!onPrevStep && stepIndex === 1} className="h-10 touch-target">
              <ChevronLeft className="h-4 w-4 mr-1" />{backLabel}
            </Button>
            <Button size="sm" onClick={handleNext} disabled={!canGoNext} className="h-10 rounded-full px-5 touch-target">
              {nextLabel}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
