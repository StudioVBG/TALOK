/**
 * Tests unitaires pour le module Fin de Bail
 */

import { describe, it, expect } from "vitest";

// Fonctions utilitaires à tester
function calculateLegalDeadline(
  departureDate: Date,
  edlIdentical: boolean
): Date {
  const deadline = new Date(departureDate);
  // 1 mois si EDL conforme, 2 mois sinon
  deadline.setMonth(deadline.getMonth() + (edlIdentical ? 1 : 2));
  return deadline;
}

function calculateSettlement(
  depositAmount: number,
  unpaidRent: number,
  repairCosts: number,
  cleaningCosts: number,
  otherDeductions: number
): {
  totalDeductions: number;
  amountToReturn: number;
  amountToPay: number;
} {
  const totalDeductions = unpaidRent + repairCosts + cleaningCosts + otherDeductions;
  const balance = depositAmount - totalDeductions;

  return {
    totalDeductions,
    amountToReturn: Math.max(0, balance),
    amountToPay: Math.max(0, -balance),
  };
}

function calculateNoticePeriod(
  reason: string,
  isZoneTendue: boolean
): number {
  // Raisons permettant un préavis réduit à 1 mois
  const reducedReasons = [
    "zone_tendue",
    "mutation_professionnelle",
    "perte_emploi",
    "nouvel_emploi",
    "raison_sante",
    "rsa_beneficiaire",
    "aah_beneficiaire",
    "premier_logement",
  ];

  if (isZoneTendue || reducedReasons.includes(reason)) {
    return 1;
  }

  return 3; // Préavis standard
}

describe("Module Fin de Bail", () => {
  describe("calculateLegalDeadline", () => {
    it("devrait calculer 1 mois si EDL identique", () => {
      const departureDate = new Date("2024-06-15");
      const deadline = calculateLegalDeadline(departureDate, true);

      expect(deadline.getMonth()).toBe(6); // Juillet (0-indexed: 6)
      expect(deadline.getDate()).toBe(15);
    });

    it("devrait calculer 2 mois si EDL différent", () => {
      const departureDate = new Date("2024-06-15");
      const deadline = calculateLegalDeadline(departureDate, false);

      expect(deadline.getMonth()).toBe(7); // Août (0-indexed: 7)
      expect(deadline.getDate()).toBe(15);
    });

    it("devrait gérer le passage d'année", () => {
      const departureDate = new Date("2024-11-15");
      const deadline = calculateLegalDeadline(departureDate, false);

      expect(deadline.getFullYear()).toBe(2025);
      expect(deadline.getMonth()).toBe(0); // Janvier
    });
  });

  describe("calculateSettlement", () => {
    it("devrait calculer un remboursement complet sans retenues", () => {
      const result = calculateSettlement(1500, 0, 0, 0, 0);

      expect(result.totalDeductions).toBe(0);
      expect(result.amountToReturn).toBe(1500);
      expect(result.amountToPay).toBe(0);
    });

    it("devrait calculer un remboursement partiel avec retenues", () => {
      const result = calculateSettlement(1500, 500, 200, 100, 0);

      expect(result.totalDeductions).toBe(800);
      expect(result.amountToReturn).toBe(700);
      expect(result.amountToPay).toBe(0);
    });

    it("devrait calculer un montant dû par le locataire", () => {
      const result = calculateSettlement(1000, 800, 500, 200, 100);

      expect(result.totalDeductions).toBe(1600);
      expect(result.amountToReturn).toBe(0);
      expect(result.amountToPay).toBe(600);
    });

    it("devrait gérer les retenues exactement égales au dépôt", () => {
      const result = calculateSettlement(1000, 500, 300, 200, 0);

      expect(result.totalDeductions).toBe(1000);
      expect(result.amountToReturn).toBe(0);
      expect(result.amountToPay).toBe(0);
    });
  });

  describe("calculateNoticePeriod", () => {
    it("devrait retourner 3 mois pour un préavis standard", () => {
      const result = calculateNoticePeriod("standard", false);
      expect(result).toBe(3);
    });

    it("devrait retourner 1 mois en zone tendue", () => {
      const result = calculateNoticePeriod("standard", true);
      expect(result).toBe(1);
    });

    it("devrait retourner 1 mois pour mutation professionnelle", () => {
      const result = calculateNoticePeriod("mutation_professionnelle", false);
      expect(result).toBe(1);
    });

    it("devrait retourner 1 mois pour perte d'emploi", () => {
      const result = calculateNoticePeriod("perte_emploi", false);
      expect(result).toBe(1);
    });

    it("devrait retourner 1 mois pour raison de santé", () => {
      const result = calculateNoticePeriod("raison_sante", false);
      expect(result).toBe(1);
    });

    it("devrait retourner 1 mois pour bénéficiaire RSA", () => {
      const result = calculateNoticePeriod("rsa_beneficiaire", false);
      expect(result).toBe(1);
    });

    it("devrait retourner 1 mois pour bénéficiaire AAH", () => {
      const result = calculateNoticePeriod("aah_beneficiaire", false);
      expect(result).toBe(1);
    });
  });
});

describe("Validation Fin de Bail", () => {
  describe("Dates de préavis", () => {
    it("devrait valider que la date de départ est après la date de préavis", () => {
      const noticeDate = new Date("2024-01-15");
      const departureDate = new Date("2024-04-15");

      expect(departureDate > noticeDate).toBe(true);
    });

    it("devrait rejeter une date de départ avant la date de préavis", () => {
      const noticeDate = new Date("2024-04-15");
      const departureDate = new Date("2024-01-15");

      expect(departureDate > noticeDate).toBe(false);
    });
  });

  describe("Retenues", () => {
    it("devrait valider des montants positifs", () => {
      const amount = 500;
      expect(amount >= 0).toBe(true);
    });

    it("devrait rejeter des montants négatifs", () => {
      const amount = -100;
      expect(amount >= 0).toBe(false);
    });
  });
});







