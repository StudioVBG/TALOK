import { PLANS, type PlanSlug } from "./plans";

function isKnownPlanSlug(value?: string | null): value is PlanSlug {
  if (!value) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(PLANS, value);
}

/**
 * Résout le plan courant côté UI en restant tolérant aux données partielles.
 * On conserve un plan payant connu si le fallback serveur l'a déjà résolu.
 */
export function resolveCurrentPlan(
  subscriptionPlanSlug?: string | null,
  usagePlanSlug?: string | null
): PlanSlug {
  const hasPaidSubscriptionPlan =
    isKnownPlanSlug(subscriptionPlanSlug) && subscriptionPlanSlug !== "gratuit";

  if (hasPaidSubscriptionPlan) {
    return subscriptionPlanSlug;
  }

  const hasPaidUsagePlan =
    isKnownPlanSlug(usagePlanSlug) && usagePlanSlug !== "gratuit";

  if (hasPaidUsagePlan) {
    return usagePlanSlug;
  }

  if (isKnownPlanSlug(subscriptionPlanSlug)) {
    return subscriptionPlanSlug;
  }

  if (isKnownPlanSlug(usagePlanSlug)) {
    return usagePlanSlug;
  }

  return "gratuit";
}
