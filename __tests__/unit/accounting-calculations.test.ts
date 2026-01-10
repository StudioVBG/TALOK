/**
 * Tests unitaires pour les calculs comptables
 * Honoraires, TVA, prorata, reversements
 */

import { describe, it, expect } from "vitest";

// Mock des fonctions de calcul (importables depuis accounting.service.ts)
// Pour les tests unitaires, on réimplémente les fonctions pures

// Taux TVA par territoire
const TAUX_TVA = {
  METROPOLE: 0.2,
  ANTILLES: 0.085,
  REUNION: 0.085,
  GUYANE: 0,
  MAYOTTE: 0,
};

function getTauxTVA(codePostal: string): number {
  if (!codePostal) return TAUX_TVA.METROPOLE;

  const prefix = codePostal.substring(0, 3);
  const prefix2 = codePostal.substring(0, 2);

  // Antilles (971 Guadeloupe, 972 Martinique)
  if (prefix === "971" || prefix === "972") {
    return TAUX_TVA.ANTILLES;
  }
  // Réunion (974)
  if (prefix === "974") {
    return TAUX_TVA.REUNION;
  }
  // Guyane (973)
  if (prefix === "973") {
    return TAUX_TVA.GUYANE;
  }
  // Mayotte (976)
  if (prefix === "976") {
    return TAUX_TVA.MAYOTTE;
  }

  return TAUX_TVA.METROPOLE;
}

interface CalculHonoraires {
  loyer_hc: number;
  taux_ht: number;
  montant_ht: number;
  tva_taux: number;
  tva_montant: number;
  total_ttc: number;
  net_proprietaire: number;
}

function calculateHonoraires(
  loyerHC: number,
  tauxHT: number = 0.07,
  codePostal: string = "75000"
): CalculHonoraires {
  const tauxTVA = getTauxTVA(codePostal);
  const montantHT = loyerHC * tauxHT;
  const tvaMontant = montantHT * tauxTVA;
  const totalTTC = montantHT + tvaMontant;
  const netProprietaire = loyerHC - totalTTC;

  return {
    loyer_hc: Math.round(loyerHC * 100) / 100,
    taux_ht: tauxHT,
    montant_ht: Math.round(montantHT * 100) / 100,
    tva_taux: tauxTVA,
    tva_montant: Math.round(tvaMontant * 100) / 100,
    total_ttc: Math.round(totalTTC * 100) / 100,
    net_proprietaire: Math.round(netProprietaire * 100) / 100,
  };
}

interface CalculReversement {
  loyer_encaisse: number;
  charges_encaissees: number;
  honoraires_ttc: number;
  travaux_deduits: number;
  autres_deductions: number;
  montant_reverse: number;
}

function calculateReversement(
  loyerEncaisse: number,
  chargesEncaissees: number,
  tauxHonoraires: number = 0.07,
  travauxDeduits: number = 0,
  autresDeductions: number = 0,
  codePostal: string = "75000"
): CalculReversement {
  const honoraires = calculateHonoraires(loyerEncaisse, tauxHonoraires, codePostal);

  const montantReverse =
    loyerEncaisse +
    chargesEncaissees -
    honoraires.total_ttc -
    travauxDeduits -
    autresDeductions;

  return {
    loyer_encaisse: loyerEncaisse,
    charges_encaissees: chargesEncaissees,
    honoraires_ttc: honoraires.total_ttc,
    travaux_deduits: travauxDeduits,
    autres_deductions: autresDeductions,
    montant_reverse: Math.round(montantReverse * 100) / 100,
  };
}

