/**
 * Sprint 1 — Tests du moteur de calcul régularisation des charges.
 *
 * Fonctions testées :
 *   - diffDays
 *   - prorataCentimes
 *   - computeTeomNet
 *   - computeProvisionsVersees
 *   - computeRegularization
 *
 * Règles :
 *   - Montants toujours en centimes INTEGER
 *   - Aucune I/O, fonctions pures
 *   - Prescription : 3 ans (loi ALUR — art. 7-1 loi 89-462)
 */

import { describe, it, expect } from "vitest";
import {
  computeProvisionsVersees,
  computeRegularization,
  computeTeomNet,
  diffDays,
  prorataCentimes,
} from "@/lib/charges/engine";

// ---------------------------------------------------------------------------
// diffDays
// ---------------------------------------------------------------------------
describe("diffDays", () => {
  it("retourne 1 pour le même jour (bornes inclusives)", () => {
    expect(diffDays("2025-06-15", "2025-06-15")).toBe(1);
  });

  it("retourne 365 pour une année non bissextile complète", () => {
    expect(diffDays("2025-01-01", "2025-12-31")).toBe(365);
  });

  it("retourne 366 pour une année bissextile complète (2024)", () => {
    expect(diffDays("2024-01-01", "2024-12-31")).toBe(366);
  });

  it("gère correctement un passage d'année (2025-12-30 → 2026-01-02)", () => {
    expect(diffDays("2025-12-30", "2026-01-02")).toBe(4);
  });

  it("jette une erreur si endISO < startISO", () => {
    expect(() => diffDays("2025-06-15", "2025-06-14")).toThrow(/must be >=/);
  });

  it("jette une erreur sur format ISO invalide", () => {
    expect(() => diffDays("2025-1-1", "2025-12-31")).toThrow(/Invalid ISO/);
    expect(() => diffDays("not-a-date", "2025-12-31")).toThrow(/Invalid ISO/);
  });

  it("jette une erreur sur date calendaire impossible (31 février)", () => {
    expect(() => diffDays("2025-02-31", "2025-03-01")).toThrow(/Invalid calendar/);
  });

  it("gère le passage à l'heure d'été sans erreur d'arrondi (UTC)", () => {
    // Le passage heure d'été en France est fin mars.
    expect(diffDays("2025-03-30", "2025-03-31")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// prorataCentimes
// ---------------------------------------------------------------------------
describe("prorataCentimes", () => {
  it("retourne la charge entière pour une période pleine (365/365)", () => {
    expect(prorataCentimes(120000, 365)).toBe(120000);
  });

  it("retourne la moitié pour une demi-période (182/365 arrondi)", () => {
    // 120000 * 182 / 365 = 59835.6… → 59836
    expect(prorataCentimes(120000, 182)).toBe(59836);
  });

  it("retourne la charge journalière pour 1 jour", () => {
    // 120000 / 365 = 328.76… → 329
    expect(prorataCentimes(120000, 1)).toBe(329);
  });

  it("arrondit au centime le plus proche (banker's rounding non utilisé)", () => {
    // 10000 * 3 / 365 = 82.19… → 82
    expect(prorataCentimes(10000, 3)).toBe(82);
  });

  it("retourne 0 pour 0 jours", () => {
    expect(prorataCentimes(120000, 0)).toBe(0);
  });

  it("clamp à la charge entière si joursPeriode > joursAnnee", () => {
    expect(prorataCentimes(120000, 400)).toBe(120000);
  });

  it("accepte un denominateur custom (année bissextile 366)", () => {
    // 120000 * 183 / 366 = 60000
    expect(prorataCentimes(120000, 183, 366)).toBe(60000);
  });

  it("jette une erreur sur charge annuelle négative", () => {
    expect(() => prorataCentimes(-100, 10)).toThrow(/must be >= 0/);
  });

  it("jette une erreur sur joursPeriode négatif", () => {
    expect(() => prorataCentimes(100, -1)).toThrow(/must be >= 0/);
  });

  it("jette une erreur sur joursAnnee <= 0", () => {
    expect(() => prorataCentimes(100, 10, 0)).toThrow(/must be > 0/);
  });
});

// ---------------------------------------------------------------------------
// computeTeomNet
// ---------------------------------------------------------------------------
describe("computeTeomNet", () => {
  it("calcule le TEOM net avec frais de gestion par défaut 8%", () => {
    // 32400 * (1 - 0.08) = 29808
    expect(computeTeomNet(32400, 8, false)).toBe(29808);
  });

  it("retourne 0 si le bien est en zone REOM", () => {
    expect(computeTeomNet(50000, 8, true)).toBe(0);
  });

  it("retourne le TEOM brut si frais de gestion = 0%", () => {
    expect(computeTeomNet(40000, 0, false)).toBe(40000);
  });

  it("retourne 0 si frais de gestion = 100%", () => {
    expect(computeTeomNet(40000, 100, false)).toBe(0);
  });

  it("arrondit au centime le plus proche", () => {
    // 12345 * (1 - 0.08) = 11357.4 → 11357
    expect(computeTeomNet(12345, 8, false)).toBe(11357);
  });

  it("retourne 0 pour un TEOM brut de 0", () => {
    expect(computeTeomNet(0, 8, false)).toBe(0);
  });

  it("jette une erreur sur TEOM brut négatif", () => {
    expect(() => computeTeomNet(-100, 8, false)).toThrow(/must be >= 0/);
  });

  it("jette une erreur sur frais de gestion > 100%", () => {
    expect(() => computeTeomNet(1000, 150, false)).toThrow(/\[0, 100\]/);
  });

  it("jette une erreur sur frais de gestion < 0%", () => {
    expect(() => computeTeomNet(1000, -1, false)).toThrow(/\[0, 100\]/);
  });
});

// ---------------------------------------------------------------------------
// computeProvisionsVersees
// ---------------------------------------------------------------------------
describe("computeProvisionsVersees", () => {
  it("retourne le montant versé tel quel (pass-through)", () => {
    expect(computeProvisionsVersees(96000)).toBe(96000);
  });

  it("retourne 0 pour 0 (aucune provision versée)", () => {
    expect(computeProvisionsVersees(0)).toBe(0);
  });

  it("jette une erreur sur montant négatif", () => {
    expect(() => computeProvisionsVersees(-1)).toThrow(/must be >= 0/);
  });

  it("jette une erreur sur NaN", () => {
    expect(() => computeProvisionsVersees(NaN)).toThrow(/must be >= 0/);
  });

  it("arrondit au centime le plus proche si entrée flottante", () => {
    expect(computeProvisionsVersees(100.6)).toBe(101);
  });
});

// ---------------------------------------------------------------------------
// computeRegularization
// ---------------------------------------------------------------------------
describe("computeRegularization", () => {
  const baseInput = {
    leaseId: "lease-1",
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
    provisionsEncaisseesCentimes: 96000, // 960,00 €
    chargesReellesCentimes: 201308, // 2013,08 €
    referenceDate: "2026-04-17", // figé pour stabilité des tests
  };

  it("calcule un complément dû quand charges > provisions", () => {
    const result = computeRegularization(baseInput);
    expect(result.balanceCentimes).toBe(105308); // 2013,08 - 960,00 = 1053,08 €
    expect(result.isComplementDu).toBe(true);
    expect(result.isTropPercu).toBe(false);
    expect(result.nbJoursPeriode).toBe(365);
  });

  it("calcule un trop-perçu quand provisions > charges", () => {
    const result = computeRegularization({
      ...baseInput,
      provisionsEncaisseesCentimes: 96000,
      chargesReellesCentimes: 87258, // 872,58 €
    });
    expect(result.balanceCentimes).toBe(-8742); // -87,42 €
    expect(result.isComplementDu).toBe(false);
    expect(result.isTropPercu).toBe(true);
  });

  it("retourne une balance nulle en cas d'égalité parfaite", () => {
    const result = computeRegularization({
      ...baseInput,
      provisionsEncaisseesCentimes: 100000,
      chargesReellesCentimes: 100000,
    });
    expect(result.balanceCentimes).toBe(0);
    expect(result.isComplementDu).toBe(false);
    expect(result.isTropPercu).toBe(false);
  });

  it("intègre le TEOM net dans les charges réelles totales", () => {
    const result = computeRegularization({
      ...baseInput,
      chargesReellesCentimes: 100000,
      teomBrutCentimes: 32400,
      fraisGestionTeomPct: 8,
    });
    // 100000 + computeTeomNet(32400, 8, false) = 100000 + 29808 = 129808
    expect(result.teomNetCentimes).toBe(29808);
    expect(result.chargesReellesTotalesCentimes).toBe(129808);
    expect(result.balanceCentimes).toBe(129808 - 96000);
  });

  it("ignore le TEOM si le bien est en zone REOM", () => {
    const result = computeRegularization({
      ...baseInput,
      chargesReellesCentimes: 100000,
      teomBrutCentimes: 50000,
      isReom: true,
    });
    expect(result.teomNetCentimes).toBe(0);
    expect(result.chargesReellesTotalesCentimes).toBe(100000);
  });

  it("utilise le taux de frais de gestion par défaut (8%) si non spécifié", () => {
    const result = computeRegularization({
      ...baseInput,
      chargesReellesCentimes: 0,
      provisionsEncaisseesCentimes: 0,
      teomBrutCentimes: 10000,
    });
    // 10000 * (1 - 0.08) = 9200
    expect(result.teomNetCentimes).toBe(9200);
  });

  it("calcule dateLimiteEnvoi = periodEnd + 3 ans", () => {
    const result = computeRegularization(baseInput);
    expect(result.dateLimiteEnvoi).toBe("2028-12-31");
  });

  it("flag isPrescrit=false si dateLimiteEnvoi > referenceDate", () => {
    const result = computeRegularization(baseInput);
    // dateLimiteEnvoi = 2028-12-31, referenceDate = 2026-04-17
    expect(result.isPrescrit).toBe(false);
  });

  it("flag isPrescrit=true si dateLimiteEnvoi < referenceDate", () => {
    const result = computeRegularization({
      ...baseInput,
      periodStart: "2020-01-01",
      periodEnd: "2020-12-31", // +3 ans = 2023-12-31 < 2026-04-17
      referenceDate: "2026-04-17",
    });
    expect(result.isPrescrit).toBe(true);
    // La balance reste calculée (flag informatif, pas bloquant côté engine).
    expect(result.balanceCentimes).toBe(105308);
  });

  it("gère le cas limite Feb 29 → Feb 28 pour le calcul de prescription", () => {
    const result = computeRegularization({
      ...baseInput,
      periodStart: "2023-03-01",
      periodEnd: "2024-02-29", // bissextile
      referenceDate: "2027-03-01",
    });
    // 2024-02-29 + 3 ans → 2027-02-28 (année non bissextile, clamp)
    expect(result.dateLimiteEnvoi).toBe("2027-02-28");
    expect(result.isPrescrit).toBe(true);
  });

  it("requiresEchelonnement=true si balance > 1 mois de loyer", () => {
    const result = computeRegularization({
      ...baseInput,
      provisionsEncaisseesCentimes: 0,
      chargesReellesCentimes: 200000, // 2000 €
      loyerMensuelCentimes: 65000, // 650 €
    });
    expect(result.requiresEchelonnement).toBe(true);
  });

  it("requiresEchelonnement=false si balance <= 1 mois de loyer", () => {
    const result = computeRegularization({
      ...baseInput,
      provisionsEncaisseesCentimes: 0,
      chargesReellesCentimes: 60000, // 600 €
      loyerMensuelCentimes: 65000, // 650 €
    });
    expect(result.requiresEchelonnement).toBe(false);
  });

  it("requiresEchelonnement=false si aucun loyer mensuel fourni", () => {
    const result = computeRegularization({
      ...baseInput,
      provisionsEncaisseesCentimes: 0,
      chargesReellesCentimes: 1000000,
    });
    expect(result.requiresEchelonnement).toBe(false);
  });

  it("requiresEchelonnement=false si trop-perçu (balance < 0)", () => {
    const result = computeRegularization({
      ...baseInput,
      provisionsEncaisseesCentimes: 200000,
      chargesReellesCentimes: 50000,
      loyerMensuelCentimes: 65000,
    });
    expect(result.balanceCentimes).toBeLessThan(0);
    expect(result.requiresEchelonnement).toBe(false);
  });

  it("propage provisionsVerseesCentimes et chargesReellesTotalesCentimes en sortie", () => {
    const result = computeRegularization(baseInput);
    expect(result.provisionsVerseesCentimes).toBe(96000);
    expect(result.chargesReellesTotalesCentimes).toBe(201308);
  });

  it("jette une erreur sur chargesReellesCentimes négatif", () => {
    expect(() =>
      computeRegularization({ ...baseInput, chargesReellesCentimes: -100 }),
    ).toThrow(/must be >= 0/);
  });

  it("jette une erreur sur provisionsEncaisseesCentimes négatif", () => {
    expect(() =>
      computeRegularization({ ...baseInput, provisionsEncaisseesCentimes: -1 }),
    ).toThrow(/must be >= 0/);
  });
});
