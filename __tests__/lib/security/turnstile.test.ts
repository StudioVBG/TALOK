import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Unit tests for Turnstile verification
 *
 * Bug fixé : la version précédente faisait fail-closed quand
 * TURNSTILE_SECRET_KEY était absent en production, ce qui bloquait
 * toutes les inscriptions. La nouvelle version laisse passer avec
 * un log CRITICAL afin de ne pas bloquer les utilisateurs légitimes.
 */

describe("verifyTurnstileToken", () => {
  const originalEnv = { ...process.env };
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let fetchSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    if (fetchSpy) fetchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  async function loadTurnstileWith(env: { NODE_ENV?: string; TURNSTILE_SECRET_KEY?: string }) {
    vi.stubEnv("NODE_ENV", env.NODE_ENV ?? "test");
    if (env.TURNSTILE_SECRET_KEY === undefined) {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    } else {
      vi.stubEnv("TURNSTILE_SECRET_KEY", env.TURNSTILE_SECRET_KEY);
    }
    const mod = await import("@/lib/security/turnstile");
    return mod.verifyTurnstileToken;
  }

  describe("when TURNSTILE_SECRET_KEY is not configured", () => {
    it("returns success in development with graceful degradation", async () => {
      const verify = await loadTurnstileWith({ NODE_ENV: "development" });
      const result = await verify("any-token");
      expect(result).toEqual({ success: true });
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("returns success in production but logs CRITICAL error (does not block signup)", async () => {
      const verify = await loadTurnstileWith({ NODE_ENV: "production" });
      const result = await verify(null);
      expect(result).toEqual({ success: true });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("CRITICAL: TURNSTILE_SECRET_KEY absent")
      );
    });

    it("returns success whether a token is provided or not", async () => {
      const verify = await loadTurnstileWith({ NODE_ENV: "production" });
      const withToken = await verify("any-token");
      const withoutToken = await verify(null);
      const withUndefined = await verify(undefined);
      expect(withToken.success).toBe(true);
      expect(withoutToken.success).toBe(true);
      expect(withUndefined.success).toBe(true);
    });
  });

  describe("when TURNSTILE_SECRET_KEY is configured", () => {
    it("rejects requests without a token", async () => {
      const verify = await loadTurnstileWith({
        NODE_ENV: "production",
        TURNSTILE_SECRET_KEY: "secret",
      });
      const result = await verify(null);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/anti-spam/i);
    });

    it("accepts valid tokens verified by Cloudflare", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );
      const verify = await loadTurnstileWith({
        NODE_ENV: "production",
        TURNSTILE_SECRET_KEY: "secret",
      });
      const result = await verify("valid-token");
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("rejects invalid tokens", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), {
          status: 200,
        })
      );
      const verify = await loadTurnstileWith({
        NODE_ENV: "production",
        TURNSTILE_SECRET_KEY: "secret",
      });
      const result = await verify("invalid-token");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/anti-spam/i);
    });

    it("fails closed in production if Cloudflare is unreachable", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
      const verify = await loadTurnstileWith({
        NODE_ENV: "production",
        TURNSTILE_SECRET_KEY: "secret",
      });
      const result = await verify("any-token");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/indisponible/i);
    });

    it("fails open in development if Cloudflare is unreachable", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
      const verify = await loadTurnstileWith({
        NODE_ENV: "development",
        TURNSTILE_SECRET_KEY: "secret",
      });
      const result = await verify("any-token");
      expect(result).toEqual({ success: true });
    });
  });
});
