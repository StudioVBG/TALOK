/**
 * Tests unitaires de la validation cross-fields post-scrape.
 *
 * Cible : app/api/scrape/validation.ts
 *
 * Le scoring d'extraction ne juge que la PRÉSENCE des champs ; ces tests
 * couvrent la couche cohérence (loyer/m², CP↔ville, surface/pièces, charges,
 * année construction, DPE G) qui produit des warnings affichés au
 * propriétaire avant publication.
 */

import { describe, expect, it } from "vitest";
import type { ExtractedData } from "@/app/api/scrape/extractors";
import {
  normalizeAddressForDuplicate,
  validateExtractedData,
} from "@/app/api/scrape/validation";

function makeData(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    titre: "",
    description: "",
    loyer_hc: null,
    loyer_cc: null,
    charges: null,
    surface: null,
    nb_pieces: null,
    nb_chambres: null,
    type: "appartement",
    code_postal: null,
    ville: null,
    adresse: null,
    adresse_complete: null,
    meuble: null,
    dpe_classe_energie: null,
    dpe_ges: null,
    dpe_valeur: null,
    chauffage_type: null,
    chauffage_mode: null,
    etage: null,
    nb_etages: null,
    ascenseur: null,
    balcon: false,
    terrasse: false,
    parking_inclus: false,
    cave: false,
    climatisation: false,
    jardin: false,
    piscine: false,
    annee_construction: null,
    photos: [],
    cover_url: null,
    visite_virtuelle_url: null,
    source_url: "https://example.com/x",
    source_site: "generic",
    extraction_quality: { source: "generic", score: 0, details: [] },
    ...overrides,
  };
}

describe("validateExtractedData — loyer/m²", () => {
  it("ne signale rien sur un loyer/m² standard", () => {
    const warnings = validateExtractedData(
      makeData({ loyer_hc: 800, surface: 40 })
    );
    expect(warnings.find((w) => w.code.startsWith("RENT_PER_SQM"))).toBeUndefined();
  });

  it("signale (warning) un loyer/m² > 60 (probable parsing buggé)", () => {
    const warnings = validateExtractedData(
      makeData({ loyer_hc: 5000, surface: 40 })
    );
    const w = warnings.find((x) => x.code === "RENT_PER_SQM_TOO_HIGH");
    expect(w).toBeDefined();
    expect(w!.severity).toBe("warning");
  });

  it("signale (info) un loyer/m² < 5", () => {
    const warnings = validateExtractedData(
      makeData({ loyer_hc: 100, surface: 40 })
    );
    const w = warnings.find((x) => x.code === "RENT_PER_SQM_TOO_LOW");
    expect(w).toBeDefined();
    expect(w!.severity).toBe("info");
  });

  it("ne signale rien si surface ou loyer manquant", () => {
    expect(
      validateExtractedData(makeData({ loyer_hc: 800, surface: null }))
        .find((w) => w.code.startsWith("RENT_PER_SQM"))
    ).toBeUndefined();
    expect(
      validateExtractedData(makeData({ loyer_hc: null, surface: 40 }))
        .find((w) => w.code.startsWith("RENT_PER_SQM"))
    ).toBeUndefined();
  });
});

describe("validateExtractedData — surface vs nb_pieces", () => {
  it("signale un T4 sous-dimensionné (25 m² pour 4 pièces)", () => {
    const warnings = validateExtractedData(
      makeData({ surface: 25, nb_pieces: 4 })
    );
    expect(warnings.find((w) => w.code === "SURFACE_TOO_SMALL_FOR_ROOMS")).toBeDefined();
  });

  it("ne signale pas un T2 de 30 m² (15 m²/pièce, plausible)", () => {
    const warnings = validateExtractedData(
      makeData({ surface: 30, nb_pieces: 2 })
    );
    expect(warnings.find((w) => w.code === "SURFACE_TOO_SMALL_FOR_ROOMS")).toBeUndefined();
  });

  it("ne signale rien si nb_pieces=0 ou null (parking, etc.)", () => {
    expect(
      validateExtractedData(makeData({ surface: 12, nb_pieces: null })).find(
        (w) => w.code === "SURFACE_TOO_SMALL_FOR_ROOMS"
      )
    ).toBeUndefined();
    expect(
      validateExtractedData(makeData({ surface: 12, nb_pieces: 0 })).find(
        (w) => w.code === "SURFACE_TOO_SMALL_FOR_ROOMS"
      )
    ).toBeUndefined();
  });
});

describe("validateExtractedData — charges vs loyer", () => {
  it("signale charges > loyer (probable inversion)", () => {
    const warnings = validateExtractedData(
      makeData({ loyer_hc: 100, charges: 800 })
    );
    expect(warnings.find((w) => w.code === "CHARGES_ABOVE_RENT")).toBeDefined();
  });

  it("ne signale rien quand charges ≤ loyer", () => {
    const warnings = validateExtractedData(
      makeData({ loyer_hc: 800, charges: 80 })
    );
    expect(warnings.find((w) => w.code === "CHARGES_ABOVE_RENT")).toBeUndefined();
  });
});

