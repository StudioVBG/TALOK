/**
 * SOTA 2026 - Système d'Onboarding
 *
 * Ce module exporte tous les composants nécessaires pour l'expérience
 * de première connexion et d'onboarding des utilisateurs.
 */

// Tour existant
export {
  OnboardingTourProvider,
  useOnboardingTour,
  StartTourButton,
  AutoTourPrompt,
  ownerTourSteps,
} from "./OnboardingTour";

export type { TourStep } from "./OnboardingTour";

// Shell et progression
export { OnboardingShell, OnboardingProgress } from "./onboarding-shell";

// Modal de bienvenue
export { WelcomeModal } from "./welcome-modal";

// Tour guidé amélioré
export { GuidedTour, useTour, OWNER_TOUR_STEPS, TENANT_TOUR_STEPS } from "./guided-tour";
export type { GuidedTourProps } from "./guided-tour";

// Indicateurs d'étapes
export { StepIndicator, ONBOARDING_STEPS } from "./step-indicator";
export type { StepIndicatorProps } from "./step-indicator";

// Tooltips contextuels
export { OnboardingTooltip, InlineHint, useOnboardingTooltips } from "./onboarding-tooltip";
export type { OnboardingTooltipProps } from "./onboarding-tooltip";

// Actions skip/différer
export { SkipOnboardingButton, ResumeOnboardingBanner } from "./skip-onboarding-button";
