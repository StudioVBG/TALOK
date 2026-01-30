"use client";

/**
 * SOTA 2026 - Tour Guidé d'Onboarding Interactif (Mobile-First)
 *
 * Fonctionnalités:
 * - 12 étapes owner / 7 étapes tenant
 * - Supabase backend (avec fallback localStorage)
 * - Raccourcis clavier (← → Enter Escape)
 * - Support dark mode
 * - MOBILE-FIRST :
 *   - Auto-ouverture sidebar via custom event
 *   - Z-index boost sidebar pendant le spotlight
 *   - Swipe gauche/droite pour naviguer
 *   - ResizeObserver pour repositionnement
 *   - Scroll intelligent (pas de body lock sur mobile)
 */

import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
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
  Wrench,
  Bell,
  Settings,
  FileCheck,
  Search,
  FileSignature,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================
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

// ============================================================================
// HELPERS MOBILE
// ============================================================================

/** Breakpoint lg de Tailwind (sidebar visible en permanent) */
const LG_BREAKPOINT = 1024;

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth < LG_BREAKPOINT;
}

function isSmallScreen(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 640;
}

/** Vérifie si un target est un lien de la sidebar */
function isSidebarTarget(target?: string): boolean {
  if (!target) return false;
  return target.includes("data-tour='nav-");
}

/**
 * Demande l'ouverture/fermeture du drawer sidebar sur mobile
 * via un CustomEvent écouté par les layouts owner/tenant.
 */
function requestSidebarState(open: boolean): void {
  window.dispatchEvent(
    new CustomEvent("tour:sidebar", { detail: { open } })
  );
}

/**
 * Remonte le z-index de la sidebar <aside> au-dessus de l'overlay
 * pour que le spotlight puisse la mettre en valeur sur mobile.
 */
function boostSidebarZIndex(boost: boolean): void {
  const sidebar = document.querySelector("aside[data-tour-sidebar]") as HTMLElement | null;
  if (sidebar) {
    sidebar.style.zIndex = boost ? "9999" : "";
  }
}

// ============================================================================
// OWNER TOUR - 12 étapes
// ============================================================================
const ownerTourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Bienvenue sur Talok !",
    description:
      "Découvrez comment gérer vos biens locatifs simplement et efficacement. Ce tour rapide vous montrera les fonctionnalités essentielles en quelques étapes.",
    position: "center",
    icon: Sparkles,
  },
  {
    id: "dashboard",
    title: "Votre Tableau de Bord",
    description:
      "Vue d'ensemble de vos revenus, biens et actions urgentes. Les données se mettent à jour en temps réel pour un suivi instantané.",
    target: "[data-tour='dashboard-header']",
    position: "bottom",
    icon: Rocket,
  },
  {
    id: "properties",
    title: "Gestion des Biens",
    description:
      "Ajoutez et gérez tous vos biens : appartements, maisons, parkings. Chaque bien possède sa fiche détaillée avec diagnostics, photos et documents.",
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
    description:
      "Créez des baux conformes à la loi ALUR, invitez vos locataires à signer électroniquement, et gérez facilement la colocation.",
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
    title: "Loyers & Quittances",
    description:
      "Suivez vos paiements en temps réel, générez des quittances automatiquement et gérez les impayés. Export fiscal inclus pour votre déclaration.",
    target: "[data-tour='nav-money']",
    position: "right",
    icon: Euro,
  },
  {
    id: "inspections",
    title: "États des Lieux",
    description:
      "Réalisez des EDL numériques avec photos, signatures électroniques et génération PDF automatique. Conformité juridique garantie.",
    target: "[data-tour='nav-inspections']",
    position: "right",
    icon: ClipboardCheck,
  },
  {
    id: "tickets",
    title: "Tickets & Maintenance",
    description:
      "Recevez et gérez les demandes de maintenance de vos locataires. Suivez l'avancement et coordonnez les interventions facilement.",
    target: "[data-tour='nav-tickets']",
    position: "right",
    icon: Wrench,
  },
  {
    id: "documents",
    title: "Documents & Coffre-fort",
    description:
      "Centralisez tous vos documents : baux, diagnostics, quittances, assurances. Stockage sécurisé accessible 24h/24.",
    target: "[data-tour='nav-documents']",
    position: "right",
    icon: FileCheck,
  },
  {
    id: "command-palette",
    title: "Recherche Rapide",
    description:
      "Appuyez sur Ctrl+K (ou Cmd+K) à tout moment pour accéder instantanément à n'importe quelle page, bien ou locataire.",
    target: "[data-tour='search-button']",
    position: "bottom",
    icon: Search,
  },
  {
    id: "notifications",
    title: "Notifications",
    description:
      "Restez informé en temps réel : nouveaux paiements, demandes de maintenance, signatures en attente. Personnalisez vos alertes.",
    target: "[data-tour='notifications-bell']",
    position: "bottom",
    icon: Bell,
  },
  {
    id: "support",
    title: "Aide & Support",
    description:
      "Besoin d'aide ? Accédez à notre centre d'aide, FAQ, et support client directement depuis la barre latérale. Notre équipe est là pour vous.",
    target: "[data-tour='nav-support']",
    position: "right",
    icon: HelpCircle,
  },
  {
    id: "complete",
    title: "Vous êtes prêt !",
    description:
      "Vous connaissez maintenant les bases de Talok. Explorez, ajoutez vos biens et commencez à gérer votre patrimoine sereinement. Bon courage !",
    position: "center",
    icon: Check,
    action: {
      label: "Commencer à utiliser Talok",
    },
  },
];

