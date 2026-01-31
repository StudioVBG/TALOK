/**
 * Sprint 1 - Tests de conformité légale
 *
 * GAP-001: Dépôt de garantie bail mobilité (Art. 25-13 Loi ELAN)
 * GAP-002: Inventaire meublé pour EDL (Décret 2015-981)
 * GAP-003: Skip retenue DG pour bail mobilité
 */

import { describe, it, expect } from "vitest";
import {
  MANDATORY_FURNITURE_LIST,
  FURNITURE_CATEGORY_LABELS,
  FURNITURE_CONDITION_LABELS,
  type FurnitureItem,
  type FurnitureCondition,
} from "@/lib/types/end-of-lease";

// ============================================
// GAP-001: Tests Dépôt de Garantie Bail Mobilité
// ============================================

describe("GAP-001: Dépôt de Garantie Bail Mobilité", () => {
  // Simuler la logique de validation
  const validateDepositForLeaseType = (
    leaseType: string,
    deposit: number
  ): { valid: boolean; error?: string } => {
    if (leaseType === "bail_mobilite" && deposit > 0) {
      return {
        valid: false,
        error: "Le dépôt de garantie est interdit pour un bail mobilité (Art. 25-13 Loi ELAN)",
      };
    }
    return { valid: true };
  };

  it("doit rejeter un dépôt > 0 pour bail mobilité", () => {
    const result = validateDepositForLeaseType("bail_mobilite", 500);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Art. 25-13 Loi ELAN");
  });

  it("doit accepter dépôt = 0 pour bail mobilité", () => {
    const result = validateDepositForLeaseType("bail_mobilite", 0);
    expect(result.valid).toBe(true);
  });

  it("doit accepter un dépôt pour bail meublé standard", () => {
    const result = validateDepositForLeaseType("bail_meuble", 1600);
    expect(result.valid).toBe(true);
  });

  it("doit accepter un dépôt pour bail nu", () => {
    const result = validateDepositForLeaseType("bail_nu", 800);
    expect(result.valid).toBe(true);
  });
});

// ============================================
// GAP-002: Tests Inventaire Meublé (Décret 2015-981)
// ============================================

