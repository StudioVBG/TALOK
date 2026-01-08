"use client";

/**
 * SOTA 2026 - Tour Guidé d'Onboarding Interactif
 * 
 * Fonctionnalités:
 * - Étapes guidées avec highlight des éléments
 * - Progression persistée en localStorage
 * - Tooltips animés avec Framer Motion
 * - Actions contextuelles
 * - Skip et navigation libre
 */

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  Building2,
  FileText,
  Euro,
  ClipboardCheck,
  Users,
  HelpCircle,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface TourStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector
  position?: "top" | "bottom" | "left" | "right" | "center";
  icon?: React.ComponentType<{ className?: string }>;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  highlight?: boolean;
}

interface OnboardingTourContextValue {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  hasCompletedTour: boolean;
  resetTour: () => void;
}

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(null);

export function useOnboardingTour() {
  const context = useContext(OnboardingTourContext);
  if (!context) {
    throw new Error("useOnboardingTour must be used within OnboardingTourProvider");
  }
  return context;
}

// Étapes du tour pour les propriétaires
const ownerTourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Bienvenue sur Talok ! 🎉",
    description: "Découvrez comment gérer vos biens locatifs simplement et efficacement. Ce tour rapide vous montrera les fonctionnalités essentielles.",
    position: "center",
    icon: Sparkles,
  },
  {
    id: "dashboard",
    title: "Votre Tableau de Bord",
    description: "Ici, vous voyez en un coup d'œil vos revenus, vos biens, et les actions urgentes. Les données se mettent à jour en temps réel.",
    target: "[data-tour='dashboard-header']",
    position: "bottom",
    icon: Rocket,
  },
  {
    id: "properties",
    title: "Vos Biens Immobiliers",
    description: "Ajoutez et gérez tous vos biens : appartements, maisons, parkings. Chaque bien a sa fiche détaillée avec diagnostics et documents.",
    target: "[data-tour='nav-properties']",
    position: "right",
    icon: Building2,
    action: {
      label: "Ajouter mon premier bien",
      href: "/owner/properties/new",
    },
  },
  {
    id: "leases",
    title: "Baux & Locataires",
    description: "Créez des baux conformes, invitez vos locataires à signer électroniquement, et gérez la colocation facilement.",
    target: "[data-tour='nav-leases']",
    position: "right",
    icon: FileText,
    action: {
      label: "Créer un bail",
      href: "/owner/leases/new",
    },
  },
  {
    id: "money",
    title: "Loyers & Revenus",
    description: "Suivez vos paiements, générez des quittances automatiquement, et gérez les impayés. Export fiscal inclus !",
    target: "[data-tour='nav-money']",
    position: "right",
    icon: Euro,
  },
  {
    id: "inspections",
    title: "États des Lieux",
    description: "Réalisez des EDL numériques avec photos, signatures électroniques et génération PDF automatique. Valeur juridique garantie.",
    target: "[data-tour='nav-inspections']",
    position: "right",
    icon: ClipboardCheck,
  },
  {
    id: "command-palette",
    title: "Navigation Rapide (⌘K)",
    description: "Appuyez sur ⌘K (ou Ctrl+K) à tout moment pour accéder rapidement à n'importe quelle page ou action.",
    target: "[data-tour='search-button']",
    position: "bottom",
    icon: HelpCircle,
  },
  {
    id: "complete",
    title: "Vous êtes prêt ! 🚀",
    description: "Vous connaissez maintenant les bases. N'hésitez pas à explorer et à contacter notre support si besoin. Bonne gestion !",
    position: "center",
    icon: Check,
    action: {
      label: "Commencer à utiliser Talok",
    },
  },
];

