import { describe, expect, it } from "vitest";
import {
  getInitialInvoiceSettlement,
  getInvoiceSettlement,
  syncInvoiceStatusFromPayments,
} from "@/lib/services/invoice-status.service";

function createMockSupabase({
  invoice,
  payments = [],
  initialInvoice,
  typedInitialInvoice,
}: {
  invoice?: Record<string, unknown> | null;
  payments?: Array<Record<string, unknown>>;
  initialInvoice?: Record<string, unknown> | null;
  typedInitialInvoice?: Record<string, unknown> | null;
}) {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];

  const builder = (table: string) => {
    const filters: Array<{ op: string; column: string; value: unknown }> = [];
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push({ op: "eq", column, value });
        return chain;
      },
      in: (column: string, value: unknown) => {
        filters.push({ op: "in", column, value });
        return chain;
      },
      order: () => chain,
      update: (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return chain;
      },
      maybeSingle: async () => {
        if (table === "invoices") {
          const requestedInitialInvoice = filters.some(
            (filter) => filter.column === "metadata->>type" && filter.value === "initial_invoice"
          );
          const requestedTypedInitialInvoice = filters.some(
            (filter) => filter.column === "type" && filter.value === "initial_invoice"
          );
          if (requestedInitialInvoice) {
            return { data: initialInvoice ?? null };
          }
          if (requestedTypedInitialInvoice) {
            return { data: typedInitialInvoice ?? null };
          }
          return { data: invoice ?? null };
        }
        return { data: null };
      },
      single: async () => {
        if (table === "invoices") {
          return { data: invoice ?? null };
        }
        return { data: null };
      },
      then: undefined,
    };

    if (table === "payments") {
      const paymentsChain = {
        ...chain,
        select: () => paymentsChain,
        eq: (column: string, value: unknown) => {
          filters.push({ op: "eq", column, value });
          return paymentsChain;
        },
        in: (column: string, value: unknown) => {
          filters.push({ op: "in", column, value });
          return Promise.resolve({ data: payments });
        },
      };
      return paymentsChain;
    }

    return chain;
  };

  return {
    updates,
    client: {
      from: (table: string) => builder(table),
    },
  };
}

describe("invoice-status.service", () => {
  it("calcule une facture partiellement payée", async () => {
    const mock = createMockSupabase({
      invoice: { id: "inv_1", montant_total: 1200, statut: "sent", date_paiement: null },
      payments: [{ montant: 400 }],
    });

    const settlement = await getInvoiceSettlement(mock.client as any, "inv_1");

    expect(settlement).not.toBeNull();
    expect(settlement?.totalPaid).toBe(400);
    expect(settlement?.remaining).toBe(800);
    expect(settlement?.status).toBe("partial");
    expect(settlement?.isSettled).toBe(false);
  });

  it("synchronise une facture soldée en statut paid", async () => {
    const mock = createMockSupabase({
      invoice: { id: "inv_2", montant_total: 950, statut: "sent", date_paiement: null },
      payments: [{ montant: 500 }, { montant: 450 }],
    });

    const settlement = await syncInvoiceStatusFromPayments(mock.client as any, "inv_2", "2026-03-13");

    expect(settlement?.status).toBe("paid");
    expect(settlement?.isSettled).toBe(true);
    expect(mock.updates).toEqual([
      {
        table: "invoices",
        values: {
          statut: "paid",
          date_paiement: "2026-03-13",
        },
      },
    ]);
  });

  it("résout la facture initiale d'un bail et son règlement", async () => {
    const mock = createMockSupabase({
      initialInvoice: { id: "inv_initial" },
      invoice: { id: "inv_initial", montant_total: 700, statut: "sent", date_paiement: null },
      payments: [{ montant: 700 }],
    });

    const settlement = await getInitialInvoiceSettlement(mock.client as any, "lease_1");

    expect(settlement?.invoice?.id).toBe("inv_initial");
    expect(settlement?.isSettled).toBe(true);
    expect(settlement?.status).toBe("paid");
  });

  it("considère une facture paid sans payments comme réglée", async () => {
    const mock = createMockSupabase({
      invoice: { id: "inv_paid_no_payments", montant_total: 1500, statut: "paid", date_paiement: "2026-03-20" },
      payments: [],
    });

    const settlement = await getInvoiceSettlement(mock.client as any, "inv_paid_no_payments");

    expect(settlement).not.toBeNull();
    expect(settlement?.isSettled).toBe(true);
    expect(settlement?.status).toBe("paid");
    expect(settlement?.remaining).toBe(0);
    expect(settlement?.totalPaid).toBe(0);
  });

  it("retombe sur le champ type quand metadata.type est absent", async () => {
    const mock = createMockSupabase({
      initialInvoice: null,
      typedInitialInvoice: { id: "inv_initial_type" },
      invoice: {
        id: "inv_initial_type",
        montant_total: 540,
        statut: "sent",
        date_paiement: null,
      },
      payments: [{ montant: 200 }],
    });

    const settlement = await getInitialInvoiceSettlement(mock.client as any, "lease_2");

    expect(settlement?.invoice?.id).toBe("inv_initial_type");
    expect(settlement?.status).toBe("partial");
    expect(settlement?.remaining).toBe(340);
  });
});
