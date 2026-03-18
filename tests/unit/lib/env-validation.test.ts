import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function seedRequiredProductionEnv() {
  process.env.API_KEY_MASTER_KEY = "12345678901234567890123456789012";
  process.env.CSRF_SECRET = "12345678901234567890123456789012";
  process.env.ENCRYPTION_KEY = "12345678901234567890123456789012";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.NEXT_PUBLIC_APP_URL = "https://talok.fr";
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_123";
  process.env.CRON_SECRET = "1234567890abcdef";
  process.env.REVALIDATION_SECRET = "12345678901234567890123456789012";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "redis-token";
  process.env.PASSWORD_RESET_COOKIE_SECRET = "12345678901234567890123456789012";
}

describe("env-validation", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, NODE_ENV: "production" };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("accepte une configuration prod sans RESEND_API_KEY si le projet repose sur le fallback DB", async () => {
    seedRequiredProductionEnv();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_API_KEY;

    const { validateEnvironment } = await import("@/lib/config/env-validation");
    const result = validateEnvironment();

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toContain(
      "No email API key found in environment. Production email delivery must be configured via Admin > Integrations if you rely on DB credentials."
    );
  });

  it("rejette la prod si le secret de cookie du reset mot de passe manque", async () => {
    seedRequiredProductionEnv();
    delete process.env.PASSWORD_RESET_COOKIE_SECRET;

    const { validateEnvironment } = await import("@/lib/config/env-validation");
    const result = validateEnvironment();

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("PASSWORD_RESET_COOKIE_SECRET"))).toBe(true);
  });
});
