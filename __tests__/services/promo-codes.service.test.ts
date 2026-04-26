/**
 * Tests du service codes promo (Option A — Stripe Coupons wrapper).
 *
 * Couvre :
 *  - createPromoCode : sync Stripe↔DB, rollback si DB échoue, rollback si
 *    Promotion Code échoue.
 *  - archivePromoCode : désactivation Stripe, tolérance resource_missing.
 *  - validatePromoCodeForCheckout : plan / territoire / expiration / quotas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks des dépendances --------------------------------------------------

const { mockStripe, mockCreateServiceClient } = vi.hoisted(() => {
  return {
    mockStripe: {
      coupons: {
        create: vi.fn(),
        del: vi.fn(),
      },
      promotionCodes: {
        create: vi.fn(),
        update: vi.fn(),
      },
    },
    mockCreateServiceClient: vi.fn(),
  };
});

vi.mock("@/lib/stripe", () => ({
  stripe: mockStripe,
}));

vi.mock("@/lib/supabase/service-client", () => ({
  createServiceRoleClient: mockCreateServiceClient,
  getServiceClient: mockCreateServiceClient,
}));

async function loadService() {
  vi.resetModules();
  return await import("@/lib/subscriptions/promo-codes.service");
}

// --- Helpers de chaînage Supabase mock --------------------------------------

/**
 * Crée un builder qui capture l'appel final (select/single/insert) et
 * renvoie la réponse configurée.
 */
function buildQueryChain(response: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, any> = {};
  const methods = ["select", "insert", "update", "eq", "order"];
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain);
  });
  chain.single = vi.fn().mockResolvedValue(response);
  chain.maybeSingle = vi.fn().mockResolvedValue(response);
  // When awaited directly (e.g. `await supabase.from(...).select(...).eq(...)`).
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(response).then(resolve);
  chain.head = vi.fn().mockResolvedValue(response);
  return chain;
}

// --- Fixtures ---------------------------------------------------------------

const FIXED_NOW = new Date("2026-04-22T12:00:00Z").getTime();

const BASE_INPUT = {
  code: "DROM2026",
  name: "Campagne DROM",
  description: null,
  discount_type: "percent" as const,
  discount_value: 20,
  applicable_plans: ["confort", "pro"],
  eligible_territories: ["martinique", "guadeloupe"],
  min_billing_cycle: null,
  first_subscription_only: false,
  max_uses: 100,
  max_uses_per_user: 1,
};

// --- Tests ------------------------------------------------------------------

