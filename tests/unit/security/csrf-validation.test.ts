/**
 * Tests unitaires - CSRF Token Validation
 *
 * Couvre les correctifs P0 de l'audit BIC2026:
 * - Génération de token CSRF avec HMAC-SHA256
 * - Validation timing-safe
 * - Expiration du token
 * - Rejet des tokens malformés
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Mock process.env pour les tests
const MOCK_SECRET = "a".repeat(32); // 32 chars minimum

describe("CSRF Token Validation", () => {
  beforeAll(() => {
    vi.stubEnv("CSRF_SECRET", MOCK_SECRET);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("génère un token au format value:expiry:signature", async () => {
    const { generateCsrfToken } = await import("@/lib/security/csrf");
    const token = generateCsrfToken();
    
    expect(token).toBeDefined();
    const parts = token.split(":");
    expect(parts.length).toBe(3);
    
    // value = hex string (64 chars pour 32 bytes)
    expect(parts[0]).toMatch(/^[a-f0-9]{64}$/);
    // expiry = timestamp number
    expect(Number(parts[1])).toBeGreaterThan(Date.now());
    // signature = hex string (64 chars pour SHA-256)
    expect(parts[2]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("valide un token fraîchement généré", async () => {
    const { generateCsrfToken, validateCsrfToken } = await import("@/lib/security/csrf");
    const token = generateCsrfToken();
    
    expect(validateCsrfToken(token)).toBe(true);
  });

  it("rejette un token null", async () => {
    const { validateCsrfToken } = await import("@/lib/security/csrf");
    expect(validateCsrfToken(null)).toBe(false);
  });

  it("rejette un token vide", async () => {
    const { validateCsrfToken } = await import("@/lib/security/csrf");
    expect(validateCsrfToken("")).toBe(false);
  });

  it("rejette un token malformé (pas assez de parties)", async () => {
    const { validateCsrfToken } = await import("@/lib/security/csrf");
    expect(validateCsrfToken("abc:def")).toBe(false);
    expect(validateCsrfToken("single")).toBe(false);
  });

  it("rejette un token avec signature falsifiée", async () => {
    const { generateCsrfToken, validateCsrfToken } = await import("@/lib/security/csrf");
    const token = generateCsrfToken();
    const parts = token.split(":");
    
    // Modifier la signature
    const tamperedToken = `${parts[0]}:${parts[1]}:${"f".repeat(64)}`;
    expect(validateCsrfToken(tamperedToken)).toBe(false);
  });

  it("rejette un token avec valeur modifiée", async () => {
    const { generateCsrfToken, validateCsrfToken } = await import("@/lib/security/csrf");
    const token = generateCsrfToken();
    const parts = token.split(":");
    
    // Modifier la valeur du token
    const tamperedToken = `${"0".repeat(64)}:${parts[1]}:${parts[2]}`;
    expect(validateCsrfToken(tamperedToken)).toBe(false);
  });

  it("rejette un token expiré", async () => {
    const { validateCsrfToken } = await import("@/lib/security/csrf");
    
    // Créer un token avec un timestamp passé
    const expiredTimestamp = Date.now() - 1000;
    const fakeToken = `${"a".repeat(64)}:${expiredTimestamp}:${"b".repeat(64)}`;
    expect(validateCsrfToken(fakeToken)).toBe(false);
  });

  it("deux tokens générés sont différents", async () => {
    const { generateCsrfToken } = await import("@/lib/security/csrf");
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    
    expect(token1).not.toBe(token2);
  });
});

describe("validateCsrfFromRequestDetailed", () => {
  beforeAll(() => {
    vi.stubEnv("CSRF_SECRET", MOCK_SECRET);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  const buildRequest = (init: { method?: string; headers?: Record<string, string> } = {}) =>
    new Request("https://example.com/api/admin/subscriptions/gift", {
      method: init.method ?? "POST",
      headers: init.headers ?? {},
    });

  it("accepte un GET sans token (méthode sûre)", async () => {
    const { validateCsrfFromRequestDetailed } = await import("@/lib/security/csrf");
    const result = await validateCsrfFromRequestDetailed(buildRequest({ method: "GET" }));
    expect(result.valid).toBe(true);
  });

  it("accepte un POST avec token valide (header seul)", async () => {
    const { generateCsrfToken, validateCsrfFromRequestDetailed } = await import("@/lib/security/csrf");
    const token = generateCsrfToken();
    const result = await validateCsrfFromRequestDetailed(
      buildRequest({ headers: { "x-csrf-token": token } })
    );
    expect(result.valid).toBe(true);
  });

  it("accepte un POST avec header et cookie identiques (double-submit OK)", async () => {
    const { generateCsrfToken, validateCsrfFromRequestDetailed } = await import("@/lib/security/csrf");
    const token = generateCsrfToken();
    const result = await validateCsrfFromRequestDetailed(
      buildRequest({
        headers: {
          "x-csrf-token": token,
          cookie: `sb-auth=foo; csrf_token=${token}; other=bar`,
        },
      })
    );
    expect(result.valid).toBe(true);
  });

  it("rejette un POST sans header x-csrf-token (missing_header)", async () => {
    const { validateCsrfFromRequestDetailed } = await import("@/lib/security/csrf");
    const result = await validateCsrfFromRequestDetailed(buildRequest());
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("missing_header");
  });

  it("rejette un POST avec header à signature falsifiée (invalid_signature_or_expired)", async () => {
    const { generateCsrfToken, validateCsrfFromRequestDetailed } = await import("@/lib/security/csrf");
    const token = generateCsrfToken();
    const [value, expiry] = token.split(":");
    const tampered = `${value}:${expiry}:${"f".repeat(64)}`;
    const result = await validateCsrfFromRequestDetailed(
      buildRequest({ headers: { "x-csrf-token": tampered } })
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_signature_or_expired");
  });

  it("rejette un POST avec token expiré (invalid_signature_or_expired)", async () => {
    const { validateCsrfFromRequestDetailed } = await import("@/lib/security/csrf");
    const expired = `${"a".repeat(64)}:${Date.now() - 1000}:${"b".repeat(64)}`;
    const result = await validateCsrfFromRequestDetailed(
      buildRequest({ headers: { "x-csrf-token": expired } })
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_signature_or_expired");
  });

  it("rejette un POST avec cookie et header divergents (cookie_mismatch)", async () => {
    const { generateCsrfToken, validateCsrfFromRequestDetailed } = await import("@/lib/security/csrf");
    const tokenHeader = generateCsrfToken();
    const tokenCookie = generateCsrfToken();
    const result = await validateCsrfFromRequestDetailed(
      buildRequest({
        headers: {
          "x-csrf-token": tokenHeader,
          cookie: `csrf_token=${tokenCookie}`,
        },
      })
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("cookie_mismatch");
  });
});

describe("CSRF Secret Validation", () => {
  it("rejette un secret trop court", async () => {
    vi.stubEnv("CSRF_SECRET", "short");
    
    // Réimporter le module pour avoir le nouveau env
    vi.resetModules();
    const { generateCsrfToken } = await import("@/lib/security/csrf");
    
    expect(() => generateCsrfToken()).toThrow("at least 32 characters");
    vi.unstubAllEnvs();
  });

  it("rejette l'absence de secret", async () => {
    vi.stubEnv("CSRF_SECRET", "");
    vi.resetModules();
    const { generateCsrfToken } = await import("@/lib/security/csrf");
    
    expect(() => generateCsrfToken()).toThrow();
    vi.unstubAllEnvs();
  });
});