describe("GAP-002: Inventaire Meublé - Décret 2015-981", () => {
  describe("Liste des équipements obligatoires", () => {
    it("doit contenir les 11 éléments obligatoires du décret", () => {
      // Le décret 2015-981 liste 11 éléments obligatoires
      expect(MANDATORY_FURNITURE_LIST.length).toBe(11);
    });

    it("tous les éléments doivent être marqués obligatoires", () => {
      const allMandatory = MANDATORY_FURNITURE_LIST.every(
        (item) => item.is_mandatory === true
      );
      expect(allMandatory).toBe(true);
    });

    it("doit inclure la literie (Art.2 - 1°)", () => {
      const literie = MANDATORY_FURNITURE_LIST.find(
        (item) => item.category === "literie"
      );
      expect(literie).toBeDefined();
      expect(literie?.legal_requirement).toContain("Art.2 - 1°");
    });

    it("doit inclure les dispositifs d'occultation (Art.2 - 2°)", () => {
      const occultation = MANDATORY_FURNITURE_LIST.find(
        (item) => item.category === "occultation"
      );
      expect(occultation).toBeDefined();
      expect(occultation?.legal_requirement).toContain("Art.2 - 2°");
    });

    it("doit inclure les plaques de cuisson (Art.2 - 3°)", () => {
      const plaques = MANDATORY_FURNITURE_LIST.find(
        (item) => item.name.includes("Plaques de cuisson")
      );
      expect(plaques).toBeDefined();
      expect(plaques?.legal_requirement).toContain("Art.2 - 3°");
    });

    it("doit inclure four ou micro-ondes (Art.2 - 4°)", () => {
      const four = MANDATORY_FURNITURE_LIST.find(
        (item) => item.name.includes("Four") || item.name.includes("micro-ondes")
      );
      expect(four).toBeDefined();
      expect(four?.legal_requirement).toContain("Art.2 - 4°");
    });

    it("doit inclure réfrigérateur avec congélateur (Art.2 - 5°)", () => {
      const frigo = MANDATORY_FURNITURE_LIST.find(
        (item) => item.name.includes("Réfrigérateur")
      );
      expect(frigo).toBeDefined();
      expect(frigo?.legal_requirement).toContain("Art.2 - 5°");
    });

    it("doit inclure vaisselle (Art.2 - 6°)", () => {
      const vaisselle = MANDATORY_FURNITURE_LIST.find(
        (item) => item.name.includes("Vaisselle")
      );
      expect(vaisselle).toBeDefined();
      expect(vaisselle?.legal_requirement).toContain("Art.2 - 6°");
    });

    it("doit inclure ustensiles de cuisine (Art.2 - 7°)", () => {
      const ustensiles = MANDATORY_FURNITURE_LIST.find(
        (item) => item.name.includes("Ustensiles")
      );
      expect(ustensiles).toBeDefined();
      expect(ustensiles?.legal_requirement).toContain("Art.2 - 7°");
    });

    it("doit inclure table et sièges (Art.2 - 8°)", () => {
      const table = MANDATORY_FURNITURE_LIST.find(
        (item) => item.name.includes("Table")
      );
      expect(table).toBeDefined();
      expect(table?.legal_requirement).toContain("Art.2 - 8°");
    });

    it("doit inclure étagères de rangement (Art.2 - 9°)", () => {
      const etageres = MANDATORY_FURNITURE_LIST.find(
        (item) => item.name.includes("Étagères")
      );
      expect(etageres).toBeDefined();
      expect(etageres?.legal_requirement).toContain("Art.2 - 9°");
    });

    it("doit inclure luminaires (Art.2 - 10°)", () => {
      const luminaires = MANDATORY_FURNITURE_LIST.find(
        (item) => item.name.includes("Luminaires")
      );
      expect(luminaires).toBeDefined();
      expect(luminaires?.legal_requirement).toContain("Art.2 - 10°");
    });

    it("doit inclure matériel d'entretien (Art.2 - 11°)", () => {
      const entretien = MANDATORY_FURNITURE_LIST.find(
        (item) => item.category === "entretien"
      );
      expect(entretien).toBeDefined();
      expect(entretien?.legal_requirement).toContain("Art.2 - 11°");
    });
  });

  describe("Catégories de mobilier", () => {
    it("doit avoir 7 catégories définies", () => {
      const categories = Object.keys(FURNITURE_CATEGORY_LABELS);
      expect(categories.length).toBe(7);
    });

    it("toutes les catégories doivent avoir un label", () => {
      const expectedCategories = [
        "literie",
        "occultation",
        "cuisine",
        "rangement",
        "luminaire",
        "vaisselle",
        "entretien",
      ];

      expectedCategories.forEach((cat) => {
        expect(FURNITURE_CATEGORY_LABELS[cat as keyof typeof FURNITURE_CATEGORY_LABELS]).toBeDefined();
      });
    });
  });

  describe("États du mobilier", () => {
    it("doit avoir 6 états possibles", () => {
      const conditions = Object.keys(FURNITURE_CONDITION_LABELS);
      expect(conditions.length).toBe(6);
    });

    it("doit inclure l'état 'absent' pour les éléments manquants", () => {
      expect(FURNITURE_CONDITION_LABELS.absent).toBe("Absent / Manquant");
    });
  });

  describe("Validation inventaire complet", () => {
    const validateInventory = (items: Partial<FurnitureItem>[]): {
      isComplete: boolean;
      missingMandatory: string[];
    } => {
      const mandatoryItems = MANDATORY_FURNITURE_LIST.filter((i) => i.is_mandatory);
      const missingMandatory: string[] = [];

      mandatoryItems.forEach((mandatory) => {
        const found = items.find(
          (item) =>
            item.name === mandatory.name && item.condition !== "absent"
        );
        if (!found) {
          missingMandatory.push(mandatory.name);
        }
      });

      return {
        isComplete: missingMandatory.length === 0,
        missingMandatory,
      };
    };

    it("doit marquer inventaire incomplet si literie absente", () => {
      const items: Partial<FurnitureItem>[] = MANDATORY_FURNITURE_LIST.map((item) => ({
        ...item,
        id: `test-${item.name}`,
        quantity: 1,
        condition: item.category === "literie" ? "absent" : "bon",
      }));

      const result = validateInventory(items);
      expect(result.isComplete).toBe(false);
      expect(result.missingMandatory).toContain("Literie avec couette ou couverture");
    });

    it("doit marquer inventaire complet si tous les éléments présents", () => {
      const items: Partial<FurnitureItem>[] = MANDATORY_FURNITURE_LIST.map((item) => ({
        ...item,
        id: `test-${item.name}`,
        quantity: 1,
        condition: "bon" as FurnitureCondition,
      }));

      const result = validateInventory(items);
      expect(result.isComplete).toBe(true);
      expect(result.missingMandatory).toHaveLength(0);
    });
  });
});

