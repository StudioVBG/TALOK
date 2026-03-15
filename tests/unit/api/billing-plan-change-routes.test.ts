import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

const serviceClient = {
  from: vi.fn(),
};

const stripe = {
  subscriptions: {
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  subscriptionSchedules: {
    create: vi.fn(),
    update: vi.fn(),
    release: vi.fn(),
  },
};

const syncPropertyBillingToStripe = vi.fn();
const logSubscriptionEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(sessionClient)),
  createServiceRoleClient: vi.fn(() => serviceClient),
}));

vi.mock("@/lib/stripe", () => ({
  stripe,
}));

vi.mock("@/lib/stripe/sync-property-billing", () => ({
  syncPropertyBillingToStripe,
}));

vi.mock("@/lib/subscriptions/subscription-service", () => ({
  logSubscriptionEvent,
}));

describe("billing plan change routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    sessionClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "owner@test.fr" } },
      error: null,
    });
  });

  it("fait un upgrade proratisé immédiat et nettoie le downgrade planifié", async () => {
    const subscriptionsUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const subscriptionsUpdate = vi.fn(() => ({ eq: subscriptionsUpdateEq }));

    sessionClient.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: "owner-1" }, error: null }),
        };
      }

      if (table === "audit_log") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected session table ${table}`);
    });

    serviceClient.from.mockImplementation((table: string) => {
      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "sub-1",
              owner_id: "owner-1",
              plan_slug: "starter",
              billing_cycle: "monthly",
              stripe_subscription_id: "sub_stripe_1",
              stripe_subscription_schedule_id: "sched_1",
            },
            error: null,
          }),
          update: subscriptionsUpdate,
        };
      }

      if (table === "subscription_plans") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "plan-pro",
              slug: "pro",
              price_monthly: 2900,
              price_yearly: 29000,
              stripe_price_monthly_id: "price_pro_monthly",
              stripe_price_yearly_id: "price_pro_yearly",
            },
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "plan-pro", slug: "pro" },
            error: null,
          }),
          or: vi.fn().mockReturnThis(),
        };
      }

      throw new Error(`Unexpected service table ${table}`);
    });

    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_stripe_1",
      status: "active",
      customer: "cus_1",
      cancel_at_period_end: false,
      trial_end: null,
      current_period_start: 1_710_000_000,
      current_period_end: 1_712_592_000,
      metadata: { plan_slug: "starter" },
      items: {
        data: [
          {
            id: "item_1",
            quantity: 1,
            metadata: {},
            price: {
              id: "price_starter_monthly",
              recurring: { interval: "month" },
            },
          },
        ],
      },
    });

    stripe.subscriptionSchedules.release.mockResolvedValue({ id: "sched_1" });
    stripe.subscriptions.update.mockResolvedValue({
      id: "sub_stripe_1",
      status: "active",
      customer: "cus_1",
      cancel_at_period_end: false,
      trial_end: null,
      current_period_start: 1_710_000_000,
      current_period_end: 1_712_592_000,
      metadata: { plan_slug: "pro" },
      canceled_at: null,
      items: {
        data: [
          {
            id: "item_1",
            quantity: 1,
            metadata: {},
            price: {
              id: "price_pro_monthly",
              recurring: { interval: "month" },
            },
          },
        ],
      },
    });

    const { POST } = await import("@/app/api/billing/upgrade/route");
    const response = await POST(
      new Request("http://localhost/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_plan_id: "pro", billing_cycle: "monthly" }),
      }) as any
    );

    expect(response.status).toBe(200);
    expect(stripe.subscriptionSchedules.release).toHaveBeenCalledWith("sched_1");
    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_stripe_1", {
      items: [{ id: "item_1", price: "price_pro_monthly" }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
    });
    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: "plan-pro",
        plan_slug: "pro",
        scheduled_plan_id: null,
        scheduled_plan_slug: null,
        stripe_subscription_schedule_id: null,
      })
    );
    expect(syncPropertyBillingToStripe).toHaveBeenCalledWith("owner-1");
    expect(logSubscriptionEvent).toHaveBeenCalled();
  });

  it("programme un downgrade vers le gratuit à la prochaine échéance", async () => {
    const subscriptionsUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const subscriptionsUpdate = vi.fn(() => ({ eq: subscriptionsUpdateEq }));

    sessionClient.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: "owner-1" }, error: null }),
        };
      }

      if (table === "audit_log") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected session table ${table}`);
    });

    let propertyCall = 0;
    serviceClient.from.mockImplementation((table: string) => {
      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "sub-1",
              owner_id: "owner-1",
              plan_slug: "pro",
              billing_cycle: "monthly",
              stripe_subscription_id: "sub_stripe_1",
              properties_count: 1,
              leases_count: 0,
            },
            error: null,
          }),
          update: subscriptionsUpdate,
        };
      }

      if (table === "subscription_plans") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "plan-free",
              slug: "gratuit",
              price_monthly: 0,
              price_yearly: 0,
              max_properties: 1,
              max_leases: 1,
              max_tenants: 1,
            },
            error: null,
          }),
        };
      }

      if (table === "properties") {
        propertyCall += 1;
        const result = propertyCall === 1 ? { count: 1 } : { data: [{ id: "property-1" }] };
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue(result),
        };
      }

      if (table === "leases") {
        let leaseInCalls = 0;
        const leaseBuilder = {
          select: vi.fn(),
          in: vi.fn(),
        };
        leaseBuilder.select.mockReturnValue(leaseBuilder);
        leaseBuilder.in.mockImplementation(() => {
          leaseInCalls += 1;
          if (leaseInCalls >= 2) {
            return Promise.resolve({ count: 0 });
          }
          return leaseBuilder;
        });
        return {
          select: leaseBuilder.select,
          in: leaseBuilder.in,
        };
      }

      throw new Error(`Unexpected service table ${table}`);
    });

    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_stripe_1",
      customer: "cus_1",
      status: "active",
      current_period_end: 1_712_592_000,
      items: { data: [{ id: "item_1", quantity: 1, price: { id: "price_pro_monthly" } }] },
    });
    stripe.subscriptions.update.mockResolvedValue({ id: "sub_stripe_1" });

    const { POST } = await import("@/app/api/billing/downgrade/route");
    const response = await POST(
      new Request("http://localhost/api/billing/downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_plan_id: "gratuit" }),
      }) as any
    );

    expect(response.status).toBe(200);
    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_stripe_1", {
      cancel_at_period_end: true,
    });
    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_at_period_end: true,
        scheduled_plan_id: "plan-free",
        scheduled_plan_slug: "gratuit",
      })
    );
    expect(logSubscriptionEvent).toHaveBeenCalled();
  });
});
