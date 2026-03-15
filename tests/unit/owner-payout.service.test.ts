import { describe, expect, it, vi } from "vitest";
import {
  normalizeStripePaymentMethod,
  reconcileOwnerTransfer,
} from "@/lib/billing/owner-payout.service";

const { createTransferMock } = vi.hoisted(() => ({
  createTransferMock: vi.fn().mockResolvedValue({ id: "tr_123" }),
}));

vi.mock("@/lib/stripe/connect.service", () => ({
  connectService: {
    createTransfer: createTransferMock,
  },
}));

function createMockSupabase() {
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];

  const chain = (table: string) => ({
    select: () => chain(table),
    eq: (_column: string, value: unknown) => {
      if (table === "stripe_transfers") {
        return {
          maybeSingle: async () => ({ data: null }),
        };
      }

      if (table === "invoices") {
        return {
          maybeSingle: async () => ({ data: { owner_id: "owner_1" } }),
        };
      }

      if (table === "stripe_connect_accounts") {
        return {
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "sca_1",
                stripe_account_id: "acct_123",
                charges_enabled: true,
                payouts_enabled: true,
              },
            }),
          }),
          maybeSingle: async () => ({
            data: {
              id: "sca_1",
              stripe_account_id: "acct_123",
              charges_enabled: true,
              payouts_enabled: true,
            },
          }),
        };
      }

      if (table === "subscriptions") {
        return {
          maybeSingle: async () => ({ data: { plan_slug: "confort" } }),
        };
      }

      return {
        maybeSingle: async () => ({ data: null }),
      };
    },
    insert: (values: Record<string, unknown>) => {
      inserts.push({ table, values });
      return Promise.resolve({ data: null, error: null });
    },
  });

  return {
    inserts,
    client: {
      from: (table: string) => chain(table),
    },
  };
}

describe("owner-payout.service", () => {
  it("normalise les méthodes Stripe", () => {
    expect(normalizeStripePaymentMethod("card")).toBe("cb");
    expect(normalizeStripePaymentMethod("sepa_debit")).toBe("sepa");
    expect(normalizeStripePaymentMethod("bank_transfer")).toBe("virement");
  });

  it("crée un reversement Connect matérialisé", async () => {
    const mock = createMockSupabase();

    const result = await reconcileOwnerTransfer(mock.client as any, {
      paymentId: "payment_1",
      invoiceId: "invoice_1",
      paymentIntentId: "pi_123",
      sourceTransactionId: "ch_123",
      amountCents: 100000,
      paymentMethod: "card",
    });

    expect(result).toEqual({
      created: true,
      transferId: "tr_123",
    });
    expect(mock.inserts).toHaveLength(1);
    expect(mock.inserts[0].table).toBe("stripe_transfers");
    expect(mock.inserts[0].values.net_amount).toBeGreaterThan(0);
    expect(mock.inserts[0].values.platform_fee).toBeGreaterThan(0);
    expect(mock.inserts[0].values.stripe_source_transaction_id).toBe("ch_123");
    expect(createTransferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTransaction: "ch_123",
        idempotencyKey: "owner-transfer:payment_1",
        metadata: expect.objectContaining({
          payment_intent_id: "pi_123",
          source_transaction_id: "ch_123",
        }),
      })
    );
  });
});
