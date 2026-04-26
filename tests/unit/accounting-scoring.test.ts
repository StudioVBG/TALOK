import { describe, expect, it } from "vitest";
import {
  scoreTenantPayments,
  type ScoringInvoice,
} from "@/lib/accounting/unpaid-scoring";

const REF = "2026-04-26";

function inv(
  id: string,
  dueDate: string,
  due: number,
  paid: number,
  paidAt: string | null,
): ScoringInvoice {
  return {
    invoiceId: id,
    dueDate,
    amountDueCents: due,
    amountPaidCents: paid,
    paidAt,
  };
}

describe("scoreTenantPayments", () => {
  it("returns medium band with no_history factor when input is empty", () => {
    const result = scoreTenantPayments([], REF);
    expect(result.score).toBe(50);
    expect(result.band).toBe("medium");
    expect(result.factors[0].code).toBe("no_history");
    expect(result.metrics.invoiceCount).toBe(0);
  });

  it("rates an always-on-time tenant as low risk (score 100)", () => {
    const invoices = [
      inv("1", "2026-01-05", 1_000_00, 1_000_00, "2026-01-04"),
      inv("2", "2026-02-05", 1_000_00, 1_000_00, "2026-02-05"),
      inv("3", "2026-03-05", 1_000_00, 1_000_00, "2026-03-05"),
      inv("4", "2026-04-05", 1_000_00, 1_000_00, "2026-04-04"),
    ];
    const result = scoreTenantPayments(invoices, REF);
    expect(result.score).toBe(100);
    expect(result.band).toBe("low");
    expect(result.metrics.unpaidCount).toBe(0);
    expect(result.metrics.maxDaysLate).toBe(0);
  });

  it("penalises occasional lateness (avg ~5 days)", () => {
    const invoices = [
      inv("1", "2026-01-05", 1_000_00, 1_000_00, "2026-01-10"), // 5j
      inv("2", "2026-02-05", 1_000_00, 1_000_00, "2026-02-10"), // 5j
      inv("3", "2026-03-05", 1_000_00, 1_000_00, "2026-03-10"), // 5j
      inv("4", "2026-04-05", 1_000_00, 1_000_00, "2026-04-10"), // 5j
    ];
    const result = scoreTenantPayments(invoices, REF);
    // -10 lateness => 90, but recent deterioration may also fire if rolling
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.band).toBe("low");
    expect(
      result.factors.some((f) => f.code === "occasional_lateness"),
    ).toBe(true);
  });

  it("classifies a tenant with 1 unpaid invoice as high or medium", () => {
    const invoices = [
      inv("1", "2026-01-05", 1_000_00, 1_000_00, "2026-01-05"),
      inv("2", "2026-02-05", 1_000_00, 1_000_00, "2026-02-05"),
      inv("3", "2026-03-05", 1_000_00, 0, null), // unpaid 52 days at REF
      inv("4", "2026-04-05", 1_000_00, 1_000_00, "2026-04-05"),
    ];
    const result = scoreTenantPayments(invoices, REF);
    expect(result.metrics.unpaidCount).toBe(1);
    expect(["high", "medium"]).toContain(result.band);
    expect(result.factors.some((f) => f.code === "unpaid_invoices")).toBe(true);
  });

  it("classifies critical when 2+ unpaid + chronic lateness", () => {
    const invoices = [
      inv("1", "2026-01-05", 1_000_00, 0, null),
      inv("2", "2026-02-05", 1_000_00, 0, null),
      inv("3", "2026-03-05", 1_000_00, 1_000_00, "2026-04-25"), // very late
      inv("4", "2026-04-05", 1_000_00, 0, null),
    ];
    const result = scoreTenantPayments(invoices, REF);
    expect(result.band).toBe("critical");
    expect(result.score).toBeLessThan(40);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("flags partial payments separately", () => {
    const invoices = [
      inv("1", "2026-01-05", 1_000_00, 500_00, "2026-01-05"), // partial
      inv("2", "2026-02-05", 1_000_00, 500_00, "2026-02-05"),
      inv("3", "2026-03-05", 1_000_00, 1_000_00, "2026-03-05"),
      inv("4", "2026-04-05", 1_000_00, 1_000_00, "2026-04-05"),
    ];
    const result = scoreTenantPayments(invoices, REF);
    expect(result.metrics.partialCount).toBe(2);
    expect(result.factors.some((f) => f.code === "partial_payments")).toBe(
      true,
    );
  });

  it("computes totalUnpaidCents correctly across mixed cases", () => {
    const invoices = [
      inv("1", "2026-01-05", 1_000_00, 1_000_00, "2026-01-05"), // ok
      inv("2", "2026-02-05", 1_000_00, 600_00, "2026-02-05"), // partial 400
      inv("3", "2026-03-05", 1_000_00, 0, null), // unpaid 1000
    ];
    const result = scoreTenantPayments(invoices, REF);
    expect(result.metrics.totalUnpaidCents).toBe(1_400_00);
  });

  it("clamps the score within [0, 100]", () => {
    // Stack every penalty at max
    const invoices = [
      inv("1", "2025-01-05", 1_000_00, 0, null),
      inv("2", "2025-02-05", 1_000_00, 200_00, "2026-04-20"),
      inv("3", "2025-03-05", 1_000_00, 0, null),
      inv("4", "2026-01-05", 1_000_00, 0, null),
      inv("5", "2026-02-05", 1_000_00, 0, null),
    ];
    const result = scoreTenantPayments(invoices, REF);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
