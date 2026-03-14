import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeSetupCreate = vi.fn();

const sessionClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(sessionClient)),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: {
      create: vi.fn().mockResolvedValue({ id: "cus_123" }),
    },
    setupIntents: {
      create: stripeSetupCreate,
    },
  },
  isStripeServerConfigured: vi.fn(() => true),
}));

describe("POST /api/payments/setup-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    sessionClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "tenant@test.fr" } },
      error: null,
    });

    sessionClient.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "profile-1",
              email: "tenant@test.fr",
              prenom: "Jean",
              nom: "Locataire",
              stripe_customer_id: "cus_existing",
            },
            error: null,
          }),
        };
      }

      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    stripeSetupCreate.mockResolvedValue({
      client_secret: "seti_secret_123",
    });
  });

  it("cree un setup intent carte par defaut", async () => {
    const { POST } = await import("@/app/api/payments/setup-intent/route");

    const response = await POST(
      new Request("http://localhost/api/payments/setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }) as any
    );

    expect(response.status).toBe(200);
    expect(stripeSetupCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ["card"],
      })
    );
  });

  it("autorise explicitement le sepa quand il est demande", async () => {
    const { POST } = await import("@/app/api/payments/setup-intent/route");

    await POST(
      new Request("http://localhost/api/payments/setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method_types: ["sepa_debit"] }),
      }) as any
    );

    expect(stripeSetupCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ["sepa_debit"],
      })
    );
  });
});
