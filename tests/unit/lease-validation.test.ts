/**
 * ✅ SOTA 2026 - Tests de validation des baux
 * 
 * Couvre tous les scénarios de validation :
 * - Propriétaires particuliers vs sociétés
 * - Types de baux (nu, meublé, colocation, saisonnier, mobilité)
 * - Règles DPE 2025-2034
 * - Dépôts de garantie légaux
 * - Surfaces minimales
 * - Dates et durées
 */

import { describe, it, expect } from "vitest";

// Simuler les types nécessaires (sans dépendance au hook React)
interface BailComplet {
  bailleur?: {
    nom?: string;
    prenom?: string;
    adresse?: string;
    type?: string;
    raison_sociale?: string;
    siret?: string;
    email?: string;
    representant_nom?: string;
  };
  locataires?: Array<{
    nom?: string;
    prenom?: string;
    email?: string;
  }>;
  logement?: {
    adresse_complete?: string;
    surface_habitable?: number;
    nb_pieces_principales?: number;
  };
  conditions?: {
    type_bail?: string;
    loyer_hc?: number;
    charges_montant?: number;
    depot_garantie?: number;
    date_debut?: string;
    date_fin?: string;
    duree_mois?: number;
  };
  diagnostics?: {
    dpe?: {
      classe_energie?: string;
      date_realisation?: string;
      consommation_energie?: number;
    };
  };
}

// Réutiliser la logique de validation (pure function)
const SURFACE_MINIMUM_M2 = 9;
const BAIL_MOBILITE_DUREE_MAX_MOIS = 10;

const DEPOT_MAX_PAR_TYPE: Record<string, number> = {
  nu: 1,
  meuble: 2,
  colocation: 2,
  saisonnier: 2,
  mobilite: 0,
  etudiant: 1,
};

interface ValidationError {
  code: string;
  message: string;
  severity: "critical" | "warning" | "info";
}

function validateBail(bailData: Partial<BailComplet> | null): {
  critical: ValidationError[];
  warnings: ValidationError[];
  isValid: boolean;
} {
  const critical: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!bailData) {
    return { critical: [{ code: "NO_DATA", message: "Aucune donnée", severity: "critical" }], warnings: [], isValid: false };
  }

  // Bailleur
  const isSociete = bailData.bailleur?.type === "societe";
  if (isSociete) {
    if (!bailData.bailleur?.nom && !bailData.bailleur?.raison_sociale) {
      critical.push({ code: "BAILLEUR_RAISON_SOCIALE_MISSING", message: "Raison sociale manquante", severity: "critical" });
    }
    if (!bailData.bailleur?.siret) {
      warnings.push({ code: "BAILLEUR_SIRET_MISSING", message: "SIRET manquant", severity: "warning" });
    }
  } else {
    if (!bailData.bailleur?.nom) {
      critical.push({ code: "BAILLEUR_NOM_MISSING", message: "Nom manquant", severity: "critical" });
    }
    if (!bailData.bailleur?.prenom) {
      critical.push({ code: "BAILLEUR_PRENOM_MISSING", message: "Prénom manquant", severity: "critical" });
    }
  }

  if (!bailData.bailleur?.adresse) {
    critical.push({ code: "BAILLEUR_ADRESSE_MISSING", message: "Adresse manquante", severity: "critical" });
  }

  // Locataires
  if (!bailData.locataires || bailData.locataires.length === 0) {
    critical.push({ code: "LOCATAIRE_MISSING", message: "Aucun locataire", severity: "critical" });
  }

  // Logement
  if (!bailData.logement?.adresse_complete) {
    critical.push({ code: "LOGEMENT_ADRESSE_MISSING", message: "Adresse logement manquante", severity: "critical" });
  }

  const surface = bailData.logement?.surface_habitable || 0;
  if (surface <= 0) {
    critical.push({ code: "LOGEMENT_SURFACE_MISSING", message: "Surface manquante", severity: "critical" });
  } else if (surface < SURFACE_MINIMUM_M2) {
    critical.push({ code: "LOGEMENT_SURFACE_INSUFFISANTE", message: `Surface < ${SURFACE_MINIMUM_M2}m²`, severity: "critical" });
  }

  // Conditions financières
  const typeBail = bailData.conditions?.type_bail || "nu";
  const loyerHC = bailData.conditions?.loyer_hc || 0;
  const depot = bailData.conditions?.depot_garantie || 0;

  if (loyerHC <= 0) {
    critical.push({ code: "LOYER_MISSING", message: "Loyer manquant", severity: "critical" });
  }

  // Dépôt de garantie
  const maxDepotMois = DEPOT_MAX_PAR_TYPE[typeBail] ?? 1;
  const maxDepotLegal = loyerHC * maxDepotMois;

  if (typeBail === "mobilite" && depot > 0) {
    critical.push({ code: "DEPOT_MOBILITE_INTERDIT", message: "Dépôt interdit bail mobilité", severity: "critical" });
  } else if (depot > maxDepotLegal && maxDepotLegal > 0) {
    critical.push({ code: "DEPOT_EXCESSIF", message: `Dépôt > max légal (${maxDepotLegal}€)`, severity: "critical" });
  }

  // Dates
  if (!bailData.conditions?.date_debut) {
    critical.push({ code: "DATE_DEBUT_MISSING", message: "Date début manquante", severity: "critical" });
  }

  if (typeBail === "mobilite" || typeBail === "saisonnier") {
    if (!bailData.conditions?.date_fin) {
      critical.push({ code: "DATE_FIN_OBLIGATOIRE", message: "Date fin obligatoire", severity: "critical" });
    } else if (bailData.conditions.date_debut) {
      const debut = new Date(bailData.conditions.date_debut);
      const fin = new Date(bailData.conditions.date_fin);
      const diffMois = Math.ceil((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24 * 30));

      if (typeBail === "mobilite" && diffMois > BAIL_MOBILITE_DUREE_MAX_MOIS) {
        critical.push({ code: "MOBILITE_DUREE_EXCESSIVE", message: "Bail mobilité > 10 mois", severity: "critical" });
      }
    }
  }

  // DPE
  if (!bailData.diagnostics?.dpe?.classe_energie) {
    critical.push({ code: "DPE_MISSING", message: "DPE obligatoire", severity: "critical" });
  } else {
    const classe = bailData.diagnostics.dpe.classe_energie;
    const annee = new Date().getFullYear();
    
    if (annee >= 2025 && classe === "G") {
      critical.push({ code: "DPE_G_INTERDIT", message: "Classe G interdite 2025", severity: "critical" });
    }
    if (classe === "F") {
      warnings.push({ code: "DPE_F_FUTUR", message: "Classe F interdite 2028", severity: "warning" });
    }
  }

  return { critical, warnings, isValid: critical.length === 0 };
}

