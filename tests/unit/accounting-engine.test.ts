/**
 * Unit tests for the accounting engine: covers the auto-validate flag and
 * the new auto-entries (rent_invoiced, rent_payment_clearing) introduced
 * in the post-audit P0/P1 batch. These tests use an in-memory Supabase
 * mock that records every insert/update so we can assert exactly which
 * rows the engine writes — without booting Postgres.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({}));

import { createAutoEntry, createEntry } from "@/lib/accounting/engine";

interface InsertCall {
  table: string;
  values: Record<string, unknown> | Record<string, unknown>[];
}

interface UpdateCall {
  table: string;
  values: Record<string, unknown>;
  filter: { column: string; value: unknown };
}

function createMockSupabase() {
  const inserts: InsertCall[] = [];
  const updates: UpdateCall[] = [];
  let entryIdCounter = 0;

  const buildInsertChain = (table: string) => ({
    select: () => ({
      single: async () => {
        const id = `entry-${++entryIdCounter}`;
        const last = inserts.find(
          (i) => i.table === table && !Array.isArray(i.values),
        );
        const values = last?.values as Record<string, unknown>;
        return {
          data: {
            id,
            entity_id: values?.entity_id,
            exercise_id: values?.exercise_id,
            journal_code: values?.journal_code,
            entry_number: values?.entry_number,
            entry_date: values?.entry_date,
            label: values?.label,
            source: values?.source ?? null,
            reference: values?.reference ?? null,
            is_validated: false,
            is_locked: false,
            reversal_of: null,
            created_by: values?.created_by,
            created_at: new Date().toISOString(),
          },
          error: null,
        };
      },
    }),
  });

  const supabase = {
    rpc: async () => ({ data: "VE-2026-00001", error: null }),
    from(table: string) {
      return {
        insert(values: Record<string, unknown> | Record<string, unknown>[]) {
          inserts.push({ table, values });
          if (Array.isArray(values)) {
            return { error: null };
          }
          return buildInsertChain(table);
        },
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              updates.push({ table, values, filter: { column, value } });
              return Promise.resolve({ error: null, count: 1 });
            },
          };
        },
      };
    },
  };

  return { supabase, inserts, updates };
}

describe("createEntry", () => {
  const baseParams = {
    entityId: "entity-1",
    exerciseId: "exo-1",
    journalCode: "VE" as const,
    entryDate: "2026-04-26",
    label: "Test entry",
    userId: "user-1",
    lines: [
      { accountNumber: "411000", debitCents: 100_00, creditCents: 0 },
      { accountNumber: "706000", debitCents: 0, creditCents: 100_00 },
    ],
  };

  it("does not auto-validate when autoValidate is omitted", async () => {
    const { supabase, updates } = createMockSupabase();

    await createEntry(supabase as never, baseParams);

    const validations = updates.filter(
      (u) =>
        u.table === "accounting_entries" &&
        (u.values as { is_validated?: boolean }).is_validated === true,
    );
    expect(validations).toHaveLength(0);
  });

  it("calls validateEntry when autoValidate is true", async () => {
    const { supabase, updates } = createMockSupabase();

    await createEntry(supabase as never, {
      ...baseParams,
      autoValidate: true,
    });

    const validations = updates.filter(
      (u) =>
        u.table === "accounting_entries" &&
        (u.values as { is_validated?: boolean }).is_validated === true,
    );
    expect(validations).toHaveLength(1);
    expect(validations[0].values.validated_by).toBe("user-1");
  });

  it("rejects unbalanced lines", async () => {
    const { supabase } = createMockSupabase();
    await expect(
      createEntry(supabase as never, {
        ...baseParams,
        lines: [
          { accountNumber: "411000", debitCents: 100_00, creditCents: 0 },
          { accountNumber: "706000", debitCents: 0, creditCents: 50_00 },
        ],
      }),
    ).rejects.toThrow(/balance/i);
  });

  it("rejects a line with both debit and credit > 0", async () => {
    const { supabase } = createMockSupabase();
    await expect(
      createEntry(supabase as never, {
        ...baseParams,
        lines: [
          { accountNumber: "411000", debitCents: 100_00, creditCents: 50_00 },
          { accountNumber: "706000", debitCents: 0, creditCents: 50_00 },
        ],
      }),
    ).rejects.toThrow(/both debit and credit|debit and credit/i);
  });
});

describe("createAutoEntry", () => {
  const baseContext = {
    entityId: "entity-1",
    exerciseId: "exo-1",
    userId: "user-1",
    amountCents: 1_200_00,
    label: "Loyer avril",
    date: "2026-04-26",
    reference: "ref-42",
  };

  it("auto-validates by default (skipAutoValidate=false)", async () => {
    const { supabase, updates } = createMockSupabase();

    await createAutoEntry(supabase as never, "rent_received", baseContext);

    const validations = updates.filter(
      (u) =>
        u.table === "accounting_entries" &&
        (u.values as { is_validated?: boolean }).is_validated === true,
    );
    expect(validations).toHaveLength(1);
  });

  it("skips validation when skipAutoValidate=true", async () => {
    const { supabase, updates } = createMockSupabase();

    await createAutoEntry(supabase as never, "rent_received", baseContext, {
      skipAutoValidate: true,
    });

    const validations = updates.filter(
      (u) =>
        u.table === "accounting_entries" &&
        (u.values as { is_validated?: boolean }).is_validated === true,
    );
    expect(validations).toHaveLength(0);
  });

  it("posts D 411000 / C 706000 for rent_invoiced (mode IS)", async () => {
    const { supabase, inserts } = createMockSupabase();

    await createAutoEntry(supabase as never, "rent_invoiced", baseContext);

    const lineInsert = inserts.find(
      (i) => i.table === "accounting_entry_lines",
    );
    expect(lineInsert).toBeDefined();
    const lines = lineInsert!.values as Array<{
      account_number: string;
      debit_cents: number;
      credit_cents: number;
    }>;

    expect(lines).toHaveLength(2);
    const debitLine = lines.find((l) => l.debit_cents > 0)!;
    const creditLine = lines.find((l) => l.credit_cents > 0)!;
    expect(debitLine.account_number).toBe("411000");
    expect(debitLine.debit_cents).toBe(1_200_00);
    expect(creditLine.account_number).toBe("706000");
    expect(creditLine.credit_cents).toBe(1_200_00);

    // Header references the source we set
    const header = inserts.find(
      (i) => i.table === "accounting_entries",
    )?.values as Record<string, unknown>;
    expect(header.source).toBe("auto:rent_invoiced");
    expect(header.journal_code).toBe("VE");
  });

  it("posts D 512100 / C 411000 for rent_payment_clearing", async () => {
    const { supabase, inserts } = createMockSupabase();

    await createAutoEntry(
      supabase as never,
      "rent_payment_clearing",
      baseContext,
    );

    const lineInsert = inserts.find(
      (i) => i.table === "accounting_entry_lines",
    );
    expect(lineInsert).toBeDefined();
    const lines = lineInsert!.values as Array<{
      account_number: string;
      debit_cents: number;
      credit_cents: number;
    }>;

    const debitLine = lines.find((l) => l.debit_cents > 0)!;
    const creditLine = lines.find((l) => l.credit_cents > 0)!;
    expect(debitLine.account_number).toBe("512100");
    expect(creditLine.account_number).toBe("411000");

    const header = inserts.find(
      (i) => i.table === "accounting_entries",
    )?.values as Record<string, unknown>;
    expect(header.source).toBe("auto:rent_payment_clearing");
    expect(header.journal_code).toBe("BQ");
  });

  it("uses ctx.bankAccount override when provided for rent_received", async () => {
    const { supabase, inserts } = createMockSupabase();

    await createAutoEntry(supabase as never, "rent_received", {
      ...baseContext,
      bankAccount: "512200", // compte epargne
    });

    const lineInsert = inserts.find(
      (i) => i.table === "accounting_entry_lines",
    );
    const lines = lineInsert!.values as Array<{
      account_number: string;
      debit_cents: number;
    }>;
    const debitLine = lines.find((l) => l.debit_cents > 0)!;
    expect(debitLine.account_number).toBe("512200");
  });

  it("throws on unknown auto-entry events", async () => {
    const { supabase } = createMockSupabase();
    await expect(
      // @ts-expect-error intentional invalid event for runtime guard
      createAutoEntry(supabase as never, "totally_made_up", baseContext),
    ).rejects.toThrow(/unknown/i);
  });
});
