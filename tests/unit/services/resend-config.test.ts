import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
const getProviderCredentialsMock = vi.fn();

vi.mock("@/lib/services/credentials-service", () => ({
  getProviderCredentials: getProviderCredentialsMock,
}));

describe("resend-config", () => {
  beforeEach(() => {
    vi.resetModules();
    getProviderCredentialsMock.mockReset();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("priorise la configuration DB et normalise le sous-domaine send.*", async () => {
    process.env.RESEND_API_KEY = "re_env_key";
    process.env.RESEND_FROM_EMAIL = "Talok <noreply@talok.fr>";
    process.env.RESEND_REPLY_TO = "env-support@talok.fr";

    getProviderCredentialsMock.mockResolvedValue({
      apiKey: "re_db_key",
      config: {
        email_from: "Talok <noreply@send.talok.fr>",
        reply_to: "db-support@talok.fr",
      },
      env: "prod",
    });

    const { resolveResendRuntimeConfig } = await import("@/lib/services/resend-config");
    const result = await resolveResendRuntimeConfig();

    expect(result.apiKey).toBe("re_db_key");
    expect(result.fromAddress).toBe("Talok <noreply@talok.fr>");
    expect(result.replyTo).toBe("db-support@talok.fr");
    expect(result.sources.apiKey).toBe("database");
    expect(result.sources.fromAddress).toBe("database");
    expect(result.dbCredentialEnv).toBe("prod");
  });

  it("retombe sur onboarding@resend.dev pour une boite grand public", async () => {
    process.env.EMAIL_FROM = "owner@gmail.com";
    delete process.env.RESEND_FROM_EMAIL;
    getProviderCredentialsMock.mockResolvedValue(null);

    const { resolveResendRuntimeConfig } = await import("@/lib/services/resend-config");
    const result = await resolveResendRuntimeConfig();

    expect(result.fromAddress).toBe("Talok <onboarding@resend.dev>");
    expect(result.sources.fromAddress).toBe("environment");
  });

  it("peut ignorer la DB pour les cas qui fournissent leurs propres credentials", async () => {
    process.env.RESEND_API_KEY = "re_env_key";
    process.env.EMAIL_FROM = "noreply@talok.fr";
    getProviderCredentialsMock.mockResolvedValue({
      apiKey: "re_db_key",
      config: { email_from: "db@talok.fr" },
      env: "prod",
    });

    const { resolveResendRuntimeConfig } = await import("@/lib/services/resend-config");
    const result = await resolveResendRuntimeConfig({
      skipDatabase: true,
      apiKeyOverride: "re_override_key",
    });

    expect(result.apiKey).toBe("re_override_key");
    expect(result.fromAddress).toBe("Talok <noreply@talok.fr>");
    expect(result.sources.apiKey).toBe("environment");
    expect(result.sources.fromAddress).toBe("environment");
  });
});
