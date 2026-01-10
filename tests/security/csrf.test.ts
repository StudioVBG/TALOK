/**
 * Tests de sécurité CSRF SOTA 2026
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  generateCsrfToken,
  validateCsrfToken,
  setCsrfCookie,
} from "@/lib/middleware/csrf";

// Mock crypto.subtle pour les tests
const mockCryptoSubtle = {
  importKey: vi.fn().mockResolvedValue("mock-key"),
  sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
};

vi.stubGlobal("crypto", {
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  subtle: mockCryptoSubtle,
});

describe("CSRF Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateCsrfToken", () => {
    it("génère un token de 64 caractères hex", () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it("génère des tokens uniques", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("validateCsrfToken", () => {
    it("valide les requêtes GET sans token", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "GET",
      });

      const result = await validateCsrfToken(request);
      expect(result.valid).toBe(true);
    });

    it("valide les requêtes HEAD sans token", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "HEAD",
      });

      const result = await validateCsrfToken(request);
      expect(result.valid).toBe(true);
    });

    it("valide les requêtes OPTIONS sans token", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "OPTIONS",
      });

      const result = await validateCsrfToken(request);
      expect(result.valid).toBe(true);
    });

    it("rejette POST sans cookie CSRF", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "POST",
        headers: {
          "x-csrf-token": "some-token",
        },
      });

      const result = await validateCsrfToken(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cookie");
    });

    it("rejette POST sans header CSRF", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "POST",
        headers: {
          cookie: "csrf-token=some-token",
        },
      });

      const result = await validateCsrfToken(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("header");
    });

    it("rejette les requêtes avec origin non autorisé", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "POST",
        headers: {
          origin: "http://malicious-site.com",
          host: "localhost",
        },
      });

      const result = await validateCsrfToken(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Origin");
    });

    it("accepte les requêtes same-origin", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          host: "localhost",
          cookie: "csrf-token=valid-token",
          "x-csrf-token": "valid-token",
        },
      });

      // Mock validation réussie
      mockCryptoSubtle.sign.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

      const result = await validateCsrfToken(request);
      expect(result.valid).toBe(true);
    });
  });

  describe("Origin verification", () => {
    it("accepte les requêtes sans origin (same-origin)", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "GET",
      });

      const result = await validateCsrfToken(request);
      expect(result.valid).toBe(true);
    });

    it("accepte localhost", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "GET",
        headers: {
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
      });

      const result = await validateCsrfToken(request);
      expect(result.valid).toBe(true);
    });

    it("accepte les sous-domaines vercel.app", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "GET",
        headers: {
          origin: "https://my-app.vercel.app",
          host: "my-app.vercel.app",
        },
      });

      const result = await validateCsrfToken(request);
      expect(result.valid).toBe(true);
    });
  });
});

describe("Rate Limiting", () => {
  // Import après les mocks
  const { rateLimit, rateLimitPresets, applyRateLimit } = await import(
    "@/lib/middleware/rate-limit"
  );

  beforeEach(() => {
    // Reset le store entre les tests
    vi.useFakeTimers();
  });

  it("permet les premières requêtes", () => {
    const limiter = rateLimit({ windowMs: 60000, maxRequests: 5 });
    const result = limiter("test-user");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("bloque après max requêtes", () => {
    const limiter = rateLimit({ windowMs: 60000, maxRequests: 3 });

    limiter("test-user-2");
    limiter("test-user-2");
    limiter("test-user-2");
    const result = limiter("test-user-2");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("reset après la fenêtre de temps", () => {
    const limiter = rateLimit({ windowMs: 1000, maxRequests: 1 });

    limiter("test-user-3");
    const blocked = limiter("test-user-3");
    expect(blocked.allowed).toBe(false);

    // Avancer le temps
    vi.advanceTimersByTime(1100);

    const allowed = limiter("test-user-3");
    expect(allowed.allowed).toBe(true);
  });

  it("utilise les presets correctement", () => {
    expect(rateLimitPresets.auth.maxRequests).toBe(5);
    expect(rateLimitPresets.auth.windowMs).toBe(15 * 60 * 1000);

    expect(rateLimitPresets.payment.maxRequests).toBe(5);
    expect(rateLimitPresets.payment.windowMs).toBe(60 * 1000);

    expect(rateLimitPresets.api.maxRequests).toBe(60);
  });

  it("retourne une Response 429 quand bloqué", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "test-ip-429",
      },
    });

    // Épuiser les requêtes
    for (let i = 0; i < 5; i++) {
      applyRateLimit(request, "payment", "test-ip-429");
    }

    const response = applyRateLimit(request, "payment", "test-ip-429");

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });
});

describe("API Security Wrapper", () => {
  const { withApiSecurity, securityPresets } = await import(
    "@/lib/middleware/api-security"
  );

  it("ajoute les headers de sécurité", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const wrappedHandler = withApiSecurity(handler, { skipAll: true });
    const request = new NextRequest("http://localhost/api/test");
    const response = await wrappedHandler(request);

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
  });

  it("skip les vérifications pour les webhooks", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const wrappedHandler = withApiSecurity(handler, securityPresets.webhook);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
    });

    const response = await wrappedHandler(request);
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it("applique le rate limiting", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const wrappedHandler = withApiSecurity(handler, { rateLimit: "payment" });

    // Faire beaucoup de requêtes
    for (let i = 0; i < 10; i++) {
      const request = new NextRequest("http://localhost/api/payment", {
        method: "GET",
        headers: {
          "x-forwarded-for": "rate-limit-test-ip",
        },
      });
      await wrappedHandler(request);
    }

    // La dernière devrait être bloquée
    const request = new NextRequest("http://localhost/api/payment", {
      method: "GET",
      headers: {
        "x-forwarded-for": "rate-limit-test-ip",
      },
    });
    const response = await wrappedHandler(request);

    // Après 5 requêtes payment, devrait être bloqué
    expect(response.status).toBe(429);
  });
});
