/**
 * Tests pour la logique de transformation fetchOwnerTenants :
 * score locataire, id affiché, statut bail.
 */

import { describe, it, expect } from "vitest";
import {
  computeTenantScore,
  getTenantDisplayId,
  getTenantLeaseStatus,
} from "@/lib/helpers/tenant-score";

describe("computeTenantScore", () => {
  it("retourne 5 quand aucun paiement", () => {
    expect(computeTenantScore(0, 0, 0)).toBe(5);
  });

  it("retourne 5 quand tous les paiements à l'heure", () => {
    expect(computeTenantScore(10, 0, 0)).toBe(5);
  });

  it("retourne 0 quand tous les paiements en retard", () => {
    expect(computeTenantScore(0, 10, 0)).toBe(0);
  });

  it("retourne 3 pour 60% à l'heure (arrondi)", () => {
    expect(computeTenantScore(6, 4, 0)).toBe(3);
  });

  it("réduit le score de 1 si balance > 0 (min 1)", () => {
    expect(computeTenantScore(10, 0, 100)).toBe(4);
    expect(computeTenantScore(0, 10, 50)).toBe(1);
  });
});

describe("getTenantDisplayId", () => {
  it("retourne leaseId-profileId quand lié", () => {
    expect(
      getTenantDisplayId("lease-1", true, "profile-1", "a@b.com")
    ).toBe("lease-1-profile-1");
  });

  it("retourne leaseId-invited-email quand non lié", () => {
    expect(
      getTenantDisplayId("lease-1", false, "", "a@b.com")
    ).toBe("lease-1-invited-a@b.com");
  });

  it("gère invitedEmail vide", () => {
    expect(
      getTenantDisplayId("lease-1", false, "", "")
    ).toBe("lease-1-invited-");
  });
});

describe("getTenantLeaseStatus", () => {
  it("retourne invitation_pending quand non lié", () => {
    expect(getTenantLeaseStatus(false, "active")).toBe("invitation_pending");
  });

  it("retourne le statut réel quand lié", () => {
    expect(getTenantLeaseStatus(true, "active")).toBe("active");
    expect(getTenantLeaseStatus(true, "fully_signed")).toBe("fully_signed");
  });
});