describe("promo-codes.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  describe("createPromoCode", () => {
    it("crée Stripe Coupon + Promotion Code + ligne DB (percent)", async () => {
      mockStripe.coupons.create.mockResolvedValue({ id: "coupon_X1" });
      mockStripe.promotionCodes.create.mockResolvedValue({ id: "promo_P1" });

      const insertedRow = {
        id: "row-1",
        code: "DROM2026",
        stripe_coupon_id: "coupon_X1",
        stripe_promotion_code_id: "promo_P1",
      };
      const chain = buildQueryChain({ data: insertedRow, error: null });
      mockCreateServiceClient.mockReturnValue({ from: () => chain });

      const { createPromoCode } = await loadService();
      const result = await createPromoCode(BASE_INPUT as any, "admin-user-id");

      expect(mockStripe.coupons.create).toHaveBeenCalledWith(
        expect.objectContaining({
          percent_off: 20,
          duration: "once",
        })
      );
      expect(mockStripe.promotionCodes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          coupon: "coupon_X1",
          code: "DROM2026",
          active: true,
        })
      );
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "DROM2026",
          stripe_coupon_id: "coupon_X1",
          stripe_promotion_code_id: "promo_P1",
          applicable_plans: ["confort", "pro"],
          eligible_territories: ["martinique", "guadeloupe"],
          created_by: "admin-user-id",
        })
      );
      expect(result.id).toBe("row-1");
    });

    it("crée un coupon amount_off pour discount_type=fixed", async () => {
      mockStripe.coupons.create.mockResolvedValue({ id: "coupon_X2" });
      mockStripe.promotionCodes.create.mockResolvedValue({ id: "promo_P2" });

      const chain = buildQueryChain({ data: { id: "row-2" }, error: null });
      mockCreateServiceClient.mockReturnValue({ from: () => chain });

      const { createPromoCode } = await loadService();
      await createPromoCode(
        {
          ...BASE_INPUT,
          discount_type: "fixed",
          discount_value: 1000, // 10 €
        } as any,
        "admin"
      );

      expect(mockStripe.coupons.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount_off: 1000,
          currency: "eur",
        })
      );
    });

    it("rollback Stripe si l'INSERT DB échoue", async () => {
      mockStripe.coupons.create.mockResolvedValue({ id: "coupon_rb" });
      mockStripe.promotionCodes.create.mockResolvedValue({ id: "promo_rb" });
      mockStripe.promotionCodes.update.mockResolvedValue({});
      mockStripe.coupons.del.mockResolvedValue({});

      const chain = buildQueryChain({
        data: null,
        error: { message: "db exploded" },
      });
      mockCreateServiceClient.mockReturnValue({ from: () => chain });

      const { createPromoCode } = await loadService();
      await expect(createPromoCode(BASE_INPUT as any, "admin")).rejects.toThrow(
        /db exploded/
      );

      expect(mockStripe.promotionCodes.update).toHaveBeenCalledWith("promo_rb", {
        active: false,
      });
      expect(mockStripe.coupons.del).toHaveBeenCalledWith("coupon_rb");
    });

    it("archive le coupon si la création du Promotion Code échoue", async () => {
      mockStripe.coupons.create.mockResolvedValue({ id: "coupon_pc_fail" });
      mockStripe.promotionCodes.create.mockRejectedValue(new Error("stripe 400"));
      mockStripe.coupons.del.mockResolvedValue({});

      mockCreateServiceClient.mockReturnValue({
        from: () => buildQueryChain({ data: null, error: null }),
      });

      const { createPromoCode } = await loadService();
      await expect(createPromoCode(BASE_INPUT as any, "admin")).rejects.toThrow(
        /stripe 400/
      );

      expect(mockStripe.coupons.del).toHaveBeenCalledWith("coupon_pc_fail");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  describe("archivePromoCode", () => {
    it("désactive Stripe + UPDATE is_active=false", async () => {
      const fetchChain = buildQueryChain({
        data: {
          id: "row-A",
          stripe_promotion_code_id: "promo_A",
          is_active: true,
        },
        error: null,
      });
      const updateChain = buildQueryChain({ data: null, error: null });

      mockCreateServiceClient.mockReturnValue({
        from: vi
          .fn()
          .mockImplementationOnce(() => fetchChain)
          .mockImplementationOnce(() => updateChain),
      });
      mockStripe.promotionCodes.update.mockResolvedValue({});

      const { archivePromoCode } = await loadService();
      await archivePromoCode("row-A");

      expect(mockStripe.promotionCodes.update).toHaveBeenCalledWith("promo_A", {
        active: false,
      });
      expect(updateChain.update).toHaveBeenCalledWith({ is_active: false });
    });

    it("tolère resource_missing côté Stripe (idempotence)", async () => {
      const fetchChain = buildQueryChain({
        data: { id: "row-B", stripe_promotion_code_id: "promo_missing" },
        error: null,
      });
      const updateChain = buildQueryChain({ data: null, error: null });
      mockCreateServiceClient.mockReturnValue({
        from: vi
          .fn()
          .mockImplementationOnce(() => fetchChain)
          .mockImplementationOnce(() => updateChain),
      });

      const stripeErr: Error & { code?: string } = new Error("missing");
      stripeErr.code = "resource_missing";
      mockStripe.promotionCodes.update.mockRejectedValue(stripeErr);

      const { archivePromoCode } = await loadService();
      await expect(archivePromoCode("row-B")).resolves.toBeUndefined();
      expect(updateChain.update).toHaveBeenCalled();
    });

    it("rejette si le code n'existe pas", async () => {
      const chain = buildQueryChain({ data: null, error: { message: "not found" } });
      mockCreateServiceClient.mockReturnValue({ from: () => chain });

      const { archivePromoCode } = await loadService();
      await expect(archivePromoCode("unknown")).rejects.toThrow(/introuvable/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  describe("validatePromoCodeForCheckout", () => {
    const VALID_PROMO = {
      id: "promo-1",
      code: "DROM2026",
      discount_type: "percent",
      discount_value: 20,
      applicable_plans: ["confort", "pro"],
      eligible_territories: ["martinique"],
      min_billing_cycle: null,
      first_subscription_only: false,
      max_uses: 100,
      uses_count: 10,
      max_uses_per_user: 1,
      valid_until: new Date(FIXED_NOW + 24 * 3600 * 1000).toISOString(),
      is_active: true,
      stripe_promotion_code_id: "promo_P1",
      stripe_coupon_id: "coupon_X1",
    };

    function mockSupabaseSequence(responses: Array<{ data: unknown; error: unknown; count?: number }>) {
      let call = 0;
      mockCreateServiceClient.mockReturnValue({
        from: vi.fn(() => {
          const r = responses[Math.min(call, responses.length - 1)];
          call += 1;
          return buildQueryChain(r);
        }),
      });
    }

    it("valide un code applicable au plan + territoire", async () => {
      mockSupabaseSequence([
        { data: VALID_PROMO, error: null }, // promo_codes select
        { data: [], error: null, count: 0 }, // promo_code_uses count
      ]);

      const { validatePromoCodeForCheckout } = await loadService();
      const res = await validatePromoCodeForCheckout("DROM2026", {
        plan_slug: "confort" as any,
        billing_cycle: "monthly",
        user_id: "user-1",
        territoire: "martinique",
      });

      expect(res.valid).toBe(true);
      expect(res.stripe_promotion_code_id).toBe("promo_P1");
    });

    it("rejette si le plan n'est pas dans applicable_plans", async () => {
      mockSupabaseSequence([{ data: VALID_PROMO, error: null }]);
      const { validatePromoCodeForCheckout } = await loadService();
      const res = await validatePromoCodeForCheckout("DROM2026", {
        plan_slug: "starter" as any,
        billing_cycle: "monthly",
        user_id: "user-1",
        territoire: "martinique",
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/plan/i);
    });

    it("rejette si le territoire n'est pas éligible", async () => {
      mockSupabaseSequence([{ data: VALID_PROMO, error: null }]);
      const { validatePromoCodeForCheckout } = await loadService();
      const res = await validatePromoCodeForCheckout("DROM2026", {
        plan_slug: "confort" as any,
        billing_cycle: "monthly",
        user_id: "user-1",
        territoire: "metropole",
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/territoire/i);
    });

    it("rejette si le code est expiré", async () => {
      const expired = {
        ...VALID_PROMO,
        valid_until: new Date(FIXED_NOW - 24 * 3600 * 1000).toISOString(),
      };
      mockSupabaseSequence([{ data: expired, error: null }]);

      vi.setSystemTime(new Date(FIXED_NOW));
      const { validatePromoCodeForCheckout } = await loadService();
      const res = await validatePromoCodeForCheckout("DROM2026", {
        plan_slug: "confort" as any,
        billing_cycle: "monthly",
        user_id: "user-1",
        territoire: "martinique",
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/expir/i);
    });

    it("rejette si le quota global est atteint", async () => {
      const exhausted = { ...VALID_PROMO, max_uses: 10, uses_count: 10 };
      mockSupabaseSequence([{ data: exhausted, error: null }]);
      const { validatePromoCodeForCheckout } = await loadService();
      const res = await validatePromoCodeForCheckout("DROM2026", {
        plan_slug: "confort" as any,
        billing_cycle: "monthly",
        user_id: "user-1",
        territoire: "martinique",
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/épuis/i);
    });

    it("rejette si le user a déjà utilisé le code (max_uses_per_user)", async () => {
      mockSupabaseSequence([
        { data: VALID_PROMO, error: null }, // promo
        { data: [], error: null, count: 1 }, // promo_code_uses count=1 >= max_uses_per_user=1
      ]);

      const { validatePromoCodeForCheckout } = await loadService();
      const res = await validatePromoCodeForCheckout("DROM2026", {
        plan_slug: "confort" as any,
        billing_cycle: "monthly",
        user_id: "user-1",
        territoire: "martinique",
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/déjà utilisé/i);
    });

    it("rejette min_billing_cycle=yearly sur un checkout mensuel", async () => {
      const yearly = { ...VALID_PROMO, min_billing_cycle: "yearly" };
      mockSupabaseSequence([{ data: yearly, error: null }]);
      const { validatePromoCodeForCheckout } = await loadService();
      const res = await validatePromoCodeForCheckout("DROM2026", {
        plan_slug: "confort" as any,
        billing_cycle: "monthly",
        user_id: "user-1",
        territoire: "martinique",
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/annuel/i);
    });
  });
});
