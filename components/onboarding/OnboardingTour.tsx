"use client";

/**
 * SOTA 2026 - Tour Guidé d'Onboarding Interactif (Mobile-First)
 *
 * Fonctionnalités:
 * - 8 étapes owner / 5 étapes tenant / 6 syndic / 5 provider / 4 guarantor / 5 agency
 * - Supabase backend (avec fallback localStorage)
 * - Raccourcis clavier (← → Enter Escape)
 * - Support dark mode
 * - MOBILE-FIRST :
 *   - Mesure réelle de la hauteur du tooltip (pas d'hardcode)
 *   - Repositionnement sur scroll + resize + orientationchange
 *   - Clamp dynamique sur la largeur effective
 *   - Lock body scroll sur mobile ET desktop pendant le tour
 *   - Évitement du bottom-nav et du header sticky
 *   - Swipe gauche/droite pour naviguer
 *   - ResizeObserver pour repositionnement
 */

import { useState, useEffect, useCallback, useMemo, createContext, useContext, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
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
  Rocket,
  Wrench,
  Bell,
  FileCheck,
  Search,
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
/** Hauteur du bottom-nav mobile (h-16 + safe area iOS). */
const BOTTOM_NAV_SAFE_HEIGHT = 88;
/** Hauteur d'un header sticky type. */
const STICKY_HEADER_HEIGHT = 64;

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth < LG_BREAKPOINT;
}

function isSmallScreen(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 640;
}

/** Vérifie si un target est un lien de la sidebar (desktop only, display:none en mobile). */
function isSidebarTarget(target?: string): boolean {
  if (!target) return false;
  return target.includes("data-tour='nav-");
}

/**
 * Bloque le scroll du body pendant le tour (mobile + desktop).
 * Renvoie une fonction pour restaurer l'overflow précédent.
 */
function lockBodyScroll(): () => void {
  const prevOverflow = document.body.style.overflow;
  const prevTouchAction = document.body.style.touchAction;
  document.body.style.overflow = "hidden";
  document.body.style.touchAction = "none";
  return () => {
    document.body.style.overflow = prevOverflow;
    document.body.style.touchAction = prevTouchAction;
  };
}

// ============================================================================
// OWNER TOUR - 8 étapes SOTA 2026
// ============================================================================
const ownerTourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Votre tableau de bord",
    description:
      "Ici, vous voyez en un coup d'œil vos revenus du mois, vos biens et vos baux actifs. Tout ce qu'il faut pour piloter vos locations.",
    target: "[data-tour='dashboard-header']",
    position: "bottom",
    icon: Rocket,
  },
  {
    id: "properties",
    title: "Gérez vos logements",
    description:
      "Ajoutez vos biens, renseignez les détails (surface, DPE, équipements) et suivez leur occupation. Commencez par votre premier logement.",
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
    title: "Créez votre premier bail",
    description:
      "Générez un contrat de location conforme à la loi en 5 minutes. Votre locataire signe depuis son téléphone. Plus de paperasse.",
    target: "[data-tour='nav-leases']",
    position: "right",
    icon: FileText,
  },
  {
    id: "money",
    title: "Recevez vos loyers",
    description:
      "Connectez votre compte bancaire pour recevoir les paiements de vos locataires. Les quittances partent automatiquement.",
    target: "[data-tour='nav-money']",
    position: "right",
    icon: Euro,
  },
  {
    id: "documents",
    title: "Tous vos documents au même endroit",
    description:
      "Baux signés, états des lieux, quittances, assurances — tout est archivé ici. Cherchez en 1 clic, partagez en 1 clic.",
    target: "[data-tour='nav-documents']",
    position: "right",
    icon: FileCheck,
  },
  {
    id: "tickets",
    title: "Vos locataires vous signalent un problème ?",
    description:
      "Les demandes d'intervention arrivent ici. Assignez un prestataire, suivez l'avancement, validez la facture.",
    target: "[data-tour='nav-tickets']",
    position: "right",
    icon: Wrench,
  },
  {
    id: "command-palette",
    title: "Retrouvez tout instantanément",
    description:
      "Recherchez un locataire, un bien, un document, une facture. La recherche couvre toute votre gestion.",
    target: "[data-tour='search-button']",
    position: "bottom",
    icon: Search,
  },
  {
    id: "complete",
    title: "Ne ratez rien",
    description:
      "Loyer en retard, bail à renouveler, document expirant — vous êtes alerté en temps réel. Bonne gestion !",
    target: "[data-tour='notifications-bell']",
    position: "bottom",
    icon: Bell,
    action: {
      label: "Commencer ma gestion",
    },
  },
];

