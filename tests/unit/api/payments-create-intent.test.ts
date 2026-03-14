import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUser = { id: "user-1", email: "tenant@test.fr" };

const sessionClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

const serviceClient = {
  from: vi.fn(),
};

const stripeCreate = vi.fn();
const stripeCancel = vi.fn();

function createSelectChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };
}

const profilesChain = createSelectChain();
const serviceInvoicesChain = createSelectChain();
const servicePaymentsChain = createSelectChain();
const serviceLeaseSignersChain = createSelectChain();
const servicePaymentMethodsChain = createSelectChain();

const insertedPayments: Record<string, unknown>[] = [];
const sessionPaymentsInsert = {
  select: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(sessionClient)),
}));

vi.mock("@/lib/supabase/service-client", () => ({
  getServiceClient: vi.fn(() => serviceClient),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    paymentIntents: {
      create: stripeCreate,
      cancel: stripeCancel,
    },
  },
  formatAmountForStripe: (amount: number) => Math.round(amount * 100),
}));

sessionClient.from.mockImplementation((table: string) => {
  if (table === "profiles") return profilesChain;
  if (table === "payments") {
    return {
      insert: vi.fn((payload: Record<string, unknown>) => {
        insertedPayments.push(payload);
        return sessionPaymentsInsert;
      }),
    };
  }

  return createSelectChain();
});

serviceClient.from.mockImplementation((table: string) => {
  if (table === "invoices") return serviceInvoicesChain;
  if (table === "payments") return servicePaymentsChain;
  if (table === "lease_signers") return serviceLeaseSignersChain;
  if (table === "tenant_payment_methods") return servicePaymentMethodsChain;
  return createSelectChain();
});

describe("POST /api/payments/create-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedPayments.length = 0;
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    sessionClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    profilesChain.single.mockResolvedValue({
      data: { id: "tenant-main", role: "tenant" },
      error: null,
    });

    serviceInvoicesChain.single.mockResolvedValue({
      data: {
        id: "inv-1",
        tenant_id: "tenant-main",
        lease_id: "lease-1",
        montant_total: 1000,
        statut: "sent",
        leases: { property_id: "prop-1" },
      },
      error: null,
    });

    servicePaymentsChain.in.mockResolvedValue({
      data: [{ montant: 350 }],
      error: null,
    });

    serviceLeaseSignersChain.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    servicePaymentMethodsChain.maybeSingle.mockResolvedValue({
      data: {
        id: "pm-row-1",
        type: "card",
      },
      error: null,
    });

    stripeCreate.mockResolvedValue({
      id: "pi_test_1",
      client_secret: "secret_test_1",
    });

    stripeCancel.mockResolvedValue({});

    sessionPaymentsInsert.single.mockResolvedValue({
      data: { id: "payment-1" },
      error: null,
    });
  });

  it("utilise le solde restant et ignore le montant envoye par le client", async () => {
    const { POST } = await import("@/app/api/payments/create-intent/route");

    const response = await POST(
      new Request("http://localhost/api/payments/create-intent", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: "0f4f7a1d-7a8f-4ef7-9ca5-f2c784d73fd1",
          amount: 9999,
        }),
      }) as any
    );

    expect(response.status).toBe(200);
    expect(stripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 65000,
      })
    );
    expect(insertedPayments[0]).toEqual(
      expect.objectContaining({
        montant: 650,
      })
    );
  });

  it("autorise un colocataire signataire a payer", async () => {
    profilesChain.single.mockResolvedValueOnce({
      data: { id: "tenant-coloc", role: "tenant" },
      error: null,
    });

    serviceLeaseSignersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: "signer-1" },
      error: null,
    });

    const { POST } = await import("@/app/api/payments/create-intent/route");
    const response = await POST(
      new Request("http://localhost/api/payments/create-intent", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: "0f4f7a1d-7a8f-4ef7-9ca5-f2c784d73fd1",
        }),
      }) as any
    );

    expect(response.status).toBe(200);
    expect(stripeCreate).toHaveBeenCalledOnce();
  });

  it("refuse une facture brouillon", async () => {
    serviceInvoicesChain.single.mockResolvedValueOnce({
      data: {
        id: "inv-1",
        tenant_id: "tenant-main",
        lease_id: "lease-1",
        montant_total: 1000,
        statut: "draft",
        leases: { property_id: "prop-1" },
      },
      error: null,
    });

    const { POST } = await import("@/app/api/payments/create-intent/route");
    const response = await POST(
      new Request("http://localhost/api/payments/create-intent", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: "0f4f7a1d-7a8f-4ef7-9ca5-f2c784d73fd1",
        }),
      }) as any
    );

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toMatch(/payable/i);
  });

  it("refuse un moyen de paiement qui n'appartient pas au locataire", async () => {
    servicePaymentMethodsChain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { POST } = await import("@/app/api/payments/create-intent/route");
    const response = await POST(
      new Request("http://localhost/api/payments/create-intent", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: "0f4f7a1d-7a8f-4ef7-9ca5-f2c784d73fd1",
          paymentMethodId: "pm_fake",
          customerId: "cus_fake",
        }),
      }) as any
    );

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toMatch(/paiement/i);
  });
});
