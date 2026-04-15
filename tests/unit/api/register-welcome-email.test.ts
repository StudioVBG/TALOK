import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test unit : POST /api/v1/auth/register
 *
 * Vérifie que l'inscription :
 *  - appelle bien supabase.auth.signUp avec emailRedirectTo pointant vers
 *    /auth/callback (c'est Supabase qui envoie l'email de confirmation via
 *    SMTP Resend configuré au niveau projet — pas d'envoi manuel ici)
 *  - N'envoie PAS d'email de bienvenue manuel depuis le handler register,
 *    pour éviter le double email (Supabase natif + Resend API). L'envoi
 *    d'un éventuel email de bienvenue doit être déclenché ailleurs (ex:
 *    après confirmation dans /auth/callback).
 *  - Reste strict sur la validation (rôle inconnu, email déjà utilisé).
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
      table === "agency_profiles" ||
      table === "syndic_profiles"
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

// On mock malgré tout l'email-service : si un jour le handler venait à
// réintroduire un envoi manuel, ce test le détecterait immédiatement.
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

describe("POST /api/v1/auth/register — email de confirmation unique (pas de double email)", () => {
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
    it(`délègue l'email de confirmation à Supabase pour le rôle ${role} (pas d'envoi manuel)`, async () => {
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

      // Laisser les microtasks se résoudre (sendWelcomeEmail était fire-and-forget).
      await new Promise(resolve => setImmediate(resolve));

      // Aucun email manuel ne doit être envoyé depuis le handler register :
      // Supabase envoie son email de confirmation via SMTP Resend, c'est suffisant.
      expect(sendWelcomeEmail).not.toHaveBeenCalled();
    });
  }

  it("refuse un rôle inconnu avant d'appeler signUp", async () => {
    const response = await callRegister(buildBody({ role: "hacker" as any }));

    expect(response.status).toBe(400);
    expect(signUp).not.toHaveBeenCalled();
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("retourne 409 si l'email est déjà utilisé et n'envoie aucun email", async () => {
    signUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "User already registered" },
    });

    const response = await callRegister(buildBody({ role: "owner" }));

    expect(response.status).toBe(409);
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
