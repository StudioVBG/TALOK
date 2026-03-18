import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseClient = {
  auth: {
    exchangeCodeForSession: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(supabaseClient)),
}));

vi.mock("@/lib/helpers/role-redirects", () => ({
  getRoleDashboardUrl: vi.fn(() => "/owner/dashboard"),
}));

const validatePasswordResetRequestForCallback = vi.fn();

vi.mock("@/lib/auth/password-recovery.service", () => ({
  PASSWORD_RESET_COOKIE_NAME: "pw_reset_access",
  createPasswordResetCookieToken: vi.fn(() => "signed-reset-cookie"),
  getPasswordResetCookieOptions: vi.fn(() => ({
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/recovery/password",
    expires: new Date("2026-03-20T10:00:00.000Z"),
  })),
  validatePasswordResetRequestForCallback,
}));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validatePasswordResetRequestForCallback.mockResolvedValue({
      valid: true,
      request: {
        id: "request-1",
        expires_at: "2026-03-20T10:00:00.000Z",
      },
    });

    supabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "owner@test.fr",
          email_confirmed_at: "2026-03-15T10:00:00.000Z",
        },
      },
      error: null,
    });
  });

  it("renvoie l'owner vers /signup/plan tant que le forfait n'est pas choisi", async () => {
    supabaseClient.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "owner-1", role: "owner", onboarding_completed_at: null },
            error: null,
          }),
        };
      }

      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { selected_plan_at: null },
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("http://localhost/auth/callback?code=test"));

    expect(response.headers.get("location")).toBe("http://localhost/signup/plan?role=owner");
  });

  it("envoie l'owner vers son onboarding si le forfait est déjà tracé", async () => {
    supabaseClient.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "owner-1", role: "owner", onboarding_completed_at: null },
            error: null,
          }),
        };
      }

      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { selected_plan_at: "2026-03-15T10:00:00.000Z" },
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("http://localhost/auth/callback?code=test"));

    expect(response.headers.get("location")).toBe("http://localhost/owner/onboarding/profile");
  });

  it("redirige le flux de password recovery vers la page dédiée", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(
      new Request("http://localhost/auth/callback?code=test&flow=pw-reset&rid=request-1")
    );

    expect(validatePasswordResetRequestForCallback).toHaveBeenCalledWith({
      requestId: "request-1",
      userId: "user-1",
    });
    expect(response.headers.get("location")).toBe("http://localhost/recovery/password/request-1");
    expect(response.headers.get("set-cookie")).toContain("pw_reset_access=signed-reset-cookie");
  });
});
