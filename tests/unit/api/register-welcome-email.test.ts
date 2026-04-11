import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test unit : POST /api/v1/auth/register
 *
 * Vérifie que l'email de bienvenue est bien envoyé pour les 6 rôles supportés
 * (owner, tenant, provider, guarantor, syndic, agency) avec le bon payload
 * et qu'il reste fire-and-forget (une erreur Resend ne doit pas casser
 * l'inscription).
 */

// ---------- Mocks ----------

const signUp = vi.fn();
const sessionClient = {
  auth: { signUp },
};

// Mock ciblé par table pour le client admin.
// profiles.select.eq.maybeSingle → { data: { id: "profile-1" } }
// <role>_profiles.upsert → { error: null }
// audit_log.insert → { error: null }
const adminUpsert = vi.fn().mockResolvedValue({ error: null });
const adminInsert = vi.fn().mockResolvedValue({ error: null });
const adminClient = {
  from: vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "profile-1" },
          error: null,
        }),
      };
    }
    if (
      table === "owner_profiles" ||
      table === "tenant_profiles" ||
      table === "provider_profiles" ||
      table === "guarantor_profiles" ||
      table === "agency_profiles"
    ) {
      return { upsert: adminUpsert };
    }
    if (table === "audit_log") {
      return { insert: adminInsert };
    }
    throw new Error(`Unexpected admin table: ${table}`);
  }),
};

const sendWelcomeEmail = vi.fn().mockResolvedValue({ success: true, id: "msg-1" });

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(sessionClient)),
}));

vi.mock("@/app/api/_lib/supabase", () => ({
  supabaseAdmin: vi.fn(() => adminClient),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/security/turnstile", () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/services/email-service", () => ({
  sendWelcomeEmail: (...args: unknown[]) => sendWelcomeEmail(...args),
}));

vi.mock("@/lib/utils/redirect-url", () => ({
  getAuthCallbackUrl: vi.fn(() => "https://talok.test/auth/callback"),
}));

// ---------- Helpers ----------

const VALID_PASSWORD = "SuperSecret123!";

function buildBody(overrides: Partial<{ email: string; role: string; prenom: string; nom: string }>) {
  return {
    email: "alice@test.fr",
    password: VALID_PASSWORD,
    role: "owner",
    prenom: "Alice",
    nom: "Martin",
    turnstileToken: "dummy-token",
    ...overrides,
  };
}

async function callRegister(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/v1/auth/register/route");
  return POST(
    new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as any
  );
}

// ---------- Tests ----------

describe("POST /api/v1/auth/register — welcome email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signUp.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "alice@test.fr",
          email_confirmed_at: null,
        },
      },
      error: null,
    });
    sendWelcomeEmail.mockResolvedValue({ success: true, id: "msg-1" });
  });

  const ROLES = ["owner", "tenant", "provider", "guarantor", "syndic", "agency"] as const;

  for (const role of ROLES) {
    it(`envoie un welcome email pour le rôle ${role}`, async () => {
      const response = await callRegister(
        buildBody({ role, email: `${role}@test.fr` })
      );

      expect(response.status).toBe(201);
      expect(signUp).toHaveBeenCalledTimes(1);
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: `${role}@test.fr`,
          options: expect.objectContaining({
            data: expect.objectContaining({ role, prenom: "Alice", nom: "Martin" }),
            emailRedirectTo: "https://talok.test/auth/callback",
          }),
        })
      );

      // Le welcome email est fire-and-forget, donc laisser la microtask se résoudre.
      await new Promise(resolve => setImmediate(resolve));

      expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
      expect(sendWelcomeEmail).toHaveBeenCalledWith({
        userEmail: `${role}@test.fr`,
        userName: "Alice",
        role,
      });
    });
  }

  it("n'échoue pas l'inscription si l'envoi du welcome email lève une erreur", async () => {
    sendWelcomeEmail.mockRejectedValueOnce(new Error("Resend down"));

    const response = await callRegister(buildBody({ role: "owner" }));

    expect(response.status).toBe(201);
    await new Promise(resolve => setImmediate(resolve));
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it("refuse un rôle inconnu avant d'appeler signUp", async () => {
    const response = await callRegister(buildBody({ role: "hacker" as any }));

    expect(response.status).toBe(400);
    expect(signUp).not.toHaveBeenCalled();
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("retourne 409 si l'email est déjà utilisé et n'envoie pas d'email", async () => {
    signUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "User already registered" },
    });

    const response = await callRegister(buildBody({ role: "owner" }));

    expect(response.status).toBe(409);
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
