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
  tenantTourSteps,
  syndicTourSteps,
  providerTourSteps,
  guarantorTourSteps,
  agencyTourSteps,
} from "./OnboardingTour";

export type { TourStep, TourRole } from "./OnboardingTour";

// Wrapper générique (à monter dans les layouts serveur)
export { OnboardingWrapper } from "./OnboardingWrapper";

// Shell et progression
export { OnboardingShell, OnboardingProgress } from "./onboarding-shell";

// Modal de bienvenue
export { WelcomeModal } from "./welcome-modal";

// Indicateurs d'étapes
export { StepIndicator, ONBOARDING_STEPS } from "./step-indicator";
export type { StepIndicatorProps } from "./step-indicator";

// Tooltips contextuels
export { OnboardingTooltip, InlineHint, useOnboardingTooltips } from "./onboarding-tooltip";
export type { OnboardingTooltipProps } from "./onboarding-tooltip";

// Orchestrateur première connexion
export { FirstLoginOrchestrator } from "./FirstLoginOrchestrator";

// Restart Tour Card (pour les pages settings/profile)
export { RestartTourCard } from "./RestartTourCard";

// Actions skip/différer
export { SkipOnboardingButton, ResumeOnboardingBanner } from "./skip-onboarding-button";