// ============================================================================
// TENANT TOUR - 5 étapes SOTA 2026
// ============================================================================
const tenantTourSteps: TourStep[] = [
  {
    id: "dashboard-tenant",
    title: "Votre espace locataire",
    description:
      "Bienvenue ! Ici vous gérez tout ce qui concerne votre location depuis votre téléphone.",
    target: "[data-tour='tenant-onboarding']",
    position: "bottom",
    icon: Rocket,
  },
  {
    id: "lease-tenant",
    title: "Votre contrat de location",
    description:
      "Consultez votre bail, les conditions, et signez les documents directement depuis l'application.",
    target: "[data-tour='nav-lease']",
    position: "right",
    icon: Building2,
  },
  {
    id: "payments-tenant",
    title: "Payez votre loyer en 1 clic",
    description:
      "Réglez par carte bancaire ou prélèvement automatique. Votre quittance est générée instantanément.",
    target: "[data-tour='nav-payments']",
    position: "right",
    icon: Euro,
  },
  {
    id: "documents-tenant",
    title: "Vos documents accessibles partout",
    description:
      "Quittances, contrat signé, état des lieux — téléchargez-les à tout moment, même sur mobile.",
    target: "[data-tour='nav-documents']",
    position: "right",
    icon: FileText,
  },
  {
    id: "requests-tenant",
    title: "Signalez un problème",
    description:
      "Fuite, panne, travaux — signalez directement à votre propriétaire avec photos. Suivez l'avancement.",
    target: "[data-tour='nav-requests']",
    position: "right",
    icon: Wrench,
    action: {
      label: "Accéder à mon tableau de bord",
    },
  },
];

// ============================================================================
// PROVIDER TOUR - 5 étapes SOTA 2026
// ============================================================================
const providerTourSteps: TourStep[] = [
  {
    id: "welcome-provider",
    title: "Votre espace prestataire",
    description:
      "Trouvez des missions, envoyez vos devis et suivez vos interventions. Tout se pilote depuis ce tableau de bord.",
    position: "center",
    icon: Rocket,
  },
  {
    id: "jobs-provider",
    title: "Vos missions",
    description:
      "Consultez les interventions reçues, acceptez celles qui vous intéressent et répondez aux propriétaires en quelques secondes.",
    target: "[data-tour='nav-jobs']",
    position: "right",
    icon: Wrench,
  },
  {
    id: "quotes-provider",
    title: "Devis et factures",
    description:
      "Rédigez vos devis depuis l'app, convertissez-les en factures à la fin du chantier, recevez le paiement directement.",
    target: "[data-tour='nav-quotes']",
    position: "right",
    icon: FileText,
  },
  {
    id: "calendar-provider",
    title: "Planifiez vos interventions",
    description:
      "Bloquez vos créneaux, synchronisez votre agenda et évitez les conflits avec vos autres chantiers.",
    target: "[data-tour='nav-calendar']",
    position: "right",
    icon: FileCheck,
  },
  {
    id: "reviews-provider",
    title: "Construisez votre réputation",
    description:
      "Chaque mission terminée donne lieu à un avis. Plus vous en collectez, plus vous êtes visible auprès des propriétaires.",
    target: "[data-tour='nav-reviews']",
    position: "right",
    icon: Bell,
    action: {
      label: "Accéder à mes missions",
    },
  },
];

