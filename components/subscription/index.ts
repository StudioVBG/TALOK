/**
 * Composants Subscription - Point d'entrée
 */

// Provider et hooks
export {
  SubscriptionProvider,
  useSubscription,
  useFeature,
  useUsageLimit,
  useCurrentPlan,
} from "./subscription-provider";

// Gates
export { PlanGate, PlanGateInline, PlanGateTooltip } from "./plan-gate";

// Modals
export { UpgradeModal } from "./upgrade-modal";
export { CancelModal } from "./cancel-modal";

// Banners et indicateurs
export { UsageLimitBanner, UsageMeter } from "./usage-limit-banner";

// SOTA 2025 - Smart Paywall & Upgrade Triggers
export { SmartPaywall, UpgradeTrigger } from "./smart-paywall";

// Promo codes (Talok-managed via /admin/promo-codes)
export { PromoCodeField, type PromoCodeFieldProps } from "./promo-code-field";