// ============================================================================
// TENANT TOUR - 7 étapes
// ============================================================================
const tenantTourSteps: TourStep[] = [
  {
    id: "welcome-tenant",
    title: "Bienvenue chez vous !",
    description:
      "Talok vous accompagne dans toute votre vie locative. Laissez-nous vous montrer comment tirer le meilleur parti de votre espace.",
    position: "center",
    icon: Sparkles,
  },
  {
    id: "dashboard-tenant",
    title: "Votre Tableau de Bord",
    description:
      "Suivez ici les étapes clés de votre emménagement : signature du bail, état des lieux et vérification d'identité.",
    target: "[data-tour='nav-dashboard']",
    position: "right",
    icon: Rocket,
  },
  {
    id: "payments-tenant",
    title: "Gestion des Loyers",
    description:
      "Consultez votre loyer, téléchargez vos quittances et payez en ligne en toute sécurité.",
    target: "[data-tour='nav-payments']",
    position: "right",
    icon: Euro,
  },
  {
    id: "lease-tenant",
    title: "Votre Logement",
    description:
      "Retrouvez toutes les informations sur votre logement, les contacts utiles et les documents du bail.",
    target: "[data-tour='nav-lease']",
    position: "right",
    icon: Building2,
  },
  {
    id: "documents-tenant",
    title: "Votre Coffre-fort",
    description:
      "Tous vos documents (bail, quittances, assurances) sont stockés ici en sécurité et accessibles 24/7.",
    target: "[data-tour='nav-documents']",
    position: "right",
    icon: FileText,
  },
  {
    id: "requests-tenant",
    title: "Assistance & SAV",
    description:
      "Un problème technique ? Une question ? Signalez-le ici et suivez la résolution en temps réel.",
    target: "[data-tour='nav-requests']",
    position: "right",
    icon: Wrench,
  },
  {
    id: "complete-tenant",
    title: "Tout est prêt !",
    description:
      "Vous avez maintenant toutes les clés en main. Profitez bien de votre logement !",
    position: "center",
    icon: Check,
    action: {
      label: "Accéder à mon tableau de bord",
    },
  },
];

// ============================================================================
// SPOTLIGHT - Overlay avec découpe (mobile-aware)
// ============================================================================
function Spotlight({ target, isActive }: { target?: string; isActive: boolean }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!target || !isActive) {
      setRect(null);
      return;
    }

    const isSidebar = isSidebarTarget(target);
    const mobile = isMobileViewport();

    // Sur mobile, si on cible un item de la sidebar :
    // 1. Ouvrir la sidebar
    // 2. Booster son z-index au-dessus de l'overlay
    if (mobile && isSidebar) {
      requestSidebarState(true);
      // Attendre que la sidebar s'ouvre (transition CSS ~200ms)
      const openTimeout = setTimeout(() => {
        boostSidebarZIndex(true);
      }, 50);

      const findAndObserve = setTimeout(() => {
        const element = document.querySelector(target);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "nearest" });
          const updateRect = () => setRect(element.getBoundingClientRect());
          updateRect();

          // ResizeObserver pour suivre les changements de taille/position
          observerRef.current = new ResizeObserver(updateRect);
          observerRef.current.observe(element);

          window.addEventListener("resize", updateRect);
          window.addEventListener("scroll", updateRect, true);

          return () => {
            window.removeEventListener("resize", updateRect);
            window.removeEventListener("scroll", updateRect, true);
          };
        }
      }, 300); // Laisser la sidebar s'ouvrir complètement

      return () => {
        clearTimeout(openTimeout);
        clearTimeout(findAndObserve);
        observerRef.current?.disconnect();
        // Restaurer le z-index et fermer la sidebar
        boostSidebarZIndex(false);
        requestSidebarState(false);
      };
    }

    // Desktop ou cible non-sidebar
    const element = document.querySelector(target);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });

      const updateRect = () => setRect(element.getBoundingClientRect());
      const timeout = setTimeout(updateRect, 100);

      observerRef.current = new ResizeObserver(updateRect);
      observerRef.current.observe(element);

      window.addEventListener("resize", updateRect);
      window.addEventListener("scroll", updateRect, true);

      return () => {
        clearTimeout(timeout);
        observerRef.current?.disconnect();
        window.removeEventListener("resize", updateRect);
        window.removeEventListener("scroll", updateRect, true);
      };
    }
  }, [target, isActive]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      {/* Overlay sombre */}
      <div className="absolute inset-0 bg-black/60 dark:bg-black/70 transition-opacity duration-300" />

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

