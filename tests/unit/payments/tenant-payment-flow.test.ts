import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTenantInvoicePaymentContext,
  isInvoicePayableStatus,
} from "@/lib/payments/tenant-payment-flow";

const mockServiceClient = {
  from: vi.fn(),
};

function createChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
}

const invoicesChain = createChain();
const paymentsChain = createChain();
const leaseSignersChain = createChain();

vi.mock("@/lib/supabase/service-client", () => ({
  getServiceClient: vi.fn(() => mockServiceClient),
}));

mockServiceClient.from.mockImplementation((table: string) => {
  if (table === "invoices") return invoicesChain;
  if (table === "payments") return paymentsChain;
  if (table === "lease_signers") return leaseSignersChain;
  return createChain();
});

describe("tenant-payment-flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    invoicesChain.single.mockResolvedValue({
      data: {
        id: "inv-1",
        tenant_id: "tenant-main",
        lease_id: "lease-1",
        montant_total: 1000,
        statut: "sent",
        leases: { property_id: "prop-1" },
      },
      error: null,
    });

    paymentsChain.in.mockResolvedValue({
      data: [{ montant: 300 }],
      error: null,
    });

    leaseSignersChain.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("autorise les statuts locataire reellement payables", () => {
    expect(isInvoicePayableStatus("sent")).toBe(true);
    expect(isInvoicePayableStatus("late")).toBe(true);
    expect(isInvoicePayableStatus("overdue")).toBe(true);
    expect(isInvoicePayableStatus("partial")).toBe(true);
    expect(isInvoicePayableStatus("unpaid")).toBe(true);
    expect(isInvoicePayableStatus("draft")).toBe(false);
    expect(isInvoicePayableStatus("cancelled")).toBe(false);
    expect(isInvoicePayableStatus("paid")).toBe(false);
    expect(isInvoicePayableStatus(null)).toBe(false);
  });

  it("calcule le solde restant pour le locataire principal", async () => {
    const context = await getTenantInvoicePaymentContext("inv-1", "tenant-main");

    expect(context).not.toBeNull();
    expect(context?.canTenantPay).toBe(true);
    expect(context?.paidAmount).toBe(300);
    expect(context?.remainingAmount).toBe(700);
    expect(context?.isLeaseSigner).toBe(false);
  });

  it("autorise un colocataire signataire a payer la facture", async () => {
    leaseSignersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: "signer-1" },
      error: null,
    });

    const context = await getTenantInvoicePaymentContext("inv-1", "tenant-coloc");

    expect(context).not.toBeNull();
    expect(context?.canTenantPay).toBe(true);
    expect(context?.isLeaseSigner).toBe(true);
    expect(context?.remainingAmount).toBe(700);
  });
});