// ============================================
// TESTS
// ============================================

describe("Validation Bail - SOTA 2026", () => {
  
  describe("Bailleur Particulier", () => {
    it("doit rejeter si nom manquant", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "BAILLEUR_NOM_MISSING")).toBe(true);
    });

    it("doit rejeter si prénom manquant", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "BAILLEUR_PRENOM_MISSING")).toBe(true);
    });

    it("doit accepter un bail complet particulier", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont", prenom: "Marie" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, depot_garantie: 800, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(true);
      expect(result.critical).toHaveLength(0);
    });
  });

  describe("Bailleur Société", () => {
    it("doit rejeter si raison sociale manquante", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { type: "societe", adresse: "1 rue Test", siret: "12345678901234" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "BAILLEUR_RAISON_SOCIALE_MISSING")).toBe(true);
    });

    it("doit avertir si SIRET manquant (non bloquant)", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { type: "societe", raison_sociale: "SCI Test", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, depot_garantie: 800, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(true); // SIRET manquant = avertissement, pas critique
      expect(result.warnings.some(e => e.code === "BAILLEUR_SIRET_MISSING")).toBe(true);
    });

    it("doit accepter société avec raison_sociale dans nom", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { type: "societe", nom: "SCI Test", adresse: "1 rue Test", siret: "12345678901234" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, depot_garantie: 800, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Surface minimale", () => {
    it("doit rejeter si surface < 9m²", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 8 },
        conditions: { loyer_hc: 400, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "LOGEMENT_SURFACE_INSUFFISANTE")).toBe(true);
    });

    it("doit accepter surface = 9m² (minimum légal)", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 9 },
        conditions: { loyer_hc: 400, depot_garantie: 400, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Dépôt de garantie par type de bail", () => {
    it("bail nu: dépôt max = 1 mois", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, depot_garantie: 1600, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "DEPOT_EXCESSIF")).toBe(true);
    });

    it("bail meublé: dépôt max = 2 mois", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, depot_garantie: 1600, date_debut: "2026-02-01", type_bail: "meuble" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(true); // 1600€ = 2 mois de 800€, c'est OK
    });

    it("bail meublé: dépôt > 2 mois = rejet", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, depot_garantie: 2400, date_debut: "2026-02-01", type_bail: "meuble" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "DEPOT_EXCESSIF")).toBe(true);
    });

    it("bail mobilité: dépôt interdit", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { 
          loyer_hc: 800, 
          depot_garantie: 100, 
          date_debut: "2026-02-01", 
          date_fin: "2026-06-01",
          type_bail: "mobilite" 
        },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "DEPOT_MOBILITE_INTERDIT")).toBe(true);
    });
  });

  describe("Bail mobilité - durée", () => {
    it("doit rejeter si durée > 10 mois", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { 
          loyer_hc: 800, 
          depot_garantie: 0,
          date_debut: "2026-01-01", 
          date_fin: "2027-01-01", // 12 mois
          type_bail: "mobilite" 
        },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "MOBILITE_DUREE_EXCESSIVE")).toBe(true);
    });

    it("doit rejeter si date_fin manquante", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { 
          loyer_hc: 800, 
          depot_garantie: 0,
          date_debut: "2026-01-01",
          type_bail: "mobilite" 
        },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "DATE_FIN_OBLIGATOIRE")).toBe(true);
    });

    it("doit accepter bail mobilité valide (≤ 10 mois)", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { 
          loyer_hc: 800, 
          depot_garantie: 0,
          date_debut: "2026-01-01", 
          date_fin: "2026-06-01", // 5 mois
          type_bail: "mobilite" 
        },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(true);
    });
  });

  describe("DPE - Loi Climat & Résilience", () => {
    it("doit rejeter classe G depuis 2025", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, depot_garantie: 800, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: { dpe: { classe_energie: "G" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "DPE_G_INTERDIT")).toBe(true);
    });

    it("doit avertir pour classe F (interdit 2028)", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, depot_garantie: 800, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: { dpe: { classe_energie: "F" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(true); // En 2026, F est encore autorisé
      expect(result.warnings.some(e => e.code === "DPE_F_FUTUR")).toBe(true);
    });

    it("doit rejeter si DPE manquant", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { loyer_hc: 800, depot_garantie: 800, date_debut: "2026-02-01", type_bail: "nu" },
        diagnostics: {},
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "DPE_MISSING")).toBe(true);
    });

    it("doit accepter classe A-E", () => {
      const classes = ["A", "B", "C", "D", "E"];
      
      for (const classe of classes) {
        const bail: Partial<BailComplet> = {
          bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
          locataires: [{ nom: "Dupont" }],
          logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
          conditions: { loyer_hc: 800, depot_garantie: 800, date_debut: "2026-02-01", type_bail: "nu" },
          diagnostics: { dpe: { classe_energie: classe } },
        };
        const result = validateBail(bail);
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe("Bail saisonnier", () => {
    it("doit exiger date_fin", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { 
          loyer_hc: 800, 
          depot_garantie: 1600,
          date_debut: "2026-07-01",
          type_bail: "saisonnier" 
        },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(false);
      expect(result.critical.some(e => e.code === "DATE_FIN_OBLIGATOIRE")).toBe(true);
    });

    it("doit accepter bail saisonnier valide", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [{ nom: "Dupont" }],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 30 },
        conditions: { 
          loyer_hc: 800, 
          depot_garantie: 1600,
          date_debut: "2026-07-01",
          date_fin: "2026-08-15",
          type_bail: "saisonnier" 
        },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Colocation", () => {
    it("doit accepter dépôt de 2 mois", () => {
      const bail: Partial<BailComplet> = {
        bailleur: { nom: "Martin", prenom: "Jean", adresse: "1 rue Test" },
        locataires: [
          { nom: "Dupont", prenom: "Marie" },
          { nom: "Durand", prenom: "Pierre" }
        ],
        logement: { adresse_complete: "2 rue Logement", surface_habitable: 60 },
        conditions: { loyer_hc: 1200, depot_garantie: 2400, date_debut: "2026-02-01", type_bail: "colocation" },
        diagnostics: { dpe: { classe_energie: "C" } },
      };
      const result = validateBail(bail);
      expect(result.isValid).toBe(true);
    });
  });
});

