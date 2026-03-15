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

const logSubscriptionEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(sessionClient)),
  createServiceRoleClient: vi.fn(() => serviceClient),
}));

vi.mock("@/lib/subscriptions/subscription-service", () => ({
  logSubscriptionEvent,
}));

describe("POST /api/subscriptions/select-plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    sessionClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "owner@test.fr" } },
      error: null,
    });
  });

  it("trace le choix du forfait gratuit pendant l'onboarding owner", async () => {
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

      throw new Error(`Unexpected session table ${table}`);
    });

    const upsertSpy = vi.fn().mockResolvedValue({ error: null });

    serviceClient.from.mockImplementation((table: string) => {
      if (table === "subscription_plans") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "plan-free",
              slug: "gratuit",
              price_monthly: 0,
              is_active: true,
            },
            error: null,
          }),
        };
      }

      if (table === "subscriptions") {
        return {
          upsert: upsertSpy,
        };
      }

      throw new Error(`Unexpected service table ${table}`);
    });

    const { POST } = await import("@/app/api/subscriptions/select-plan/route");
    const response = await POST(
      new Request("http://localhost/api/subscriptions/select-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_slug: "gratuit" }),
      })
    );

    expect(response.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: "owner-1",
        plan_id: "plan-free",
        plan_slug: "gratuit",
        selected_plan_source: "signup_free",
      }),
      { onConflict: "owner_id" }
    );
    expect(logSubscriptionEvent).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        event_type: "created",
        to_plan: "gratuit",
      })
    );
  });
});