// ============================================================================
// GUARANTOR TOUR - 4 étapes SOTA 2026
// ============================================================================
const guarantorTourSteps: TourStep[] = [
  {
    id: "welcome-guarantor",
    title: "Votre espace garant",
    description:
      "Suivez les baux que vous cautionnez, consultez les paiements du locataire et vos obligations en un seul endroit.",
    position: "center",
    icon: Rocket,
  },
  {
    id: "dashboard-guarantor",
    title: "Vue d'ensemble",
    description:
      "Retrouvez chaque bail pour lequel vous vous êtes porté garant, avec les conditions, les montants et l'état des paiements.",
    target: "[data-tour='nav-dashboard']",
    position: "bottom",
    icon: Building2,
  },
  {
    id: "docs-guarantor",
    title: "Vos documents",
    description:
      "Acte de cautionnement, justificatifs, pièces d'identité — tout reste accessible et téléchargeable à vie.",
    target: "[data-tour='nav-documents']",
    position: "bottom",
    icon: FileCheck,
  },
  {
    id: "complete-guarantor",
    title: "Vous êtes prêt",
    description:
      "Vous serez alerté en cas d'impayé avéré uniquement. Aucun spam, juste ce qui compte pour vos engagements.",
    position: "center",
    icon: Bell,
    action: {
      label: "Consulter mes engagements",
    },
  },
];

// ============================================================================
// AGENCY TOUR - 5 étapes SOTA 2026
// ============================================================================
const agencyTourSteps: TourStep[] = [
  {
    id: "welcome-agency",
    title: "Votre espace agence",
    description:
      "Pilotez vos mandats, vos propriétaires, vos locataires et vos prestataires depuis une seule interface conforme loi Hoguet.",
    position: "center",
    icon: Rocket,
  },
  {
    id: "mandates-agency",
    title: "Vos mandats",
    description:
      "Créez et suivez vos mandats de gestion ou de location. Relances d'échéance automatiques avant l'expiration de votre carte pro.",
    target: "[data-tour='nav-mandates']",
    position: "right",
    icon: FileText,
  },
  {
    id: "owners-agency",
    title: "Vos mandants",
    description:
      "Centralisez les propriétaires confiés. CRG (Compte Rendu de Gestion), reversements, honoraires — tout est tracé.",
    target: "[data-tour='nav-owners']",
    position: "right",
    icon: Building2,
  },
  {
    id: "accounting-agency",
    title: "Comptabilité Hoguet",
    description:
      "Comptes séparés par mandant, balance détaillée, export FEC. Conforme aux obligations de la loi Hoguet.",
    target: "[data-tour='nav-accounting']",
    position: "right",
    icon: FileCheck,
  },
  {
    id: "complete-agency",
    title: "Tout est prêt",
    description:
      "Invitez votre équipe, paramétrez votre charte, et lancez votre première annonce. Votre agence est opérationnelle.",
    position: "center",
    icon: Bell,
    action: {
      label: "Accéder à mon tableau de bord",
    },
  },
];

// ============================================================================
// SYNDIC TOUR - 6 étapes orientées copropriété
// ============================================================================
const syndicTourSteps: TourStep[] = [
  {
    id: "welcome-syndic",
    title: "Votre espace Syndic",
    description:
      "Pilotez vos copropriétés : assemblées, appels de fonds, comptabilité, mandats. Tout au même endroit, conforme loi ALUR.",
    position: "center",
    icon: Rocket,
  },
  {
    id: "sites-syndic",
    title: "Vos copropriétés",
    description:
      "Retrouvez toutes vos copropriétés gérées. Ajoutez immeubles, lots et tantièmes en quelques clics.",
    target: "[data-tour='syndic-sites']",
    position: "right",
    icon: Building2,
  },
  {
    id: "assemblies-syndic",
    title: "Assemblées générales",
    description:
      "Convoquez, animez et votez vos AG. Génération automatique du PV et envoi par email aux copropriétaires.",
    target: "[data-tour='syndic-assemblies']",
    position: "right",
    icon: FileText,
  },
  {
    id: "calls-syndic",
    title: "Appels de fonds",
    description:
      "Émettez vos appels de fonds trimestriels et fonds travaux (loi ALUR). Suivi des paiements automatique.",
    target: "[data-tour='syndic-calls']",
    position: "right",
    icon: Euro,
  },
  {
    id: "accounting-syndic",
    title: "Comptabilité copropriété",
    description:
      "Saisie des dépenses, rapprochement bancaire, annexes 1 à 5, arrêté des comptes. Conforme PCG copro.",
    target: "[data-tour='syndic-accounting']",
    position: "right",
    icon: FileCheck,
  },
  {
    id: "mandates-syndic",
    title: "Mandats & honoraires",
    description:
      "Gérez vos mandats de syndic, honoraires particuliers et échéances. Rappels avant expiration de carte pro.",
    target: "[data-tour='syndic-mandates']",
    position: "right",
    icon: Wrench,
    action: {
      label: "Accéder à mon espace",
    },
  },
];

