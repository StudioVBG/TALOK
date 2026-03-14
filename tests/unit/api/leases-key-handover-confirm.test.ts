import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUser = { id: "user-tenant-1", email: "tenant@test.fr" };
const outboxEvents: Array<Record<string, unknown>> = [];
const leaseUpdates: Array<Record<string, unknown>> = [];

const sessionClient = {
  auth: {
    getUser: vi.fn(),
  },
};

const serviceClient = {
  from: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(sessionClient)),
}));

vi.mock("@/lib/supabase/service-client", () => ({
  getServiceClient: vi.fn(() => serviceClient),
}));

vi.mock("@/lib/services/invoice-status.service", () => ({
  getInitialInvoiceSettlement: vi.fn(),
}));

vi.mock("@/lib/services/signature-proof.service", () => ({
  generateSignatureProof: vi.fn(async () => ({
    proofId: "proof-1",
    timestamp: { iso: "2026-03-14T11:00:00.000Z" },
    signature: { imageData: "omitted" },
    metadata: {
      ipAddress: "127.0.0.1",
      userAgent: "Vitest",
    },
    document: { hash: "hash-1" },
  })),
}));

vi.mock("@/lib/services/final-documents.service", () => ({
  ensureKeyHandoverAttestation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils/ip-address", () => ({
  extractClientIP: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/utils/validate-signature", () => ({
  stripBase64Prefix: vi.fn(() => "base64data"),
}));

vi.mock("@/app/api/leases/[id]/key-handover/utils", () => ({
  verifyHandoverToken: vi.fn(() => ({ leaseId: "lease-1" })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("POST /api/leases/[id]/key-handover/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    outboxEvents.length = 0;
    leaseUpdates.length = 0;

    sessionClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    serviceClient.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "tenant-profile-1",
              role: "tenant",
              prenom: "Nina",
              nom: "Tenant",
              email: "tenant@test.fr",
            },
            error: null,
          }),
        };
      }

      if (table === "key_handovers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "handover-1",
              lease_id: "lease-1",
              token: "token-1",
              keys_list: ["badge", "clé entrée"],
            },
            error: null,
          }),
          update: vi.fn((values: Record<string, unknown>) => {
            leaseUpdates.push(values);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }

      if (table === "leases") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "lease-1",
              statut: "fully_signed",
              date_debut: "2026-03-14",
              property_id: "property-1",
              properties: {
                owner_id: "owner-profile-1",
                adresse_complete: "10 rue de Paris",
              },
            },
            error: null,
          }),
          update: vi.fn((values: Record<string, unknown>) => {
            leaseUpdates.push(values);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }

      if (table === "lease_signers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "signer-1", role: "locataire_principal" },
            error: null,
          }),
        };
      }

      if (table === "edl") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "edl-1", status: "signed" },
            error: null,
          }),
        };
      }

      if (table === "audit_log" || table === "outbox") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            outboxEvents.push(payload);
            return Promise.resolve({ error: null });
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
  });

  it("confirme la remise des clés sans activer implicitement le bail", async () => {
    const { getInitialInvoiceSettlement } = await import(
      "@/lib/services/invoice-status.service"
    );
    vi.mocked(getInitialInvoiceSettlement).mockResolvedValue({
      invoice: {
        id: "inv-1",
        montant_total: 1200,
        statut: "paid",
        date_paiement: "2026-03-14",
      },
      totalPaid: 1200,
      remaining: 0,
      status: "paid",
      isSettled: true,
    });

    const { POST } = await import(
      "@/app/api/leases/[id]/key-handover/confirm/route"
    );
    const response = await POST(
      new Request("http://localhost/api/leases/lease-1/key-handover/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "token-1",
          signature: "data:image/png;base64,AAAA",
          metadata: { screenSize: "1440x900", touchDevice: false },
        }),
      }),
      { params: Promise.resolve({ id: "lease-1" }) }
    );

    expect(response.status).toBe(200);

    expect(leaseUpdates).toHaveLength(1);
    expect(outboxEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "KeyHandover.Confirmed",
          payload: expect.objectContaining({
            lease_id: "lease-1",
            handover_id: "handover-1",
            tenant_profile_id: "tenant-profile-1",
          }),
        }),
      ])
    );
    expect(
      outboxEvents.some((event) => event.event_type === "Lease.Activated")
    ).toBe(false);
  });
});
