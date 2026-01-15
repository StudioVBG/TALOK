/**
 * Feature Onboarding - Index des exports
 *
 * Ce module centralise tous les services et hooks liés à l'onboarding.
 */

// Services
export { onboardingService } from "./services/onboarding.service";
export type { OnboardingProgress, OnboardingDraft } from "./services/onboarding.service";

export { dashboardGatingService } from "./services/dashboard-gating.service";
export type { ChecklistItem, OnboardingChecklist } from "./services/dashboard-gating.service";

export { firstLoginService } from "./services/first-login.service";
export type { FirstLoginState, LoginResult } from "./services/first-login.service";

export { onboardingNotificationsService } from "./services/onboarding-notifications.service";
export type { OnboardingNotificationData } from "./services/onboarding-notifications.service";

export { onboardingAnalyticsService } from "./services/onboarding-analytics.service";
export type { OnboardingStepData, OnboardingAnalyticsData } from "./services/onboarding-analytics.service";

// Hooks
export { useOnboarding, useOnboardingProgress } from "./hooks/use-onboarding";
export type { OnboardingState, OnboardingActions } from "./hooks/use-onboarding";
