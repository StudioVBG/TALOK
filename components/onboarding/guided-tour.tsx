"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import type { UserRole } from "@/lib/types";

// Types
export interface TourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  spotlight?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface GuidedTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  currentStep?: number;
  onStepChange?: (step: number) => void;
}

// Tours prédéfinis par rôle
export const OWNER_TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    target: "[data-tour='dashboard']",
    title: "Votre tableau de bord",
    description: "Vue d'ensemble de tous vos biens, loyers et activités récentes. Tout est accessible en un coup d'oeil.",
    position: "bottom",
  },
  {
    id: "properties",
    target: "[data-tour='properties']",
    title: "Vos biens immobiliers",
    description: "Ajoutez et gérez tous vos logements ici. Chaque bien a sa propre fiche détaillée.",
    position: "right",
  },
  {
    id: "leases",
    target: "[data-tour='leases']",
    title: "Vos baux",
    description: "Créez des baux numériques, faites-les signer en ligne et suivez leur statut.",
    position: "right",
  },
  {
    id: "payments",
    target: "[data-tour='payments']",
    title: "Suivi des paiements",
    description: "Consultez les loyers reçus, les retards et générez les quittances automatiquement.",
    position: "right",
  },
  {
    id: "tickets",
    target: "[data-tour='tickets']",
    title: "Demandes de maintenance",
    description: "Vos locataires peuvent créer des tickets. Gérez les interventions facilement.",
    position: "right",
  },
  {
    id: "profile",
    target: "[data-tour='profile']",
    title: "Votre profil",
    description: "Complétez votre profil pour une meilleure expérience et des documents officiels corrects.",
    position: "left",
  },
];

export const TENANT_TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    target: "[data-tour='dashboard']",
    title: "Votre espace locataire",
    description: "Retrouvez toutes les informations de votre location en un seul endroit.",
    position: "bottom",
  },
  {
    id: "lease",
    target: "[data-tour='lease']",
    title: "Votre bail",
    description: "Consultez et signez votre bail directement en ligne.",
    position: "right",
  },
  {
    id: "payments",
    target: "[data-tour='payments']",
    title: "Paiement du loyer",
    description: "Payez votre loyer en quelques clics et téléchargez vos quittances.",
    position: "right",
  },
  {
    id: "tickets",
    target: "[data-tour='tickets']",
    title: "Signaler un problème",
    description: "Créez une demande de maintenance en cas de problème dans votre logement.",
    position: "right",
  },
  {
    id: "documents",
    target: "[data-tour='documents']",
    title: "Vos documents",
    description: "Retrouvez tous vos documents : bail, quittances, état des lieux...",
    position: "right",
  },
];

// Composant Spotlight (overlay avec trou)
function Spotlight({ targetRect }: { targetRect: DOMRect | null }) {
  if (!targetRect) return null;

  const padding = 8;
  const borderRadius = 12;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      <svg className="w-full h-full">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={targetRect.left - padding}
              y={targetRect.top - padding}
              width={targetRect.width + padding * 2}
              height={targetRect.height + padding * 2}
              rx={borderRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#spotlight-mask)"
        />
      </svg>
    </div>
  );
}

// Composant Tooltip du tour
function TourTooltip({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onClose,
  onComplete,
}: {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onComplete: () => void;
}) {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  // Calculer la position du tooltip
  const getPosition = () => {
    if (!targetRect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const margin = 16;

    let top: number;
    let left: number;

    switch (step.position) {
      case "top":
        top = targetRect.top - tooltipHeight - margin;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = targetRect.bottom + margin;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - margin;
        break;
      case "right":
      default:
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + margin;
        break;
    }

    // Ajuster si hors écran
    const maxTop = window.innerHeight - tooltipHeight - margin;
    const maxLeft = window.innerWidth - tooltipWidth - margin;

    top = Math.max(margin, Math.min(top, maxTop));
    left = Math.max(margin, Math.min(left, maxLeft));

    return { top: `${top}px`, left: `${left}px` };
  };

  const position = getPosition();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed z-[9999] w-80"
      style={position}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-white">
              {stepIndex + 1} / {totalSteps}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {step.title}
          </h3>
          <p className="text-sm text-slate-600 mb-4">{step.description}</p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === stepIndex
                    ? "w-6 bg-blue-500"
                    : i < stepIndex
                    ? "bg-blue-300"
                    : "bg-slate-200"
                )}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrev}
              disabled={isFirst}
              className="text-slate-500"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Précédent
            </Button>

            {isLast ? (
              <Button
                size="sm"
                onClick={onComplete}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Terminer
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onNext}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
              >
                Suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Arrow pointer */}
      {targetRect && (
        <div
          className={cn(
            "absolute w-3 h-3 bg-white border border-slate-200 rotate-45",
            step.position === "top" && "bottom-[-6px] left-1/2 -translate-x-1/2 border-t-0 border-l-0",
            step.position === "bottom" && "top-[-6px] left-1/2 -translate-x-1/2 border-b-0 border-r-0",
            step.position === "left" && "right-[-6px] top-1/2 -translate-y-1/2 border-l-0 border-b-0",
            step.position === "right" && "left-[-6px] top-1/2 -translate-y-1/2 border-r-0 border-t-0"
          )}
        />
      )}
    </motion.div>
  );
}

export function GuidedTour({
  steps,
  isOpen,
  onClose,
  onComplete,
  currentStep: controlledStep,
  onStepChange,
}: GuidedTourProps) {
  const [internalStep, setInternalStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  const currentStep = controlledStep ?? internalStep;
  const setCurrentStep = onStepChange ?? setInternalStep;

  // S'assurer qu'on est côté client pour le portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Trouver et observer l'élément cible
  useEffect(() => {
    if (!isOpen || !steps[currentStep]) return;

    const updateTargetRect = () => {
      const target = document.querySelector(steps[currentStep].target);
      if (target) {
        setTargetRect(target.getBoundingClientRect());

        // Scroll l'élément en vue si nécessaire
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setTargetRect(null);
      }
    };

    updateTargetRect();

    // Observer les changements de taille/position
    const resizeObserver = new ResizeObserver(updateTargetRect);
    const target = document.querySelector(steps[currentStep].target);
    if (target) {
      resizeObserver.observe(target);
    }

    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect);
    };
  }, [isOpen, currentStep, steps]);

  // Gestion du clavier
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (currentStep < steps.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          onComplete();
        }
      } else if (e.key === "ArrowLeft") {
        if (currentStep > 0) {
          setCurrentStep(currentStep - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStep, steps.length, setCurrentStep, onClose, onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, steps.length, setCurrentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, setCurrentStep]);

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-[9997]">
        {/* Spotlight overlay */}
        <Spotlight targetRect={targetRect} />

        {/* Click blocker */}
        <div
          className="fixed inset-0 z-[9998]"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Tooltip */}
        <TourTooltip
          step={steps[currentStep]}
          stepIndex={currentStep}
          totalSteps={steps.length}
          targetRect={targetRect}
          onNext={handleNext}
          onPrev={handlePrev}
          onClose={onClose}
          onComplete={handleComplete}
        />
      </div>
    </AnimatePresence>,
    document.body
  );
}

// Hook pour utiliser le tour guidé
export function useTour(role: UserRole) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = role === "owner" ? OWNER_TOUR_STEPS : TENANT_TOUR_STEPS;

  const startTour = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const closeTour = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    currentStep,
    steps,
    startTour,
    closeTour,
    setCurrentStep,
  };
}

export default GuidedTour;