// Étapes du tour pour les locataires
const tenantTourSteps: TourStep[] = [
  {
    id: "welcome-tenant",
    title: "Bienvenue dans votre nouveau chez-vous ! 🏠",
    description: "Talok vous accompagne dans toute votre vie locative. Laissez-nous vous montrer comment tirer le meilleur parti de votre espace.",
    position: "center",
    icon: Sparkles,
  },
  {
    id: "onboarding-tenant",
    title: "Votre Installation",
    description: "Suivez ici les étapes clés de votre emménagement : signature du bail, état des lieux et vérification d'identité.",
    target: "[data-tour='tenant-onboarding']",
    position: "bottom",
    icon: Rocket,
  },
  {
    id: "financial-tenant",
    title: "Gestion des Loyers",
    description: "Consultez votre loyer, téléchargez vos quittances et payez en ligne en toute sécurité.",
    target: "[data-tour='tenant-financial']",
    position: "right",
    icon: Euro,
  },
  {
    id: "property-tenant",
    title: "Votre Logement",
    description: "Retrouvez toutes les informations sur votre logement, les contacts utiles et les documents du bail.",
    target: "[data-tour='tenant-property']",
    position: "top",
    icon: Building2,
  },
  {
    id: "documents-tenant",
    title: "Votre Coffre-fort",
    description: "Tous vos documents (bail, quittances, assurances) sont stockés ici en sécurité et accessibles 24/7.",
    target: "[data-tour='nav-documents']",
    position: "right",
    icon: FileText,
  },
  {
    id: "requests-tenant",
    title: "Assistance & SAV",
    description: "Un problème technique ? Une question ? Signalez-le ici et suivez la résolution en temps réel.",
    target: "[data-tour='nav-requests']",
    position: "right",
    icon: Wrench,
  },
  {
    id: "complete-tenant",
    title: "Tout est prêt ! 🚀",
    description: "Vous avez maintenant toutes les clés en main. Profitez bien de votre logement !",
    position: "center",
    icon: Check,
    action: {
      label: "Accéder à mon tableau de bord",
    },
  },
];

// Composant Spotlight (overlay avec trou)
function Spotlight({ target, isActive }: { target?: string; isActive: boolean }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!target || !isActive) {
      setRect(null);
      return;
    }

    const element = document.querySelector(target);
    if (element) {
      const updateRect = () => {
        setRect(element.getBoundingClientRect());
      };
      updateRect();
      
      window.addEventListener("resize", updateRect);
      window.addEventListener("scroll", updateRect);
      
      return () => {
        window.removeEventListener("resize", updateRect);
        window.removeEventListener("scroll", updateRect);
      };
    }
  }, [target, isActive]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      {/* Overlay sombre */}
      <div className="absolute inset-0 bg-black/60 transition-opacity duration-300" />
      
      {/* Trou pour l'élément cible */}
      {rect && (
        <div
          className="absolute bg-transparent transition-all duration-300"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
            borderRadius: "12px",
          }}
        >
          {/* Anneau lumineux */}
          <div 
            className="absolute inset-0 rounded-xl animate-pulse"
            style={{
              boxShadow: "0 0 20px 4px rgba(59, 130, 246, 0.5)",
            }}
          />
        </div>
      )}
    </div>
  );
}

