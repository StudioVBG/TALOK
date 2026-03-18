import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const getProviderCredentialsMock = vi.fn();

vi.mock("@/lib/services/credentials-service", () => ({
  getProviderCredentials: getProviderCredentialsMock,
  getResendCredentials: vi.fn(),
}));

describe("email-service configuration status", () => {
  beforeEach(() => {
    vi.resetModules();
    getProviderCredentialsMock.mockReset();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("priorise les credentials DB quand ils existent", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://talok.fr";
    process.env.PASSWORD_RESET_COOKIE_SECRET = "12345678901234567890123456789012";
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_API_KEY;

    getProviderCredentialsMock.mockResolvedValue({
      apiKey: "re_db_key",
      config: { email_from: "Talok DB <noreply@talok.fr>" },
      env: "prod",
    });

    const { getEmailConfigurationStatus } = await import("@/lib/services/email-service");
    const status = await getEmailConfigurationStatus();

    expect(status.configured).toBe(true);
    expect(status.canSendLive).toBe(true);
    expect(status.sources.apiKey).toBe("database");
    expect(status.sources.fromAddress).toBe("database");
    expect(status.database.available).toBe(true);
    expect(status.database.credentialEnv).toBe("prod");
    expect(status.resolved.fromAddress).toBe("Talok DB <noreply@talok.fr>");
  });

  it("signale les avertissements critiques quand la config est incomplete", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.PASSWORD_RESET_COOKIE_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_API_KEY;

    getProviderCredentialsMock.mockResolvedValue(null);

    const { getEmailConfigurationStatus } = await import("@/lib/services/email-service");
    const status = await getEmailConfigurationStatus();

    expect(status.configured).toBe(false);
    expect(status.deliveryMode).toBe("simulation");
    expect(status.warnings).toContain(
      "NEXT_PUBLIC_APP_URL est absente: les liens email peuvent etre invalides."
    );
    expect(status.warnings).toContain(
      "PASSWORD_RESET_COOKIE_SECRET est absente: le reset mot de passe utilise un secret de secours non adapte a la production."
    );
    expect(status.warnings).toContain(
      "Aucune cle API email active n'a ete detectee dans l'environnement ni dans Admin > Integrations."
    );
  });
});
