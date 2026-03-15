import { describe, expect, it } from "vitest";
import { resolveReceiptTotalAmount } from "@/lib/services/receipt-amount";

describe("resolveReceiptTotalAmount", () => {
  it("priorise le total de facture pour une quittance finale", () => {
    expect(resolveReceiptTotalAmount(1200, 400)).toBe(1200);
  });

  it("retombe sur le montant du paiement si le total facture est absent", () => {
    expect(resolveReceiptTotalAmount(null, 400)).toBe(400);
  });
});
