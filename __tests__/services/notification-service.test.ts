/**
 * Tests du service notifications (Sprint 6 — extension 3 rôles + email)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks des dépendances --------------------------------------------------

const { mockCreateClient, mockCreateServiceClient, mockSendEmail } = vi.hoisted(() => {
  return {
    mockCreateClient: vi.fn(),
    mockCreateServiceClient: vi.fn(),
    mockSendEmail: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
  createServiceRoleClient: mockCreateServiceClient,
}));

vi.mock("@/lib/emails/resend.service", () => ({
  sendEmail: mockSendEmail,
}));

// Ré-import à chaque test après clear
async function loadService() {
  vi.resetModules();
  return await import("@/lib/services/notification-service");
}

// --- Helpers mock -----------------------------------------------------------

function buildInsertChain(returned: any) {
  return {
    insert: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: returned, error: null }),
    })),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { user_id: "user-x" } }),
  };
}

describe("notifyMessageReceived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds actionUrl for owner with ?conversation=<id>", async () => {
    const insertedNotif = {
      id: "notif-1",
      type: "message_received",
      title: "Message de X",
      message: "Hi",
      profile_id: "p-owner",
      channels: ["in_app"],
      action_url: "/owner/messages?conversation=conv-1",
      created_at: "2026-01-01T00:00:00Z",
    };
    const mockClient = {
      from: vi.fn(() => buildInsertChain(insertedNotif)),
    };
    mockCreateClient.mockResolvedValue(mockClient);
    // Service client inexistant pour ce test (pas de push, pas d'email)
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      })),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null } }) } },
    });

    const { notifyMessageReceived } = await loadService();
    await notifyMessageReceived(
      "p-owner",
      "Alice",
      "Bonjour propriétaire",
      "conv-1",
      "owner",
    );

    // Récupérer l'argument passé à insert
    const insertCall = mockClient.from.mock.results
      .map((r: any) => r.value.insert)
      .find((fn: any) => fn?.mock?.calls?.length > 0);
    expect(insertCall).toBeDefined();
    const payload = insertCall.mock.calls[0][0];
    expect(payload.action_url).toBe("/owner/messages?conversation=conv-1");
    expect(payload.type).toBe("message_received");
  });

  it("builds actionUrl for tenant", async () => {
    const mockClient = {
      from: vi.fn(() => buildInsertChain({ id: "notif-t", type: "message_received" })),
    };
    mockCreateClient.mockResolvedValue(mockClient);
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      })),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null } }) } },
    });

    const { notifyMessageReceived } = await loadService();
    await notifyMessageReceived("p-tenant", "Bob", "Salut", "conv-2", "tenant");

    const payload = mockClient.from.mock.results
      .map((r: any) => r.value.insert)
      .find((fn: any) => fn?.mock?.calls?.length > 0).mock.calls[0][0];
    expect(payload.action_url).toBe("/tenant/messages?conversation=conv-2");
  });

  it("builds actionUrl for provider (Sprint 6 nouveauté)", async () => {
    const mockClient = {
      from: vi.fn(() => buildInsertChain({ id: "notif-p", type: "message_received" })),
    };
    mockCreateClient.mockResolvedValue(mockClient);
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      })),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null } }) } },
    });

    const { notifyMessageReceived } = await loadService();
    await notifyMessageReceived(
      "p-provider",
      "Marie",
      "Intervention demain",
      "conv-3",
      "provider",
    );

    const payload = mockClient.from.mock.results
      .map((r: any) => r.value.insert)
      .find((fn: any) => fn?.mock?.calls?.length > 0).mock.calls[0][0];
    expect(payload.action_url).toBe("/provider/messages?conversation=conv-3");
  });

  it("truncates message preview to 100 chars with ellipsis", async () => {
    const mockClient = {
      from: vi.fn(() => buildInsertChain({ id: "notif-tr", type: "message_received" })),
    };
    mockCreateClient.mockResolvedValue(mockClient);
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      })),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null } }) } },
    });

    const longText = "a".repeat(250);
    const { notifyMessageReceived } = await loadService();
    await notifyMessageReceived("p", "X", longText, "c", "tenant");

    const payload = mockClient.from.mock.results
      .map((r: any) => r.value.insert)
      .find((fn: any) => fn?.mock?.calls?.length > 0).mock.calls[0][0];
    expect(payload.message).toBe("a".repeat(100) + "...");
  });
});
