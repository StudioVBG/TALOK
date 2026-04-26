/**
 * Unit tests for the close-exercise machinery: generateClosingEntry,
 * postAnnualAmortizationEntries and the orchestration in closeExercise.
 *
 * The mock supabase below understands the exact chain shapes the engine
 * uses (from().select().eq().eq()...maybeSingle / single) and returns
 * configurable fixtures so we can drive each test independently.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@supabase/supabase-js", () => ({}));

import {
  generateClosingEntry,
  postAnnualAmortizationEntries,
} from "@/lib/accounting/engine";

interface InsertCall {
  table: string;
  values: Record<string, unknown> | Record<string, unknown>[];
}

type Fixture = unknown;

interface ChainStep {
  filters: Array<{ column: string; value: unknown }>;
  expectedSelectShape?: string;
}

function buildMockSupabase(opts: {
  fixtures: Record<string, Fixture>;
  errors?: Record<string, string>;
  rpcReturn?: unknown;
}) {
  const inserts: InsertCall[] = [];
  let entryIdCounter = 0;

  const lookup = (table: string, op: "single" | "maybeSingle" | "list") => {
    const key = `${table}.${op}`;
    if (opts.errors?.[key]) {
      return { data: null, error: { message: opts.errors[key] } };
    }
    const fixture = opts.fixtures[key] ?? opts.fixtures[table] ?? null;
    return { data: fixture, error: null };
  };

  const buildSelectChain = (table: string): unknown => {
    const step: ChainStep = { filters: [] };

    const chain = {
      eq(column: string, value: unknown) {
        step.filters.push({ column, value });
        return chain;
      },
      ilike(column: string, value: unknown) {
        step.filters.push({ column, value });
        return chain;
      },
      is(column: string, value: unknown) {
        step.filters.push({ column, value });
        return chain;
      },
      in(column: string, value: unknown) {
        step.filters.push({ column, value });
        return chain;
      },
      gte(column: string, value: unknown) {
        step.filters.push({ column, value });
        return chain;
      },
      lte(column: string, value: unknown) {
        step.filters.push({ column, value });
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      single: async () => lookup(table, "single"),
      maybeSingle: async () => lookup(table, "maybeSingle"),
      then: undefined,
    };

    return chain;
  };

  const supabase = {
    rpc: async (name: string) => ({
      data: name === "fn_next_entry_number" ? "CL-2026-0001" : opts.rpcReturn ?? null,
      error: null,
    }),
    from(table: string) {
      return {
        select(_shape: string) {
          // For aggregation queries that return a list, e.g. amortization_lines / entry_lines
          const baseChain = buildSelectChain(table) as Record<string, unknown>;
          const chain: Record<string, unknown> = { ...baseChain };
          // List-style queries terminate at .eq().eq() — provide a thenable
          // shape so `await chain` resolves to the same envelope.
          chain.then = (resolve: (v: unknown) => void) =>
            resolve(lookup(table, "list"));
          return chain;
        },
        insert(values: Record<string, unknown> | Record<string, unknown>[]) {
          inserts.push({ table, values });
          if (Array.isArray(values)) {
            return { error: null };
          }
          return {
            select: () => ({
              single: async () => {
                const id = `${table}-${++entryIdCounter}`;
                return {
                  data: {
                    id,
                    ...(values as Record<string, unknown>),
                    is_validated: false,
                  },
                  error: null,
                };
              },
            }),
          };
        },
        update(values: Record<string, unknown>) {
          return {
            eq: async () => ({ error: null, count: 1, values }),
          };
        },
      };
    },
  };

  return { supabase, inserts };
}

describe("generateClosingEntry", () => {
  beforeEach(() => {
    // no-op: each test builds its own mock
  });

  it("is idempotent — bails out when an auto:closing entry exists", async () => {
    const { supabase, inserts } = buildMockSupabase({
      fixtures: {
        "accounting_entries.maybeSingle": { id: "existing-closing" },
      },
    });

    const result = await generateClosingEntry(
      supabase as never,
      "exo-1",
      "user-1",
    );

    expect(result.entryId).toBe("existing-closing");
    expect(result.lineCount).toBe(0);
    expect(inserts).toHaveLength(0);
  });

  it("returns zero when the exercise has no class 6/7 lines", async () => {
    const { supabase, inserts } = buildMockSupabase({
      fixtures: {
        "accounting_entries.maybeSingle": null,
        "accounting_exercises.single": {
          id: "exo-1",
          entity_id: "ent-1",
          end_date: "2026-12-31",
        },
        "accounting_entry_lines.list": [
          // only balance-sheet accounts — no class 6 / 7
          {
            account_number: "512100",
            debit_cents: 100_00,
            credit_cents: 0,
            accounting_entries: { informational: false },
          },
          {
            account_number: "411000",
            debit_cents: 0,
            credit_cents: 100_00,
            accounting_entries: { informational: false },
          },
        ],
      },
    });

    const result = await generateClosingEntry(
      supabase as never,
      "exo-1",
      "user-1",
    );

    expect(result.entryId).toBeNull();
    expect(result.lineCount).toBe(0);
    expect(inserts.find((i) => i.table === "accounting_entries")).toBeUndefined();
  });

  it("books a profit (revenus > charges) by crediting compte 120", async () => {
    const { supabase, inserts } = buildMockSupabase({
      fixtures: {
        "accounting_entries.maybeSingle": null,
        "accounting_exercises.single": {
          id: "exo-1",
          entity_id: "ent-1",
          end_date: "2026-12-31",
        },
        "accounting_entry_lines.list": [
          // Loyers: 1 200 EUR de credit
          {
            account_number: "706000",
            debit_cents: 0,
            credit_cents: 1_200_00,
            accounting_entries: { informational: false },
          },
          // Charges entretien: 300 EUR de debit
          {
            account_number: "615100",
            debit_cents: 300_00,
            credit_cents: 0,
            accounting_entries: { informational: false },
          },
        ],
      },
    });

    const result = await generateClosingEntry(
      supabase as never,
      "exo-1",
      "user-1",
    );

    // Profit = 1200 - 300 = 900 EUR
    expect(result.netResultCents).toBe(900_00);

    const headerInsert = inserts.find(
      (i) => i.table === "accounting_entries",
    )?.values as Record<string, unknown>;
    expect(headerInsert.source).toBe("auto:closing");
    expect(headerInsert.journal_code).toBe("CL");

    const lineInsert = inserts.find(
      (i) => i.table === "accounting_entry_lines",
    );
    const lines = lineInsert?.values as Array<{
      account_number: string;
      debit_cents: number;
      credit_cents: number;
    }>;

    // 615100 debited 300 zero'd by a 300 credit
    const closeChargeLine = lines.find((l) => l.account_number === "615100")!;
    expect(closeChargeLine.credit_cents).toBe(300_00);

    // 706000 credited 1200 zero'd by a 1200 debit
    const closeRevenueLine = lines.find((l) => l.account_number === "706000")!;
    expect(closeRevenueLine.debit_cents).toBe(1_200_00);

    // 120 absorbs the net result on the credit side (profit)
    const compte120 = lines.find((l) => l.account_number === "120")!;
    expect(compte120.credit_cents).toBe(900_00);
    expect(compte120.debit_cents).toBe(0);

    // Sum balanced
    const totalDebit = lines.reduce((s, l) => s + l.debit_cents, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("books a loss by debiting compte 120", async () => {
    const { supabase, inserts } = buildMockSupabase({
      fixtures: {
        "accounting_entries.maybeSingle": null,
        "accounting_exercises.single": {
          id: "exo-1",
          entity_id: "ent-1",
          end_date: "2026-12-31",
        },
        "accounting_entry_lines.list": [
          {
            account_number: "706000",
            debit_cents: 0,
            credit_cents: 500_00,
            accounting_entries: { informational: false },
          },
          {
            account_number: "615100",
            debit_cents: 800_00,
            credit_cents: 0,
            accounting_entries: { informational: false },
          },
        ],
      },
    });

    const result = await generateClosingEntry(
      supabase as never,
      "exo-1",
      "user-1",
    );

    // Loss = 500 - 800 = -300 EUR
    expect(result.netResultCents).toBe(-300_00);

    const lines = (
      inserts.find((i) => i.table === "accounting_entry_lines")
        ?.values as Array<{
        account_number: string;
        debit_cents: number;
        credit_cents: number;
      }>
    );

    const compte120 = lines.find((l) => l.account_number === "120")!;
    expect(compte120.debit_cents).toBe(300_00);
    expect(compte120.credit_cents).toBe(0);

    const totalDebit = lines.reduce((s, l) => s + l.debit_cents, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("excludes informational entries (micro_foncier mode)", async () => {
    const { supabase, inserts } = buildMockSupabase({
      fixtures: {
        "accounting_entries.maybeSingle": null,
        "accounting_exercises.single": {
          id: "exo-1",
          entity_id: "ent-1",
          end_date: "2026-12-31",
        },
        "accounting_entry_lines.list": [
          // Real revenue
          {
            account_number: "706000",
            debit_cents: 0,
            credit_cents: 1_000_00,
            accounting_entries: { informational: false },
          },
          // Informational entry should be skipped
          {
            account_number: "706000",
            debit_cents: 0,
            credit_cents: 9_999_00,
            accounting_entries: { informational: true },
          },
          {
            account_number: "615100",
            debit_cents: 200_00,
            credit_cents: 0,
            accounting_entries: { informational: false },
          },
        ],
      },
    });

    const result = await generateClosingEntry(
      supabase as never,
      "exo-1",
      "user-1",
    );

    // Only 1000 - 200 = 800 should be considered
    expect(result.netResultCents).toBe(800_00);
  });
});

describe("postAnnualAmortizationEntries", () => {
  it("posts one OD entry per amortization schedule with a matching year", async () => {
    const { supabase, inserts } = buildMockSupabase({
      fixtures: {
        "accounting_exercises.single": {
          id: "exo-1",
          entity_id: "ent-1",
          end_date: "2026-12-31",
        },
        "amortization_schedules.list": [
          { id: "sched-1", component: "gros_oeuvre" },
          { id: "sched-2", component: "facade" },
        ],
        "amortization_lines.maybeSingle": {
          id: "line-1",
          annual_amount_cents: 5_000_00,
        },
        // No prior depreciation entry exists
        "accounting_entries.maybeSingle": null,
      },
    });

    const result = await postAnnualAmortizationEntries(
      supabase as never,
      "exo-1",
      "user-1",
    );

    expect(result.posted).toBe(2);
    expect(result.skipped).toBe(0);

    const entryHeaders = inserts.filter(
      (i) => i.table === "accounting_entries",
    );
    expect(entryHeaders).toHaveLength(2);
    for (const h of entryHeaders) {
      const v = h.values as Record<string, unknown>;
      expect(v.source).toBe("auto:depreciation");
      expect(v.journal_code).toBe("OD");
    }

    const lineInserts = inserts.filter(
      (i) => i.table === "accounting_entry_lines",
    );
    expect(lineInserts).toHaveLength(2);
    for (const l of lineInserts) {
      const lines = l.values as Array<{
        account_number: string;
        debit_cents: number;
        credit_cents: number;
      }>;
      // D 681100 / C 281xxx
      const debit = lines.find((x) => x.debit_cents > 0)!;
      const credit = lines.find((x) => x.credit_cents > 0)!;
      expect(debit.account_number).toBe("681100");
      expect(debit.debit_cents).toBe(5_000_00);
      expect(credit.account_number.startsWith("281")).toBe(true);
      expect(credit.credit_cents).toBe(5_000_00);
    }
  });

  it("skips when no amortization line exists for the exercise year", async () => {
    const { supabase, inserts } = buildMockSupabase({
      fixtures: {
        "accounting_exercises.single": {
          id: "exo-1",
          entity_id: "ent-1",
          end_date: "2026-12-31",
        },
        "amortization_schedules.list": [
          { id: "sched-1", component: "gros_oeuvre" },
        ],
        "amortization_lines.maybeSingle": null,
      },
    });

    const result = await postAnnualAmortizationEntries(
      supabase as never,
      "exo-1",
      "user-1",
    );

    expect(result.posted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(
      inserts.find((i) => i.table === "accounting_entries"),
    ).toBeUndefined();
  });

  it("is idempotent — skips when a depreciation entry already exists", async () => {
    const { supabase, inserts } = buildMockSupabase({
      fixtures: {
        "accounting_exercises.single": {
          id: "exo-1",
          entity_id: "ent-1",
          end_date: "2026-12-31",
        },
        "amortization_schedules.list": [
          { id: "sched-1", component: "gros_oeuvre" },
        ],
        "amortization_lines.maybeSingle": {
          id: "line-1",
          annual_amount_cents: 5_000_00,
        },
        // Mark the dedup lookup as returning an existing entry
        "accounting_entries.maybeSingle": { id: "already-posted" },
      },
    });

    const result = await postAnnualAmortizationEntries(
      supabase as never,
      "exo-1",
      "user-1",
    );

    expect(result.posted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(
      inserts.find((i) => i.table === "accounting_entries"),
    ).toBeUndefined();
  });
});
