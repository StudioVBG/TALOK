import { getPlanLevel, type PlanSlug } from "@/lib/subscriptions/plans";

type BillingCycle = "monthly" | "yearly";

interface CurrentSubscriptionPayload {
  subscription?: {
    plan_slug?: string | null;
    billing_cycle?: BillingCycle | null;
    stripe_subscription_id?: string | null;
  } | null;
}

export interface PlanChangeResult {
  mode: "checkout" | "updated";
  url?: string;
  scheduled?: boolean;
  effectiveAt?: string | null;
}

export async function changePlanForCurrentUser(
  planSlug: PlanSlug,
  billingCycle: BillingCycle
): Promise<PlanChangeResult> {
  const currentResponse = await fetch("/api/subscriptions/current", {
    credentials: "include",
    cache: "no-store",
  });

  const currentData = (currentResponse.ok
    ? await currentResponse.json()
    : { subscription: null }) as CurrentSubscriptionPayload;
  const currentSubscription = currentData.subscription;
  const currentPlanSlug = (currentSubscription?.plan_slug || "gratuit") as PlanSlug;
  const hasStripeSubscription = Boolean(currentSubscription?.stripe_subscription_id);
  const currentBillingCycle = currentSubscription?.billing_cycle || "monthly";

  const needsCheckout =
    !hasStripeSubscription ||
    currentPlanSlug === "gratuit";

  if (needsCheckout) {
    const response = await fetch("/api/subscriptions/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_slug: planSlug,
        billing_cycle: billingCycle,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erreur lors de la creation du checkout");
    }

    return {
      mode: "checkout",
      url: data.url,
    };
  }

  const shouldUpgrade =
    getPlanLevel(planSlug) >= getPlanLevel(currentPlanSlug) || billingCycle !== currentBillingCycle;
  const endpoint = shouldUpgrade ? "/api/billing/upgrade" : "/api/billing/downgrade";
  const body = shouldUpgrade
    ? { new_plan_id: planSlug, billing_cycle: billingCycle }
    : { new_plan_id: planSlug };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Erreur lors du changement de forfait");
  }

  return {
    mode: "updated",
    scheduled: Boolean(data.scheduled),
    effectiveAt: data.effective_at || null,
  };
}