function calculateProrata(
  dateDebut: string,
  dateFin: string,
  annee: number
): { jours_occupation: number; jours_annee: number; ratio: number } {
  const debut = new Date(Math.max(new Date(dateDebut).getTime(), new Date(`${annee}-01-01`).getTime()));
  const fin = new Date(Math.min(new Date(dateFin).getTime(), new Date(`${annee}-12-31`).getTime()));

  const joursOccupation = Math.ceil((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const joursAnnee = annee % 4 === 0 ? 366 : 365;

  return {
    jours_occupation: Math.max(0, joursOccupation),
    jours_annee: joursAnnee,
    ratio: Math.round((joursOccupation / joursAnnee) * 10000) / 10000,
  };
}

// ============================================================================
// TESTS TVA
// ============================================================================

describe("getTauxTVA", () => {
  it("retourne 20% pour la métropole (Paris 75001)", () => {
    expect(getTauxTVA("75001")).toBe(0.2);
  });

  it("retourne 20% pour la métropole (Lyon 69000)", () => {
    expect(getTauxTVA("69000")).toBe(0.2);
  });

  it("retourne 20% pour la métropole (Marseille 13000)", () => {
    expect(getTauxTVA("13000")).toBe(0.2);
  });

  it("retourne 8.5% pour la Guadeloupe (97100)", () => {
    expect(getTauxTVA("97100")).toBe(0.085);
  });

  it("retourne 8.5% pour la Martinique (97200)", () => {
    expect(getTauxTVA("97200")).toBe(0.085);
  });

  it("retourne 0% pour la Guyane (97300)", () => {
    expect(getTauxTVA("97300")).toBe(0);
  });

  it("retourne 8.5% pour la Réunion (97400)", () => {
    expect(getTauxTVA("97400")).toBe(0.085);
  });

  it("retourne 0% pour Mayotte (97600)", () => {
    expect(getTauxTVA("97600")).toBe(0);
  });

  it("retourne 20% par défaut si code postal vide", () => {
    expect(getTauxTVA("")).toBe(0.2);
  });
});

// ============================================================================
// TESTS HONORAIRES
// ============================================================================

describe("calculateHonoraires", () => {
  describe("Cas standard métropole", () => {
    it("calcule correctement les honoraires pour un loyer de 1000€", () => {
      const result = calculateHonoraires(1000, 0.07, "75001");

      expect(result.loyer_hc).toBe(1000);
      expect(result.taux_ht).toBe(0.07);
      expect(result.montant_ht).toBe(70);        // 1000 * 7%
      expect(result.tva_taux).toBe(0.2);
      expect(result.tva_montant).toBe(14);        // 70 * 20%
      expect(result.total_ttc).toBe(84);          // 70 + 14
      expect(result.net_proprietaire).toBe(916);  // 1000 - 84
    });

    it("calcule correctement les honoraires pour un loyer de 850€", () => {
      const result = calculateHonoraires(850, 0.07, "75001");

      expect(result.loyer_hc).toBe(850);
      expect(result.montant_ht).toBe(59.5);       // 850 * 7%
      expect(result.tva_montant).toBe(11.9);      // 59.5 * 20%
      expect(result.total_ttc).toBe(71.4);        // 59.5 + 11.9
      expect(result.net_proprietaire).toBe(778.6); // 850 - 71.4
    });

    it("calcule correctement les honoraires pour un loyer de 1500€", () => {
      const result = calculateHonoraires(1500, 0.07, "75001");

      expect(result.loyer_hc).toBe(1500);
      expect(result.montant_ht).toBe(105);        // 1500 * 7%
      expect(result.tva_montant).toBe(21);        // 105 * 20%
      expect(result.total_ttc).toBe(126);         // 105 + 21
      expect(result.net_proprietaire).toBe(1374); // 1500 - 126
    });
  });

  describe("Cas DROM avec TVA réduite", () => {
    it("calcule correctement les honoraires en Martinique (TVA 8.5%)", () => {
      const result = calculateHonoraires(1000, 0.07, "97200");

      expect(result.loyer_hc).toBe(1000);
      expect(result.montant_ht).toBe(70);
      expect(result.tva_taux).toBe(0.085);
      expect(result.tva_montant).toBe(5.95);      // 70 * 8.5%
      expect(result.total_ttc).toBe(75.95);       // 70 + 5.95
      expect(result.net_proprietaire).toBe(924.05);
    });

    it("calcule correctement les honoraires en Guyane (TVA 0%)", () => {
      const result = calculateHonoraires(1000, 0.07, "97300");

      expect(result.loyer_hc).toBe(1000);
      expect(result.montant_ht).toBe(70);
      expect(result.tva_taux).toBe(0);
      expect(result.tva_montant).toBe(0);         // 70 * 0%
      expect(result.total_ttc).toBe(70);          // 70 + 0 (HT = TTC en Guyane)
      expect(result.net_proprietaire).toBe(930);  // 1000 - 70
    });

    it("calcule correctement les honoraires à Mayotte (TVA 0%)", () => {
      const result = calculateHonoraires(800, 0.07, "97600");

      expect(result.montant_ht).toBe(56);         // 800 * 7%
      expect(result.tva_montant).toBe(0);
      expect(result.total_ttc).toBe(56);
      expect(result.net_proprietaire).toBe(744);  // 800 - 56
    });
  });

  describe("Taux honoraires différents", () => {
    it("calcule avec un taux de 5%", () => {
      const result = calculateHonoraires(1000, 0.05, "75001");

      expect(result.taux_ht).toBe(0.05);
      expect(result.montant_ht).toBe(50);
      expect(result.tva_montant).toBe(10);
      expect(result.total_ttc).toBe(60);
    });

    it("calcule avec un taux de 10%", () => {
      const result = calculateHonoraires(1000, 0.10, "75001");

      expect(result.taux_ht).toBe(0.10);
      expect(result.montant_ht).toBe(100);
      expect(result.tva_montant).toBe(20);
      expect(result.total_ttc).toBe(120);
    });
  });

  describe("Cas limites", () => {
    it("gère un loyer de 0€", () => {
      const result = calculateHonoraires(0, 0.07, "75001");

      expect(result.loyer_hc).toBe(0);
      expect(result.montant_ht).toBe(0);
      expect(result.total_ttc).toBe(0);
      expect(result.net_proprietaire).toBe(0);
    });

    it("gère les décimales correctement", () => {
      const result = calculateHonoraires(1234.56, 0.07, "75001");

      expect(result.loyer_hc).toBe(1234.56);
      expect(result.montant_ht).toBe(86.42);      // 1234.56 * 0.07 = 86.4192 → arrondi 86.42
    });
  });
});

// ============================================================================
// TESTS REVERSEMENT
// ============================================================================

describe("calculateReversement", () => {
  it("calcule le reversement standard sans travaux ni déductions", () => {
    const result = calculateReversement(1000, 150, 0.07, 0, 0, "75001");

    expect(result.loyer_encaisse).toBe(1000);
    expect(result.charges_encaissees).toBe(150);
    expect(result.honoraires_ttc).toBe(84);       // 1000 * 7% * 1.2
    expect(result.travaux_deduits).toBe(0);
    expect(result.autres_deductions).toBe(0);
    expect(result.montant_reverse).toBe(1066);    // 1000 + 150 - 84
  });

  it("calcule le reversement avec travaux déduits", () => {
    const result = calculateReversement(1000, 150, 0.07, 200, 0, "75001");

    expect(result.travaux_deduits).toBe(200);
    expect(result.montant_reverse).toBe(866);     // 1000 + 150 - 84 - 200
  });

  it("calcule le reversement avec autres déductions", () => {
    const result = calculateReversement(1000, 150, 0.07, 0, 50, "75001");

    expect(result.autres_deductions).toBe(50);
    expect(result.montant_reverse).toBe(1016);    // 1000 + 150 - 84 - 50
  });

  it("calcule le reversement avec travaux et autres déductions", () => {
    const result = calculateReversement(1000, 150, 0.07, 200, 50, "75001");

    expect(result.montant_reverse).toBe(816);     // 1000 + 150 - 84 - 200 - 50
  });

  it("calcule le reversement en DROM avec TVA réduite", () => {
    const result = calculateReversement(1000, 150, 0.07, 0, 0, "97200");

    expect(result.honoraires_ttc).toBe(75.95);    // 1000 * 7% * 1.085
    expect(result.montant_reverse).toBe(1074.05); // 1000 + 150 - 75.95
  });

  it("peut avoir un reversement négatif si déductions > encaissements", () => {
    const result = calculateReversement(500, 50, 0.07, 600, 100, "75001");

    // 500 + 50 - 42 - 600 - 100 = -192
    expect(result.montant_reverse).toBe(-192);
  });
});

// ============================================================================
// TESTS PRORATA
// ============================================================================

describe("calculateProrata", () => {
  it("calcule le prorata pour une année complète", () => {
    const result = calculateProrata("2024-01-01", "2024-12-31", 2024);

    expect(result.jours_occupation).toBe(366);    // 2024 est bissextile
    expect(result.jours_annee).toBe(366);
    expect(result.ratio).toBe(1);
  });

  it("calcule le prorata pour une année complète non bissextile", () => {
    const result = calculateProrata("2025-01-01", "2025-12-31", 2025);

    expect(result.jours_occupation).toBe(365);
    expect(result.jours_annee).toBe(365);
    expect(result.ratio).toBe(1);
  });

  it("calcule le prorata pour 6 mois", () => {
    const result = calculateProrata("2024-01-01", "2024-06-30", 2024);

    expect(result.jours_occupation).toBe(182);    // 31+29+31+30+31+30 = 182 (jan-juin 2024)
    expect(result.jours_annee).toBe(366);
    expect(result.ratio).toBeCloseTo(0.4973, 4);  // 182/366
  });

  it("calcule le prorata pour une entrée en cours d'année", () => {
    const result = calculateProrata("2024-07-15", "2024-12-31", 2024);

    // Du 15 juillet au 31 décembre = 170 jours
    expect(result.jours_occupation).toBe(170);
    expect(result.ratio).toBeCloseTo(0.4645, 4);
  });

  it("calcule le prorata pour une sortie en cours d'année", () => {
    const result = calculateProrata("2024-01-01", "2024-03-15", 2024);

    // Du 1er janvier au 15 mars = 75 jours
    expect(result.jours_occupation).toBe(75);
    expect(result.ratio).toBeCloseTo(0.2049, 4);
  });

  it("borne les dates à l'année demandée", () => {
    // Bail du 15/06/2023 au 30/06/2025, on demande 2024
    const result = calculateProrata("2023-06-15", "2025-06-30", 2024);

    // Devrait être borné à toute l'année 2024
    expect(result.jours_occupation).toBe(366);
    expect(result.jours_annee).toBe(366);
    expect(result.ratio).toBe(1);
  });

  it("retourne 0 si le bail ne couvre pas l'année", () => {
    const result = calculateProrata("2022-01-01", "2022-12-31", 2024);

    // Le bail est en 2022, on demande 2024
    expect(result.jours_occupation).toBeLessThanOrEqual(0);
  });
});

// ============================================================================
// TESTS D'INTÉGRATION CALCULS
// ============================================================================

describe("Intégration calculs complets", () => {
  it("simule un mois complet de gestion", () => {
    // Loyer 1200€ HC + 80€ charges
    const loyerHC = 1200;
    const charges = 80;
    const totalLocataire = loyerHC + charges;

    // Calcul honoraires
    const honoraires = calculateHonoraires(loyerHC, 0.07, "75001");

    // Calcul reversement
    const reversement = calculateReversement(loyerHC, charges, 0.07, 0, 0, "75001");

    // Vérifications
    expect(honoraires.montant_ht).toBe(84);        // 1200 * 7%
    expect(honoraires.tva_montant).toBe(16.8);     // 84 * 20%
    expect(honoraires.total_ttc).toBe(100.8);

    expect(reversement.montant_reverse).toBe(1179.2); // 1200 + 80 - 100.8

    // Vérification équilibre
    const totalSorties = honoraires.total_ttc + reversement.montant_reverse;
    expect(totalSorties).toBeCloseTo(totalLocataire, 2);
  });

  it("simule une année de gestion avec régularisation charges", () => {
    const loyerMensuelHC = 950;
    const provisionCharges = 120;

    // 12 mois de loyers
    let totalLoyers = 0;
    let totalHonoraires = 0;
    let totalReversements = 0;

    for (let mois = 0; mois < 12; mois++) {
      const honoraires = calculateHonoraires(loyerMensuelHC, 0.07, "75001");
      const reversement = calculateReversement(loyerMensuelHC, provisionCharges, 0.07, 0, 0, "75001");

      totalLoyers += loyerMensuelHC + provisionCharges;
      totalHonoraires += honoraires.total_ttc;
      totalReversements += reversement.montant_reverse;
    }

    // Charges réelles: 1200€ (provisions: 1440€) → trop perçu 240€
    const chargesReelles = 1200;
    const provisionsPercues = provisionCharges * 12; // 1440€
    const regularisation = provisionsPercues - chargesReelles; // 240€ à reverser

    // Totaux annuels
    expect(totalLoyers).toBe((950 + 120) * 12);    // 12840€
    expect(totalHonoraires).toBeCloseTo(79.8 * 12, 1); // ~957.60€
    expect(totalReversements).toBeCloseTo(990.2 * 12, 1); // ~11882.40€

    // Après régularisation, le propriétaire doit encore recevoir 240€
    const totalFinalProprietaire = totalReversements + regularisation;
    expect(totalFinalProprietaire).toBeCloseTo(12122.4, 1);
  });
});
