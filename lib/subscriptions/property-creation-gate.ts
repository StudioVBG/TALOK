import type { PlanSlug } from "./plans";
import { PLANS } from "./plans";

interface ResolvePropertyCreationGateParams {
  currentPlan: PlanSlug;
  usedProperties?: number;
  canAddFromUsageLimit: boolean;
  subscriptionLoading: boolean;
}

/**
 * Garde le CTA d'ajout visible pour les forfaits payants qui autorisent
 * encore la creation, meme si le hook de quota remonte un etat transitoire.
 */
export function resolvePropertyCreationGate({
  currentPlan,
  usedProperties = 0,
  canAddFromUsageLimit,
  subscriptionLoading,
}: ResolvePropertyCreationGateParams): boolean {
  if (subscriptionLoading || canAddFromUsageLimit) {
    return true;
  }

  const limits = PLANS[currentPlan]?.limits ?? PLANS.gratuit.limits;

  if (limits.max_properties === -1 || limits.extra_property_price > 0) {
    return true;
  }

  return usedProperties < limits.max_properties;
}
