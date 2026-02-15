/**
 * Tests unitaires - Structured Logger
 *
 * Vérifie que les logs sont émis au format JSON structuré
 * parsable par les plateformes de monitoring (Datadog, CloudWatch, etc.)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger, createChildLogger } from "@/lib/logging/structured-logger";

describe("Structured Logger", () => {
  let consoleSpy: Record<string, any>;

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach((spy: any) => spy.mockRestore());
  });

  describe("createLogger", () => {
    it("crée un logger avec un correlationId unique", () => {
      const logger1 = createLogger("GET /api/test1");
      const logger2 = createLogger("GET /api/test2");

      expect(logger1.getCorrelationId()).toBeDefined();
      expect(logger2.getCorrelationId()).toBeDefined();
      expect(logger1.getCorrelationId()).not.toBe(logger2.getCorrelationId());
    });

    it("émet un log info au format JSON", () => {
      const logger = createLogger("POST /api/leases");
      logger.info("Bail créé", { leaseId: "uuid-123" });

      expect(consoleSpy.log).toHaveBeenCalledOnce();
      const logArg = consoleSpy.log.mock.calls[0][0] as string;
      const parsed = JSON.parse(logArg);

      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Bail créé");
      expect(parsed.route).toBe("POST /api/leases");
      expect(parsed.correlationId).toBeDefined();
      expect(parsed.leaseId).toBe("uuid-123");
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("émet un log error via console.error", () => {
      const logger = createLogger("POST /api/payments");
      logger.error("Échec paiement", { stripeError: "card_declined" });

      expect(consoleSpy.error).toHaveBeenCalledOnce();
      const parsed = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(parsed.level).toBe("error");
      expect(parsed.stripeError).toBe("card_declined");
    });

    it("émet un log warn via console.warn", () => {
      const logger = createLogger("POST /api/auth");
      logger.warn("Tentative CSRF détectée");

      expect(consoleSpy.warn).toHaveBeenCalledOnce();
      const parsed = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string);
      expect(parsed.level).toBe("warn");
    });
  });

  describe("setContext", () => {
    it("ajoute userId au contexte des logs suivants", () => {
      const logger = createLogger("GET /api/profile");
      logger.setContext({ userId: "user-abc", profileId: "profile-xyz" });
      logger.info("Profil chargé");

      const parsed = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(parsed.userId).toBe("user-abc");
      expect(parsed.profileId).toBe("profile-xyz");
    });
  });

  describe("complete", () => {
    it("log la durée de la requête en succès", async () => {
      const logger = createLogger("GET /api/properties");

      // Simuler un délai
      await new Promise((resolve) => setTimeout(resolve, 50));

      logger.complete(true, { count: 10 });

      const parsed = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(parsed.message).toBe("request_completed");
      expect(parsed.success).toBe(true);
      expect(parsed.durationMs).toBeGreaterThanOrEqual(40); // au moins 40ms
      expect(parsed.count).toBe(10);
    });

    it("log la durée en erreur", () => {
      const logger = createLogger("POST /api/error-test");
      logger.complete(false, { errorCode: "DB_TIMEOUT" });

      // En cas d'échec, utilise console.error
      expect(consoleSpy.error).toHaveBeenCalledOnce();
      const parsed = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(parsed.message).toBe("request_failed");
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe("DB_TIMEOUT");
    });
  });

  describe("createChildLogger", () => {
    it("hérite du correlationId du parent", () => {
      const parent = createLogger("POST /api/leases");
      const child = createChildLogger(parent, "signature-service");

      expect(child.getCorrelationId()).toBe(parent.getCorrelationId());
    });

    it("émet des logs avec le bon routeName enfant", () => {
      const parent = createLogger("POST /api/leases");
      const child = createChildLogger(parent, "pdf-generator");
      child.info("PDF généré");

      const parsed = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(parsed.route).toBe("pdf-generator");
      expect(parsed.correlationId).toBe(parent.getCorrelationId());
    });
  });

  describe("Request extraction", () => {
    it("extrait les infos de la request", () => {
      const request = new Request("http://localhost/api/test", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.168.1.42",
          "user-agent": "Mozilla/5.0 Test",
        },
      });

      const logger = createLogger("POST /api/test", request);
      logger.info("Test avec request");

      const parsed = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(parsed.route).toBe("POST /api/test");
    });
  });
});
