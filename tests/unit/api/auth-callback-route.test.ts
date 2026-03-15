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

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
});
