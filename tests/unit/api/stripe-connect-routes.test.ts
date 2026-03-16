import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUser = { id: "user-1", email: "owner@test.fr" };
const mockProfile = { id: "profile-1", prenom: "Jean", nom: "Martin", role: "owner" };

const sessionClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

const serviceClient = {
  from: vi.fn(),
};

const connectService = {
  getConnectAccount: vi.fn(),
  createConnectAccount: vi.fn(),
  deleteConnectAccount: vi.fn(),
  createAccountLink: vi.fn(),
  createLoginLink: vi.fn(),
  getAccountBalance: vi.fn(),
  isAccountReady: vi.fn((account: { charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean }) =>
    Boolean(account.charges_enabled && account.payouts_enabled && account.details_submitted)
  ),
};

function createSelectChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createRouteHandlerClient: vi.fn(() => Promise.resolve(sessionClient)),
  createServiceRoleClient: vi.fn(() => serviceClient),
}));

vi.mock("@/lib/stripe/connect.service", () => ({
  connectService,
}));

describe("API Stripe Connect propriétaire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    sessionClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    sessionClient.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
        };
      }

      return createSelectChain();
    });
  });

  it("GET /api/stripe/connect renvoie l'etat enrichi du compte", async () => {
    const connectAccountsChain = createSelectChain();
    connectAccountsChain.maybeSingle.mockResolvedValue({
      data: {
        id: "sca-1",
        profile_id: mockProfile.id,
        stripe_account_id: "acct_123",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        requirements_currently_due: [],
        requirements_eventually_due: [],
        requirements_past_due: [],
        requirements_disabled_reason: null,
        bank_account_last4: null,
        bank_account_bank_name: null,
        created_at: "2026-03-14T10:00:00.000Z",
        onboarding_completed_at: null,
      },
      error: null,
    });

    serviceClient.from.mockImplementation((table: string) => {
      if (table === "stripe_connect_accounts") {
        return {
          ...connectAccountsChain,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      return createSelectChain();
    });

    connectService.getConnectAccount.mockResolvedValue({
      id: "acct_123",
      type: "express",
      country: "FR",
      default_currency: "eur",
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: true,
      requirements: {
        currently_due: ["external_account"],
        eventually_due: [],
        past_due: ["representative.verification.document"],
        disabled_reason: "requirements.past_due",
      },
      external_accounts: {
        data: [{ id: "ba_1", last4: "1234", bank_name: "BNP", currency: "eur" }],
      },
    });

    const { GET } = await import("@/app/api/stripe/connect/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.has_account).toBe(true);
    expect(json.account.is_ready).toBe(false);
    expect(json.account.missing_requirements).toEqual([
      "external_account",
      "representative.verification.document",
    ]);
    expect(json.account.bank_account).toEqual({
      last4: "1234",
      bank_name: "BNP",
    });
  });

  it("POST /api/stripe/connect reprend le compte existant en cas de conflit unique", async () => {
    let maybeSingleCalls = 0;

    serviceClient.from.mockImplementation((table: string) => {
      if (table === "stripe_connect_accounts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => {
            maybeSingleCalls += 1;
            if (maybeSingleCalls === 1) {
              return Promise.resolve({ data: null, error: null });
            }

            return Promise.resolve({
              data: { id: "sca-existing", stripe_account_id: "acct_existing" },
              error: null,
            });
          }),
          insert: vi.fn().mockResolvedValue({
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          }),
        };
      }

      return createSelectChain();
    });

    connectService.createConnectAccount.mockResolvedValue({
      id: "acct_new",
      type: "express",
      country: "FR",
      default_currency: "eur",
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    });

    connectService.createAccountLink.mockResolvedValue({
      url: "https://stripe.test/onboarding",
      expires_at: 123456,
    });

    const { POST } = await import("@/app/api/stripe/connect/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_type: "individual" }),
      }) as any
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.is_new_account).toBe(false);
    expect(json.onboarding_url).toBe("https://stripe.test/onboarding");
    expect(connectService.createAccountLink).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_existing",
        type: "account_update",
      })
    );
    expect(connectService.deleteConnectAccount).toHaveBeenCalledWith("acct_new");
  });

  it("POST /api/stripe/connect reprend le compte existant si le doublon est detecte par nom de contrainte", async () => {
    let maybeSingleCalls = 0;

    serviceClient.from.mockImplementation((table: string) => {
      if (table === "stripe_connect_accounts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => {
            maybeSingleCalls += 1;
            if (maybeSingleCalls === 1) {
              return Promise.resolve({ data: null, error: null });
            }

            return Promise.resolve({
              data: { id: "sca-existing", stripe_account_id: "acct_existing" },
              error: null,
            });
          }),
          insert: vi.fn().mockResolvedValue({
            error: {
              message:
                'duplicate key value violates unique constraint "unique_profile_connect"',
            },
          }),
        };
      }

      return createSelectChain();
    });

    connectService.createConnectAccount.mockResolvedValue({
      id: "acct_new",
      type: "express",
      country: "FR",
      default_currency: "eur",
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    });

    connectService.createAccountLink.mockResolvedValue({
      url: "https://stripe.test/onboarding",
      expires_at: 123456,
    });

    const { POST } = await import("@/app/api/stripe/connect/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_type: "individual" }),
      }) as any
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.is_new_account).toBe(false);
    expect(connectService.createAccountLink).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_existing",
        type: "account_update",
      })
    );
    expect(connectService.deleteConnectAccount).toHaveBeenCalledWith("acct_new");
  });

  it("POST /api/stripe/connect reprend le compte existant si le doublon est detecte par message generique", async () => {
    let maybeSingleCalls = 0;

    serviceClient.from.mockImplementation((table: string) => {
      if (table === "stripe_connect_accounts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => {
            maybeSingleCalls += 1;
            if (maybeSingleCalls === 1) {
              return Promise.resolve({ data: null, error: null });
            }

            return Promise.resolve({
              data: { id: "sca-existing", stripe_account_id: "acct_existing" },
              error: null,
            });
          }),
          insert: vi.fn().mockResolvedValue({
            error: { message: "duplicate key value violates unique constraint" },
          }),
        };
      }

      return createSelectChain();
    });

    connectService.createConnectAccount.mockResolvedValue({
      id: "acct_new",
      type: "express",
      country: "FR",
      default_currency: "eur",
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    });

    connectService.createAccountLink.mockResolvedValue({
      url: "https://stripe.test/onboarding",
      expires_at: 123456,
    });

    const { POST } = await import("@/app/api/stripe/connect/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_type: "individual" }),
      }) as any
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.is_new_account).toBe(false);
    expect(connectService.createAccountLink).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_existing",
        type: "account_update",
      })
    );
    expect(connectService.deleteConnectAccount).toHaveBeenCalledWith("acct_new");
  });

  it("POST /api/stripe/connect renvoie une erreur metier si le compte existant reste introuvable apres conflit", async () => {
    let maybeSingleCalls = 0;

    serviceClient.from.mockImplementation((table: string) => {
      if (table === "stripe_connect_accounts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => {
            maybeSingleCalls += 1;
            return Promise.resolve({ data: null, error: null });
          }),
          insert: vi.fn().mockResolvedValue({
            error: {
              message:
                'duplicate key value violates unique constraint "unique_profile_connect"',
            },
          }),
        };
      }

      return createSelectChain();
    });

    connectService.createConnectAccount.mockResolvedValue({
      id: "acct_new",
      type: "express",
      country: "FR",
      default_currency: "eur",
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    });

    const { POST } = await import("@/app/api/stripe/connect/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_type: "individual" }),
      }) as any
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe(
      "Un compte bancaire existe deja pour ce profil. Reprise de l'onboarding impossible pour le moment, veuillez reessayer."
    );
    expect(connectService.createAccountLink).not.toHaveBeenCalled();
    expect(connectService.deleteConnectAccount).toHaveBeenCalledWith("acct_new");
  });

  it("POST /api/stripe/connect sanitise les erreurs base non recuperables", async () => {
    serviceClient.from.mockImplementation((table: string) => {
      if (table === "stripe_connect_accounts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({
            error: { message: 'new row violates check constraint "bank_rule"' },
          }),
        };
      }

      return createSelectChain();
    });

    connectService.createConnectAccount.mockResolvedValue({
      id: "acct_new",
      type: "express",
      country: "FR",
      default_currency: "eur",
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    });

    const { POST } = await import("@/app/api/stripe/connect/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_type: "individual" }),
      }) as any
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe(
      "Impossible de configurer le compte bancaire pour le moment. Veuillez reessayer."
    );
    expect(connectService.createAccountLink).not.toHaveBeenCalled();
    expect(connectService.deleteConnectAccount).toHaveBeenCalledWith("acct_new");
  });

  it("GET /api/stripe/connect/balance renvoie account_not_ready si le KYC est incomplet", async () => {
    serviceClient.from.mockImplementation((table: string) => {
      if (table === "stripe_connect_accounts") {
        const chain = createSelectChain();
        chain.maybeSingle.mockResolvedValue({
          data: {
            stripe_account_id: "acct_123",
            charges_enabled: false,
            payouts_enabled: false,
            details_submitted: true,
            requirements_currently_due: ["external_account"],
            requirements_past_due: [],
            requirements_disabled_reason: null,
          },
          error: null,
        });
        return chain;
      }

      return createSelectChain();
    });

    const { GET } = await import("@/app/api/stripe/connect/balance/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.account_not_ready).toBe(true);
    expect(json.missing_requirements).toEqual(["external_account"]);
    expect(connectService.getAccountBalance).not.toHaveBeenCalled();
  });

  it("GET /api/stripe/connect/balance renvoie un etat stable quand aucun compte n'existe", async () => {
    serviceClient.from.mockImplementation((table: string) => {
      if (table === "stripe_connect_accounts") {
        const chain = createSelectChain();
        chain.maybeSingle.mockResolvedValue({
          data: null,
          error: null,
        });
        return chain;
      }

      return createSelectChain();
    });

    const { GET } = await import("@/app/api/stripe/connect/balance/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.has_account).toBe(false);
    expect(json.account_not_ready).toBe(true);
    expect(json.available).toBe(0);
    expect(connectService.getAccountBalance).not.toHaveBeenCalled();
  });

  it("GET /api/stripe/connect/balance renvoie une erreur controlee si Stripe echoue", async () => {
    serviceClient.from.mockImplementation((table: string) => {
      if (table === "stripe_connect_accounts") {
        const chain = createSelectChain();
        chain.maybeSingle.mockResolvedValue({
          data: {
            stripe_account_id: "acct_123",
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
            requirements_currently_due: [],
            requirements_past_due: [],
            requirements_disabled_reason: null,
          },
          error: null,
        });
        return chain;
      }

      return createSelectChain();
    });

    connectService.getAccountBalance.mockRejectedValue(new Error("Stripe API down"));

    const { GET } = await import("@/app/api/stripe/connect/balance/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json.error).toContain("Stripe API down");
  });

  it("POST /api/stripe/connect/dashboard bloque l'acces tant que le compte n'est pas pret", async () => {
    serviceClient.from.mockImplementation((table: string) => {
      if (table === "stripe_connect_accounts") {
        const chain = createSelectChain();
        chain.single.mockResolvedValue({
          data: {
            stripe_account_id: "acct_123",
            charges_enabled: true,
            payouts_enabled: false,
            details_submitted: true,
            requirements_currently_due: ["external_account"],
            requirements_past_due: [],
            requirements_disabled_reason: "requirements.pending_verification",
          },
          error: null,
        });
        return chain;
      }

      return createSelectChain();
    });

    const { POST } = await import("@/app/api/stripe/connect/dashboard/route");
    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.account_not_ready).toBe(true);
    expect(json.missing_requirements).toEqual(["external_account"]);
    expect(connectService.createLoginLink).not.toHaveBeenCalled();
  });
});
