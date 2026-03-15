import type Stripe from "stripe";

export type ServiceClientLike = {
  from: (table: string) => {
    select: (...args: unknown[]) => any;
    update: (...args: unknown[]) => any;
    eq: (...args: unknown[]) => any;
    or: (...args: unknown[]) => any;
    in: (...args: unknown[]) => any;
    is: (...args: unknown[]) => any;
    maybeSingle: (...args: unknown[]) => any;
    single: (...args: unknown[]) => any;
  };
  auth?: {
    admin: {
      updateUserById: (...args: unknown[]) => Promise<unknown>;
      listUsers?: (...args: unknown[]) => Promise<{
        data?: { users?: Array<{ id: string; email?: string | null }> };
      }>;
    };
  };
};

export interface ResolvedPlanIdentifiers {
  id: string | null;
  slug: string | null;
}

export interface LiveOwnerUsage {
  properties: number;
  leases: number;
}

export function getPrimarySubscriptionItem(
  subscription: Stripe.Subscription
): Stripe.SubscriptionItem | null {
  return (
    subscription.items.data.find((item) => item.metadata?.type !== "extra_properties") ||
    subscription.items.data[0] ||
    null
  );
}

export function getStripeBillingCycle(
  subscription: Stripe.Subscription
): "monthly" | "yearly" | null {
  const primaryItem = getPrimarySubscriptionItem(subscription);
  const interval = primaryItem?.price?.recurring?.interval;

  if (interval === "month") return "monthly";
  if (interval === "year") return "yearly";
  return null;
}

export async function resolvePlanIdentifiers(
  serviceClient: ServiceClientLike,
  input: {
    planSlug?: string | null;
    planId?: string | null;
    stripePriceId?: string | null;
  }
): Promise<ResolvedPlanIdentifiers> {
  if (input.planId || input.planSlug) {
    const query = serviceClient
      .from("subscription_plans")
      .select("id, slug")
      .eq(input.planId ? "id" : "slug", input.planId || input.planSlug)
      .maybeSingle();

    const { data } = await query;
    if (data) {
      const row = data as { id?: string | null; slug?: string | null };
      return {
        id: row.id ?? null,
        slug: row.slug ?? null,
      };
    }
  }

  if (input.stripePriceId) {
    const { data } = await serviceClient
      .from("subscription_plans")
      .select("id, slug")
      .or(
        `stripe_price_monthly_id.eq.${input.stripePriceId},stripe_price_yearly_id.eq.${input.stripePriceId}`
      )
      .maybeSingle();

    if (data) {
      const row = data as { id?: string | null; slug?: string | null };
      return {
        id: row.id ?? null,
        slug: row.slug ?? null,
      };
    }
  }

  return { id: input.planId ?? null, slug: input.planSlug ?? null };
}

export async function buildSubscriptionUpdateFromStripe(
  serviceClient: ServiceClientLike,
  subscription: Stripe.Subscription,
  options?: {
    planSlug?: string | null;
    planId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const primaryItem = getPrimarySubscriptionItem(subscription);
  const resolvedPlan = await resolvePlanIdentifiers(serviceClient, {
    planSlug: options?.planSlug || subscription.metadata?.plan_slug || null,
    planId: options?.planId || null,
    stripePriceId: primaryItem?.price?.id || null,
  });

  return {
    stripe_subscription_id: subscription.id,
    stripe_customer_id:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id || null,
    status: subscription.status,
    billing_cycle: getStripeBillingCycle(subscription),
    current_period_start: (subscription as Stripe.Subscription & {
      current_period_start?: number | null;
    }).current_period_start
      ? new Date(
          ((subscription as Stripe.Subscription & { current_period_start?: number | null })
            .current_period_start as number) * 1000
        ).toISOString()
      : null,
    current_period_end: (subscription as Stripe.Subscription & {
      current_period_end?: number | null;
    }).current_period_end
      ? new Date(
          ((subscription as Stripe.Subscription & { current_period_end?: number | null })
            .current_period_end as number) * 1000
        ).toISOString()
      : null,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    plan_id: resolvedPlan.id,
    plan_slug: resolvedPlan.slug,
    metadata: options?.metadata,
    updated_at: new Date().toISOString(),
  };
}

export async function getLiveOwnerUsage(
  serviceClient: ServiceClientLike,
  ownerId: string
): Promise<LiveOwnerUsage> {
  const { count: propertiesCount } = await serviceClient
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("deleted_at", null);

  const { data: ownerProperties } = await serviceClient
    .from("properties")
    .select("id")
    .eq("owner_id", ownerId)
    .is("deleted_at", null);

  const propertyIds = ((ownerProperties || []) as Array<{ id: string }>).map((item) => item.id);

  let leasesCount = 0;
  if (propertyIds.length > 0) {
    const { count } = await serviceClient
      .from("leases")
      .select("id", { count: "exact", head: true })
      .in("property_id", propertyIds)
      .in("statut", ["active", "pending_signature", "fully_signed", "partially_signed"]);

    leasesCount = count || 0;
  }

  return {
    properties: propertiesCount || 0,
    leases: leasesCount,
  };
}

export function isPaidSubscriptionStatus(status?: string | null): boolean {
  return ["trialing", "active", "past_due", "paused", "canceled", "unpaid"].includes(status || "");
}