// ============================================
// GAP-003: Tests Skip Retenue DG Bail Mobilité
// ============================================

describe("GAP-003: Skip Retenue DG pour Bail Mobilité", () => {
  // Simuler la logique de calcul de retenue
  const calculateDepositRetention = (
    leaseType: string,
    depositAmount: number,
    damages: { cost: number }[]
  ): {
    retention: number;
    refund: number;
    message?: string;
  } => {
    // Bail mobilité = pas de dépôt = pas de retenue
    if (leaseType === "bail_mobilite") {
      return {
        retention: 0,
        refund: 0,
        message: "Bail mobilité: pas de dépôt de garantie (Art. 25-13 Loi ELAN)",
      };
    }

    // Calcul standard pour autres types
    const totalDamages = damages.reduce((sum, d) => sum + d.cost, 0);
    const retention = Math.min(totalDamages, depositAmount);
    const refund = depositAmount - retention;

    return { retention, refund };
  };

  it("doit retourner 0 pour bail mobilité même avec dommages", () => {
    const damages = [{ cost: 500 }, { cost: 300 }];
    const result = calculateDepositRetention("bail_mobilite", 0, damages);

    expect(result.retention).toBe(0);
    expect(result.refund).toBe(0);
    expect(result.message).toContain("Art. 25-13 Loi ELAN");
  });

  it("doit retourner 0 pour bail mobilité sans dommages", () => {
    const result = calculateDepositRetention("bail_mobilite", 0, []);

    expect(result.retention).toBe(0);
    expect(result.refund).toBe(0);
  });

  it("doit calculer la retenue normalement pour bail meublé", () => {
    const damages = [{ cost: 500 }, { cost: 300 }];
    const result = calculateDepositRetention("bail_meuble", 1600, damages);

    expect(result.retention).toBe(800); // 500 + 300
    expect(result.refund).toBe(800); // 1600 - 800
  });

  it("doit plafonner la retenue au montant du dépôt", () => {
    const damages = [{ cost: 1500 }, { cost: 1000 }]; // 2500€ de dommages
    const result = calculateDepositRetention("bail_meuble", 1600, damages);

    expect(result.retention).toBe(1600); // Plafonné au dépôt
    expect(result.refund).toBe(0);
  });

  it("doit rembourser intégralement si aucun dommage pour bail standard", () => {
    const result = calculateDepositRetention("bail_nu", 800, []);

    expect(result.retention).toBe(0);
    expect(result.refund).toBe(800);
  });
});

// ============================================
// Tests d'intégration des 3 GAPs
// ============================================

