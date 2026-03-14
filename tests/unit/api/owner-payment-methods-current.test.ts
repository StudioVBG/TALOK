import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

const retrieveCustomer = vi.fn();
const listPaymentMethods = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(sessionClient)),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: {
      retrieve: retrieveCustomer,
    },
    paymentMethods: {
      list: listPaymentMethods,
      retrieve: vi.fn(),
    },
  },
}));

describe("GET /api/owner/payment-methods/current", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    sessionClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "owner@test.fr" } },
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

      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { stripe_customer_id: "cus_123" },
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("retourne le moyen de paiement par defaut quand il existe", async () => {
    retrieveCustomer.mockResolvedValue({
      deleted: false,
      invoice_settings: {
        default_payment_method: {
          id: "pm_default",
          card: {
            brand: "visa",
            last4: "4242",
            exp_month: 12,
            exp_year: 2030,
          },
        },
      },
    });

    const { GET } = await import("@/app/api/owner/payment-methods/current/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payment_method).toEqual(
      expect.objectContaining({
        id: "pm_default",
        is_default: true,
        source: "default",
      })
    );
  });

  it("retourne un fallback lisible quand une carte est attachee sans defaut", async () => {
    retrieveCustomer.mockResolvedValue({
      deleted: false,
      invoice_settings: {
        default_payment_method: null,
      },
    });
    listPaymentMethods.mockResolvedValue({
      data: [
        {
          id: "pm_fallback",
          card: {
            brand: "mastercard",
            last4: "5555",
            exp_month: 8,
            exp_year: 2029,
          },
        },
      ],
    });

    const { GET } = await import("@/app/api/owner/payment-methods/current/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payment_method).toEqual(
      expect.objectContaining({
        id: "pm_fallback",
        is_default: false,
        source: "attached_fallback",
      })
    );
    expect(listPaymentMethods).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_123",
        type: "card",
        limit: 1,
      })
    );
  });
});
