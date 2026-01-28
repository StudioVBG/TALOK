import { describe, it, expect } from "vitest";
import {
  habitationSchemaV3,
  habitationSchemaV3Base,
  propertySchemaV3,
} from "@/lib/validations/property-v3";

describe("Property V3 Validation - SOTA 2026", () => {
  // Base valid habitation data
  const baseHabitation = {
    type_bien: "appartement" as const,
    adresse_complete: "123 Rue de Paris",
    code_postal: "75001",
    ville: "Paris",
    departement: "75",
    loyer_hc: 1000,
    charges_mensuelles: 100,
    depot_garantie: 2000,
    surface_habitable_m2: 45,
    nb_pieces: 2,
    nb_chambres: 1,
    etage: 3,
    ascenseur: true,
    meuble: false,
    has_balcon: false,
    has_terrasse: false,
    has_jardin: false,
    has_cave: true,
    chauffage_type: "individuel" as const,
    chauffage_energie: "electricite" as const,
    eau_chaude_type: "electrique_indiv" as const,
    clim_presence: "aucune" as const,
    equipments: [],
    type_bail: "vide" as const,
    dpe_classe_energie: "D" as const,
    dpe_classe_climat: "C" as const,
  };

  describe("DPE G Validation (Passoire Energetique)", () => {
    it("should reject DPE G for bail vide", () => {
      const data = {
        ...baseHabitation,
        dpe_classe_energie: "G",
        type_bail: "vide",
      };

      const result = habitationSchemaV3.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const dpeError = result.error.errors.find(e => e.path.includes("dpe_classe_energie"));
        expect(dpeError).toBeDefined();
        expect(dpeError?.message).toContain("passoires thermiques");
        expect(dpeError?.message).toContain("interdits");
      }
    });

    it("should reject DPE G for bail meuble", () => {
      const data = {
        ...baseHabitation,
        dpe_classe_energie: "G",
        type_bail: "meuble",
      };

      const result = habitationSchemaV3.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const dpeError = result.error.errors.find(e => e.path.includes("dpe_classe_energie"));
        expect(dpeError).toBeDefined();
      }
    });

    it("should allow DPE G for colocation (derogation temporaire)", () => {
      const data = {
        ...baseHabitation,
        type_bien: "colocation" as const,
        dpe_classe_energie: "G",
        type_bail: "colocation",
      };

      const result = habitationSchemaV3.safeParse(data);

      // Should pass - colocation has temporary exemption
      expect(result.success).toBe(true);
    });

    it("should allow DPE F (not a passoire)", () => {
      const data = {
        ...baseHabitation,
        dpe_classe_energie: "F",
        type_bail: "vide",
      };

      const result = habitationSchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should allow DPE A-E", () => {
      const classes = ["A", "B", "C", "D", "E"] as const;

      for (const classe of classes) {
        const data = {
          ...baseHabitation,
          dpe_classe_energie: classe,
        };

        const result = habitationSchemaV3.safeParse(data);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Surface Carrez Validation", () => {
    it("should reject surface_carrez > surface_habitable_m2", () => {
      const data = {
        ...baseHabitation,
        surface_habitable_m2: 45,
        surface_carrez: 50, // Invalid: Carrez cannot exceed habitable
      };

      const result = habitationSchemaV3.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const carrezError = result.error.errors.find(e => e.path.includes("surface_carrez"));
        expect(carrezError).toBeDefined();
        expect(carrezError?.message).toContain("Carrez");
      }
    });

    it("should allow surface_carrez <= surface_habitable_m2", () => {
      const data = {
        ...baseHabitation,
        surface_habitable_m2: 45,
        surface_carrez: 42, // Valid: Carrez is less than habitable
      };

      const result = habitationSchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should allow surface_carrez = surface_habitable_m2", () => {
      const data = {
        ...baseHabitation,
        surface_habitable_m2: 45,
        surface_carrez: 45, // Valid: equal
      };

      const result = habitationSchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should allow null/undefined surface_carrez", () => {
      const data = {
        ...baseHabitation,
        surface_carrez: null,
      };

      const result = habitationSchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("Surface Minimale (Decret Decence)", () => {
    it("should reject surface < 9m2", () => {
      const data = {
        ...baseHabitation,
        surface_habitable_m2: 8, // Invalid: below minimum
      };

      const result = habitationSchemaV3.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const surfaceError = result.error.errors.find(e => e.path.includes("surface_habitable_m2"));
        expect(surfaceError).toBeDefined();
        expect(surfaceError?.message).toContain("9m2");
      }
    });

    it("should allow surface = 9m2 (minimum)", () => {
      const data = {
        ...baseHabitation,
        surface_habitable_m2: 9,
      };

      const result = habitationSchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should allow surface > 9m2", () => {
      const data = {
        ...baseHabitation,
        surface_habitable_m2: 20,
      };

      const result = habitationSchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("Chauffage Validation", () => {
    it("should require chauffage_energie when chauffage_type != aucun", () => {
      const data = {
        ...baseHabitation,
        chauffage_type: "individuel" as const,
        chauffage_energie: null,
      };

      const result = habitationSchemaV3.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const heatingError = result.error.errors.find(e => e.path.includes("chauffage_energie"));
        expect(heatingError).toBeDefined();
      }
    });

    it("should not require chauffage_energie when chauffage_type = aucun", () => {
      const data = {
        ...baseHabitation,
        chauffage_type: "aucun" as const,
        chauffage_energie: null,
      };

      const result = habitationSchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("Climatisation Validation", () => {
    it("should require clim_type when clim_presence = fixe", () => {
      const data = {
        ...baseHabitation,
        clim_presence: "fixe" as const,
        clim_type: null,
      };

      const result = habitationSchemaV3.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const climError = result.error.errors.find(e => e.path.includes("clim_type"));
        expect(climError).toBeDefined();
      }
    });

    it("should not require clim_type when clim_presence = aucune", () => {
      const data = {
        ...baseHabitation,
        clim_presence: "aucune" as const,
        clim_type: null,
      };

      const result = habitationSchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("Code Postal Validation - SOTA 2026", () => {
    it("should accept valid metropolitan code postal", () => {
      const validCodes = ["75001", "13001", "69001", "33000", "59000", "01000", "95999"];

      for (const cp of validCodes) {
        const data = {
          ...baseHabitation,
          code_postal: cp,
        };

        const result = habitationSchemaV3Base.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it("should accept Corse code postal (20xxx)", () => {
      const corseCodes = ["20000", "20090", "20200", "20620"];

      for (const cp of corseCodes) {
        const data = {
          ...baseHabitation,
          code_postal: cp,
        };

        const result = habitationSchemaV3Base.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it("should accept valid DOM-TOM code postal (971-976)", () => {
      // 971 Guadeloupe, 972 Martinique, 973 Guyane, 974 Réunion, 976 Mayotte
      const domTomCodes = [
        "97100", "97190", // Guadeloupe
        "97200", "97290", // Martinique
        "97300", "97390", // Guyane
        "97400", "97490", // Réunion
        "97600", "97690", // Mayotte
      ];

      for (const cp of domTomCodes) {
        const data = {
          ...baseHabitation,
          code_postal: cp,
        };

        const result = habitationSchemaV3Base.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid code postal format", () => {
      const invalidCodes = ["7500", "750001", "ABCDE", ""];

      for (const cp of invalidCodes) {
        const data = {
          ...baseHabitation,
          code_postal: cp,
        };

        const result = habitationSchemaV3Base.safeParse(data);
        expect(result.success).toBe(false);
      }
    });

    it("should reject invalid DOM-TOM code postal (975xx, 977xx-979xx)", () => {
      // 975 is Saint-Pierre-et-Miquelon (not a DROM)
      // 977-979 don't exist as standard postal codes
      const invalidDomTomCodes = ["97500", "97700", "97800", "97900"];

      for (const cp of invalidDomTomCodes) {
        const data = {
          ...baseHabitation,
          code_postal: cp,
        };

        const result = habitationSchemaV3Base.safeParse(data);
        expect(result.success).toBe(false);
      }
    });

    it("should reject code postal starting with 96xxx (invalid range)", () => {
      const data = {
        ...baseHabitation,
        code_postal: "96000",
      };

      const result = habitationSchemaV3Base.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject code postal starting with 00xxx (invalid range)", () => {
      const data = {
        ...baseHabitation,
        code_postal: "00100",
      };

      const result = habitationSchemaV3Base.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("Encadrement des Loyers - SOTA 2026", () => {
    it("should require loyer_reference when zone_encadrement is set", () => {
      const data = {
        ...baseHabitation,
        zone_encadrement: "paris",
        loyer_reference: null,
      };

      const result = habitationSchemaV3.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const loyerError = result.error.errors.find(e => e.path.includes("loyer_reference"));
        expect(loyerError).toBeDefined();
        expect(loyerError?.message).toContain("loyer de reference");
      }
    });

    it("should not require loyer_reference when zone_encadrement is aucune", () => {
      const data = {
        ...baseHabitation,
        zone_encadrement: "aucune",
        loyer_reference: null,
      };

      const result = habitationSchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should not require loyer_reference when zone_encadrement is null", () => {
      const data = {
        ...baseHabitation,
        zone_encadrement: null,
        loyer_reference: null,
      };

      const result = habitationSchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should accept valid zone_encadrement with loyer_reference", () => {
      const zones = ["paris", "paris_agglo", "lille", "lyon", "montpellier", "bordeaux"] as const;

      for (const zone of zones) {
        const data = {
          ...baseHabitation,
          zone_encadrement: zone,
          loyer_reference: 25.5, // EUR/m2
        };

        const result = habitationSchemaV3.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it("should require complement_loyer_justification when complement_loyer is set", () => {
      const data = {
        ...baseHabitation,
        zone_encadrement: "paris",
        loyer_reference: 25.5,
        complement_loyer: 50,
        complement_loyer_justification: null,
      };

      const result = habitationSchemaV3.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const justificationError = result.error.errors.find(e => e.path.includes("complement_loyer_justification"));
        expect(justificationError).toBeDefined();
      }
    });

    it("should accept complement_loyer with valid justification", () => {
      const data = {
        ...baseHabitation,
        zone_encadrement: "paris",
        loyer_reference: 25.5,
        complement_loyer: 50,
        complement_loyer_justification: "Vue exceptionnelle sur la Tour Eiffel",
      };

      const result = habitationSchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("Property Schema V3 Discriminated Union", () => {
    it("should validate appartement through discriminated union", () => {
      const data = {
        ...baseHabitation,
        type_bien: "appartement" as const,
      };

      const result = propertySchemaV3.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate parking type", () => {
      const parkingData = {
        type_bien: "parking" as const,
        adresse_complete: "123 Rue de Paris",
        code_postal: "75001",
        ville: "Paris",
        loyer_hc: 100,
        charges_mensuelles: 10,
        depot_garantie: 200,
        parking_type: "souterrain" as const,
        parking_gabarit: "berline" as const,
        parking_acces: ["badge" as const],
        parking_portail_securise: true,
        parking_video_surveillance: true,
        parking_gardien: false,
        type_bail: "parking_seul" as const,
      };

      const result = propertySchemaV3.safeParse(parkingData);
      expect(result.success).toBe(true);
    });
  });
});
