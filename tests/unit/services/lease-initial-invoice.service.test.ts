import { describe, expect, it } from "vitest";
import {
  ensureInitialInvoiceForLease,
  isInitialInvoiceRecord,
} from "@/lib/services/lease-initial-invoice.service";

function createBuilder(table: string, state: {
  existingInvoice?: Record<string, unknown> | null;
  typedInvoice?: Record<string, unknown> | null;
  createdInvoice?: Record<string, unknown> | null;
  lease?: Record<string, unknown> | null;
  resolvedTenant?: Record<string, unknown> | null;
  rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }>;
  invoiceLookups: number;
}) {
  const filters: Array<{ column: string; value: unknown }> = [];

  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.push({ column, value });
      return chain;
    },
    order: () => chain,
    maybeSingle: async () => {
      if (table === "invoices") {
        const metadataInitial = filters.some(
          (filter) =>
            filter.column === "metadata->>type" &&
            filter.value === "initial_invoice"
        );
        const typedInitial = filters.some(
          (filter) => filter.column === "type" && filter.value === "initial_invoice"
        );

        if (metadataInitial) {
          state.invoiceLookups += 1;
          if (state.invoiceLookups === 1) {
            return { data: state.existingInvoice ?? null };
          }
          return { data: state.createdInvoice ?? null };
        }

        if (typedInitial) {
          return { data: state.typedInvoice ?? null };
        }
      }

      if (table === "profiles") {
        return { data: state.resolvedTenant ?? null };
      }

      return { data: null };
    },
    single: async () => {
      if (table === "leases") {
        return { data: state.lease ?? null };
      }
      return { data: null };
    },
  };

  return chain;
}

function createMockSupabase(overrides: {
  existingInvoice?: Record<string, unknown> | null;
  typedInvoice?: Record<string, unknown> | null;
  createdInvoice?: Record<string, unknown> | null;
  lease?: Record<string, unknown> | null;
  resolvedTenant?: Record<string, unknown> | null;
} = {}) {
  const state = {
    existingInvoice: overrides.existingInvoice ?? null,
    typedInvoice: overrides.typedInvoice ?? null,
    createdInvoice:
      overrides.createdInvoice ?? {
        id: "inv-created",
        tenant_id: "tenant-1",
        owner_id: "owner-1",
        montant_total: 1450,
        metadata: { type: "initial_invoice", deposit_amount: 800 },
      },
    lease:
      overrides.lease ?? {
        property: { owner_id: "owner-1" },
        signers: [{ profile_id: "tenant-1", role: "locataire_principal" }],
      },
    resolvedTenant: overrides.resolvedTenant ?? { id: "tenant-1" },
    rpcCalls: [] as Array<{ fn: string; args?: Record<string, unknown> }>,
    invoiceLookups: 0,
  };

  return {
    state,
    client: {
      from: (table: string) => createBuilder(table, state),
      rpc: async (fn: string, args?: Record<string, unknown>) => {
        state.rpcCalls.push({ fn, args });
        return { data: null, error: null };
      },
    },
  };
}

describe("lease-initial-invoice.service", () => {
  it("identifie une facture initiale via metadata ou via type", () => {
    expect(
      isInitialInvoiceRecord({ metadata: { type: "initial_invoice" }, type: null })
    ).toBe(true);
    expect(
      isInitialInvoiceRecord({ metadata: null, type: "initial_invoice" })
    ).toBe(true);
    expect(isInitialInvoiceRecord({ metadata: { type: "rent" }, type: "rent" })).toBe(
      false
    );
  });

  it("réutilise la facture initiale existante sans relancer la génération", async () => {
    const mock = createMockSupabase({
      existingInvoice: {
        id: "inv-existing",
        tenant_id: "tenant-1",
        owner_id: "owner-1",
        montant_total: 1325,
        metadata: { type: "initial_invoice", deposit_amount: 700 },
      },
    });

    const result = await ensureInitialInvoiceForLease(mock.client as any, "lease-1");

    expect(result).toEqual({
      invoiceId: "inv-existing",
      tenantProfileId: "tenant-1",
      ownerProfileId: "owner-1",
      amount: 1325,
      depositAmount: 700,
      created: false,
    });
    expect(mock.state.rpcCalls).toEqual([]);
  });

  it("appelle la fonction SQL SSOT quand la facture initiale manque", async () => {
    const mock = createMockSupabase({
      existingInvoice: null,
      createdInvoice: {
        id: "inv-created",
        tenant_id: "tenant-1",
        owner_id: "owner-1",
        montant_total: 1500,
        metadata: { type: "initial_invoice", deposit_amount: 900 },
      },
    });

    const result = await ensureInitialInvoiceForLease(mock.client as any, "lease-2");

    expect(mock.state.rpcCalls).toEqual([
      {
        fn: "generate_initial_signing_invoice",
        args: {
          p_lease_id: "lease-2",
          p_tenant_id: "tenant-1",
          p_owner_id: "owner-1",
        },
      },
    ]);
    expect(result.created).toBe(true);
    expect(result.invoiceId).toBe("inv-created");
    expect(result.depositAmount).toBe(900);
  });
});
