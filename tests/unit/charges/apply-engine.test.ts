/**
 * Tests unitaires — apply-engine (Sprint 0.d)
 */
import { describe, expect, it } from "vitest";

import { PCG_ACCOUNTS } from "@/lib/charges/constants";
import {
  planSettlementEntry,
  SettlementEntryValidationError,
  type SettlementEntryInput,
} from "@/lib/charges/apply-engine";

const REG_ID = "11111111-2222-3333-4444-555555555555";

function baseInput(
  overrides: Partial<SettlementEntryInput> = {},
): SettlementEntryInput {
  const totalProvisionsCents = 96000;
  const totalActualCents = 201308;
  return {
    regularizationId: REG_ID,
    settlementMethod: "next_rent",
    installmentCount: 1,
    totalProvisionsCents,
    totalActualCents,
    balanceCents: totalActualCents - totalProvisionsCents,
    fiscalYear: 2025,
    leaseLabel: "Bail 42",
    ...overrides,
  };
}

function sumDebits(lines: { debitCents: number }[]): number {
  return lines.reduce((s, l) => s + l.debitCents, 0);
}
function sumCredits(lines: { creditCents: number }[]): number {
  return lines.reduce((s, l) => s + l.creditCents, 0);
}

describe("planSettlementEntry — invariants", () => {
  it("entry is always balanced (sum D = sum C)", () => {
    const scenarios: SettlementEntryInput[] = [
      baseInput({ settlementMethod: "stripe" }),
      baseInput({ settlementMethod: "next_rent" }),
      baseInput({
        settlementMethod: "installments_12",
        installmentCount: 12,
      }),
      baseInput({ settlementMethod: "waived" }),
      baseInput({
        settlementMethod: "deduction",
        totalActualCents: 87258,
        balanceCents: 87258 - 96000,
      }),
    ];
    for (const input of scenarios) {
      const plan = planSettlementEntry(input);
      expect(sumDebits(plan.lines)).toBe(sumCredits(plan.lines));
    }
  });

  it("every line is either debit-only or credit-only, never both, never zero", () => {
    const plan = planSettlementEntry(baseInput());
    for (const line of plan.lines) {
      const hasDebit = line.debitCents > 0;
      const hasCredit = line.creditCents > 0;
      expect(hasDebit !== hasCredit).toBe(true); // XOR
    }
  });

  it("label and pieceRef are deterministic from regularizationId + fiscalYear", () => {
    const plan = planSettlementEntry(baseInput());
    expect(plan.label).toBe("Régularisation charges 2025 — Bail 42");
    expect(plan.reference).toBe(REG_ID);
    for (const line of plan.lines) {
      expect(line.pieceRef).toBe("REG-11111111");
    }
  });
});

describe("planSettlementEntry — scénario B (complément, next_rent/stripe)", () => {
  const input = baseInput({ settlementMethod: "next_rent" });
  const prov = input.totalProvisionsCents;
  const balance = input.balanceCents;
  const actual = input.totalActualCents;

  it("uses the 3 expected accounts", () => {
    const plan = planSettlementEntry(input);
    const accounts = plan.lines.map((l) => l.accountNumber).sort();
    expect(accounts).toEqual(
      [
        PCG_ACCOUNTS.PROVISIONS_RECUES,
        PCG_ACCOUNTS.LOCATAIRE,
        PCG_ACCOUNTS.CHARGES_REFACTUREES,
      ].sort(),
    );
  });

  it("DB 419100 prov / DB 411000 balance / CR 708000 actual", () => {
    const plan = planSettlementEntry(input);
    const byAccount = Object.fromEntries(
      plan.lines.map((l) => [l.accountNumber, l]),
    );
    expect(byAccount[PCG_ACCOUNTS.PROVISIONS_RECUES].debitCents).toBe(prov);
    expect(byAccount[PCG_ACCOUNTS.LOCATAIRE].debitCents).toBe(balance);
    expect(byAccount[PCG_ACCOUNTS.CHARGES_REFACTUREES].creditCents).toBe(
      actual,
    );
  });

  it("stripe variant sets requiresInvoice=true", () => {
    const plan = planSettlementEntry(
      baseInput({ settlementMethod: "stripe" }),
    );
    expect(plan.requiresInvoice).toBe(true);
    expect(plan.requiresInstallmentSchedule).toBe(false);
  });

  it("next_rent does NOT require invoice", () => {
    const plan = planSettlementEntry(input);
    expect(plan.requiresInvoice).toBe(false);
    expect(plan.requiresInstallmentSchedule).toBe(false);
  });
});

