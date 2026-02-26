/**
 * Tests unitaires - API 2FA identité locataire (request-2fa / verify-2fa)
 * Mocks Supabase, SMS, email et rate-limit.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockUser = { id: "user-1", email: "locataire@test.fr" };
const mockProfile = { id: "profile-1", email: "locataire@test.fr", telephone: "+33612345678" };
const mockRequestRow = {
  id: "req-1",
  profile_id: "profile-1",
  lease_id: "lease-1",
  otp_hash: "mock-hash-123",
  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  verified_at: null,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    })
  ),
}));

const mockServiceClient = {
  from: vi.fn(),
};
const createChain = () => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
});
const profilesChain = createChain();
const identityChain = createChain();
mockServiceClient.from.mockImplementation((table: string) => {
  if (table === "profiles") return profilesChain;
  if (table === "identity_2fa_requests") return identityChain;
  return createChain();
});

vi.mock("@/lib/supabase/service-client", () => ({
  getServiceClient: vi.fn(() => mockServiceClient),
}));

vi.mock("@/lib/services/sms.service", () => ({
  sendOTPSMS: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/email/send-email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/middleware/rate-limit", () => ({
  applyRateLimit: vi.fn().mockReturnValue(null),
}));

describe("POST /api/tenant/identity/request-2fa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profilesChain.single.mockResolvedValue({ data: mockProfile, error: null });
  });

  it("retourne 401 si non authentifié", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as any);

    const { POST } = await import("@/app/api/tenant/identity/request-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/request-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "renew" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("authentifié");
  });

  it("retourne 400 si action invalide", async () => {
    const { POST } = await import("@/app/api/tenant/identity/request-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/request-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invalid" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("invalide");
  });

  it("retourne 404 si profil non trouvé", async () => {
    profilesChain.single.mockResolvedValueOnce({
      data: null,
      error: new Error("not found"),
    });

    const { POST } = await import("@/app/api/tenant/identity/request-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/request-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "renew" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Profil");
  });

  it("retourne 400 si pas d'email (profil et auth vides)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: null } }, error: null }) },
    } as any);

    profilesChain.single.mockResolvedValueOnce({
      data: { id: "profile-1", email: null, telephone: null },
      error: null,
    });

    const { POST } = await import("@/app/api/tenant/identity/request-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/request-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "renew" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email|profil/);
  });

  it("retourne 200 quand profile.email est null mais user.email est présent (fallback auth)", async () => {
    profilesChain.single.mockResolvedValueOnce({
      data: { id: "profile-1", email: null, telephone: null },
      error: null,
    });

    const { POST } = await import("@/app/api/tenant/identity/request-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/request-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lease_id: "lease-1", action: "renew" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe("Code envoyé par email");
    expect(typeof json.token).toBe("string");
  });

  it("retourne 200 avec token et masked_email si envoi email réussi", async () => {
    const { POST } = await import("@/app/api/tenant/identity/request-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/request-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lease_id: "lease-1", action: "renew" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(typeof json.token).toBe("string");
    expect(json.token.length).toBeGreaterThan(0);
    expect(json.message).toBeDefined();
    expect(typeof json.masked_email).toBe("string");
    expect(json.masked_email).toMatch(/@/);
  });
});

describe("POST /api/tenant/identity/verify-2fa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profilesChain.single.mockResolvedValue({
      data: { user_id: mockUser.id },
      error: null,
    });
    identityChain.single.mockResolvedValue({
      data: mockRequestRow,
      error: null,
    });
  });

  it("retourne 401 si non authentifié", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as any);

    const { POST } = await import("@/app/api/tenant/identity/verify-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "abc", otp_code: "123456" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("retourne 400 si token manquant", async () => {
    const { POST } = await import("@/app/api/tenant/identity/verify-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp_code: "123456" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/[Tt]oken/);
  });

  it("retourne 400 si code pas 6 chiffres", async () => {
    const { POST } = await import("@/app/api/tenant/identity/verify-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token", otp_code: "12345" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/6 chiffres|requis/);
  });

  it("retourne 404 si demande 2FA introuvable", async () => {
    identityChain.single.mockResolvedValueOnce({
      data: null,
      error: new Error("not found"),
    });

    const { POST } = await import("@/app/api/tenant/identity/verify-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "unknown", otp_code: "123456" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/invalide|Lien/);
  });

  it("retourne 403 si le profil ne correspond pas à l'utilisateur", async () => {
    profilesChain.single.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { POST } = await import("@/app/api/tenant/identity/verify-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token", otp_code: "123456" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/appartient pas|profil/);
  });

  it("retourne 400 si code OTP incorrect (hash ne correspond pas)", async () => {
    const { POST } = await import("@/app/api/tenant/identity/verify-2fa/route");
    const req = new Request("http://localhost/api/tenant/identity/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token", otp_code: "123456" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/[Cc]ode incorrect/);
  });
});
