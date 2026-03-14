import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payments/tenant-payment-flow", () => ({
  isLegacyTenantPaymentRouteEnabled: vi.fn(() => false),
}));

describe("legacy payment routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("retourne 410 sur /api/payments/checkout quand le flux legacy est desactive", async () => {
    const { POST } = await import("@/app/api/payments/checkout/route");

    const response = await POST(
      new Request("http://localhost/api/payments/checkout", {
        method: "POST",
        body: JSON.stringify({ invoiceId: "d1801052-2bd0-49b7-8c7d-b977614be476" }),
      })
    );

    expect(response.status).toBe(410);
    const json = await response.json();
    expect(json.canonical_route).toBe("/api/payments/create-intent");
  });

  it("retourne 410 sur /api/v1/invoices/:iid/payments quand le flux legacy est desactive", async () => {
    const { POST } = await import("@/app/api/v1/invoices/[iid]/payments/route");

    const response = await POST(
      new Request("http://localhost/api/v1/invoices/inv/payments", {
        method: "POST",
        body: JSON.stringify({}),
      }) as any,
      { params: Promise.resolve({ iid: "d1801052-2bd0-49b7-8c7d-b977614be476" }) }
    );

    expect(response.status).toBe(410);
    const json = await response.json();
    expect(json.deprecated).toBe(true);
  });
});