describe("planSettlementEntry — scénario C (trop-perçu, deduction)", () => {
  const input = baseInput({
    settlementMethod: "deduction",
    totalActualCents: 87258,
    balanceCents: 87258 - 96000, // -8742
  });

  it("DB 419100 prov / CR 411000 |balance| / CR 708000 actual", () => {
    const plan = planSettlementEntry(input);
    const byAccount = Object.fromEntries(
      plan.lines.map((l) => [l.accountNumber, l]),
    );
    expect(byAccount[PCG_ACCOUNTS.PROVISIONS_RECUES].debitCents).toBe(96000);
    expect(byAccount[PCG_ACCOUNTS.LOCATAIRE].creditCents).toBe(8742);
    expect(byAccount[PCG_ACCOUNTS.CHARGES_REFACTUREES].creditCents).toBe(
      87258,
    );
  });

  it("no invoice, no schedule", () => {
    const plan = planSettlementEntry(input);
    expect(plan.requiresInvoice).toBe(false);
    expect(plan.requiresInstallmentSchedule).toBe(false);
  });
});

describe("planSettlementEntry — scénario D (waived)", () => {
  const input = baseInput({ settlementMethod: "waived" });

  it("DB 419100 prov / DB 654000 balance / CR 708000 actual", () => {
    const plan = planSettlementEntry(input);
    const byAccount = Object.fromEntries(
      plan.lines.map((l) => [l.accountNumber, l]),
    );
    expect(byAccount[PCG_ACCOUNTS.PROVISIONS_RECUES].debitCents).toBe(
      input.totalProvisionsCents,
    );
    expect(
      byAccount[PCG_ACCOUNTS.CHARGES_NON_RECUPEREES].debitCents,
    ).toBe(input.balanceCents);
    expect(byAccount[PCG_ACCOUNTS.CHARGES_REFACTUREES].creditCents).toBe(
      input.totalActualCents,
    );
  });
});

describe("planSettlementEntry — scénario E (installments_12)", () => {
  const input = baseInput({
    settlementMethod: "installments_12",
    installmentCount: 12,
  });

  it("même 3 lignes que B", () => {
    const plan = planSettlementEntry(input);
    const accounts = plan.lines.map((l) => l.accountNumber).sort();
    expect(accounts).toEqual(
      [
        PCG_ACCOUNTS.PROVISIONS_RECUES,
        PCG_ACCOUNTS.LOCATAIRE,
        PCG_ACCOUNTS.CHARGES_REFACTUREES,
      ].sort(),
    );
    expect(plan.requiresInstallmentSchedule).toBe(true);
    expect(plan.requiresInvoice).toBe(false);
  });
});

describe("planSettlementEntry — validations", () => {
  it("rejects balance mismatch with actual - provisions", () => {
    expect(() =>
      planSettlementEntry(
        baseInput({
          totalProvisionsCents: 100,
          totalActualCents: 300,
          balanceCents: 999, // wrong
        }),
      ),
    ).toThrow(SettlementEntryValidationError);
  });

  it("rejects non-integer amounts", () => {
    expect(() =>
      planSettlementEntry(
        baseInput({
          totalProvisionsCents: 100.5 as number,
        }),
      ),
    ).toThrow(SettlementEntryValidationError);
  });

  it("rejects negative amounts", () => {
    expect(() =>
      planSettlementEntry(
        baseInput({
          totalProvisionsCents: -1,
          totalActualCents: 100,
          balanceCents: 101,
        }),
      ),
    ).toThrow(SettlementEntryValidationError);
  });

  it("rejects deduction with balance >= 0", () => {
    expect(() =>
      planSettlementEntry(
        baseInput({
          settlementMethod: "deduction",
          // balance positif par défaut
        }),
      ),
    ).toThrow(/deduction.*requires balanceCents < 0/);
  });

  it("rejects next_rent/stripe/waived/installments_12 with balance <= 0", () => {
    const methods: Array<SettlementEntryInput["settlementMethod"]> = [
      "next_rent",
      "stripe",
      "waived",
      "installments_12",
    ];
    for (const method of methods) {
      expect(() =>
        planSettlementEntry(
          baseInput({
            settlementMethod: method,
            installmentCount: method === "installments_12" ? 12 : 1,
            totalActualCents: 500,
            totalProvisionsCents: 500,
            balanceCents: 0,
          }),
        ),
      ).toThrow(/requires balanceCents > 0/);
    }
  });

  it("rejects installments_12 with count < 2", () => {
    expect(() =>
      planSettlementEntry(
        baseInput({
          settlementMethod: "installments_12",
          installmentCount: 1,
        }),
      ),
    ).toThrow(/installments_12 requires installmentCount >= 2/);
  });

  it("rejects installmentCount != 1 for non-installments methods", () => {
    expect(() =>
      planSettlementEntry(
        baseInput({
          settlementMethod: "next_rent",
          installmentCount: 3,
        }),
      ),
    ).toThrow(/installmentCount must be 1/);
  });

  it("rejects installmentCount out of [1, 12]", () => {
    expect(() =>
      planSettlementEntry(
        baseInput({
          settlementMethod: "installments_12",
          installmentCount: 13,
        }),
      ),
    ).toThrow(/installmentCount must be an integer in \[1, 12\]/);
  });
});