// ============================================================================
// TOOLTIP - Bulle d'information (responsive + swipe)
// ============================================================================
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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const isCentered = step.position === "center" || !step.target;
  const Icon = step.icon;

  // Calcul de la position (responsive)
  const computePosition = useCallback(() => {
    const mobile = isSmallScreen();
    const tooltipWidth = mobile ? Math.min(window.innerWidth - 32, 400) : 400;
    const tooltipHeight = 300;
    const padding = 16;

    if (isCentered) {
      setPosition({
        top: window.innerHeight / 2 - tooltipHeight / 2,
        left: window.innerWidth / 2 - tooltipWidth / 2,
      });
      return;
    }

    if (!step.target) return;

    const element = document.querySelector(step.target);
    if (!element) {
      // Fallback au centre
      setPosition({
        top: window.innerHeight / 2 - tooltipHeight / 2,
        left: window.innerWidth / 2 - tooltipWidth / 2,
      });
      return;
    }

    const rect = element.getBoundingClientRect();
    let top = 0;
    let left = 0;

    if (mobile) {
      // Mobile : toujours centré horizontalement, sous ou au-dessus de l'élément
      left = (window.innerWidth - tooltipWidth) / 2;
      if (rect.bottom + tooltipHeight + padding < window.innerHeight) {
        top = rect.bottom + padding;
      } else if (rect.top - tooltipHeight - padding > 0) {
        top = rect.top - tooltipHeight - padding;
      } else {
        top = Math.max(padding, (window.innerHeight - tooltipHeight) / 2);
      }
    } else {
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
    }

    // Clamp dans le viewport
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

    setPosition({ top, left });
  }, [step, isCentered]);

  // Recalculer à chaque changement d'étape + observer le resize
  useEffect(() => {
    computePosition();
    window.addEventListener("resize", computePosition);
    window.addEventListener("orientationchange", computePosition);
    return () => {
      window.removeEventListener("resize", computePosition);
      window.removeEventListener("orientationchange", computePosition);
    };
  }, [computePosition, currentStep]);

  // Swipe gauche/droite sur mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      touchStartRef.current = null;

      // Seuil minimum de 50px, et le swipe doit être plus horizontal que vertical
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          // Swipe gauche → Suivant
          onNext();
        } else {
          // Swipe droite → Précédent
          onPrev();
        }
      }
    },
    [onNext, onPrev]
  );

  return (
    <motion.div
      ref={tooltipRef}
      key={step.id}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn(
        "fixed z-[10000] w-[calc(100%-2rem)] sm:w-[400px] max-w-[400px]",
        "bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden",
        "mx-auto sm:mx-0",
        isCentered && "transform -translate-x-1/2 -translate-y-1/2"
      )}
      style={{
        top: isCentered ? "50%" : position.top,
        left: isCentered
          ? "50%"
          : Math.max(
              16,
              Math.min(
                position.left,
                typeof window !== "undefined" ? window.innerWidth - 320 : position.left
              )
            ),
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="p-2 bg-white/20 rounded-lg shrink-0">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <h3 className="text-base sm:text-lg font-semibold truncate">{step.title}</h3>
          </div>
          <button
            onClick={onSkip}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors shrink-0 ml-2"
            aria-label="Fermer le tour"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
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
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>
              Étape {currentStep + 1}/{totalSteps}
            </span>
            <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
          </div>
          <Progress value={((currentStep + 1) / totalSteps) * 100} className="h-1.5" />
        </div>

        {/* Keyboard hint (masqué sur mobile tactile) */}
        <p className="hidden sm:block text-[10px] text-slate-400 dark:text-slate-500 text-center mb-3">
          ← → pour naviguer &middot; Entrée avancer &middot; Échap quitter
        </p>

        {/* Swipe hint (mobile uniquement) */}
        <p className="sm:hidden text-[10px] text-slate-400 dark:text-slate-500 text-center mb-3">
          Swipez ← → pour naviguer
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrev}
            disabled={isFirst}
            className="gap-1 text-xs sm:text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Précédent</span>
            <span className="sm:hidden">Préc.</span>
          </Button>

          {isLast ? (
            <Button
              size="sm"
              onClick={onComplete}
              className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm"
            >
              <Check className="h-4 w-4" />
              Terminer
            </Button>
          ) : (
            <Button size="sm" onClick={onNext} className="gap-1 text-xs sm:text-sm">
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// PROVIDER - Context + Supabase backend + Keyboard + Mobile sidebar
// ============================================================================
interface OnboardingTourProviderProps {
  children: React.ReactNode;
  role?: "owner" | "tenant";
  profileId?: string;
  storageKey?: string;
}

export function OnboardingTourProvider({
  children,
  role = "owner",
  profileId,
  storageKey = "lokatif-tour-completed",
}: OnboardingTourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(true);
  const isActiveRef = useRef(false);

  const steps = role === "owner" ? ownerTourSteps : tenantTourSteps;
  const totalSteps = steps.length;

  // Load completion state
  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    setHasCompletedTour(completed === "true");

    if (profileId && completed !== "true") {
      import("@/lib/supabase/client").then(({ createClient }) => {
        const supabase = createClient();
        supabase
          .from("profiles")
          .select("tour_completed_at")
          .eq("id", profileId)
          .single()
          .then(({ data }) => {
            if (data?.tour_completed_at) {
              localStorage.setItem(storageKey, "true");
              setHasCompletedTour(true);
            }
          });
      });
    }
  }, [storageKey, profileId]);

  // Keyboard shortcuts (desktop)
  useEffect(() => {
    if (!isActiveRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "Enter":
          e.preventDefault();
          setCurrentStep((prev) => (prev < totalSteps - 1 ? prev + 1 : prev));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Escape":
          e.preventDefault();
          endTour(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalSteps]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    isActiveRef.current = true;
    // Sur desktop uniquement, bloquer le scroll du body
    if (!isMobileViewport()) {
      document.body.style.overflow = "hidden";
    }
  }, []);

  const endTour = useCallback(
    (completed = false) => {
      setIsActive(false);
      isActiveRef.current = false;
      document.body.style.overflow = "";

      // Nettoyer l'état mobile (fermer sidebar, restaurer z-index)
      boostSidebarZIndex(false);
      requestSidebarState(false);

      if (completed) {
        localStorage.setItem(storageKey, "true");
        setHasCompletedTour(true);

        if (profileId) {
          import("@/lib/supabase/client").then(({ createClient }) => {
            const supabase = createClient();
            supabase
              .from("profiles")
              .update({ tour_completed_at: new Date().toISOString() })
              .eq("id", profileId)
              .then(({ error }) => {
                if (error) {
                  console.warn("[OnboardingTour] Failed to persist tour completion:", error);
                }
              });
          });
        }
      }
    },
    [storageKey, profileId]
  );

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, totalSteps]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < totalSteps) {
        setCurrentStep(step);
      }
    },
    [totalSteps]
  );

  const resetTour = useCallback(() => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem("lokatif-tour-prompt-dismissed");
    setHasCompletedTour(false);
    setCurrentStep(0);

    if (profileId) {
      import("@/lib/supabase/client").then(({ createClient }) => {
        const supabase = createClient();
        supabase
          .from("profiles")
          .update({ tour_completed_at: null })
          .eq("id", profileId)
          .then(({ error }) => {
            if (error) {
              console.warn("[OnboardingTour] Failed to reset tour in DB:", error);
            }
          });
      });
    }
  }, [storageKey, profileId]);

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

      <AnimatePresence mode="wait">
        {isActive && currentStepData && (
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

// ============================================================================
// START TOUR BUTTON
// ============================================================================
export function StartTourButton({ className }: { className?: string }) {
  const { startTour, hasCompletedTour } = useOnboardingTour();

  return (
    <Button variant="outline" size="sm" onClick={startTour} className={cn("gap-2", className)}>
      <Sparkles className="h-4 w-4" />
      {hasCompletedTour ? "Revoir le tour" : "Démarrer le tour"}
    </Button>
  );
}

// ============================================================================
// AUTO TOUR PROMPT
// ============================================================================
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
      className="fixed bottom-24 right-4 sm:right-6 z-50 max-w-[calc(100%-2rem)] sm:max-w-sm"
    >
      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-4 sm:p-5 text-white shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white/20 rounded-lg shrink-0">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold mb-1 text-sm sm:text-base">Nouveau sur Talok ?</h4>
            <p className="text-xs sm:text-sm text-blue-100 mb-3">
              Découvrez les fonctionnalités en 2 minutes avec notre tour guidé.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={startTour}
                className="bg-white text-blue-600 hover:bg-blue-50 text-xs sm:text-sm"
              >
                Démarrer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-white hover:bg-white/20 text-xs sm:text-sm"
              >
                Plus tard
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded-full transition-colors shrink-0"
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