describe("Intégration Sprint 1: Conformité Loi ELAN + Décret 2015-981", () => {
  interface LeaseEndScenario {
    leaseType: string;
    depositAmount: number;
    hasFurnitureInventory: boolean;
    inventoryComplete: boolean;
    damages: { cost: number }[];
  }

  const processLeaseEnd = (scenario: LeaseEndScenario): {
    depositRetention: number;
    depositRefund: number;
    furnitureCheck: "required" | "optional" | "not_applicable";
    isLegallyCompliant: boolean;
    issues: string[];
  } => {
    const issues: string[] = [];

    // GAP-001: Vérifier DG
    if (scenario.leaseType === "bail_mobilite" && scenario.depositAmount > 0) {
      issues.push("GAP-001: Dépôt interdit pour bail mobilité");
    }

    // GAP-002: Inventaire meublé
    const needsInventory = ["bail_meuble", "bail_mobilite"].includes(scenario.leaseType);
    let furnitureCheck: "required" | "optional" | "not_applicable" = "not_applicable";

    if (needsInventory) {
      furnitureCheck = "required";
      if (!scenario.hasFurnitureInventory) {
        issues.push("GAP-002: Inventaire meublé obligatoire manquant");
      } else if (!scenario.inventoryComplete) {
        issues.push("GAP-002: Inventaire meublé incomplet");
      }
    }

    // GAP-003: Calcul retenue
    let depositRetention = 0;
    let depositRefund = 0;

    if (scenario.leaseType === "bail_mobilite") {
      // Pas de retenue possible
      depositRetention = 0;
      depositRefund = 0;
    } else {
      const totalDamages = scenario.damages.reduce((sum, d) => sum + d.cost, 0);
      depositRetention = Math.min(totalDamages, scenario.depositAmount);
      depositRefund = scenario.depositAmount - depositRetention;
    }

    return {
      depositRetention,
      depositRefund,
      furnitureCheck,
      isLegallyCompliant: issues.length === 0,
      issues,
    };
  };

  it("bail mobilité valide: pas de DG, inventaire requis", () => {
    const result = processLeaseEnd({
      leaseType: "bail_mobilite",
      depositAmount: 0,
      hasFurnitureInventory: true,
      inventoryComplete: true,
      damages: [{ cost: 200 }],
    });

    expect(result.isLegallyCompliant).toBe(true);
    expect(result.depositRetention).toBe(0);
    expect(result.depositRefund).toBe(0);
    expect(result.furnitureCheck).toBe("required");
  });

  it("bail mobilité invalide: avec DG", () => {
    const result = processLeaseEnd({
      leaseType: "bail_mobilite",
      depositAmount: 500,
      hasFurnitureInventory: true,
      inventoryComplete: true,
      damages: [],
    });

    expect(result.isLegallyCompliant).toBe(false);
    expect(result.issues).toContain("GAP-001: Dépôt interdit pour bail mobilité");
  });

  it("bail meublé valide: DG autorisé, inventaire requis", () => {
    const result = processLeaseEnd({
      leaseType: "bail_meuble",
      depositAmount: 1600,
      hasFurnitureInventory: true,
      inventoryComplete: true,
      damages: [{ cost: 500 }],
    });

    expect(result.isLegallyCompliant).toBe(true);
    expect(result.depositRetention).toBe(500);
    expect(result.depositRefund).toBe(1100);
    expect(result.furnitureCheck).toBe("required");
  });

  it("bail meublé invalide: inventaire manquant", () => {
    const result = processLeaseEnd({
      leaseType: "bail_meuble",
      depositAmount: 1600,
      hasFurnitureInventory: false,
      inventoryComplete: false,
      damages: [],
    });

    expect(result.isLegallyCompliant).toBe(false);
    expect(result.issues).toContain("GAP-002: Inventaire meublé obligatoire manquant");
  });

  it("bail nu: DG autorisé, inventaire non requis", () => {
    const result = processLeaseEnd({
      leaseType: "bail_nu",
      depositAmount: 800,
      hasFurnitureInventory: false,
      inventoryComplete: false,
      damages: [{ cost: 300 }],
    });

    expect(result.isLegallyCompliant).toBe(true);
    expect(result.depositRetention).toBe(300);
    expect(result.depositRefund).toBe(500);
    expect(result.furnitureCheck).toBe("not_applicable");
  });
});