describe("validateExtractedData — CP ↔ ville", () => {
  it("signale CP/ville incohérents (75001 → Paris, pas Lyon)", () => {
    const warnings = validateExtractedData(
      makeData({ code_postal: "75001", ville: "Lyon" })
    );
    expect(warnings.find((w) => w.code === "CITY_POSTAL_MISMATCH")).toBeDefined();
  });

  it("accepte 'Paris 11ème' avec un CP parisien (préfixe match)", () => {
    const warnings = validateExtractedData(
      makeData({ code_postal: "75011", ville: "Paris 11ème" })
    );
    expect(warnings.find((w) => w.code === "CITY_POSTAL_MISMATCH")).toBeUndefined();
  });

  it("est insensible aux accents (Saint-Denis vs saint-denis)", () => {
    const warnings = validateExtractedData(
      makeData({ code_postal: "97400", ville: "Saint-Denis" })
    );
    expect(warnings.find((w) => w.code === "CITY_POSTAL_MISMATCH")).toBeUndefined();
  });

  it("ne juge pas si le CP n'est pas dans le mapping (commune obscure)", () => {
    const warnings = validateExtractedData(
      makeData({ code_postal: "39570", ville: "Macornay" })
    );
    expect(warnings.find((w) => w.code === "CITY_POSTAL_MISMATCH")).toBeUndefined();
  });
});

describe("validateExtractedData — année de construction", () => {
  it("signale une année farfelue (1492)", () => {
    expect(
      validateExtractedData(makeData({ annee_construction: 1492 })).find(
        (w) => w.code === "CONSTRUCTION_YEAR_INVALID"
      )
    ).toBeDefined();
  });

  it("signale une année trop dans le futur (year + 10)", () => {
    const future = new Date().getFullYear() + 10;
    expect(
      validateExtractedData(makeData({ annee_construction: future })).find(
        (w) => w.code === "CONSTRUCTION_YEAR_INVALID"
      )
    ).toBeDefined();
  });

  it("accepte une VEFA (livraison year+3)", () => {
    const future = new Date().getFullYear() + 3;
    expect(
      validateExtractedData(makeData({ annee_construction: future })).find(
        (w) => w.code === "CONSTRUCTION_YEAR_INVALID"
      )
    ).toBeUndefined();
  });
});

describe("validateExtractedData — DPE G", () => {
  it("signale (info) un DPE G à risque locatif", () => {
    const w = validateExtractedData(makeData({ dpe_classe_energie: "G" })).find(
      (x) => x.code === "DPE_G_RESTRICTION"
    );
    expect(w).toBeDefined();
    expect(w!.severity).toBe("info");
  });

  it("ne signale rien pour DPE A à F", () => {
    for (const dpe of ["A", "B", "C", "D", "E", "F"] as const) {
      expect(
        validateExtractedData(
          makeData({ dpe_classe_energie: dpe })
        ).find((x) => x.code === "DPE_G_RESTRICTION")
      ).toBeUndefined();
    }
  });
});

describe("validateExtractedData — composition", () => {
  it("renvoie plusieurs warnings simultanés sur des données vraiment cassées", () => {
    const warnings = validateExtractedData(
      makeData({
        loyer_hc: 100,
        charges: 800,
        surface: 25,
        nb_pieces: 4,
        code_postal: "75001",
        ville: "Lyon",
        dpe_classe_energie: "G",
      })
    );
    const codes = warnings.map((w) => w.code).sort();
    expect(codes).toContain("CHARGES_ABOVE_RENT");
    expect(codes).toContain("SURFACE_TOO_SMALL_FOR_ROOMS");
    expect(codes).toContain("CITY_POSTAL_MISMATCH");
    expect(codes).toContain("DPE_G_RESTRICTION");
  });

  it("renvoie un tableau vide sur des données propres", () => {
    expect(
      validateExtractedData(
        makeData({
          loyer_hc: 800,
          surface: 40,
          nb_pieces: 2,
          charges: 50,
          code_postal: "75011",
          ville: "Paris",
          dpe_classe_energie: "D",
          annee_construction: 1995,
        })
      )
    ).toEqual([]);
  });
});

describe("normalizeAddressForDuplicate", () => {
  it("uniformise majuscules, accents, ponctuation et espaces", () => {
    expect(normalizeAddressForDuplicate("10, Avenue de la République")).toBe(
      "10 avenue de la republique"
    );
    expect(normalizeAddressForDuplicate("  10   Avenue  de la  République  ")).toBe(
      "10 avenue de la republique"
    );
  });

  it("matche les variantes typiques pour la détection de doublon", () => {
    const a = normalizeAddressForDuplicate("3 rue Saint-André, 75004");
    const b = normalizeAddressForDuplicate("3 RUE SAINT-ANDRE 75004");
    expect(a).toBe(b);
  });

  it("renvoie une chaîne vide pour null/undefined/vide", () => {
    expect(normalizeAddressForDuplicate(null)).toBe("");
    expect(normalizeAddressForDuplicate(undefined)).toBe("");
    expect(normalizeAddressForDuplicate("")).toBe("");
    expect(normalizeAddressForDuplicate("   ")).toBe("");
  });
});