// ============================================================================
// SPOTLIGHT - Overlay avec découpe (mobile-aware)
// ============================================================================
function Spotlight({ target, isActive }: { target?: string; isActive: boolean }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!target || !isActive) {
      setRect(null);
      return;
    }

    const isSidebar = isSidebarTarget(target);
    const mobile = isMobileViewport();

    // Sur mobile, la sidebar desktop est display:none → on cherche l'équivalent
    // rendu dans SharedBottomNav (qui expose le même data-tour).
    // Si rien n'est trouvé, on retombe au tooltip centré (pas de spotlight).
    const element = document.querySelector(target) as HTMLElement | null;
    const visible = element
      ? element.offsetParent !== null || element.getBoundingClientRect().width > 0
      : false;

    if (!element || !visible) {
      if (mobile && isSidebar) {
        setRect(null);
        return;
      }
      setRect(null);
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    const updateRect = () => {
      const r = element.getBoundingClientRect();
      // Ignore les rects à 0 (élément caché)
      if (r.width === 0 && r.height === 0) {
        setRect(null);
      } else {
        setRect(r);
      }
    };
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
          {/* Anneau lumineux — désactivé si prefers-reduced-motion */}
          <div
            className={cn(
              "absolute inset-0 rounded-xl",
              !prefersReducedMotion && "animate-pulse"
            )}
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
// ACTION BUTTON - Utilise le router Next.js (SPA) au lieu de window.location
// ============================================================================
function TourActionButton({
  action,
}: {
  action: { label: string; href?: string; onClick?: () => void };
}) {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="outline"
      className="mb-4 w-full"
      onClick={() => {
        if (action.href) {
          router.push(action.href);
        }
        action.onClick?.();
      }}
    >
      {action.label}
    </Button>
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
  const [tooltipSize, setTooltipSize] = useState({ width: 400, height: 300 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const isCentered = step.position === "center" || !step.target;
  const Icon = step.icon;

  // Mesure la vraie hauteur/largeur rendue du tooltip
  const measureTooltip = useCallback(() => {
    if (!tooltipRef.current) return { width: 400, height: 300 };
    const el = tooltipRef.current;
    return {
      width: el.offsetWidth || 400,
      height: el.offsetHeight || 300,
    };
  }, []);

  // Calcul de la position (responsive + fallback safe-area)
  const computePosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const mobile = isSmallScreen();
    const measured = measureTooltip();
    const tooltipWidth = Math.min(
      measured.width,
      mobile ? window.innerWidth - 32 : 400
    );
    const tooltipHeight = measured.height;
    const padding = 16;
    setTooltipSize({ width: tooltipWidth, height: tooltipHeight });

    // Zones réservées : header sticky en haut, bottom-nav en bas (mobile)
    const topSafe = STICKY_HEADER_HEIGHT + padding;
    const bottomSafe = mobile ? BOTTOM_NAV_SAFE_HEIGHT + padding : padding;
    const availableHeight = window.innerHeight - topSafe - bottomSafe;

    if (isCentered) {
      const centerTop = topSafe + (availableHeight - tooltipHeight) / 2;
      setPosition({
        top: Math.max(topSafe, centerTop),
        left: Math.max(padding, (window.innerWidth - tooltipWidth) / 2),
      });
      return;
    }

    if (!step.target) return;

    const element = document.querySelector(step.target) as HTMLElement | null;
    const visible = element
      ? element.offsetParent !== null || element.getBoundingClientRect().width > 0
      : false;

    if (!element || !visible) {
      // Fallback : tooltip centré dans la zone safe
      const centerTop = topSafe + (availableHeight - tooltipHeight) / 2;
      setPosition({
        top: Math.max(topSafe, centerTop),
        left: Math.max(padding, (window.innerWidth - tooltipWidth) / 2),
      });
      return;
    }

    const rect = element.getBoundingClientRect();
    let top = 0;
    let left = 0;

    if (mobile) {
      // Mobile : toujours centré horizontalement, sous ou au-dessus de l'élément
      left = (window.innerWidth - tooltipWidth) / 2;
      const spaceBelow = window.innerHeight - bottomSafe - rect.bottom;
      const spaceAbove = rect.top - topSafe;

      if (spaceBelow >= tooltipHeight + padding) {
        top = rect.bottom + padding;
      } else if (spaceAbove >= tooltipHeight + padding) {
        top = rect.top - tooltipHeight - padding;
      } else {
        // Aucune place : on centre dans la zone safe
        top = topSafe + Math.max(0, (availableHeight - tooltipHeight) / 2);
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

    // Clamp dans le viewport en tenant compte des zones safe
    top = Math.max(topSafe, Math.min(top, window.innerHeight - bottomSafe - tooltipHeight));
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

    setPosition({ top, left });
  }, [step, isCentered, measureTooltip]);

  // Recalculer à chaque changement d'étape + observer resize, scroll, orientation
  useEffect(() => {
    // Double-raf pour laisser le tooltip se rendre avant de mesurer
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(computePosition);
    });

    window.addEventListener("resize", computePosition);
    window.addEventListener("orientationchange", computePosition);
    window.addEventListener("scroll", computePosition, true);

    // ResizeObserver sur le tooltip : si le contenu grandit (texte long),
    // la hauteur change et on repositionne.
    let ro: ResizeObserver | null = null;
    if (tooltipRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(computePosition);
      ro.observe(tooltipRef.current);
    }

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("resize", computePosition);
      window.removeEventListener("orientationchange", computePosition);
      window.removeEventListener("scroll", computePosition, true);
      ro?.disconnect();
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
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -10 }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn(
        "fixed z-[10000] w-[calc(100%-2rem)] sm:w-[400px] max-w-[400px]",
        "bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
      )}
      style={{
        top: position.top,
        left: position.left,
        maxHeight: `calc(100dvh - ${STICKY_HEADER_HEIGHT + BOTTOM_NAV_SAFE_HEIGHT + 32}px)`,
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div className="bg-blue-600 p-4 text-white">
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

        {step.action && <TourActionButton action={step.action} />}

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
type TourRole = "owner" | "tenant" | "syndic" | "provider" | "guarantor" | "agency" | "admin";

interface OnboardingTourProviderProps {
  children: React.ReactNode;
  role?: TourRole;
  profileId?: string;
  storageKey?: string;
}

const ROLE_STEPS: Record<TourRole, TourStep[]> = {
  owner: ownerTourSteps,
  tenant: tenantTourSteps,
  syndic: syndicTourSteps,
  provider: providerTourSteps,
  guarantor: guarantorTourSteps,
  agency: agencyTourSteps,
  // Admin : pas de tour guidé (profil interne). On reste avec WelcomeModal + 0 étape.
  admin: [],
};

export function OnboardingTourProvider({
  children,
  role = "owner",
  profileId,
  storageKey = "talok-tour-completed",
}: OnboardingTourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(true);
  const isActiveRef = useRef(false);
  const unlockScrollRef = useRef<(() => void) | null>(null);

  const steps = useMemo(() => ROLE_STEPS[role] ?? [], [role]);
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
    if (totalSteps === 0) return; // Rôle sans tour (ex : admin)
    setCurrentStep(0);
    setIsActive(true);
    isActiveRef.current = true;
    // Lock body scroll sur mobile ET desktop pour stabiliser la position
    unlockScrollRef.current?.();
    unlockScrollRef.current = lockBodyScroll();
  }, [totalSteps]);

  const endTour = useCallback(
    (completed = false) => {
      setIsActive(false);
      isActiveRef.current = false;
      unlockScrollRef.current?.();
      unlockScrollRef.current = null;

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
    localStorage.removeItem("talok-tour-prompt-dismissed");
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
    const dismissedKey = "talok-tour-prompt-dismissed";
    setDismissed(localStorage.getItem(dismissedKey) === "true");
  }, []);

  if (hasCompletedTour || dismissed || isActive) return null;

  const handleDismiss = () => {
    localStorage.setItem("talok-tour-prompt-dismissed", "true");
    setDismissed(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-24 right-4 sm:right-6 z-50 max-w-[calc(100%-2rem)] sm:max-w-sm"
    >
      <div className="bg-blue-600 rounded-2xl p-4 sm:p-5 text-white shadow-2xl">
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

export {
  ownerTourSteps,
  tenantTourSteps,
  syndicTourSteps,
  providerTourSteps,
  guarantorTourSteps,
  agencyTourSteps,
};
export type { TourRole };
export type { TourStep };
