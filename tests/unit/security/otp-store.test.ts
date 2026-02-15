/**
 * Tests unitaires - OTP Store (codes de vérification)
 *
 * Couvre le correctif P1-7 de l'audit BIC2026:
 * - Vérification OTP obligatoire pour signature
 * - Expiration des codes
 * - Limitation des tentatives (anti brute-force)
 * - Suppression après utilisation (one-time use)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setOTP, getOTP, deleteOTP, verifyOTP, otpStore } from "@/lib/services/otp-store";

describe("OTP Store", () => {
  beforeEach(() => {
    // Vider le store entre chaque test
    otpStore.clear();
  });

  describe("setOTP / getOTP", () => {
    it("stocke et récupère un OTP", () => {
      const data = {
        code: "123456",
        phone: "+33612345678",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      };
      setOTP("lease-123", data);
      
      const stored = getOTP("lease-123");
      expect(stored).toBeDefined();
      expect(stored!.code).toBe("123456");
      expect(stored!.phone).toBe("+33612345678");
      expect(stored!.attempts).toBe(0);
    });

    it("retourne undefined pour une clé inexistante", () => {
      expect(getOTP("nonexistent")).toBeUndefined();
    });
  });

  describe("deleteOTP", () => {
    it("supprime un OTP existant", () => {
      setOTP("lease-456", {
        code: "654321",
        phone: "+33600000000",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      });

      expect(deleteOTP("lease-456")).toBe(true);
      expect(getOTP("lease-456")).toBeUndefined();
    });

    it("retourne false pour une clé inexistante", () => {
      expect(deleteOTP("nonexistent")).toBe(false);
    });
  });

  describe("verifyOTP", () => {
    it("valide un code correct", () => {
      setOTP("lease-789", {
        code: "111222",
        phone: "+33611111111",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      });

      const result = verifyOTP("lease-789", "111222");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("supprime le code après une vérification réussie (one-time use)", () => {
      setOTP("lease-otp", {
        code: "111222",
        phone: "+33611111111",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      });

      verifyOTP("lease-otp", "111222");
      
      // Le code a été supprimé
      const secondAttempt = verifyOTP("lease-otp", "111222");
      expect(secondAttempt.valid).toBe(false);
      expect(secondAttempt.error).toContain("Aucun code OTP trouvé");
    });

    it("rejette un code incorrect", () => {
      setOTP("lease-wrong", {
        code: "123456",
        phone: "+33612345678",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      });

      const result = verifyOTP("lease-wrong", "000000");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Code incorrect");
      expect(result.error).toContain("tentatives restantes");
    });

    it("rejette un code pour une clé inexistante", () => {
      const result = verifyOTP("nonexistent-key", "123456");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Aucun code OTP trouvé");
    });

    it("rejette un code expiré", () => {
      setOTP("lease-expired", {
        code: "123456",
        phone: "+33612345678",
        expiresAt: new Date(Date.now() - 1000), // Déjà expiré
        attempts: 0,
      });

      const result = verifyOTP("lease-expired", "123456");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("expiré");
      
      // Le code expiré a été supprimé
      expect(getOTP("lease-expired")).toBeUndefined();
    });

    it("bloque après 5 tentatives incorrectes (anti brute-force)", () => {
      setOTP("lease-bruteforce", {
        code: "123456",
        phone: "+33612345678",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      });

      // 5 tentatives incorrectes
      for (let i = 0; i < 5; i++) {
        const result = verifyOTP("lease-bruteforce", "000000");
        expect(result.valid).toBe(false);
      }

      // 6ème tentative — bloqué et supprimé
      const blocked = verifyOTP("lease-bruteforce", "000000");
      expect(blocked.valid).toBe(false);
      expect(blocked.error).toContain("Trop de tentatives");
      
      // Le code a été supprimé
      expect(getOTP("lease-bruteforce")).toBeUndefined();
    });

    it("le bon code après 4 tentatives incorrectes est encore accepté", () => {
      setOTP("lease-retry", {
        code: "123456",
        phone: "+33612345678",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      });

      // 4 tentatives incorrectes (pas encore bloqué à 5)
      for (let i = 0; i < 4; i++) {
        verifyOTP("lease-retry", "000000");
      }

      // 5ème tentative avec le bon code
      const result = verifyOTP("lease-retry", "123456");
      expect(result.valid).toBe(true);
    });

    it("incrémente le compteur de tentatives", () => {
      setOTP("lease-count", {
        code: "123456",
        phone: "+33612345678",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      });

      verifyOTP("lease-count", "000000"); // Tentative 1
      verifyOTP("lease-count", "000001"); // Tentative 2
      
      const stored = getOTP("lease-count");
      expect(stored).toBeDefined();
      expect(stored!.attempts).toBe(2);
    });
  });

  describe("Scénarios signature", () => {
    it("simule le flux complet: OTP créé → vérifié → signature autorisée", () => {
      const leaseId = "lease-uuid-signature";
      const otpCode = "456789";
      
      // 1. Création de l'OTP (simulé comme dans l'API send-otp)
      setOTP(leaseId, {
        code: otpCode,
        phone: "+33612345678",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      });

      // 2. Vérification de l'OTP (comme dans /sign-with-pad)
      const result = verifyOTP(leaseId, otpCode);
      expect(result.valid).toBe(true);

      // 3. L'OTP a été consommé — impossible de le réutiliser
      const reuse = verifyOTP(leaseId, otpCode);
      expect(reuse.valid).toBe(false);
    });

    it("simule une tentative de contournement: mauvais OTP puis bon code", () => {
      const leaseId = "lease-uuid-bypass";
      
      setOTP(leaseId, {
        code: "999999",
        phone: "+33612345678",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      });

      // Essai avec un code deviné
      const bad = verifyOTP(leaseId, "123456");
      expect(bad.valid).toBe(false);

      // Essai avec le bon code — encore possible (< 5 tentatives)
      const good = verifyOTP(leaseId, "999999");
      expect(good.valid).toBe(true);
    });
  });
});
