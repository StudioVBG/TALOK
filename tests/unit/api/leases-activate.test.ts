import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUser = { id: "user-owner-1", email: "owner@test.fr" };
const insertedOutbox: Array<Record<string, unknown>> = [];

const sessionClient = {
  auth: {
    getUser: vi.fn(),
  },
};

const serviceClient = {
  from: vi.fn(),
};

function createChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    insert: vi.fn((payload: Record<string, unknown>) => {
      insertedOutbox.push(payload);
      return Promise.resolve({ error: null });
    }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(sessionClient)),
}));

vi.mock("@/lib/supabase/service-client", () => ({
  getServiceClient: vi.fn(() => serviceClient),
}));

vi.mock("@/lib/services/invoice-status.service", () => ({
  getInitialInvoiceSettlement: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("POST /api/leases/[id]/activate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedOutbox.length = 0;

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
            data: { id: "owner-profile-1", role: "owner" },
            error: null,
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
                id: "property-1",
                owner_id: "owner-profile-1",
                adresse_complete: "10 rue de Paris",
              },
            },
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === "edl") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "edl-1",
              type: "entree",
              status: "signed",
              completed_date: "2026-03-14",
            },
            error: null,
          }),
        };
      }

      if (table === "key_handovers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "handover-1", confirmed_at: "2026-03-14T10:00:00.000Z" },
            error: null,
          }),
        };
      }

      if (table === "lease_signers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              profile_id: "tenant-profile-1",
              profiles: { user_id: "user-tenant-1" },
            },
            error: null,
          }),
        };
      }

      if (table === "outbox" || table === "audit_log") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertedOutbox.push(payload);
            return Promise.resolve({ error: null });
          }),
        };
      }

      return createChain();
    });
  });

  it("active le bail uniquement quand tous les prérequis sont validés", async () => {
    const { getInitialInvoiceSettlement } = await import(
      "@/lib/services/invoice-status.service"
    );
    vi.mocked(getInitialInvoiceSettlement).mockResolvedValue({
      invoice: {
        id: "inv-initiale-1",
        montant_total: 1200,
        statut: "paid",
        date_paiement: "2026-03-14",
      },
      totalPaid: 1200,
      remaining: 0,
      status: "paid",
      isSettled: true,
    });

    const { POST } = await import("@/app/api/leases/[id]/activate/route");
    const response = await POST(
      new Request("http://localhost/api/leases/lease-1/activate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "lease-1" }) }
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);

    expect(insertedOutbox).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "Lease.Activated",
          payload: expect.objectContaining({
            lease_id: "lease-1",
            tenant_user_id: "user-tenant-1",
            property_address: "10 rue de Paris",
            initial_invoice_id: "inv-initiale-1",
            key_handover_id: "handover-1",
          }),
        }),
      ])
    );
  });
});