// Composant Tooltip
function TourTooltip({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onComplete,
}: {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const isCentered = step.position === "center" || !step.target;
  const Icon = step.icon;

  useEffect(() => {
    if (isCentered) {
      setPosition({
        top: window.innerHeight / 2 - 150,
        left: window.innerWidth / 2 - 200,
      });
      return;
    }

    if (!step.target) return;

    const element = document.querySelector(step.target);
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const tooltipWidth = 400;
    const tooltipHeight = 250;
    const padding = 16;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case "top":
        top = rect.top - tooltipHeight - padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - padding;
        break;
      case "right":
      default:
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + padding;
        break;
    }

    // S'assurer que le tooltip reste visible
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

    setPosition({ top, left });
  }, [step, isCentered]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "fixed z-[9999] w-[400px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden",
        isCentered && "transform -translate-x-1/2 -translate-y-1/2"
      )}
      style={{
        top: isCentered ? "50%" : position.top,
        left: isCentered ? "50%" : position.left,
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-white/20 rounded-lg">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <h3 className="text-lg font-semibold">{step.title}</h3>
          </div>
          <button
            onClick={onSkip}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          {step.description}
        </p>

        {step.action && (
          <Button
            size="sm"
            variant="outline"
            className="mb-4 w-full"
            onClick={() => {
              if (step.action?.href) {
                window.location.href = step.action.href;
              }
              step.action?.onClick?.();
            }}
          >
            {step.action.label}
          </Button>
        )}

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Étape {currentStep + 1} sur {totalSteps}</span>
            <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
          </div>
          <Progress value={((currentStep + 1) / totalSteps) * 100} className="h-1.5" />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrev}
            disabled={isFirst}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>

          {isLast ? (
            <Button size="sm" onClick={onComplete} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
              <Check className="h-4 w-4" />
              Terminer
            </Button>
          ) : (
            <Button size="sm" onClick={onNext} className="gap-1">
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Provider
interface OnboardingTourProviderProps {
  children: React.ReactNode;
  role?: "owner" | "tenant";
  storageKey?: string;
}

export function OnboardingTourProvider({
  children,
  role = "owner",
  storageKey = "lokatif-tour-completed",
}: OnboardingTourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(true); // Default true pour éviter le flash

  const steps = role === "owner" ? ownerTourSteps : tenantTourSteps;
  const totalSteps = steps.length;

  // Charger l'état depuis localStorage
  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    setHasCompletedTour(completed === "true");
  }, [storageKey]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    document.body.style.overflow = "hidden";
  }, []);

  const endTour = useCallback((completed = false) => {
    setIsActive(false);
    document.body.style.overflow = "";
    if (completed) {
      localStorage.setItem(storageKey, "true");
      setHasCompletedTour(true);
    }
  }, [storageKey]);

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, totalSteps]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
    }
  }, [totalSteps]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasCompletedTour(false);
    setCurrentStep(0);
  }, [storageKey]);

  const currentStepData = steps[currentStep];

  return (
    <OnboardingTourContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps,
        startTour,
        endTour: () => endTour(false),
        nextStep,
        prevStep,
        goToStep,
        hasCompletedTour,
        resetTour,
      }}
    >
      {children}

      <AnimatePresence>
        {isActive && (
          <>
            <Spotlight target={currentStepData.target} isActive={isActive} />
            <TourTooltip
              step={currentStepData}
              currentStep={currentStep}
              totalSteps={totalSteps}
              onNext={nextStep}
              onPrev={prevStep}
              onSkip={() => endTour(false)}
              onComplete={() => endTour(true)}
            />
          </>
        )}
      </AnimatePresence>
    </OnboardingTourContext.Provider>
  );
}

// Bouton pour démarrer le tour
export function StartTourButton({ className }: { className?: string }) {
  const { startTour, hasCompletedTour } = useOnboardingTour();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={startTour}
      className={cn("gap-2", className)}
    >
      <Sparkles className="h-4 w-4" />
      {hasCompletedTour ? "Revoir le tour" : "Démarrer le tour"}
    </Button>
  );
}

// Prompt automatique pour les nouveaux utilisateurs
export function AutoTourPrompt() {
  const { startTour, hasCompletedTour, isActive } = useOnboardingTour();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedKey = "lokatif-tour-prompt-dismissed";
    setDismissed(localStorage.getItem(dismissedKey) === "true");
  }, []);

  if (hasCompletedTour || dismissed || isActive) return null;

  const handleDismiss = () => {
    localStorage.setItem("lokatif-tour-prompt-dismissed", "true");
    setDismissed(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-24 right-6 z-50 max-w-sm"
    >
      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold mb-1">Nouveau sur Talok ?</h4>
            <p className="text-sm text-blue-100 mb-3">
              Découvrez les fonctionnalités en 2 minutes avec notre tour guidé interactif.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={startTour}
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                Démarrer le tour
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-white hover:bg-white/20"
              >
                Plus tard
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export { ownerTourSteps, tenantTourSteps };
export type { TourStep };

