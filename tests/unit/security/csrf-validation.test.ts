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
