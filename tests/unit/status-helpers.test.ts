import { describe, it, expect } from "vitest";
import { getStatusBadgeProps } from "@/lib/types/status";

/**
 * Tests unitaires pour le helper getStatusBadgeProps
 * Audit UX : section D — dictionnaire des statuts
 */

describe("getStatusBadgeProps", () => {
  // ── Lease statuses ──
  describe("lease", () => {
    it("retourne 'Brouillon' + neutral pour draft", () => {
      const result = getStatusBadgeProps("lease", "draft");
      expect(result.label).toBe("Brouillon");
      expect(result.type).toBe("neutral");
    });

    it("retourne 'En attente de signature' + warning pour pending_signature", () => {
      const result = getStatusBadgeProps("lease", "pending_signature");
      expect(result.label).toBe("En attente de signature");
      expect(result.type).toBe("warning");
    });

    it("retourne 'Partiellement signé' + info pour partially_signed", () => {
      const result = getStatusBadgeProps("lease", "partially_signed");
      expect(result.label).toBe("Partiellement signé");
      expect(result.type).toBe("info");
    });

    it("retourne 'Actif' + success pour active", () => {
      const result = getStatusBadgeProps("lease", "active");
      expect(result.label).toBe("Actif");
      expect(result.type).toBe("success");
    });

    it("retourne 'Préavis' + warning pour notice_given", () => {
      const result = getStatusBadgeProps("lease", "notice_given");
      expect(result.label).toBe("Préavis");
      expect(result.type).toBe("warning");
    });

    it("retourne 'Terminé' + neutral pour terminated", () => {
      const result = getStatusBadgeProps("lease", "terminated");
      expect(result.label).toBe("Terminé");
      expect(result.type).toBe("neutral");
    });

    it("retourne le statut brut si inconnu", () => {
      const result = getStatusBadgeProps("lease", "unknown_status");
      expect(result.label).toBe("unknown_status");
      expect(result.type).toBe("neutral");
    });
  });

  // ── Invoice statuses ──
  describe("invoice", () => {
    it("retourne 'Payée' + success pour paid", () => {
      const result = getStatusBadgeProps("invoice", "paid");
      expect(result.label).toBe("Payée");
      expect(result.type).toBe("success");
    });

    it("retourne 'En retard' + error pour late", () => {
      const result = getStatusBadgeProps("invoice", "late");
      expect(result.label).toBe("En retard");
      expect(result.type).toBe("error");
    });

    it("retourne 'Envoyée' + info pour sent", () => {
      const result = getStatusBadgeProps("invoice", "sent");
      expect(result.label).toBe("Envoyée");
      expect(result.type).toBe("info");
    });
  });

  // ── Ticket statuses ──
  describe("ticket", () => {
    it("retourne 'Ouvert' + info pour open", () => {
      const result = getStatusBadgeProps("ticket", "open");
      expect(result.label).toBe("Ouvert");
      expect(result.type).toBe("info");
    });

    it("retourne 'Résolu' + success pour resolved", () => {
      const result = getStatusBadgeProps("ticket", "resolved");
      expect(result.label).toBe("Résolu");
      expect(result.type).toBe("success");
    });
  });

  // ── EDL statuses ──
  describe("edl", () => {
    it("retourne 'Signé' + success pour signed", () => {
      const result = getStatusBadgeProps("edl", "signed");
      expect(result.label).toBe("Signé");
      expect(result.type).toBe("success");
    });

    it("retourne 'Contesté' + error pour disputed", () => {
      const result = getStatusBadgeProps("edl", "disputed");
      expect(result.label).toBe("Contesté");
      expect(result.type).toBe("error");
    });
  });

  // ── Cohérence globale ──
  describe("cohérence", () => {
    it("tous les types de badge sont valides", () => {
      const validTypes = ["success", "warning", "error", "neutral", "info"];
      
      const testCases = [
        { entity: "lease" as const, statuses: ["draft", "pending_signature", "active", "terminated"] },
        { entity: "invoice" as const, statuses: ["draft", "paid", "late", "sent"] },
        { entity: "ticket" as const, statuses: ["open", "resolved", "closed"] },
        { entity: "edl" as const, statuses: ["draft", "signed", "disputed"] },
      ];

      for (const { entity, statuses } of testCases) {
        for (const status of statuses) {
          const result = getStatusBadgeProps(entity, status);
          expect(validTypes).toContain(result.type);
          expect(result.label).toBeTruthy();
          expect(result.label.length).toBeGreaterThan(0);
        }
      }
    });

    it("un même statut retourne toujours le même label", () => {
      const result1 = getStatusBadgeProps("lease", "active");
      const result2 = getStatusBadgeProps("lease", "active");
      expect(result1.label).toBe(result2.label);
      expect(result1.type).toBe(result2.type);
    });
  });
});
