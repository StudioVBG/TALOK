import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: vi.fn(() => Promise.resolve(sessionClient)),
}));

describe("POST /api/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    sessionClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "owner@test.fr" } },
      error: null,
    });
  });

  it("refuse d'activer un forfait payant hors checkout Stripe", async () => {
    const insertSpy = vi.fn();
    const updateSpy = vi.fn();

    sessionClient.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "owner-1", role: "owner" },
            error: null,
          }),
        };
      }

      if (table === "subscription_plans") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "plan-starter",
              slug: "starter",
              name: "Starter",
              price_monthly: 900,
              price_yearly: 9000,
            },
            error: null,
          }),
        };
      }

      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
          insert: insertSpy,
          update: updateSpy,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { POST } = await import("@/app/api/subscriptions/route");
    const response = await POST(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_slug: "starter", billing_cycle: "monthly" }),
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        code: "CHECKOUT_REQUIRED",
      })
    );
    expect(insertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("autorise toujours le plan gratuit sans Stripe", async () => {
    const singleSpy = vi.fn().mockResolvedValue({
      data: {
        id: "sub-1",
        owner_id: "owner-1",
        plan_slug: "gratuit",
        status: "active",
      },
      error: null,
    });

    sessionClient.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "owner-1", role: "owner" },
            error: null,
          }),
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
              name: "Gratuit",
              price_monthly: 0,
              price_yearly: 0,
            },
            error: null,
          }),
        };
      }

      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "sub-1" },
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: singleSpy,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { POST } = await import("@/app/api/subscriptions/route");
    const response = await POST(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_slug: "gratuit", billing_cycle: "monthly" }),
      })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.subscription.status).toBe("active");
  });
});
