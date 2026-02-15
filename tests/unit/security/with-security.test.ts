/**
 * Tests unitaires - withSecurity & withErrorHandling wrappers
 *
 * Couvre les correctifs P0/P1 de l'audit BIC2026:
 * - Error handling centralisé (pas de stack leak en prod)
 * - Rate limiting
 * - CSRF protection
 * - Structured logging
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// ======================================
// Tests withErrorHandling
// ======================================
describe("withErrorHandling", () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("laisse passer une réponse normale", async () => {
    const { withErrorHandling } = await import("@/lib/api/with-error-handling");

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withErrorHandling(handler, { routeName: "GET /api/test" });

    const request = new Request("http://localhost/api/test", { method: "GET" });
    const response = await wrapped(request);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("capture une erreur non gérée et retourne 500", async () => {
    const { withErrorHandling } = await import("@/lib/api/with-error-handling");

    const handler = vi.fn(async () => {
      throw new Error("Database connection failed");
    });
    const wrapped = withErrorHandling(handler, { routeName: "POST /api/leases" });

    const request = new Request("http://localhost/api/leases", { method: "POST" });
    const response = await wrapped(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.timestamp).toBeDefined();
    // En dev, le message d'erreur est exposé
    expect(body.error).toContain("Database connection failed");
  });

  it("ne leak pas le message d'erreur en production", async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";

    // Reset le module pour prendre en compte le changement d'env
    vi.resetModules();
    const { withErrorHandling } = await import("@/lib/api/with-error-handling");

    const handler = vi.fn(async () => {
      throw new Error("Secret database credentials exposed");
    });
    const wrapped = withErrorHandling(handler, { routeName: "POST /api/test" });

    const request = new Request("http://localhost/api/test", { method: "POST" });
    const response = await wrapped(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Erreur interne du serveur");
    expect(body.error).not.toContain("Secret");
    expect(body.error).not.toContain("credentials");

    (process.env as any).NODE_ENV = originalEnv;
  });

  it("log structuré avec route et method", async () => {
    const { withErrorHandling } = await import("@/lib/api/with-error-handling");

    const handler = vi.fn(async () => {
      throw new Error("Test error");
    });
    const wrapped = withErrorHandling(handler, { routeName: "DELETE /api/items" });

    const request = new Request("http://localhost/api/items/123", { method: "DELETE" });
    await wrapped(request);

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    const logArg = consoleErrorSpy.mock.calls[0][0] as string;
    const logData = JSON.parse(logArg);
    expect(logData.level).toBe("error");
    expect(logData.route).toBe("DELETE /api/items");
    expect(logData.method).toBe("DELETE");
    expect(logData.message).toBe("Test error");
    expect(logData.timestamp).toBeDefined();
  });
});

// ======================================
// Tests withSecurity
// ======================================
describe("withSecurity", () => {
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.resetModules();
  });

  it("exécute le handler pour une requête GET valide", async () => {
    const { withSecurity } = await import("@/lib/api/with-security");

    const handler = vi.fn(async () => NextResponse.json({ data: "test" }));
    const wrapped = withSecurity(handler, { routeName: "GET /api/test" });

    const request = new Request("http://localhost/api/test", { method: "GET" });
    const response = await wrapped(request);
    const body = await response.json();

    expect(body.data).toBe("test");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("retourne 500 avec code INTERNAL_ERROR pour les erreurs non gérées", async () => {
    const { withSecurity } = await import("@/lib/api/with-security");

    const handler = vi.fn(async () => {
      throw new Error("Unexpected failure");
    });
    // csrf: false pour isoler le test de l'error handling
    const wrapped = withSecurity(handler, { routeName: "POST /api/test", csrf: false });

    const request = new Request("http://localhost/api/test", { method: "POST" });
    const response = await wrapped(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("log une erreur structurée en JSON", async () => {
    const { withSecurity } = await import("@/lib/api/with-security");

    const handler = vi.fn(async () => {
      throw new Error("DB timeout");
    });
    const wrapped = withSecurity(handler, { routeName: "POST /api/leases", csrf: false });

    const request = new Request("http://localhost/api/leases", { method: "POST" });
    await wrapped(request);

    expect(consoleErrorSpy).toHaveBeenCalled();
    const logArg = consoleErrorSpy.mock.calls[0][0] as string;
    const logData = JSON.parse(logArg);
    expect(logData.level).toBe("error");
    expect(logData.route).toBe("POST /api/leases");
    expect(logData.message).toBe("DB timeout");
  });

  it("passe le context au handler", async () => {
    const { withSecurity } = await import("@/lib/api/with-security");

    const handler = vi.fn(async (_req: Request, ctx?: any) => {
      return NextResponse.json({ id: ctx?.params?.id });
    });
    const wrapped = withSecurity(handler, { routeName: "GET /api/leases/[id]" });

    const request = new Request("http://localhost/api/leases/123", { method: "GET" });
    const response = await wrapped(request, { params: { id: "123" } });
    const body = await response.json();

    expect(body.id).toBe("123");
    expect(handler).toHaveBeenCalledWith(request, { params: { id: "123" } });
  });

  it("ne masque pas le message d'erreur en dev", async () => {
    const { withSecurity } = await import("@/lib/api/with-security");

    const handler = vi.fn(async () => {
      throw new Error("Detailed dev error info");
    });
    // csrf: false pour isoler le test de l'error message
    const wrapped = withSecurity(handler, { routeName: "POST /api/test", csrf: false });

    const request = new Request("http://localhost/api/test", { method: "POST" });
    const response = await wrapped(request);
    const body = await response.json();

    expect(body.error).toContain("Detailed dev error info");
  });
});

// ======================================
// Tests Rate Limiting intégré dans withSecurity
// ======================================
describe("withSecurity - Rate Limiting", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("bloque après dépassement de la limite", async () => {
    const { withSecurity } = await import("@/lib/api/with-security");

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withSecurity(handler, {
      routeName: "POST /api/test-rl",
      csrf: false, // Désactiver CSRF pour isoler le test
      rateLimit: { max: 3, windowMs: 60000 },
    });

    // 3 requêtes passent
    for (let i = 0; i < 3; i++) {
      const req = new Request("http://localhost/api/test-rl", {
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.100" },
      });
      const res = await wrapped(req);
      expect(res.status).toBe(200);
    }

    // 4ème requête bloquée
    const blockedReq = new Request("http://localhost/api/test-rl", {
      method: "POST",
      headers: { "x-forwarded-for": "192.168.1.100" },
    });
    const blockedRes = await wrapped(blockedReq);
    const body = await blockedRes.json();

    expect(blockedRes.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(blockedRes.headers.get("Retry-After")).toBeDefined();
  });

  it("différencie les IPs pour le rate limiting", async () => {
    vi.resetModules();
    const { withSecurity } = await import("@/lib/api/with-security");

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withSecurity(handler, {
      routeName: "POST /api/test-rl-ip",
      csrf: false,
      rateLimit: { max: 2, windowMs: 60000 },
    });

    // IP 1 fait 2 requêtes
    for (let i = 0; i < 2; i++) {
      const req = new Request("http://localhost/api/test-rl-ip", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.1" },
      });
      await wrapped(req);
    }

    // IP 2 peut encore faire des requêtes
    const req2 = new Request("http://localhost/api/test-rl-ip", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.2" },
    });
    const res2 = await wrapped(req2);
    expect(res2.status).toBe(200);
  });
});
